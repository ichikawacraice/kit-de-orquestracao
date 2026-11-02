// Testes de `kit migrar-marketplace` (F344). O `claude` é um script falso (CLAUDE_BIN) que imita o que o CLI real grava em disco
// (medido num HOME temporário: `marketplace remove` leva enabledPlugins, pluginConfigs e a pasta de dados; `uninstall --keep-data`
// a preserva). HOME e CLAUDE_CONFIG_DIR temporários: nunca toca ~/.claude real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trocarNomesDoKit } from '../cli/pacote.mjs';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..', 'cli', 'kit.mjs');
const VELHO = 'kit-de-orquestracao';
const NOVO = 'ichikawa-kit';

const CLAUDE_FALSO = `#!/usr/bin/env node
const fs = require('node:fs'); const path = require('node:path');
const a = process.argv.slice(2);
const C = process.env.CLAUDE_CONFIG_DIR;
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(a) + '\\n');
if (process.env.FAKE_FALHA && a.join(' ').startsWith(process.env.FAKE_FALHA)) { process.stderr.write('boom ' + a.join(' ') + '\\n'); process.exit(1); }
const ler = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const gravar = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\\n'); };
const KM = path.join(C, 'plugins', 'known_marketplaces.json'); const IP = path.join(C, 'plugins', 'installed_plugins.json'); const ST = path.join(C, 'settings.json');
const km = ler(KM, {}); const ip = ler(IP, { version: 2, plugins: {} }); const st = ler(ST, {});
const escopo = a.includes('-s') ? a[a.indexOf('-s') + 1] : 'user';
const dados = (id) => path.join(C, 'plugins', 'data', id.replace(/[^A-Za-z0-9_-]/g, '-'));
const stProj = () => path.join(process.cwd(), '.claude', escopo === 'local' ? 'settings.local.json' : 'settings.json');
const tirarLigado = (arq, id) => { const s = ler(arq, null); if (s?.enabledPlugins && id in s.enabledPlugins) { delete s.enabledPlugins[id]; gravar(arq, s); } };
if (a[0] !== 'plugin') process.exit(2);
if (a[1] === 'list') {
  const out = [];
  for (const [id, l] of Object.entries(ip.plugins)) for (const e of l) out.push({ id, scope: e.scope, version: e.version, enabled: e.scope === 'user' ? st.enabledPlugins?.[id] !== false : true, projectPath: e.projectPath });
  process.stdout.write(JSON.stringify(out));
} else if (a[1] === 'marketplace' && a[2] === 'update') {
  if (!km[a[3]]) { process.stderr.write('not found'); process.exit(1); }
} else if (a[1] === 'marketplace' && a[2] === 'remove') {
  const n = a[3]; delete km[n]; if (st.extraKnownMarketplaces) delete st.extraKnownMarketplaces[n];
  for (const id of Object.keys(ip.plugins)) if (id.endsWith('@' + n)) { delete ip.plugins[id]; delete st.enabledPlugins?.[id]; delete st.pluginConfigs?.[id]; fs.rmSync(dados(id), { recursive: true, force: true }); }
  gravar(KM, km); gravar(IP, ip); gravar(ST, st);
} else if (a[1] === 'marketplace' && a[2] === 'add') {
  const src = a[3]; const nome = ler(path.join(src, '.claude-plugin', 'marketplace.json'), {}).name;
  if (km[nome]) { process.stdout.write('already on disk'); process.exit(0); }
  const source = { source: 'directory', path: src };
  km[nome] = { source, installLocation: src }; (st.extraKnownMarketplaces ??= {})[nome] = { source };
  gravar(KM, km); gravar(ST, st);
} else if (a[1] === 'install') {
  const id = a[2]; const [p, m] = id.split('@');
  if (!km[m]) { process.stderr.write('marketplace not found'); process.exit(1); }
  const ver = ler(path.join(km[m].installLocation, 'plugins', p, '.claude-plugin', 'plugin.json'), {}).version;
  const installPath = path.join(C, 'plugins', 'cache', m, p, ver); fs.mkdirSync(installPath, { recursive: true });
  const e = { scope: escopo, installPath, version: ver }; if (escopo !== 'user') e.projectPath = process.cwd();
  (ip.plugins[id] ??= []).push(e); gravar(IP, ip);
  if (escopo === 'user') {
    (st.enabledPlugins ??= {})[id] = true;
    const cfg = a.flatMap((x, i) => (x === '--config' ? [a[i + 1]] : []));
    if (cfg.length) { const o = {}; for (const c of cfg) { const [k, v] = c.split('='); o[k] = v === 'false' ? false : v === 'true' ? true : v; } (st.pluginConfigs ??= {})[id] = { options: o }; }
    gravar(ST, st);
  } else { const s = ler(stProj(), {}); (s.enabledPlugins ??= {})[id] = true; gravar(stProj(), s); }
} else if (a[1] === 'uninstall') {
  const id = a[2];
  ip.plugins[id] = (ip.plugins[id] ?? []).filter((e) => !(e.scope === escopo && (escopo === 'user' || e.projectPath === process.cwd())));
  if (!ip.plugins[id].length) delete ip.plugins[id];
  gravar(IP, ip);
  if (escopo === 'user') { delete st.enabledPlugins?.[id]; delete st.pluginConfigs?.[id]; gravar(ST, st); } else tirarLigado(stProj(), id);
  if (!a.includes('--keep-data')) fs.rmSync(dados(id), { recursive: true, force: true });
} else if (a[1] === 'disable') {
  (st.enabledPlugins ??= {})[a[2]] = false; gravar(ST, st);
} else process.exit(2);
`;

