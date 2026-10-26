#!/usr/bin/env node
// Testes das validações do painel.mjs (F5/T4): pergunta aberta sem sessaoId, aguarda-voce sem pergunta
// aberta, motivo fora da lista. Nunca toca o painel real (PAINEL_DIR temporário).
// Rodar: node ~/.claude/hooks/tests/painel-validacao.test.mjs   (SCRIPTS_DIR troca a pasta dos scripts)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = process.env.SCRIPTS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
let base;
let falhas = 0;

function novoBase() {
  base = mkdtempSync(join(tmpdir(), 'painel-val-'));
  mkdirSync(join(base, 'painel'));
  writeFileSync(join(base, 'painel', 'temas.json'), JSON.stringify([{ id: 'editor', rotulo: 'Editor' }]));
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
  const ops = (extra) => JSON.stringify([{ op: 'set', colecao: 'fila', id: 'F9', data: { titulo: 'f', etapa: 'planejamento', tema: 'editor' } }, { op: 'set', colecao: 'sessoes', id: 'local_OUTRA', data: { titulo: 'z' }, ...extra }]);
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

// c4 R1/R3/R2: o import do pool-comum que falha e o git que não responde avisam, nomeando o que aconteceu.
function rodarPainel(env, cwd, ...args) {
  const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], {
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', cwd,
    env: { ...process.env, PAINEL_DIR: join(base, 'painel'), CLAUDE_CODE_SESSION_ID: '', POOL_APP_SESSOES_DIR: join(base, 'app'), HOOKS_CREWAI_BASE: join(base, 'orq'), KIT_HOOKS_DIR: '', ...env },
  });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr };
}
caso('c4 R3: pool-comum que não importa → aviso nomeando o caminho tentado (e a proteção desligada), nunca calado', () => {
  const vazio = join(base, 'sem-pool'); mkdirSync(vazio);
  const r = rodarPainel({ CLAUDE_CODE_SESSION_ID: 'cli-self', KIT_HOOKS_DIR: vazio }, base, 'set', 'sessoes', 'local_OUTRA', '{"titulo":"x"}');
  igual(r.exit, 0, `exit (${r.err})`);
  ok(r.err.includes(join(vazio, 'pool-comum.mjs')), `o aviso não nomeia o caminho tentado: ${r.err}`);
  ok(/proteção.*desligada/.test(r.err), `sem o comportamento declarado: ${r.err}`);
});
caso('c4 R3 (controle): com o pool-comum importável não há aviso de import', () => {
  const pasta = join(base, 'com-pool'); mkdirSync(pasta);
  writeFileSync(join(pasta, 'pool-comum.mjs'), "export const registroDaSessao = () => ({ localId: 'local_SELF' });\n");
  const r = rodarPainel({ CLAUDE_CODE_SESSION_ID: 'cli-self', KIT_HOOKS_DIR: pasta }, base, 'set', 'sessoes', 'local_SELF', '{"titulo":"x"}');
  igual(r.exit, 0, `exit (${r.err})`);
  ok(!/não consegui importar/.test(r.err), `aviso de import com o módulo presente: ${r.err}`);
});
caso('c4 R1: o painel.mjs do plugin não cai para ~/.claude/hooks (só vale onde o script mora dentro do plugin)', () => {
  const fonte = readFileSync(join(SCRIPTS, 'painel.mjs'), 'utf8');
  // Decide pelo CAMINHO do script, não pelo texto dele (um fallback reescrito apagaria o texto e o caso sairia calado): no plugin roda sempre; a cópia viva de ~/.claude tem o próprio ~/.claude/hooks como caminho e pula, dizendo por quê.
  if (!SCRIPTS.split(sep).join('/').includes('/plugins/orquestracao/')) { console.log('     (pulado: cópia viva fora de plugins/orquestracao — o caminho dela é o próprio ~/.claude/hooks)'); return; }
  const lar = join(base, 'lar'); mkdirSync(join(lar, '.claude', 'hooks'), { recursive: true });
  writeFileSync(join(lar, '.claude', 'hooks', 'pool-comum.mjs'), "export const registroDaSessao = () => ({ localId: 'local_SELF' });\n");
  const plugin = join(base, 'plugin'); mkdirSync(join(plugin, 'skills', 'orquestradora', 'scripts'), { recursive: true }); mkdirSync(join(plugin, 'hooks'));
  writeFileSync(join(plugin, 'skills', 'orquestradora', 'scripts', 'painel.mjs'), fonte);
  writeFileSync(join(plugin, 'skills', 'orquestradora', 'scripts', 'handoffs.mjs'), readFileSync(join(SCRIPTS, 'handoffs.mjs'), 'utf8')); // módulo vizinho que o painel importa
  const r = spawnSync('node', [join(plugin, 'skills', 'orquestradora', 'scripts', 'painel.mjs'), 'set', 'sessoes', 'local_OUTRA', '{"titulo":"x"}'], {
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', cwd: base,
    env: { ...process.env, HOME: lar, PAINEL_DIR: join(base, 'painel'), CLAUDE_CODE_SESSION_ID: 'cli-self', KIT_HOOKS_DIR: '' },
  });
  igual(r.status, 0, `exit (${r.stderr})`);
  ok(r.stderr.includes(join(plugin, 'hooks', 'pool-comum.mjs')), `não tentou o caminho do plugin: ${r.stderr}`);
});
caso('c4 R2: git que não responde a tempo → "git não respondeu", e não "cwd fora de git"', () => {
  const bin = join(base, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'git'), '#!/bin/sh\nsleep 5\n', { mode: 0o755 });
  const r = rodarPainel({ KIT_GIT_TIMEOUT_MS: '300', PATH: `${bin}:${process.env.PATH}` }, base, 'set', 'sessoes', 'local_X', '{"titulo":"x"}');
  igual(r.exit, 0, `exit (${r.err})`);
  ok(/git não respondeu em 0\.3 s/.test(r.err), `sem o aviso de timeout: ${r.err}`);
  ok(!/cwd fora de git/.test(r.err), `confundiu timeout com fora de git: ${r.err}`);
});
caso('c4 R2: git respondeu que não é repositório → "cwd fora de git"', () => {
  const fora = join(base, 'fora'); mkdirSync(fora);
  const r = rodarPainel({ GIT_CEILING_DIRECTORIES: base }, fora, 'set', 'sessoes', 'local_X', '{"titulo":"x"}');
  igual(r.exit, 0, `exit (${r.err})`);
  ok(/sem projeto \(cwd fora de git\)/.test(r.err), `sem o aviso de fora de git: ${r.err}`);
  ok(!/git não respondeu/.test(r.err), `confundiu fora de git com timeout: ${r.err}`);
});

