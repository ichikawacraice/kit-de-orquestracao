// Aviso de atualização da aba do kit (F463): a conta é a do `pode-reiniciar` do kit (lerParaBaixar), sem a batida.
// Nunca toca o ~/.claude real: HOME, cache e clone do marketplace ficam numa pasta temporária.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lerInstalados, publicadoDoCache, cacheVale, paraBaixar, atualizarCache, KIT_PUBLICADO_VALE_MS } from '../src/nucleo/atualizacao.mjs';

const AGORA = Date.parse('2026-11-06T17:00:00Z');
const ent = (version, scope = 'user') => [{ scope, version, lastUpdated: '2026-11-06T10:00:00Z' }];

function montar({ instalados, cache, marketplace = 'ichikawa-kit' }) {
  const home = mkdtempSync(join(tmpdir(), 'f463-'));
  mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
  const plugins = Object.fromEntries(Object.entries(instalados).map(([n, v]) => [`${n}@${marketplace}`, ent(v)]));
  writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins }));
  const arq = join(home, 'kit-publicado.json');
  if (cache) writeFileSync(arq, JSON.stringify(cache));
  return { home, cache: arq };
}
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

test('o cache vale 30 min', () => {
  assert.equal(KIT_PUBLICADO_VALE_MS, 30 * 60_000);
});

test('lerInstalados lê só o marketplace do kit, escopo user', () => {
  const m = montar({ instalados: { orquestracao: '0.1.108', 'painel-sessoes': '0.9.20' } });
  const l = lerInstalados(m.home);
  assert.ok(l.length === 2, 'insumo vazio não mede nada');
  assert.deepEqual(l.map((p) => [p.nome, p.versao]), [['orquestracao', '0.1.108'], ['painel-sessoes', '0.9.20']]);
});

test('paraBaixar: só a publicada mais nova (comparação numérica, 0.1.99 < 0.1.108) e só versão de release', () => {
  const instalados = [{ nome: 'a', versao: '0.1.99' }, { nome: 'b', versao: '0.1.108' }, { nome: 'c', versao: '1.0.0' }, { nome: 'd', versao: '1.0.0' }];
  const r = paraBaixar(instalados, { a: '0.1.108', b: '0.1.108', c: '1.0.1-beta', d: '1.0.1' });
  assert.deepEqual(r, [{ nome: 'a', instalada: '0.1.99', publicada: '0.1.108' }, { nome: 'd', instalada: '1.0.0', publicada: '1.0.1' }]);
});

test('paraBaixar: plugin renomeado (design → kit-design) pede a troca', () => {
  assert.deepEqual(paraBaixar([{ nome: 'design', versao: '0.2.0' }], { 'kit-design': '0.2.6' }), [{ nome: 'kit-design', instalada: '0.2.0', publicada: '0.2.6' }]);
});

test('o cache vale 30 min; passado o prazo (ou com data no futuro) a conta ainda lê, mas pede nova conferência', () => {
  const novo = { em: new Date(AGORA - 5 * 60_000).toISOString(), publicado: { x: '1.0.0' } };
  const velho = { em: new Date(AGORA - 31 * 60_000).toISOString(), publicado: { x: '1.0.0' } };
  const futuro = { em: new Date(AGORA + 60_000).toISOString(), publicado: { x: '1.0.0' } };
  const m = montar({ instalados: {}, cache: novo });
  assert.deepEqual(publicadoDoCache(m.cache), { x: '1.0.0' });
  assert.equal(cacheVale(m.cache, AGORA), true);
  writeFileSync(m.cache, JSON.stringify(velho));
  assert.deepEqual(publicadoDoCache(m.cache), { x: '1.0.0' });
  assert.equal(cacheVale(m.cache, AGORA), false);
  writeFileSync(m.cache, JSON.stringify(futuro));
  assert.equal(cacheVale(m.cache, AGORA), false);
  assert.equal(cacheVale(join(m.home, 'nao-existe.json'), AGORA), false);
  assert.equal(publicadoDoCache(join(m.home, 'nao-existe.json')), null);
});

test('atualizarCache: fetch no clone, lê as versões publicadas e grava o cache no formato do kit', async () => {
  const base = mkdtempSync(join(tmpdir(), 'f463-git-'));
  const origem = join(base, 'origem');
  mkdirSync(join(origem, '.claude-plugin'), { recursive: true });
  mkdirSync(join(origem, 'plugins', 'orquestracao', '.claude-plugin'), { recursive: true });
  writeFileSync(join(origem, '.claude-plugin', 'marketplace.json'), JSON.stringify({ plugins: [{ name: 'orquestracao', source: './plugins/orquestracao' }] }));
  const manifesto = join(origem, 'plugins', 'orquestracao', '.claude-plugin', 'plugin.json');
  writeFileSync(manifesto, JSON.stringify({ version: '0.1.108' }));
  git(origem, 'init', '-q', '-b', 'main');
  git(origem, '-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A');
  git(origem, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'um');
  const clone = join(base, 'clone');
  git(base, 'clone', '-q', origem, clone);
  writeFileSync(manifesto, JSON.stringify({ version: '0.1.109' }));
  git(origem, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qam', 'dois');
  const cache = join(base, 'batida', 'kit-publicado.json');
  const r = await atualizarCache({ clone, cache, agoraMs: AGORA });
  assert.deepEqual(r, { orquestracao: '0.1.109' });
  const gravado = JSON.parse(readFileSync(cache, 'utf8'));
  assert.equal(gravado.em, new Date(AGORA).toISOString());
  assert.deepEqual(gravado.publicado, { orquestracao: '0.1.109' });
});

test('atualizarCache: sem clone ou sem rede devolve null, grava a tentativa e não derruba', async () => {
  const base = mkdtempSync(join(tmpdir(), 'f463-sem-'));
  const cache = join(base, 'kit-publicado.json');
  assert.equal(await atualizarCache({ clone: join(base, 'nao-existe'), cache, agoraMs: AGORA }), null);
  const gravado = JSON.parse(readFileSync(cache, 'utf8'));
  assert.equal(gravado.publicado, null);
  assert.equal(gravado.em, new Date(AGORA).toISOString(), 'a tentativa conta: a próxima ida à rede espera o prazo');
});

test('atualizarCache: a conferência que falha não apaga o que o cache já sabia (o aviso não some por falta de rede)', async () => {
  const base = mkdtempSync(join(tmpdir(), 'f463-mantem-'));
  const cache = join(base, 'kit-publicado.json');
  writeFileSync(cache, JSON.stringify({ em: new Date(AGORA - 60 * 60_000).toISOString(), publicado: { orquestracao: '0.1.109' } }));
  assert.deepEqual(await atualizarCache({ clone: join(base, 'nao-existe'), cache, agoraMs: AGORA }), { orquestracao: '0.1.109' });
  assert.deepEqual(JSON.parse(readFileSync(cache, 'utf8')), { em: new Date(AGORA).toISOString(), publicado: { orquestracao: '0.1.109' } });
});
