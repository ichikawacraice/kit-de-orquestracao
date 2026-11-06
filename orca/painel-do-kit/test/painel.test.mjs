// Núcleo da aba do kit no Orca (F436): leitura das perguntas e gravação da resposta com a prova do clique do operador.
// Nunca toca o ~/.claude real: cada caso usa um painel em diretório temporário.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  lerPerguntas, gravarResposta, confirmarTodas, desfazerConfirmacao, gravarEntregaDaResposta, RecusaDoPainel,
  RESPOSTA_DE_CONFIRMACAO, ORIGEM, textoDaEntrega, textoDaMudanca,
} from '../src/nucleo/painel.mjs';

const novoPainel = () => { const p = mkdtempSync(join(tmpdir(), 'f436-painel-')); mkdirSync(join(p, 'perguntas'), { recursive: true }); return p; };
const pergunta = (p, id, data, version = 1) => writeFileSync(join(p, 'perguntas', `${id}.json`), `${JSON.stringify({ id, version, data }, null, 2)}\n`);
const doc = (p, id) => JSON.parse(readFileSync(join(p, 'perguntas', `${id}.json`), 'utf8'));
const AGORA = '2026-11-06T12:00:00.000Z';

test('lê abertas e assumidas com versão e endereço; ignora fechadas e ilegíveis sem quebrar', () => {
  const p = novoPainel();
  pergunta(p, 'Q1', { estado: 'aberta', titulo: 'a', caso: 'c', recomendacao: 'r', seNaoDecidir: 's', item: 'F1', projeto: 'kit', sessaoId: 'x', atualizadoEm: '2026-11-06T10:00:00Z', endereco: { orca: 'dispatch:ctx_abc' } }, 3);
  pergunta(p, 'Q2', { estado: 'assumida', titulo: 'b', recomendacao: 'fiz assim', item: 'F2', projeto: 'kit', atualizadoEm: '2026-11-05T10:00:00Z' });
  pergunta(p, 'Q3', { estado: 'respondida', titulo: 'c' });
  pergunta(p, 'Q4', { estado: 'aberta', titulo: 'endereço ruim', endereco: { orca: "run:x'; rm -rf ~" } });
  writeFileSync(join(p, 'perguntas', 'Q5.json'), '{não é json');
  const r = lerPerguntas(p);
  assert.deepEqual(r.abertas.map((q) => q.id).sort(), ['Q1', 'Q4']);
  assert.deepEqual(r.assumidas.map((q) => q.id), ['Q2']);
  assert.equal(r.ilegiveis, 1);
  const q1 = r.abertas.find((q) => q.id === 'Q1');
  assert.equal(q1.versao, 3);
  assert.equal(q1.endereco, 'dispatch:ctx_abc');
  assert.equal(q1.seNaoDecidir, 's');
  assert.equal(r.abertas.find((q) => q.id === 'Q4').endereco, null, 'endereço que não passa na validação não vira destino');
});

// F448: a pergunta do Orca gravada antes do endereço existir (só com o sessaoId do Orca) ainda tem para onde ir; o
// endereço explícito manda, e o explícito inválido não cai para o sessaoId.
test('sem endereço gravado, o sessaoId do Orca vira o destino; o do app não; o explícito inválido não cai para ele', () => {
  const p = novoPainel();
  pergunta(p, 'Q1', { estado: 'aberta', titulo: 'antiga do Orca', sessaoId: 'orca_session_id:880dae07-91e8-4aae-9a46-0e857a656849' });
  pergunta(p, 'Q2', { estado: 'aberta', titulo: 'do app', sessaoId: 'local_00000000-0000-4000-8000-0000000000a1' });
  pergunta(p, 'Q3', { estado: 'aberta', titulo: 'explícito ruim', sessaoId: 'orca_session_id:abc', endereco: { orca: 'dispatch:a b' } });
  pergunta(p, 'Q4', { estado: 'aberta', titulo: 'sessaoId ruim', sessaoId: "orca_session_id:x'; id" });
  const por = Object.fromEntries(lerPerguntas(p).abertas.map((q) => [q.id, q.endereco]));
  assert.equal(por.Q1, 'orca_session_id:880dae07-91e8-4aae-9a46-0e857a656849');
  assert.equal(por.Q2, null);
  assert.equal(por.Q3, null);
  assert.equal(por.Q4, null);
});

test('pasta sem perguntas devolve listas vazias, sem erro', () => {
  const p = mkdtempSync(join(tmpdir(), 'f436-vazio-'));
  assert.deepEqual(lerPerguntas(p), { abertas: [], assumidas: [], pendentes: [], ilegiveis: 0 });
});

