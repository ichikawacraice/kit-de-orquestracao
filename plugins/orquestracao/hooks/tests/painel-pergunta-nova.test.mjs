#!/usr/bin/env node
// F478: `painel perguntas nova '<json>'` reserva o Q-ID, grava a pergunta, relê o arquivo e imprime só o ID; a recusa sai com exit 1
// e não gasta número. E o contrato do `estado` de pergunta: só aberta · assumida · respondida · cancelada (o que a tela mostra).
// HOME, painel e registro do app em pasta temporária: nunca toca o contador nem o painel reais.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = process.env.SCRIPTS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
let base;
let falhas = 0;

function novoBase() {
  base = mkdtempSync(join(tmpdir(), 'painel-nova-'));
  mkdirSync(join(base, 'painel', 'perguntas'), { recursive: true });
  mkdirSync(join(base, 'home', '.claude', 'orquestracao'), { recursive: true });
  mkdirSync(join(base, 'app')); mkdirSync(join(base, 'orq'));
}
const SELF = 'local_00000000-0000-4000-8000-000000000478';
const contadorEm = () => join(base, 'home', '.claude', 'orquestracao', 'contador-de-perguntas');
const contador = (n) => writeFileSync(contadorEm(), `${n}\n`);
const lerContador = () => (existsSync(contadorEm()) ? readFileSync(contadorEm(), 'utf8').trim() : null);
function painel(env, ...args) {
  const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], {
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
    env: {
      ...process.env, HOME: join(base, 'home'), PAINEL_DIR: join(base, 'painel'), CLAUDE_CODE_SESSION_ID: '', ORCA_AGENT_SESSION_ID: '',
      ORCA_STRUCTURED_SESSION: '', CLAUDE_CODE_HOST_SESSION_ID: '', KIT_ANFITRIAO: 'terminal', POOL_APP_SESSOES_DIR: join(base, 'app'), HOOKS_CREWAI_BASE: join(base, 'orq'), ...env,
    },
  });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr };
}
const arq = (id) => join(base, 'painel', 'perguntas', `${id}.json`);
const doc = (id) => JSON.parse(readFileSync(arq(id), 'utf8'));
function caso(nome, fn) {
  novoBase();
  try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); }
function ok(cond, msg) { if (!cond) throw new Error(msg); }

const INTEIRA = { sessaoId: SELF, titulo: 'Nome curto ou longo?', caso: 'A aba mostra o nome da sessão.', seNaoDecidir: 'Fica o longo.', recomendacao: 'O curto: cabe na barra.' };
const json = (o) => JSON.stringify(o);

caso('nova: reserva o próximo Q-ID, grava aberta com o sessaoId e imprime só o ID', () => {
  contador(41);
  const r = painel({}, 'perguntas', 'nova', json(INTEIRA));
  igual(r.exit, 0, `exit (${r.err})`);
  igual(r.out, 'Q42\n', 'stdout é só o ID');
  igual(lerContador(), '42', 'o contador andou um');
  ok(existsSync(arq('Q42')), 'Q42 não foi gravada');
  const d = doc('Q42').data;
  igual(d.estado, 'aberta', 'estado padrão');
  igual(d.sessaoId, SELF, 'sessaoId');
  igual(d.titulo, INTEIRA.titulo, 'titulo');
  igual(doc('Q42').id, 'Q42', 'id do documento');
  ok(/Q42.*Perguntas/.test(r.err), `o stderr diz onde o operador a acha (aberta → Perguntas): ${r.err}`);
  const r2 = painel({}, 'perguntas', 'nova', json({ ...INTEIRA, estado: 'assumida' }));
  ok(/Q43.*Decisões/.test(r2.err) && !/Perguntas/.test(r2.err), `assumida → Decisões: ${r2.err}`);
});

caso('nova: sem contador começa em Q1; duas seguidas não repetem número', () => {
  igual(painel({}, 'perguntas', 'nova', json(INTEIRA)).out, 'Q1\n', 'primeira');
  igual(painel({}, 'perguntas', 'nova', json(INTEIRA)).out, 'Q2\n', 'segunda');
  ok(existsSync(arq('Q1')) && existsSync(arq('Q2')), 'as duas gravadas');
});

