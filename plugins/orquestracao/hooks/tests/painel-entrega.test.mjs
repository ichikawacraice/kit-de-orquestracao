#!/usr/bin/env node
// F404 (ADR 0024): a `entrega` do item — validação, saída na reabertura e o comando `painel entregas`. Painel em pasta
// temporária (PAINEL_DIR), HOME temporário; nunca toca o ~/.claude real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const LA = 'local_00000000-0000-4000-8000-0000000000a1';

function montar() {
  const raiz = mkdtempSync(join(tmpdir(), 'painel-entrega-'));
  for (const d of ['painel', 'home', 'appsess']) mkdirSync(join(raiz, d));
  writeFileSync(join(raiz, 'painel', 'temas.json'), JSON.stringify([{ id: 'geral', rotulo: 'Geral', projeto: 'projx' }, { id: 'geral', rotulo: 'Geral', projeto: 'outro' }]));
  const painel = (...args) => {
    const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], {
      cwd: raiz, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL',
      env: { ...process.env, PAINEL_DIR: join(raiz, 'painel'), HOME: join(raiz, 'home'), CLAUDE_CODE_SESSION_ID: '', POOL_APP_SESSOES_DIR: join(raiz, 'appsess'), BATIDA: 'off' },
    });
    assert.ok(!r.error, String(r.error));
    return { exit: r.status, out: r.stdout, err: r.stderr };
  };
  const dado = (F) => JSON.parse(readFileSync(join(raiz, 'painel', 'fila', `${F}.json`), 'utf8')).data;
  // Item direto no arquivo (o feitoEm de um item fechado há N horas não se grava pelo painel, que o põe na hora).
  const itemCru = (F, data) => {
    mkdirSync(join(raiz, 'painel', 'fila'), { recursive: true });
    writeFileSync(join(raiz, 'painel', 'fila', `${F}.json`), `${JSON.stringify({ id: F, version: 1, data })}\n`);
  };
  return { raiz, painel, dado, itemCru, limpar: () => rmSync(raiz, { recursive: true, force: true }) };
}
const vivo = (extra = {}) => JSON.stringify({ titulo: 'T', tema: 'geral', projeto: 'projx', etapa: 'merge', prs: [12], donoLocalId: LA, donoApelido: 'dona', ...extra });
const ENTREGA = { resultado: 'a home caiu de 984 ms para 270 ms', medido: 'Lighthouse móvel, 3 rodadas', naoMedido: 'o checkout', proximos: ['cache da busca'] };

test('a entrega válida é gravada; só o resultado já basta', () => {
  const c = montar();
  try {
    assert.equal(c.painel('set', 'fila', 'F1', vivo({ entrega: ENTREGA })).exit, 0);
    assert.deepEqual(c.dado('F1').entrega, ENTREGA);
    const r = c.painel('update', 'fila', 'F1', JSON.stringify({ entrega: { resultado: 'só isto' } }));
    assert.equal(r.exit, 0, r.err);
    assert.equal(c.dado('F1').entrega.resultado, 'só isto');
  } finally { c.limpar(); }
});

test('a entrega malformada é recusada com o motivo, e nada é gravado', () => {
  const c = montar();
  try {
    assert.equal(c.painel('set', 'fila', 'F1', vivo()).exit, 0);
    for (const [entrega, trecho] of [
      ['texto solto', 'entrega é {resultado'],
      [['x'], 'entrega é {resultado'],
      [{}, 'entrega.resultado'],
      [{ resultado: '   ' }, 'entrega.resultado'],
      [{ resultado: 'ok', medido: 3 }, 'entrega.medido'],
      [{ resultado: 'ok', naoMedido: [] }, 'entrega.naoMedido'],
      [{ resultado: 'ok', proximos: 'um' }, 'entrega.proximos'],
      [{ resultado: 'ok', proximos: ['', 'b'] }, 'entrega.proximos'],
      [{ resultado: 'ok', nao_medido: 'x' }, 'nao_medido'],
    ]) {
      const r = c.painel('update', 'fila', 'F1', JSON.stringify({ entrega }));
      assert.equal(r.exit, 1, `${JSON.stringify(entrega)} passou`);
      assert.match(r.err, new RegExp(trecho.replace(/[{}]/g, '\\$&')), `${JSON.stringify(entrega)}: ${r.err}`);
      assert.equal(c.dado('F1').entrega, undefined, 'gravou apesar da recusa');
    }
  } finally { c.limpar(); }
});