test('grava a resposta byte a byte com a prova do clique (operador-orca), versão + 1, e solta a trava', () => {
  const p = novoPainel();
  pergunta(p, 'Q1', { estado: 'aberta', titulo: 't', sessaoId: 's' }, 2);
  const resposta = `sim, mas "com aspas" e 'simples', $(rm -rf ~) e \`crase\`; ${'$'}HOME \\ fim`;
  const r = gravarResposta(p, { id: 'Q1', versao: 2, esperado: 'aberta', resposta, agora: AGORA });
  assert.deepEqual(r, { id: 'Q1', versao: 3 });
  const d = doc(p, 'Q1');
  assert.equal(d.version, 3);
  assert.equal(d.data.resposta, resposta);
  assert.equal(d.data.estado, 'respondida');
  assert.equal(d.data.respondidaPor, ORIGEM);
  assert.equal(ORIGEM, 'operador-orca');
  assert.equal(d.data.respondidaEm, AGORA);
  assert.equal(d.data.atualizadoEm, AGORA);
  assert.equal(d.data.sessaoId, 's', 'preserva os campos que já existiam');
  assert.ok(!existsSync(join(p, '.trava')), 'a trava do painel ficou presa');
  assert.deepEqual(readdirSync(join(p, 'perguntas')), ['Q1.json'], 'sobrou arquivo temporário');
});

test('recusa se a pergunta mudou (versão ou estado), se sumiu, se a resposta é vazia; nada é gravado', () => {
  const p = novoPainel();
  pergunta(p, 'Q1', { estado: 'aberta', titulo: 't' }, 5);
  const tenta = (o) => assert.throws(() => gravarResposta(p, { id: 'Q1', versao: 5, esperado: 'aberta', resposta: 'x', agora: AGORA, ...o }), RecusaDoPainel);
  tenta({ versao: 4 });
  tenta({ esperado: 'assumida' });
  tenta({ resposta: '   ' });
  tenta({ id: 'Q9' });
  tenta({ id: '../fila/F1' });
  assert.equal(doc(p, 'Q1').version, 5);
  try { gravarResposta(p, { id: 'Q1', versao: 4, esperado: 'aberta', resposta: 'x', agora: AGORA }); } catch (e) { assert.equal(e.codigo, 'mudou'); assert.match(e.message, /mudou/); }
});

test('com a trava do painel ocupada por outro processo vivo, recusa como ocupado sem gravar', () => {
  const p = novoPainel();
  pergunta(p, 'Q1', { estado: 'aberta', titulo: 't' });
  mkdirSync(join(p, '.trava'));
  writeFileSync(join(p, '.trava', 'dono'), `${process.pid}-teste`);
  let erro;
  try { gravarResposta(p, { id: 'Q1', versao: 1, esperado: 'aberta', resposta: 'x', agora: AGORA, esperaMs: 100 }); } catch (e) { erro = e; }
  assert.ok(erro instanceof RecusaDoPainel);
  assert.equal(erro.codigo, 'ocupado');
  assert.equal(doc(p, 'Q1').version, 1);
  assert.ok(existsSync(join(p, '.trava', 'dono')), 'a trava alheia não pode ser tirada');
});

test('confirmar todas grava cada assumida na própria versão e relata as que mudaram', () => {
  const p = novoPainel();
  pergunta(p, 'Q1', { estado: 'assumida', titulo: 'a' }, 1);
  pergunta(p, 'Q2', { estado: 'assumida', titulo: 'b' }, 7);
  pergunta(p, 'Q3', { estado: 'respondida', titulo: 'c' }, 2);
  const r = confirmarTodas(p, [{ id: 'Q1', versao: 1 }, { id: 'Q2', versao: 7 }, { id: 'Q3', versao: 2 }], AGORA);
  assert.deepEqual(r.confirmadas, ['Q1', 'Q2']);
  assert.deepEqual(r.recusadas.map((x) => x.id), ['Q3']);
  for (const id of ['Q1', 'Q2']) {
    const d = doc(p, id).data;
    assert.equal(d.resposta, RESPOSTA_DE_CONFIRMACAO);
    assert.equal(d.respondidaPor, 'operador-orca');
    assert.equal(d.estado, 'respondida');
  }
  assert.equal(doc(p, 'Q2').version, 8);
  assert.deepEqual(r.versoes, { Q1: 2, Q2: 8 }, 'a versão nova de cada confirmada vai ao painel, para o Desfazer');
});