caso('nova: a recusa do painel (F<n> solto) sai com exit 1, diz o motivo e NÃO gasta Q-ID', () => {
  contador(41);
  ok(painel({}, 'perguntas', 'nova', json(INTEIRA)).exit === 0, 'precondição: a pergunta inteira grava e gasta um número');
  igual(lerContador(), '42', 'precondição: o contador anda quando grava');
  const r = painel({}, 'perguntas', 'nova', json({ ...INTEIRA, caso: 'A dona do F13 parou.' }));
  igual(r.exit, 1, `exit (${r.out})`);
  ok(r.err.includes('F13') && r.err.includes('solto'), `stderr sem o motivo: ${r.err}`);
  igual(r.out, '', 'stdout vazio na recusa (nenhum ID para usar)');
  igual(lerContador(), '42', 'a recusa não gastou número');
  ok(!existsSync(arq('Q43')), 'Q43 não pode existir');
});

caso('nova: titulo, caso e recomendacao são obrigatórios; seNaoDecidir na aberta; nada reservado', () => {
  contador(10);
  for (const falta of ['titulo', 'caso', 'recomendacao', 'seNaoDecidir']) {
    const o = { ...INTEIRA }; delete o[falta];
    const r = painel({}, 'perguntas', 'nova', json(o));
    igual(r.exit, 1, `sem ${falta}: exit`);
    ok(r.err.includes(falta), `sem ${falta}: stderr não nomeia o campo: ${r.err}`);
  }
  const semSe = { ...INTEIRA, estado: 'assumida' }; delete semSe.seNaoDecidir;
  igual(painel({}, 'perguntas', 'nova', json(semSe)).exit, 0, 'a assumida dispensa seNaoDecidir');
  igual(lerContador(), '11', 'só a que gravou gastou número');
});

caso('nova: estado só aberta ou assumida; JSON com id e argumento a mais recusam', () => {
  contador(10);
  for (const estado of ['respondida', 'aguardando']) {
    const r = painel({}, 'perguntas', 'nova', json({ ...INTEIRA, estado }));
    igual(r.exit, 1, `estado ${estado}: exit`);
    ok(r.err.includes(estado), `estado ${estado}: stderr ${r.err}`);
  }
  igual(painel({}, 'perguntas', 'nova', json({ ...INTEIRA, id: 'Q99' })).exit, 1, 'id no JSON');
  igual(painel({}, 'perguntas', 'nova', json(INTEIRA), 'sobra').exit, 1, 'argumento a mais');
  igual(painel({}, 'perguntas', 'nova').exit, 1, 'sem JSON');
  igual(lerContador(), '10', 'nenhuma recusa gastou número');
});

caso('nova: sem sessaoId usa a sessão que chama; sem como saber, recusa sem gastar número', () => {
  contador(5);
  const semSessao = { ...INTEIRA }; delete semSessao.sessaoId;
  const r = painel({ KIT_ANFITRIAO: 'claude-desktop', CLAUDE_CODE_HOST_SESSION_ID: SELF }, 'perguntas', 'nova', json(semSessao));
  igual(r.exit, 0, `exit no app (${r.err})`);
  igual(doc('Q6').data.sessaoId, SELF, 'sessaoId da sessão que chama, no app');
  const r1 = painel({ KIT_ANFITRIAO: 'orca', ORCA_AGENT_SESSION_ID: 'abc-478' }, 'perguntas', 'nova', json(semSessao));
  igual(r1.exit, 0, `exit no Orca (${r1.err})`);
  igual(doc('Q7').data.sessaoId, 'orca_session_id:abc-478', 'sessaoId da sessão que chama, no Orca');
  igual(doc('Q7').data.endereco?.orca, 'orca_session_id:abc-478', 'no Orca a resposta tem aonde voltar');
  const r2 = painel({}, 'perguntas', 'nova', json(semSessao));
  igual(r2.exit, 1, 'sem sessão conhecida (terminal)');
  ok(r2.err.includes('sessaoId'), `stderr: ${r2.err}`);
  igual(painel({}, 'perguntas', 'nova', json({ ...INTEIRA, sessaoId: 'eu' })).exit, 1, 'sessaoId fora do formato');
  igual(lerContador(), '7', 'as recusas não gastaram número');
});

