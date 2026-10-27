#!/usr/bin/env node
// Stop hook: numa sessão orquestradora, o turno só termina depois do que a batida não resolve (ADR 0007): o item esperando
// papel sem membro livre (pedir a vaga), o piso de E, o resumo do modo ausente, a batida parada e os livres além do teto. O estado mecânico das
// sessões, o item parado e o aviso ao livre são da batida (mod painel-sessoes); a orquestradora só lê o relatório dela.
// F59: e, havendo período do modo ausente desligado (≤ 7 dias) sem entrega registrada para o projeto, o resumo
// (skills/orquestradora/scripts/ausencia.mjs, seção `resumo-da-ausencia`).
// A sessão é orquestradora quando existe ~/.claude/orquestracao/ativas/<session_id>.
// ADR 0011: com o modelo da dona (padrão) não há piso de E nem excedentes; o item sem ninguém pede abrir a dona, até o teto
// de donas trabalhando (`KIT_TETO_DE_DONAS`, padrão 4; 3 com a máquina cheia). `KIT_MODELO=papeis` volta ao pool.
import { readFileSync, existsSync, appendFileSync, readdirSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, modoAusente } from './hooks-crewai-comum.mjs';
import { esperandoPapel, PAPEL_DA_ETAPA } from './esperando-papel.mjs';
import { filaDir, gitCommonDir, membrosLivres, chaveDoPiso, maquinaCheia } from './pool-comum.mjs';
import { modeloDaDona, tetoDeDonas, donaTrabalhando } from './modelo-do-kit.mjs';
import { pendente, projetoDoRepo } from '../skills/orquestradora/scripts/ausencia.mjs';

const AUSENCIA = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'orquestradora', 'scripts', 'ausencia.mjs');

// Minutos de espera a partir dos quais o ritual cobra o item parado sem o papel da etapa (F58, D3).
const ESPERA_MIN = (() => { const n = Number(process.env.ESPERA_MIN); return Number.isInteger(n) && n > 0 ? n : 5; })();

// Minutos em que o cartão de vaga de E já proposto dispensa um novo (marca em BASE/piso).
const PISO_VAGA_MIN = (() => { const n = Number(process.env.PISO_VAGA_MIN); return Number.isInteger(n) && n > 0 ? n : 720; })();

// Minutos sem a batida escrever o relatório do projeto a partir dos quais o ritual avisa que o mod não a está rodando.
const BATIDA_VELHA_MIN = (() => { const n = Number(process.env.BATIDA_VELHA_MIN); return Number.isInteger(n) && n > 0 ? n : 30; })();

const LOG = join(homedir(), '.claude', 'orquestracao', 'ritual-hook.log');

// Itens do projeto da orquestradora esperando o papel da etapa há ESPERA_MIN ou mais.
function itensEsperando(nomeProjeto) {
  const dir = filaDir();
  if (!nomeProjeto || !existsSync(dir)) return [];
  const itens = [];
  for (const nome of readdirSync(dir)) {
    if (!nome.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(dir, nome), 'utf8'));
      if (String(doc?.data?.projeto ?? '').toLowerCase() !== nomeProjeto) continue;
      const e = esperandoPapel(doc.data, Date.now());
      if (e && e.minutos >= ESPERA_MIN) itens.push({ id: doc.id ?? nome.replace(/\.json$/, ''), data: doc.data, ...e });
    } catch { /* item ilegível: ignora */ }
  }
  return itens;
}

// Itens do projeto parados por `espera` `gate` (máquina cheia, ADR 0005): ninguém mais os cobra, então o ritual cobra apagar a espera quando a máquina volta.
function itensComEsperaGate(nomeProjeto) {
  const dir = filaDir();
  if (!nomeProjeto || !existsSync(dir)) return [];
  const itens = [];
  for (const nome of readdirSync(dir)) {
    if (!nome.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(dir, nome), 'utf8'));
      if (String(doc?.data?.projeto ?? '').toLowerCase() !== nomeProjeto || doc?.data?.espera?.motivo !== 'gate') continue;
      if (!PAPEL_DA_ETAPA[doc.data.etapa]) continue;
      itens.push(doc.id ?? nome.replace(/\.json$/, ''));
    } catch { /* item ilegível: ignora */ }
  }
  return itens;
}

