import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// c18b: as ressalvas do laudo do c18 — lista da trava (ausente já cobre tudo), scripts sem uso, blocos que contradizem o projeto, doutor para quem adotou antes.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const run = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', ...o });
const git = (cwd, ...a) => run('git', a, { cwd });

function ambiente(t) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c18b-')));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const home = join(raiz, 'home'); const base = join(home, '.claude', 'orquestracao'); mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
  writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'orquestracao@kit-de-orquestracao': [{ scope: 'user', installPath: '/x', version: '0.1.0' }], 'superpowers@claude-plugins-official': [{ scope: 'user' }] } }));
  writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'superpowers@claude-plugins-official': true } }));
  const env = { ...process.env, HOME: home, HOOKS_CREWAI_BASE: base, PAINEL_DIR: join(base, 'painel') }; delete env.NODE_TEST_CONTEXT;
  const projeto = (nome, arquivos = {}) => {
    const d = join(raiz, nome); mkdirSync(d, { recursive: true }); git(d, 'init', '-q');
    for (const [f, c] of Object.entries(arquivos)) { mkdirSync(dirname(join(d, f)), { recursive: true }); writeFileSync(join(d, f), typeof c === 'string' ? c : `${JSON.stringify(c, null, 2)}\n`); }
    return d;
  };
  const kit = (cwd, ...args) => run('node', [KIT, ...args], { cwd, env });
  const copia = (d, nome) => { const c = join(raiz, nome); cpSync(d, c, { recursive: true }); return c; };
  const lista = (n) => (existsSync(join(base, n)) ? readFileSync(join(base, n), 'utf8') : null);
  return { raiz, home, base, env, projeto, kit, copia, lista };
}
const ler = (d, ...p) => readFileSync(join(d, ...p), 'utf8');
const json = (d, ...p) => JSON.parse(ler(d, ...p));
const arvore = (d, dir = '', acc = {}) => {
  for (const e of readdirSync(join(d, dir), { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const rel = join(dir, e.name);
    if (e.isDirectory()) arvore(d, rel, acc); else acc[rel] = readFileSync(join(d, rel), 'utf8');
  }
  return acc;
};
const diffDe = (stdout) => { const l = stdout.split('\n'); const i = l.findIndex((x) => x.startsWith('--- ')); return l.slice(i).filter((x) => /^([ +\-@\\]|$)/.test(x)).join('\n'); };


const hookDaTrava = (a, sessao, cwdDoMarcador, cwd) => {
  const hook = join(RAIZ, 'plugins', 'orquestracao', 'hooks', 'orquestradora-nao-edita.mjs');
  assert.ok(existsSync(hook), 'o hook existe');
  mkdirSync(join(a.base, 'ativas'), { recursive: true });
  writeFileSync(join(a.base, 'ativas', sessao), `${join(cwdDoMarcador, '.git')}\n`);
  const ev = JSON.stringify({ session_id: sessao, hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: '/opt/produto/x.txt' }, cwd });
  return run('node', [hook], { input: ev, env: a.env, cwd }).stdout;
};
const PERGUNTA = /"permissionDecision":\s*"ask"/;

describe('c18b.1 lista da trava: ausente já cobre todos os repositórios', () => {
  it('sem lista: iniciar não a cria, diz que a trava já cobre, e a orquestradora é perguntada no projeto novo e em outro repo', (t) => {
    const a = ambiente(t); const d = a.projeto('p1'); const outro = a.projeto('outro');
    assert.equal(a.lista('trava-edicao-repos.txt'), null, 'precondição: sem lista');
    assert.match(hookDaTrava(a, 's-antes', outro, outro), PERGUNTA, 'precondição: o hook pergunta no outro repo sem lista (o hook mede o que o teste diz)');
    const r = a.kit(d, 'iniciar'); assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(a.lista('trava-edicao-repos.txt'), null, 'o iniciar não criou a lista');
    assert.match(r.stdout, /trava: .*já cobre/i);
    assert.match(hookDaTrava(a, 's-novo', d, d), PERGUNTA, 'pergunta no projeto novo');
    assert.match(hookDaTrava(a, 's-outro', outro, outro), PERGUNTA, 'e continua perguntando no outro repositório');
  });
  it('sem lista: adotar (real e --simular) também não cria e diz que a trava já cobre', (t) => {
    const a = ambiente(t); const d = a.projeto('p2', { 'CLAUDE.md': '# Meu\n' });
    const s = a.kit(d, 'adotar', '--simular'); assert.equal(s.status, 0, s.stderr);
    assert.match(s.stdout, /trava: .*já cobre/i); assert.doesNotMatch(s.stdout, /gravaria: .* em trava-edicao-repos/);
    const r = a.kit(d, 'adotar'); assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(a.lista('trava-edicao-repos.txt'), null); assert.match(r.stdout, /trava: .*já cobre/i);
  });
  it('com lista: o repositório entra (e só uma vez)', (t) => {
    const a = ambiente(t); const d = a.projeto('p3');
    mkdirSync(a.base, { recursive: true }); writeFileSync(join(a.base, 'trava-edicao-repos.txt'), '/Users/x/Alfa/.git\n');
    assert.equal(a.kit(d, 'iniciar').status, 0);
    assert.equal(a.lista('trava-edicao-repos.txt'), `/Users/x/Alfa/.git\n${join(d, '.git')}\n`);
  });
  it('remover tira só a linha do kit e nunca apaga o arquivo, nem quando fica vazio', (t) => {
    const a = ambiente(t); const d = a.projeto('p4');
    mkdirSync(a.base, { recursive: true }); writeFileSync(join(a.base, 'trava-edicao-repos.txt'), '');
    assert.equal(a.kit(d, 'iniciar').status, 0);
    assert.equal(a.lista('trava-edicao-repos.txt'), `${join(d, '.git')}\n`, 'precondição: a linha entrou na lista vazia de propósito');
    assert.equal(a.kit(d, 'remover').status, 0);
    assert.notEqual(a.lista('trava-edicao-repos.txt'), null, 'o arquivo fica');
    assert.equal(a.lista('trava-edicao-repos.txt').trim(), '', 'sem a linha do kit');
  });
});

describe('c18c.1 remover e a lista que o kit (c18) criou', () => {
  it('lock com criouArquivo e a lista fica vazia sem a linha do kit: o arquivo é apagado e a trava volta a cobrir todos os repos', (t) => {
    const a = ambiente(t); const d = a.projeto('m1'); const outro = a.projeto('m1-outro');
    assert.equal(a.kit(d, 'iniciar').status, 0);
    // instalação feita com o c18: o kit criou a lista com a linha dele e gravou criouArquivo no lock
    const lock = join(d, '.claude', 'kit.lock.json'); const l = JSON.parse(readFileSync(lock, 'utf8'));
    l.operador = { trava: { linha: join(d, '.git'), adicionou: true, criouArquivo: true } }; writeFileSync(lock, `${JSON.stringify(l, null, 2)}\n`);
    mkdirSync(a.base, { recursive: true }); writeFileSync(join(a.base, 'trava-edicao-repos.txt'), `${join(d, '.git')}\n`);
    assert.equal(a.kit(d, 'remover').status, 0);
    assert.equal(a.lista('trava-edicao-repos.txt'), null, 'o arquivo que o kit criou some quando fica vazio');
    assert.match(hookDaTrava(a, 's-m1', outro, outro), PERGUNTA, 'a trava volta a cobrir os outros repositórios');
  });
  it('criouArquivo, mas a lista ainda tem outra linha depois do remover: o arquivo fica', (t) => {
    const a = ambiente(t); const d = a.projeto('m1b');
    assert.equal(a.kit(d, 'iniciar').status, 0);
    const lock = join(d, '.claude', 'kit.lock.json'); const l = JSON.parse(readFileSync(lock, 'utf8'));
    l.operador = { trava: { linha: join(d, '.git'), adicionou: true, criouArquivo: true } }; writeFileSync(lock, `${JSON.stringify(l, null, 2)}\n`);
    mkdirSync(a.base, { recursive: true }); writeFileSync(join(a.base, 'trava-edicao-repos.txt'), `/Users/x/Alfa/.git\n${join(d, '.git')}\n`);
    assert.equal(a.kit(d, 'remover').status, 0);
    assert.equal(a.lista('trava-edicao-repos.txt'), '/Users/x/Alfa/.git\n', 'sobrou outra linha: o arquivo fica');
  });
  it('sem criouArquivo no lock e a lista fica vazia: o arquivo fica (vazio), o kit não o criou', (t) => {
    const a = ambiente(t); const d = a.projeto('m1c');
    assert.equal(a.kit(d, 'iniciar').status, 0);
    const lock = join(d, '.claude', 'kit.lock.json'); const l = JSON.parse(readFileSync(lock, 'utf8'));
    l.operador = { trava: { linha: join(d, '.git'), adicionou: true } }; writeFileSync(lock, `${JSON.stringify(l, null, 2)}\n`);
    mkdirSync(a.base, { recursive: true }); writeFileSync(join(a.base, 'trava-edicao-repos.txt'), `${join(d, '.git')}\n`);
    assert.equal(a.kit(d, 'remover').status, 0);
    assert.notEqual(a.lista('trava-edicao-repos.txt'), null, 'o arquivo fica');
    assert.equal(a.lista('trava-edicao-repos.txt').trim(), '', 'sem a linha do kit');
  });
});

describe('c18b.4 doutor: lista existe e não tem o repositório', () => {
  it('avisa e mostra o comando para acrescentar, com ou sem `operador` no lock; sem lista não avisa', (t) => {
    const a = ambiente(t); const d = a.projeto('p5');
    assert.equal(a.kit(d, 'iniciar').status, 0);
    assert.doesNotMatch(a.kit(d, 'doutor').stdout, /trava-edicao-repos/, 'sem lista: nada a avisar');
    // quem adotou antes do c18: o lock não tem `operador`
    const lock = join(d, '.claude', 'kit.lock.json'); const l = JSON.parse(readFileSync(lock, 'utf8')); delete l.operador; writeFileSync(lock, `${JSON.stringify(l, null, 2)}\n`);
    mkdirSync(a.base, { recursive: true }); writeFileSync(join(a.base, 'trava-edicao-repos.txt'), '/Users/x/Alfa/.git\n');
    const r = a.kit(d, 'doutor');
    assert.match(r.stdout, /aviso: .* não está em trava-edicao-repos\.txt/);
    assert.ok(r.stdout.includes(`echo '${join(d, '.git')}' >> `), `o comando para acrescentar: ${r.stdout}`);
    writeFileSync(join(a.base, 'trava-edicao-repos.txt'), `/Users/x/Alfa/.git\n${join(d, '.git')}\n`);
    assert.doesNotMatch(a.kit(d, 'doutor').stdout, /trava-edicao-repos/, 'com o repo na lista, sem aviso');
  });
});

// ---- 2 e 3: projeto com regras próprias
const projetoComRegras = (a, nome, extra = {}) => a.projeto(nome, {
  'CLAUDE.md': '# Alfa\n\n## Regras\n1. Spec-driven é obrigatório.\n\n## O que é este projeto\nLoja.\n',
  'package.json': { name: 'alfa', private: true, scripts: { test: 'node scripts/a-vez-do-gate.mjs' } },
  'scripts/a-vez-do-gate.mjs': '// gate do projeto\n',
  'scripts/guarda-de-operacao.mjs': '// guarda do projeto\n',
  '.claude/settings.json': { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node scripts/guarda-de-operacao.mjs' }] }] } },
  ...extra,
});
const chamados = (d) => {
  // o que alguém chama: hooks do settings, scripts do package.json e o que esses scripts importam (fechamento por import relativo)
  const textos = [ler(d, '.claude/settings.json'), ler(d, 'package.json'), existsSync(join(d, '.claude/kit.json')) ? ler(d, '.claude/kit.json') : ''].join('\n');
  const dir = join(d, 'scripts', 'kit'); if (!existsSync(dir)) return { todos: [], chamados: new Set() };
  const todos = readdirSync(dir).filter((f) => f.endsWith('.mjs'));
  const alvo = new Set(todos.filter((f) => textos.includes(`scripts/kit/${f}`)));
  // o `o-teto-de-workers` é biblioteca de um `vitest.config*` do projeto: só conta quando algum desses arquivos o importa de verdade
  const importadoPeloProjeto = (dir2 = d, prof = 0) => prof <= 3 && readdirSync(dir2, { withFileTypes: true }).some((e) => e.name !== 'node_modules' && e.name !== '.git' && (e.isDirectory() ? importadoPeloProjeto(join(dir2, e.name), prof + 1) : /^vitest\.config\./.test(e.name) && readFileSync(join(dir2, e.name), 'utf8').includes('o-teto-de-workers')));
  if (todos.includes('o-teto-de-workers.mjs') && importadoPeloProjeto()) alvo.add('o-teto-de-workers.mjs');
  for (let mudou = true; mudou;) { mudou = false; for (const f of [...alvo]) for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/from\s+["']\.\/([^"']+\.mjs)["']/g)) if (!alvo.has(m[1])) { alvo.add(m[1]); mudou = true; } }
  return { todos, chamados: alvo };
};
describe('c18b.2 scripts que ficam sem uso', () => {
  it('com guarda e gate próprios, scripts/kit/ só guarda o que alguém chama', (t) => {
    const a = ambiente(t); const d = projetoComRegras(a, 'p6');
    const s = a.kit(d, 'adotar'); assert.equal(s.status, 0, s.stdout + s.stderr);
    const { todos, chamados: c } = chamados(d);
    assert.ok(readdirSync(join(d, 'scripts')).includes('a-vez-do-gate.mjs'), 'precondição: o gate do projeto está em scripts/');
    const sobra = todos.filter((f) => !c.has(f));
    assert.deepEqual(sobra, [], `scripts/kit/ tem arquivo que ninguém chama: ${sobra}`);
    for (const f of ['o-verde-da-arvore.mjs', 'o-typecheck-do-gate.mjs', 'o-dist-que-o-gate-le.mjs']) assert.equal(existsSync(join(d, 'scripts', 'kit', f)), false, `${f} é órfão sem o gate do kit`);
    const dr = a.kit(d, 'doutor'); assert.doesNotMatch(dr.stdout, /^falha:/m, dr.stdout);
    assert.equal(a.kit(d, 'atualizar').status, 0);
    assert.deepEqual(chamados(d).todos.filter((f) => !chamados(d).chamados.has(f)), [], 'o atualizar não traz os órfãos de volta');
    assert.equal(a.kit(d, 'remover').status, 0);
  });
  it('o o-teto-de-workers só é copiado quando um vitest.config do projeto o importa', (t) => {
    const a = ambiente(t);
    const sem = projetoComRegras(a, 'p6c'); assert.equal(a.kit(sem, 'adotar').status, 0);
    assert.equal(existsSync(join(sem, 'scripts', 'kit')), false, 'ninguém o chama: nem ele nem o config que só ele importa, e a pasta nem nasce');
    const com = projetoComRegras(a, 'p6d', { 'vitest.config.ts': "import { tetoDeWorkers } from './scripts/kit/o-teto-de-workers.mjs';\nexport default { test: { maxWorkers: tetoDeWorkers() } };\n" });
    assert.equal(a.kit(com, 'adotar').status, 0);
    assert.deepEqual(readdirSync(join(com, 'scripts', 'kit')).sort(), ['config.mjs', 'o-script-principal.mjs', 'o-teto-da-maquina.mjs', 'o-teto-de-workers.mjs', 'opcoes-do-plugin.mjs']); // o helper toma as fichas do teto da máquina (e o config importa o helper das opções do plugin)
    const { todos, chamados: c } = chamados(com); assert.deepEqual(todos.filter((f) => !c.has(f)), []);
  });
  it('projeto novo (iniciar) continua com todos os scripts: o gate do kit os chama', (t) => {
    const a = ambiente(t); const d = a.projeto('p7');
    assert.equal(a.kit(d, 'iniciar').status, 0);
    const { todos, chamados: c } = chamados(d);
    assert.ok(todos.includes('o-verde-da-arvore.mjs') && todos.includes('a-vez-do-gate.mjs'), 'precondição: o gate do kit foi copiado');
    assert.ok(c.has('o-verde-da-arvore.mjs'), 'o fechamento mede: o verde da árvore é chamado pelo gate do kit');
  });
});

