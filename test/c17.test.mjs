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
// cópia do temas.json real do Izanagi (25/10): os 5 temas continuam valendo para ele, sem migração
const TEMAS_IZANAGI = [
  { id: 'editor', rotulo: 'Editor da loja', projeto: 'izanagi' }, { id: 'motor', rotulo: 'Motor dos jobs', projeto: 'izanagi' },
  { id: 'gate', rotulo: 'Gate e testes', projeto: 'izanagi' }, { id: 'orquestracao', rotulo: 'Sessões e painel', projeto: 'izanagi' },
  { id: 'kit', rotulo: 'Kit de orquestração', projeto: 'izanagi' }];

function ambiente(t, scripts = SCRIPTS) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c17-')));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const painel = join(raiz, 'painel'); mkdirSync(painel);
  const repo = (nome) => { const d = join(raiz, 'repos', nome); mkdirSync(d, { recursive: true }); spawnSync('git', ['init', '-q', d], { timeout: 30000, killSignal: 'SIGKILL' }); return d; };
  const env = { ...process.env, PAINEL_DIR: painel, CLAUDE_CODE_SESSION_ID: '' }; delete env.KIT_PROJETO; delete env.IZANAGI_PAINEL_DIR;
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
  it('projeto novo é recusado com o `kit` do Izanagi, e a mensagem lista os temas dele', (t) => {
    const a = ambiente(t); const prova = a.repo('prova');
    writeFileSync(join(a.painel, 'temas.json'), JSON.stringify(TEMAS_IZANAGI));
    const r = a.painelMjs(prova, 'set', 'fila', 'K1', item('kit'));
    assert.equal(r.exit, 1, `devia recusar: ${r.out}`);
    assert.match(r.err, /tema "kit"/); assert.match(r.err, /prova/); assert.match(r.err, /geral/);
    assert.doesNotMatch(r.err, /editor|motor/, 'a lista da mensagem é só a do projeto');
    assert.match(r.err, /temas add/, 'a mensagem diz como criar');
  });
  it('o Izanagi continua aceitando os 5 temas dele, sem migração', (t) => {
    const a = ambiente(t); const iza = a.repo('Izanagi');
    writeFileSync(join(a.painel, 'temas.json'), JSON.stringify(TEMAS_IZANAGI));
    for (const [i, { id }] of TEMAS_IZANAGI.entries()) {
      const r = a.painelMjs(iza, 'set', 'fila', `K${i}`, item(id)); assert.equal(r.exit, 0, `${id}: ${r.err}`);
    }
    assert.deepEqual(a.temas(), TEMAS_IZANAGI, 'o arquivo do Izanagi não mudou');
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
  it('mutante sem o filtro por projeto: o `kit` do Izanagi passa no projeto novo (e o teste acima pega)', (t) => {
    const a = ambiente(t); const prova = a.repo('prova');
    const mut = join(a.raiz, 'scripts-mut'); cpSync(SCRIPTS, mut, { recursive: true });
    const f = join(mut, 'painel.mjs'); const fonte = readFileSync(f, 'utf8');
    const marca = 'const doProjeto = (t, projeto) =>';
    assert.ok(fonte.includes(marca), 'a função a mutar existe');
    writeFileSync(f, fonte.replace(marca, 'const doProjeto = (t, projeto) => true || '));
    writeFileSync(join(a.painel, 'temas.json'), JSON.stringify(TEMAS_IZANAGI));
    const r = spawnSync('node', [f, 'set', 'fila', 'K1', item('kit')], { cwd: prova, env: { ...process.env, PAINEL_DIR: a.painel, CLAUDE_CODE_SESSION_ID: '' }, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' });
    assert.equal(r.status, 0, `o mutante devia aceitar o tema alheio: ${r.stderr}`);
  });
});
