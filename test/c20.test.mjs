import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// c20: item legado sem projeto troca de tema com `update`; a recusa sem tema nenhum diz a causa.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(RAIZ, 'plugins', 'orquestracao', 'skills', 'orquestradora', 'scripts');
const ALFA = ['editor', 'motor', 'kit'].map((id) => ({ id, rotulo: id, projeto: 'alfa' }));

function ambiente(t) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c20-')));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const painel = join(raiz, 'painel'); mkdirSync(join(painel, 'fila'), { recursive: true });
  const repo = (nome) => { const d = join(raiz, 'repos', nome); mkdirSync(d, { recursive: true }); spawnSync('git', ['init', '-q', d], { timeout: 30000, killSignal: 'SIGKILL' }); return d; };
  const fora = join(raiz, 'fora'); mkdirSync(fora);
  const env = { ...process.env, PAINEL_DIR: painel, CLAUDE_CODE_SESSION_ID: '', GIT_CEILING_DIRECTORIES: raiz }; delete env.KIT_PROJETO; delete env.NODE_TEST_CONTEXT;
  const painelMjs = (cwd, ...args) => { const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], { cwd, env, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' }); return { exit: r.status, out: r.stdout, err: r.stderr }; };
  const temas = (l) => writeFileSync(join(painel, 'temas.json'), JSON.stringify(l));
  const itemLegado = (id, data) => writeFileSync(join(painel, 'fila', `${id}.json`), JSON.stringify({ id, version: 1, data }));
  const lido = (id) => JSON.parse(readFileSync(join(painel, 'fila', `${id}.json`), 'utf8')).data;
  return { repo, fora, painelMjs, temas, itemLegado, lido };
}
const legado = (tema) => ({ titulo: 'x', etapa: 'execucao', tema, atualizadoEm: '2026-10-20T10:00:00.000Z' });

describe('c20.3 item legado sem projeto troca para tema do projeto', () => {
  it('update de tema do projeto grava o projeto junto; tema global não preenche projeto; sem tema novo o item segue sem projeto', (t) => {
    const a = ambiente(t); const iz = a.repo('alfa');
    a.temas([{ id: 'glob', rotulo: 'Global' }, ...ALFA]);
    a.itemLegado('L1', legado('glob')); a.itemLegado('L2', legado('glob')); a.itemLegado('L3', legado('glob'));
    assert.equal(a.lido('L1').projeto, undefined, 'precondição: o item é legado, sem projeto');
    const ok = a.painelMjs(iz, 'update', 'fila', 'L1', JSON.stringify({ etapa: 'validacao' }));
    assert.equal(ok.exit, 0, ok.err); assert.equal(a.lido('L1').projeto, undefined, 'sem trocar de tema, o projeto não é inventado');
    const r = a.painelMjs(iz, 'update', 'fila', 'L2', JSON.stringify({ tema: 'motor' }));
    assert.equal(r.exit, 0, r.err); assert.equal(a.lido('L2').tema, 'motor'); assert.equal(a.lido('L2').projeto, 'alfa');
    const g = a.painelMjs(iz, 'update', 'fila', 'L3', JSON.stringify({ tema: 'glob', etapa: 'validacao' }));
    assert.equal(g.exit, 0, g.err); assert.equal(a.lido('L3').projeto, undefined, 'tema global não atribui o item a projeto nenhum');
  });
  it('fora de git não há projeto a gravar: o tema de projeto segue recusado', (t) => {
    const a = ambiente(t); a.temas(ALFA); a.itemLegado('L4', legado('editor'));
    const r = a.painelMjs(a.fora, 'update', 'fila', 'L4', JSON.stringify({ tema: 'motor' }));
    assert.notEqual(r.exit, 0); assert.equal(a.lido('L4').tema, 'editor');
  });
});

describe('c20.4 a recusa sem tema nenhum diz a causa', () => {
  it('item sem projeto e sem tema global: a mensagem explica e mostra o `temas add`, sem "()"', (t) => {
    const a = ambiente(t); a.temas(ALFA);
    const r = a.painelMjs(a.fora, 'set', 'fila', 'S1', JSON.stringify({ titulo: 'x', etapa: 'execucao', tema: 'kit' }));
    assert.notEqual(r.exit, 0, 'precondição: a gravação é recusada');
    assert.doesNotMatch(r.err, /\(\)/);
    assert.match(r.err, /sem projeto/); assert.match(r.err, /temas add/);
  });
  it('com tema na lista a mensagem continua listando os temas', (t) => {
    const a = ambiente(t); a.temas([{ id: 'glob', rotulo: 'G' }]);
    const r = a.painelMjs(a.fora, 'set', 'fila', 'S2', JSON.stringify({ titulo: 'x', etapa: 'execucao', tema: 'kit' }));
    assert.notEqual(r.exit, 0); assert.match(r.err, /\(glob\)/);
  });
});
