import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const kit = (...args) => spawnSync('node', [join(RAIZ, 'cli', 'kit.mjs'), ...args], { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL' });
const json = (...p) => JSON.parse(readFileSync(join(RAIZ, ...p), 'utf8'));

test('--version imprime a versão do package.json', () => {
  const versao = json('package.json').version;
  assert.match(versao, /^\d+\.\d+\.\d+$/);
  const r = kit('--version');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), versao);
});

test('ajuda e sem argumento listam o uso; comando desconhecido sai 2', () => {
  for (const args of [['ajuda'], []]) {
    const r = kit(...args);
    assert.equal(r.status, 0);
    assert.ok(r.stdout.length > 0, 'ajuda vazia');
    assert.match(r.stdout, /kit --version/);
    assert.match(r.stdout, /kit ajuda/);
  }
  const r = kit('xyz');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /xyz/);
});

test('package.json: bin, engines, test e type module', () => {
  const p = json('package.json');
  assert.equal(p.type, 'module');
  assert.equal(p.bin.kit, 'cli/kit.mjs');
  assert.equal(p.engines.node, '>=20');
  assert.equal(p.scripts.test, 'node gate/com-fichas.mjs --quero 4 -- node --test --test-concurrency={fichas}'); // o teste do kit passa pelo teto da máquina (ADR 0005)
  assert.ok(existsSync(join(RAIZ, p.bin.kit)));
  assert.equal(p.dependencies, undefined, 'o kit não traz dependência npm');
});

test('marketplace.json lista os plugins do kit, cada um com a versão esperada no plugin.json', () => {
  const m = json('.claude-plugin', 'marketplace.json');
  const nomes = m.plugins.map((p) => p.name).sort();
  assert.deepEqual(nomes, ['design', 'orquestracao', 'painel-sessoes', 'processos']);
  for (const pl of m.plugins) {
    const pj = json(pl.source, '.claude-plugin', 'plugin.json');
    assert.equal(pj.name, pl.name);
    assert.match(pj.version, /^\d+\.\d+\.\d+$/); if (pl.name === 'orquestracao') assert.equal(pj.version, '0.1.42'); // o cache do plugin só se renova quando a versão muda
  }
});

const BLOCOS = ['projeto', 'comandos', 'regras-de-operacao', 'regras-de-trabalho', 'documentos', 'design', 'convencoes-de-teste', 'orquestradora'];
const blocos = (texto) => [...texto.matchAll(/<!-- kit:([a-z-]+) v(\d+) -->([\s\S]*?)<!-- \/kit:\1 -->/g)].map((m) => ({ nome: m[1], conteudo: m[3] }));

test('modelos/CLAUDE.md tem os oito blocos marcados, abertos e fechados, não vazios', () => {
  const t = readFileSync(join(RAIZ, 'modelos', 'CLAUDE.md'), 'utf8');
  const b = blocos(t);
  assert.deepEqual(b.map((x) => x.nome), BLOCOS);
  for (const x of b) assert.ok(x.conteudo.trim().length > 20, `bloco ${x.nome} vazio`);
  assert.equal((t.match(/<!-- kit:/g) || []).length, (t.match(/<!-- \/kit:/g) || []).length);
});

test('CLAUDE.md do repo traz todos os blocos do modelo (escrito a partir dele)', () => {
  const modelo = blocos(readFileSync(join(RAIZ, 'modelos', 'CLAUDE.md'), 'utf8'));
  const meu = blocos(readFileSync(join(RAIZ, 'CLAUDE.md'), 'utf8'));
  assert.deepEqual(meu.map((x) => x.nome), modelo.map((x) => x.nome));
});
