// Perguntas do painel do kit, lidas e respondidas pela aba do Orca (F436).
// A resposta grava a prova do clique do operador (`respondidaPor: "operador-orca"` + `respondidaEm`), que o `painel update`
// recusa: só a tela grava. A gravação entra na trava do painel (a mesma `.trava` do `painel.mjs`, publicada inteira por
// rename) e é presa à versão lida, para não sobrescrever quem respondeu antes. Só módulos nativos: roda no worker do Orca e no `node --test`.
import { mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { destinoValido } from './envio.mjs';

export const ORIGEM = 'operador-orca';
export const RESPOSTA_DE_CONFIRMACAO = 'confirmada pelo operador (Orca)';
const ID = /^Q\d+$/;
const ESTADOS_DA_ENTREGA = new Set(['entregue', 'pendente', 'falhou']);

export class RecusaDoPainel extends Error {
  constructor(codigo, message) { super(message); this.name = 'RecusaDoPainel'; this.codigo = codigo; }
}

const texto = (v) => (typeof v === 'string' && v.trim() ? v : null);

// As opções da pergunta, como o pane do app as lê: na ordem, só as que têm `id` (texto); sem `label`, o rótulo é o `id`.
function opcoesDe(v) {
  if (!Array.isArray(v)) return null;
  const lista = v.filter((o) => texto(o?.id)).map((o) => ({ id: o.id, label: texto(o.label) ?? o.id }));
  return lista.length ? lista : null;
}

function resumo(id, version, d) {
  // O endereço gravado manda (o inválido não vira destino). Sem ele, a pergunta do Orca gravada antes do campo existir
  // (F448) vai ao próprio sessaoId, que é o mesmo endereço que o painel do kit derivaria.
  const doOrca = typeof d.sessaoId === 'string' && d.sessaoId.startsWith('orca_session_id:') && destinoValido(d.sessaoId) ? d.sessaoId : null;
  const endereco = d.endereco != null ? (typeof d.endereco.orca === 'string' && destinoValido(d.endereco.orca) ? d.endereco.orca : null) : doOrca;
  return {
    id, versao: Number.isInteger(version) ? version : 0, estado: d.estado,
    titulo: texto(d.titulo) ?? '(sem título)', caso: texto(d.caso), seNaoDecidir: texto(d.seNaoDecidir), recomendacao: texto(d.recomendacao),
    item: texto(d.item), projeto: texto(d.projeto), sessaoId: texto(d.sessaoId), atualizadoEm: texto(d.atualizadoEm), endereco,
    opcoes: opcoesDe(d.opcoes),
  };
}

// O arquivo das fechadas (F183): `perguntas/arquivo/<projeto>/<AAAA-MM>/<Q>.json`, com o mês da resposta em São Paulo.
const ARQUIVO = 'arquivo';
const MES_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' });
const subpastas = (dir) => { try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; } };
const pastasDoArquivo = (pasta, meses) => {
  const raiz = join(pasta, 'perguntas', ARQUIVO);
  return subpastas(raiz).flatMap((proj) => subpastas(join(raiz, proj)).filter((m) => !meses || meses.has(m)).map((m) => join(raiz, proj, m)));
};
/** O caminho da pergunta: a pasta quente primeiro, depois o arquivo (a batida move a respondida para lá em até 10 min). */
function acharArquivo(pasta, id) {
  const quente = join(pasta, 'perguntas', `${id}.json`);
  if (existsSync(quente)) return quente;
  for (const dir of pastasDoArquivo(pasta)) if (existsSync(join(dir, `${id}.json`))) return join(dir, `${id}.json`);
  return null;
}

const PENDENTE_DIAS = 7;
const ehPendente = (d) => d?.estado === 'respondida' && d.respondidaPor === ORIGEM && ['falhou', 'pendente'].includes(d.entregaDaResposta?.estado);
function pendente(id, doc, d) {
  return {
    ...resumo(id, doc.version, d), resposta: texto(d.resposta) ?? '',
    estadoAnterior: d.estadoAnterior === 'assumida' ? 'assumida' : 'aberta', entregaDaResposta: d.entregaDaResposta,
  };
}

/**
 * As abertas e as assumidas da pasta quente do painel, mais as `pendentes`: respondidas por esta aba cuja entrega à
 * sessão não saiu (falhou ou não tinha endereço), na pasta quente ou já no arquivo (dos últimos 7 dias). As demais
 * respondidas e as fechadas não interessam à aba.
 */
