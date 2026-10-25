#!/usr/bin/env node
// K8: migra uma máquina do `~/.claude` solto para os plugins do kit, com backup e restauração automática.
//   node scripts/k8/migrar.mjs --home <HOME> --fonte <marketplace> [--ensaio] [--simular] [--tirar-secoes]
//   node scripts/k8/migrar.mjs --home <HOME> --restaurar <pasta-do-backup> [--ensaio]
// `--ensaio`: HOME de mentira; o skills-manager real não é tocado (o link vira unlink e o undeploy só roda com `--dry-run`).
// Qualquer etapa que falhe restaura do backup e sai 1. Nada aqui apaga estado do operador (`orquestracao/{painel,fila,…}`).
// A paridade (primeiro passo) compara o plugin com o `~/.claude` REAL (`KIT_HOME_REAL`, senão o HOME), também no ensaio — não com o `--home` ensaiado.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializar } from '../../cli/pacote.mjs';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MARKETPLACE = 'kit-de-orquestracao';
const PLUGINS = ['orquestracao', 'painel-sessoes'];
const SKILLS = ['ausente', 'handoff-de-sessao', 'notas-de-release', 'orquestradora', 'orquestrar-com-subagentes', 'papeis-e-modelos'];
const AGENTS = ['executor.md', 'explorador.md', 'planejador.md', 'validador.md'];
const REPASSES = ['painel.mjs', 'proxima-pergunta.sh', 'proximo-item.sh'];
// o que o backup guarda (relativo a ~/.claude): tudo o que a K8 mexe ou move
const DO_BACKUP = ['settings.json', 'CLAUDE.md', 'hooks', 'agents', 'mods/painel-sessoes', 'orquestracao/pool', ...SKILLS.map((s) => `skills/${s}`), 'plugins/installed_plugins.json', 'plugins/known_marketplaces.json'];

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valor = (n) => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1]; };
const HOME_ = resolve(valor('--home') ?? process.env.HOME ?? homedir());
const C = join(HOME_, '.claude');
const ENSAIO = flag('--ensaio');
const SIMULAR = flag('--simular');
const ENV = { ...process.env, HOME: HOME_, CLAUDE_CONFIG_DIR: C };
const REAL = process.env.KIT_HOME_REAL ?? process.env.HOME ?? homedir(); // o HOME de verdade (o ensaio troca o HOME, o skills-manager não)
const ENV_REAL = { ...process.env, HOME: REAL };
const SM = join(REAL, '.skills-manager', 'bin', 'skills-manager-cli');
const log = (m) => console.log(m);

function rodar(cmd, a, opcoes = {}) {
  const r = spawnSync(cmd, a, { encoding: 'utf8', env: ENV, timeout: 180000, killSignal: 'SIGKILL', ...opcoes });
  if (r.status !== 0 && !opcoes.tolerar) throw new Error(`${cmd} ${a.join(' ')} → exit ${r.status}: ${`${r.stdout ?? ''}${r.stderr ?? ''}`.trim().slice(0, 600)}`);
  return r;
}
const existe = (p) => { try { lstatSync(p); return true; } catch { return false; } };
const ehLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };

// ---------- backup e restauração ----------
function backup(dir) {
  mkdirSync(join(dir, 'copia'), { recursive: true });
  const presentes = DO_BACKUP.filter((rel) => existe(join(C, rel)));
  for (const rel of presentes) {
    const destino = join(dir, 'copia', rel);
    mkdirSync(dirname(destino), { recursive: true });
    cpSync(join(C, rel), destino, { recursive: true, dereference: true }); // `cp -RL`: o conteúdo dos links, não o link
  }
  // os mesmos itens como estão (links continuam links)
  rodar('tar', ['-cf', join(dir, 'links.tar'), '-C', C, ...presentes]);
  writeFileSync(join(dir, 'itens.json'), `${JSON.stringify(presentes, null, 2)}\n`);
  writeFileSync(join(dir, 'RESTAURAR.md'), [
    '# Restaurar a K8',
    `1. \`node ${join(KIT, 'scripts/k8/migrar.mjs')} --home ${HOME_} --restaurar ${dir}\` desfaz tudo (plugins, settings.json, skills, agents, mod, CLAUDE.md).`,
    '2. Sem o script: apague os itens de `itens.json` em `~/.claude` e rode `tar -xf links.tar -C ~/.claude` (links voltam como links).',
    '3. `claude plugin uninstall orquestracao@kit-de-orquestracao && claude plugin uninstall painel-sessoes@kit-de-orquestracao && claude plugin marketplace remove kit-de-orquestracao`.',
    '4. Skills vindas do skills-manager: `skills-manager-cli skills deploy --agent claude_code orquestradora handoff-de-sessao notas-de-release orquestrar-com-subagentes`.',
    '5. `copia/` tem o conteúdo de cada item (cp -RL); `links.tar` tem os links como links. O estado do operador (`orquestracao/painel`, fila…) nunca foi movido.',
    '',
  ].join('\n'));
  return presentes;
}

