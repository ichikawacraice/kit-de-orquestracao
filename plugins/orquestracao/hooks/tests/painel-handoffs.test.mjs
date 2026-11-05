#!/usr/bin/env node
// Testes do handoff arquivado ao fechar o item e da limpeza dos arquivados (painel.mjs + handoffs.mjs).
// Nunca toca o painel nem os handoffs reais: PAINEL_DIR, PAINEL_HANDOFFS_DIR e HOME são pastas temporárias.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, utimesSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = process.env.SCRIPTS_DIR || join(AQUI, '..', '..', 'skills', 'orquestradora', 'scripts');
const TEMAS = JSON.stringify([{ id: 'editor', rotulo: 'Editor' }]);
const DIA = 86_400_000;
let base; let hand; let falhas = 0;
let semEnvDaPasta = false; // true: não passa PAINEL_HANDOFFS_DIR (a pasta sai do PAINEL_DIR ou do HOME)

function novoBase() {
  base = mkdtempSync(join(tmpdir(), 'painel-handoffs-'));
  mkdirSync(join(base, 'painel')); mkdirSync(join(base, 'home'));
  writeFileSync(join(base, 'painel', 'temas.json'), TEMAS);
  hand = join(base, 'handoffs');
  mkdirSync(hand);
}
function painel(...args) {
  const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], {
    encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL',
    env: { ...process.env, KIT_FECHAR_DECLARADO: '1', PAINEL_DIR: join(base, 'painel'), PAINEL_HANDOFFS_DIR: semEnvDaPasta ? '' : hand, CLAUDE_CODE_SESSION_ID: '', HOME: join(base, 'home') },
  });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr };
}
function caso(nome, fn) {
  novoBase();
  try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); }
function ok(cond, msg) { if (!cond) throw new Error(msg); }

const donoA = 'local_00000000-0000-4000-8000-00000000000a';
const item = (extra = {}) => JSON.stringify({ titulo: 'Item', etapa: 'execucao', tema: 'editor', donoLocalId: donoA, donoApelido: 'E1', ...extra });
const FECHA = '{"etapa":"feito","donoLocalId":null,"donoApelido":null}';
const toque = (...nomes) => nomes.forEach((n) => writeFileSync(join(hand, n), `conteúdo de ${n}\n`));
const ex = (...partes) => existsSync(join(hand, ...partes));
const arq = (n) => ex('arquivo', n);
const criaItem = (id, extra) => { const r = painel('set', 'fila', id, item(extra)); igual(r.exit, 0, `criar ${id} (${r.err})`); };
// item já fechado, com o `feitoEm` de `dias` atrás
const itemFechadoHa = (id, dias) => criaItem(id, { etapa: 'feito', donoLocalId: null, donoApelido: null, feitoEm: new Date(Date.now() - dias * DIA).toISOString() });
const velho = (caminho, dias) => { const t = new Date(Date.now() - dias * DIA); utimesSync(caminho, t, t); };

caso('fechar o item arquiva F7.md, F7-x.md e F7a-x.md; F70.md e painel.png ficam', () => {
  criaItem('F7');
  toque('F7.md', 'F7-plano.md', 'F7a-laudo.md', 'F70.md', 'painel.png');
  for (const n of ['F7.md', 'F7-plano.md', 'F7a-laudo.md', 'F70.md', 'painel.png']) ok(ex(n), `${n} devia existir antes`);
  const r = painel('update', 'fila', 'F7', FECHA);
  igual(r.exit, 0, `update (${r.err})`);
  for (const n of ['F7.md', 'F7-plano.md', 'F7a-laudo.md']) { ok(arq(n), `${n} devia estar em arquivo/`); ok(!ex(n), `${n} devia sair da raiz`); }
  ok(ex('F70.md') && !arq('F70.md'), 'F70.md não é do F7');
  ok(ex('painel.png') && !arq('painel.png'), 'painel.png não é de item');
});

caso('descartado também arquiva', () => {
  criaItem('F7');
  toque('F7.md');
  ok(ex('F7.md'), 'F7.md devia existir antes');
  igual(painel('update', 'fila', 'F7', '{"etapa":"descartado","donoLocalId":null,"donoApelido":null}').exit, 0, 'update');
  ok(arq('F7.md') && !ex('F7.md'), 'F7.md em arquivo/');
});

