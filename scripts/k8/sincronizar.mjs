#!/usr/bin/env node
// Porte deliberado da instalação viva (~/.claude) para o plugin, um item por vez — o porte NÃO é contínuo.
//   node scripts/k8/sincronizar.mjs --listar                      diferenças de paridade e a quem cada uma pertence (declarada ou não)
//   node scripts/k8/sincronizar.mjs <rótulo> <arquivo>... [--forcar] [--sem-commit]
// `<arquivo>` é relativo ao plugin (`hooks/pool-comum.mjs`, `skills/orquestradora/SKILL.md`). Mostra o diff de cada um, copia a versão
// viva para o plugin e grava UM commit `sync(<rótulo>): …` com só esses arquivos. Arquivo com diferença declarada (prefixo/painel/caminho)
// recusa: a cópia apagaria a adaptação do plugin; `--forcar` copia mesmo assim e a adaptação tem de ser refeita à mão (e re-declarada).
// Env: KIT_PARIDADE_HOME (o ~/.claude vivo), KIT_PARIDADE_PLUGIN (a pasta do plugin) — os mesmos do paridade.mjs.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLUGIN = resolve(process.env.KIT_PARIDADE_PLUGIN || join(KIT, 'plugins', 'orquestracao'));
const CLAUDE = process.env.KIT_PARIDADE_HOME || join(homedir(), '.claude');
const PARES = [['hooks', 'hooks'], ['skills', 'skills'], ['agents', 'agents'], ['pool', 'orquestracao/pool']];
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const posicionais = args.filter((a) => !a.startsWith('--'));
const run = (cmd, a, o = {}) => spawnSync(cmd, a, { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', ...o });
const paridade = (extra = []) => run('node', [join(KIT, 'scripts', 'paridade.mjs'), ...extra], { env: { ...process.env, KIT_PARIDADE_HOME: CLAUDE, KIT_PARIDADE_PLUGIN: PLUGIN } });

function viva(rel) {
  const [dePlugin, deClaude] = PARES.find(([p]) => rel === p || rel.startsWith(`${p}/`)) ?? [];
  return dePlugin === undefined ? null : join(CLAUDE, deClaude, relative(dePlugin, rel));
}
const diffUnificado = (a, b) => { const r = run('diff', ['-u', a, b]); return r.status === 1 ? r.stdout : ''; };

function listar() {
  const atual = JSON.parse(paridade(['--declarar']).stdout || '{}');
  const lista = run('node', [join(KIT, 'scripts', 'paridade.mjs')], { env: { ...process.env, KIT_PARIDADE_HOME: CLAUDE, KIT_PARIDADE_PLUGIN: PLUGIN } }).stdout;
  const pendentes = lista.split('\n').filter((l) => l.startsWith('DIFERE '));
  if (pendentes.length === 0) console.log('paridade 0: nada a sincronizar');
  for (const l of pendentes) {
    const rel = l.slice(7).split(':')[0];
    const motivo = atual[rel]?.motivo;
    console.log(`${rel}  [${motivo && motivo !== 'FALTA' ? `declarada: ${motivo} — a cópia apaga a adaptação` : 'sem declaração — cópia direta'}]`);
  }
  return 0;
}

function sincronizar(rotulo, alvos) {
  const atual = JSON.parse(paridade(['--declarar']).stdout || '{}');
  const copiar = [];
  for (const rel of alvos) {
    const de = viva(rel); const para = join(PLUGIN, rel);
    if (!de) { console.error(`${rel}: fora de hooks/, skills/, agents/ e pool/`); return 2; }
    if (!existsSync(de)) { console.error(`${rel}: não existe na viva (${de})`); return 2; }
    if (!existsSync(para)) { console.error(`${rel}: não existe no plugin (${para}); arquivo novo se cria à mão`); return 2; }
    const d = diffUnificado(para, de);
    if (!d) { console.log(`${rel}: já igual à viva, nada a copiar`); continue; }
    const motivo = atual[rel]?.motivo;
    if (motivo && motivo !== 'FALTA' && !flag('--forcar')) {
      console.error(`${rel}: tem diferença declarada (${motivo}); a cópia apagaria a adaptação do plugin. Refaça à mão ou use --forcar.`);
      return 2;
    }
    console.log(`--- ${rel}\n${d}`);
    copiar.push([rel, de, para]);
  }
  if (copiar.length === 0) return 0;
  for (const [, de, para] of copiar) { copyFileSync(de, para); }
  if (flag('--sem-commit')) { console.log(`copiado: ${copiar.map(([r]) => r).join(', ')} (sem commit)`); return 0; }
  const repo = execFileSync('git', ['-C', dirname(copiar[0][2]), 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const caminhos = copiar.map(([, , p]) => relative(repo, p));
  execFileSync('git', ['-C', repo, 'add', '--', ...caminhos]);
  const msg = `sync(${rotulo}): ${copiar.map(([r]) => r).join(', ')}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
  const c = run('git', ['-C', repo, 'commit', '-q', '-m', msg, '--', ...caminhos]);
  if (c.status !== 0) { console.error(`commit falhou: ${c.stderr}`); return 1; }
  console.log(`commit sync(${rotulo}): ${copiar.length} arquivo(s)`);
  return 0;
}

if (flag('--listar')) process.exitCode = listar();
else if (posicionais.length < 2) { console.error('uso: sincronizar.mjs --listar | <rótulo> <arquivo>... [--forcar] [--sem-commit]'); process.exitCode = 2; }
else process.exitCode = sincronizar(posicionais[0], posicionais.slice(1));
