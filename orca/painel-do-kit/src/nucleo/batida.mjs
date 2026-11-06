// A batida de leitura que o worker da aba roda no Orca (F460, ADR 0032). No Orca o mod `painel-sessoes` não roda, e sem
// batida o `deduzido.json` envelhece e a seção Sessões avisa que o estado não se atualiza. O worker roda
// `painel.mjs batida --leitura` quando o deduzido tem 10 min (o relógio confere a cada minuto): deduz e grava o deduzido e fecha o item cujo PR mergeou (F472, ADR 0034);
// não cutuca, não solta nem lança fila.
// Aqui fica o que é puro ou só lê arquivo: quando rodar, qual script e com que ambiente.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** De quanto em quanto tempo (min), o mesmo intervalo da batida do mod e do pulo do `batida --leitura`. */
export const BATIDA_MIN = 10;

/**
 * De quanto em quanto o relógio do worker confere o deduzido. Bem menor que a `BATIDA_MIN`: o `em` gravado nasce uns ms
 * depois do toque, e um relógio de 10 min acharia o arquivo com pouco menos de 10 min e pularia (cadência real de 20 min).
 */
export const TOQUE_MS = 60_000;

/**
 * Roda a batida se `batida/deduzido.json` (ao lado da pasta do painel, onde a seção Sessões o lê) falta, está ilegível ou
 * tem 10 min ou mais. Com menos, outra batida (a do app desktop, ou a desta aba) já o gravou: não roda.
 */
export function precisaDaBatida(painelDir, agoraMs) {
  let em = NaN;
  try { em = Date.parse(JSON.parse(readFileSync(join(dirname(painelDir), 'batida', 'deduzido.json'), 'utf8'))?.em ?? ''); } catch { /* sem o arquivo */ }
  return !Number.isFinite(em) || Math.abs(agoraMs - em) >= BATIDA_MIN * 60_000;
}

/**
 * O `painel.mjs` que a batida roda: `PAINEL_DO_KIT_SCRIPT` (teste), senão o do plugin `orquestracao` instalado no escopo do
 * usuário (`~/.claude/plugins/installed_plugins.json`, como o mod acha o dele). Sem ele, ou com o caminho sumido: null.
 */
export function scriptDaBatida({ env = process.env, home = homedir() } = {}) {
  if (env.PAINEL_DO_KIT_SCRIPT) return env.PAINEL_DO_KIT_SCRIPT;
  try {
    const reg = JSON.parse(readFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), 'utf8'));
    const chave = Object.keys(reg?.plugins ?? {}).find((k) => k.startsWith('orquestracao@'));
    const lista = chave ? reg.plugins[chave] : null;
    const e = Array.isArray(lista) ? lista.find((x) => x?.scope === 'user' && typeof x.installPath === 'string') : null;
    const f = e ? join(e.installPath, 'skills', 'orquestradora', 'scripts', 'painel.mjs') : null;
    return f && existsSync(f) ? f : null;
  } catch { return null; }
}

/**
 * O ambiente do processo da batida: o binário do Orca roda como Node (`ELECTRON_RUN_AS_NODE`); com a pasta do painel trocada
 * (teste), a batida grava ao lado dela, onde a seção Sessões lê.
 */
export function ambienteDaBatida(env = process.env) {
  const saida = { ...env, ELECTRON_RUN_AS_NODE: '1' };
  if (env.PAINEL_DIR && !env.HOOKS_CREWAI_BASE) saida.HOOKS_CREWAI_BASE = dirname(env.PAINEL_DIR);
  return saida;
}
