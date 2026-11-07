#!/usr/bin/env node
// F181 + F419: start_session com prompt de dona ("dona do F<n>") só passa com título que começa por `F<n> · `; a recusa traz o título certo.
// F419 (ADR 0025): e só com `model` e `effort` explícitos, em sessão `fresh`.
// F477 (ADR 0036): a dona é Opus médio; alto só com a linha `Esforço alto: <gatilho>`; Sonnet e Haiku de dona são recusados.
// Rodar: node --test hooks/tests/titulo-da-dona.test.mjs   (HOME e a pasta do log apontam para diretório temporário)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidir, tituloSugerido, GATILHOS_DO_OPUS } from '../titulo-da-dona.mjs';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = 'mcp__ccd_session__start_session';
const SONNET = { model: 'claude-sonnet-5-5', effort: 'medium' };
const OPUS = { model: 'claude-opus-5-5', effort: 'medium' };
const PROMPT = 'Você é a dona do F181 · Trava que recusa abrir sessão dona sem o ID (projeto kit-de-orquestracao). Leia dona.md ao começar.';

function rodar(entrada) {
  const dir = mkdtempSync(join(tmpdir(), 'titulo-da-dona-'));
  try {
    const r = spawnSync('node', [join(HOOKS, 'titulo-da-dona.mjs')], {
      input: JSON.stringify(entrada), encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
      env: { ...process.env, HOME: dir, HOOKS_CREWAI_BASE: dir, PAINEL_DIR: dir, CLAUDE_CODE_HOST_SESSION_ID: '' },
    });
    const log = existsSync(join(dir, 'hooks-crewai.log')) ? readFileSync(join(dir, 'hooks-crewai.log'), 'utf8') : '';
    return { ...r, log };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('prompt de dona com título que começa por F<n> · passa', () => {
  assert.equal(decidir(TOOL, { title: 'F181 · Trava do título da dona', prompt: PROMPT, ...OPUS }), null);
  const r = rodar({ session_id: 's', tool_name: TOOL, tool_input: { title: 'F181 · Trava do título da dona', prompt: PROMPT, ...OPUS } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.log, /titulo-da-dona\tabriu-opus\tF181 gatilho=- effort=medium/);
});

test('prompt de dona com título sem o ID é recusado, e a recusa traz o título certo', () => {
  const entrada = { title: 'Trava do título da dona', prompt: PROMPT };
  const motivo = decidir(TOOL, entrada);
  assert.ok(typeof motivo === 'string' && motivo.length > 0, 'devia recusar');
  assert.ok(motivo.includes('"F181 · Trava do título da dona"'), `sem o título sugerido: ${motivo}`);
  const r = rodar({ session_id: 's', tool_name: TOOL, tool_input: entrada });
  assert.equal(r.status, 0);
  const s = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(s.hookEventName, 'PreToolUse');
  assert.equal(s.permissionDecision, 'deny');
  assert.ok(s.permissionDecisionReason.includes('F181 · Trava do título da dona'));
  assert.match(r.log, /titulo-da-dona\trecusou/);
});

test('título com outro ID, ou com o ID em formato errado, é recusado e o ID velho sai da sugestão', () => {
  for (const title of ['F180 · Trava do título', 'F181 - Trava do título', 'F181: Trava do título', 'Trava F181 · do título']) {
    const motivo = decidir(TOOL, { title, prompt: PROMPT });
    assert.ok(motivo, `devia recusar "${title}"`);
  }
  assert.equal(tituloSugerido('F181', 'F181 - Trava do título'), 'F181 · Trava do título');
  assert.equal(tituloSugerido('F181', 'F180 · Trava do título'), 'F181 · Trava do título');
  assert.equal(tituloSugerido('F181', '  '), 'F181 · <tema em palavras do produto>');
});

test('o ID é o da frase "você é a dona do", não o de outra dona citada no prompt', () => {
  const prompt = 'Pedido: a dona do F174 abriu sem ID. Contexto do F150. Você é a dona do F181: leia dona.md';
  assert.equal(decidir(TOOL, { title: 'F181 · Trava', prompt, ...OPUS }), null);
  assert.ok(decidir(TOOL, { title: 'F174 · Trava', prompt })?.includes('"F181 · Trava"'), 'devia sugerir o F181');
  assert.equal(decidir(TOOL, { title: 'Investigar gate', prompt: 'Investigue o gate lento; avise a dona do F150 quando terminar.' }), null);
});

test('ID entre crases conta; título só com o ID, sem tema, é recusado', () => {
  assert.ok(decidir(TOOL, { title: 'Trava', prompt: 'Você é a dona do `F181`: leia dona.md' })?.includes('"F181 · Trava"'));
  assert.ok(decidir(TOOL, { title: 'F181 · ', prompt: PROMPT })?.includes('"F181 · <tema em palavras do produto>"'));
});

test('prompt de dona sem título é recusado com o modelo do título', () => {
  const motivo = decidir(TOOL, { prompt: PROMPT });
  assert.ok(motivo?.includes('F181 · '), `devia recusar: ${motivo}`);
});

test('prompt que não é de dona passa, com qualquer título', () => {
  const prompt = 'Investigue por que o gate demora e devolva um laudo.';
  assert.ok(!/dona do F\d/i.test(prompt), 'o insumo não pode ter o marcador de dona');
  assert.equal(decidir(TOOL, { title: 'Gate lento', prompt }), null);
  const r = rodar({ session_id: 's', tool_name: TOOL, tool_input: { title: 'Gate lento', prompt } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('proposal_id sozinho (sem título nem prompt) passa', () => {
  assert.equal(decidir(TOOL, { proposal_id: 'abc123' }), null);
  const r = rodar({ session_id: 's', tool_name: TOOL, tool_input: { proposal_id: 'abc123' } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('outra tool com o marcador no texto passa (só start_session é lida)', () => {
  assert.equal(decidir('SendMessage', { message: PROMPT }), null);
});

test('entrada quebrada não trava: termina em 0 sem decisão', () => {
  const dir = mkdtempSync(join(tmpdir(), 'titulo-da-dona-'));
  try {
    const r = spawnSync('node', [join(HOOKS, 'titulo-da-dona.mjs')], {
      input: '{não é json', encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
      env: { ...process.env, HOME: dir, HOOKS_CREWAI_BASE: dir },
    });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// F419 (ADR 0025): o modelo da dona.
const DONA = { title: 'F181 · Trava do título da dona', prompt: PROMPT };

test('dona sem model, ou sem effort, é recusada com o padrão Opus médio na recusa', () => {
  for (const extra of [{}, { model: 'sonnet' }, { effort: 'medium' }, { model: '', effort: 'medium' }]) {
    const motivo = decidir(TOOL, { ...DONA, ...extra });
    assert.ok(typeof motivo === 'string' && motivo.length > 0, `devia recusar ${JSON.stringify(extra)}`);
    assert.match(motivo, /model/);
    assert.match(motivo, /opus/i, 'a recusa diz o padrão');
    assert.match(motivo, /effort: "medium"/);
  }
  const r = rodar({ session_id: 's', tool_name: TOOL, tool_input: DONA });
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny');
  assert.match(r.log, /titulo-da-dona\trecusou/);
});

test('dona em Sonnet é recusada: a dona planeja e documenta em Opus e a execução vai ao executor', () => {
  for (const model of ['sonnet', 'claude-sonnet-5-5']) {
    for (const effort of ['medium', 'high']) {
      const motivo = decidir(TOOL, { ...DONA, model, effort });
      assert.ok(motivo, `devia recusar ${model} ${effort}`);
      assert.match(motivo, /Opus/);
      assert.match(motivo, /orquestracao:executor/);
      assert.match(motivo, /model: "opus"/);
    }
  }
  const r = rodar({ session_id: 's', tool_name: TOOL, tool_input: { ...DONA, ...SONNET } });
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('dona em Opus médio passa sem linha, pelo id ou pelo alias', () => {
  assert.equal(decidir(TOOL, { ...DONA, model: 'opus', effort: 'medium' }), null);
  assert.equal(decidir(TOOL, { ...DONA, model: 'claude-opus-5-5', effort: 'Medium' }), null);
});

test('dona em Opus alto sem a linha do gatilho é recusada; com a linha da lista, passa e o log diz qual', () => {
  assert.ok(GATILHOS_DO_OPUS.length >= 5, 'lista de gatilhos vazia');
  const semGatilho = decidir(TOOL, { ...DONA, model: 'claude-opus-5-5', effort: 'high' });
  assert.ok(semGatilho, 'Opus alto sem gatilho devia recusar');
  assert.match(semGatilho, /Opus alto sem gatilho nomeado; o padrão é médio/);
  for (const g of GATILHOS_DO_OPUS) assert.ok(semGatilho.includes(g), `a recusa não lista o gatilho ${g}`);
  // gatilho fora da lista não conta
  assert.ok(decidir(TOOL, { ...DONA, prompt: PROMPT + '\nEsforço alto: gosto', model: 'opus', effort: 'high' }));
  for (const g of GATILHOS_DO_OPUS) {
    assert.equal(decidir(TOOL, { ...DONA, prompt: `${PROMPT}\nEsforço alto: ${g} — motivo`, model: 'opus', effort: 'high' }), null, g);
    assert.equal(decidir(TOOL, { ...DONA, prompt: `${PROMPT}\nEsforco alto: ${g}`, model: 'opus', effort: 'high' }), null, `sem acento ${g}`);
    // a linha antiga é sinônimo
    assert.equal(decidir(TOOL, { ...DONA, prompt: `${PROMPT}\nGatilho do Opus: ${g} — motivo`, model: 'opus', effort: 'high' }), null, `antiga ${g}`);
  }
  assert.equal(decidir(TOOL, { ...DONA, prompt: PROMPT + '\nEsforço alto: `segurança`', model: 'opus', effort: 'high' }), null);
  const r = rodar({ session_id: 's', tool_name: TOOL, tool_input: { ...DONA, prompt: PROMPT + '\nEsforço alto: contrato', model: 'opus', effort: 'high' } });
  assert.equal(r.stdout, '');
  assert.match(r.log, /titulo-da-dona\tabriu-opus\t.*gatilho=contrato effort=high/);
});

test('dona em Opus com esforço fora de medium/high (low, xhigh, max) é recusada, mesmo com a linha', () => {
  for (const effort of ['low', 'xhigh', 'max']) {
    const motivo = decidir(TOOL, { ...DONA, prompt: PROMPT + '\nEsforço alto: contrato', model: 'opus', effort });
    assert.ok(motivo, `devia recusar ${effort}`);
    assert.match(motivo, /esforço da dona é medium ou high/);
  }
});

test('dona em Haiku ou em modelo desconhecido é recusada', () => {
  assert.ok(decidir(TOOL, { ...DONA, model: 'haiku', effort: 'low' })?.includes('Haiku só lê; a dona planeja e documenta em Opus'));
  assert.ok(decidir(TOOL, { ...DONA, model: 'gpt-5', effort: 'low' }));
});

test('dona por fork é recusada: o fork herda o modelo e o contexto de quem abre', () => {
  const motivo = decidir(TOOL, { ...DONA, context: 'fork', ...OPUS });
  assert.ok(motivo?.includes('fresh'), `devia recusar o fork: ${motivo}`);
});

test('dona na nuvem passa sem model (lá model e effort não se aplicam) e o log registra', () => {
  assert.equal(decidir(TOOL, { ...DONA, target: 'cloud' }), null);
  const r = rodar({ session_id: 's', tool_name: TOOL, tool_input: { ...DONA, target: 'cloud' } });
  assert.equal(r.stdout, '');
  assert.match(r.log, /titulo-da-dona\tabriu-nuvem/);
});

test('o título errado ainda é a primeira recusa, mesmo com o modelo certo', () => {
  assert.ok(decidir(TOOL, { title: 'Trava', prompt: PROMPT, ...SONNET })?.includes('"F181 · Trava"'));
});

test('sessão que não é dona não é medida: sem model passa', () => {
  assert.equal(decidir(TOOL, { title: 'Gate lento', prompt: 'Investigue o gate lento.' }), null);
});

test('o gatilho vale só como linha própria, também em negrito ou em item de lista; menção em prosa não conta', async () => {
  const { gatilhoDoOpus } = await import('../titulo-da-dona.mjs');
  assert.equal(gatilhoDoOpus('x\n**Gatilho do Opus:** contrato — muda o formato'), 'contrato');
  assert.equal(gatilhoDoOpus('x\n- Gatilho do Opus: **estado** — grava'), 'estado');
  assert.equal(gatilhoDoOpus('x\nGatilho do Opus: decisão'), 'decisao');
  assert.equal(gatilhoDoOpus('x\nEsforço alto: contrato — muda o formato'), 'contrato');
  assert.equal(gatilhoDoOpus('x\nEsforco alto: estado'), 'estado');
  assert.equal(gatilhoDoOpus('x\n**Esforço alto:** seguranca'), 'seguranca');
  assert.equal(gatilhoDoOpus('x\n- Esforço alto: **producao**'), 'producao');
  assert.equal(gatilhoDoOpus('Não há esforço alto: estado, só médio.'), null);
  assert.equal(gatilhoDoOpus('x\nEsforço alto: gosto'), null);
  assert.equal(gatilhoDoOpus('x\n`Gatilho do Opus: contrato — copiada da skill`'), 'contrato');
  assert.equal(gatilhoDoOpus('Não há gatilho do Opus: estado, mas nada grava.'), null);
  assert.equal(gatilhoDoOpus('x\nGatilho do Opus: gosto'), null);
});

test('a lista de gatilhos do código é a mesma da tabela da skill papeis-e-modelos', async () => {
  const { readFileSync } = await import('node:fs');
  const skill = readFileSync(new URL('../../skills/papeis-e-modelos/SKILL.md', import.meta.url), 'utf8');
  const i = skill.indexOf('<a id="gatilhos-do-opus"></a>');
  assert.ok(i >= 0, 'a âncora gatilhos-do-opus sumiu da skill');
  const secao = skill.slice(i, skill.indexOf('<a id=', i + 10));
  const naTabela = [...secao.matchAll(/^\| `([a-z]+)` \|/gm)].map((m) => m[1]);
  assert.ok(naTabela.length > 0, 'a tabela de gatilhos está vazia');
  assert.deepEqual(naTabela, GATILHOS_DO_OPUS);
});

// F438 (ADR 0030): a decisão do modelo é a mesma no Orca, com o papel (dona ou worker) e a sintaxe de bandeira do `orca`.
// Os casos acima ficam como estão: sem o terceiro argumento, o recusaDoModelo devolve o mesmo que antes.
import { recusaDoModelo, MARCA_DE_DONA } from '../titulo-da-dona.mjs';

test('F438: sem papel nem sintaxe, o recusaDoModelo é o do app (texto com `model:` e "sessão dona")', () => {
  const m = recusaDoModelo('F1', { prompt: 'x' });
  assert.ok(m);
  assert.match(m, /sessão dona do F1/);
  assert.match(m, /`model: "opus"`, `effort: "medium"`/);
  assert.equal(recusaDoModelo('F1', OPUS), null);
  assert.ok(recusaDoModelo('F1', SONNET));
});

test('F438/F477: no papel worker Sonnet, Haiku e Opus médio passam; na dona Haiku e Sonnet recusam; Opus alto sem linha recusa nos dois', () => {
  const haiku = { model: 'haiku', effort: 'low', prompt: 'Leia o log.' };
  assert.equal(recusaDoModelo(null, haiku, { papel: 'worker', sintaxe: 'orca' }), null);
  assert.ok(recusaDoModelo('F1', haiku, { papel: 'dona', sintaxe: 'orca' }));
  const sonnet = { model: 'sonnet', effort: 'medium', prompt: 'Faça X.' };
  assert.equal(recusaDoModelo(null, sonnet, { papel: 'worker', sintaxe: 'orca' }), null);
  assert.ok(recusaDoModelo('F1', sonnet, { papel: 'dona', sintaxe: 'orca' }));
  const opus = { model: 'opus', effort: 'high', prompt: 'Faça X.' };
  assert.equal(recusaDoModelo(null, { ...opus, effort: 'medium' }, { papel: 'worker', sintaxe: 'orca' }), null);
  assert.ok(recusaDoModelo(null, opus, { papel: 'worker', sintaxe: 'orca' }));
  assert.ok(recusaDoModelo('F1', opus, { papel: 'dona', sintaxe: 'orca' }));
  assert.equal(recusaDoModelo(null, { ...opus, prompt: 'Faça X.\nGatilho do Opus: estado' }, { papel: 'worker', sintaxe: 'orca' }), null);
  assert.equal(recusaDoModelo('F1', { ...opus, prompt: 'Faça X.\nEsforço alto: estado' }, { papel: 'dona', sintaxe: 'orca' }), null);
  assert.ok(recusaDoModelo(null, { model: 'gpt-5', effort: 'medium', prompt: '' }, { papel: 'worker', sintaxe: 'orca' }));
});

test('F438/F477: na sintaxe do Orca a recusa fala em bandeiras (`--model opus --effort medium`), não em `model:`', () => {
  const m = recusaDoModelo(null, { prompt: 'x' }, { papel: 'worker', sintaxe: 'orca' });
  assert.ok(m);
  assert.match(m, /--model opus --effort medium/);
  assert.match(m, /Esforço alto: <gatilho>/);
  assert.doesNotMatch(m, /`model: "sonnet"`/);
  assert.doesNotMatch(m, /sessão dona/);
});

test('F438: a marca de dona é exportada e acha o item', () => {
  assert.equal(MARCA_DE_DONA.exec('Você é a dona do F438 · Modo Orca')?.[1], 'F438');
  assert.equal(MARCA_DE_DONA.exec('avise a dona do F150'), null);
});
