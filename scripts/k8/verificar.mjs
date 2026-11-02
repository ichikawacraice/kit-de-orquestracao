#!/usr/bin/env node
// K8: confere uma máquina migrada. `node scripts/k8/verificar.mjs --home <HOME> [--backup <pasta>] [--projeto <pasta adotada>]`
// ok:/falha: por linha; exit 1 se houver falha. Testes das travas rodam contra o hooks/ INSTALADO (HOOKS_DIR), não contra o repositório.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const valor = (n) => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1]; };
const HOME_ = resolve(valor('--home') ?? process.env.HOME ?? homedir());
const C = join(HOME_, '.claude');
const ENV = { ...process.env, HOME: HOME_, CLAUDE_CONFIG_DIR: C };
let falhas = 0;
const ok = (m) => console.log(`ok: ${m}`);
const falha = (m) => { falhas++; console.log(`falha: ${m}`); };
const rodar = (cmd, a, extra = {}) => spawnSync(cmd, a, { encoding: 'utf8', env: ENV, timeout: 300000, killSignal: 'SIGKILL', ...extra });

const inst = JSON.parse(readFileSync(join(C, 'plugins', 'installed_plugins.json'), 'utf8')).plugins;
const caminho = (p) => (inst[`${p}@ichikawa-kit`] ?? inst[`${p}@kit-de-orquestracao`])?.[0]?.installPath; // o nome novo do marketplace, ou o antigo (F344)
for (const p of ['orquestracao', 'painel-sessoes']) caminho(p) && existsSync(caminho(p)) ? ok(`plugin ${p} instalado em ${caminho(p)}`) : falha(`plugin ${p} não instalado`);
const raiz = caminho('orquestracao');
if (!raiz) { console.log('sem o plugin orquestracao: nada mais a conferir'); process.exit(1); }

// nenhum hook do kit sobrou no settings.json (hook duplicado = falha)
const s = JSON.parse(readFileSync(join(C, 'settings.json'), 'utf8'));
const doKit = new Set(readdirSync(join(raiz, 'hooks')).filter((n) => n.endsWith('.mjs')));
const sobras = Object.values(s.hooks ?? {}).flat().flatMap((g) => g.hooks ?? []).map((h) => h.command).filter((c) => /\.claude\/hooks\//.test(c ?? '') && doKit.has(String(c).match(/([\w.-]+\.mjs)/)?.[1]));
sobras.length ? falha(`hooks do kit ainda no settings.json: ${sobras.join(' | ')}`) : ok('nenhum hook do kit no settings.json (só o do plugin dispara)');
(s.enabledPlugins?.['orquestracao@ichikawa-kit'] ?? s.enabledPlugins?.['orquestracao@kit-de-orquestracao']) === true ? ok('orquestracao habilitado no settings.json') : falha('orquestracao não habilitado no settings.json');

// kit doutor num projeto adotado
const projeto = valor('--projeto');
if (projeto) {
  const d = rodar('node', [join(KIT, 'cli', 'kit.mjs'), 'doutor'], { cwd: projeto });
  console.log(d.stdout.trimEnd());
  d.status === 0 ? ok('kit doutor sem falha') : falha(`kit doutor saiu ${d.status}: ${d.stderr.trim()}`);
}

// cada trava dispara uma vez: os testes sintéticos do plugin, contra o hooks/ instalado
const TESTES = [
  ['T3 T5 T6 T7 (travas-da-sessao)', 'travas-da-sessao.test.mjs'],
  ['orquestradora-nao-edita, subagente-nao-edita, criterio-da-dona, ritual (hooks-crewai)', 'hooks-crewai.test.mjs'],
  ['painel-das-sessoes', 'painel-das-sessoes.test.mjs'],
  ['fila-do-item', 'fila-do-item.test.mjs'],
  ['pool-comum', 'pool-comum.test.mjs'],
];
for (const [nome, arq] of TESTES) {
  const r = rodar('node', [join(raiz, 'hooks', 'tests', arq)], { env: { ...process.env, HOOKS_DIR: join(raiz, 'hooks') } });
  const saida = `${r.stdout}${r.stderr}`;
  const oks = (saida.match(/^ok /gm) ?? []).length + (saida.match(/^ℹ pass (\d+)/m)?.[1] ? Number(saida.match(/^ℹ pass (\d+)/m)[1]) : 0);
  const fails = (saida.match(/^FAIL /gm) ?? []).length;
  r.status === 0 && fails === 0 ? ok(`${nome}: ${oks} casos, 0 falha`) : falha(`${nome}: exit ${r.status}, ${fails} FAIL\n${saida.split('\n').filter((l) => /FAIL|not ok|✖/.test(l)).slice(0, 6).join('\n')}`);
}

// o caminho antigo e o do plugin respondem igual (mesmos dados)
const antigo = join(C, 'skills', 'orquestradora', 'scripts', 'painel.mjs');
for (const colecao of ['fila', 'sessoes', 'perguntas']) {
  const a = rodar('node', [antigo, 'list', colecao]);
  const b = rodar('bash', [join(raiz, 'bin', 'painel'), 'list', colecao]);
  const original = valor('--backup') && join(valor('--backup'), 'copia', 'skills', 'orquestradora', 'scripts', 'painel.mjs');
  if (original && existsSync(original)) {
    const o = rodar('node', [original, 'list', colecao]);
    o.status === 0 && o.stdout === b.stdout && o.stdout.length > 0 ? ok(`painel list ${colecao}: painel.mjs de ANTES da migração (backup) = bin/ do plugin`) : falha(`painel list ${colecao}: antes exit ${o.status} (${o.stdout.length}B) × plugin (${b.stdout.length}B) ${o.stderr.trim().slice(0, 200)}`);
  }
  a.status === 0 && a.stdout === b.stdout && a.stdout.length > 0 ? ok(`painel list ${colecao}: caminho antigo = bin/ do plugin (${a.stdout.length} bytes)`) : falha(`painel list ${colecao}: antigo exit ${a.status} (${a.stdout.length}B) × plugin exit ${b.status} (${b.stdout.length}B) ${a.stderr.trim().slice(0, 200)}`);
}
// o repasse do contador resolve até o plugin (HOME descartável: não gasta um Q-ID de verdade)
const tmp = mkdtempSync(join(homedir(), '.k8-verificar-'));
const pg = rodar('bash', [join(C, 'skills', 'orquestradora', 'scripts', 'proxima-pergunta.sh')], { env: { ...ENV, HOME: tmp } });
/^Q\d+$/.test(pg.stdout.trim()) ? ok(`proxima-pergunta.sh (repasse) devolveu ${pg.stdout.trim()} num HOME descartável`) : falha(`proxima-pergunta.sh (repasse): exit ${pg.status} ${`${pg.stdout}${pg.stderr}`.trim().slice(0, 200)}`);
rmSync(tmp, { recursive: true, force: true });
process.exitCode = falhas ? 1 : 0;