test('desfazer a confirmação volta a decisão a assumida, só se ninguém mexeu depois e só a confirmação desta aba', () => {
  const p = novoPainel();
  pergunta(p, 'Q1', { estado: 'assumida', titulo: 'a', recomendacao: 'fiz assim' });
  pergunta(p, 'Q2', { estado: 'assumida', titulo: 'b' });
  pergunta(p, 'Q3', { estado: 'respondida', titulo: 'c', resposta: 'não', respondidaPor: ORIGEM, estadoAnterior: 'assumida' }, 4);
  const { versoes } = confirmarTodas(p, [{ id: 'Q1', versao: 1 }, { id: 'Q2', versao: 1 }], AGORA);
  pergunta(p, 'Q2', { ...doc(p, 'Q2').data, entregaDaResposta: { estado: 'entregue' } }, 3);
  const r = desfazerConfirmacao(p, [{ id: 'Q1', versao: versoes.Q1 }, { id: 'Q2', versao: versoes.Q2 }, { id: 'Q3', versao: 4 }]);
  assert.deepEqual(r.desfeitas, ['Q1']);
  assert.deepEqual(r.recusadas.map((x) => x.id), ['Q2', 'Q3']);
  const d = doc(p, 'Q1');
  assert.equal(d.version, 3);
  assert.equal(d.data.estado, 'assumida');
  assert.equal(d.data.recomendacao, 'fiz assim');
  for (const campo of ['resposta', 'respondidaPor', 'respondidaEm', 'estadoAnterior']) assert.ok(!(campo in d.data), campo);
  assert.equal(doc(p, 'Q3').data.resposta, 'não', 'resposta escrita não se desfaz por aqui');
  assert.deepEqual(lerPerguntas(p).assumidas.map((q) => q.id), ['Q1']);
});

test('a entrega da resposta fica gravada na pergunta, presa à versão', () => {
  const p = novoPainel();
  pergunta(p, 'Q1', { estado: 'respondida', titulo: 't', resposta: 'x' }, 3);
  const entrega = { estado: 'entregue', via: 'orca', destino: 'dispatch:ctx_a', em: AGORA };
  assert.deepEqual(gravarEntregaDaResposta(p, { id: 'Q1', versao: 3, entrega }), { id: 'Q1', versao: 4 });
  assert.deepEqual(doc(p, 'Q1').data.entregaDaResposta, entrega);
  assert.throws(() => gravarEntregaDaResposta(p, { id: 'Q1', versao: 3, entrega }), RecusaDoPainel);
  assert.throws(() => gravarEntregaDaResposta(p, { id: 'Q1', versao: 4, entrega: { estado: 'talvez', via: 'orca', em: AGORA } }), /estado/);
});

