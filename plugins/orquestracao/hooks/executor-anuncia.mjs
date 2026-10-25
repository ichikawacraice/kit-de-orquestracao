#!/usr/bin/env node
// Stop (F28, 25/10): a executora não termina o turno anunciando o próximo passo.
// Caso: E3 fechou o turno com "Volto à B2" e E2 com "Falta retomar a fatia 3" — nenhuma começou,
// e ficaram 2 h 50 min paradas até o operador notar.
// Recusa o fim do turno quando o ÚLTIMO parágrafo da última mensagem anuncia ("volto à…", "retomo",
// "sigo com…", "falta retomar", "agora começo…") sem condição na mesma frase, e não vale exceção:
// pergunta ao operador (`?` no parágrafo), dúvida devolvida ("Bloqueado: …", "devolvo", "parei"),
// sessão que se declara livre, ou tarefa em background viva (a notificação reabre o turno — no máximo
// 2 turnos seguidos adiados; no 3º cobra, para dev server/Monitor eterno não desligar a trava).
// Quem é executora: o mesmo teste do executor-criterio (`ehExecutora`). Só `Stop`: subagente que termina
// não tem turno seguinte. No máximo 2 cobranças por turno; depois deixa passar e registra.
// Estado em arquivo PRÓPRIO (os Stop hooks rodam em paralelo; arquivo comum perde escrita).
// Erro do hook vai para o log e o turno termina: trava de Stop que quebra não pode prender a sessão.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, registrar, lerEntrada, lerTranscriptDaCauda, textoDe, aberturaDoTurno, lerEstadoDe, gravarEstadoDe } from './hooks-crewai-comum.mjs';
import { ehExecutora } from './pool-comum.mjs';
import { classificar } from './executor-anuncia-regra.mjs';

const HOOK = 'executor-anuncia';
const ESTADO = join(BASE, 'executor-anuncia-estado.json');
const MAX_COBRANCAS = 2;
const MAX_ADIAMENTOS = 2;

// Último texto do assistente no turno atual (quando o evento não traz `last_assistant_message`).
function ultimoTextoDoTurno(entradas, inicio) {
  let ultimo = '';
  for (const e of entradas.slice(inicio + 1)) {
    if (e.type !== 'assistant') continue;
    const t = textoDe(e.message);
    if (t.trim()) ultimo = t;
  }
  return ultimo;
}

function main() {
  const e = lerEntrada();
  if (e.hook_event_name === 'SubagentStop' || e.agent_id) return; // subagente que termina não tem turno seguinte
  const transcript = e.transcript_path;
  if (!transcript || !existsSync(transcript)) return;
  const sessao = e.session_id;
  const estado = lerEstadoDe(ESTADO);
  const prefixo = `${sessao}:principal:`;
  const temEstado = Object.keys(estado).some((k) => k.startsWith(prefixo));

  // Barato primeiro: o Stop roda em TODA sessão, e há transcripts de 100+ MB. O transcript só é
  // lido (e só o fim dele) quando há anúncio a decidir, estado pendente da sessão ou texto a recuperar.
  let entradas = null;
  let texto = typeof e.last_assistant_message === 'string' ? e.last_assistant_message : null;
  if (texto === null) {
    entradas = lerTranscriptDaCauda(transcript);
    texto = ultimoTextoDoTurno(entradas, aberturaDoTurno(entradas).inicio);
  }
  const { tipo, achado } = classificar(texto);
  if (!achado && !temEstado) return;
  if (!ehExecutora(e, transcript)) return;

  entradas ??= lerTranscriptDaCauda(transcript);
  const { abertura } = aberturaDoTurno(entradas);
  const chave = `${prefixo}${abertura?.uuid || 'inicio'}`;
  const pendente = `${prefixo}pendente`;
  if (estado[pendente] && estado[pendente].em < Date.now() - 24 * 3600 * 1000) delete estado[pendente];
  const cobrancas = estado[chave]?.n || 0;
  const encerrar = () => gravarEstadoDe(ESTADO, (s) => { delete s[pendente]; delete s[chave]; });

  if (!achado) {
    if (cobrancas && cobrancas <= MAX_COBRANCAS) registrar(sessao, HOOK, 'corrigiu-apos-cobranca', `cobrancas=${cobrancas}`);
    if (cobrancas || estado[pendente]) encerrar();
    return;
  }

  if (tipo === 'duvida' || tipo === 'espera' || tipo === 'livre') {
    registrar(sessao, HOOK, `passou-${tipo}`, achado.frase);
    encerrar();
    return;
  }
  // Tarefa em background viva: a notificação reabre o turno. Eterna não desliga a trava.
  const adiados = estado[pendente]?.n || 0;
  if (Array.isArray(e.background_tasks) && e.background_tasks.length > 0 && adiados < MAX_ADIAMENTOS) {
    gravarEstadoDe(ESTADO, (s) => { s[pendente] = { n: adiados + 1, em: Date.now() }; });
    registrar(sessao, HOOK, 'adiou-esperando-fundo', achado.frase);
    return;
  }
  if (cobrancas >= MAX_COBRANCAS) {
    // Esgotado vale pelo TURNO, não pela sequência: apagar a chave faria a parada seguinte (outro hook
    // mantendo o turno vivo) recomeçar em 1 e a sessão não sairia nunca (laudo da V3, achado 1).
    registrar(sessao, HOOK, cobrancas > MAX_COBRANCAS ? 'passou-esgotado' : 'deixou-passar-apos-2', achado.frase);
    if (cobrancas === MAX_COBRANCAS) gravarEstadoDe(ESTADO, (s) => { delete s[pendente]; s[chave] = { n: MAX_COBRANCAS + 1, em: Date.now() }; });
    return;
  }

  gravarEstadoDe(ESTADO, (s) => { delete s[pendente]; s[chave] = { n: cobrancas + 1, em: Date.now() }; });
  registrar(sessao, HOOK, `cobrou-${cobrancas + 1}`, achado.frase);
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      `Você anunciou o próximo passo («${achado.frase.slice(0, 160)}») e o turno ia terminar sem começá-lo ` +
      `(cobrança ${cobrancas + 1} de ${MAX_COBRANCAS}). Comece agora. Se está esperando algo (outra sessão, o operador, ` +
      'o gate), escreva o quê numa frase com «aguardo …» ou, em linha própria, «Bloqueado: <motivo numa frase inteira>»; ' +
      'se precisa de decisão, escreva a pergunta terminando em «?».',
  }));
}

try {
  main();
} catch (err) {
  registrar('-', HOOK, 'erro', err?.stack || err);
}
process.exitCode = 0;