const lerJ = (f) => JSON.parse(readFileSync(f, 'utf8'));
const gravarJ = (f, v) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`); };

/** O marketplace publicado (pasta) com o nome dado e os plugins com userConfig. */
function publicar(raiz, nome) {
  const mk = join(raiz, `mk-${nome}`);
  gravarJ(join(mk, '.claude-plugin', 'marketplace.json'), { name: nome, plugins: ['orquestracao', 'painel-sessoes', 'processos', 'kit-design'].map((n) => ({ name: n, source: `./plugins/${n}` })) });
  for (const n of ['orquestracao', 'painel-sessoes', 'processos', 'kit-design']) {
    gravarJ(join(mk, 'plugins', n, '.claude-plugin', 'plugin.json'), { name: n, version: '1.0.0', userConfig: n === 'kit-design' ? { guarda: {}, largura: {} } : undefined });
  }
  return mk;
}

/** Uma conta com o kit instalado pelo CLI falso no nome antigo, um projeto com escopo projeto e os repasses da K8. */
function montar({ publicadoComNomeNovo = true, semPublicar = null } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'migrar-marketplace-'));
  const home = join(raiz, 'home'); const C = join(home, '.claude'); const proj = join(raiz, 'proj');
  const bin = join(raiz, 'claude'); writeFileSync(bin, CLAUDE_FALSO, { mode: 0o755 });
  const env = { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: C, CLAUDE_BIN: bin, FAKE_LOG: join(raiz, 'log') };
  delete env.FAKE_FALHA;
  const claude = (args, cwd = raiz) => { const r = spawnSync(bin, args, { cwd, env, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' }); assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr}`); };
  const mkVelho = publicar(raiz, VELHO);
  claude(['plugin', 'marketplace', 'add', mkVelho]);
  for (const p of ['orquestracao', 'painel-sessoes', 'processos']) claude(['plugin', 'install', `${p}@${VELHO}`, '-s', 'user']);
  claude(['plugin', 'install', `kit-design@${VELHO}`, '-s', 'user', '--config', 'guarda=false', '--config', 'saiu=1']);
  claude(['plugin', 'disable', `processos@${VELHO}`, '-s', 'user']);
  gravarJ(join(C, 'plugins', 'data', `orquestracao-${VELHO}`, 'estado.json'), { guardado: true });
  // o projeto: settings com o nome antigo (com um false) e uma instalação de escopo projeto
  gravarJ(join(proj, '.claude', 'settings.json'), { extraKnownMarketplaces: { [VELHO]: { source: { source: 'github', repo: 'ichikawacraice/kit-de-orquestracao' } } }, enabledPlugins: { [`orquestracao@${VELHO}`]: true, [`processos@${VELHO}`]: false } });
  gravarJ(join(proj, '.claude', 'settings.local.json'), { enabledPlugins: { [`kit-design@${VELHO}`]: false } });
  claude(['plugin', 'install', `painel-sessoes@${VELHO}`, '-s', 'project'], proj);
  // os repasses da K8 com o id fixo no nome antigo, e o bin que eles chamam
  const scripts = join(C, 'skills', 'orquestradora', 'scripts');
  mkdirSync(scripts, { recursive: true });
  writeFileSync(join(scripts, 'proxima-pergunta.sh'), `#!/bin/bash\nexec "$(node -p "require((process.env.CLAUDE_CONFIG_DIR||process.env.HOME+'/.claude')+'/plugins/installed_plugins.json').plugins['orquestracao@${VELHO}'][0].installPath")/bin/proxima-pergunta" "$@"\n`, { mode: 0o755 });
  // a pasta pessoal também é projeto no ~/.claude.json (o settings.json dela é o da conta), e o projeto também
  gravarJ(join(home, '.claude.json'), { projects: { [home]: {}, [proj]: {} } });
  // o "merge": o publicado passa a se chamar ichikawa-kit na mesma origem (`semPublicar`: um plugin instalado que ele não traz)
  const m = lerJ(join(mkVelho, '.claude-plugin', 'marketplace.json'));
  if (publicadoComNomeNovo) gravarJ(join(mkVelho, '.claude-plugin', 'marketplace.json'), { ...m, name: NOVO, plugins: m.plugins.filter((x) => x.name !== semPublicar) });
  const kit = (...args) => spawnSync(process.execPath, [KIT, 'migrar-marketplace', ...args], { cwd: raiz, env, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' });
  return { raiz, home, C, proj, env, kit, log: () => readFileSync(env.FAKE_LOG, 'utf8') };
}

/** Hash de cada arquivo sob as pastas (fora os backups): o retrato do estado. */
function retrato(...pastas) {
  const r = {};
  const andar = (base, p) => {
    for (const n of readdirSync(p)) {
      const f = join(p, n);
      if (f.includes(join('.claude', 'orquestracao'))) continue; // os backups da migração
      if (statSync(f).isDirectory()) { r[`${relative(base, f)}/`] = 'dir'; andar(base, f); } else r[relative(base, f)] = createHash('sha256').update(readFileSync(f)).digest('hex');
    }
  };
  for (const p of pastas) andar(dirname(p), p);
  return r;
}

test('seco: lista as trocas e não grava nada', () => {
  const t = montar();
  const antes = retrato(t.home, t.proj);
  assert.ok(Object.keys(antes).length > 10, 'o retrato pegou os arquivos');
  const r = t.kit('--projeto', t.proj);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`trocaria: marketplace ${VELHO} → ${NOVO}`));
  assert.match(r.stdout, /trocaria: processos@kit-de-orquestracao → processos@ichikawa-kit \(conta, desligado\)/);
  assert.match(r.stdout, /trocaria: kit-design@kit-de-orquestracao → kit-design@ichikawa-kit \(conta, opções guarda, saiu\)/);
  assert.match(r.stdout, /escopo project em/);
  assert.match(r.stdout, /settings\.local\.json/);
  assert.match(r.stdout, /o repasse .*proxima-pergunta\.sh/);
  assert.match(r.stdout, /Seco: nada foi gravado/);
  assert.doesNotMatch(r.stdout, new RegExp(`no enabledPlugins \\(${join(t.C, 'settings.json').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`), 'o settings.json da conta não é arquivo de projeto');
  assert.match(r.stdout, /proj\/\.claude\/settings\.json\)/, 'o projeto do ~/.claude.json entra');
  assert.deepEqual(retrato(t.home, t.proj), antes);
  assert.doesNotMatch(t.log(), /"migrar|"uninstall"|"remove"/);
});

