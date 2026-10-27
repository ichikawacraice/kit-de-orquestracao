#!/usr/bin/env node
// Aposentado depois da K8 (25/10); fica para a migração de outra máquina. Paridade plugin × ~/.claude até a K8: cada arquivo de plugins/orquestracao/ que tem par em ~/.claude deve diferir DO MESMO
// JEITO declarado abaixo (o hash do `diff` do par). Conserto copiado igual nos dois lados não muda o diff e passa; conserto
// só de um lado muda o diff e falha. Não é teste da suíte: lê o HOME real. Rodar antes de commit que toque hooks/scripts/skills.
//   node scripts/paridade.mjs              confere (exit 1 se algo não declarado)
//   node scripts/paridade.mjs --declaradas imprime o DECLARADAS gravado (o sincronizar lê, para recusar arquivo novo declarado)
//   node scripts/paridade.mjs --declarar   imprime o objeto DECLARADAS atual para colar aqui, depois de conferir cada diferença
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = process.env.KIT_PARIDADE_PLUGIN || join(RAIZ, 'plugins', 'orquestracao'); // o override é do teste do sincronizar
const CLAUDE = process.env.KIT_PARIDADE_HOME || join(homedir(), '.claude');

// Onde cada pasta do plugin mora em ~/.claude (bin/ e .claude-plugin/ só existem no plugin).
const PARES = [['hooks', 'hooks'], ['skills', 'skills'], ['agents', 'agents'], ['pool', 'orquestracao/pool']];
// Só no plugin, por desenho (K2/K3).
const SO_NO_PLUGIN = [
  'hooks/hooks.json', 'hooks/sessao-inicio.mjs', 'hooks/regras-globais.md', 'hooks/tests/hooks-json.test.mjs', 'hooks/tests/bin.test.mjs',
];
// Diferenças declaradas: arquivo → { motivo, hash do diff }. Motivos:
//  prefixo   — hooks reconhecem `orquestracao:` (semPrefixoDoPlugin), K2
//  painel    — hooks reconhecem o comando `painel` do bin/ (INVOCACAO_DO_PAINEL, gravaNoPainel), K2
//  texto     — textos citam `painel`/`${CLAUDE_PLUGIN_ROOT}` no lugar do caminho antigo, K3
//  caminho   — script/teste resolve o irmão pelo plugin (SCRIPTS_DIR, pool-comum relativo, ../hooks), K3
//  apelidos  — mapa com apelidos `orquestracao:<skill>`, K3
const DECLARADAS = {
  'hooks/fila-do-item.mjs': { motivo: 'prefixo + painel', hash: '75a944388492f823' },
  'hooks/hooks-crewai-comum.mjs': { motivo: 'prefixo + painel', hash: '9fb396511bc5f0b0' },
  'hooks/orquestradora-ritual.mjs': { motivo: 'prefixo + painel', hash: '4081d57ca171c9f5' },
  'hooks/painel-das-sessoes.mjs': { motivo: 'prefixo + painel', hash: '62843b71e9c69668' },
  'hooks/pool-comum.mjs': { motivo: 'prefixo', hash: '6f8579544c785e2d' },
  'hooks/subagente-nao-edita.mjs': { motivo: 'prefixo + painel', hash: '55e5400a46c51163' },
  'hooks/tests/hooks-crewai.test.mjs': { motivo: 'prefixo + painel', hash: '73c401744223b63e' },
  'hooks/tests/painel-das-sessoes.test.mjs': { motivo: 'caminho (+ prefixo/painel nos testes de hooks)', hash: 'fdee3c233689f1d6' },
  'hooks/tests/painel-fila.test.mjs': { motivo: 'caminho', hash: 'eb32cb01bb1f1e48' },
  'hooks/tests/painel-trava-concorrencia.mjs': { motivo: 'caminho', hash: '4c34c7bb2c844e28' },
  'hooks/tests/painel-validacao.test.mjs': { motivo: 'caminho', hash: '84d33a2a27d14935' },
  'hooks/tests/pool-comum.test.mjs': { motivo: 'prefixo + painel', hash: '310b7f405b505ef0' },
  'skills/ausente/SKILL.md': { motivo: 'texto', hash: '73c1c6d16efc35b9' },
  'skills/handoff-de-sessao/SKILL.md': { motivo: 'texto', hash: 'a28c0cca36977121' },
  'skills/orquestradora/SKILL.md': { motivo: 'texto', hash: 'b380397051c2c308' },
  'skills/orquestradora/scripts/painel.mjs': { motivo: 'caminho', hash: 'a3560e8a93afd841' },
  'skills/papeis-e-modelos/SKILL.md': { motivo: 'texto', hash: 'd9702c99434c8203' },
  'skills/notas-de-release/escrita.md': { motivo: 'texto', hash: 'e2935add495e964c' },
  'pool/protocolo.md': { motivo: 'texto', hash: '440418b8672a2eb1' },
};

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
function arquivos(dir) {
  const o = [];
  const varre = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === '.DS_Store') continue; const p = join(d, e.name); if (e.isDirectory()) varre(p); else o.push(p); } };
  if (existsSync(dir)) varre(dir);
  return o;
}
function diffDe(a, b) {
  try { execFileSync('diff', [a, b], { encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' }); return ''; }
  catch (e) { if (e.status === 1) return e.stdout; throw e; }
}

const achados = []; const atual = {}; let pares = 0;
for (const [dePlugin, deClaude] of PARES) {
  for (const f of arquivos(join(PLUGIN, dePlugin))) {
    const rel = relative(PLUGIN, f);
    const par = join(CLAUDE, deClaude, relative(join(PLUGIN, dePlugin), f));
    if (!existsSync(par)) { if (!SO_NO_PLUGIN.includes(rel)) achados.push(`${rel}: sem par em ${par} e não está em SO_NO_PLUGIN`); continue; }
    pares++;
    const d = diffDe(par, f);
    if (!d) { if (DECLARADAS[rel]) achados.push(`${rel}: está declarada como diferente, mas é idêntica ao par`); continue; }
    atual[rel] = { motivo: DECLARADAS[rel]?.motivo ?? 'FALTA', hash: sha(d) };
    if (!DECLARADAS[rel]) achados.push(`${rel}: difere do par e não está declarada`);
    else if (DECLARADAS[rel].hash !== atual[rel].hash) achados.push(`${rel}: a diferença com o par mudou (conserto de um lado só?) — copie para o outro ou re-declare`);
  }
}
for (const rel of SO_NO_PLUGIN) if (!existsSync(join(PLUGIN, rel))) achados.push(`${rel}: está em SO_NO_PLUGIN e não existe`);

if (process.argv.includes('--declaradas')) { console.log(JSON.stringify(DECLARADAS, null, 2)); process.exitCode = 0; }
else if (process.argv.includes('--declarar')) { console.log(JSON.stringify(atual, null, 2)); process.exitCode = 0; }
else {
  for (const a of achados) console.log(`DIFERE ${a}`);
  console.log(`${pares} pares conferidos, ${Object.keys(atual).filter((k) => DECLARADAS[k]).length} com diferença declarada, ${achados.length} não declarada(s)`);
  process.exitCode = achados.length || pares === 0 ? 1 : 0;
}
