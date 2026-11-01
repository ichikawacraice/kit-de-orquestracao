// Comum das travas da sessão: quem é a sessão (registro do app), se é orquestradora ou dona de item, início do turno e
// "este repositório tem orquestradora ativa".
// Fonte das regras: pool/protocolo.md do plugin. Log e BASE: hooks-crewai-comum.mjs.
import { existsSync, readFileSync, writeFileSync, renameSync, readdirSync, statSync, openSync, readSync, closeSync, unlinkSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, loadavg, availableParallelism } from 'node:os';
import { join, basename, dirname } from 'node:path';
import { fechadasRecentes, slugDoProjeto } from '../skills/orquestradora/scripts/perguntas-arquivo.mjs';
import { BASE } from './hooks-crewai-comum.mjs';

export { BASE };
const H = homedir();
// A máquina está cheia para teste? (ADR 0005 e 0008, operador, 26/10) — o plugin não importa `gate/` (que não vai junto quando ele é instalado),
// então lê as fichas por conta própria: a pasta, o teto, as faixas e o PID dono seguem o mesmo contrato do `gate/o-teto-da-maquina.mjs` (um teste
// compara os dois). O teto tem a faixa do gate (fichas 1..G) e a faixa normal (G+1..T). Cheia = nenhuma ficha normal livre e, ou há gate rodando
// (`<pasta>/gate` com PID vivo), ou a faixa do gate também está sem livre; ou a carga de 1 min ≥ núcleos. Um gate sozinho não enche a máquina.
// Valor de teto inválido aqui não derruba o hook: cai para o próximo da ordem (o gate, esse, recusa alto). `KIT_CARGA_1MIN` fixa a carga (os testes).
const FICHA_ILEGIVEL_MS = 30_000;
const FRACAO_PADRAO_DE_TESTE = 2 / 3;
const FRACAO_PADRAO_DO_GATE = 0.7;
const inteiroPositivo = (n) => Number.isInteger(n) && n >= 1;
const fracaoValida = (v, aberta = false) => { if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null; const f = typeof v === 'number' ? v : Number(v); return Number.isFinite(f) && f > 0 && f <= 1 && !(aberta && f >= 1) ? f : null; };
const vivo = (pid) => { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; } };
export const pastaDoTeto = (env = process.env) => env.KIT_NUCLEOS_DIR || join(H, '.claude', 'orquestracao', 'nucleos-de-teste');
export function tetoDaMaquina(env = process.env, nucleos = availableParallelism(), pasta = pastaDoTeto(env)) {
  for (const nome of ['KIT_NUCLEOS_DE_TESTE']) {
    const v = env[nome];
    if (v !== undefined && v !== '' && inteiroPositivo(Number(v))) return Number(v);
  }
  const dosNucleos = (f) => Math.max(1, Math.floor(nucleos * f));
  const daEnv = fracaoValida(env.KIT_FRACAO_DE_TESTE);
  if (daEnv !== null) return dosNucleos(daEnv);
  try {
    const json = JSON.parse(readFileSync(join(pasta, 'teto.json'), 'utf8'));
    if (inteiroPositivo(json?.nucleos)) return json.nucleos;
    const f = fracaoValida(json?.fracao);
    if (f !== null) return dosNucleos(f);
  } catch { /* sem arquivo: o padrão */ }
  return dosNucleos(FRACAO_PADRAO_DE_TESTE);
}
/** As faixas do teto `T` — as mesmas de `faixas()` do gate: `{ gate: G, normal: T − G, compartilhada }`. */
export function faixasDoTeto(teto, env = process.env) {
  const f = fracaoValida(env.KIT_FRACAO_DO_GATE, true) ?? FRACAO_PADRAO_DO_GATE;
  if (teto <= 1) return { gate: 1, normal: 1, compartilhada: true };
  const gate = Math.min(teto - 1, Math.max(1, Math.floor(teto * f)));
  return { gate, normal: teto - gate, compartilhada: false };
}
/** O PID da ficha (ou da vez do gate) em `caminho` se ela vale agora; `undefined` se não vale (ausente, PID morto, ilegível velha); `null` se ilegível recente. */
function donoVivo(caminho) {
  try {
    let pid = null;
    try { const p = JSON.parse(readFileSync(caminho, 'utf8'))?.pid; if (Number.isInteger(p)) pid = p; } catch { /* ilegível */ }
    if (pid === null) return Date.now() - statSync(caminho).mtimeMs <= FICHA_ILEGIVEL_MS ? null : undefined;
    return vivo(pid) ? pid : undefined;
  } catch { return undefined; }
}
export function maquinaCheia({ env = process.env, pasta, teto, carga, nucleos = availableParallelism() } = {}) {
  const dir = pasta ?? pastaDoTeto(env);
  const limite = teto ?? tetoDaMaquina(env, nucleos, dir);
  let cargaAgora = carga;
  if (cargaAgora === undefined) { const c = Number(env.KIT_CARGA_1MIN); cargaAgora = env.KIT_CARGA_1MIN !== undefined && env.KIT_CARGA_1MIN !== '' && Number.isFinite(c) ? c : loadavg()[0]; }
  const faixas = faixasDoTeto(limite, env);
  const tomadasKs = new Set();
  let nomes = [];
  try { nomes = readdirSync(dir); } catch { /* sem pasta: nenhuma ficha */ }
  for (const nome of nomes) {
    if (!/^[1-9]\d*$/.test(nome)) continue;
    if (donoVivo(join(dir, nome)) !== undefined) tomadasKs.add(Number(nome));
  }
  const gateRodando = !faixas.compartilhada && donoVivo(join(dir, 'gate')) !== undefined;
  const ksNormais = faixas.compartilhada ? [1] : Array.from({ length: faixas.normal }, (_, i) => faixas.gate + 1 + i);
  const ksDoGate = Array.from({ length: faixas.gate }, (_, i) => i + 1);
  const livresNormais = ksNormais.filter((k) => !tomadasKs.has(k)).length;
  const livresDoGate = ksDoGate.filter((k) => !tomadasKs.has(k)).length;
  const semFicha = livresNormais === 0 && (gateRodando || livresDoGate === 0);
  return { cheia: semFicha || cargaAgora >= nucleos, tomadas: tomadasKs.size, teto: limite, faixas, livresNormais, livresDoGate, gateRodando: gateRodando ? true : null, carga: cargaAgora, nucleos, pasta: dir };
}
const SESSOES_DIR = () => process.env.POOL_APP_SESSOES_DIR || join(H, 'Library', 'Application Support', 'Claude', 'claude-code-sessions');
// O registro tem uma pasta por conta do app; a de outra conta fica no disco com sessões que o app já não mostra. Pasta da
// conta atual = `lastKnownAccountUuid` do config.json do app, irmão do registro. Sem config, sem a chave ou sem a pasta: o
// registro inteiro.
export function sessoesDaConta() {
  const dir = SESSOES_DIR();
  try {
    const conta = JSON.parse(readFileSync(join(dirname(dir), 'config.json'), 'utf8'))?.lastKnownAccountUuid;
    if (typeof conta === 'string' && /^[\w-]+$/.test(conta) && existsSync(join(dir, conta))) return join(dir, conta);
  } catch { /* sem config: o registro inteiro */ }
  return dir;
}