caso('nova: falha depois de reservar (o Q-ID já tem arquivo) diz qual número ficou sem gravar e não sobrescreve', () => {
  contador(41);
  writeFileSync(arq('Q42'), json({ id: 'Q42', version: 3, data: { ...INTEIRA, estado: 'respondida', titulo: 'a antiga' } }));
  const r = painel({}, 'perguntas', 'nova', json(INTEIRA));
  igual(r.exit, 1, 'exit');
  igual(r.out, '', 'stdout vazio');
  ok(r.err.includes('Q42') && r.err.includes('NÃO foi gravado'), `stderr devia nomear o Q-ID perdido: ${r.err}`);
  igual(doc('Q42').data.titulo, 'a antiga', 'a pergunta que já existia fica');
  igual(painel({}, 'perguntas', 'nova', json(INTEIRA)).out, 'Q43\n', 'a seguinte usa o número seguinte');
});

// ---- o contrato do estado de pergunta ----
caso('estado: set ou update com estado fora de aberta · assumida · respondida · cancelada é recusado', () => {
  const r0 = painel({}, 'set', 'perguntas', 'Q7', json({ ...INTEIRA, estado: 'aberta' }));
  igual(r0.exit, 0, `precondição: aberta grava (${r0.err})`);
  for (const estado of ['aguardando', 'pendente', 'entregue']) {
    const r = painel({}, 'set', 'perguntas', 'Q8', json({ ...INTEIRA, estado }));
    igual(r.exit, 1, `set ${estado}: exit`);
    ok(r.err.includes(estado) && r.err.includes('assumida'), `set ${estado}: stderr devia listar os válidos: ${r.err}`);
    ok(!existsSync(arq('Q8')), `set ${estado}: não grava`);
    igual(painel({}, 'update', 'perguntas', 'Q7', json({ estado })).exit, 1, `update ${estado}: exit`);
  }
  igual(doc('Q7').data.estado, 'aberta', 'Q7 continua aberta');
  for (const estado of ['assumida', 'cancelada']) igual(painel({}, 'update', 'perguntas', 'Q7', json({ estado })).exit, 0, `update ${estado}`);
});

caso('estado: rascunho sem estado segue aceito; ganhar estado fora do contrato depois recusa', () => {
  igual(painel({}, 'set', 'perguntas', 'Q5', json({ titulo: 'rascunho', sessaoId: SELF })).exit, 0, 'rascunho sem estado');
  igual(painel({}, 'update', 'perguntas', 'Q5', json({ estado: 'pendente' })).exit, 1, 'update para estado fora do contrato');
  igual(doc('Q5').data.estado, undefined, 'o update recusado não gravou');
  igual(painel({}, 'update', 'perguntas', 'Q5', json({ estado: 'aberta' })).exit, 0, 'update para aberta');
});

caso('estado: documento antigo com estado fora do contrato aceita update de outro campo', () => {
  writeFileSync(arq('Q3'), json({ id: 'Q3', version: 1, data: { ...INTEIRA, estado: 'entregue', projeto: 'x' } }));
  const r = painel({}, 'update', 'perguntas', 'Q3', json({ nota: 'visto' }));
  igual(r.exit, 0, `update de nota: ${r.err}`);
  igual(doc('Q3').data.estado, 'entregue', 'o estado antigo fica');
  igual(painel({}, 'update', 'perguntas', 'Q3', json({ estado: 'entregue', nota: 'de novo' })).exit, 1, 'regravar o estado fora do contrato recusa');
});

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
