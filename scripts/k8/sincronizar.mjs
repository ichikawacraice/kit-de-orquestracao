#!/usr/bin/env node
// Porte deliberado da instalação viva (~/.claude) para o plugin, um item por vez — o porte NÃO é contínuo.
//   node scripts/k8/sincronizar.mjs --listar                      diferenças de paridade e a quem cada uma pertence (declarada ou não)
//   node scripts/k8/sincronizar.mjs <rótulo> <arquivo>... [--base <arquivo-ou-pasta>] [--forcar] [--sem-commit]
// `<arquivo>` é relativo ao plugin (`hooks/pool-comum.mjs`, `skills/orquestradora/SKILL.md`). Mostra o diff de cada um, copia a versão
// viva para o plugin e grava UM commit `sync(<rótulo>): …` com só esses arquivos. Arquivo com diferença declarada (prefixo/painel/caminho)
// recusa: a cópia apagaria a adaptação do plugin; `--forcar` copia mesmo assim e a adaptação tem de ser refeita à mão (e re-declarada).
// `--base`: a cópia da viva de ANTES da frente (a que fica no backup dela; pasta com o nome do arquivo ou o caminho relativo, ou um arquivo só).
// Com ela cada arquivo é aplicado em 3 vias (`git merge-file plugin base viva`): a mudança da frente entra e a adaptação do plugin fica.
// Conflito, base ausente ou arquivo com diferença declarada que não existia na base: recusa (exit 2) sem gravar nada.
// Env: KIT_PARIDADE_HOME (o ~/.claude vivo), KIT_PARIDADE_PLUGIN (a pasta do plugin) — os mesmos do paridade.mjs.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLUGIN = resolve(process.env.KIT_PARIDADE_PLUGIN || join(KIT, 'plugins', 'orquestracao'));
const CLAUDE = process.env.KIT_PARIDADE_HOME || join(homedir(), '.claude');
const PARES = [['hooks', 'hooks'], ['skills', 'skills'], ['agents', 'agents'], ['pool', 'orquestracao/pool']];
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valor = (n) => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1]; };
const BASE = valor('--base');
const posicionais = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--base');
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

// A base de `rel`: o arquivo dado, ou dentro da pasta dada (caminho relativo ou só o nome). `null` se não existe nela.
function baseDe(rel) {
  if (!statSync(BASE).isDirectory()) return BASE;
  return [join(BASE, rel), join(BASE, basename(rel))].find(existsSync) ?? null;
}

// 3 vias: devolve { texto } com a mudança da frente aplicada sobre o plugin, ou { conflitos } (os trechos em conflito).
function emTresVias(plugin, base, viva) {
  const r = run('git', ['merge-file', '-p', '-L', 'plugin', '-L', 'base', '-L', 'viva', plugin, base, viva]);
  if (r.status === 0) return { texto: r.stdout };
  if (r.status > 0) {
    const trechos = r.stdout.match(/<<<<<<< plugin[\s\S]*?>>>>>>> viva/g) ?? [];
    return { conflitos: trechos };
  }
  return { erro: r.stderr || `git merge-file saiu ${r.status}` };
}

function sincronizar(rotulo, alvos) {
  if (BASE !== undefined && !existsSync(BASE)) { console.error(`--base ${BASE}: não existe`); return 2; }
  const atual = JSON.parse(paridade(['--declarar']).stdout || '{}');
  const gravar = []; // [rel, para, conteúdo]
  const tmp = mkdtempSync(join(tmpdir(), 'kit-sinc-'));
  try {
    for (const rel of alvos) {
      const de = viva(rel); const para = join(PLUGIN, rel);
      if (!de) { console.error(`${rel}: fora de hooks/, skills/, agents/ e pool/`); return 2; }
      if (!existsSync(de)) { console.error(`${rel}: não existe na viva (${de})`); return 2; }
      const motivo = atual[rel]?.motivo;
      const declarada = motivo && motivo !== 'FALTA';
      let novo;
      if (BASE !== undefined && existsSync(para)) {
        const base = baseDe(rel);
        if (base === null) {
          if (declarada) { console.error(`${rel}: não existia na base e tem diferença declarada (${motivo}): sem 3 vias a cópia apagaria a adaptação. Refaça à mão.`); return 2; }
          novo = readFileSync(de, 'utf8');
        } else {
          if (readFileSync(base, 'utf8') === readFileSync(de, 'utf8')) { console.log(`${rel}: a viva não mudou desde a base, nada a aplicar`); continue; }
          const m = emTresVias(para, base, de);
          if (m.erro) { console.error(`${rel}: ${m.erro}`); return 2; }
          if (m.conflitos) { console.error(`${rel}: conflito entre a adaptação do plugin e a mudança da frente (${m.conflitos.length} trecho(s)); nada foi gravado.\n${m.conflitos.join('\n---\n')}`); return 2; }
          novo = m.texto;
        }
      } else {
        if (!existsSync(para)) {
          if (BASE === undefined) { console.error(`${rel}: não existe no plugin (${para}); arquivo novo se cria à mão`); return 2; }
          novo = readFileSync(de, 'utf8'); // novo na frente: não há adaptação a preservar
        } else {
          if (declarada && !flag('--forcar')) {
            console.error(`${rel}: tem diferença declarada (${motivo}); a cópia apagaria a adaptação do plugin. Passe --base (3 vias), refaça à mão ou use --forcar.`);
            return 2;
          }
          novo = readFileSync(de, 'utf8');
        }
      }
      const atualTexto = existsSync(para) ? readFileSync(para, 'utf8') : '';
      if (novo === atualTexto) { console.log(`${rel}: já igual ao resultado, nada a gravar`); continue; }
      const prev = join(tmp, `${gravar.length}.novo`); writeFileSync(prev, novo);
      console.log(`--- ${rel}\n${diffUnificado(existsSync(para) ? para : '/dev/null', prev)}`);
      gravar.push([rel, para, novo]);
    }
    if (gravar.length === 0) return 0;
    for (const [, para, texto] of gravar) { mkdirSync(dirname(para), { recursive: true }); writeFileSync(para, texto); }
    if (flag('--sem-commit')) { console.log(`gravado: ${gravar.map(([r]) => r).join(', ')} (sem commit)`); return 0; }
    const repo = execFileSync('git', ['-C', dirname(gravar[0][1]), 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const caminhos = gravar.map(([, p]) => relative(repo, p));
    execFileSync('git', ['-C', repo, 'add', '--', ...caminhos]);
    const msg = `sync(${rotulo}): ${gravar.map(([r]) => r).join(', ')}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`;
    const c = run('git', ['-C', repo, 'commit', '-q', '-m', msg, '--', ...caminhos]);
    if (c.status !== 0) { console.error(`commit falhou: ${c.stderr}`); return 1; }
    console.log(`commit sync(${rotulo}): ${gravar.length} arquivo(s)`);
    return 0;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

if (flag('--listar')) process.exitCode = listar();
else if (posicionais.length < 2) { console.error('uso: sincronizar.mjs --listar | <rótulo> <arquivo>... [--forcar] [--sem-commit]'); process.exitCode = 2; }
else process.exitCode = sincronizar(posicionais[0], posicionais.slice(1));