export function lerPerguntas(pasta, { agoraMs = Date.now() } = {}) {
  const saida = { abertas: [], assumidas: [], pendentes: [], ilegiveis: 0 };
  let nomes = [];
  try { nomes = readdirSync(join(pasta, 'perguntas')).filter((n) => ID.test(n.replace(/\.json$/, '')) && n.endsWith('.json')); } catch { return saida; }
  for (const n of nomes) {
    let doc;
    try { doc = JSON.parse(readFileSync(join(pasta, 'perguntas', n), 'utf8')); } catch { saida.ilegiveis++; continue; }
    const d = doc?.data;
    if (!d || typeof d !== 'object') { saida.ilegiveis++; continue; }
    const id = doc.id ?? n.slice(0, -5);
    if (d.estado === 'aberta') saida.abertas.push(resumo(id, doc.version, d));
    else if (d.estado === 'assumida') saida.assumidas.push(resumo(id, doc.version, d));
    else if (ehPendente(d)) saida.pendentes.push(pendente(id, doc, d));
  }
  // As já arquivadas: só os meses que cobrem os últimos 7 dias, e só a resposta dada nesse intervalo.
  const desde = agoraMs - PENDENTE_DIAS * 86_400_000;
  const meses = new Set([MES_SP.format(new Date(agoraMs)).slice(0, 7), MES_SP.format(new Date(desde)).slice(0, 7)]);
  const vistos = new Set(saida.pendentes.map((q) => q.id));
  for (const dir of pastasDoArquivo(pasta, meses)) {
    let arquivos = [];
    try { arquivos = readdirSync(dir).filter((n) => ID.test(n.replace(/\.json$/, '')) && n.endsWith('.json')); } catch { continue; }
    for (const n of arquivos) {
      const id = n.slice(0, -5);
      if (vistos.has(id)) continue;
      let doc;
      try { doc = JSON.parse(readFileSync(join(dir, n), 'utf8')); } catch { continue; }
      const d = doc?.data;
      if (!ehPendente(d) || !(Date.parse(d.respondidaEm ?? '') >= desde)) continue;
      vistos.add(id);
      saida.pendentes.push(pendente(doc.id ?? id, doc, d));
    }
  }
  const recente = (a, b) => String(b.atualizadoEm ?? '').localeCompare(String(a.atualizadoEm ?? ''));
  saida.abertas.sort(recente);
  saida.assumidas.sort(recente);
  saida.pendentes.sort(recente);
  return saida;
}