test('os textos que a sessão recebe dizem que a pergunta é dela e trazem a resposta inteira', () => {
  const q = { id: 'Q7', titulo: 'qual pasta', caso: 'x'.repeat(400) };
  const t = textoDaEntrega(q, 'a pasta orca/');
  assert.match(t, /^Q7 — pergunta aberta POR ESTA SESSÃO/);
  assert.match(t, /a pasta orca\//);
  assert.ok(t.includes('pela aba do kit no Orca'));
  assert.ok(t.length < 700, 'o caso longo é cortado');
  const m = textoDaMudanca({ id: 'Q8', titulo: 'deixar como está' }, 'não, conserte agora');
  assert.match(m, /^Q8 — decisão que ESTA sessão assumiu/);
  assert.match(m, /não, conserte agora/);
});

test('pendentes: só as respondidas por esta aba cuja entrega não saiu, com a resposta e o estado de antes', () => {
  const p = novoPainel();
  const base = { estado: 'respondida', titulo: 't', respondidaPor: ORIGEM, resposta: 'sim', estadoAnterior: 'assumida', endereco: { orca: 'run:run_a' } };
  pergunta(p, 'Q1', { ...base, entregaDaResposta: { estado: 'falhou', via: 'orca', em: AGORA, motivo: 'x' } }, 7);
  pergunta(p, 'Q2', { ...base, entregaDaResposta: { estado: 'pendente', via: 'orca', em: AGORA } });
  pergunta(p, 'Q3', { ...base, entregaDaResposta: { estado: 'entregue', via: 'orca', em: AGORA } });
  pergunta(p, 'Q4', { ...base, respondidaPor: 'painel', entregaDaResposta: { estado: 'falhou', via: 'orca', em: AGORA } });
  pergunta(p, 'Q5', { ...base });
  const r = lerPerguntas(p);
  assert.ok(r.pendentes.length > 0);
  assert.deepEqual(r.pendentes.map((q) => q.id).sort(), ['Q1', 'Q2']);
  const q1 = r.pendentes.find((q) => q.id === 'Q1');
  assert.equal(q1.versao, 7);
  assert.equal(q1.resposta, 'sim');
  assert.equal(q1.estadoAnterior, 'assumida');
  assert.equal(q1.entregaDaResposta.estado, 'falhou');
  assert.equal(q1.endereco, 'run:run_a');
});

test('a resposta guarda o estado de antes (aberta ou assumida), para a nova tentativa usar o texto certo', () => {
  const p = novoPainel();
  pergunta(p, 'Q1', { estado: 'assumida', titulo: 'a' });
  gravarResposta(p, { id: 'Q1', versao: 1, esperado: 'assumida', resposta: 'muda', agora: AGORA });
  assert.equal(doc(p, 'Q1').data.estadoAnterior, 'assumida');
});

// A batida do painel move a respondida para `perguntas/arquivo/<projeto>/<AAAA-MM>/` em até 10 min (F183). A entrega que
// ainda não saiu continua à vista e a anotação da entrega acha a pergunta lá.
const arquivar = (p, id, projeto, mes) => {
  const dir = join(p, 'perguntas', 'arquivo', projeto, mes);
  mkdirSync(dir, { recursive: true });
  const de = join(p, 'perguntas', `${id}.json`);
  writeFileSync(join(dir, `${id}.json`), readFileSync(de));
  rmSync(de);
  return join(dir, `${id}.json`);
};

test('pendentes: a respondida que a batida já arquivou continua à vista, só a dos últimos 7 dias', () => {
  const p = novoPainel();
  const base = { estado: 'respondida', titulo: 't', respondidaPor: ORIGEM, resposta: 'sim', estadoAnterior: 'aberta', entregaDaResposta: { estado: 'pendente', via: 'orca', em: AGORA } };
  pergunta(p, 'Q1', { ...base, respondidaEm: '2026-11-06T11:50:00.000Z' }, 4);
  pergunta(p, 'Q2', { ...base, respondidaEm: '2026-10-31T11:00:00.000Z' });
  pergunta(p, 'Q3', { ...base, respondidaEm: '2026-10-20T11:00:00.000Z' });
  arquivar(p, 'Q1', 'kit', '2026-11');
  arquivar(p, 'Q2', 'kit', '2026-10');
  arquivar(p, 'Q3', 'kit', '2026-10');
  assert.equal(existsSync(join(p, 'perguntas', 'Q1.json')), false, 'a pergunta saiu da pasta quente');
  const r = lerPerguntas(p, { agoraMs: Date.parse(AGORA) });
  assert.deepEqual(r.pendentes.map((q) => q.id).sort(), ['Q1', 'Q2']);
  assert.equal(r.pendentes.find((q) => q.id === 'Q1').versao, 4);
});

test('a entrega da resposta é anotada também na pergunta que a batida arquivou durante o envio', () => {
  const p = novoPainel();
  pergunta(p, 'Q1', { estado: 'respondida', titulo: 't', resposta: 'x', projeto: 'kit' }, 3);
  const f = arquivar(p, 'Q1', 'kit', '2026-11');
  const entrega = { estado: 'falhou', via: 'orca', destino: 'dispatch:ctx_a', em: AGORA, motivo: 'x' };
  assert.deepEqual(gravarEntregaDaResposta(p, { id: 'Q1', versao: 3, entrega }), { id: 'Q1', versao: 4 });
  assert.deepEqual(JSON.parse(readFileSync(f, 'utf8')).data.entregaDaResposta, entrega);
  assert.equal(existsSync(join(p, 'perguntas', 'Q1.json')), false, 'não recria a pergunta na pasta quente');
});

test('as opções da pergunta chegam à aba na ordem, sem as que não têm id; o rótulo cai no id', () => {
  const p = novoPainel();
  pergunta(p, 'Q1', { estado: 'aberta', titulo: 'a', opcoes: [{ id: 'gate', label: 'Rodar o gate' }, { label: 'sem id' }, { id: 'esperar' }, { id: 'outra', label: 'Outra' }] });
  pergunta(p, 'Q2', { estado: 'aberta', titulo: 'b' });
  const r = lerPerguntas(p);
  assert.deepEqual(r.abertas.find((q) => q.id === 'Q1').opcoes, [{ id: 'gate', label: 'Rodar o gate' }, { id: 'esperar', label: 'esperar' }, { id: 'outra', label: 'Outra' }]);
  assert.equal(r.abertas.find((q) => q.id === 'Q2').opcoes, null);
});

test('desfazer a confirmação que a batida já arquivou devolve a decisão à pasta quente, como assumida', () => {
  const p = novoPainel();
  pergunta(p, 'Q1', { estado: 'assumida', titulo: 'a', projeto: 'kit' }, 2);
  const { versoes } = confirmarTodas(p, [{ id: 'Q1', versao: 2 }], AGORA);
  const f = arquivar(p, 'Q1', 'kit', '2026-11');
  const r = desfazerConfirmacao(p, [{ id: 'Q1', versao: versoes.Q1 }]);
  assert.deepEqual(r.desfeitas, ['Q1']);
  assert.equal(existsSync(f), false, 'saiu do arquivo');
  assert.equal(doc(p, 'Q1').data.estado, 'assumida');
  assert.deepEqual(lerPerguntas(p).assumidas.map((q) => q.id), ['Q1']);
});