caso('reabrir (feito → execucao) traz os arquivos de volta', () => {
  criaItem('F7');
  toque('F7.md', 'F7-plano.md');
  igual(painel('update', 'fila', 'F7', FECHA).exit, 0, 'fechar');
  ok(arq('F7.md') && arq('F7-plano.md'), 'devia estar arquivado antes de reabrir');
  const r = painel('update', 'fila', 'F7', JSON.stringify({ etapa: 'execucao', donoLocalId: donoA, donoApelido: 'E1' }));
  igual(r.exit, 0, `reabrir (${r.err})`);
  ok(ex('F7.md') && ex('F7-plano.md'), 'voltaram para a raiz');
  ok(!arq('F7.md') && !arq('F7-plano.md'), 'saíram de arquivo/');
});

caso('destino já existe: o movido ganha sufixo -<timestamp>, nada é sobrescrito', () => {
  criaItem('F7');
  mkdirSync(join(hand, 'arquivo'), { recursive: true });
  writeFileSync(join(hand, 'arquivo', 'F7.md'), 'antigo\n');
  toque('F7.md');
  igual(painel('update', 'fila', 'F7', FECHA).exit, 0, 'update');
  igual(readFileSync(join(hand, 'arquivo', 'F7.md'), 'utf8'), 'antigo\n', 'o antigo seguiu intacto');
  const nomes = readdirSync(join(hand, 'arquivo')).filter((n) => /^F7-\d+\.md$/.test(n));
  igual(nomes.length, 1, `um movido com sufixo (${readdirSync(join(hand, 'arquivo'))})`);
  ok(!ex('F7.md'), 'saiu da raiz');
});

caso('falha ao mover não recusa o update: item fica feito, exit 0, aviso no stderr', () => {
  criaItem('F7');
  rmSync(hand, { recursive: true });
  writeFileSync(hand, 'sou um arquivo, não uma pasta\n'); // PAINEL_HANDOFFS_DIR aponta para um arquivo
  ok(existsSync(hand), 'o arquivo no lugar da pasta existia');
  const r = painel('update', 'fila', 'F7', FECHA);
  igual(r.exit, 0, `exit (${r.err})`);
  igual(JSON.parse(painel('get', 'fila', 'F7').out).data.etapa, 'feito', 'etapa gravada');
  ok(r.err.length > 0, 'aviso no stderr');
});

caso('handoffs arquivar: item feito com arquivo solto vai para arquivo/; item vivo não', () => {
  itemFechadoHa('F7', 1);
  criaItem('F8');
  toque('F7.md', 'F7a-x.md', 'F8.md', 'F70.md');
  ok(ex('F7.md') && ex('F8.md'), 'existiam antes');
  const r = painel('handoffs', 'arquivar');
  igual(r.exit, 0, `exit (${r.err})`);
  const j = JSON.parse(r.out);
  ok(Array.isArray(j.movidos) && j.movidos.length === 2, `movidos: ${r.out}`);
  ok(arq('F7.md') && arq('F7a-x.md'), 'F7 arquivado');
  ok(ex('F8.md') && !arq('F8.md'), 'F8 (vivo) ficou');
  ok(ex('F70.md'), 'F70 sem item fica');
});

caso('handoffs limpar --dias 30: apaga 31 dias, mantém 29; sem item decide pelo mtime', () => {
  itemFechadoHa('F1', 31); itemFechadoHa('F2', 29);
  mkdirSync(join(hand, 'arquivo'), { recursive: true });
  for (const n of ['F1.md', 'F2.md', 'avulso-velho.md', 'avulso-novo.md']) writeFileSync(join(hand, 'arquivo', n), 'x\n');
  velho(join(hand, 'arquivo', 'avulso-velho.md'), 40);
  velho(join(hand, 'arquivo', 'avulso-novo.md'), 2);
  // o mtime de F1/F2 é de agora: só o `feitoEm` do item pode ter decidido
  const r = painel('handoffs', 'limpar', '--dias', '30');
  igual(r.exit, 0, `exit (${r.err})`);
  const j = JSON.parse(r.out);
  ok(j.apagados.length === 2 && j.seco === false, `saída: ${r.out}`);
  ok(!arq('F1.md'), 'F1 (31 dias) apagado'); ok(arq('F2.md'), 'F2 (29 dias) fica');
  ok(!arq('avulso-velho.md'), 'avulso de 40 dias apagado'); ok(arq('avulso-novo.md'), 'avulso de 2 dias fica');
});