// F43 · regra de texto: a pergunta que o operador lê cita item como "F13 · <título>", nunca solto.
const PROTOCOLO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'pool', 'protocolo.md');
const pergunta = (campos) => JSON.stringify({ estado: 'aberta', sessaoId: 'local_a', ...campos });
caso('F43: pergunta com "executora do F13" solto é recusada, com campo e número', () => {
  const r = painel('set', 'perguntas', 'Q1', pergunta({ titulo: 'x', caso: 'a executora do F13 está parada' }));
  recusa(r, 'caso', 'perguntas', 'Q1');
  ok(r.err.includes('F13'), `a recusa não diz o número: ${r.err}`);
});
caso('F43: recusa solto em titulo, seNaoDecidir e recomendacao', () => {
  for (const campo of ['titulo', 'seNaoDecidir', 'recomendacao']) {
    const r = painel('set', 'perguntas', 'Q1', pergunta({ [campo]: 'espera o F42 fechar' }));
    recusa(r, campo, 'perguntas', 'Q1');
  }
});
caso('F43: aceita "F13 · SPEC-155 fatia 2" e a menção seguinte só com F13', () => {
  const r = painel('set', 'perguntas', 'Q1', pergunta({ titulo: 'x', caso: 'F13 · SPEC-155 fatia 2 está parado; o F13 espera a V' }));
  igual(r.exit, 0, `exit (${r.err})`);
  ok(existsSync(arq('perguntas', 'Q1')), 'não gravou');
});
caso('F43: pergunta respondida com texto antigo solto não é recusada', () => {
  igual(painel('set', 'perguntas', 'Q2', '{"estado":"respondida","caso":"o F13 parou"}').exit, 0, 'exit');
});
caso('F43: o campo `item` e a fila não ganham a trava (D-b2)', () => {
  igual(painel('set', 'fila', 'F1', '{"titulo":"x","etapa":"execucao","tema":"editor","agora":"espera o F13"}').exit, 0, 'fila');
});
caso('F43: o exemplo do protocolo concorda com a regra do painel', () => {
  const doc = readFileSync(PROTOCOLO, 'utf8');
  const m = doc.match(/<!-- exemplo-item-citado: (.+?) -->/);
  ok(m && m[1].trim().length > 0, 'protocolo sem a marca exemplo-item-citado');
  const certo = m[1].trim();
  ok(/F\d+ · \S/.test(certo), `exemplo não está no formato "F<n> · <título>": ${certo}`);
  igual(painel('set', 'perguntas', 'Q1', pergunta({ caso: certo })).exit, 0, 'o exemplo do protocolo é recusado');
  const solto = certo.replace(/ · [^;.]*/, '');
  ok(solto !== certo && /F\d+/.test(solto), `não montou a versão solta: ${solto}`);
  ok(painel('set', 'perguntas', 'Q3', pergunta({ caso: solto })).exit === 1, 'a versão solta do exemplo foi aceita');
});