function restaurar(dir) {
  const itens = JSON.parse(readFileSync(join(dir, 'itens.json'), 'utf8'));
  for (const p of PLUGINS) rodar('claude', ['plugin', 'uninstall', `${p}@${MARKETPLACE}`], { tolerar: true });
  rodar('claude', ['plugin', 'marketplace', 'remove', MARKETPLACE], { tolerar: true });
  // `~/.claude/skills/orquestradora` pode ter virado a pasta dos repasses: sai antes de os links voltarem
  for (const rel of itens) { if (rel.startsWith('plugins/')) continue; const p = join(C, rel); if (ehLink(p)) unlinkSync(p); else rmSync(p, { recursive: true, force: true }); }
  rodar('tar', ['-xf', join(dir, 'links.tar'), '-C', C]);
  for (const rel of ['plugins/installed_plugins.json', 'plugins/known_marketplaces.json']) if (itens.includes(rel)) cpSync(join(dir, 'copia', rel), join(C, rel));
  if (!ENSAIO) rodar(SM, ['skills', 'deploy', '--agent', 'claude_code', 'orquestradora', 'handoff-de-sessao', 'notas-de-release', 'orquestrar-com-subagentes'], { tolerar: true });
  log(`restaurado de ${dir}`);
}

// ---------- etapas ----------
function tirarHooksDoSettings() {
  const caminho = join(C, 'settings.json');
  const texto = readFileSync(caminho, 'utf8');
  const s = JSON.parse(texto.replace(/^﻿/, ''));
  const hooksDoKit = new Set(readdirSync(join(KIT, 'plugins/orquestracao/hooks')).filter((n) => n.endsWith('.mjs')));
  const tiradas = [];
  const doKit = (cmd) => { const m = /hooks\/([\w.-]+\.mjs)"?$/.exec(cmd ?? ''); return m !== null && hooksDoKit.has(m[1]) && /\.claude\/hooks\//.test(cmd); };
  for (const [evento, grupos] of Object.entries(s.hooks ?? {})) {
    for (const g of grupos) {
      const antes = g.hooks ?? [];
      g.hooks = antes.filter((h) => { if (doKit(h.command)) { tiradas.push(`${evento} | ${g.matcher ?? '-'} | ${h.command}`); return false; } return true; });
    }
    s.hooks[evento] = grupos.filter((g) => (g.hooks ?? []).length > 0);
    if (!s.hooks[evento].length) delete s.hooks[evento];
  }
  if (s.hooks && !Object.keys(s.hooks).length) delete s.hooks;
  // o mod morava numa pasta que a K8 move: a entrada que o carregava sai (o plugin painel-sessoes o traz)
  const mod = join(C, 'mods', 'painel-sessoes');
  if (s.env?.CLAUDE_CODE_PLUGIN_DIRS !== undefined) {
    const restantes = String(s.env.CLAUDE_CODE_PLUGIN_DIRS).split(':').filter((p) => p && resolve(p) !== mod);
    if (restantes.length) s.env.CLAUDE_CODE_PLUGIN_DIRS = restantes.join(':'); else delete s.env.CLAUDE_CODE_PLUGIN_DIRS;
    if (!Object.keys(s.env).length) delete s.env;
    tiradas.push(`env.CLAUDE_CODE_PLUGIN_DIRS (${mod})`);
  }
  writeFileSync(caminho, serializar(s, texto));
  return tiradas;
}

function repasse(rel) {
  const bin = { 'painel.mjs': 'painel', 'proxima-pergunta.sh': 'proxima-pergunta', 'proximo-item.sh': 'proximo-item' }[rel];
  if (rel.endsWith('.mjs')) {
    return `import{spawnSync as s}from'node:child_process';import{readFileSync as r}from'node:fs';import{homedir as h}from'node:os';const i=JSON.parse(r(\`\${process.env.CLAUDE_CONFIG_DIR||(process.env.HOME||h())+'/.claude'}/plugins/installed_plugins.json\`,'utf8')).plugins['orquestracao@${MARKETPLACE}'][0].installPath;process.exitCode=s('bash',[i+'/bin/${bin}',...process.argv.slice(2)],{stdio:'inherit'}).status??1;\n`;
  }
  return `#!/bin/bash\nexec "$(node -p "require((process.env.CLAUDE_CONFIG_DIR||process.env.HOME+'/.claude')+'/plugins/installed_plugins.json').plugins['orquestracao@${MARKETPLACE}'][0].installPath")/bin/${bin}" "$@"\n`;
}

function skillsDoKit() {
  const links = SKILLS.filter((s) => ehLink(join(C, 'skills', s)));
  const reais = SKILLS.filter((s) => existe(join(C, 'skills', s)) && !ehLink(join(C, 'skills', s)));
  const doManager = links.filter((s) => readlinkSync(join(C, 'skills', s)).includes('.skills-manager'));
  if (doManager.length) {
    if (ENSAIO) {
      rodar(SM, ['--json', 'skills', 'undeploy', '--agent', 'claude_code', '--dry-run', ...doManager], { env: ENV_REAL });
      for (const s of doManager) unlinkSync(join(C, 'skills', s));
    } else rodar(SM, ['skills', 'undeploy', '--agent', 'claude_code', ...doManager], { env: ENV_REAL });
  }
  for (const s of links.filter((x) => !doManager.includes(x))) unlinkSync(join(C, 'skills', s));
  for (const s of reais) rmSync(join(C, 'skills', s), { recursive: true, force: true }); // já estão em copia/ do backup
  const dir = join(C, 'skills', 'orquestradora', 'scripts');
  mkdirSync(dir, { recursive: true });
  for (const r of REPASSES) writeFileSync(join(dir, r), repasse(r), { mode: 0o755 });
  return { doManager, reais };
}

function secoesDoClaudeMd() {
  const caminho = join(C, 'CLAUDE.md');
  const texto = readFileSync(caminho, 'utf8');
  const alvo = ['# Papéis e modelos', '# Sessão orquestradora'];
  const partes = texto.split(/^(?=# )/m);
  const tiradas = partes.filter((p) => alvo.some((a) => p.startsWith(a)));
  writeFileSync(caminho, partes.filter((p) => !tiradas.includes(p)).join(''));
  return tiradas.map((t) => t.split('\n')[0]);
}

// Primeiro passo: o plugin não pode instalar versão mais velha do que a que está viva em ~/.claude. Paridade ≠ 0 aborta antes de tocar em qualquer coisa.
function paridadeVerde() {
  const r = spawnSync('node', [join(KIT, 'scripts', 'paridade.mjs')], { encoding: 'utf8', env: { ...process.env, KIT_PARIDADE_HOME: join(REAL, '.claude') }, timeout: 60000, killSignal: 'SIGKILL' });
  if (r.status === 0) { log('paridade: 0 diferenças não declaradas'); return true; }
  console.error(`paridade não deu 0 (exit ${r.status}): a K8 NÃO tocou em nada. Porte o que mudou em ~/.claude para o plugin e rode de novo.\n${`${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-12).join('\n')}`);
  return false;
}

// ---------- fluxo ----------
if (valor('--restaurar')) {
  try { restaurar(resolve(valor('--restaurar'))); } catch (e) { console.error(`restauração falhou: ${e.message}`); process.exitCode = 1; }
} else {
  const fonte = valor('--fonte');
  if (!fonte) { console.error('uso: --home <HOME> --fonte <marketplace: caminho ou owner/repo> [--ensaio] [--simular] [--tirar-secoes]'); process.exitCode = 2; }
  else if (!existe(join(C, 'settings.json'))) { console.error(`sem ${C}/settings.json`); process.exitCode = 2; }
  else if (!paridadeVerde()) { process.exitCode = 1; }
  else if (SIMULAR) {
    const s = JSON.parse(readFileSync(join(C, 'settings.json'), 'utf8'));
    log(`simular: backup de ${DO_BACKUP.filter((r) => existe(join(C, r))).length} itens; plugin ${PLUGINS.join(', ')} de ${fonte}; ${Object.values(s.hooks ?? {}).flat().length} grupos de hooks no settings.json`);
  } else {
    const hora = new Date().toISOString().replace(/[:.]/g, '-');
    const dirBackup = join(C, 'orquestracao', 'backups', `K8-${hora}`);
    try {
      const itens = backup(dirBackup);
      log(`backup: ${dirBackup} (${itens.length} itens)`);
      try {
        rodar('claude', ['plugin', 'marketplace', 'add', fonte]);
        for (const p of PLUGINS) rodar('claude', ['plugin', 'install', `${p}@${MARKETPLACE}`]);
        log(`plugins instalados: ${PLUGINS.map((p) => `${p}@${MARKETPLACE}`).join(', ')}`);
        const hooks = tirarHooksDoSettings();
        log(`settings.json: ${hooks.length} entradas tiradas`); hooks.forEach((h) => log(`  - ${h}`));
        const sk = skillsDoKit();
        log(`skills: undeploy ${sk.doManager.join(', ') || '(nenhuma)'}; movidas ao backup ${sk.reais.join(', ') || '(nenhuma)'}; repasses em skills/orquestradora/scripts/`);
        for (const a of AGENTS) rmSync(join(C, 'agents', a), { force: true });
        rmSync(join(C, 'mods', 'painel-sessoes'), { recursive: true, force: true });
        log('agents e mod antigos movidos ao backup');
        if (flag('--tirar-secoes')) log(`CLAUDE.md: seções tiradas: ${secoesDoClaudeMd().join(' | ')}`);
        else log('CLAUDE.md: intocado (use --tirar-secoes para tirar as seções que o SessionStart injeta)');
        log('migrado.');
      } catch (e) {
        console.error(`etapa falhou: ${e.message}\nrestaurando do backup…`);
        restaurar(dirBackup);
        process.exitCode = 1;
      }
    } catch (e) { console.error(`backup falhou: ${e.message}`); process.exitCode = 1; }
  }
}
