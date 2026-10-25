#!/usr/bin/env node
// Testes da trava de anúncio (F28, 25/10): a executora não termina o turno anunciando o próximo passo.
// Textos de fechamento reais (E2 "Falta retomar…", E3 "Volto à B2…") como fixture; transcripts sintéticos
// no formato real, log e estado num diretório temporário.
// Rodar: node ~/.claude/hooks/tests/executor-anuncia.test.mjs   (HOOKS_DIR troca a pasta dos hooks)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, utimesSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = process.env.HOOKS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = 'executor-anuncia.mjs';
const SID = 'dddddddd-0000-0000-0000-000000000028';
let base;
let falhas = 0;
let n = 0;

function novoBase() {
  base = mkdtempSync(join(tmpdir(), 'executor-anuncia-'));
  mkdirSync(join(base, 'ativas'));
}
function rodar(hook, evento, extraEnv = {}) {
  const entrada = typeof evento === 'string' ? evento : JSON.stringify(evento);
  const out = execFileSync('node', [join(HOOKS, hook)], {
    input: entrada, encoding: 'utf8',
    // Sem registro do app: a executora é decidida pelo título do transcript, salvo no caso que monta o registro.
    env: { ...process.env, HOOKS_CREWAI_BASE: base, POOL_APP_SESSOES_DIR: join(base, 'sem-registro'), ...extraEnv },
    timeout: 10000, killSignal: 'SIGKILL',
  });
  return out ? JSON.parse(out) : null;
}
function log() {
  const f = join(base, 'hooks-crewai.log');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').map((l) => l.split('\t')) : [];
}
const desfechos = () => log().map((l) => l[3]).join(',');
function caso(nome, fn) {
  novoBase();
  try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); }

let u = 0;
const id = () => `u-${++u}`;
const abertura = (texto, extra = {}) => ({ type: 'user', uuid: id(), message: { role: 'user', content: texto }, ...extra });
const usa = (nome, input, tid) => ({ type: 'assistant', uuid: id(), message: { role: 'assistant', content: [{ type: 'tool_use', id: tid, name: nome, input }] } });
const resultado = (tid, texto) => ({ type: 'user', uuid: id(), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tid, content: texto }] } });
const fala = (texto) => ({ type: 'assistant', uuid: id(), message: { role: 'assistant', content: [{ type: 'text', text: texto }] } });
function transcript(entradas, titulo) {
  const f = join(base, `t${++n}.jsonl`);
  const linhas = entradas.map((e) => JSON.stringify(e));
  if (titulo) linhas.push(JSON.stringify({ type: 'custom-title', customTitle: titulo, sessionId: SID }));
  writeFileSync(f, linhas.join('\n') + '\n');
  return f;
}
const stop = (f, texto, extra = {}) => ({
  session_id: SID, transcript_path: f, cwd: '/r', hook_event_name: 'Stop', stop_hook_active: false,
  last_assistant_message: texto, background_tasks: [], ...extra,
});
// Turno de uma executora que termina com `texto`.
const turno = (texto, titulo = 'exec · fatias do builder') => transcript([abertura('siga o plano'), fala(texto)], titulo);
const bloqueou = (r) => r?.decision === 'block';
const cobra = (texto, extra, titulo) => rodar(HOOK, stop(turno(texto, titulo), texto, extra));
const passa = (texto, msg, extra, titulo) => igual(cobra(texto, extra, titulo), null, msg || texto);

const FALTA = 'Gate verde, PR aberto.\n\nFalta retomar a fatia 3 do builder.';
const VOLTO = 'Fechei a B1.\n\nVolto à B2. Começo pelo plano do painel e sigo pela ordem.';
const AGORA = 'B1 entregue.\n\nAgora começo a B2 (painel de publicação).';

