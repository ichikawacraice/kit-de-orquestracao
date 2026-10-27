import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// c19: as ressalvas baixas do c17 (tema sem projeto, tema global, semente com escrita recusada).
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(RAIZ, 'plugins', 'orquestracao', 'skills', 'orquestradora', 'scripts');
const ALFA = ['editor', 'motor', 'gate', 'orquestracao', 'kit'].map((id) => ({ id, rotulo: id, projeto: 'alfa' }));

function ambiente(t) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c19-')));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const painel = join(raiz, 'painel'); mkdirSync(painel);
  const repo = (nome) => { const d = join(raiz, 'repos', nome); mkdirSync(d, { recursive: true }); spawnSync('git', ['init', '-q', d], { timeout: 30000, killSignal: 'SIGKILL' }); return d; };
  const fora = join(raiz, 'fora'); mkdirSync(fora);
  const env = { ...process.env, PAINEL_DIR: painel, CLAUDE_CODE_SESSION_ID: '', GIT_CEILING_DIRECTORIES: raiz }; delete env.KIT_PROJETO; delete env.NODE_TEST_CONTEXT;
  const painelMjs = (cwd, ...args) => { const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], { cwd, env, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' }); return { exit: r.status, out: r.stdout, err: r.stderr }; };
  const escreverTemas = (l) => writeFileSync(join(painel, 'temas.json'), JSON.stringify(l));
  const temas = () => JSON.parse(readFileSync(join(painel, 'temas.json'), 'utf8'));
  return { painel, repo, fora, painelMjs, escreverTemas, temas };
}
const item = (extra) => JSON.stringify({ titulo: 'x', etapa: 'execucao', ...extra });

describe('c19 tema no painel', () => {
  it('1. item sem projeto recusa o tema de outro projeto e aceita o global', (t) => {
    const a = ambiente(t); a.escreverTemas([...ALFA, { id: 'glob', rotulo: 'Global' }]);
    const sonda = a.painelMjs(a.fora, 'set', 'fila', 'S0', item({ tema: 'glob' }));
    assert.equal(sonda.exit, 0, sonda.err); // prova que a pasta sem git é de fato "sem projeto" e que o tema global entra
    assert.match(sonda.err, /sem projeto/);
    const r = a.painelMjs(a.fora, 'set', 'fila', 'S1', item({ tema: 'kit' }));
    assert.notEqual(r.exit, 0);
    assert.match(r.err, /tema "kit"/);
  });
  it('2. tema global não desliga o isolamento nem a semente: o projeto novo ganha `geral` e continua recusando o de outro', (t) => {
    const a = ambiente(t); a.escreverTemas([{ id: 'glob', rotulo: 'Global' }, ...ALFA]);
    const novo = a.repo('novo');
    const ok = a.painelMjs(novo, 'set', 'fila', 'N1', item({ tema: 'geral' }));
    assert.equal(ok.exit, 0, ok.err);
    assert.ok(a.temas().some((x) => x.id === 'geral' && x.projeto === 'novo'));
    assert.equal(a.painelMjs(novo, 'set', 'fila', 'N2', item({ tema: 'glob' })).exit, 0);
    assert.notEqual(a.painelMjs(novo, 'set', 'fila', 'N3', item({ tema: 'kit' })).exit, 0);
  });
  it('3. a semente só é gravada depois que a escrita é aceita', (t) => {
    const a = ambiente(t); const prova = a.repo('prova');
    const antes = a.painelMjs(prova, 'set', 'fila', 'R0', item({ tema: 'geral' }));
    assert.equal(antes.exit, 0, antes.err); // prova que, com a escrita boa, a semente existe
    assert.ok(a.temas().some((x) => x.projeto === 'prova'));
    const b = ambiente(t); const outra = b.repo('outra'); b.escreverTemas(ALFA);
    const r = b.painelMjs(outra, 'set', 'fila', 'R1', item({ tema: 'kit' }));
    assert.notEqual(r.exit, 0);
    assert.deepEqual(b.temas(), ALFA);
    const c = ambiente(t); const x = c.repo('x'); c.escreverTemas(ALFA);
    const r2 = c.painelMjs(x, 'set', 'fila', 'R2', item({ tema: 'geral', etapa: 'nao-existe' }));
    assert.notEqual(r2.exit, 0);
    assert.deepEqual(c.temas(), ALFA);
  });
  it('os 5 temas do Alfa continuam valendo para o Alfa (cópia do temas.json real), e o `geral` não é semeado por cima', (t) => {
    const a = ambiente(t); const alfa = a.repo('alfa'); a.escreverTemas([{ id: 'glob', rotulo: 'Global' }, ...ALFA]);
    for (const [i, { id }] of ALFA.entries()) {
      const r = a.painelMjs(alfa, 'set', 'fila', `I${i}`, item({ tema: id }));
      assert.equal(r.exit, 0, `${id}: ${r.err}`);
    }
    assert.equal(a.temas().length, 6, 'nenhum tema novo foi cadastrado');
  });
});
