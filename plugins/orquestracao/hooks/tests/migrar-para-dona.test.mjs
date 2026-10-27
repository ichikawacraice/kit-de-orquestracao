// ADR 0011: a migração do estado para o modelo da dona. Pasta temporária no lugar de ~/.claude/orquestracao; nunca toca o real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts', 'migrar-para-dona.mjs');
const { planejar, aplicar } = await import(SCRIPT);

function montar() {
  const raiz = mkdtempSync(join(tmpdir(), 'migrar-dona-'));
  const base = join(raiz, 'orq');
  const fila = join(base, 'painel', 'fila');
  mkdirSync(fila, { recursive: true }); mkdirSync(join(base, 'pool', 'handoffs'), { recursive: true }); mkdirSync(join(base, 'batida'), { recursive: true });
  mkdirSync(join(base, 'painel', 'perguntas'), { recursive: true });
  const item = (id, data) => writeFileSync(join(fila, `${id}.json`), JSON.stringify({ id, version: 7, data }));
  item('F171', { titulo: 'atualizar plugins', etapa: 'planejamento', projeto: 'kit-de-orquestracao', agora: 'congelado', espera: { motivo: 'operador', texto: 'Q457' }, historico: [] });
  item('F50', { titulo: 'editor', etapa: 'execucao', projeto: 'izanagi', donoLocalId: 'local_p', donoApelido: 'P1', com: [{ localId: 'local_e', apelido: 'E1', oQue: 'x' }], fez: [], passaram: [] });
  item('F10', { titulo: 'velho', etapa: 'feito', projeto: 'izanagi' });
  writeFileSync(join(base, 'pool', 'handoffs', 'F50.md'), 'handoff do 50');
  writeFileSync(join(base, 'pool', 'handoffs', 'F50-plano.md'), 'plano do 50');
  writeFileSync(join(base, 'pool', 'handoffs', 'F10.md'), 'handoff do 10');
  // F179: handoff que é pasta (o `F47-backup` de 27/10 parou a migração no `copyFileSync`)
  mkdirSync(join(base, 'pool', 'handoffs', 'F50-backup', 'sub'), { recursive: true });
  writeFileSync(join(base, 'pool', 'handoffs', 'F50-backup', 'sub', 'antigo.md'), 'backup do 50');
  writeFileSync(join(base, 'batida', 'izanagi.json'), '{}');
  writeFileSync(join(base, 'kit-de-orquestracao.md'), '# antigo kit');
  writeFileSync(join(base, 'izanagi.md'), '# antigo izanagi');
  writeFileSync(join(base, 'painel', 'perguntas', 'Q1.json'), '{}');
  const env = { ...process.env, HOME: join(raiz, 'home'), HOOKS_CREWAI_BASE: base, PAINEL_DIR: join(base, 'painel') };
  const rodar = (...args) => spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL', env: { ...process.env, HOME: join(raiz, 'home'), HOOKS_CREWAI_BASE: base, PAINEL_DIR: join(base, 'painel') } });
  return { raiz, base, fila, rodar, env };
}

test('seco (padrão): mostra o plano e não mexe em nada', () => {
  const c = montar();
  try {
    const r = c.rodar();
    assert.equal(r.status, 0, r.stderr);
    const s = JSON.parse(r.stdout);
    assert.equal(s.seco, true);
    assert.deepEqual(s.vivos.map((v) => v.id).sort(), ['F171', 'F50']);
    assert.deepEqual(s.vivos.find((v) => v.id === 'F50').handoffs.sort(), ['F50-backup', 'F50-plano.md', 'F50.md']);
    assert.equal(s.mover.length, 5);
    assert.ok(existsSync(join(c.fila, 'F10.json')) && !existsSync(join(c.base, 'modelo.json')), 'o seco gravou');
  } finally { rmSync(c.raiz, { recursive: true, force: true }); }
});