caso('respondidaPor é prova do clique no painel: set/update/batch pela linha de comando são recusados', () => {
  igual(painel('set', 'perguntas', 'Q1', '{"estado":"aberta","titulo":"x","sessaoId":"local_a"}').exit, 0, 'preparo');
  for (const args of [['update', 'perguntas', 'Q1', '{"respondidaPor":"painel"}'], ['set', 'perguntas', 'Q2', '{"estado":"respondida","respondidaPor":"painel"}']]) {
    const r = painel(...args);
    igual(r.exit, 1, `exit (${r.out})`); ok(r.err.includes('respondidaPor'), `stderr sem respondidaPor: ${r.err}`);
  }
  ok(!existsSync(arq('perguntas', 'Q2')), 'Q2 foi gravada');
  igual(JSON.parse(readFileSync(arq('perguntas', 'Q1'), 'utf8')).data.respondidaPor, undefined, 'Q1 ganhou respondidaPor');
  const b = painel('batch', JSON.stringify([{ op: 'update', colecao: 'perguntas', id: 'Q1', data: { respondidaPor: 'painel' } }]));
  igual(b.exit, 1, `batch exit (${b.out}${b.err})`); ok(b.err.includes('respondidaPor'), `batch stderr: ${b.err}`);
  igual(painel('update', 'perguntas', 'Q1', '{"estado":"respondida","resposta":"sim"}').exit, 0, 'resposta normal deve passar');
});

const RESP = { estado: 'respondida', titulo: 'limpar · orquestradora', sessaoId: 'local_a', resposta: 'não', respondidaPor: 'painel', respondidaEm: '2026-10-26T01:00:00.000Z', atualizadoEm: '2026-10-26T01:00:00.000Z' };
const gravaComoOPane = (extra = {}) => { mkdirSync(join(base, 'painel', 'perguntas'), { recursive: true }); writeFileSync(arq('perguntas', 'Q1'), JSON.stringify({ id: 'Q1', version: 1, data: { ...RESP, ...extra } })); };
const dado = () => JSON.parse(readFileSync(arq('perguntas', 'Q1'), 'utf8')).data;
caso('respondidaEm também só o pane grava: set/update/batch pela linha de comando são recusados', () => {
  gravaComoOPane();
  const r = painel('update', 'perguntas', 'Q1', '{"respondidaEm":"2099-01-01T00:00:00.000Z"}');
  igual(r.exit, 1, `exit (${r.out})`); ok(r.err.includes('respondidaEm só o pane grava'), `stderr não cita o campo recusado: ${r.err}`);
  igual(dado().respondidaEm, RESP.respondidaEm, 'o respondidaEm mudou');
  igual(painel('set', 'perguntas', 'Q2', '{"estado":"respondida","respondidaEm":"2026-10-26T01:00:00.000Z"}').exit, 1, 'set aceitou');
});
for (const [campo, valor] of [['resposta', 'sim'], ['estado', 'aberta'], ['titulo', 'limpar · orquestradora (outra)'], ['sessaoId', 'local_b']]) {
  caso(`A1/R2: trocar ${campo} pela linha de comando apaga respondidaPor e respondidaEm`, () => {
    gravaComoOPane(); igual(dado().respondidaPor, 'painel', 'precondição: o documento nasce com a prova');
    const r = painel('update', 'perguntas', 'Q1', JSON.stringify({ [campo]: valor }));
    igual(r.exit, 0, `exit (${r.err})`);
    igual(dado()[campo], valor, 'o valor novo foi gravado');
    igual(dado().respondidaPor, undefined, 'respondidaPor sobreviveu'); igual(dado().respondidaEm, undefined, 'respondidaEm sobreviveu');
  });
}
caso('L: regravar estado e resposta com o MESMO valor (fluxo da skill) mantém a prova', () => {
  gravaComoOPane();
  igual(painel('update', 'perguntas', 'Q1', '{"estado":"respondida","resposta":"não"}').exit, 0, 'update');
  igual(dado().respondidaPor, 'painel', 'perdeu respondidaPor'); igual(dado().respondidaEm, RESP.respondidaEm, 'mexeu no respondidaEm');
});
caso('A1b/R1/R3: nota e atualizadoEm não apagam a prova nem mexem no respondidaEm', () => {
  gravaComoOPane();
  igual(painel('update', 'perguntas', 'Q1', '{"nota":"y"}').exit, 0, 'nota');
  igual(painel('update', 'perguntas', 'Q1', '{"atualizadoEm":"2099-01-01T00:00:00.000Z"}').exit, 0, 'atualizadoEm');
  igual(dado().respondidaPor, 'painel', 'apagou sem motivo'); igual(dado().respondidaEm, RESP.respondidaEm, 'o respondidaEm andou');
});

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
