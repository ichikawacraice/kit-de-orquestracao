#!/usr/bin/env node
// F6 (24/10): grava em <worktree>/.claude/settings.local.json as skills que o PAPEL do membro lê.
// Fonte: skills-por-papel.json (mapa). Troca só `skillOverrides` e `enabledPlugins`; o resto do arquivo fica.
//   node aplicar-skills-do-papel.mjs <local_…> | --todos   [--dry-run | --conferir]
// Env (testes): POOL_APP_SESSOES_DIR (registro do app), SKILLS_MAPA (JSON), SKILLS_BACKUP_DIR.
import { existsSync, readFileSync, writeFileSync, renameSync, readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { membroDoPool } from '../hooks/pool-comum.mjs';

const H = homedir();
const AQUI = dirname(fileURLToPath(import.meta.url));
const MAPA = process.env.SKILLS_MAPA || join(AQUI, 'skills-por-papel.json');
const BACKUPS = process.env.SKILLS_BACKUP_DIR || join(H, '.claude', 'orquestracao', 'backups');
const SESSOES = process.env.POOL_APP_SESSOES_DIR || join(H, 'Library', 'Application Support', 'Claude', 'claude-code-sessions');
// Só a conta atual do app: as sessões de conta antiga seguem no disco, mas não recebem trabalho daqui (operador, 24/10).
// `conta-atual.txt` guarda o caminho relativo `<conta>/<org>` dentro de claude-code-sessions; troque ao mudar de conta.
// Com POOL_APP_SESSOES_DIR (teste) o filtro não se aplica.
const CONTA = process.env.POOL_APP_SESSOES_DIR ? null : (() => {
  try { return readFileSync(join(AQUI, 'conta-atual.txt'), 'utf8').trim() || null; } catch { return null; }
})();

function* registros(dir) {
  let es;
  try { es = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of es) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* registros(p);
    else if (e.isFile() && e.name.startsWith('local_') && e.name.endsWith('.json')) {
      try { yield JSON.parse(readFileSync(p, 'utf8')); } catch { /* ilegível */ }
    }
  }
}

// O que o papel recebe no settings.local.json. Valor `on` não se grava (é o default).
export function configDoPapel(mapa, papel) {
  const skillOverrides = {};
  for (const [nome, s] of Object.entries(mapa.skills)) {
    if (s.origem === 'plugin') continue;
    const v = mapa.valores[s[papel]];
    if (!v) throw new Error(`mapa sem valor para ${nome}/${papel}: ${s[papel]}`);
    if (v !== 'on') skillOverrides[nome] = v;
  }
  const enabledPlugins = {};
  for (const [nome, p] of Object.entries(mapa.plugins)) enabledPlugins[nome] = p[papel];
  return { skillOverrides, enabledPlugins };
}

const stamp = () => {
  const d = new Date(); const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
};

function tratar(reg, mapa, modo) {
  const m = membroDoPool(reg.title);
  const rotulo = (wt, r) => `${m?.id ?? '-'} ${reg.sessionId} ${wt ?? '-'} ${r}`;
  if (!m) return rotulo(null, 'pulado:nao-e-membro');
  const wt = reg.worktreePath || reg.cwd;
  if (!wt || !existsSync(wt)) return rotulo(wt, 'pulado:sem-worktree');
  let principal = false;
  try { principal = statSync(join(wt, '.git')).isDirectory(); } catch { return rotulo(wt, 'pulado:sem-git'); }
  if (principal) return rotulo(wt, 'pulado:checkout-principal');

  const arq = join(wt, '.claude', 'settings.local.json');
  let atual = {};
  if (existsSync(arq)) {
    try { atual = JSON.parse(readFileSync(arq, 'utf8')); } catch { return rotulo(wt, 'pulado:settings-ilegivel'); }
  }
  const nova = configDoPapel(mapa, m.papel);
  const novo = { ...atual, skillOverrides: nova.skillOverrides, enabledPlugins: { ...(atual.enabledPlugins || {}), ...nova.enabledPlugins } };
  const igual = JSON.stringify(atual) === JSON.stringify(novo)
    || (JSON.stringify(atual.skillOverrides ?? {}) === JSON.stringify(novo.skillOverrides) && JSON.stringify(atual.enabledPlugins ?? {}) === JSON.stringify(novo.enabledPlugins));
  if (igual) return rotulo(wt, 'igual');
  if (modo === 'conferir') return rotulo(wt, 'diferente');
  if (modo === 'dry-run') return `${rotulo(wt, 'aplicaria')}\n${JSON.stringify({ skillOverrides: novo.skillOverrides, enabledPlugins: novo.enabledPlugins }, null, 2)}`;
  mkdirSync(dirname(arq), { recursive: true });
  if (existsSync(arq)) {
    mkdirSync(BACKUPS, { recursive: true });
    copyFileSync(arq, join(BACKUPS, `settings-local-${basename(wt)}-${stamp()}.json`));
  }
  const tmp = `${arq}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(novo, null, 2) + '\n');
  renameSync(tmp, arq);
  return rotulo(wt, 'aplicado');
}

function main(argv) {
  const modo = argv.includes('--dry-run') ? 'dry-run' : argv.includes('--conferir') ? 'conferir' : 'aplicar';
  const todos = argv.includes('--todos');
  const id = argv.find((a) => a.startsWith('local_'));
  if (!todos && !id) { console.error('uso: aplicar-skills-do-papel.mjs <local_…>|--todos [--dry-run|--conferir]'); return 2; }
  const mapa = JSON.parse(readFileSync(MAPA, 'utf8'));
  let n = 0;
  if (!process.env.POOL_APP_SESSOES_DIR && !CONTA) { console.error(`sem ${join(AQUI, 'conta-atual.txt')}: não sei qual é a conta atual`); return 2; }
  for (const reg of registros(CONTA ? join(SESSOES, CONTA) : SESSOES)) {
    if (id ? reg.sessionId !== id : (reg.isArchived || !membroDoPool(reg.title))) continue;
    n++;
    console.log(tratar(reg, mapa, modo));
  }
  if (!n) { console.error(id ? `sessão ${id} não encontrada` : 'nenhum membro do pool achado'); return 1; }
  return 0;
}

process.exitCode = main(process.argv.slice(2));
