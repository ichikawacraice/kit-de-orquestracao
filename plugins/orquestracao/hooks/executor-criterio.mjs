#!/usr/bin/env node
// Stop + SubagentStop (Q62, ideia 2 do estudo CrewAI — Task.guardrail + guardrail_max_retries):
// o executor só termina o turno com a SAÍDA REAL do comando de critério no relatório.
// Quem é executor: subagente `executor` (agent_type), sessão aberta com --agent executor,
// sessão cujo título começa com "exec ·", executora do pool (título `E<n> · …` no registro do app) ou
// dona de item `via: "dona"` em execução, validação ou merge (F179; ADR 0011: a dona escreve o código).
// Só cobra turno que editou arquivo — por Edit/Write ou por Bash que grava (57% dos executores
// reais editam só por Bash). Status ("exit=0", "Found 0 errors") e contagem ("98 passed") só valem
// se aparecem na saída real do turno (Bash, Read de .output/.log, Monitor, TaskOutput, notificação).
// No subagente não há adiamento por background: o `background_tasks` do SubagentStop traz o próprio
// agente e as tarefas da mãe (validação de 23/10), e o subagente que termina não tem turno seguinte.
// No fio principal ("exec ·"), o turno que para esperando gate em background adia para o da notificação.
// No fio principal ("exec ·"), no máximo 2 turnos seguidos adiados: dev server/Monitor eterno não desliga a trava.
// Não cobra quem devolve dúvida (pergunta fora de bloco de código que não é título markdown,
// "Bloqueado: <motivo>" abrindo a linha, "devolvo", "parei", "estou bloqueado").
// Saída com "N failed" exige o relatório citar o N junto da falha.
// No máximo 2 cobranças por turno; depois deixa passar e registra. Erro vai para o log e o turno termina.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, registrar, lerEntrada, lerTranscript, semPrefixoDoPlugin, textoDe, conteudoDe, aberturaDoTurno, devolveuDuvida, lerEstadoDe, gravarEstadoDe } from './hooks-crewai-comum.mjs';
import { ehExecutora, registroDaSessao, itensDaDonaComCriterio } from './pool-comum.mjs';