// ── Trava do painel ────────────────────────────────────────────────────────────────────────────────────────────────
// Mesmo protocolo do `painel.mjs`: a `.trava` nasce completa (diretório com `dono` dentro, entra por rename) e sai por
// rename para nome único. A aba nunca rouba trava alheia (o `painel.mjs` cuida da órfã): espera um pouco e recusa.
function dormir(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function publicar(alvo, token) {
  const tmp = mkdtempSync(`${alvo}.novo-`);
  try {
    writeFileSync(join(tmp, 'dono'), token);
    if (existsSync(alvo)) return false;
    renameSync(tmp, alvo);
    return true;
  } catch (err) {
    if (err?.code === 'ENOTEMPTY' || err?.code === 'EEXIST') return false;
    throw err;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
function soltar(alvo, token) {
  try {
    if (readFileSync(join(alvo, 'dono'), 'utf8').trim() !== token) return;
    const destino = `${alvo}.solta.${process.pid}-${randomBytes(4).toString('hex')}`;
    renameSync(alvo, destino);
    rmSync(destino, { recursive: true, force: true });
  } catch { /* já solta */ }
}
function comTrava(pasta, esperaMs, fn) {
  const trava = join(pasta, '.trava');
  const token = `${process.pid}-${randomBytes(6).toString('hex')}`;
  const limite = Date.now() + esperaMs;
  while (!publicar(trava, token)) {
    if (Date.now() >= limite) throw new RecusaDoPainel('ocupado', 'o painel está ocupado gravando outra coisa; tente de novo em alguns segundos');
    dormir(25);
  }
  try { return fn(); } finally { soltar(trava, token); }
}

function lerDoc(pasta, id) {
  if (!ID.test(String(id))) throw new RecusaDoPainel('sumiu', `${id} não é um número de pergunta`);
  const f = acharArquivo(pasta, id);
  if (!f) throw new RecusaDoPainel('sumiu', `${id} não está mais no painel; recarregue`);
  return { f, doc: JSON.parse(readFileSync(f, 'utf8')) };
}
function gravarDoc(f, doc) {
  const tmp = `${f}.${process.pid}-${randomBytes(3).toString('hex')}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`);
  renameSync(tmp, f);
}

/** Grava a resposta do operador presa à versão e ao estado lidos. Devolve a versão nova; recusa com `RecusaDoPainel`. */
export function gravarResposta(pasta, { id, versao, esperado, resposta, agora, esperaMs = 3000 }) {
  if (typeof resposta !== 'string' || !resposta.trim()) throw new RecusaDoPainel('vazia', 'a resposta está vazia');
  return comTrava(pasta, esperaMs, () => {
    const { f, doc } = lerDoc(pasta, id);
    if (doc?.data?.estado !== esperado || doc.version !== versao) {
      throw new RecusaDoPainel('mudou', `${id} mudou desde que a aba leu (agora: ${String(doc?.data?.estado)}); nada gravado, recarregue`);
    }
    const nova = (doc.version ?? 0) + 1;
    gravarDoc(f, { id: doc.id ?? id, version: nova, data: { ...doc.data, estado: 'respondida', resposta: resposta.trim(), atualizadoEm: agora, respondidaPor: ORIGEM, respondidaEm: agora, estadoAnterior: esperado } });
    return { id, versao: nova };
  });
}

/** Confirma cada decisão assumida na própria versão; a que mudou fica de fora e volta na lista de recusadas. */
export function confirmarTodas(pasta, itens, agora) {
  const confirmadas = [];
  const recusadas = [];
  const versoes = {};
  for (const { id, versao } of itens) {
    try { versoes[id] = gravarResposta(pasta, { id, versao, esperado: 'assumida', resposta: RESPOSTA_DE_CONFIRMACAO, agora }).versao; confirmadas.push(id); }
    catch (err) { recusadas.push({ id, motivo: err?.message ?? String(err) }); }
  }
  return { confirmadas, recusadas, versoes };
}

/**
 * O "Desfazer" do confirmar: volta a decisão a assumida, presa à versão que a confirmação deixou. Só desfaz a
 * confirmação desta aba (resposta fixa, sem entrega): resposta escrita e o que alguém mexeu depois ficam como estão.
 */
export function desfazerConfirmacao(pasta, itens, esperaMs = 3000) {
  const desfeitas = [];
  const recusadas = [];
  for (const { id, versao } of itens) {
    try {
      comTrava(pasta, esperaMs, () => {
        const { f, doc } = lerDoc(pasta, id);
        const d = doc?.data ?? {};
        if (doc.version !== versao || d.estado !== 'respondida' || d.respondidaPor !== ORIGEM || d.resposta !== RESPOSTA_DE_CONFIRMACAO || d.entregaDaResposta) {
          throw new RecusaDoPainel('mudou', `${id} mudou depois da confirmação; não foi desfeita`);
        }
        const { resposta, respondidaPor, respondidaEm, estadoAnterior, ...resto } = d;
        // Assumida mora na pasta quente: se a batida já arquivou a confirmação, a decisão volta para lá.
        const quente = join(pasta, 'perguntas', `${id}.json`);
        gravarDoc(quente, { id: doc.id ?? id, version: doc.version + 1, data: { ...resto, estado: 'assumida' } });
        if (f !== quente) rmSync(f, { force: true });
      });
      desfeitas.push(id);
    } catch (err) { recusadas.push({ id, motivo: err?.message ?? String(err) }); }
  }
  return { desfeitas, recusadas };
}

/** Registra na pergunta o que aconteceu com a entrega da resposta (para quem entrega depois saber o que falta). */
export function gravarEntregaDaResposta(pasta, { id, versao, entrega, esperaMs = 3000 }) {
  if (!ESTADOS_DA_ENTREGA.has(entrega?.estado)) throw new RecusaDoPainel('invalida', `estado da entrega inválido: ${entrega?.estado}`);
  return comTrava(pasta, esperaMs, () => {
    const { f, doc } = lerDoc(pasta, id);
    if (doc.version !== versao) throw new RecusaDoPainel('mudou', `${id} mudou desde a resposta; a entrega não foi anotada`);
    const nova = doc.version + 1;
    gravarDoc(f, { id: doc.id ?? id, version: nova, data: { ...doc.data, entregaDaResposta: entrega } });
    return { id, versao: nova };
  });
}

const CASO_NA_ENTREGA = 300;
const cortar = (s) => (s.length > CASO_NA_ENTREGA ? `${s.slice(0, CASO_NA_ENTREGA)}…` : s);

/** O texto que a sessão que perguntou recebe (o mesmo molde do pane do app). */
export function textoDaEntrega(q, resposta) {
  const caso = q.caso ? ` Caso: ${cortar(q.caso)}.` : '';
  return `${q.id} — pergunta aberta POR ESTA SESSÃO (talvez antes de uma limpeza de contexto): "${q.titulo}".${caso} Chegou a resposta do operador pela aba do kit no Orca: ${resposta}. A pergunta já está como respondida no painel; retome pelo caso e pelo handoff do item, sem repassar a outra sessão.`;
}

/** O que a sessão recebe quando o operador discorda de uma decisão que ela assumiu. */
export function textoDaMudanca(q, resposta) {
  return `${q.id} — decisão que ESTA sessão assumiu (talvez antes de uma limpeza de contexto): "${q.titulo}". O operador mudou pela aba do kit no Orca: ${resposta}. A pergunta já está como respondida no painel; ajuste pelo caso e pelo handoff do item.`;
}