caso('handoffs limpar: sem --dias vale 30; --seco lista e não apaga; --dias inválido sai ≠ 0', () => {
  itemFechadoHa('F1', 31);
  mkdirSync(join(hand, 'arquivo'), { recursive: true });
  writeFileSync(join(hand, 'arquivo', 'F1.md'), 'x\n');
  const s = painel('handoffs', 'limpar', '--seco');
  igual(s.exit, 0, `seco (${s.err})`);
  const js = JSON.parse(s.out);
  ok(js.seco === true && js.apagados.length === 1, `lista o que apagaria: ${s.out}`);
  ok(arq('F1.md'), '--seco não apaga');
  for (const ruim of ['0', '-3', 'abc', '1.5', '']) ok(painel('handoffs', 'limpar', '--dias', ruim).exit !== 0, `--dias "${ruim}" devia recusar`);
  ok(arq('F1.md'), 'recusa não apaga');
  const r = painel('handoffs', 'limpar');
  igual(r.exit, 0, `limpar (${r.err})`);
  ok(!arq('F1.md'), 'padrão de 30 dias apagou o de 31');
});

caso('fechar um item limpa sozinho os arquivados com mais de 30 dias', () => {
  itemFechadoHa('F1', 40);
  mkdirSync(join(hand, 'arquivo'), { recursive: true });
  writeFileSync(join(hand, 'arquivo', 'F1.md'), 'x\n');
  criaItem('F7'); toque('F7.md');
  ok(arq('F1.md'), 'o velho existia antes');
  igual(painel('update', 'fila', 'F7', FECHA).exit, 0, 'fechar F7');
  ok(!arq('F1.md'), 'o velho sumiu');
  ok(arq('F7.md'), 'o recém-fechado está arquivado e ficou');
});

caso('sem PAINEL_HANDOFFS_DIR a pasta sai do PAINEL_DIR; o handoff do HOME não é tocado', () => {
  const doHome = join(base, 'home', '.claude', 'orquestracao', 'pool', 'handoffs');
  const doPainel = join(base, 'pool', 'handoffs'); // PAINEL_DIR/../pool/handoffs
  mkdirSync(doHome, { recursive: true }); mkdirSync(doPainel, { recursive: true });
  writeFileSync(join(doHome, 'F7.md'), 'home\n'); writeFileSync(join(doPainel, 'F7.md'), 'painel\n');
  semEnvDaPasta = true;
  try {
    criaItem('F7');
    igual(painel('update', 'fila', 'F7', FECHA).exit, 0, 'fechar');
  } finally { semEnvDaPasta = false; }
  ok(existsSync(join(doHome, 'F7.md')) && !existsSync(join(doHome, 'arquivo')), 'o handoff do HOME ficou e não ganhou arquivo/');
  ok(existsSync(join(doPainel, 'arquivo', 'F7.md')) && !existsSync(join(doPainel, 'F7.md')), 'o da pasta derivada do PAINEL_DIR foi arquivado');
});

caso('fechar item sem handoffs não cria handoffs/ nem arquivo/', () => {
  rmSync(hand, { recursive: true });
  criaItem('F7');
  igual(painel('update', 'fila', 'F7', FECHA).exit, 0, 'fechar');
  ok(!existsSync(hand), 'handoffs/ não foi criada');
});

// Doc × doc × código: o bloco da regra mora em dois arquivos e o prazo, no código.
const bloco = (arquivo) => {
  const t = readFileSync(join(AQUI, '..', '..', arquivo), 'utf8');
  const m = t.match(/<!-- regra-do-handoff-do-item: início[^>]*-->\n([\s\S]*?)\n<!-- regra-do-handoff-do-item: fim -->/);
  return m ? m[1] : null;
};
{
  novoBase();
  try {
    const skill = bloco('skills/handoff-de-sessao/SKILL.md');
    const proto = bloco('pool/protocolo.md');
    ok(skill && skill.trim().length > 0, 'bloco da skill existe e não é vazio');
    ok(proto && proto.trim().length > 0, 'bloco do protocolo existe e não é vazio');
    igual(skill, proto, 'os dois blocos');
    ok(skill !== proto.replace('30 dias', '31 dias'), 'a comparação enxerga um bloco alterado em memória');
    const { DIAS_ARQUIVO } = await import(new URL(`file://${join(SCRIPTS, 'handoffs.mjs')}`).href);
    ok(Number.isInteger(DIAS_ARQUIVO) && DIAS_ARQUIVO > 0, 'DIAS_ARQUIVO exportado');
    const dias = skill.match(/\*\*(\d+) dias\*\*/);
    ok(dias, 'o bloco cita **N dias**');
    igual(Number(dias[1]), DIAS_ARQUIVO, 'dias no bloco × DIAS_ARQUIVO');
    console.log('ok   doc × doc × código');
  } catch (e) { falhas++; console.log(`FAIL doc × doc × código\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
