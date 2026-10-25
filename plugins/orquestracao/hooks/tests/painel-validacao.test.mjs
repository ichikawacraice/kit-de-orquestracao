#!/usr/bin/env node
// Testes das validações do painel.mjs (F5/T4): pergunta aberta sem sessaoId, aguarda-voce sem pergunta
// aberta, motivo fora da lista. Nunca toca o painel real (PAINEL_DIR temporário).
// Rodar: node ~/.claude/hooks/tests/painel-validacao.test.mjs   (SCRIPTS_DIR troca a pasta dos scripts)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const SCRIPTS = process.env.SCRIPTS_DIR || join(homedir(), '.claude', 'skills', 'orquestradora', 'scripts');
let base;
let falhas = 0;

function novoBase() {
  base = mkdtempSync(join(tmpdir(), 'painel-val-'));
  mkdirSync(join(base, 'painel'));
  mkdirSync(join(base, 'app')); mkdirSync(join(base, 'orq'));
  // Sessão sintética "própria": registro do app com local_SELF / cli-self (usada nos casos de CLAUDE_CODE_SESSION_ID).
  writeFileSync(join(base, 'app', 'local_SELF.json'), JSON.stringify({ sessionId: 'local_SELF', cliSessionId: 'cli-self', title: 'E1 · x', isArchived: false }));
}
function painel(...args) { return painelComo({}, ...args); }
// `env`: CLAUDE_CODE_SESSION_ID é neutralizada por padrão (a do shell real mudaria o desfecho dos testes).
function painelComo(env, ...args) {
  const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], {
    encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL',
    env: { ...process.env, PAINEL_DIR: join(base, 'painel'), CLAUDE_CODE_SESSION_ID: '', POOL_APP_SESSOES_DIR: join(base, 'app'), HOOKS_CREWAI_BASE: join(base, 'orq'), ...env },
  });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr };
}
const arq = (colecao, id) => join(base, 'painel', colecao, `${id}.json`);
function caso(nome, fn) {
  novoBase();
  try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); }
function ok(cond, msg) { if (!cond) throw new Error(msg); }
function recusa(r, trecho, colecao, id) {
  igual(r.exit, 1, `exit (${r.out})`);
  ok(r.err.includes(trecho), `stderr sem "${trecho}": ${r.err}`);
  ok(!existsSync(arq(colecao, id)), `${colecao}/${id} foi gravado apesar da recusa`);
}