test('a entrega fica no item que fecha e sai na reabertura, como o feitoEm', () => {
  const c = montar();
  try {
    assert.equal(c.painel('set', 'fila', 'F1', vivo({ entrega: ENTREGA })).exit, 0);
    assert.equal(c.painel('update', 'fila', 'F1', JSON.stringify({ etapa: 'feito', donoLocalId: null, donoApelido: null })).exit, 0);
    assert.deepEqual(c.dado('F1').entrega, ENTREGA, 'fechou com a entrega');
    assert.ok(c.dado('F1').feitoEm, 'precondição: fechou com feitoEm');
    assert.equal(c.painel('update', 'fila', 'F1', JSON.stringify({ etapa: 'execucao' })).exit, 0);
    assert.equal(c.dado('F1').feitoEm, undefined, 'precondição: reabriu sem feitoEm');
    assert.equal(c.dado('F1').entrega, undefined, 'a entrega velha saiu');
  } finally { c.limpar(); }
});

test('`painel entregas` lista os fechados do projeto desde a hora pedida, com a entrega; sem entrega vem null', () => {
  const c = montar();
  try {
    const h = (n) => new Date(Date.now() - n * 3600e3).toISOString();
    c.itemCru('F1', { titulo: 'Home rápida', projeto: 'projx', etapa: 'feito', feitoEm: h(2), prs: [12], entrega: ENTREGA });
    c.itemCru('F2', { titulo: 'Sem entrega', projeto: 'projx', etapa: 'feito', feitoEm: h(3), prs: [13] });
    c.itemCru('F3', { titulo: 'Antigo', projeto: 'projx', etapa: 'feito', feitoEm: h(30), entrega: { resultado: 'velho' } });
    c.itemCru('F4', { titulo: 'Vivo', projeto: 'projx', etapa: 'merge', prs: [14] });
    c.itemCru('F5', { titulo: 'De outro', projeto: 'outro', etapa: 'feito', feitoEm: h(1), entrega: { resultado: 'de fora' } });
    c.itemCru('F6', { titulo: 'Descartado', projeto: 'projx', etapa: 'descartado', feitoEm: h(1) });

    const r = c.painel('entregas', '--projeto', 'projx');
    assert.equal(r.exit, 0, r.err);
    const out = JSON.parse(r.out);
    assert.ok(Array.isArray(out.itens) && out.itens.length > 0, 'veio a lista');
    assert.deepEqual(out.itens.map((i) => i.id), ['F1', 'F2'], 'só os feitos do projeto nas 24 h, do mais novo ao mais velho');
    assert.deepEqual(out.itens[0].entrega, ENTREGA);
    assert.equal(out.itens[0].titulo, 'Home rápida');
    assert.deepEqual(out.itens[0].prs, [12]);
    assert.equal(out.itens[1].entrega, null);
    assert.deepEqual(out.semEntrega, ['F2']);
    assert.ok(out.desde, 'diz a hora de corte');

    const desde = c.painel('entregas', '--projeto', 'projx', '--desde', h(2.5));
    assert.deepEqual(JSON.parse(desde.out).itens.map((i) => i.id), ['F1'], '--desde ISO corta');
    const todos = c.painel('entregas', '--todos', '--desde', h(48));
    assert.deepEqual(JSON.parse(todos.out).itens.map((i) => i.id).sort(), ['F1', 'F2', 'F3', 'F5'], '--todos junta os projetos');
    assert.equal(c.painel('entregas', '--desde', 'ontem').exit, 1, '--desde inválido é erro');
  } finally { c.limpar(); }
});

test('`painel entregas --desde HH:MM` é a hora de São Paulo de hoje', () => {
  const c = montar();
  try {
    c.itemCru('F1', { titulo: 'x', projeto: 'projx', etapa: 'feito', feitoEm: new Date().toISOString(), entrega: { resultado: 'r' } });
    const r = c.painel('entregas', '--projeto', 'projx', '--desde', '00:00');
    assert.equal(r.exit, 0, r.err);
    const out = JSON.parse(r.out);
    const desde = Date.parse(out.desde);
    // 00:00 em SP = 03:00 UTC; o corte é de hoje (SP) ou, logo depois da meia-noite UTC, de ontem
    assert.equal(new Date(desde).getUTCHours(), 3, `desde ${out.desde}`);
    assert.ok(Date.now() - desde < 24 * 3600e3 && Date.now() >= desde, `desde ${out.desde} fora das últimas 24 h`);
  } finally { c.limpar(); }
});
