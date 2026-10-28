#!/usr/bin/env node
// Stop hook: numa sessão orquestradora, o turno só termina depois do que a batida não resolve: o item sem dona (abrir a sessão
// dona, até o teto de donas trabalhando), o resumo do modo ausente e a batida parada. O estado mecânico das sessões e o item
// parado são da batida (mod painel-sessoes); a orquestradora só lê o relatório dela.
// O resumo do modo ausente: havendo período desligado (≤ 7 dias) sem entrega registrada para o projeto
// (skills/orquestradora/scripts/ausencia.mjs, seção `resumo-da-ausencia`).
// O teto: `KIT_TETO_DE_DONAS` (padrão 4), 3 com a máquina cheia; acima dele o item espera sem cobrança.
// A sessão é orquestradora quando existe ~/.claude/orquestracao/ativas/<session_id>.
import { readFileSync, existsSync, appendFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, modoAusente } from './hooks-crewai-comum.mjs';
import { semDona, donaACaminho, tetoDeDonas, donaTrabalhando } from './sem-dona.mjs';
import { filaDir, maquinaCheia } from './pool-comum.mjs';
import { pendente, projetoDoRepo } from '../skills/orquestradora/scripts/ausencia.mjs';

const AUSENCIA = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'orquestradora', 'scripts', 'ausencia.mjs');

// Minutos sem dona a partir dos quais o ritual cobra abrir a sessão dona do item.
const ESPERA_MIN = (() => { const n = Number(process.env.ESPERA_MIN); return Number.isInteger(n) && n > 0 ? n : 5; })();

// Minutos sem a batida escrever o relatório do projeto a partir dos quais o ritual avisa que o mod não a está rodando.
const BATIDA_VELHA_MIN = (() => { const n = Number(process.env.BATIDA_VELHA_MIN); return Number.isInteger(n) && n > 0 ? n : 30; })();

const LOG = join(homedir(), '.claude', 'orquestracao', 'ritual-hook.log');

// Os cartões de sessão dona esperando o clique (coleção `cartoes`, ao lado da fila): o `data` de cada um.
function cartoes() {
  const dir = join(dirname(filaDir()), 'cartoes');
  let nomes; try { nomes = readdirSync(dir).filter((n) => n.endsWith('.json')); } catch { return []; }
  return nomes.flatMap((n) => { try { return [JSON.parse(readFileSync(join(dir, n), 'utf8'))?.data]; } catch { return []; } });
}

// As sessões vivas que a batida leu na última rodada (`batida/sessoes.json`); velha como a batida parada, não vale.
function sessoesDaBatida() {
  const arq = join(BASE, 'batida', 'sessoes.json');
  try {
    if (Date.now() - statSync(arq).mtimeMs >= BATIDA_VELHA_MIN * 60_000) return [];
    const l = JSON.parse(readFileSync(arq, 'utf8'));
    return Array.isArray(l) ? l : [];
  } catch { return []; }
}

// Itens do projeto da orquestradora sem dona há ESPERA_MIN ou mais, menos os que já têm a dona a caminho (cartão esperando o
// clique ou sessão `F<n> · …` viva): cobrar de novo abre a segunda dona do item (F218).
function itensSemDona(nomeProjeto) {
  const dir = filaDir();
  if (!nomeProjeto || !existsSync(dir)) return [];
  let aCaminho = null; // lidos só quando há item sem dona
  const itens = [];
  for (const nome of readdirSync(dir)) {
    if (!nome.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(dir, nome), 'utf8'));
      if (String(doc?.data?.projeto ?? '').toLowerCase() !== nomeProjeto) continue;
      const e = semDona(doc.data, Date.now());
      if (!e || e.minutos < ESPERA_MIN) continue;
      const F = doc.id ?? nome.replace(/\.json$/, '');
      aCaminho ??= { cartoes: cartoes(), sessoes: sessoesDaBatida(), agoraMs: Date.now() };
      if (!donaACaminho(F, aCaminho)) itens.push({ id: F, data: doc.data, ...e });
    } catch { /* item ilegível: ignora */ }
  }
  return itens;
}