function* arquivosLocal(dir) {
  let entradas;
  try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entradas) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* arquivosLocal(p);
    else if (e.isFile() && e.name.startsWith('local_') && e.name.endsWith('.json')) yield p;
  }
}

// Registro do app da sessão: casa por `sessionId` (local_…), `cliSessionId` ou `priorCliSessionIds`.
// Lê como texto e só faz JSON.parse do arquivo que contém o id. → { localId, titulo, arquivada } ou null.
// A varredura lê dezenas de MB; o hook roda em todo Edit. Acerto fica em cache por 2 min em
// <BASE>/pool-registro-cache.json (título troca raramente; acerto e ausência). Efeito: troca de título ou sessão nova
// só é vista em até 2 min.
const CACHE_TTL_MS = 120_000;
const cacheArq = () => join(BASE, 'pool-registro-cache.json');
function lerCache() { try { return JSON.parse(readFileSync(cacheArq(), 'utf8')); } catch { return {}; } }
function guardarCache(id, reg) {
  try {
    const c = lerCache();
    for (const [k, v] of Object.entries(c)) if (Date.now() - v.em > CACHE_TTL_MS) delete c[k];
    c[id] = { em: Date.now(), reg };
    const tmp = `${cacheArq()}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(c));
    renameSync(tmp, cacheArq());
  } catch { /* sem cache, segue */ }
}

// fresco: ignora o cache (o título muda e a decisão depende dele — arquivar sessão, só por comando do operador).
export function registroDaSessao(id, { fresco = false } = {}) {
  if (!id) return null;
  const hit = fresco ? null : lerCache()[id];
  // Cache de antes do `cwd`/`originCwd` (reg sem a chave `cwd`) é descartado: não vale como "sem projeto".
  if (hit && Date.now() - hit.em <= CACHE_TTL_MS && (hit.reg === null || 'cwd' in hit.reg)) return hit.reg;
  const reg = varrerRegistro(id);
  guardarCache(id, reg); // também a ausência (reg null): sessão fora do registro não varre a cada Edit
  return reg;
}

// `cliIds`: a id atual do CLI (`cliAtual`) e as anteriores (cada limpeza de contexto troca a id); `anterior`: a id buscada é uma das que
// a sessão já deixou para trás (F208: o marcador `ativas/` dela é órfão). Id `local_…` tenta antes o arquivo de mesmo nome (o app
// grava assim), sem ler os outros; sem acerto, a varredura inteira.
function varrerRegistro(id) {
  if (id.startsWith('local_')) {
    const r = varrerArquivos(id, (f) => basename(f) === `${id}.json`);
    if (r) return r;
  }
  return varrerArquivos(id, () => true);
}

function varrerArquivos(id, pelo) {
  for (const f of arquivosLocal(SESSOES_DIR())) {
    if (!pelo(f)) continue;
    let texto;
    try { texto = readFileSync(f, 'utf8'); } catch { continue; }
    if (!texto.includes(id)) continue;
    try {
      const r = JSON.parse(texto);
      if (r.sessionId === id || r.cliSessionId === id || (Array.isArray(r.priorCliSessionIds) && r.priorCliSessionIds.includes(id))) {
        const prior = Array.isArray(r.priorCliSessionIds) ? r.priorCliSessionIds.filter((x) => typeof x === 'string' && x) : [];
        const cliIds = [...new Set([r.cliSessionId, ...prior].filter((x) => typeof x === 'string' && x))];
        return { localId: r.sessionId || null, titulo: r.title || '', arquivada: Boolean(r.isArchived), cwd: r.cwd || null, originCwd: r.originCwd || null, cliIds, cliAtual: typeof r.cliSessionId === 'string' && r.cliSessionId ? r.cliSessionId : null, anterior: prior.includes(id) && r.cliSessionId !== id };
      }
    } catch { /* registro ilegível */ }
  }
  return null;
}

// Itens vivos da fila em que a sessão aparece (F30): `com` = trabalhando agora; `fez` = executou parte e o item ainda espera
// validação, conserto ou merge. Pasta: FILA_DIR, ou <PAINEL_DIR>/fila. Erro de leitura = lista vazia (o hook deixa passar).
export const filaDir = () => process.env.FILA_DIR || join(process.env.PAINEL_DIR || join(H, '.claude', 'orquestracao', 'painel'), 'fila');
// Perguntas `limpar · orquestradora` da sessão (F48; só o título exato vale, outra `limpar · …` não é pedido nem ok): documentos de <PAINEL_DIR>/perguntas. Erro de leitura = lista vazia.
const perguntasDir = () => join(process.env.PAINEL_DIR || join(H, '.claude', 'orquestracao', 'painel'), 'perguntas');
// F183: a respondida pode já estar no arquivo; o "sim" vale 30 min, então do arquivo só se lê o que mudou no último dia.
export function perguntasDeLimpeza(localId) {
  const saida = [];
  if (!localId) return saida;
  let nomes;
  try { nomes = readdirSync(perguntasDir()).filter((n) => n.endsWith('.json')).map((n) => join(perguntasDir(), n)); } catch { return saida; }
  nomes.push(...fechadasRecentes(perguntasDir(), { desdeMs: Date.now() - 86_400_000 }));
  for (const f of nomes) {
    try {
      const d = JSON.parse(readFileSync(f, 'utf8'))?.data;
      if (d && typeof d.titulo === 'string' && d.titulo.trim() === 'limpar · orquestradora' && d.sessaoId === localId) saida.push(d);
    } catch { /* documento ilegível */ }
  }
  return saida;
}

// O ok do botão de limpar da barra (F147): o clique grava <PAINEL_DIR>/../limpeza/<local_…>.json `{ "em": "<ISO>", "por": "barra" }` antes de
// mandar o prompt (que chega com origem `plugin`, nunca `human`). Vale 30 min, nunca no futuro; só `por: "barra"`. Erro de leitura = `null`.
const limpezaDir = () => join(process.env.PAINEL_DIR || join(H, '.claude', 'orquestracao', 'painel'), '..', 'limpeza');
export function okDoBotaoDeLimpar(localId) {
  if (!localId || !/^local_[\w-]+$/.test(localId)) return null;
  try {
    const d = JSON.parse(readFileSync(join(limpezaDir(), `${localId}.json`), 'utf8'));
    const em = Date.parse(d?.em);
    const dif = Date.now() - em;
    return d?.por === 'barra' && Number.isFinite(em) && dif >= 0 && dif <= 30 * 60_000 ? { em } : null;
  } catch { return null; }
}

// O ok do botão vale uma limpeza: a T7 o apaga ao liberar. Se o `clear_session` falhar depois da liberação, o ok já foi gasto e o operador clica de novo.
export function gastarOkDoBotaoDeLimpar(localId) {
  if (!localId || !/^local_[\w-]+$/.test(localId)) return;
  try { unlinkSync(join(limpezaDir(), `${localId}.json`)); } catch { /* arquivo já ausente não é falha */ }
}

// A marca de volta da limpeza (F219): a T7 a grava em <PAINEL_DIR>/../volta-da-limpeza/<local_…>.json `{ "em": "<ISO>", "motivo", "cli" }` ao
// liberar o clear_session da orquestradora. A limpeza do app mata o processo do CLI; no processo novo, o mod painel-sessoes lê a marca,
// a sessão é acordada por outra sessão viva. `cli` é a id do CLI que pediu a limpeza: quem acorda só manda se o registro do app já
// não a traz como atual (a limpeza aconteceu de fato; ela pode ser descartada depois de liberada). Falha de escrita não trava a limpeza.
const voltaDir = () => join(process.env.PAINEL_DIR || join(H, '.claude', 'orquestracao', 'painel'), '..', 'volta-da-limpeza');
export function marcarVoltaDaLimpeza(localId, motivo, cli) {
  if (!localId || !/^local_[\w-]+$/.test(localId)) return;
  try {
    mkdirSync(voltaDir(), { recursive: true });
    writeFileSync(join(voltaDir(), `${localId}.json`), `${JSON.stringify({ em: new Date().toISOString(), motivo, ...(cli ? { cli } : {}) })}\n`);
  } catch { /* sem a marca, a volta espera o operador, como antes */ }
}

// Janela de limpeza (F53): o operador responde à pergunta `limpar · orquestradora` pela janela (AskUserQuestion). Só o termo inteiro vale
// (sem caixa, espaços em volta do `·` à vontade, seguido de `:`, `?`, `.`, `,`, espaço ou fim): `limpar · orquestradora-velha` não casa.
export const SIM_DA_JANELA_MS = 30 * 60_000;
export const ehPerguntaDeLimpeza = (texto) => /limpar\s*·\s*orquestradora(?=$|[\s:?.,])/i.test(String(texto ?? ''));

// Janelas de limpeza do transcript: cada `tool_use` AskUserQuestion (fora de subagente) com pergunta de limpeza, pareado com o
// `tool_result` do mesmo `tool_use_id` (escrito pelo app: `toolUseResult.answers[<pergunta>]`, `timestamp` = hora da resposta).
// `recusada` = janela fechada sem resposta (`is_error` ou sem `answers`; `respondidaEm` é a hora do fechamento). Sem desfecho ainda: `respondidaEm: null`. Erro de leitura = [].
export function janelasDeLimpeza(transcriptPath) {
  const janelas = [];
  try {
    const porId = new Map(); const respostas = [];
    for (const l of readFileSync(transcriptPath, 'utf8').split('\n')) {
      if (!l) continue;
      let x; try { x = JSON.parse(l); } catch { continue; }
      if (x.isSidechain === true) continue;
      const c = x.message?.content;
      if (!Array.isArray(c)) continue;
      if (x.type === 'assistant') {
        for (const b of c) {
          if (b?.type !== 'tool_use' || b.name !== 'AskUserQuestion' || !b.id) continue;
          const pergunta = (Array.isArray(b.input?.questions) ? b.input.questions : []).map((q) => q?.question).find(ehPerguntaDeLimpeza);
          if (pergunta === undefined) continue;
          const j = { abertaEm: Date.parse(x.timestamp), respondidaEm: null, resposta: undefined, recusada: false };
          porId.set(b.id, { j, pergunta }); janelas.push(j);
        }
      } else if (x.type === 'user') {
        for (const b of c) if (b?.type === 'tool_result' && porId.has(b.tool_use_id)) respostas.push({ b, x });
      }
    }
    for (const { b, x } of respostas) {
      const { j, pergunta } = porId.get(b.tool_use_id);
      const a = x.toolUseResult?.answers;
      j.respondidaEm = Date.parse(x.timestamp); // também da janela fechada sem resposta: é o desfecho dela
      if (b.is_error === true || !a || typeof a !== 'object') { j.recusada = true; continue; }
      j.resposta = a[pergunta];
      if (typeof j.resposta !== 'string') j.recusada = true;
    }
  } catch { return []; }
  return janelas;
}

// Itens vivos de que a sessão é DONA (`donoLocalId`).
export function itensDonosDaSessao(localId) {
  const saida = [];
  if (!localId) return saida;
  let nomes; try { nomes = readdirSync(filaDir()); } catch { return saida; }
  for (const nome of nomes) {
    if (!nome.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(filaDir(), nome), 'utf8'));
      const d = doc?.data;
      if (!d || d.etapa === 'feito' || d.etapa === 'descartado') continue;
      if (d.donoLocalId === localId) saida.push(doc?.id ?? nome.replace(/\.json$/, ''));
    } catch { /* arquivo parcial: ignora este item */ }
  }
  return saida;
}

// Os itens de que a sessão é dona na etapa em que escreve código — execução, validação e merge (o conserto devolvido pela
// fila). Em planejamento e design a dona escreve plano e revisão, não roda critério. → [ids]
const ETAPAS_DE_CRITERIO = ['execucao', 'validacao', 'merge'];
export function itensDaDonaComCriterio(localId) {
  const saida = [];
  if (!localId) return saida;
  let nomes; try { nomes = readdirSync(filaDir()); } catch { return saida; }
  for (const nome of nomes) {
    if (!nome.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(filaDir(), nome), 'utf8'));
      const d = doc?.data;
      if (d?.donoLocalId === localId && ETAPAS_DE_CRITERIO.includes(d.etapa)) saida.push(doc?.id ?? nome.replace(/\.json$/, ''));
    } catch { /* arquivo parcial: ignora este item */ }
  }
  return saida;
}

// Projeto da sessão (D1, 24/10): git common dir do `originCwd` (cai para `cwd`). `repo` é o common dir absoluto
// (comparação nas travas: worktrees do mesmo repositório dão o mesmo); `nome` é o basename da pasta que contém o
// `.git`, minúsculo (painel e mod). Sem pasta ou fora de git → null.
export function projetoDaSessao(reg) {
  const repo = gitCommonDir(reg?.originCwd || reg?.cwd);
  if (!repo) return null;
  const raiz = basename(repo) === '.git' ? dirname(repo) : repo;
  return { repo, nome: slugDoProjeto(basename(raiz).replace(/\.git$/, '')) };
}

export function ehOrquestradora(sessionId, titulo) {
  return Boolean(sessionId && existsSync(join(BASE, 'ativas', sessionId))) || (titulo || '').startsWith('🎛 orquestradora');
}

// A origem do turno atual ('human', 'peer', 'task-notification'…), pela última mensagem de usuário com origem.
export function origemDoTurno(transcriptPath) {
  const linhas = readFileSync(transcriptPath, 'utf8').split('\n');
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (!linhas[i]) continue;
    let e;
    try { e = JSON.parse(linhas[i]); } catch { continue; }
    const c = e.message?.content;
    const ehResultado = Array.isArray(c) && c.some((b) => b?.type === 'tool_result');
    // A meta que TEM origem abre o turno (B1, V3 de 25/10). Medido em 25/10 nos transcripts deste projeto: 2.082 linhas
    // `isMeta`, 1.579 com origem (1.538 `peer`, 41 `system`); a meta sem origem não tem o que devolver e cai fora aqui.
    if (e.type === 'user' && !ehResultado && (e.origin?.kind || e.turnOrigin)) return String(e.origin?.kind || e.turnOrigin);
  }
  return null;
}

// --- Quem pode abrir sessão neste turno (T3, F315) ---
// O aviso de fim de turno de uma sessão que esta abriu: `<system-reminder>The session "…" you started …` (hoje fechado por
// `</side-sessions-event>`) ou `<side-sessions-event>`. Medido de 27/10 a 01/11 (docs/research/2026-11-01-travas-x-app.md): o app
// marca `human` o aviso em que ele deixa abrir sessão, então a origem sozinha não o separa do operador; o texto separa.
const AVISO_DE_FIM_DE_TURNO = /^\s*(?:<system-reminder>\s*The session "[^"]*" you started\b|<side-sessions-event>)/;
const LEMBRETE_INICIAL = /^\s*<system-reminder>[\s\S]*?<\/system-reminder>/;
const textoDoConteudo = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((b) => (b?.type === 'text' ? b.text : '')).join('\n') : '');

function ehAvisoDeFimDeTurno(texto) {
  let t = texto;
  while (!AVISO_DE_FIM_DE_TURNO.test(t) && LEMBRETE_INICIAL.test(t)) t = t.replace(LEMBRETE_INICIAL, '');
  return AVISO_DE_FIM_DE_TURNO.test(t);
}

/**
 * O turno atual para a T3: 'operador' (o operador escreveu nele: origem `human` que não é aviso, na linha que o abriu ou
 * enfileirada depois), 'aviso' (sem o operador, com um aviso de fim de turno), a origem de quem o abriu ('peer', 'plugin'…),
 * ou null sem turno com origem. Entram a linha `user` com origem que abriu o turno e os `queued_command` que chegaram nele.
 */
export function quemAbreSessao(transcriptPath) {
  let entradas = null;
  for (const linha of readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!linha) continue;
    let e;
    try { e = JSON.parse(linha); } catch { continue; }
    const c = e.message?.content;
    const ehResultado = Array.isArray(c) && c.some((b) => b?.type === 'tool_result');
    if (e.type === 'user' && !ehResultado && (e.origin?.kind || e.turnOrigin)) {
      entradas = [{ origem: String(e.origin?.kind || e.turnOrigin), conteudo: c }];
    } else if (entradas && e.type === 'attachment' && e.attachment?.type === 'queued_command') {
      entradas.push({ origem: e.attachment.origin?.kind ?? null, conteudo: e.attachment.prompt });
    }
  }
  if (!entradas) return null;
  let aviso = false;
  for (const { origem, conteudo } of entradas) {
    const texto = textoDoConteudo(conteudo);
    if (ehAvisoDeFimDeTurno(texto)) { aviso = true; continue; }
    if (origem !== 'human') continue;
    let resto = texto;
    while (LEMBRETE_INICIAL.test(resto)) resto = resto.replace(LEMBRETE_INICIAL, '');
    const temAnexo = Array.isArray(conteudo) && conteudo.some((b) => b && b.type !== 'text');
    if (resto.trim() || temAnexo) return 'operador';
  }
  return aviso ? 'aviso' : entradas[0].origem;
}

// Início do turno (ms): a mesma entrada que a origem acima (e a cópia local do fila-do-item.mjs, que um teste compara).
export function inicioDoTurno(transcriptPath) {
  const linhas = readFileSync(transcriptPath, 'utf8').split('\n');
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (!linhas[i]) continue;
    let e;
    try { e = JSON.parse(linhas[i]); } catch { continue; }
    const c = e.message?.content;
    const ehResultado = Array.isArray(c) && c.some((b) => b?.type === 'tool_result');
    if (e.type === 'user' && !ehResultado && (e.origin?.kind || e.turnOrigin)) {
      const t = Date.parse(e.timestamp);
      return Number.isNaN(t) ? null : t;
    }
  }
  return null;
}

// --- Repositório com orquestradora ativa: mesma regra de painel-das-sessoes.mjs; mude nos dois. ---
const VALIDADE_MS = 7 * 24 * 3600 * 1000;

export function gitCommonDir(cwd) {
  if (!cwd || !existsSync(cwd)) return null;
  try {
    return execFileSync('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8', timeout: 3000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch { return null; }
}

export function transcriptDe(sessionId) {
  const proj = join(H, '.claude', 'projects');
  for (const d of readdirSync(proj)) {
    const f = join(proj, d, `${sessionId}.jsonl`);
    if (existsSync(f)) return f;
  }
  return null;
}

function cwdDoTranscript(f) {
  const fd = openSync(f, 'r');
  try {
    const buf = Buffer.alloc(256 * 1024);
    const n = readSync(fd, buf, 0, buf.length, 0);
    const m = buf.subarray(0, n).toString('utf8').match(/"cwd":"([^"]+)"/);
    return m ? m[1] : null;
  } finally { closeSync(fd); }
}

const semBarra = (r) => String(r ?? '').replace(/\/+$/, '');

// O repo que o marcador de `ativas/<id>` guarda: vazio (formato antigo) e o texto `null` valem "sem repo"; barra final sai.
// Os três leitores do marcador (aqui, orquestradora-nao-edita e painel-das-sessoes) passam por esta função.
export function repoDoMarcador(texto) {
  const r = semBarra(String(texto ?? '').trim());
  return r === 'null' ? '' : r;
}

// Sessões do registro do app com título de orquestradora, não arquivadas e sem marcador (limpar o contexto troca o id e
// órfã o marcador): a orquestradora que só o título denuncia. Só lê arquivo que contém o texto do título.
function orquestradorasSoPorTitulo(meuId, comMarcador) {
  const achadas = [];
  for (const f of arquivosLocal(sessoesDaConta())) {
    let texto;
    try { texto = readFileSync(f, 'utf8'); } catch { continue; }
    if (!texto.includes('🎛 orquestradora')) continue;
    try {
      const r = JSON.parse(texto);
      if (!String(r.title || '').startsWith('🎛 orquestradora') || r.isArchived) continue;
      const ids = [r.sessionId, r.cliSessionId, ...(Array.isArray(r.priorCliSessionIds) ? r.priorCliSessionIds : [])];
      if (ids.includes(meuId) || ids.some((x) => comMarcador.has(x))) continue;
      achadas.push({ cwd: r.originCwd || r.cwd || null });
    } catch { /* registro ilegível */ }
  }
  return achadas;
}

// O repositório `meuRepo` tem orquestradora ativa de OUTRA sessão? Três estados: `true` (há, medido), `false` (não há,
// medido) e `null` (não consegui medir: marcador cujo repo não resolve, transcript velho ou ausente do próprio repo,
// `~/.claude/projects` ilegível, orquestradora só por título sem repo). "Não sei" nunca vira "não há"; quem decide
// o que fazer com `null` é o chamador (T2 nega; o painel-das-sessoes trata como "não").
export function projetoTemOrquestradora(meuId, meuRepo) {
  const meu = semBarra(meuRepo);
  const ativas = join(BASE, 'ativas');
  let indeterminado = false;
  const comMarcador = new Set();
  let ids = [];
  try { ids = existsSync(ativas) ? readdirSync(ativas) : []; } catch { indeterminado = true; }
  for (const id of ids) {
    if (id === meuId) continue;
    comMarcador.add(id);
    try {
      let repo = repoDoMarcador(readFileSync(join(ativas, id), 'utf8'));
      const t = transcriptDe(id);
      if (!repo && t) repo = semBarra(gitCommonDir(cwdDoTranscript(t)));
      if (!repo) { indeterminado = true; continue; } // não sei de qual repo é
      if (repo !== meu) continue; // de outro repo: não conta, e é medido
      // É deste repo: só vale se o transcript existe e andou nos últimos 7 dias.
      if (!t || Date.now() - statSync(t).mtimeMs > VALIDADE_MS) { indeterminado = true; continue; }
      return true;
    } catch { indeterminado = true; }
  }
  try {
    for (const o of orquestradorasSoPorTitulo(meuId, comMarcador)) {
      const repo = semBarra(gitCommonDir(o.cwd));
      if (!repo) indeterminado = true;
      else if (repo === meu) return true;
    }
  } catch { indeterminado = true; }
  return indeterminado ? null : false;
}

// --- Normalização do comando, para achar a INVOCAÇÃO do painel (as travas casam o comando normalizado, não o texto cru) ---
// Casar o comando inteiro cobrava heredoc que apenas citava o subcomando, então o comando é normalizado antes: o corpo dos
// heredocs sai, e os separadores (`; & | ( `` \n`) DENTRO de aspas viram `_` (o tamanho não muda; `$(` e crase dentro de aspas
// duplas executam de verdade e ficam). Início de comando e invocação do painel (`node …/painel.mjs` ou o `painel` do bin/ do
// plugin): hooks-crewai-comum.mjs. Limite declarado: caminho montado por variável (`node "$P" …`); JSON multilinha fora de
// aspas; atribuição com valor entre aspas e espaço (`FOO="a b" node …`); outros prefixos (`sudo`, `xargs`, `bash -c "…"`).
export function semHeredoc(c) {
  const linhas = String(c).split('\n'); const saida = []; const fila = []; // delimitadores pendentes, em ordem: `cat <<A; cat <<B`
  for (const l of linhas) {
    if (fila.length) { if (l.trim() === fila[0]) fila.shift(); continue; }
    saida.push(l);
    for (const m of l.matchAll(/(?<!<)<<(?!<)-?\s*(['"]?)(\w+)\1/g)) fila.push(m[2]);
  }
  return saida.join('\n');
}
export function separadoresDeAspasNeutros(c) {
  let aspa = null; let o = '';
  for (let k = 0; k < c.length; k++) {
    const ch = c[k];
    if (aspa === null) {
      if (ch === '\\') { o += ch + (c[k + 1] ?? ''); k++; continue; }
      if (ch === "'" || ch === '"') aspa = ch;
      o += ch; continue;
    }
    if (ch === aspa) { aspa = null; o += ch; continue; }
    if (aspa === '"' && ch === '\\') { o += ch + (c[k + 1] ?? ''); k++; continue; }
    const executa = aspa === '"' && (ch === '`' || (ch === '(' && c[k - 1] === '$'));
    o += !executa && /[;&|(\n`]/.test(ch) ? '_' : ch;
  }
  return o;
}
// Contexto da sessão: a ÚLTIMA entrada `assistant` com `usage` que não seja de subagente (`isSidechain`). Entrada de subagente
// carrega o contexto dele, e depois de compactar a última já vem menor, por isso vale só a última leitura (nada se soma).
// → `{ tokens, em }` (`em` = timestamp da entrada), ou null se não há nenhum `usage`. Transcript ilegível LANÇA: quem chama registra `erro`.
export function contextoDoTranscript(caminho) {
  const linhas = readFileSync(caminho, 'utf8').split('\n');
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (!linhas[i]) continue;
    let e; try { e = JSON.parse(linhas[i]); } catch { continue; }
    const u = e?.message?.usage;
    // Entrada sintética (`<synthetic>`, ex.: "No response requested.") traz `usage` zerado e não é leitura do contexto .
    if (e?.type !== 'assistant' || e?.isSidechain === true || e?.message?.model === '<synthetic>' || !u) continue;
    const tokens = [u.input_tokens, u.cache_creation_input_tokens, u.cache_read_input_tokens].reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
    return { tokens, em: e.timestamp ?? null };
  }
  return null;
}