caso('4.1 "Falta retomar a fatia 3 do builder." no fim, sem background: bloqueia e cita o trecho', () => {
  const r = cobra(FALTA);
  if (!bloqueou(r)) throw new Error('não cobrou');
  if (!r.reason.includes('Falta retomar')) throw new Error(`motivo sem o trecho: ${r.reason}`);
  if (!r.reason.includes('cobrança 1 de 2')) throw new Error(`motivo: ${r.reason}`);
  igual(desfechos(), 'cobrou-1', 'log');
});
caso('4.2 "Volto à B2." e "Agora começo a B2" bloqueiam', () => {
  if (!bloqueou(cobra(VOLTO))) throw new Error('"Volto à B2" não cobrou');
  if (!bloqueou(cobra(AGORA, { session_id: 'dddddddd-0000-0000-0000-000000000029' }))) throw new Error('"Agora começo" não cobrou');
});
caso('4.3 com background_tasks passa e loga adiou-esperando-fundo; o 3º turno seguido adiado bloqueia', () => {
  const fundo = { background_tasks: [{ id: 'b1', status: 'running' }] };
  passa(FALTA, '1º turno com fundo', fundo);
  passa(FALTA, '2º turno com fundo', fundo);
  if (!bloqueou(cobra(FALTA, fundo))) throw new Error('3º turno adiado não cobrou');
  igual(desfechos(), 'adiou-esperando-fundo,adiou-esperando-fundo,cobrou-1', 'log');
});
caso('4.4 condição na mesma frase: passa', () => {
  passa('Gate verde.\n\nQuando a F25 estiver no PR, volto aos 5 casos.', 'quando');
  passa('Pronto.\n\nAo ficar livre volto para `E2 · livre`.', 'ao ficar livre');
  passa('Pronto.\n\nSe ninguém decidir: sigo com a máscara.', 'se ninguém');
  igual(desfechos(), '', 'condição não é cobrança nem exceção: nada a registrar');
});
caso('4.5 pergunta ao operador no último parágrafo: passa', () => {
  passa('Há duas migrations.\n\nSigo para a implementação? São duas migrations, uma por tabela.', 'frase com ?');
  passa('Escolhi a opção B.\n\nFaz sentido? Se sim, sigo com ela.', 'pergunta e anúncio condicionado');
  igual(desfechos().replace(/passou-duvida,?/g, ''), '', 'só passou-duvida no log');
});
caso('4.6 negação: "não sigo com nada" passa', () => {
  passa('Até elas chegarem, não sigo com nada.');
});
caso('4.7 "Bloqueado: <motivo>" + "Retomo depois" passa', () => {
  passa('Bloqueado: a fila do gate está com a sessão X até 09:08.\n\nRetomo depois.', 'bloqueado');
  igual(desfechos(), 'passou-duvida', 'log');
});
caso('4.8 declara livre: passa e registra', () => {
  passa('Fechei tudo.\n\nEstou livre (painel `parada`/`livre`, título `E3 · livre`), sigo com ela.', 'livre');
  igual(desfechos(), 'passou-livre', 'log');
});
caso('4.9 anúncio fora do último parágrafo (no meio) passa', () => {
  passa('Sigo com X.\n\nGate: 98 testes verdes, PR #12 aberto, nada pendente.', 'anúncio no meio');
});
caso('4.10 anúncio dentro de bloco de código ou de `inline` passa', () => {
  passa('Relatório.\n\n```\nVolto à B2.\n```', 'bloco');
  passa('Relatório.\n\nA frase `Volto à B2` está no log.', 'inline');
});
caso('4.11 não executora (P3, V1, título livre, sem título) com "Volto à B2." passa calado, sem log', () => {
  for (const titulo of ['P3 · plano do editor', 'V1 · valida o #12', 'conversa livre', null]) {
    igual(cobra(VOLTO, undefined, titulo), null, `título ${titulo}`);
  }
  igual(log().length, 0, 'linhas de log');
});
caso('4.11b executora do pool pelo registro do app (`E3 · …`); `P3 · …` não', () => {
  const app = join(base, 'app'); mkdirSync(app);
  const reg = (sessionId, titulo) => writeFileSync(join(app, `local_${sessionId}.json`), JSON.stringify({ sessionId: `local_${sessionId}`, cliSessionId: sessionId, priorCliSessionIds: [], title: titulo, isArchived: false }));
  const E3 = 'cccccccc-0000-0000-0000-000000000003'; const P3 = 'cccccccc-0000-0000-0000-000000000099';
  reg(E3, 'E3 · histórico das etapas'); reg(P3, 'P3 · plano do editor');
  const env = { POOL_APP_SESSOES_DIR: app };
  const f = transcript([abertura('siga'), fala(VOLTO)]);
  if (!bloqueou(rodar(HOOK, stop(f, VOLTO, { session_id: E3 }), env))) throw new Error('E3 não cobrada');
  igual(rodar(HOOK, stop(f, VOLTO, { session_id: P3 }), env), null, 'P3');
});
caso('4.11c sessão aberta com --agent executor (agent_type sem agent_id) é cobrada', () => {
  if (!bloqueou(cobra(FALTA, { agent_type: 'executor' }, 'conversa livre'))) throw new Error('não cobrou');
});
caso('4.12 três tentativas no mesmo turno: a 3ª passa e loga deixou-passar-apos-2', () => {
  const f = turno(FALTA);
  const ev = stop(f, FALTA);
  if (!bloqueou(rodar(HOOK, ev))) throw new Error('1ª não cobrou');
  const r2 = rodar(HOOK, { ...ev, stop_hook_active: true });
  if (!bloqueou(r2)) throw new Error('2ª não cobrou');
  if (!r2.reason.includes('cobrança 2 de 2')) throw new Error(`motivo: ${r2.reason}`);
  igual(rodar(HOOK, { ...ev, stop_hook_active: true }), null, '3ª');
  igual(desfechos(), 'cobrou-1,cobrou-2,deixou-passar-apos-2', 'log');
});
caso('4.12b cobrou e a executora corrigiu (a próxima mensagem não anuncia): loga corrigiu-apos-cobranca', () => {
  const f = turno(FALTA);
  if (!bloqueou(rodar(HOOK, stop(f, FALTA)))) throw new Error('não cobrou');
  igual(rodar(HOOK, stop(f, 'Fatia 3 feita: 12 testes verdes, commit a1b2c3d.', { stop_hook_active: true })), null, 'corrigiu');
  igual(desfechos(), 'cobrou-1,corrigiu-apos-cobranca', 'log');
});
caso('4.13 Stop vindo de dentro de subagente (agent_id) e SubagentStop são ignorados', () => {
  igual(cobra(VOLTO, { agent_id: 'a1', agent_type: 'executor' }), null, 'agent_id');
  igual(cobra(VOLTO, { hook_event_name: 'SubagentStop', agent_id: 'a1', agent_type: 'executor' }), null, 'SubagentStop');
  igual(log().length, 0, 'linhas de log');
});
caso('4.14 entrada quebrada: sai 0, sem saída, erro no log; transcript que não existe sai calado', () => {
  igual(rodar(HOOK, '{'), null, 'saída');
  igual(log()[0][3], 'erro', 'log');
  igual(rodar(HOOK, stop('/nao/existe.jsonl', VOLTO)), null, 'sem transcript');
});
caso('4.15 executor-criterio e executor-anuncia gravam estado em arquivos diferentes', () => {
  const a = join(base, 'executor-anuncia-estado.json');
  const c = join(base, 'hooks-crewai-estado.json');
  if (!bloqueou(rodar(HOOK, stop(turno(FALTA), FALTA)))) throw new Error('anuncia não cobrou');
  igual(existsSync(a), true, 'estado do anuncia existe');
  igual(existsSync(c), false, 'o anuncia não grava no arquivo do criterio');
  const antes = readFileSync(a, 'utf8');
  // Turno que editou e relata sem a saída do critério: o criterio cobra e grava o estado dele.
  const editou = transcript([abertura('edite a.ts'), usa('Edit', { file_path: '/r/a.ts', old_string: 'a', new_string: 'b' }, 't1'), resultado('t1', 'ok'), fala('Pronto, editei.')], 'exec · fatias do builder');
  if (!bloqueou(rodar('executor-criterio.mjs', stop(editou, 'Pronto, editei.')))) throw new Error('criterio não cobrou');
  igual(existsSync(c), true, 'estado do criterio existe');
  igual(readFileSync(a, 'utf8'), antes, 'o criterio não mexe no arquivo do anuncia');
});
caso('4.16 sem última mensagem no evento: cai para o último texto do transcript', () => {
  const f = turno(FALTA);
  const ev = stop(f, undefined);
  delete ev.last_assistant_message;
  if (!bloqueou(rodar(HOOK, ev))) throw new Error('não cobrou');
});
caso('4.17 relatório com milhares de linhas em branco termina rápido (sem backtracking)', () => {
  const t0 = Date.now();
  passa('Pronto.' + '\n'.repeat(20000) + 'fim', 'fim');
  if (Date.now() - t0 > 5000) throw new Error('lento');
});

