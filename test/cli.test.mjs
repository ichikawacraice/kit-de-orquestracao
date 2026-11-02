import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

test('marketplace.json lista os plugins do kit, cada um com versão semver no plugin.json', () => {
  const m = json('.claude-plugin', 'marketplace.json');
  const nomes = m.plugins.map((p) => p.name).sort();
  assert.deepEqual(nomes, ['kit-design', 'orquestracao', 'painel-sessoes', 'processos']);
  for (const pl of m.plugins) {
    const pj = json(pl.source, '.claude-plugin', 'plugin.json');
    assert.equal(pj.name, pl.name);
    assert.match(pj.version, /^\d+\.\d+\.\d+$/);
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

test('nenhum teste fixa a versão atual de um plugin (a versão sobe no lote, pela orquestradora)', () => {
  const m = json('.claude-plugin', 'marketplace.json');
  const versoes = m.plugins.map((p) => json(p.source, '.claude-plugin', 'plugin.json').version);
  const testes = [];
  const varrer = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') varrer(p); } else if (e.name.endsWith('.test.mjs')) testes.push(p);
    }
  };
  varrer(join(RAIZ, 'test'));
  for (const pl of readdirSync(join(RAIZ, 'plugins'))) varrer(join(RAIZ, 'plugins', pl, 'hooks', 'tests'));
  assert.ok(versoes.length >= 4, `achei só ${versoes.length} plugin.json`);
  assert.ok(testes.length >= 20, `achei só ${testes.length} arquivos de teste`);
  const achados = [];
  for (const f of testes) {
    const t = readFileSync(f, 'utf8');
    for (const v of versoes) if (t.includes(`'${v}'`) || t.includes(`"${v}"`)) achados.push(`${f.slice(RAIZ.length + 1)}: ${v}`);
  }
  assert.deepEqual(achados, [], 'teste com a versão atual de um plugin como literal: a versão é da orquestradora, depois do lote');
});
