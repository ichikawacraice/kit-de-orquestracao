#!/usr/bin/env node
// Stop hook: numa sessão orquestradora, o turno só termina depois do ritual
// (skill orquestradora, seção "Ritual de cada turno"): list_sessions e um
// gravação no painel (painel.mjs set|update|batch|delete) desde a última mensagem que abriu o turno.
// F59: e, havendo período do modo ausente desligado (≤ 7 dias) sem entrega registrada para o projeto, o resumo
// (skills/orquestradora/scripts/ausencia.mjs, seção `resumo-da-ausencia`).
// A sessão é orquestradora quando existe ~/.claude/orquestracao/ativas/<session_id>.
import { readFileSync, existsSync, appendFileSync, readdirSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, gravaNoPainel, modoAusente } from './hooks-crewai-comum.mjs';
import { esperandoPapel } from './esperando-papel.mjs';
import { filaDir, gitCommonDir, membrosLivres, chaveDoPiso, maquinaCheia } from './pool-comum.mjs';
import { pendente, projetoDoRepo } from '../skills/orquestradora/scripts/ausencia.mjs';

const AUSENCIA = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'orquestradora', 'scripts', 'ausencia.mjs');

// Minutos de espera a partir dos quais o ritual cobra o item parado sem o papel da etapa (F58, D3).
const ESPERA_MIN = (() => { const n = Number(process.env.ESPERA_MIN); return Number.isInteger(n) && n > 0 ? n : 5; })();

// Minutos em que o cartão de vaga de E já proposto dispensa um novo (marca em BASE/piso).
const PISO_VAGA_MIN = (() => { const n = Number(process.env.PISO_VAGA_MIN); return Number.isInteger(n) && n > 0 ? n : 720; })();

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

const textoDaMaquina = (m) => `${m.tomadas} de ${m.teto} fichas${m.carga >= m.nucleos ? `, carga ${m.carga.toFixed(1)}` : ''}`;

// O que falta por item esperando (F58): despachar (há membro livre do papel), pedir a vaga (não há), cobrar a dona de avançar a
// etapa (a parte já foi entregue) ou confirmar com a dona (validação sem V, sem registro de quem validou).
function cobrancaDeEspera(cwd, nomeProjeto, comandos, usadas, mensagens) {
  const itens = itensEsperando(nomeProjeto);
  if (itens.length === 0) return [];
  const repo = gitCommonDir(cwd);
  const livres = membrosLivres(repo);
  const pediuVaga = [...usadas].some((n) => n.endsWith('start_session')) || Boolean(modoAusente());
  const comAdd = (id) => comandos.some((c) => new RegExp(`\\bcom\\s+add\\s+${id}\\b`).test(c));
  const citou = (id) => mensagens.some((m) => new RegExp(`\\b${id}\\b`).test(m));
  const gravouEspera = (id) => comandos.some((c) => new RegExp(`\\b${id}\\b`).test(c) && /espera/.test(c));
  // Máquina cheia (ADR 0005): não se despacha V nem se pede vaga de E ou V; a cobrança é gravar `espera` `gate` no item. Vale no modo ausente também.
  const maquina = maquinaCheia();
  const faltas = [];
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
    if (comAdd(it.id) || (confirma && citou(it.id))) continue;
    if (doPapel.length > 0) faltas.push(`${frase} — livres: ${doPapel.map((m) => m.apelido).join(', ')}: despache (título + painel com add + mensagem)`);
    else if (!pediuVaga && !maquina.cheia) faltas.push(`${frase} — sem ${it.papel} livre: peça a vaga (start_session; fora do turno do operador, cartão)`);
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
  if (maquinaCheia().cheia) return null; // máquina cheia (ADR 0005): pedir vaga agora só pesa mais
  if (modoAusente()) return null;
  const repo = gitCommonDir(cwd);
  if (!repo) return null;
  if (membrosLivres(repo).some((m) => m.papel === 'E')) { apagarMarca(repo); return null; }
  if ([...usadas].some((n) => n.endsWith('start_session'))) { if (startsDeE) gravarMarca(repo, sessao); return null; }
  if (marcaNoPrazo(repo)) return null;
  return 'Piso do pool (ADR 0004): sem E livre no projeto: peça a vaga (start_session; fora do turno do operador, cartão).';
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
  let gravou = false;
  let startsDeE = false;
  for (const e of entradas.slice(inicio + 1)) {
    if (e.type !== 'assistant') continue;
    const c = e.message?.content;
    if (!Array.isArray(c)) continue;
    for (const item of c) {
      if (item.type !== 'tool_use') continue;
      usadas.add(item.name);
      if (item.name.endsWith('start_session') && /^E\d+\b/.test(String(item.input?.title ?? ''))) startsDeE = true;
      if (item.name === 'Bash') {
        const cmd = String(item.input?.command ?? '');
        comandos.push(cmd);
        if (gravaNoPainel(cmd)) gravou = true;
      }
      if (/(^|__)(SendMessage|send_message)$/.test(item.name)) mensagens.push(JSON.stringify(item.input ?? {}));
    }
  }

  const faltam = [];
  if (![...usadas].some((n) => n.endsWith('list_sessions'))) faltam.push('list_sessions {"linked": true}');
  if (!gravou) faltam.push('gravar no painel com painel.mjs (batch com o que mudou, ou ao menos update da própria linha)');
  const projeto = projetoDoRepo(input.cwd || process.cwd());
  const periodo = projeto ? pendente(projeto) : null;
  const espera = cobrancaDeEspera(input.cwd || process.cwd(), projeto, comandos, usadas, mensagens);
  const piso = projeto ? faltaPiso(input.cwd || process.cwd(), usadas, startsDeE, session_id) : null;
  if (faltam.length === 0 && !periodo && espera.length === 0 && !piso) return;
  const resumo = periodo
    ? `O operador desligou o modo ausente (período de ${periodo.desde} a ${periodo.ate}) e o resumo ainda não foi entregue: ` +
      `rode \`node "${AUSENCIA}" resumo --md\`, entregue o resumo no formato da skill orquestradora (seção resumo-da-ausencia) e registre com \`node "${AUSENCIA}" entregue\`. `
    : '';
  const ritual = faltam.length > 0
    ? `Ritual da orquestradora não feito neste turno. Falta: ${faltam.join('; ')}. ` +
      'Rode list_sessions, liste as candidatas a arquivar (as cinco condições): arquive sozinha o membro do pool sem item vivo com o modo ausente desligado (com ele ligado, só a pedido do operador no turno dele) e leve ao operador a sessão avulsa fora do pool; dê set na sessão sem linha, ' +
      'tire o estado mecânico (isRunning → trabalhando, arquivada → concluida) e grave tudo no painel ' +
      'com `painel batch \'[...]\'`. Depois responda.'
    : '';
  const paradas = espera.length > 0
    ? `Item parado sem o papel da etapa (protocolo.md#esperando-papel): ${espera.join(' · ')}.`
    : '';
  process.stdout.write(JSON.stringify({ decision: 'block', reason: [resumo.trim(), ritual, paradas, piso].filter(Boolean).join('\n') }));
}

try {
  main();
} catch (err) {
  try { appendFileSync(LOG, `${new Date().toISOString()} ${err?.stack || err}\n`); } catch { /* sem log */ }
}
process.exitCode = 0;