test('--aplicar troca conta e projeto, guarda liga/desliga, opções e dados; --desfazer volta ao retrato de antes', () => {
  const t = montar();
  const antes = retrato(t.home, t.proj);
  const r = t.kit('--aplicar', '--projeto', t.proj);
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  const C = t.C;
  const ip = lerJ(join(C, 'plugins', 'installed_plugins.json')).plugins;
  assert.deepEqual(Object.keys(ip).sort(), ['kit-design', 'orquestracao', 'painel-sessoes', 'processos'].map((p) => `${p}@${NOVO}`).sort());
  assert.ok(ip[`painel-sessoes@${NOVO}`].some((e) => e.scope === 'project' && e.projectPath === realpathSync(t.proj)), 'a instalação de escopo projeto voltou com o nome novo');
  const st = lerJ(join(C, 'settings.json'));
  assert.equal(st.enabledPlugins[`processos@${NOVO}`], false);
  assert.equal(st.enabledPlugins[`orquestracao@${NOVO}`], true);
  assert.deepEqual(st.pluginConfigs[`kit-design@${NOVO}`].options, { guarda: false }); // a `saiu` não está no manifesto: fica de fora
  assert.deepEqual(Object.keys(st.extraKnownMarketplaces), [NOVO]);
  assert.deepEqual(lerJ(join(C, 'plugins', 'data', `orquestracao-${NOVO}`, 'estado.json')), { guardado: true });
  // o projeto: as chaves trocadas no mesmo lugar, o false fica, a origem fica
  const sp = lerJ(join(t.proj, '.claude', 'settings.json'));
  assert.deepEqual(Object.keys(sp.extraKnownMarketplaces), [NOVO]);
  assert.equal(sp.extraKnownMarketplaces[NOVO].source.repo, 'ichikawacraice/kit-de-orquestracao');
  assert.deepEqual(sp.enabledPlugins, { [`orquestracao@${NOVO}`]: true, [`processos@${NOVO}`]: false, [`painel-sessoes@${NOVO}`]: true });
  assert.deepEqual(lerJ(join(t.proj, '.claude', 'settings.local.json')).enabledPlugins, { [`kit-design@${NOVO}`]: false });
  // o repasse acha o plugin pelo nome novo
  const pp = join(C, 'skills', 'orquestradora', 'scripts', 'proxima-pergunta.sh');
  assert.match(readFileSync(pp, 'utf8'), new RegExp(`orquestracao@${NOVO}`));
  const instalado = ip[`orquestracao@${NOVO}`][0].installPath;
  mkdirSync(join(instalado, 'bin'), { recursive: true });
  writeFileSync(join(instalado, 'bin', 'proxima-pergunta'), '#!/bin/bash\necho Q7\n', { mode: 0o755 });
  const q = spawnSync('bash', [pp], { env: t.env, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(q.stdout.trim(), 'Q7', q.stderr);
  const backup = /backup: (\S+)/.exec(r.stdout)?.[1];
  assert.ok(backup && existsSync(join(backup, 'manifesto.json')), r.stdout);
  // desfazer
  const d = t.kit('--desfazer', backup);
  assert.equal(d.status, 0, d.stderr);
  assert.match(d.stdout, /Desfeito/);
  assert.deepEqual(retrato(t.home, t.proj), antes);
});

test('falha no meio: desfaz sozinha e sai 1', () => {
  const t = montar();
  const antes = retrato(t.home, t.proj);
  const r = spawnSync(process.execPath, [KIT, 'migrar-marketplace', '--aplicar', '--projeto', t.proj], { cwd: t.raiz, env: { ...t.env, FAKE_FALHA: `plugin install processos@${NOVO}` }, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /install processos@ichikawa-kit: boom.*desfeito do backup/);
  assert.match(t.log(), /"marketplace","remove"/, 'a falha veio depois de o antigo sair');
  assert.deepEqual(retrato(t.home, t.proj), antes);
});

test('o publicado ainda com o nome antigo: recusa sem mexer nem fazer backup', () => {
  const t = montar({ publicadoComNomeNovo: false });
  const antes = retrato(t.home, t.proj);
  const r = t.kit('--aplicar');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ainda se chama kit-de-orquestracao, não ichikawa-kit: nada foi mexido/);
  assert.deepEqual(retrato(t.home, t.proj), antes);
  assert.ok(!existsSync(join(t.C, 'orquestracao', 'backups')));
});

test('conta sem o nome antigo: nada a migrar', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'migrar-marketplace-'));
  const home = join(raiz, 'home'); mkdirSync(join(home, '.claude'), { recursive: true });
  const r = spawnSync(process.execPath, [KIT, 'migrar-marketplace', '--aplicar'], { cwd: raiz, env: { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: join(home, '.claude'), CLAUDE_BIN: '/nao/existe' }, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /nada a migrar/);
});

