// F439 (ADR 0030, fatia 2): a sessão do Orca no painel. O Orca não tem o registro de sessões do app; o que liga o id do CLI
// (o `session_id` dos hooks, que troca a cada limpeza de contexto) ao endereço da sessão (`orca_session_id:<id>`) é o arquivo
// `<BASE>/orca-sessoes/<id>.json`, gravado pelo início da sessão no Orca. Formato:
//   { orcaId, cliAtual, cliIds: [atual, ...anteriores], terminal, enderecoDoSend, cwd, em }
// `enderecoDoSend` é o `--to` do `orca orchestration send` (medido em 06/11: o `orca_session_id:<id>` entrega; o handle do
// terminal, guardado em `terminal`, também). Quem apaga o arquivo da sessão que acabou é o limpador da fatia 4.
// Não depende de `anfitriao()`: quem lê pergunta pelo id, e o teste que herda as envs do Orca não muda de caminho.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE } from './hooks-crewai-comum.mjs';
import { ID_DO_ORCA } from './anfitriao.mjs';

const PREFIXO = 'orca_session_id:';
const ID_CRU = /^[A-Za-z0-9_-]{1,200}$/;
const texto = (v) => (typeof v === 'string' ? v.trim() : '');

export const pastaDasSessoesDoOrca = () => join(BASE, 'orca-sessoes');
const arquivo = (cru) => join(pastaDasSessoesDoOrca(), `${cru}.json`);
const cruDe = (orcaId) => (typeof orcaId === 'string' && ID_DO_ORCA.test(orcaId) ? orcaId.slice(PREFIXO.length) : null);

function ler(f) {
  try {
    const d = JSON.parse(readFileSync(f, 'utf8'));
    return d && typeof d === 'object' && ID_DO_ORCA.test(String(d.orcaId)) && typeof d.cliAtual === 'string' ? d : null;
  } catch { return null; }
}

/** O registro gravado da sessão `orca_session_id:<id>`; null quando não há ou o id não é do Orca. */
export function lerSessaoDoOrca(orcaId) {
  const cru = cruDe(orcaId);
  return cru && ID_CRU.test(cru) ? ler(arquivo(cru)) : null;
}

/** A sessão do Orca cujo id do CLI (atual ou anterior) é `cliId`; null quando nenhuma. A pasta é pequena: uma por sessão viva. */
export function sessaoDoOrcaPeloCli(cliId) {
  if (!texto(cliId)) return null;
  const dir = pastaDasSessoesDoOrca();
  if (!existsSync(dir)) return null;
  let nomes = [];
  try { nomes = readdirSync(dir).filter((n) => n.endsWith('.json')); } catch { return null; }
  for (const n of nomes) {
    const d = ler(join(dir, n));
    if (d && (d.cliAtual === cliId || (Array.isArray(d.cliIds) && d.cliIds.includes(cliId)))) return d;
  }
  return null;
}

/**
 * Grava (ou regrava, na limpeza de contexto) a sessão do Orca desta sessão. Só com `ORCA_AGENT_SESSION_ID` legível e o id do
 * CLI; senão null e nada se grava. O id do CLI anterior fica em `cliIds`, depois do atual. → o registro gravado.
 */
export function gravarSessaoDoOrca({ env = process.env, cliId, cwd, agora = Date.now() } = {}) {
  const cru = texto(env.ORCA_AGENT_SESSION_ID);
  const cli = texto(cliId);
  if (!cli || !ID_CRU.test(cru)) return null;
  const orcaId = `${PREFIXO}${cru}`;
  const antes = lerSessaoDoOrca(orcaId);
  const anteriores = Array.isArray(antes?.cliIds) ? antes.cliIds.filter((x) => typeof x === 'string' && x && x !== cli) : [];
  const reg = {
    orcaId,
    cliAtual: cli,
    cliIds: [cli, ...anteriores],
    terminal: texto(env.ORCA_TERMINAL_HANDLE) || null,
    enderecoDoSend: orcaId,
    cwd: texto(cwd) || null,
    em: new Date(agora).toISOString(),
  };
  mkdirSync(pastaDasSessoesDoOrca(), { recursive: true });
  const f = arquivo(cru);
  const tmp = `${f}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(reg, null, 2)}\n`);
  renameSync(tmp, f);
  return reg;
}

/**
 * O registro da sessão no formato do `registroDaSessao` (pool-comum), para o id do Orca ou para o id do CLI de uma sessão do
 * Orca; null quando o id não é de sessão do Orca registrada. A sessão do Orca não tem título nem arquivamento no kit.
 */
export function registroDoOrca(id) {
  const d = ID_DO_ORCA.test(String(id)) ? lerSessaoDoOrca(id) : sessaoDoOrcaPeloCli(id);
  if (!d) return null;
  const cliIds = [...new Set([d.cliAtual, ...(Array.isArray(d.cliIds) ? d.cliIds : [])].filter((x) => typeof x === 'string' && x))];
  return { localId: d.orcaId, titulo: '', arquivada: false, cwd: d.cwd || null, originCwd: d.cwd || null, cliIds, cliAtual: d.cliAtual, anterior: id !== d.orcaId && id !== d.cliAtual };
}
