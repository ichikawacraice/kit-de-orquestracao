import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// c18: o que a validação da K9 achou — diff honesto, aviso do doutor, trava da orquestradora no projeto novo, subagentes,
// resíduos do remover, pnpm-workspace e os perigos do `adotar` num projeto que já tem as suas regras.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const run = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', ...o });
const git = (cwd, ...a) => run('git', a, { cwd });

function ambiente(t) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c18-')));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const home = join(raiz, 'home'); const base = join(home, '.claude', 'orquestracao'); mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
  writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'orquestracao@kit-de-orquestracao': [{ scope: 'user', installPath: '/x', version: '0.1.0' }] } }));
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

// ---- 0a: o diff do `adotar --simular` bate com o `adotar` real: aplicado numa cópia dá o mesmo resultado, e linha que só ganhou vírgula não parece remoção
describe('c18.0 o diff do --simular diz a verdade sobre o adotar real', () => {
  it('settings do Izanagi (impeccable por último, sem vírgula): o diff aplicado = o adotar real; nenhuma linha some', (t) => {
    const a = ambiente(t);
    const settings = '{\n  "enabledPlugins": {\n    "impeccable@impeccable": true\n  }\n}\n';
    const d = a.projeto('p0', { 'CLAUDE.md': '# Meu\n\nTexto.\n', 'package.json': '{\n  "name": "meu",\n  "private": true,\n  "scripts": { "test": "node --test" }\n}\n', '.claude/settings.json': settings });
    const real = a.copia(d, 'real'); const simulado = a.copia(d, 'simulado');
    const s = a.kit(simulado, 'adotar', '--simular'); assert.equal(s.status, 0, s.stderr);
    const diff = diffDe(s.stdout); assert.match(diff, /^@@ -/m, 'o diff existe');
    assert.deepEqual(arvore(simulado), arvore(d), 'o --simular não gravou');
    assert.equal(a.kit(real, 'adotar').status, 0);
    writeFileSync(join(simulado, 'p.diff'), `${diff}\n`);
    const ap = git(simulado, 'apply', 'p.diff'); assert.equal(ap.status, 0, ap.stderr);
    rmSync(join(simulado, 'p.diff'));
    for (const f of ['CLAUDE.md', 'package.json', '.claude/settings.json', '.claude/kit.json']) assert.equal(ler(simulado, f), ler(real, f), `${f}: o diff aplicado difere do adotar real`);
    assert.ok(json(real, '.claude/settings.json').enabledPlugins['impeccable@impeccable'] === true, 'o real manteve o impeccable');
    // a linha `-impeccable` é seguida logo pela `+impeccable,` (só a vírgula muda), e o resumo diz que nada é apagado de verdade
    const linhas = diff.split('\n'); const i = linhas.findIndex((l) => /^-\s+"impeccable@impeccable": true$/.test(l));
    assert.ok(i >= 0, 'a linha antiga aparece no diff'); assert.match(linhas[i + 1], /^\+\s+"impeccable@impeccable": true,$/, 'a linha nova vem logo depois da antiga');
    assert.match(s.stdout, /linhas apagadas de verdade: 0 \(1 linha\(s\)/);
  });
  it('remoção real é contada (o resumo não mente para o outro lado)', async () => {
    const { linhasApagadas } = await import('../cli/diff.mjs');
    assert.deepEqual(linhasApagadas('a\nb\nc\n', 'a\nc\n'), { apagadas: 1, soVirgula: 0 });
    assert.deepEqual(linhasApagadas('"x": 1\n', '"x": 1,\n"y": 2\n'), { apagadas: 0, soVirgula: 1 });
  });
});

// ---- 0b: o aviso do bloco `projeto` cobre os dois lados: placeholder → aviso; preenchido → nenhum aviso sobre o bloco
describe('c18.0 doutor e o bloco projeto', () => {
  it('placeholder avisa; preenchido não acusa "editado à mão" nem placeholder', (t) => {
    const a = ambiente(t); const d = a.projeto('p1');
    assert.equal(a.kit(d, 'iniciar').status, 0);
    const antes = a.kit(d, 'doutor'); assert.match(antes.stdout, /^aviso: .*bloco projeto.*preencher/m, antes.stdout);
    const f = join(d, 'CLAUDE.md'); const texto = ler(d, 'CLAUDE.md'); assert.match(texto, /<!-- preencher:/);
    writeFileSync(f, texto.replace(/<!-- preencher:[^\n]*-->/, 'Loja de teste, Node, commits convencionais em PT-BR.'));
    const depois = a.kit(d, 'doutor');
    assert.equal(depois.status, 0, depois.stdout);
    assert.doesNotMatch(depois.stdout, /bloco projeto/, `o bloco que o usuário preencheu não gera aviso:\n${depois.stdout}`);
    // editar OUTRO bloco continua avisando (o aviso de "editado à mão" não foi desligado em geral)
    writeFileSync(f, ler(d, 'CLAUDE.md').replace('## Comandos', '## Comandos!'));
    assert.match(a.kit(d, 'doutor').stdout, /aviso: bloco comandos editado à mão/);
  });
});

// ---- 1: a trava da orquestradora num projeto novo
describe('c18.1 trava-edicao-repos.txt', () => {
  it('com lista: iniciar acrescenta o repo; rodar de novo não duplica; remover tira só a linha (o arquivo nunca some); sem lista, nada é criado (c18b)', (t) => {
    const a = ambiente(t); const d = a.projeto('p2');
    assert.equal(a.lista('trava-edicao-repos.txt'), null, 'precondição: sem lista');
    mkdirSync(a.base, { recursive: true }); writeFileSync(join(a.base, 'trava-edicao-repos.txt'), '/Users/x/Izanagi/.git\n');
    const r = a.kit(d, 'iniciar'); assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(a.lista('trava-edicao-repos.txt'), `/Users/x/Izanagi/.git\n${join(d, '.git')}\n`);
    const e = a.projeto('p3'); assert.equal(a.kit(e, 'iniciar').status, 0);
    assert.deepEqual(a.lista('trava-edicao-repos.txt').split('\n').filter(Boolean), ['/Users/x/Izanagi/.git', join(d, '.git'), join(e, '.git')]);
    assert.equal(a.kit(d, 'remover').status, 0);
    assert.deepEqual(a.lista('trava-edicao-repos.txt').split('\n').filter(Boolean), ['/Users/x/Izanagi/.git', join(e, '.git')], 'só a linha do d saiu');
    assert.equal(a.kit(e, 'remover').status, 0);
    assert.equal(a.lista('trava-edicao-repos.txt'), '/Users/x/Izanagi/.git\n');
  });
  it('adotar acrescenta sem duplicar; linha que já existia antes do kit não sai no remover', (t) => {
    const a = ambiente(t);
    const d = a.projeto('p4', { 'CLAUDE.md': '# Meu\n' });
    mkdirSync(a.base, { recursive: true });
    writeFileSync(join(a.base, 'trava-edicao-repos.txt'), `/outro/repo/.git\n${join(d, '.git')}\n`); // o repo já estava lá antes do kit
    assert.equal(a.kit(d, 'adotar').status, 0);
    assert.equal(a.lista('trava-edicao-repos.txt'), `/outro/repo/.git\n${join(d, '.git')}\n`, 'não duplicou');
    assert.equal(a.kit(d, 'remover').status, 0);
    assert.equal(a.lista('trava-edicao-repos.txt'), `/outro/repo/.git\n${join(d, '.git')}\n`, 'a linha anterior ao kit fica');
    const e = a.projeto('p5', { 'CLAUDE.md': '# Meu\n' });
    assert.equal(a.kit(e, 'adotar').status, 0);
    assert.match(a.lista('trava-edicao-repos.txt'), new RegExp(`${join(e, '.git')}\n$`));
    assert.equal(a.kit(e, 'remover').status, 0);
    assert.equal(a.lista('trava-edicao-repos.txt'), `/outro/repo/.git\n${join(d, '.git')}\n`, 'o arquivo que já existia fica, só sem a linha do e');
  });
  it('--simular não grava a lista; a trava de verdade passa a perguntar no repo novo (hook com a lista)', (t) => {
    const a = ambiente(t); const d = a.projeto('p6', { 'CLAUDE.md': '# Meu\n' });
    mkdirSync(a.base, { recursive: true }); writeFileSync(join(a.base, 'trava-edicao-repos.txt'), '/Users/x/Izanagi/.git\n');
    const s = a.kit(d, 'adotar', '--simular'); assert.match(s.stdout, /gravaria: .* em trava-edicao-repos\.txt/);
    assert.equal(a.lista('trava-edicao-repos.txt'), '/Users/x/Izanagi/.git\n', 'o --simular não gravou');
    assert.equal(a.kit(d, 'adotar').status, 0);
    const hook = join(RAIZ, 'plugins', 'orquestracao', 'hooks', 'orquestradora-nao-edita.mjs');
    assert.ok(existsSync(hook), 'o hook existe');
    const sid = 'c18-sessao-falsa';
    mkdirSync(join(a.base, 'ativas'), { recursive: true });
    const marcador = join(a.base, 'ativas', sid); writeFileSync(marcador, `${join(d, '.git')}\n`);
    const ev = JSON.stringify({ session_id: sid, hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: '/opt/produto/x.txt' }, cwd: d });
    const r = run('node', [hook], { input: ev, env: a.env, cwd: d });
    assert.match(r.stdout, /"permissionDecision":\s*"ask"/, `a trava devia perguntar neste repo: ${r.stdout}${r.stderr}`);
  });
});