const HOOK = 'executor-criterio';
const ESTADO = join(BASE, 'hooks-crewai-estado.json');
const MAX_COBRANCAS = 2;
const MAX_ADIAMENTOS = 2;
const EDITA = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
// Bash que grava arquivo: sed/perl -i, redireção para arquivo (não /dev/null nem &N), tee, heredoc
// para interpretador, git apply/am, patch. Basta para separar "editou" de "só conferiu".
const BASH_GRAVA = [
  /\b(sed|perl)\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*i/,
  /(^|[^<>&0-9=-])>>?\s*(?!\/dev\/null\b|&)["']?[\w~./$-]/,
  /\btee\b/,
  /\b(python3?|node|ruby)\b[^|;&]*<<-?\s*['"]?\w/,
  /\bgit\s+(apply|am)\b/,
  /\bpatch\b\s+-/,
];
// Caminho de teste: pasta `test/`, `tests/` ou `__tests__/`, ou nome `*.test.*` / `*.spec.*`. O hook só REGISTRA
// que o turno editou um (a validadora acha no log); não cobra nem bloqueia por isso (F36, Q233).
const CAMINHO_DE_TESTE = [/(^|\/)(tests?|__tests__)\//, /\.(test|spec)\.[cm]?[jt]sx?$/];
const ehTeste = (caminho) => CAMINHO_DE_TESTE.some((r) => r.test(caminho));
// Parte o comando em segmentos (`;`, `&&`, `||`, `|`, `&`) e em palavras, respeitando aspas simples e duplas
// (`sed -i 's/x/y/; s/z/w/' a.test.ts` é um comando só). Redireção (`>`, `>>`, `1>`, `2>`) sai das palavras:
// o destino vai em `redirs`; `2>&1` não tem destino.
export function segmentosDoComando(comando) {
  const segmentos = [];
  let palavras = [], redirs = [], palavra = '', temPalavra = false, aspa = '', redirPendente = false, arit = 0;
  const heredocs = [];
  const fechaPalavra = () => {
    if (temPalavra) (redirPendente ? redirs : palavras).push(palavra);
    if (temPalavra) redirPendente = false;
    palavra = ''; temPalavra = false;
  };
  const fechaSegmento = () => {
    fechaPalavra(); redirPendente = false;
    if (palavras.length || redirs.length) segmentos.push({ palavras, redirs });
    palavras = []; redirs = [];
  };
  for (let i = 0; i < comando.length; i++) {
    const c = comando[i];
    if (aspa) {
      if (c === aspa) aspa = '';
      else if (c === '\\' && aspa === '"' && i + 1 < comando.length) palavra += comando[++i];
      else palavra += c;
    } else if (arit > 0) {
      // Dentro de `$(( … ))` o `<<` é deslocamento, não heredoc, e `;`/`|`/`&` não separam comando.
      if (c === '(') arit++; else if (c === ')') arit--;
      palavra += c; temPalavra = true;
    } else if (c === '$' && comando[i + 1] === '(' && comando[i + 2] === '(') { arit = 2; palavra += '$(('; temPalavra = true; i += 2; }
    else if (c === "'" || c === '"') { aspa = c; temPalavra = true; }
    else if (c === '\\' && i + 1 < comando.length) { palavra += comando[++i]; temPalavra = true; }
    else if (/\s/.test(c) && c !== '\n') fechaPalavra();
    else if (c === ';' || c === '|' || c === '&') {
      if (c === '&' && /^\d*$/.test(palavra) && comando[i - 1] === '>') continue;
      fechaSegmento();
    } else if (c === '\n') {
      fechaSegmento();
      // O corpo de um heredoc pendente não é comando: pula as linhas até o delimitador.
      for (const { delim, tabs } of heredocs.splice(0)) {
        let fim = i + 1;
        while (fim <= comando.length) {
          const quebra = comando.indexOf('\n', fim);
          const linha = comando.slice(fim, quebra < 0 ? comando.length : quebra);
          fim = quebra < 0 ? comando.length + 1 : quebra + 1;
          if ((tabs ? linha.replace(/^\t+/, '') : linha) === delim) break;
        }
        i = fim - 1;
      }
    } else if (c === '<' && comando[i + 1] === '<' && comando[i + 2] === '<') {
      // here-string (`<<<`): não abre corpo de heredoc; os três caracteres saem e a palavra seguinte segue normal.
      fechaPalavra(); i += 2;
    } else if (c === '<' && comando[i + 1] === '<') {
      fechaPalavra();
      i += 2;
      const tabs = comando[i] === '-';
      if (tabs) i++;
      while (comando[i] === ' ' || comando[i] === '\t') i++;
      let delim = '', q = '';
      for (; i < comando.length; i++) {
        const d = comando[i];
        if (q) { if (d === q) q = ''; else delim += d; }
        else if (d === "'" || d === '"') q = d;
        else if (/[\s;|&<>()]/.test(d)) break;
        else delim += d;
      }
      i--;
      heredocs.push({ delim, tabs });
    } else if (c === '>') {
      if (temPalavra && /^\d+$/.test(palavra)) { palavra = ''; temPalavra = false; } else fechaPalavra();
      while (comando[i + 1] === '>') i++;
      if (comando[i + 1] === '&') { i++; redirPendente = false; while (/\d|-/.test(comando[i + 1] || '')) i++; }
      else redirPendente = true;
    } else { palavra += c; temPalavra = true; }
  }
  fechaSegmento();
  return segmentos;
}

// Testes que um comando Bash ESCREVE: conta o alvo da escrita, não o caminho citado em qualquer lugar.
// `vitest a.test.ts > log` e `sed -i x src/a.ts && vitest a.test.ts` não editam teste; `echo x > a.test.ts`, `tee`,
// `sed -i`/`perl -i`, `cp`/`mv` para um teste, `rm`, `git checkout -- <teste>` e `git restore <teste>`, sim.
// `git checkout <branch>` / `-b test/foo` e `git switch` não escrevem nada num teste.
export function testesEscritosPor(comando) {
  const achados = new Set();
  const add = (p) => { if (p && ehTeste(p)) achados.add(p); };
  for (const { palavras, redirs } of segmentosDoComando(comando)) {
    redirs.forEach(add);
    const cmd = palavras.findIndex((w) => !/^[A-Za-z_]\w*=/.test(w));
    if (cmd < 0) continue;
    const nome = palavras[cmd].replace(/^.*\//, '');
    const args = palavras.slice(cmd + 1);
    const posicionais = args.filter((a) => !a.startsWith('-'));
    if (nome === 'tee') posicionais.forEach(add);
    else if ((nome === 'sed' || nome === 'perl') && args.some((a) => /^-[a-zA-Z]*i/.test(a))) posicionais.forEach(add);
    else if (nome === 'cp' || nome === 'mv') add(posicionais[posicionais.length - 1]);
    else if (nome === 'rm') posicionais.forEach(add);
    else if (nome === 'git' && args[0] === 'restore' && (!args.some((a) => a === '--staged' || a === '-S') || args.some((a) => a === '--worktree' || a === '-W'))) posicionais.slice(1).forEach(add);
    else if (nome === 'git' && args[0] === 'checkout' && args.includes('--')) args.slice(args.indexOf('--') + 1).forEach(add);
  }
  return [...achados];
}
const SAIDA_DE_TOOL = new Set(['Bash', 'Monitor', 'TaskOutput', 'BashOutput']);

// Status de comando, normalizado para comparar com a saída real.
const STATUS = /\b(?:exit(?:\s*code|\s*status)?\s*[=:]?\s*-?\d+|\w+_EXIT\s*=\s*\d+|(?:test|tests|typecheck|gate|lint|build)\s*=\s*\d+|Found\s+\d+\s+errors?)\b/gi;
const normalizarStatus = (s) => s.toLowerCase().replace(/\bexit(?:\s*code|\s*status)?\s*[=:]?\s*/, 'exit=').replace(/\s+/g, ' ').trim();

function turnoAtual(entradas) {
  const { inicio } = aberturaDoTurno(entradas);
  const turno = entradas.slice(inicio + 1);
  const usos = new Map();
  let editou = false;
  const testes = new Set();
  const fundo = new Set();
  let ultimoTexto = '';
  for (const e of turno) {
    if (e.type !== 'assistant' || !Array.isArray(e.message?.content)) continue;
    for (const c of e.message.content) {
      if (c.type !== 'tool_use') continue;
      usos.set(c.id, c);
      if (EDITA.has(c.name)) {
        editou = true;
        const alvo = String(c.input?.file_path || c.input?.notebook_path || '');
        if (ehTeste(alvo)) testes.add(alvo);
      }
      const comando = c.name === 'Bash' ? String(c.input?.command || '') : '';
      const escritos = comando ? testesEscritosPor(comando) : [];
      if (BASH_GRAVA.some((r) => r.test(comando)) || escritos.length) editou = true;
      for (const alvo of escritos) testes.add(alvo);
      if (c.name === 'Monitor' || c.input?.run_in_background === true) fundo.add(c.id);
    }
    const t = textoDe(e.message);
    if (t.trim()) ultimoTexto = t;
  }
  // A notificação de tarefa em background que abriu o turno traz o status do comando.
  const abertura = entradas[inicio];
  const saidas = abertura?.origin?.kind === 'task-notification' ? [textoDe(abertura.message)] : [];
  let rodou = saidas.length > 0;
  for (const e of turno) {
    if (e.type !== 'user' || !Array.isArray(e.message?.content)) continue;
    for (const c of e.message.content) {
      if (c.type !== 'tool_result') continue;
      const uso = usos.get(c.tool_use_id);
      const lido = uso?.name === 'Read' && /\.(output|log)$/.test(String(uso.input?.file_path || ''));
      if (!uso || !(SAIDA_DE_TOOL.has(uso.name) || lido)) continue;
      saidas.push(conteudoDe(c.content));
      rodou = true;
    }
  }
  // Notificação dentro do turno (no subagente chega como queued_command): traz o status e
  // fecha o fundo que ela cita. Fundo sem notificação = ainda esperando.
  for (const e of turno) {
    const t = e.type === 'user' ? textoDe(e.message) : e.attachment?.type === 'queued_command' ? String(e.attachment.prompt || '') : '';
    if (!t.includes('<task-notification>')) continue;
    saidas.push(t);
    rodou = true;
    for (const m of t.matchAll(/<tool-use-id>([^<]+)<\/tool-use-id>/g)) fundo.delete(m[1]);
  }
  return { chave: abertura?.uuid || 'inicio', editou, testes: [...testes], esperaFundo: fundo.size > 0, rodou, saidas: saidas.join("\n"), lista: saidas, ultimoTexto };
}

// Status do relatório ("exit=0", "Found 0 errors") que aparece igual numa saída do turno.
function statusConfere(relatorio, saidas) {
  const real = saidas.toLowerCase().replace(/\bexit(?:\s*code|\s*status)?\s*[=:]?\s*/g, 'exit=').replace(/\s+/g, ' ');
  for (const m of relatorio.matchAll(STATUS)) {
    const s = normalizarStatus(m[0]);
    // "exit=1" não casa com "exit=10": o status acaba onde acaba o número.
    for (let i = real.indexOf(s); i >= 0; i = real.indexOf(s, i + 1)) {
      if (!/\d/.test(real[i + s.length] || '')) return true;
    }
  }
  return false;
}

// Contagem ("98 passed", "98 testes verdes") vale quando o mesmo número sai, igual, de um
// "N passed"/"N failed" numa saída do turno. Saída com falha exige o relatório admitir a falha.
function resumoConfere(relatorio, saidas) {
  const re = /(\d+)\s+(?:testes?\s+|casos?\s+)?(passaram|verdes|passou|passed|falharam|falhou|vermelhos?|failed)\b/gi;
  for (const m of relatorio.matchAll(re)) {
    const palavra = /^(falh|verm|fail)/i.test(m[2]) ? 'failed' : 'passed';
    if (new RegExp(`(^|\\D)${m[1]}\\s+${palavra}\\b`).test(saidas)) return true;
  }
  return false;
}
// Só a ÚLTIMA saída com contagem conta: o gate vermelho de antes do conserto não é o resultado.
// Admitir a falha é citar um dos números de falha da saída junto da palavra, antes ou depois
// ("2 testes falharam", "falharam 2", "Tests  2 failed" colado): "nenhuma falha nova" usa a palavra e
// esconde o número. Todos os N contam — o vitest diz "Test Files  1 failed" antes de "Tests  2 failed".
// Resíduo aceito: um número qualquer a até 30 caracteres da palavra ("2 dias sem falha") libera.
const escondeFalha = (relatorio, lista) => {
  const ultima = [...lista].reverse().find((s) => /\d+\s+(passed|failed)\b/.test(s)) ?? '';
  const ns = [...ultima.matchAll(/(?:^|\D)([1-9]\d*)\s+failed\b/g)].map((m) => m[1]);
  if (!ns.length) return false;
  // O status ("exit=1") sai do texto antes: o 1 dele não é o número de falhas.
  const texto = relatorio.replace(STATUS, ' ');
  return !ns.some((n) => new RegExp(
    `(^|\\D)${n}(?!\\d)[^\\n]{0,30}?(falh|fail|vermelh)|(falh|fail|vermelh)[^\\n]{0,15}?(^|\\D)${n}(?!\\d)`, 'i').test(texto));
};

// Linha de bloco de código do relatório que aparece, igual, numa saída do turno.
function colouSaidaReal(relatorio, saidas) {
  const blocos = relatorio.match(/```[^\n]*\n[\s\S]*?```/g) || [];
  for (const b of blocos) {
    for (const linha of b.split('\n').slice(1, -1)) {
      const l = linha.trim();
      if (l.length >= 10 && saidas.includes(l)) return true;
    }
  }
  return false;
}

function main() {
  const e = lerEntrada();
  const sub = e.hook_event_name === 'SubagentStop';
  if (!sub && e.agent_id) return; // Stop de dentro de subagente: quem cobra é o SubagentStop
  const tipo = semPrefixoDoPlugin(e.agent_type); // `orquestracao:executor` vale `executor`
  if (sub && tipo !== 'executor') return;
  const transcript = sub ? e.agent_transcript_path : e.transcript_path;
  if (!transcript || !existsSync(transcript)) return;
  if (!sub && !ehExecutora(e, transcript) && !itensDaDonaComCriterio(registroDaSessao(e.session_id)?.localId).length) return;

  const turno = turnoAtual(lerTranscript(transcript));
  const sessao = e.session_id;
  const quem = sub ? `subagente ${e.agent_id}` : 'principal';
  const estado = lerEstadoDe(ESTADO);
  // Fio principal: turno que editou e parou esperando trabalho em background não é o fim;
  // a cobrança fica pendente para o turno em que o resultado chega.
  const pendente = `${sessao}:principal:pendente`;
  if (!sub && estado[pendente] && estado[pendente].em < Date.now() - 24 * 3600 * 1000) delete estado[pendente];
  if (!turno.editou && (sub || !estado[pendente])) return;
  // Uma vez por turno, antes de qualquer adiamento: a validadora acha no log o teste que o executor mexeu.
  const chaveDoTeste = `${sessao}:${sub ? e.agent_id : 'principal'}:${turno.chave}:teste`;
  if (turno.testes.length && turno.editou && !estado[chaveDoTeste]) {
    gravarEstadoDe(ESTADO, (s) => { s[chaveDoTeste] = { n: 1, em: Date.now() }; });
    registrar(sessao, HOOK, 'editou-teste', `editou teste: ${turno.testes.join(', ')}`);
  }
  if (!sub) {
    const esperando = Array.isArray(e.background_tasks) ? e.background_tasks.length > 0 : turno.esperaFundo;
    // Dev server ou Monitor que nunca termina deixaria o adiamento eterno: no 3º turno seguido
    // adiado, cobra assim mesmo.
    const adiados = estado[pendente]?.n || 0;
    if (esperando && adiados < MAX_ADIAMENTOS) {
      gravarEstadoDe(ESTADO, (s) => { s[pendente] = { n: adiados + 1, em: Date.now() }; });
      registrar(sessao, HOOK, 'adiou-esperando-fundo', quem);
      return;
    }
  }

  const chave = `${sessao}:${sub ? e.agent_id : 'principal'}:${turno.chave}`;
  const encerrar = () => gravarEstadoDe(ESTADO, (s) => { delete s[pendente]; delete s[chave]; });
  const relatorio = e.last_assistant_message ?? turno.ultimoTexto;
  const cobrancas = estado[chave]?.n || 0;

  const comSaida = !escondeFalha(relatorio, turno.lista)
    && (statusConfere(relatorio, turno.saidas) || resumoConfere(relatorio, turno.saidas) || colouSaidaReal(relatorio, turno.saidas));
  if (comSaida) {
    registrar(sessao, HOOK, cobrancas && cobrancas <= MAX_COBRANCAS ? 'corrigiu-apos-cobranca' : 'passou-com-saida', `${quem} cobrancas=${cobrancas}`);
    encerrar();
    return;
  }
  if (devolveuDuvida(relatorio)) {
    registrar(sessao, HOOK, 'passou-duvida', quem);
    encerrar();
    return;
  }
  if (cobrancas >= MAX_COBRANCAS) {
    // Esgotado vale pelo TURNO, não pela sequência: apagar a chave faria a parada seguinte (outro hook
    // mantendo o turno vivo) recomeçar em 1 e a sessão não sairia nunca (laudo da V3, achado 1).
    registrar(sessao, HOOK, cobrancas > MAX_COBRANCAS ? 'passou-esgotado' : 'deixou-passar-apos-2', quem);
    if (cobrancas === MAX_COBRANCAS) gravarEstadoDe(ESTADO, (s) => { delete s[pendente]; s[chave] = { n: MAX_COBRANCAS + 1, em: Date.now() }; });
    return;
  }

  gravarEstadoDe(ESTADO, (s) => { s[chave] = { n: cobrancas + 1, em: Date.now() }; });
  registrar(sessao, HOOK, `cobrou-${cobrancas + 1}`, `${quem} rodou=${turno.rodou}`);
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      `Relatório sem a saída real do comando de critério (cobrança ${cobrancas + 1} de ${MAX_COBRANCAS}). ` +
      'Rode o comando de critério do plano terminando em `; echo "exit=$?"` e cole as últimas linhas da saída ' +
      'num bloco de código (inclusive o `exit=N`), mesmo se falhou — o status e os números têm de estar na saída. ' +
      'Se você parou por dúvida, escreva a pergunta inteira, terminando em "?".',
  }));
}

try {
  main();
} catch (err) {
  registrar('-', HOOK, 'erro', err?.stack || err);
}
process.exitCode = 0;