test('--aplicar: backup com tudo, fila nova só com os vivos no formato da dona, handoffs dos vivos e estado novo', () => {
  const c = montar();
  try {
    const r = c.rodar('--aplicar');
    assert.equal(r.status, 0, r.stderr);
    const s = JSON.parse(r.stdout);
    assert.ok(existsSync(join(s.backup, 'painel', 'fila', 'F10.json')), 'o fechado ficou no backup');
    assert.equal(readFileSync(join(s.backup, 'izanagi.md'), 'utf8'), '# antigo izanagi');
    assert.deepEqual(readdirSync(c.fila).sort(), ['F171.json', 'F50.json']);
    const f50 = JSON.parse(readFileSync(join(c.fila, 'F50.json'), 'utf8'));
    assert.equal(f50.data.via, 'dona');
    for (const k of ['donoLocalId', 'donoApelido', 'com', 'fez', 'passaram']) assert.ok(!(k in f50.data), `${k} ficou`);
    assert.equal(f50.data.etapa, 'execucao');
    assert.match(f50.data.agora, /migrado para o modelo da dona/);
    assert.equal(f50.data.historico.length, 1);
    const f171 = JSON.parse(readFileSync(join(c.fila, 'F171.json'), 'utf8'));
    assert.deepEqual(f171.data.espera, { motivo: 'operador', texto: 'Q457' }, 'a espera do congelado fica');
    assert.deepEqual(readdirSync(join(c.base, 'pool', 'handoffs')).sort(), ['F50-backup', 'F50-plano.md', 'F50.md', 'arquivo']);
    assert.equal(readFileSync(join(c.base, 'pool', 'handoffs', 'F50-backup', 'sub', 'antigo.md'), 'utf8'), 'backup do 50', 'a pasta de handoff veio inteira');
    assert.ok(statSync(join(c.base, 'painel', 'cartoes')).isDirectory(), 'painel/cartoes criada');
    assert.deepEqual(readdirSync(join(c.base, 'batida')), []);
    assert.match(readFileSync(join(c.base, 'izanagi.md'), 'utf8'), /F50 · editor/);
    assert.match(readFileSync(join(c.base, 'kit-de-orquestracao.md'), 'utf8'), /F171 · atualizar plugins/);
    assert.equal(JSON.parse(readFileSync(join(c.base, 'modelo.json'), 'utf8')).modelo, 'dona');
    assert.ok(existsSync(join(c.base, 'painel', 'perguntas', 'Q1.json')), 'perguntas ficam onde estão');
  } finally { rmSync(c.raiz, { recursive: true, force: true }); }
});

// Fotografia da árvore (caminho → conteúdo; pasta → "<dir>") para comparar antes e depois.
function foto(dir, pre = '') {
  const out = {};
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { out[`${pre}${n}/`] = '<dir>'; Object.assign(out, foto(p, `${pre}${n}/`)); }
    else out[`${pre}${n}`] = readFileSync(p, 'utf8');
  }
  return out;
}

test('falha no meio: desfaz tudo e o estado volta ao de antes', () => {
  const c = montar();
  try {
    const antes = foto(c.base);
    assert.ok(Object.keys(antes).length > 10 && antes['painel/fila/F50.json'], 'precondição: a árvore tem o estado montado');
    const plano = planejar({ env: c.env });
    let passos = 0;
    assert.throws(() => aplicar(plano, { aposPasso: (nome) => { passos++; if (nome === 'migrou F50') throw new Error('disco cheio'); } }), (e) => {
      assert.equal(e.desfeito, true); assert.deepEqual(e.ficou, []); assert.match(e.message, /disco cheio/); return true;
    });
    assert.ok(passos > 5, `o erro veio depois de mover e recriar (${passos} passos)`);
    assert.deepEqual(foto(c.base), antes);
  } finally { rmSync(c.raiz, { recursive: true, force: true }); }
});

test('falha no meio que não se desfaz inteira: diz o que ficou e mantém o backup', () => {
  const c = montar();
  try {
    const plano = planejar({ env: c.env });
    const handoffs = join(c.base, 'pool', 'handoffs');
    assert.throws(() => aplicar(plano, { aposPasso: (nome) => {
      // Alguém recria a fila no lugar antigo depois que ela foi movida: a volta dela não cabe.
      if (nome === `moveu ${handoffs}`) { mkdirSync(join(c.fila, 'x'), { recursive: true }); throw new Error('parou'); }
    } }), (e) => {
      assert.equal(e.desfeito, false);
      assert.equal(e.ficou.length, 2, JSON.stringify(e.ficou));
      assert.match(e.ficou[0], /painel\/fila segue em .*migracao-dona-.*painel\/fila/);
      assert.match(e.ficou[1], /backup mantido em/);
      return true;
    });
    assert.ok(existsSync(join(plano.backup, 'painel', 'fila', 'F50.json')), 'o que não voltou continua no backup');
    assert.equal(readFileSync(join(handoffs, 'F50.md'), 'utf8'), 'handoff do 50', 'o que voltou está no lugar');
  } finally { rmSync(c.raiz, { recursive: true, force: true }); }
});

test('--aplicar que falha sai com exitCode 1 e diz desfeito', () => {
  const c = montar();
  try {
    // modelo.json como pasta: gravar o arquivo falha no último passo, depois de tudo feito.
    mkdirSync(join(c.base, 'modelo.json'));
    const antes = foto(c.base);
    const r = c.rodar('--aplicar');
    assert.equal(r.status, 1, r.stderr);
    const s = JSON.parse(r.stdout);
    assert.match(s.falhou, /migração falhou/);
    assert.equal(s.desfeito, true);
    assert.deepEqual(foto(c.base), antes);
  } finally { rmSync(c.raiz, { recursive: true, force: true }); }
});