// ---- 2: executor é sessão; o kit semeia a lista de subagentes só com o cabeçalho
describe('c18.2 subagente-pode-escrever.txt', () => {
  it('iniciar semeia só o cabeçalho (nenhum papel liberado); arquivo existente não é tocado; remover tira o semeado', (t) => {
    const a = ambiente(t); const d = a.projeto('p7');
    assert.equal(a.kit(d, 'iniciar').status, 0);
    const semeado = a.lista('subagente-pode-escrever.txt'); assert.ok(semeado && semeado.length > 0, 'a lista existe e não é vazia');
    assert.equal(semeado.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length, 0, 'só comentário: nenhum papel liberado');
    assert.doesNotMatch(semeado, /^executor\b/m);
    assert.equal(a.kit(d, 'remover').status, 0);
    assert.equal(a.lista('subagente-pode-escrever.txt'), null);
    const proprio = '# meu\ndesigner\n'; mkdirSync(a.base, { recursive: true }); writeFileSync(join(a.base, 'subagente-pode-escrever.txt'), proprio);
    const e = a.projeto('p8'); assert.equal(a.kit(e, 'iniciar').status, 0);
    assert.equal(a.lista('subagente-pode-escrever.txt'), proprio, 'lista existente intacta');
    assert.equal(a.kit(e, 'remover').status, 0);
    assert.equal(a.lista('subagente-pode-escrever.txt'), proprio, 'e o remover não a apaga');
  });
  it('o texto das skills e do pool não diz que o executor é liberado como subagente', () => {
    const pastas = [join(RAIZ, 'plugins', 'orquestracao', 'skills'), join(RAIZ, 'plugins', 'orquestracao', 'pool')];
    const arquivos = []; const anda = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) anda(p); else if (p.endsWith('.md')) arquivos.push(p); } };
    pastas.forEach(anda); assert.ok(arquivos.length >= 5, 'insumo vazio: sem docs');
    const ruins = arquivos.filter((f) => /executor[^.\n]{0,40}\b(liberado|pode escrever)\b|\blibera\w* o executor/i.test(readFileSync(f, 'utf8')));
    assert.deepEqual(ruins, []);
  });
});