describe('c18b.3 blocos que contradizem o projeto', () => {
  it('adotar em CLAUDE.md existente não insere comandos nem regras-de-operacao, e diz por quê; atualizar não os traz', (t) => {
    const a = ambiente(t); const d = projetoComRegras(a, 'p8');
    const s = a.kit(d, 'adotar', '--simular'); assert.equal(s.status, 0, s.stderr);
    assert.match(s.stdout, /kit:orquestradora/, 'precondição: os blocos de orquestração entram no diff');
    assert.doesNotMatch(s.stdout, /kit:comandos|kit:regras-de-operacao/, 'o diff não traz os dois blocos');
    assert.match(s.stdout, /aviso: CLAUDE\.md: omiti os blocos comandos e regras-de-operacao/);
    const r = a.kit(d, 'adotar'); assert.equal(r.status, 0, r.stdout + r.stderr);
    const claude = ler(d, 'CLAUDE.md');
    for (const b of ['orquestradora', 'regras-de-trabalho', 'convencoes-de-teste']) assert.match(claude, new RegExp(`kit:${b} v\\d+`), `${b} entra`);
    assert.doesNotMatch(claude, /kit:comandos|kit:regras-de-operacao|gate\.comandoCompleto|rebase em dia/);
    assert.equal(a.kit(d, 'atualizar').status, 0);
    assert.doesNotMatch(ler(d, 'CLAUDE.md'), /kit:comandos|kit:regras-de-operacao/, 'o atualizar não os traz de volta');
    assert.doesNotMatch(a.kit(d, 'doutor').stdout, /^falha:/m);
    assert.equal(a.kit(d, 'remover').status, 0);
    assert.equal(ler(d, 'CLAUDE.md'), '# Alfa\n\n## Regras\n1. Spec-driven é obrigatório.\n\n## O que é este projeto\nLoja.\n', 'remover devolve o CLAUDE.md');
  });
  it('mesmo num projeto sem regras próprias, adotar em CLAUDE.md existente omite os dois blocos (a regra é do CLAUDE.md existente)', (t) => {
    const a = ambiente(t); const d = a.projeto('p9', { 'CLAUDE.md': '# Meu\n' });
    assert.equal(a.kit(d, 'adotar').status, 0);
    assert.doesNotMatch(ler(d, 'CLAUDE.md'), /kit:comandos|kit:regras-de-operacao/);
  });
  it('iniciar continua inserindo os dois blocos, e o `comandos` aponta o gate do kit.json (sem comando fixo)', (t) => {
    const a = ambiente(t); const d = a.projeto('p10');
    assert.equal(a.kit(d, 'iniciar').status, 0);
    const claude = ler(d, 'CLAUDE.md');
    assert.match(claude, /kit:comandos v\d+/); assert.match(claude, /kit:regras-de-operacao v\d+/);
    const comandos = claude.match(/<!-- kit:comandos[\s\S]*?<!-- \/kit:comandos -->/)[0];
    assert.match(comandos, /\.claude\/kit\.json/); assert.doesNotMatch(comandos, /npm run test:suite|pnpm /, 'sem comando fixo no bloco');
    assert.ok(json(d, '.claude/kit.json').gate?.comandoCompleto, 'o gate está no kit.json');
  });
});