caso('pergunta aberta SEM sessaoId é recusada e nada é gravado', () => {
  recusa(painel('set', 'perguntas', 'Q1', '{"estado":"aberta","titulo":"x"}'), 'sessaoId', 'perguntas', 'Q1');
});
caso('pergunta aberta COM sessaoId passa', () => {
  igual(painel('set', 'perguntas', 'Q1', '{"estado":"aberta","sessaoId":"local_a"}').exit, 0, 'exit');
  ok(existsSync(arq('perguntas', 'Q1')), 'não gravou');
});
caso('pergunta respondida sem sessaoId passa (dado antigo)', () => {
  igual(painel('set', 'perguntas', 'Q2', '{"estado":"respondida","titulo":"x"}').exit, 0, 'exit');
});
caso('aguarda-voce sem `perguntas` é recusado', () => {
  recusa(painel('set', 'sessoes', 'local_a', '{"estado":"aguarda-voce"}'), 'aguarda-voce', 'sessoes', 'local_a');
});
caso('aguarda-voce com `perguntas` vazia é recusado', () => {
  recusa(painel('set', 'sessoes', 'local_a', '{"estado":"aguarda-voce","perguntas":[]}'), 'aguarda-voce', 'sessoes', 'local_a');
});
caso('aguarda-voce com pergunta aberta passa', () => {
  painel('set', 'perguntas', 'Q1', '{"estado":"aberta","sessaoId":"local_a"}');
  igual(painel('set', 'sessoes', 'local_a', '{"estado":"aguarda-voce","perguntas":["Q1"]}').exit, 0, 'exit');
});
caso('aguarda-voce com pergunta respondida é recusado', () => {
  painel('set', 'perguntas', 'Q1', '{"estado":"respondida"}');
  recusa(painel('set', 'sessoes', 'local_a', '{"estado":"aguarda-voce","perguntas":["Q1"]}'), 'respondida', 'sessoes', 'local_a');
});
caso('aguarda-voce com pergunta inexistente é recusado', () => {
  recusa(painel('set', 'sessoes', 'local_a', '{"estado":"aguarda-voce","perguntas":["Q99"]}'), 'Q99', 'sessoes', 'local_a');
});
caso('aguarda-voce com pergunta criada no MESMO batch passa', () => {
  const r = painel('batch', JSON.stringify([
    { op: 'set', colecao: 'perguntas', id: 'Q5', data: { estado: 'aberta', sessaoId: 'local_a' } },
    { op: 'set', colecao: 'sessoes', id: 'local_a', data: { estado: 'aguarda-voce', perguntas: ['Q5'] } },
  ]));
  igual(r.exit, 0, `exit (${r.err})`);
  ok(existsSync(arq('sessoes', 'local_a')) && existsSync(arq('perguntas', 'Q5')), 'não gravou os dois');
});
caso('batch com a pergunta DEPOIS da sessão é recusado e não grava nenhum dos dois', () => {
  const r = painel('batch', JSON.stringify([
    { op: 'set', colecao: 'sessoes', id: 'local_a', data: { estado: 'aguarda-voce', perguntas: ['Q5'] } },
    { op: 'set', colecao: 'perguntas', id: 'Q5', data: { estado: 'aberta', sessaoId: 'local_a' } },
  ]));
  igual(r.exit, 1, 'exit');
  ok(!existsSync(arq('perguntas', 'Q5')), 'a pergunta foi gravada apesar da recusa do batch');
});
caso('parada sem perguntas passa', () => {
  igual(painel('set', 'sessoes', 'local_a', '{"estado":"parada"}').exit, 0, 'exit');
});
caso('update de etapa em quem já está aguarda-voce não revalida (assumida)', () => {
  // dado antigo no disco: aguarda-voce sem perguntas (gravado antes da trava)
  mkdirSync(join(base, 'painel', 'sessoes'));
  writeFileSyncJson(arq('sessoes', 'local_a'), { id: 'local_a', version: 1, data: { estado: 'aguarda-voce' } });
  igual(painel('update', 'sessoes', 'local_a', '{"etapa":"outra linha"}').exit, 0, 'exit');
});
caso('motivo fora da lista é recusado; motivo da lista e null passam', () => {
  recusa(painel('set', 'sessoes', 'local_a', '{"estado":"bloqueada","motivo":"esperando a P3"}'), 'motivo', 'sessoes', 'local_a');
  igual(painel('set', 'sessoes', 'local_a', '{"estado":"bloqueada","motivo":"operador"}').exit, 0, 'motivo da lista');
  igual(painel('update', 'sessoes', 'local_a', '{"motivo":null}').exit, 0, 'motivo null apaga');
  ok(!('motivo' in JSON.parse(readFileSync(arq('sessoes', 'local_a'), 'utf8')).data), 'motivo não foi apagado');
});

function writeFileSyncJson(f, o) { writeFileSync(f, `${JSON.stringify(o)}\n`); }

