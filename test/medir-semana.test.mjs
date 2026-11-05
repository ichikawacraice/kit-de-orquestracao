// F418: a linha de base semanal (`medir-semana`). Transcripts sintéticos e PRs injetados em pasta temporária; nada lê ~/.claude
// nem chama o `gh`.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { custoDaChamada } from '../scripts/custo-fixo.mjs';
import { classificarTrava, dataDeSP, idDoItem, medirSemana, papelDoTitulo, projetosDe, quantil, relatorioMarkdown } from '../scripts/medir-semana.mjs';

const U = (rd, out = 100) => ({ input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: rd, output_tokens: out });
const resp = (ts, id, model, usage) => ({ type: 'assistant', timestamp: ts, requestId: `r${id}`, message: { id: `m${id}`, model, usage } });
const titulo = (t) => ({ type: 'custom-title', customTitle: t });
const trava = (ts, texto) => ({ type: 'user', isMeta: true, timestamp: ts, message: { role: 'user', content: `Stop hook feedback:\n${texto}` } });
const humano = (ts, texto) => ({ type: 'user', timestamp: ts, message: { role: 'user', content: texto } });
const escrever = (f, linhas) => writeFileSync(f, linhas.map((l) => JSON.stringify(l)).join('\n') + '\n');

const PROJ = projetosDe('/sintetico/casa', { kit: 'kit-de-orquestracao', outro: 'Outro', terceiro: 'Terceiro' });
const KIT = PROJ.kit.prefixo;
const OUTRO = PROJ.outro.prefixo;
const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5-5';
const DENTRO = '2026-11-03T12:00:00.000Z';

describe('medir-semana: peças puras', () => {
  it('quantil: mediana e p90 por posto mais próximo', () => {
    assert.equal(quantil([], 0.5), 0);
    assert.equal(quantil([5], 0.9), 5);
    assert.equal(quantil([4, 1, 3, 2], 0.5), 2.5);
    assert.equal(quantil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9), 9);
  });

  it('papel pelo título e item pelo PR', () => {
    assert.equal(papelDoTitulo('🎛 orquestradora — kit-de-orquestracao'), 'orquestradora');
    assert.deepEqual(papelDoTitulo('F418 · medir a semana'), 'dona');
    assert.equal(papelDoTitulo('Diagnóstico e redesenho'), 'avulsa');
    assert.equal(papelDoTitulo(undefined), 'avulsa');
    assert.equal(idDoItem({ title: 'feat(kit): F418 · medir', headRefName: 'x' }), 'F418');
    assert.equal(idDoItem({ title: 'docs: sem id', headRefName: 'claude/f77-algo' }), 'F77', 'cai para a branch');
    assert.equal(idDoItem({ title: 'docs: sem id', headRefName: 'main' }), null);
    assert.equal(idDoItem({ title: 'fix: sobre o F12', body: 'F99' }), 'F12', 'o corpo não decide');
  });

  it('classifica a trava pela mensagem e deixa o resto em `outras`', () => {
    const m = (x) => classificarTrava(`Stop hook feedback:\n${x}`);
    assert.equal(m('Relatório sem a saída real do comando de critério (cobrança 1 de 2).'), 'criterio-da-dona');
    assert.equal(m('Painel das sessões não atualizado neste turno, e a sessão mudou'), 'painel-das-sessoes');
    assert.equal(m('Você é dona do item F135 (em andamento) e não o atualizou neste turno.'), 'fila-do-item');
    assert.equal(m('Contexto em 352 mil, acima de 350 mil.'), 'contexto-do-papel');
    assert.equal(m('Ritual da orquestradora não feito neste turno.'), 'ritual-da-orquestradora');
    assert.equal(m('O visual do front mudou neste turno e o crítico não rodou.'), 'critico-de-ui');
    assert.equal(m('Você é dona do item F9 (em andamento), mudou algo neste turno e não o gravou.'), 'fila-do-item');
    assert.equal(m('O PR que fecha o item F9 está na fila sem a entrega, que é o que o operador vê.'), 'fila-do-item');
    assert.equal(m('A pergunta deste turno não foi gravada no painel (tirou ID): sem ela o operador não a vê.'), 'painel-das-sessoes');
    assert.equal(m('Seu título ainda diz "livre" e você trabalhou neste turno.'), 'titulo-da-dona');
    assert.equal(m('coisa nova que ninguém conhece'), 'outras');
  });

  it('datas de SP: --desde à meia-noite de SP e --ate inclusivo', () => {
    assert.equal(dataDeSP('2026-10-29').toISOString(), '2026-10-29T03:00:00.000Z');
    assert.equal(dataDeSP('2026-11-05', true).toISOString(), '2026-11-06T03:00:00.000Z');
    assert.equal(dataDeSP('2026-11-05T10:00:00Z').toISOString(), '2026-11-05T10:00:00.000Z');
  });
});