// Como no uso real: a executora continua o turno (outro hook, ou a própria cobrança) e o transcript CRESCE
// entre as paradas. Cada rodada acrescenta o feedback (isMeta, não abre turno) e uma saída grande.
const meta = () => abertura('Stop hook feedback:\ncobrança', { isMeta: true });
const grande = (tid) => [usa('Bash', { command: 'cat grande' }, tid), resultado(tid, 'x'.repeat(3 * 1024 * 1024))];
const crescer = (f, ...entradas) => appendFileSync(f, entradas.map((e) => JSON.stringify(e)).join('\n') + '\n');
const reason = (r) => r?.reason?.match(/cobrança \d de 2/)?.[0] ?? 'passou';
caso('4.18 turno maior que a janela lida do fim do transcript, crescendo entre as paradas: 1, 2, passa, passa', () => {
  const f = transcript([abertura('siga o plano'), ...grande('t0'), fala(FALTA)], 'exec · fatias do builder');
  const seq = [];
  for (let i = 1; i <= 4; i++) {
    seq.push(reason(rodar(HOOK, stop(f, FALTA, { stop_hook_active: i > 1 }))));
    crescer(f, meta(), ...grande(`t${i}`), fala(FALTA));
  }
  igual(seq.join(','), 'cobrança 1 de 2,cobrança 2 de 2,passou,passou', 'paradas');
  igual(desfechos(), 'cobrou-1,cobrou-2,deixou-passar-apos-2,passou-esgotado', 'log');
});
caso('4.19 esgotado vale pelo turno: 4 paradas com o transcript pequeno crescendo também dão 1, 2, passa, passa', () => {
  const f = turno(FALTA);
  const seq = [];
  for (let i = 1; i <= 4; i++) {
    seq.push(reason(rodar(HOOK, stop(f, FALTA, { stop_hook_active: i > 1 }))));
    crescer(f, meta(), fala(FALTA));
  }
  igual(seq.join(','), 'cobrança 1 de 2,cobrança 2 de 2,passou,passou', 'paradas');
});
caso('4.20 par anuncia + criterio defasados (a executora edita depois da 1ª cobrança): a sessão sai em até 4 paradas', () => {
  const TXT = 'Editei o painel.\n\nVolto à B2.';
  const f = transcript([abertura('siga'), fala(TXT)], 'exec · x');
  const parada = (hook, ativo) => reason(rodar(hook, stop(f, TXT, { stop_hook_active: ativo })));
  let saiu = 0;
  for (let i = 1, ativo = false; i <= 10 && !saiu; i++, ativo = true) {
    const a = parada(HOOK, ativo); const c = parada('executor-criterio.mjs', ativo);
    if (a === 'passou' && c === 'passou') saiu = i;
    else crescer(f, meta(), ...(i === 1 ? [usa('Edit', { file_path: '/r/a.ts', old_string: 'a', new_string: 'b' }, 'te'), resultado('te', 'ok')] : []), fala(TXT));
  }
  if (!saiu || saiu > 4) throw new Error(`a sessão ${saiu ? `só saiu na parada ${saiu}` : 'ficou presa em 10 paradas'}`);
});
caso('4.21 "aguardo" em frase separada e "Bloqueado:" em linha própria destravam; a mensagem diz o que escrever', () => {
  passa('Fechei a B1.\n\nVolto à B2. Aguardo o gate da E3.', 'aguardo em outra frase');
  passa('Fechei a B1.\n\nVolto à B2.\nBloqueado: a fila do gate está com a E3.', 'bloqueado em linha própria', { session_id: 'dddddddd-0000-0000-0000-000000000030' });
  igual(desfechos(), 'passou-espera,passou-duvida', 'log');
  const r = cobra(FALTA, { session_id: 'dddddddd-0000-0000-0000-000000000031' });
  if (!r.reason.includes('motivo numa frase inteira')) throw new Error(`a mensagem não diz o tamanho do motivo: ${r.reason}`);
});
caso('4.22 espera por notificação e condição com nome próprio passam; sem a condição, a mesma frase cobra', () => {
  passa('Gate rodando.\n\nRetomo na notificação.', 'na notificação');
  passa('Escolhi a C.\n\nSe C estiver certa, sigo com o plano.', 'se + nome', { session_id: 'dddddddd-0000-0000-0000-000000000032' });
  if (!bloqueou(cobra('Gate rodando.\n\nRetomo agora.', { session_id: 'dddddddd-0000-0000-0000-000000000033' }))) throw new Error('controle: sem condição devia cobrar');
});
caso('4.23 estado malformado ({"x":null}) não derruba o hook e é limpo na gravação', () => {
  const arq = join(base, 'executor-anuncia-estado.json');
  writeFileSync(arq, JSON.stringify({ x: null, y: 5, z: { em: 'ontem' } }));
  if (!bloqueou(cobra(FALTA))) throw new Error('não cobrou');
  igual(log().some((l) => l[3] === 'erro'), false, 'erro no log');
  const chaves = Object.keys(JSON.parse(readFileSync(arq, 'utf8')));
  igual(chaves.length, 1, `só a chave desta sessão sobra: ${chaves}`);
});
caso('4.24 gravar o estado funde a própria chave com o que já está no arquivo e não deixa tmp', () => {
  const arq = join(base, 'estado.json');
  writeFileSync(arq, JSON.stringify({ outra: { n: 1, em: Date.now() } }));
  const codigo = `import { gravarEstadoDe } from ${JSON.stringify(join(HOOKS, 'hooks-crewai-comum.mjs'))};
    gravarEstadoDe(${JSON.stringify(arq)}, (e) => { e.minha = { n: 1, em: Date.now() }; });`;
  execFileSync('node', ['--input-type=module', '-e', codigo], { timeout: 10000, killSignal: 'SIGKILL' });
  igual(Object.keys(JSON.parse(readFileSync(arq, 'utf8'))).sort().join(','), 'minha,outra', 'chaves');
  igual(readdirSync(base).some((x) => x.endsWith('.tmp')), false, 'sobrou tmp');
});

