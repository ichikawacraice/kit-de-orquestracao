// F351: o giro do arquivo de estado da orquestradora. Função pura e o CLI sobre pasta temporária (nunca o ~/.claude real).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { girar, caminhoDoMorto, MANTER_ENTREGAS } from '../../skills/orquestradora/scripts/estado-girar.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts', 'estado-girar.mjs');

const ESTADO = [
  '# projx — estado', '',
  '## PRs abertos (de quem, estado)', '- #10 da dona do F1', '',
  '## Itens vivos e donas (abertas 30/10)', '- F1', '',
  '## Retomar daqui (limpeza, 27/10 ~11:15 SP)', 'passo velho A', '',
  '## Próximo passo exato', 'sem data: fica', '',
  '## Estado em 2026-10-29', 'passo velho B', '```', '## não é seção (dentro de código)', '```', '',
  '## Números reservados', '- ADR 0019', '',
  '## Retomar daqui (02/11 ~21:15 SP)', 'passo novo', '',
].join('\n');

test('girar: as datadas antigas saem, a mais nova e as fixas (mesmo com data no título) ficam, a sem data fica', () => {
  const g = girar(ESTADO);
  assert.deepEqual(g.movidas, ['Retomar daqui (limpeza, 27/10 ~11:15 SP)', 'Estado em 2026-10-29']);
  for (const fica of ['## PRs abertos', '## Itens vivos e donas (abertas 30/10)', '## Próximo passo exato', '## Números reservados', 'passo novo', '# projx — estado']) assert.ok(g.vivo.includes(fica), `${fica} sumiu do vivo`);
  for (const sai of ['passo velho A', 'passo velho B', '## não é seção']) {
    assert.ok(ESTADO.includes(sai), `precondição: ${sai} está no original`);
    assert.ok(!g.vivo.includes(sai), `${sai} ficou no vivo`);
    assert.ok(g.morto.includes(sai), `${sai} não foi ao morto`);
  }
});

test('girar: sem nada a mover devolve o texto igual e morto vazio', () => {
  const g1 = girar(ESTADO);
  const g2 = girar(g1.vivo);
  assert.equal(g2.vivo, g1.vivo);
  assert.equal(g2.morto, '');
  assert.deepEqual(g2.movidas, []);
});

test('girar: as entregas arquivadas ficam nas últimas MANTER_ENTREGAS; as antigas vão ao morto', () => {
  const n = MANTER_ENTREGAS + 3;
  const texto = ['# x', '', '## Entregas arquivadas', 'nota solta', ...Array.from({ length: n }, (_, i) => `- entrega ${i + 1}`), ''].join('\n');
  const g = girar(texto);
  assert.equal(g.entregasMovidas, 3);
  assert.ok(g.vivo.includes('nota solta') && g.vivo.includes(`- entrega ${n}`) && g.vivo.includes('- entrega 4'));
  assert.ok(!g.vivo.includes('- entrega 3\n') && g.morto.includes('- entrega 1\n'), g.vivo);
});

test('CLI: grava o vivo e acrescenta ao morto do mês (SP); --seco não grava', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'estado-girar-'));
  try {
    const arq = join(raiz, 'projx.md');
    writeFileSync(arq, ESTADO);
    const rodar = (...a) => spawnSync('node', [SCRIPT, arq, ...a], { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL' });
    const seco = rodar('--seco');
    assert.equal(seco.status, 0, seco.stderr);
    assert.equal(JSON.parse(seco.stdout).movidas.length, 2);
    assert.equal(readFileSync(arq, 'utf8'), ESTADO, '--seco não grava');
    const r = rodar();
    assert.equal(r.status, 0, r.stderr);
    const s = JSON.parse(r.stdout);
    assert.ok(s.depois < s.antes);
    assert.equal(s.morto, caminhoDoMorto(arq));
    assert.ok(existsSync(s.morto));
    assert.match(readFileSync(s.morto, 'utf8'), /girado de projx\.md em .*\(SP\)[\s\S]*passo velho A/);
    assert.ok(!readFileSync(arq, 'utf8').includes('passo velho A'));
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('caminhoDoMorto: o mês é o de São Paulo (02:00 UTC de 01/12 ainda é novembro em SP)', () => {
  assert.equal(caminhoDoMorto('/b/projx.md', new Date('2026-12-01T02:00:00Z')), '/b/arquivo-morto/projx/2026-11.md');
});