describe('medir-semana: medição', () => {
  const montar = () => {
    const raiz = mkdtempSync(join(tmpdir(), 'medir-semana-'));
    const kit = join(raiz, KIT);
    const iza = join(raiz, OUTRO);
    const outro = join(raiz, `${PROJ.kit.prefixo.replace('kit-de-orquestracao', 'Luna')}`);
    for (const d of [kit, iza, outro, join(kit, 'dona1', 'subagents')]) mkdirSync(d, { recursive: true });
    // Orquestradora do kit: 1 chamada Opus.
    escrever(join(kit, 'orq.jsonl'), [titulo('🎛 orquestradora — kit-de-orquestracao'), resp(DENTRO, 1, OPUS, U(1000))]);
    // Dona F1 do kit: abriu 12:00Z, 2 chamadas Opus, 1 trava do critério e 1 chamada depois dela, subagente validador em Sonnet.
    escrever(join(kit, 'dona1.jsonl'), [
      titulo('F1 · primeiro'),
      humano(DENTRO, 'comece'),
      resp(DENTRO, 2, OPUS, U(2000)),
      resp('2026-11-03T12:10:00.000Z', 3, OPUS, U(3000)),
      trava('2026-11-03T12:20:00.000Z', 'Relatório sem a saída real do comando de critério (cobrança 1 de 2).'),
      resp('2026-11-03T12:21:00.000Z', 4, OPUS, U(4000)),
    ]);
    escrever(join(kit, 'dona1', 'subagents', 'agent-a.jsonl'), [resp('2026-11-03T12:30:00.000Z', 5, SONNET, U(5000))]);
    writeFileSync(join(kit, 'dona1', 'subagents', 'agent-a.meta.json'), JSON.stringify({ agentType: 'orquestracao:validador' }));
    // Outro (worktree): dona F2 fechada e dona F3 aberta; mais uma chamada fora da janela.
    const wt = join(raiz, `${OUTRO}--claude-worktrees-x`);
    mkdirSync(wt, { recursive: true });
    escrever(join(wt, 'dona2.jsonl'), [titulo('F2 · segundo'), resp('2026-11-04T09:00:00.000Z', 6, OPUS, U(6000)), resp('2026-12-30T00:00:00.000Z', 7, OPUS, U(9e6))]);
    escrever(join(iza, 'dona3.jsonl'), [titulo('F3 · terceiro'), resp(DENTRO, 8, OPUS, U(7000))]);
    // Projeto fora da lista: ignorado.
    escrever(join(outro, 'x.jsonl'), [titulo('F9 · de outro'), resp(DENTRO, 9, OPUS, U(8e6))]);
    const prs = {
      kit: [
        { number: 10, title: 'feat: F1 · primeiro', headRefName: 'f1', createdAt: '2026-11-03T13:00:00Z', mergedAt: '2026-11-03T13:30:00Z' },
        { number: 11, title: 'chore: sem id', headRefName: 'x', createdAt: '2026-11-03T13:00:00Z', mergedAt: '2026-11-03T14:00:00Z' },
        { number: 12, title: 'feat: F0 · antigo', headRefName: 'f0', createdAt: '2026-10-01T13:00:00Z', mergedAt: '2026-10-01T14:00:00Z' },
      ],
      outro: [{ number: 20, title: 'feat: F2 · segundo', headRefName: 'f2', createdAt: '2026-11-04T10:00:00Z', mergedAt: '2026-11-04T10:10:00Z' }],
      terceiro: [],
    };
    return { raiz, prs };
  };
  const janela = { desde: dataDeSP('2026-10-29'), ate: dataDeSP('2026-11-05', true) };

  it('tokens e US$ por papel e por modelo, só dentro da janela e só nos projetos do kit', () => {
    const { raiz, prs } = montar();
    try {
      const r = medirSemana({ pasta: raiz, prs, projetos: PROJ, ...janela });
      const c = (id, modelo, rd) => custoDaChamada(U(rd), modelo);
      assert.equal(r.papeis.orquestradora.chamadas, 1);
      assert.ok(Math.abs(r.papeis.orquestradora.usd - c(1, OPUS, 1000)) < 1e-12);
      assert.equal(r.papeis.dona.chamadas, 5, 'F1 (3) + F2 dentro da janela (1) + F3 (1); a de dezembro e a do Luna ficam fora');
      assert.ok(Math.abs(r.papeis.dona.usd - [2000, 3000, 4000, 6000, 7000].reduce((s, x) => s + c(0, OPUS, x), 0)) < 1e-12);
      assert.equal(r.papeis.dona.porModelo.opus.chamadas, 5);
      assert.equal(r.papeis.dona.porModelo.opus.tokens.cacheRead, 22000);
      assert.equal(r.papeis.subagente.porModelo.sonnet.chamadas, 1);
      assert.equal(r.papeis.subagente.porTipo['orquestracao:validador'].chamadas, 1);
      assert.equal(r.papeis.subagente.porTipo['orquestracao:validador'].rodadas, 1);
      assert.ok(r.total.usd > 0);
      assert.ok(Math.abs(r.total.usd - Object.values(r.papeis).reduce((s, p) => s + p.usd, 0)) < 1e-12, 'o total é a soma dos papéis');
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });

  it('custo por item fechado: dona + subagentes, só os itens com PR mergeado na janela', () => {
    const { raiz, prs } = montar();
    try {
      const r = medirSemana({ pasta: raiz, prs, projetos: PROJ, ...janela });
      assert.equal(r.itens.fechados, 2, 'F1 e F2; F0 mergeou antes da janela, F3 não fechou');
      const f1 = r.itens.lista.find((i) => i.item === 'F1');
      assert.equal(f1.projeto, 'kit');
      const esperado = [2000, 3000, 4000].reduce((s, x) => s + custoDaChamada(U(x), OPUS), 0) + custoDaChamada(U(5000), SONNET);
      assert.ok(Math.abs(f1.usd - esperado) < 1e-12, 'a dona mais o subagente do validador');
      assert.equal(r.itens.semItem, 1, 'o PR 11 não cita item');
      assert.ok(r.itens.custo.mediana > 0 && r.itens.custo.p90 >= r.itens.custo.mediana);
      // Tempos: F1 abriu 12:00, PR 13:00, merge 13:30.
      assert.equal(f1.minutos.abertoAtePr, 60);
      assert.equal(f1.minutos.prAteMerge, 30);
      assert.equal(f1.minutos.abertoAteMerge, 90);
      const f2 = r.itens.lista.find((i) => i.item === 'F2');
      assert.equal(f2.minutos.prAteMerge, 10);
      assert.equal(r.itens.tempos.prAteMerge.mediana, 20, 'mediana de 30 e 10');
      assert.equal(r.itens.tempos.porPr.n, 3, 'os 3 PRs mergeados na janela, citando item ou não');
      assert.equal(r.itens.tempos.porPr.porProjeto.kit.mediana, 45, 'PR 10 (30 min) e PR 11 (60 min)');
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });

  it('turnos extras de trava por hook, com o custo do turno que a trava abriu', () => {
    const { raiz, prs } = montar();
    try {
      const r = medirSemana({ pasta: raiz, prs, projetos: PROJ, ...janela });
      assert.equal(r.travas.total, 1);
      assert.equal(r.travas.porHook['criterio-da-dona'].turnos, 1);
      assert.ok(Math.abs(r.travas.porHook['criterio-da-dona'].usd - custoDaChamada(U(4000), OPUS)) < 1e-12);
      assert.equal(r.travas.porPapel.dona, 1);
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });

  it('o Markdown traz as quatro seções; a CLI --json devolve o mesmo objeto', () => {
    const { raiz, prs } = montar();
    try {
      const md = relatorioMarkdown(medirSemana({ pasta: raiz, prs, projetos: PROJ, ...janela }));
      for (const s of ['## Por papel', '## Custo por item fechado', '## Turnos extras de trava', '## Tempo até o merge']) assert.ok(md.includes(s), s);
      const arq = join(raiz, 'prs.json');
      writeFileSync(arq, JSON.stringify(prs));
      const cli = (extra) => spawnSync(process.execPath, ['scripts/medir-semana.mjs', '--desde', '2026-10-29', '--ate', '2026-11-05', '--pasta', raiz, '--prs', arq, '--sem-piso', ...extra], { encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL' });
      const j = cli(['--json']);
      assert.equal(j.status, 0, j.stderr);
      assert.equal(JSON.parse(j.stdout).itens.fechados, 2);
      const m = cli([]);
      assert.equal(m.status, 0, m.stderr);
      assert.ok(m.stdout.includes('## Por papel'));
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });
});
