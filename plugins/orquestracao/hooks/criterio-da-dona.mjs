#!/usr/bin/env node
// Stop: a dona só termina o turno com a SAÍDA REAL do comando de critério no relatório (a ideia do `Task.guardrail` +
// `guardrail_max_retries` da CrewAI: o critério de pronto não depende do relato).
// Quem é cobrada: a dona de item vivo da fila em execução, validação ou merge (o conserto que a fila devolve); em
// planejamento e design ela escreve plano e revisão, não roda critério.
// Só cobra turno que editou arquivo — por Edit/Write ou por Bash que grava (mais da metade das edições reais é por Bash).
// Status ("exit=0", "Found 0 errors") e contagem ("98 passed") só valem se aparecem na saída real do turno (Bash, Read de
// .output/.log, Monitor, TaskOutput, notificação).
// O turno que para esperando gate em background adia para o da notificação, no máximo 2 turnos seguidos: dev server ou
// Monitor eterno não desliga a trava.
// Não cobra quem devolve dúvida (pergunta fora de bloco de código que não é título markdown,
// "Bloqueado: <motivo>" abrindo a linha, "devolvo", "parei", "estou bloqueado").
// Saída com "N failed" exige o relatório citar o N junto da falha.
// Trava só para correção (F420): o turno extra vem quando o relatório afirma o que a saída real contradiz (status ou
// contagem que não confere, falha escondida) ou afirma sucesso ("testes passaram", "gate verde") sem nenhum teste rodado
// no turno. Saída só não colada vira aviso ao operador (systemMessage), uma vez por turno, sem turno extra.
// No máximo 2 cobranças por turno; depois deixa passar e registra. Erro vai para o log e o turno termina.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, registrar, lerEntrada, lerTranscript, textoDe, conteudoDe, aberturaDoTurno, devolveuDuvida, lerEstadoDe, gravarEstadoDe } from './hooks-crewai-comum.mjs';
import { registroDaSessao, itensDaDonaComCriterio } from './pool-comum.mjs';