// --- 5b (24/10): `set`/`delete` em sessoes/<id> de OUTRA sessão exige --de-outra / "deOutra": true ---
const EU = { CLAUDE_CODE_SESSION_ID: 'cli-self' };
const LINHA = '{"titulo":"orquestradora","estado":"trabalhando"}';
const semear = () => { igual(painel('set', 'sessoes', 'local_OUTRA', LINHA).exit, 0, 'semear'); return readFileSync(arq('sessoes', 'local_OUTRA'), 'utf8'); };
const recusouOutra = (r, antes, id = 'local_OUTRA') => {
  igual(r.exit, 1, `exit (${r.out})`);
  ok(r.err.includes('é de outra sessão') && r.err.includes('--de-outra'), `stderr: ${r.err}`);
  igual(readFileSync(arq('sessoes', id), 'utf8'), antes, 'arquivo mudou apesar da recusa');
};
caso('5b (a) set sobre linha existente de outra sessão → recusa, arquivo intacto', () => {
  const antes = semear();
  recusouOutra(painelComo(EU, 'set', 'sessoes', 'local_OUTRA', '{"titulo":"x"}'), antes);
});
caso('5b (b) o mesmo com --de-outra → grava', () => {
  semear();
  igual(painelComo(EU, 'set', 'sessoes', 'local_OUTRA', '{"titulo":"x"}', '--de-outra').exit, 0, 'exit');
  igual(JSON.parse(readFileSync(arq('sessoes', 'local_OUTRA'), 'utf8')).data.titulo, 'x', 'titulo');
});
caso('5b (c) update em linha de outra → grava (mescla, não apaga)', () => {
  semear();
  igual(painelComo(EU, 'update', 'sessoes', 'local_OUTRA', '{"etapa":"y"}').exit, 0, 'exit');
  const d = JSON.parse(readFileSync(arq('sessoes', 'local_OUTRA'), 'utf8')).data;
  ok(d.titulo === 'orquestradora' && d.etapa === 'y', JSON.stringify(d));
});
caso('5b (d) set na própria linha (por local_… e pelo id do CLI) → grava', () => {
  igual(painel('set', 'sessoes', 'local_SELF', LINHA).exit, 0, 'semear própria');
  igual(painelComo(EU, 'set', 'sessoes', 'local_SELF', '{"titulo":"novo"}').exit, 0, 'por local_');
  igual(painel('set', 'sessoes', 'cli-self', LINHA).exit, 0, 'semear por cli');
  igual(painelComo(EU, 'set', 'sessoes', 'cli-self', '{"titulo":"novo2"}').exit, 0, 'por id do CLI');
});
caso('5b (e) delete de outra sem flag → recusa; com --de-outra apaga', () => {
  const antes = semear();
  recusouOutra(painelComo(EU, 'delete', 'sessoes', 'local_OUTRA'), antes);
  igual(painelComo(EU, 'delete', 'sessoes', 'local_OUTRA', '--de-outra').exit, 0, 'com flag');
  ok(!existsSync(arq('sessoes', 'local_OUTRA')), 'não apagou');
});
caso('5b (f) batch com set em linha de outra sem deOutra → recusa o lote inteiro; com deOutra grava', () => {
  const antes = semear();
  const ops = (extra) => JSON.stringify([{ op: 'set', colecao: 'fila', id: 'F9', data: { titulo: 'f' } }, { op: 'set', colecao: 'sessoes', id: 'local_OUTRA', data: { titulo: 'z' }, ...extra }]);
  const r = painelComo(EU, 'batch', ops({}));
  recusouOutra(r, antes);
  ok(!existsSync(arq('fila', 'F9')), 'F9 gravado apesar da recusa do lote');
  igual(painelComo(EU, 'batch', ops({ deOutra: true })).exit, 0, 'com deOutra');
  ok(existsSync(arq('fila', 'F9')), 'F9 não gravado');
});
caso('5b (g) set de linha NOVA (de outra) → grava', () => {
  igual(painelComo(EU, 'set', 'sessoes', 'local_NOVA', LINHA).exit, 0, 'exit');
});
caso('5b (h) sem CLAUDE_CODE_SESSION_ID → grava como hoje; env sem registro → grava e avisa no stderr', () => {
  semear();
  igual(painel('set', 'sessoes', 'local_OUTRA', '{"titulo":"x"}').exit, 0, 'sem env');
  const r = painelComo({ CLAUDE_CODE_SESSION_ID: 'cli-desconhecido' }, 'set', 'sessoes', 'local_OUTRA', '{"titulo":"y"}');
  igual(r.exit, 0, 'env sem registro');
  ok(/não consegui|aviso/i.test(r.err), `sem aviso no stderr: ${r.err}`);
});

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