// Donas trabalhando agora no projeto (item com dona ou `com` numa etapa de trabalho; `merge` não conta).
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

// O item sem dona pede a sessão dona, até o teto de donas trabalhando; acima do teto, espera sem cobrança. Satisfaz: um
// `start_session` no turno, o modo ausente ligado (ninguém para abrir), gravar o dono do item ou mandar mensagem que o cite.
function cobrancaDeDona(nomeProjeto, comandos, usadas, mensagens) {
  const itens = itensSemDona(nomeProjeto);
  if (itens.length === 0) return [];
  if ([...usadas].some((n) => n.endsWith('start_session')) || modoAusente()) return [];
  const teto = maquinaCheia().cheia ? Math.min(3, tetoDeDonas()) : tetoDeDonas();
  const ocupadas = donasTrabalhando(nomeProjeto);
  if (ocupadas >= teto) return [];
  const cita = (id, x) => new RegExp(`\\b${id}\\b`).test(x);
  const faltam = itens.filter((it) => !comandos.some((c) => cita(it.id, c) && /donoLocalId/.test(c)) && !mensagens.some((m) => cita(it.id, m)));
  return faltam.slice(0, teto - ocupadas).map((it) => `${it.id} sem dona há ${it.minutos} min (${ocupadas} de ${teto} donas trabalhando): abra a sessão dona do item (start_session; fora do turno do operador, cartão)`);
}

// A batida escreve `batida/<projeto>.json` a cada rodada; sem ele, ou velho, o mod não a está rodando.
function faltaBatida(projeto) {
  let em = NaN;
  try { em = Date.parse(JSON.parse(readFileSync(join(BASE, 'batida', `${projeto}.json`), 'utf8'))?.em); } catch { /* sem relatório */ }
  const min = Math.floor((Date.now() - em) / 60_000);
  if (Number.isFinite(min) && min < BATIDA_VELHA_MIN) return null;
  return Number.isFinite(min)
    ? `A batida não roda há ${min} min: confira se o mod painel-sessoes está ligado.`
    : `A batida nunca escreveu o relatório de ${projeto}: confira se o mod painel-sessoes está ligado.`;
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
  for (const e of entradas.slice(inicio + 1)) {
    if (e.type !== 'assistant') continue;
    const c = e.message?.content;
    if (!Array.isArray(c)) continue;
    for (const item of c) {
      if (item.type !== 'tool_use') continue;
      usadas.add(item.name);
      if (item.name === 'Bash') {
        const cmd = String(item.input?.command ?? '');
        comandos.push(cmd);
      }
      if (/(^|__)(SendMessage|send_message)$/.test(item.name)) mensagens.push(JSON.stringify(item.input ?? {}));
    }
  }

  const projeto = projetoDoRepo(input.cwd || process.cwd());
  const periodo = projeto ? pendente(projeto) : null;
  const itensSemDona = projeto ? cobrancaDeDona(projeto, comandos, usadas, mensagens) : [];
  const batidaParada = projeto ? faltaBatida(projeto) : null;
  if (!periodo && itensSemDona.length === 0 && !batidaParada) return;
  const resumo = periodo
    ? `O operador desligou o modo ausente (período de ${periodo.desde} a ${periodo.ate}) e o resumo ainda não foi entregue: ` +
      `rode \`node "${AUSENCIA}" resumo --md\`, entregue o resumo no formato da skill orquestradora (seção resumo-da-ausencia) e registre com \`node "${AUSENCIA}" entregue\`. `
    : '';
  const paradas = itensSemDona.length > 0 ? `Item sem dona (protocolo.md#sem-dona): ${itensSemDona.join(' · ')}.` : '';
  process.stdout.write(JSON.stringify({ decision: 'block', reason: [resumo.trim(), paradas, batidaParada].filter(Boolean).join('\n') }));
}

try {
  main();
} catch (err) {
  try { appendFileSync(LOG, `${new Date().toISOString()} ${err?.stack || err}\n`); } catch { /* sem log */ }
}
process.exitCode = 0;