// Donas trabalhando agora no projeto (item `via: "dona"` com dona ou `com`, fora de `merge`).
function donasTrabalhando(nomeProjeto) {
  const dir = filaDir();
  if (!nomeProjeto || !existsSync(dir)) return 0;
  let n = 0;
  for (const nome of readdirSync(dir)) {
    if (!nome.endsWith('.json')) continue;
    try {
      const d = JSON.parse(readFileSync(join(dir, nome), 'utf8'))?.data;
      if (String(d?.projeto ?? '').toLowerCase() === nomeProjeto && donaTrabalhando(d)) n++;
    } catch { /* item ilegível: ignora */ }
  }
  return n;
}

const textoDaMaquina = (m) => `${m.tomadas} de ${m.teto} fichas${m.carga >= m.nucleos ? `, carga ${m.carga.toFixed(1)}` : ''}`;

// O que falta por item esperando (F58): pedir a vaga (não há membro livre do papel; havendo, a batida o avisa), cobrar a dona de avançar a
// etapa (a parte já foi entregue) ou confirmar com a dona (validação sem V, sem registro de quem validou).
function cobrancaDeEspera(cwd, nomeProjeto, comandos, usadas, mensagens) {
  const itens = itensEsperando(nomeProjeto);
  const maquina = maquinaCheia();
  const faltas = [];
  if (!maquina.cheia) {
    for (const id of itensComEsperaGate(nomeProjeto)) {
      if (comandos.some((c) => new RegExp(`\\b${id}\\b`).test(c) && /"espera"\s*:\s*null/.test(c))) continue;
      faltas.push(`${id} com espera "máquina cheia" e a máquina livre: apague a espera (painel update fila ${id} '{"espera":null}') e despache`);
    }
  }
  if (itens.length === 0) return faltas;
  if (modeloDaDona()) {
    // ADR 0011: o item sem ninguém pede a sessão dona, não um papel; acima do teto, espera sem cobrança.
    if ([...usadas].some((n) => n.endsWith('start_session')) || modoAusente()) return faltas;
    const teto = maquina.cheia ? Math.min(3, tetoDeDonas()) : tetoDeDonas();
    const ocupadas = donasTrabalhando(nomeProjeto);
    if (ocupadas >= teto) return faltas;
    const semDona = itens.filter((it) => !comandos.some((c) => new RegExp(`\\b${it.id}\\b`).test(c) && /donoLocalId/.test(c)) && !mensagens.some((m) => new RegExp(`\\b${it.id}\\b`).test(m)));
    for (const it of semDona.slice(0, teto - ocupadas)) faltas.push(`${it.id} sem dona há ${it.minutos} min (${ocupadas} de ${teto} donas trabalhando): abra a sessão dona do item (start_session; fora do turno do operador, cartão)`);
    return faltas;
  }
  const repo = gitCommonDir(cwd);
  const livres = membrosLivres(repo);
  const pediuVaga = [...usadas].some((n) => n.endsWith('start_session')) || Boolean(modoAusente());
  const comAdd = (id) => comandos.some((c) => new RegExp(`\\bcom\\s+add\\s+${id}\\b`).test(c));
  const citou = (id) => mensagens.some((m) => new RegExp(`\\b${id}\\b`).test(m));
  const gravouEspera = (id) => comandos.some((c) => new RegExp(`\\b${id}\\b`).test(c) && /espera/.test(c));
  // Máquina cheia (ADR 0005): não se despacha V nem se pede vaga de E ou V; a cobrança é gravar `espera` `gate` no item. Vale no modo ausente também.
  for (const it of itens) {
    const dona = it.data.donoApelido ? ` (${it.data.donoApelido})` : '';
    if (it.entregue) {
      if (citou(it.id)) continue;
      const por = [...(it.data.fez ?? [])].reverse().find((f) => String(f?.apelido ?? '').toUpperCase().startsWith(it.papel))?.apelido ?? it.papel;
      faltas.push(`${it.id} entregue pela ${por} há ${it.minutos} min: cobre a dona${dona} para avançar a etapa`);
      continue;
    }
    if (maquina.cheia && it.papel === 'V') {
      if (gravouEspera(it.id)) continue;
      faltas.push(`${it.id} esperando V com a máquina cheia (${textoDaMaquina(maquina)}): grave espera {"motivo":"gate","texto":"máquina cheia"} no item`);
      continue;
    }
    const doPapel = livres.filter((m) => m.papel === it.papel);
    const base = `${it.id} esperando ${it.papel} há ${it.minutos} min`;
    const confirma = it.papel === 'V';
    const frase = confirma ? `${it.id} sem V no item há ${it.minutos} min: confirme com a dona${dona} se a validação já voltou antes de despachar` : base;
    if (doPapel.length > 0) continue; // há livre do papel: a batida o avisa e ele roda `painel pegar`
    if (comAdd(it.id) || (confirma && citou(it.id))) continue;
    if (!pediuVaga && !(maquina.cheia && (it.papel === 'E' || it.papel === 'V'))) faltas.push(`${frase} — sem ${it.papel} livre: peça a vaga (start_session; fora do turno do operador, cartão)`);
  }
  return faltas;
}

