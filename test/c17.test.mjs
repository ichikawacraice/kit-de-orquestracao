import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// c17.1: o tema vale só no projeto dele; projeto sem tema ganha `geral`; `temas add` cria tema sem editar o JSON.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(RAIZ, 'plugins', 'orquestracao', 'skills', 'orquestradora', 'scripts');
// cópia do temas.json real do Alfa (25/10): os 5 temas continuam valendo para ele, sem migração
const TEMAS_ALFA = [
  { id: 'editor', rotulo: 'Editor da loja', projeto: 'alfa' }, { id: 'motor', rotulo: 'Motor dos jobs', projeto: 'alfa' },
  { id: 'gate', rotulo: 'Gate e testes', projeto: 'alfa' }, { id: 'orquestracao', rotulo: 'Sessões e painel', projeto: 'alfa' },
  { id: 'kit', rotulo: 'Kit de orquestração', projeto: 'alfa' }];

function ambiente(t, scripts = SCRIPTS) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c17-')));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const painel = join(raiz, 'painel'); mkdirSync(painel);
  const repo = (nome) => { const d = join(raiz, 'repos', nome); mkdirSync(d, { recursive: true }); spawnSync('git', ['init', '-q', d], { timeout: 30000, killSignal: 'SIGKILL' }); return d; };
  const env = { ...process.env, PAINEL_DIR: painel, CLAUDE_CODE_SESSION_ID: '' }; delete env.KIT_PROJETO;
  const painelMjs = (cwd, ...args) => { const r = spawnSync('node', [join(scripts, 'painel.mjs'), ...args], { cwd, env, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' }); return { exit: r.status, out: r.stdout, err: r.stderr }; };
  const temas = () => JSON.parse(readFileSync(join(painel, 'temas.json'), 'utf8'));
  return { raiz, painel, repo, painelMjs, temas };
}
const item = (tema) => JSON.stringify({ titulo: 'x', etapa: 'execucao', tema });

describe('c17.1 tema por projeto', () => {
  it('projeto novo grava com `geral` (semeado para ele)', (t) => {
    const a = ambiente(t); const prova = a.repo('prova');
    const r = a.painelMjs(prova, 'set', 'fila', 'K1', item('geral'));
    assert.equal(r.exit, 0, r.err);
    assert.deepEqual(a.temas(), [{ id: 'geral', rotulo: 'Geral', projeto: 'prova' }]);
  });
  it('projeto novo é recusado com o `kit` do Alfa, e a mensagem lista os temas dele', (t) => {
    const a = ambiente(t); const prova = a.repo('prova');
    writeFileSync(join(a.painel, 'temas.json'), JSON.stringify(TEMAS_ALFA));
    const r = a.painelMjs(prova, 'set', 'fila', 'K1', item('kit'));
    assert.equal(r.exit, 1, `devia recusar: ${r.out}`);
    assert.match(r.err, /tema "kit"/); assert.match(r.err, /prova/); assert.match(r.err, /geral/);
    assert.doesNotMatch(r.err, /editor|motor/, 'a lista da mensagem é só a do projeto');
    assert.match(r.err, /temas add/, 'a mensagem diz como criar');
  });
  it('o Alfa continua aceitando os 5 temas dele, sem migração', (t) => {
    const a = ambiente(t); const iza = a.repo('Alfa');
    writeFileSync(join(a.painel, 'temas.json'), JSON.stringify(TEMAS_ALFA));
    for (const [i, { id }] of TEMAS_ALFA.entries()) {
      const r = a.painelMjs(iza, 'set', 'fila', `K${i}`, item(id)); assert.equal(r.exit, 0, `${id}: ${r.err}`);
    }
    assert.deepEqual(a.temas(), TEMAS_ALFA, 'o arquivo do Alfa não mudou');
  });
  it('`temas add` cria tema do projeto; repete id é recusado; o outro projeto não o vê', (t) => {
    const a = ambiente(t); const prova = a.repo('prova'); const outro = a.repo('outro');
    assert.equal(a.painelMjs(prova, 'set', 'fila', 'K1', item('geral')).exit, 0);
    const add = a.painelMjs(prova, 'temas', 'add', 'zero', 'Projeto zero'); assert.equal(add.exit, 0, add.err);
    assert.equal(a.painelMjs(prova, 'set', 'fila', 'K2', item('zero')).exit, 0, 'o tema novo vale no projeto');
    assert.notEqual(a.painelMjs(prova, 'temas', 'add', 'zero', 'de novo').exit, 0, 'id repetido');
    const lista = JSON.parse(a.painelMjs(prova, 'temas', 'list').out);
    assert.deepEqual(lista.map((x) => x.id).sort(), ['geral', 'zero']);
    const r = a.painelMjs(outro, 'set', 'fila', 'K3', item('zero'));
    assert.equal(r.exit, 1, 'tema de outro projeto é recusado'); assert.doesNotMatch(r.err, /Projeto zero/);
  });
  it('o cabeçalho do painel.mjs documenta `temas add`', () => {
    assert.match(readFileSync(join(SCRIPTS, 'painel.mjs'), 'utf8').split('\n').slice(0, 25).join('\n'), /painel\.mjs temas add/);
  });
  it('mutante sem o filtro por projeto: o `kit` do Alfa passa no projeto novo (e o teste acima pega)', (t) => {
    const a = ambiente(t); const prova = a.repo('prova');
    const mut = join(a.raiz, 'scripts-mut'); cpSync(SCRIPTS, mut, { recursive: true });
    const f = join(mut, 'painel.mjs'); const fonte = readFileSync(f, 'utf8');
    const marca = 'const doProjeto = (t, projeto) =>';
    assert.ok(fonte.includes(marca), 'a função a mutar existe');
    writeFileSync(f, fonte.replace(marca, 'const doProjeto = (t, projeto) => true || '));
    writeFileSync(join(a.painel, 'temas.json'), JSON.stringify(TEMAS_ALFA));
    const r = spawnSync('node', [f, 'set', 'fila', 'K1', item('kit')], { cwd: prova, env: { ...process.env, PAINEL_DIR: a.painel, CLAUDE_CODE_SESSION_ID: '' }, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' });
    assert.equal(r.status, 0, `o mutante devia aceitar o tema alheio: ${r.stderr}`);
  });
});

// ---- c17.3: o diff do `adotar --simular` é unificado de verdade (hunks @@ + 3 linhas de contexto) e `git apply` o aplica ----
import { diffTexto } from '../cli/diff.mjs';
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const git = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL' });
const nLinhas = (n, f = (i) => `linha ${i}`) => Array.from({ length: n }, (_, i) => f(i + 1)).join('\n') + '\n';

describe('c17.3 diff unificado', () => {
  const aplica = (t, antigo, novo, diff) => {
    const d = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c17d-'))); t.after(() => rmSync(d, { recursive: true, force: true }));
    if (antigo !== null) writeFileSync(join(d, 'f.txt'), antigo);
    writeFileSync(join(d, 'p.diff'), `${diff}\n`);
    const chk = git(d, 'apply', '--check', 'p.diff'); assert.equal(chk.status, 0, `git apply --check: ${chk.stderr}\n${diff}`);
    const ap = git(d, 'apply', 'p.diff'); assert.equal(ap.status, 0, ap.stderr);
    assert.equal(readFileSync(join(d, 'f.txt'), 'utf8'), novo);
  };
  it('uma mudança no meio: cabeçalho @@ e 3 linhas de contexto de cada lado', (t) => {
    const antigo = nLinhas(20); const novo = antigo.replace('linha 10\n', 'DEZ\n');
    const diff = diffTexto(antigo, novo, 'f.txt');
    assert.ok(diff.length > 0, 'diff não vazio');
    assert.match(diff, /^@@ -7,7 \+7,7 @@$/m);
    assert.equal(diff.split('\n').filter((l) => l.startsWith(' ')).length, 6, 'seis linhas de contexto');
    aplica(t, antigo, novo, diff);
  });
  it('duas mudanças distantes viram dois hunks; vizinhas viram um', (t) => {
    const antigo = nLinhas(40); const longe = antigo.replace('linha 3\n', 'A\n').replace('linha 35\n', 'B\n');
    assert.equal((diffTexto(antigo, longe, 'f.txt').match(/^@@/gm) || []).length, 2);
    aplica(t, antigo, longe, diffTexto(antigo, longe, 'f.txt'));
    const perto = antigo.replace('linha 10\n', 'A\n').replace('linha 14\n', 'B\n');
    assert.equal((diffTexto(antigo, perto, 'f.txt').match(/^@@/gm) || []).length, 1);
    aplica(t, antigo, perto, diffTexto(antigo, perto, 'f.txt'));
  });
  it('arquivo novo (--- /dev/null, @@ -0,0), arquivo sem newline final e começo/fim do arquivo', (t) => {
    const novo = nLinhas(5); const diff = diffTexto(null, novo, 'f.txt');
    assert.match(diff, /^--- \/dev\/null$/m); assert.match(diff, /^@@ -0,0 \+1,5 @@$/m);
    aplica(t, null, novo, diff);
    const a = 'um\ndois\ntres'; const b = 'um\ndois\nquatro';
    aplica(t, a, b, diffTexto(a, b, 'f.txt'));
    const c = nLinhas(10); const d = c.replace('linha 1\n', 'PRIMEIRA\n').replace('linha 10\n', 'ULTIMA\n');
    aplica(t, c, d, diffTexto(c, d, 'f.txt'));
    assert.equal(diffTexto(c, c, 'f.txt'), '', 'sem mudança, diff vazio');
  });
  it('`kit adotar --simular` num projeto em andamento: a saída inteira aplica com git apply --check numa cópia', (t) => {
    const proj = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c17p-'))); t.after(() => rmSync(proj, { recursive: true, force: true }));
    git(proj, 'init', '-q');
    writeFileSync(join(proj, 'CLAUDE.md'), '# Meu projeto\n\nTexto meu.\n');
    writeFileSync(join(proj, 'package.json'), '{\n  "name": "meu",\n  "private": true,\n  "scripts": { "test": "node --test" }\n}\n');
    mkdirSync(join(proj, '.claude')); writeFileSync(join(proj, '.claude', 'settings.json'), '{\n  "enabledPlugins": {\n    "outro@x": true\n  }\n}\n');
    const r = spawnSync('node', [KIT, 'adotar', '--simular'], { cwd: proj, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' });
    assert.equal(r.status, 0, r.stderr);
    const corpo = r.stdout.split('\n'); const ini = corpo.findIndex((l) => l.startsWith('--- '));
    assert.ok(ini >= 0, `sem diff na saída:\n${r.stdout.slice(0, 300)}`);
    const diff = corpo.slice(ini).filter((l) => /^([ +\-@\\]|$)/.test(l)).join('\n');
    assert.match(diff, /^@@ -/m);
    assert.match(r.stdout, /^--- \/dev\/null\n\+\+\+ b\/\.claude\/kit\.json\n@@ -0,0 \+1,\d+ @@$/m, 'arquivo novo sai com o conteúdo, não com um resumo');
    writeFileSync(join(proj, 'p.diff'), `${diff}\n`);
    const chk = git(proj, 'apply', '--check', 'p.diff'); assert.equal(chk.status, 0, `${chk.stderr}\n${diff.slice(0, 600)}`);
    assert.equal(readFileSync(join(proj, 'CLAUDE.md'), 'utf8'), '# Meu projeto\n\nTexto meu.\n', 'a simulação não gravou');
  });
});

// ---- c17.4: o doutor avisa (não falha) quando o bloco `projeto` do CLAUDE.md ainda tem o texto de preencher ----
describe('c17.4 doutor e o placeholder do bloco projeto', () => {
  const kit = (cwd, home, ...args) => spawnSync('node', [KIT, ...args], { cwd, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: { ...process.env, HOME: home, PAINEL_DIR: join(home, 'painel') } });
  it('placeholder presente: linha `aviso:` e exit 0; preenchido: sem o aviso', (t) => {
    const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c17q-'))); t.after(() => rmSync(raiz, { recursive: true, force: true }));
    const home = join(raiz, 'home'); mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
    writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'orquestracao@kit-de-orquestracao': [{ scope: 'user', installPath: '/x', version: '0.1.0' }], 'superpowers@claude-plugins-official': [{ scope: 'user' }] } }));
    writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'superpowers@claude-plugins-official': true } }));
    const proj = join(raiz, 'p'); mkdirSync(proj); git(proj, 'init', '-q');
    assert.equal(kit(proj, home, 'iniciar').status, 0);
    const antes = kit(proj, home, 'doutor');
    assert.match(antes.stdout, /^aviso: .*bloco projeto.*preencher/m, antes.stdout);
    assert.doesNotMatch(antes.stdout, /^falha:/m, 'aviso não é falha'); assert.equal(antes.status, 0, antes.stdout);
    const f = join(proj, 'CLAUDE.md'); const texto = readFileSync(f, 'utf8');
    assert.match(texto, /<!-- preencher: /, 'o placeholder existe antes de editar');
    writeFileSync(f, texto.replace(/<!-- preencher:[^\n]*-->/, 'Loja de teste em Node, commits convencionais em PT-BR.'));
    const depois = kit(proj, home, 'doutor');
    assert.doesNotMatch(depois.stdout, /bloco projeto.*preencher/, depois.stdout);
  });
});

// ---- c17.2: a doc diz que a trava "orquestradora não edita" PERGUNTA (Q62), nunca que recusa ----
describe('c17.2 texto da trava', () => {
  it('a skill da orquestradora e o hook concordam: ask / PERGUNTA', () => {
    const skill = readFileSync(join(RAIZ, 'plugins', 'orquestracao', 'skills', 'orquestradora', 'SKILL.md'), 'utf8');
    const par = skill.split('\n').find((l) => l.includes('orquestradora-nao-edita.mjs'));
    assert.ok(par, 'o parágrafo da trava existe');
    assert.match(par, /PERGUNTA/);
    assert.match(readFileSync(join(RAIZ, 'plugins', 'orquestracao', 'hooks', 'orquestradora-nao-edita.mjs'), 'utf8'), /permissionDecision: 'ask'/);
  });
});