const HOOK = 'criterio-da-dona';
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
// que o turno editou um (a revisão acha no log); não cobra nem bloqueia por isso.
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
// Bash que roda teste, typecheck, lint, build ou gate: o que dá base a "os testes passaram". Casa o
// executor no início de cada trecho do comando, não a palavra solta: `git add tests/a.test.mjs`,
// `ls tests/` e `cat vitest.config.ts` citam teste sem rodar nenhum.
const ALVO_DE_TESTE = /(?:^|\s)(?:test|tests|lint|build|typecheck|check|vitest|jest|tsc|eslint|playwright)(?::\S*)?(?=\s|$)/;
const EXECUTOR_DIRETO = /^(?:\S*\/)?(?:vitest|jest|pytest|tsc|eslint|playwright|testes-afetados)$/;
function rodaTeste(comando) {
  for (const bruto of comando.split(/&&|\|\||[;|\n()]/)) {
    const t = bruto.trim().replace(/^(?:\w+=\S*\s+|(?:env|time|nice)\s+|timeout\s+\S+\s+)+/, '');
    const primeira = t.split(/\s+/)[0] || '';
    if (/^(?:npx|pnpm|npm|yarn|bun|bunx)$/.test(primeira)) {
      // `pnpm add -D vitest` instala; não roda.
      if (!/^\S+\s+(?:add|install|i|remove|uninstall)\b/.test(t) && ALVO_DE_TESTE.test(t.slice(primeira.length))) return true;
    } else if (EXECUTOR_DIRETO.test(primeira)) return true;
    else if (/^node$/.test(primeira) && /(?:\s--test\b|com-fichas|testes-afetados)/.test(t)) return true;
    else if (/^(?:cargo|go|deno)\s+test\b|^make\s+(?:test|check|lint)\b/.test(t)) return true;
    else if (/com-fichas(?:\.mjs)?$/.test(primeira)) return true;
  }
  return false;
}
// Relatório que afirma sucesso de teste, typecheck, lint, build ou gate.
const AFIRMA_SUCESSO = /(\bexit\s*[=:]?\s*0\b|\b\d+\s+(passed|passaram|verdes|passando)\b|\btudo verde\b|\b(testes?|gate|typecheck|lint|build|afetados|su[ií]te)\b[^\n.]{0,40}\b(verdes?|passa|passam|passou|passaram|limpos?)\b|\b(verdes?|passaram|passou)\b[^\n.]{0,20}\b(testes?|gate|typecheck|afetados))/i;
const CONTAGEM = /(\d+)\s+(?:testes?\s+|casos?\s+)?(passaram|verdes|passou|passed|falharam|falhou|vermelhos?|failed)\b/i;

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
  let rodouTeste = false;
  // O que o turno cita (comandos e saídas): o .output/.log lido só conta se o turno o lançou ou o citou.
  const citados = [];
  for (const e of turno) {
    if (!Array.isArray(e.message?.content)) continue;
    for (const c of e.message.content) {
      if (c.type === 'tool_use' && c.name === 'Bash') citados.push(String(c.input?.command || ''));
      if (c.type === 'tool_result') citados.push(conteudoDe(c.content));
    }
  }
  const citado = citados.join('\n');
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
      if ((comando && rodaTeste(comando)) || (c.name !== 'Bash' && SAIDA_DE_TOOL.has(c.name))) rodouTeste = true;
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
      const texto = conteudoDe(c.content);
      saidas.push(texto);
      rodou = true;
      const arquivo = String(uso.input?.file_path || '');
      if ((lido && citado.includes(arquivo)) || RESULTADO.test(texto)) rodouTeste = true;
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
  // A notificação (a que abriu o turno ou uma dentro dele) é de trabalho em background: conta como teste rodado.
  if (saidas.length && (abertura?.origin?.kind === 'task-notification' || saidas.some((s) => s.includes('<task-notification>')))) rodouTeste = true;
  return { chave: abertura?.uuid || 'inicio', editou, rodouTeste, testes: [...testes], esperaFundo: fundo.size > 0, rodou, saidas: saidas.join("\n"), lista: saidas, ultimoTexto };
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
    // node:test e TAP dizem "ℹ pass 12" / "# fail 2": o mesmo número, na ordem inversa.
    if (new RegExp(`^\\s*[ℹ#]\\s*${palavra === 'failed' ? 'fail' : 'pass'}\\s+${m[1]}(?!\\d)`, 'm').test(saidas)) return true;
  }
  return false;
}
// Só a ÚLTIMA saída com contagem conta: o gate vermelho de antes do conserto não é o resultado.
// Admitir a falha é citar um dos números de falha da saída junto da palavra, antes ou depois
// ("2 testes falharam", "falharam 2", "Tests  2 failed" colado): "nenhuma falha nova" usa a palavra e
// esconde o número. Todos os N contam — o vitest diz "Test Files  1 failed" antes de "Tests  2 failed".
// Resíduo aceito: um número qualquer a até 30 caracteres da palavra ("2 dias sem falha") libera.
// Além do "N failed" do vitest/jest: "ℹ fail N" (node:test), "# fail N" (TAP), "Found N errors" (tsc --build).
// Saída sem contagem com erro de tipo ou exit diferente de zero conta contra o relatório que afirma sucesso
// sem citar falha nem erro.
// O erro do tsc só no formato de diagnóstico (no começo da linha, ou depois de "arquivo(l,c):"/"arquivo:l:c -"),
// e o exit só na linha do status ("exit=1", a do `echo "exit=$?"`): o nome de um teste verde que cita
// "exit=1" ou "error TS2322" não é falha.
const ERRO_TS = /^(?:\S[^\n]*?(?:\(\d+,\d+\)|:\d+:\d+)\s*[:-]?\s*)?error\s+TS\d+/m;
const EXIT_FALHO = /^\s*(?:error:\s*)?exit(?:\s*code|\s*status)?\s*[=:]?\s*[1-9]\d*\s*$/im;
const RESULTADO = new RegExp(`\\d+\\s+(?:passed|failed)\\b|^\\s*[ℹ#]\\s*(?:pass|fail)\\s+\\d+|Found\\s+\\d+\\s+errors?|${ERRO_TS.source}`, 'm');
const escondeFalha = (relatorio, lista) => {
  const ultima = [...lista].reverse().find((s) => RESULTADO.test(s)) ?? '';
  const ns = [
    ...ultima.matchAll(/(?:^|\D)([1-9]\d*)\s+failed\b/g),
    ...ultima.matchAll(/^\s*[ℹ#]\s*fail\s+([1-9]\d*)/gm),
    ...ultima.matchAll(/Found\s+([1-9]\d*)\s+errors?/g),
  ].map((m) => m[1]);
  // O status ("exit=1") sai do texto antes: o 1 dele não é o número de falhas.
  const texto = relatorio.replace(STATUS, ' ');
  if (!ns.length) {
    const falhou = ERRO_TS.test(ultima) || EXIT_FALHO.test(ultima);
    return falhou && AFIRMA_SUCESSO.test(relatorio) && !/(falh|fail|vermelh|erro)/i.test(texto);
  }
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
  if (e.agent_id) return; // Stop de dentro de subagente: subagente não escreve, quem é cobrada é a dona
  const transcript = e.transcript_path;
  if (!transcript || !existsSync(transcript)) return;
  if (!itensDaDonaComCriterio(registroDaSessao(e.session_id)?.localId).length) return;

  const turno = turnoAtual(lerTranscript(transcript));
  const sessao = e.session_id;
  const quem = 'principal';
  const estado = lerEstadoDe(ESTADO);
  // Turno que editou e parou esperando trabalho em background não é o fim; a cobrança fica pendente para o turno em que o
  // resultado chega.
  const pendente = `${sessao}:principal:pendente`;
  if (estado[pendente] && estado[pendente].em < Date.now() - 24 * 3600 * 1000) delete estado[pendente];
  if (!turno.editou && !estado[pendente]) return;
  // Uma vez por turno, antes de qualquer adiamento: a revisão acha no log o teste que a dona mexeu.
  const chaveDoTeste = `${sessao}:principal:${turno.chave}:teste`;
  if (turno.testes.length && turno.editou && !estado[chaveDoTeste]) {
    gravarEstadoDe(ESTADO, (s) => { s[chaveDoTeste] = { n: 1, em: Date.now() }; });
    registrar(sessao, HOOK, 'editou-teste', `editou teste: ${turno.testes.join(', ')}`);
  }
  const esperando = Array.isArray(e.background_tasks) ? e.background_tasks.length > 0 : turno.esperaFundo;
  // Dev server ou Monitor que nunca termina deixaria o adiamento eterno: no 3º turno seguido adiado, cobra assim mesmo.
  const adiados = estado[pendente]?.n || 0;
  if (esperando && adiados < MAX_ADIAMENTOS) {
    gravarEstadoDe(ESTADO, (s) => { s[pendente] = { n: adiados + 1, em: Date.now() }; });
    registrar(sessao, HOOK, 'adiou-esperando-fundo', quem);
    return;
  }

  const chave = `${sessao}:principal:${turno.chave}`;
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
  // O que é correção trava; o resto é anotação e vira aviso.
  const falhaEscondida = escondeFalha(relatorio, turno.lista);
  const inventou = new RegExp(STATUS.source, 'i').test(relatorio) || CONTAGEM.test(relatorio);
  const semTeste = AFIRMA_SUCESSO.test(relatorio) && !turno.rodouTeste;
  if (!falhaEscondida && !inventou && !semTeste) {
    const avisado = `${chave}:aviso`;
    if (estado[avisado]) return;
    gravarEstadoDe(ESTADO, (s) => { delete s[pendente]; s[avisado] = { n: 1, em: Date.now() }; });
    registrar(sessao, HOOK, 'avisou-sem-saida', `${quem} rodou=${turno.rodou}`);
    process.stdout.write(JSON.stringify({
      systemMessage: 'Critério da dona: o relatório não traz a saída real do comando de critério. ' +
        'Na próxima entrega, cole as últimas linhas da saída num bloco de código (com o `exit=N`).',
    }));
    return;
  }
  if (cobrancas >= MAX_COBRANCAS) {
    // Esgotado vale pelo TURNO, não pela sequência: apagar a chave faria a parada seguinte (outro hook
    // mantendo o turno vivo) recomeçar em 1 e a sessão não sairia nunca.
    registrar(sessao, HOOK, cobrancas > MAX_COBRANCAS ? 'passou-esgotado' : 'deixou-passar-apos-2', quem);
    if (cobrancas === MAX_COBRANCAS) gravarEstadoDe(ESTADO, (s) => { delete s[pendente]; s[chave] = { n: MAX_COBRANCAS + 1, em: Date.now() }; });
    return;
  }

  gravarEstadoDe(ESTADO, (s) => { s[chave] = { n: cobrancas + 1, em: Date.now() }; });
  const motivo = falhaEscondida ? 'a saída real tem falha que o relatório não cita'
    : semTeste ? 'o relatório afirma sucesso, mas nenhum teste rodou neste turno'
    : 'o status ou a contagem do relatório não aparece na saída real';
  registrar(sessao, HOOK, `cobrou-${cobrancas + 1}`, `${quem} rodou=${turno.rodou} ${falhaEscondida ? 'falha-escondida' : semTeste ? 'sem-teste' : 'nao-confere'}`);
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      `Relatório não confere com a saída real: ${motivo} (cobrança ${cobrancas + 1} de ${MAX_COBRANCAS}). ` +
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