const marcaDoPiso = (repo) => join(BASE, 'piso', `${chaveDoPiso(repo)}.json`);
function marcaNoPrazo(repo) {
  try {
    const m = JSON.parse(readFileSync(marcaDoPiso(repo), 'utf8'));
    const em = Date.parse(m?.em);
    return m?.repo === repo && Number.isFinite(em) && Date.now() - em < PISO_VAGA_MIN * 60_000;
  } catch { return false; }
}
function gravarMarca(repo, sessao) {
  try {
    mkdirSync(join(BASE, 'piso'), { recursive: true });
    writeFileSync(marcaDoPiso(repo), JSON.stringify({ repo, em: new Date().toISOString(), sessao }));
  } catch { /* sem marca: o piso cobra de novo */ }
}
function apagarMarca(repo) { try { unlinkSync(marcaDoPiso(repo)); } catch { /* já não existe */ } }

// Piso de uma E livre (ADR 0004): sem E livre e sem start_session no turno cobra a vaga; o start_session de E grava uma marca
// em BASE/piso que dispensa nova cobrança por PISO_VAGA_MIN min ou até aparecer E livre (a marca some).
function faltaPiso(cwd, usadas, startsDeE, sessao) {
  if (modeloDaDona()) return null; // ADR 0011: sem pool, sem piso
  if (maquinaCheia().cheia) return null; // máquina cheia (ADR 0005): pedir vaga agora só pesa mais
  if (modoAusente()) return null;
  const repo = gitCommonDir(cwd);
  if (!repo) return null;
  if (membrosLivres(repo).some((m) => m.papel === 'E')) { apagarMarca(repo); return null; }
  if ([...usadas].some((n) => n.endsWith('start_session'))) { if (startsDeE) gravarMarca(repo, sessao); return null; }
  if (marcaNoPrazo(repo)) return null;
  return 'Piso do pool (ADR 0004): sem E livre no projeto: peça a vaga (start_session; fora do turno do operador, cartão).';
}

// A batida (ADR 0007) escreve `batida/<projeto>.json` a cada rodada; sem ele, ou velho, o mod não a está rodando.
function faltaBatida(projeto) {
  let em = NaN;
  try { em = Date.parse(JSON.parse(readFileSync(join(BASE, 'batida', `${projeto}.json`), 'utf8'))?.em); } catch { /* sem relatório */ }
  const min = Math.floor((Date.now() - em) / 60_000);
  if (Number.isFinite(min) && min < BATIDA_VELHA_MIN) return null;
  return Number.isFinite(min)
    ? `A batida não roda há ${min} min: confira se o mod painel-sessoes está ligado.`
    : `A batida nunca escreveu o relatório de ${projeto}: confira se o mod painel-sessoes está ligado.`;
}