// ---- 3 e 4: resíduos do remover
describe('c18.3-4 o remover não deixa resíduo', () => {
  it('apaga .git/kit-gate-verde/ (e o --simular só avisa)', (t) => {
    const a = ambiente(t); const d = a.projeto('p9');
    assert.equal(a.kit(d, 'iniciar').status, 0);
    const verde = join(d, '.git', 'kit-gate-verde'); mkdirSync(verde); writeFileSync(join(verde, 'abc.json'), '{}');
    const s = a.kit(d, 'remover', '--simular'); assert.match(s.stdout, /removido: \.git\/kit-gate-verde\//); assert.ok(existsSync(verde), 'o --simular não apagou');
    assert.equal(a.kit(d, 'remover').status, 0);
    assert.equal(existsSync(verde), false, 'o verde guardado ficou para trás');
  });
  it('tira a frase de cabeçalho do kit quando não sobra nenhum bloco, e a mantém enquanto sobra um', (t) => {
    const a = ambiente(t); const d = a.projeto('p10');
    assert.equal(a.kit(d, 'iniciar').status, 0);
    const frase = 'As seções marcadas `kit:` são do kit de orquestração';
    const f = join(d, 'CLAUDE.md'); const base = ler(d, 'CLAUDE.md'); assert.ok(base.includes(frase), 'precondição: o CLAUDE.md criado traz a frase');
    // o usuário preencheu o bloco projeto e escreveu um texto próprio: o arquivo não é só o esqueleto
    writeFileSync(f, `${base.replace(/<!-- preencher:[^\n]*-->/, 'Preenchido.')}\nMinha seção.\n`);
    const r = a.kit(d, 'remover'); assert.equal(r.status, 0, r.stdout);
    const resto = ler(d, 'CLAUDE.md');
    assert.match(r.stdout, /desembrulhado: bloco projeto/);
    assert.doesNotMatch(resto, /kit:/, 'nenhuma marca sobrou'); assert.ok(!resto.includes(frase), `a frase ficou:\n${resto}`);
    assert.match(resto, /Minha seção\./); assert.match(resto, /Preenchido\./, 'o texto preenchido é do usuário e fica');
    // com outro bloco editado à mão sobrando, a frase continua (as marcas ainda existem)
    const e = a.projeto('p10b'); assert.equal(a.kit(e, 'iniciar').status, 0);
    writeFileSync(join(e, 'CLAUDE.md'), ler(e, 'CLAUDE.md').replace('## Comandos', '## Comandos!'));
    assert.equal(a.kit(e, 'remover').status, 0);
    assert.ok(existsSync(join(e, 'CLAUDE.md')), 'o CLAUDE.md com bloco editado à mão não é apagado como se fosse só o esqueleto');
    assert.ok(ler(e, 'CLAUDE.md').includes(frase), 'o bloco comandos (mexido) ficou, então a frase também'); assert.match(ler(e, 'CLAUDE.md'), /kit:comandos/);
  });
});

// ---- o adotar não reformata o package.json/settings.json do projeto quando o valor não muda
describe('c18 fidelidade do texto do projeto', () => {
  it('package.json com `scripts` numa linha só, sem mudança de valor, não entra no diff nem muda no real', (t) => {
    const a = ambiente(t);
    const pacote = '{\n  "name": "meu",\n  "private": true,\n  "scripts": { "test": "node --test" }\n}\n';
    const d = a.projeto('p17', { 'CLAUDE.md': '# x\n', 'package.json': pacote });
    const s = a.kit(d, 'adotar', '--simular'); assert.doesNotMatch(s.stdout, /^\+\+\+ b\/package\.json/m);
    assert.equal(a.kit(d, 'adotar').status, 0); assert.equal(ler(d, 'package.json'), pacote);
  });
});

// ---- 5: pnpm-workspace
describe('c18.5 pnpm-workspace.yaml', () => {
  it('iniciar e adotar sugerem o perfil de monorepo (e não sugerem quando o perfil foi pedido ou o arquivo não existe)', (t) => {
    const a = ambiente(t);
    const d = a.projeto('p11', { 'pnpm-workspace.yaml': 'packages:\n  - "packages/*"\n' });
    const i = a.kit(d, 'iniciar'); assert.equal(i.status, 0, i.stdout + i.stderr);
    assert.match(i.stdout, /sugestão: .*pnpm-workspace.*--perfil pnpm-workspace/);
    const e = a.projeto('p12', { 'CLAUDE.md': '# x\n', 'pnpm-workspace.yaml': 'packages:\n  - "packages/*"\n' });
    assert.match(a.kit(e, 'adotar', '--simular').stdout, /sugestão: .*--perfil pnpm-workspace/);
    const f = a.projeto('p13', { 'CLAUDE.md': '# x\n', 'pnpm-workspace.yaml': 'packages:\n  - "packages/*"\n' });
    assert.doesNotMatch(a.kit(f, 'adotar', '--simular', '--perfil', 'pnpm-workspace').stdout, /sugestão:/);
    const g = a.projeto('p14', { 'CLAUDE.md': '# x\n' });
    assert.doesNotMatch(a.kit(g, 'adotar', '--simular').stdout, /sugestão:/);
  });
});

// ---- 6: um projeto que já tem as suas regras
describe('c18.6 adotar num projeto com guarda própria, gate próprio e CLAUDE.md próprio', () => {
  const projetoComRegras = (a, nome) => a.projeto(nome, {
    'CLAUDE.md': '# Izanagi\n\n## Regras\n1. Spec-driven é obrigatório.\n\n## O que é este projeto\nLoja.\n',
    'package.json': { name: 'izanagi', private: true, scripts: { test: 'node scripts/a-vez-do-gate.mjs' } },
    'scripts/a-vez-do-gate.mjs': '// gate do projeto\n',
    'scripts/guarda-de-operacao.mjs': '// guarda do projeto\n',
    '.claude/settings.json': { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node scripts/guarda-de-operacao.mjs' }] }] } },
  });
  it('--simular e o real numa cópia concordam: sem guarda dupla, sem script órfão, sem bloco contraditório', (t) => {
    const a = ambiente(t); const d = projetoComRegras(a, 'p15');
    const simulado = a.copia(d, 'sim'); const real = a.copia(d, 'real');
    const s = a.kit(simulado, 'adotar', '--simular'); assert.equal(s.status, 0, s.stderr);
    assert.match(s.stdout, /aviso: guarda: .*"do-projeto"/); assert.match(s.stdout, /aviso: gate próprio:/);
    assert.deepEqual(arvore(simulado), arvore(d), 'o --simular não gravou');
    const r = a.kit(real, 'adotar'); assert.equal(r.status, 0, r.stdout + r.stderr);
    writeFileSync(join(simulado, 'p.diff'), `${diffDe(s.stdout)}\n`);
    const ap = git(simulado, 'apply', 'p.diff'); assert.equal(ap.status, 0, ap.stderr); rmSync(join(simulado, 'p.diff'));
    for (const f of ['CLAUDE.md', 'package.json', '.claude/settings.json', '.claude/kit.json']) assert.equal(ler(simulado, f), ler(real, f), `${f}: simulado ≠ real`);
    // guarda: só a do projeto
    const st = json(real, '.claude/settings.json');
    assert.equal(st.hooks.PreToolUse.length, 1, 'só uma guarda de Bash'); assert.match(JSON.stringify(st.hooks), /scripts\/guarda-de-operacao\.mjs/);
    assert.doesNotMatch(JSON.stringify(st.hooks), /scripts\/kit\//, 'o hook do kit não foi registrado');
    assert.equal(existsSync(join(real, 'scripts', 'kit', 'guarda-de-operacao.mjs')), false, 'script órfão da guarda');
    assert.equal(json(real, '.claude/kit.json').guarda, 'do-projeto');
    // gate: o do projeto, sem o do kit e sem apontar o gate para si mesmo
    assert.equal(existsSync(join(real, 'scripts', 'kit', 'a-vez-do-gate.mjs')), false, 'script órfão do gate');
    assert.equal(json(real, 'package.json').scripts.test, 'node scripts/a-vez-do-gate.mjs', 'o test do projeto ficou');
    assert.equal(json(real, '.claude/kit.json').gate, undefined, 'o kit.json não aponta o gate (era laço)');
    assert.equal(existsSync(join(real, 'scripts', 'kit', 'o-verde-da-arvore.mjs')), false, 'o que só o gate do kit usa também fica de fora (c18b)');
    assert.equal(existsSync(join(real, 'scripts', 'kit', 'o-teto-de-workers.mjs')), false, 'ninguém o importa (c18c): não é copiado');
    // CLAUDE.md: sem o bloco projeto e sem a frase "opcionais"
    const claude = ler(real, 'CLAUDE.md');
    assert.doesNotMatch(claude, /kit:projeto/, 'o projeto já se descreve'); assert.doesNotMatch(claude, /opcionais/i, 'sem bloco que contradiz o Spec-driven');
    assert.match(claude, /kit:regras-de-trabalho v3/); assert.match(claude, /declara isso nas regras dele/);
    // doutor e remover
    const dr = a.kit(real, 'doutor'); assert.doesNotMatch(dr.stdout, /^falha:/m, dr.stdout);
    assert.match(dr.stdout, /aviso: scripts\/kit\/guarda-de-operacao\.mjs não foi copiado/);
    assert.doesNotMatch(dr.stdout, /bloco projeto/);
    assert.equal(a.kit(real, 'remover').status, 0);
    assert.deepEqual(arvore(real), arvore(d), 'remover devolve o projeto como era');
  });
  it('atualizar não traz de volta a guarda, o gate nem o bloco projeto que o adotar deixou de fora', (t) => {
    const a = ambiente(t); const d = projetoComRegras(a, 'p16');
    assert.equal(a.kit(d, 'adotar').status, 0);
    const antes = arvore(d);
    const r = a.kit(d, 'atualizar'); assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(arvore(d), antes, `o atualizar mexeu:\n${r.stdout}`);
  });
});