test('trocarNomesDoKit: chave no mesmo lugar, false fica; design e kit-design do nome antigo viram um só', () => {
  const s = { enabledPlugins: { 'a@outro': true, [`design@${VELHO}`]: true, [`kit-design@${VELHO}`]: false, [`processos@${VELHO}`]: false }, extraKnownMarketplaces: { x: {}, [VELHO]: { source: 1 } } };
  const trocas = trocarNomesDoKit(s);
  assert.ok(trocas.length >= 3);
  assert.deepEqual(s.enabledPlugins, { 'a@outro': true, [`kit-design@${NOVO}`]: false, [`processos@${NOVO}`]: false });
  assert.deepEqual(Object.keys(s.extraKnownMarketplaces), ['x', NOVO]);
  const ja = { enabledPlugins: { [`processos@${NOVO}`]: true, [`processos@${VELHO}`]: false } };
  trocarNomesDoKit(ja);
  assert.deepEqual(ja.enabledPlugins, { [`processos@${NOVO}`]: true }, 'a nova que já estava vence');
  assert.deepEqual(trocarNomesDoKit({ enabledPlugins: { 'a@b': true } }), []);
});

test('kit atualizar num projeto com o nome antigo: troca marketplace, plugins e lock; o doutor avisa antes e o remover tira depois', () => {
  const nova = (p) => realpathSync(mkdtempSync(join(tmpdir(), p)));
  const d = nova('kit-f344-'); spawnSync('git', ['init', '-q', d], { timeout: 10000, killSignal: 'SIGKILL' });
  const casa = nova('kit-f344-casa-'); const base = nova('kit-f344-base-');
  const kit = (...args) => spawnSync(process.execPath, [KIT, ...args], { cwd: d, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: { ...process.env, HOME: casa, CLAUDE_CONFIG_DIR: '', HOOKS_CREWAI_BASE: base, CI: '' } });
  assert.equal(kit('iniciar').status, 0);
  // o projeto adotado antes do F344: tudo o que o kit escreveu com o nome novo volta ao antigo, settings e lock
  const arq = join(d, '.claude', 'settings.json');
  const texto = readFileSync(arq, 'utf8');
  assert.ok(texto.includes(`"${NOVO}"`) && texto.includes(`"processos@${NOVO}": true`), 'precondição: o iniciar gravou o nome novo');
  writeFileSync(arq, texto.replaceAll(`@${NOVO}"`, `@${VELHO}"`).replace(`"${NOVO}": {`, `"${VELHO}": {`).replace(`"processos@${VELHO}": true`, `"processos@${VELHO}": false`));
  const lockArq = join(d, '.claude', 'kit.lock.json');
  const lock = lerJ(lockArq);
  lock.chaves.settings.plugins = lock.chaves.settings.plugins.map((n) => n.replace(`@${NOVO}`, `@${VELHO}`));
  gravarJ(lockArq, lock);
  gravarJ(join(casa, '.claude', 'plugins', 'installed_plugins.json'), { version: 2, plugins: { [`orquestracao@${VELHO}`]: [{ scope: 'user', installPath: '/x', version: '0.1.0' }] } });
  const antes = kit('doutor').stdout;
  assert.match(antes, /plugin instalado na máquina: sim/);
  assert.match(antes, /aviso: os plugins do kit estão com o nome antigo do marketplace.*migrar-marketplace/);
  assert.match(antes, /declara o marketplace com o nome antigo.*kit atualizar/);
  const r = kit('atualizar');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /trocado: marketplace kit-de-orquestracao → ichikawa-kit no extraKnownMarketplaces/);
  const s = lerJ(arq);
  assert.deepEqual(Object.keys(s.extraKnownMarketplaces), [NOVO]);
  assert.equal(s.enabledPlugins[`processos@${NOVO}`], false, 'o false de quem desligou fica');
  assert.ok(!Object.keys(s.enabledPlugins).some((k) => k.endsWith(`@${VELHO}`)), Object.keys(s.enabledPlugins).join());
  assert.ok(lerJ(lockArq).chaves.settings.plugins.every((n) => !n.endsWith(`@${VELHO}`)));
  assert.doesNotMatch(kit('doutor').stdout, /declara o marketplace com o nome antigo/);
  assert.equal(kit('remover').status, 0);
  const depois = existsSync(arq) ? lerJ(arq) : {};
  assert.ok(!(NOVO in (depois.extraKnownMarketplaces ?? {})), 'o remover tirou o marketplace com o nome novo');
});

test('plugin instalado que o publicado não traz: o seco avisa e o --aplicar recusa sem mexer', () => {
  const t = montar({ semPublicar: 'processos' });
  const antes = retrato(t.home, t.proj);
  assert.match(t.kit().stdout, /aviso: processos@ichikawa-kit não está no marketplace publicado/);
  const r = t.kit('--aplicar');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /processos@ichikawa-kit está instalado e não está no marketplace publicado.*nada foi mexido/);
  assert.deepEqual(retrato(t.home, t.proj), antes);
  assert.ok(!existsSync(join(t.C, 'orquestracao', 'backups')));
});