// Os livres além do teto de dois por papel (Q394) que a batida relata em `excedentes`: com o modo ausente desligado, o turno arquiva
// os que seguem livres. Só conta o que ainda é livre agora (o relatório pode ter até 10 min) e não foi arquivado neste turno.
function faltaArquivar(cwd, projeto, arquivadas) {
  if (modeloDaDona()) return null; // ADR 0011: sem pool, sem excedentes
  if (modoAusente()) return null;
  let lista = [];
  try { lista = JSON.parse(readFileSync(join(BASE, 'batida', `${projeto}.json`), 'utf8'))?.excedentes ?? []; } catch { /* sem relatório */ }
  if (!Array.isArray(lista) || lista.length === 0) return null;
  const livres = new Set(membrosLivres(gitCommonDir(cwd)).map((m) => m.localId));
  const faltam = lista.filter((x) => x?.localId && livres.has(x.localId) && !arquivadas.has(x.localId));
  if (faltam.length === 0) return null;
  return `Livres além do teto de dois por papel: ${faltam.map((x) => x.apelido).join(', ')}: arquive (archive_session) quem cumpre as cinco condições da skill orquestradora e liste numa linha no relatório.`;
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const { session_id, transcript_path, stop_hook_active } = input;
  if (!session_id || !existsSync(join(homedir(), '.claude', 'orquestracao', 'ativas', session_id))) return;
  if (stop_hook_active) return; // já cobrou uma vez neste turno; não prende em laço

  const linhas = readFileSync(transcript_path, 'utf8').split('\n').filter(Boolean);
  const entradas = [];
  for (const l of linhas) {
    try { entradas.push(JSON.parse(l)); } catch { /* linha parcial */ }
  }

  // Início do turno: a última mensagem com origem (operador, sessão, notificação).
  let inicio = -1;
  for (let i = entradas.length - 1; i >= 0; i--) {
    const e = entradas[i];
    if (e.type === 'user' && e.origin && e.origin.kind) { inicio = i; break; }
  }
  if (inicio < 0) return;

  const usadas = new Set();
  const comandos = [];
  const mensagens = [];
  let startsDeE = false;
  const arquivadas = new Set();
  for (const e of entradas.slice(inicio + 1)) {
    if (e.type !== 'assistant') continue;
    const c = e.message?.content;
    if (!Array.isArray(c)) continue;
    for (const item of c) {
      if (item.type !== 'tool_use') continue;
      usadas.add(item.name);
      if (item.name.endsWith('start_session') && /^E\d+\b/.test(String(item.input?.title ?? ''))) startsDeE = true;
      if (item.name.endsWith('archive_session') && item.input?.session_id) arquivadas.add(String(item.input.session_id));
      if (item.name === 'Bash') {
        const cmd = String(item.input?.command ?? '');
        comandos.push(cmd);
      }
      if (/(^|__)(SendMessage|send_message)$/.test(item.name)) mensagens.push(JSON.stringify(item.input ?? {}));
    }
  }

  const projeto = projetoDoRepo(input.cwd || process.cwd());
  const periodo = projeto ? pendente(projeto) : null;
  const espera = cobrancaDeEspera(input.cwd || process.cwd(), projeto, comandos, usadas, mensagens);
  const piso = projeto ? faltaPiso(input.cwd || process.cwd(), usadas, startsDeE, session_id) : null;
  const batidaParada = projeto ? faltaBatida(projeto) : null;
  const arquivar = projeto ? faltaArquivar(input.cwd || process.cwd(), projeto, arquivadas) : null;
  if (!periodo && espera.length === 0 && !piso && !batidaParada && !arquivar) return;
  const resumo = periodo
    ? `O operador desligou o modo ausente (período de ${periodo.desde} a ${periodo.ate}) e o resumo ainda não foi entregue: ` +
      `rode \`node "${AUSENCIA}" resumo --md\`, entregue o resumo no formato da skill orquestradora (seção resumo-da-ausencia) e registre com \`node "${AUSENCIA}" entregue\`. `
    : '';
  const paradas = espera.length > 0
    ? (modeloDaDona() ? `Item sem dona (protocolo.md#modelo-da-dona): ${espera.join(' · ')}.` : `Item parado sem o papel da etapa (protocolo.md#esperando-papel): ${espera.join(' · ')}.`)
    : '';
  process.stdout.write(JSON.stringify({ decision: 'block', reason: [resumo.trim(), paradas, piso, batidaParada, arquivar].filter(Boolean).join('\n') }));
}

try {
  main();
} catch (err) {
  try { appendFileSync(LOG, `${new Date().toISOString()} ${err?.stack || err}\n`); } catch { /* sem log */ }
}
process.exitCode = 0;