caso('4.25 estado: 12 processos gravando juntos não perdem chave; lock velho (processo morto) é tomado e removido', () => {
  const arq = join(base, 'estado.json');
  const mod = join(HOOKS, 'hooks-crewai-comum.mjs');
  const um = (k) => `node --input-type=module -e ${JSON.stringify(`import { gravarEstadoDe } from ${JSON.stringify(mod)}; gravarEstadoDe(${JSON.stringify(arq)}, (e) => { e.${k} = { n: 1, em: Date.now() }; });`)}`;
  execFileSync('bash', ['-c', `${Array.from({ length: 12 }, (_, i) => `${um(`k${i}`)} &`).join(' ')} wait`], { timeout: 30000, killSignal: 'SIGKILL' });
  igual(Object.keys(JSON.parse(readFileSync(arq, 'utf8'))).length, 12, 'chaves gravadas');
  igual(readdirSync(base).some((x) => x.endsWith('.lock') || x.endsWith('.tmp')), false, 'sobrou lock ou tmp');
  writeFileSync(`${arq}.lock`, '');
  const velho = new Date(Date.now() - 60000);
  utimesSync(`${arq}.lock`, velho, velho);
  execFileSync('bash', ['-c', um('depois')], { timeout: 30000, killSignal: 'SIGKILL' });
  igual('depois' in JSON.parse(readFileSync(arq, 'utf8')), true, 'gravou com lock velho');
  igual(existsSync(`${arq}.lock`), false, 'lock velho removido');
});

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
