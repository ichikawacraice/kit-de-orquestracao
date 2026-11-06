// F438 (ADR 0030): qual app hospeda esta sessão do Claude Code e qual é o endereço dela. Um módulo só responde; o que muda por
// anfitrião pergunta aqui. A ordem: KIT_ANFITRIAO no ambiente > chave `anfitriao` do .claude/kit.json do projeto (quando não é
// "auto") > os sinais (CLAUDE_CODE_HOST_SESSION_ID → claude-desktop; ORCA_AGENT_SESSION_ID ou ORCA_STRUCTURED_SESSION=1 → orca;
// nenhum → terminal). Valor desconhecido vale "auto" e volta em `desconhecido` (para o log). O valor fixo que contradiz os
// sinais volta em `contradicao` (o início da sessão avisa numa linha). Não é hook: não lê stdin nem grava nada.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const ANFITRIOES = ['claude-desktop', 'orca', 'terminal'];
// O endereço do Orca: a coordenadora tem sublinhados (`claude_<uuid>`), o worker tem hífens (uuid solto).
export const ID_DO_ORCA = /^orca_session_id:[A-Za-z0-9_-]+$/;
// O endereço do app (o `local_…` do registro). F439: o painel aceita os dois onde grava quem é a sessão (com, sessoes, donoLocalId).
export const ID_DO_APP = /^local_[0-9a-f-]{36}$/;
export const ehIdDeSessao = (v) => typeof v === 'string' && (ID_DO_APP.test(v) || ID_DO_ORCA.test(v));
// F448 (fatia 9): o endereço de entrega no Orca, o `--to` que o `orca orchestration send` aceita: a sessão (`orca_session_id:`),
// o despacho (`dispatch:`) ou a Run (`run:`). A aba do kit no Orca (orca/painel-do-kit, `envio.mjs`) valida com a mesma forma;
// um teste compara as duas.
export const DESTINO_DO_ORCA = /^(?:run|dispatch|orca_session_id):[A-Za-z0-9_-]+$/;
export const ehDestinoDoOrca = (v) => typeof v === 'string' && DESTINO_DO_ORCA.test(v);

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

function pelosSinais(env) {
  if (texto(env.CLAUDE_CODE_HOST_SESSION_ID)) return 'claude-desktop';
  if (texto(env.ORCA_AGENT_SESSION_ID) || texto(env.ORCA_STRUCTURED_SESSION) === '1') return 'orca';
  return 'terminal';
}

// A chave do .claude/kit.json mais próximo, subindo do cwd até a raiz do projeto (a pasta com .git). Sem arquivo, sem chave
// ou com JSON ilegível: undefined (segue os sinais).
function chaveDoProjeto(cwd) {
  let d = resolve(cwd || '.');
  for (;;) {
    const kit = join(d, '.claude', 'kit.json');
    if (existsSync(kit)) {
      try { return JSON.parse(readFileSync(kit, 'utf8'))?.anfitriao; } catch { return undefined; }
    }
    if (existsSync(join(d, '.git'))) return undefined;
    const pai = dirname(d);
    if (pai === d) return undefined;
    d = pai;
  }
}

/** → { anfitriao, fonte: 'env'|'chave'|'sinais', pelosSinais, contradicao: string|null, desconhecido: string|null } */
export function anfitriao({ env = process.env, cwd = process.cwd() } = {}) {
  const sinais = pelosSinais(env);
  let desconhecido = null;
  const doEnv = texto(env.KIT_ANFITRIAO);
  if (doEnv && doEnv !== 'auto') {
    if (ANFITRIOES.includes(doEnv)) return { anfitriao: doEnv, fonte: 'env', pelosSinais: sinais, contradicao: null, desconhecido };
    desconhecido = doEnv;
  }
  // Desconhecido no ambiente vale "auto": a chave do projeto ainda decide.
  const chave = chaveDoProjeto(cwd);
  const v = texto(chave);
  if (v && v !== 'auto') {
    if (ANFITRIOES.includes(v)) {
      const contradicao = v === sinais ? null
        : `o .claude/kit.json fixa o anfitrião em "${v}", mas os sinais desta sessão dizem "${sinais}"; o kit segue "${v}". Se a detecção estava certa, ponha "anfitriao": "auto".`;
      return { anfitriao: v, fonte: 'chave', pelosSinais: sinais, contradicao, desconhecido };
    }
    desconhecido ??= v;
  } else if (chave !== undefined && chave !== null && typeof chave !== 'string') desconhecido ??= JSON.stringify(chave);
  return { anfitriao: sinais, fonte: 'sinais', pelosSinais: sinais, contradicao: null, desconhecido };
}

function enderecoEm(a, env) {
  if (a === 'claude-desktop') return texto(env.CLAUDE_CODE_HOST_SESSION_ID) || null;
  if (a === 'orca') {
    const id = `orca_session_id:${texto(env.ORCA_AGENT_SESSION_ID)}`;
    return ID_DO_ORCA.test(id) ? id : null;
  }
  return null;
}

/**
 * O endereço desta sessão: `local_…` no app, `orca_session_id:<id>` no Orca, null no terminal (ou sem id legível). O anfitrião
 * fixado (chave ou KIT_ANFITRIAO) muda as regras, não a identidade: quando ele não dá endereço, vale o dos sinais.
 */
export function quemSou({ env = process.env, cwd = process.cwd() } = {}) {
  const a = anfitriao({ env, cwd });
  return enderecoEm(a.anfitriao, env) ?? (a.pelosSinais !== a.anfitriao ? enderecoEm(a.pelosSinais, env) : null);
}
