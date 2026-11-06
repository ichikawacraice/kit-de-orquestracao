// Sessões por projeto (F452): o que cada sessão dona está fazendo, lido sem acionar modelo. Fontes, todas arquivos do kit:
// - o item da fila (`painel/fila/F<n>.json`): título, projeto, `agora`, `trava`, `espera`, `fatias`, `maisFatias`, `dependeDe`;
// - a batida (`batida/deduzido.json`, reescrita a cada ~minuto): etapa e PRs deduzidos do gh, dona viva, rodando, parado;
// - a fila de merge do projeto (`fila-de-merge/<projeto>.json`): PR anotado (`pendentes`) ou no gate (`emVoo` + `ocupada`);
// - as perguntas abertas (lidas pelo `lerPerguntas`, passadas aqui), cruzadas pelo `item`;
// - o worker do Orca (`worker-list`, passado aqui), ligado ao item pelo `donoLocalId` → `orca-sessoes/<id>.json` → terminal.
// As fatias feitas se deduzem dos PRs mergeados (ADR 0031): o item só guarda os nomes.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Da mais urgente para o operador à menos: a ordem dos estados do contrato. */
export const ORDEM_DOS_ESTADOS = ['esperando', 'parada', 'mergeando', 'na-fila', 'validando', 'trabalhando', 'entregue'];
// Acima disto o estado deduzido não manda: vale o que a sessão declarou no item.
const BATIDA_DECLARADA_MS = 25 * 60_000;
const FINAIS = new Set(['feito', 'descartado']);
const TRAVA_DA_PESSOA = new Set(['operador', 'acesso']);
const ESTEIRA = ['planejamento', 'execução', 'validação', 'merge', 'entregue'];
// Em que bolinha da esteira está cada etapa do item; o design é parte de planejar (a tela vem antes do código).
const POSICAO_NA_ESTEIRA = { planejamento: 0, design: 0, execucao: 1, validacao: 2, merge: 3, feito: 4 };
// Acima de tantas fatias, as feitas se juntam numa linha e as que faltam se cortam.
const FATIAS_SEM_CORTE = 7;
const FALTAM_A_MOSTRAR = 5;

const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const inteiros = (v) => (Array.isArray(v) ? v.filter((n) => Number.isInteger(n) && n > 0) : []);
const lerJson = (arquivo) => { try { return JSON.parse(readFileSync(arquivo, 'utf8')); } catch { return undefined; } };
const prsDaFila = (lista) => (Array.isArray(lista) ? lista : []).map((p) => p?.pr).filter(Number.isInteger);
const iso = (v) => (texto(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const maisRecente = (...v) => v.map(iso).filter(Boolean).sort().pop() ?? null;
const numeroDoItem = (id) => Number(String(id).slice(1)) || 0;

/** As bolinhas da sessão: as fatias com nome, quando o item as tem; senão, a esteira de etapas. */
export function etapasDaSessao({ estado, etapa, fatias = null, feitas = 0 }) {
  if (Array.isArray(fatias) && fatias.length) {
    const tudo = estado === 'entregue' || feitas >= fatias.length;
    return fatias.map((nome, i) => ({ nome, estado: tudo || i < feitas ? 'feito' : i === feitas ? 'agora' : 'falta' }));
  }
  const pos = estado === 'entregue' ? ESTEIRA.length
    : estado === 'validando' ? 2
      : estado === 'na-fila' || estado === 'mergeando' ? 3
        : POSICAO_NA_ESTEIRA[etapa] ?? 0;
  return ESTEIRA.map((nome, i) => ({ nome, estado: i < pos ? 'feito' : i === pos ? 'agora' : 'falta' }));
}

function lerFila(pasta) {
  let nomes = [];
  try { nomes = readdirSync(join(pasta, 'fila')).filter((n) => /^F\d+\.json$/.test(n)); } catch { return { itens: [], ilegiveis: 0 }; }
  const itens = [];
  let ilegiveis = 0;
  for (const n of nomes) {
    const d = lerJson(join(pasta, 'fila', n))?.data;
    if (!d || typeof d !== 'object') { ilegiveis++; continue; }
    itens.push({ id: n.slice(0, -5), d });
  }
  return { itens, ilegiveis };
}

// A fila de merge do projeto. Sem arquivo é fila vazia; arquivo que não se lê é `ilegivel`, e o grupo avisa.
function filaDeMerge(base, projeto, cache) {
  const chave = projeto ?? 'sem-projeto';
  if (!cache.has(chave)) {
    let e = null;
    let ilegivel = false;
    try { e = JSON.parse(readFileSync(join(base, 'fila-de-merge', `${chave}.json`), 'utf8')); } catch (err) { ilegivel = err?.code !== 'ENOENT'; }
    if (e !== null && (typeof e !== 'object' || Array.isArray(e))) { ilegivel = true; e = null; }
    const emVoo = prsDaFila(e?.emVoo);
    cache.set(chave, { ordem: [...emVoo, ...prsDaFila(e?.pendentes)], emVoo: new Set(emVoo), ocupada: e?.ocupada && typeof e.ocupada === 'object' ? e.ocupada : null, ilegivel });
  }
  return cache.get(chave);
}

// O worker do Orca deste item falhou? Liga o `donoLocalId` (orca_session_id:<id>) ao terminal gravado pelo hook.
function sessaoFalhou(base, d, workers) {
  if (!Array.isArray(workers) || !workers.length) return false;
  const id = /^orca_session_id:([\w-]+)$/.exec(texto(d.donoLocalId) ?? '')?.[1];
  if (!id) return false;
  const terminal = texto(lerJson(join(base, 'orca-sessoes', `${id}.json`))?.terminal);
  const w = terminal && workers.find((x) => x?.terminal === terminal);
  return Boolean(w && (w.state === 'failed' || w.outcome === 'failed'));
}

// O estado de um item vivo, pela primeira regra que casa: a causa vence o sintoma.
function estadoDoItem(d, ded, fila, perguntas, falhou) {
  const etapa = ded?.etapa ?? d.etapa;
  const abertos = ded ? inteiros(ded.prsAbertos) : inteiros(d.prs);
  const trava = d.trava && typeof d.trava === 'object' ? d.trava : null;
  const ativ = maisRecente(d.atualizadoEm, ded?.ultimaAtividade);
  if (perguntas.length) return { estado: 'esperando', desdeEm: maisRecente(...perguntas.map((q) => q.atualizadoEm)) ?? iso(d.atualizadoEm) };
  if (trava && TRAVA_DA_PESSOA.has(trava.motivo)) return { estado: 'esperando', motivo: texto(trava.texto), desdeEm: iso(d.atualizadoEm) };
  if (d.espera?.motivo === 'operador') return { estado: 'esperando', motivo: texto(d.espera.texto), desdeEm: iso(d.atualizadoEm) };
  if (trava) return { estado: 'parada', tipoDeParada: texto(trava.motivo) ?? 'outra', motivo: texto(trava.texto), desdeEm: iso(d.atualizadoEm) };
  if (falhou) return { estado: 'parada', tipoDeParada: 'falhou', desdeEm: iso(ded?.ultimaAtividade) ?? ativ };
  // Na etapa merge, a dona já entregou o PR: dona encerrada e parado não são parada, o PR espera a fila.
  if (etapa !== 'merge') {
    if (ded && (ded.donaViva === false || ded.donaViva === null)) return { estado: 'parada', tipoDeParada: 'sem-dona', desdeEm: iso(d.atualizadoEm) };
    if (ded?.parado === true) return { estado: 'parada', tipoDeParada: 'sem-movimento', desdeEm: iso(ded.ultimaAtividade) ?? ativ };
  }
  const naFila = fila.ilegivel ? null : abertos.find((n) => fila.ordem.includes(n));
  if (naFila && fila.emVoo.has(naFila) && fila.ocupada) return { estado: 'mergeando', prNaFila: naFila, desdeEm: iso(fila.ocupada.desde) ?? ativ };
  if (naFila) return { estado: 'na-fila', prNaFila: naFila, posicaoNaFila: fila.ordem.indexOf(naFila) + 1, foraDaFila: false, desdeEm: ativ };
  if (etapa === 'merge' && abertos.length) return { estado: 'na-fila', prNaFila: abertos[0], foraDaFila: true, desdeEm: ativ };
  if (d.espera?.motivo === 'gate') return { estado: 'na-fila', foraDaFila: false, desdeEm: ativ };
  if (etapa === 'validacao') return { estado: 'validando', desdeEm: ativ };
  return { estado: 'trabalhando', subEtapa: etapa ?? null, desdeEm: ativ };
}

function fatiaDe(d, mergeados, estado) {
  const nomes = Array.isArray(d.fatias) ? d.fatias.filter(texto) : [];
  if (nomes.length) {
    const feitas = estado === 'entregue' ? nomes.length : Math.min(mergeados, nomes.length);
    return { fatia: { atual: Math.min(feitas + 1, nomes.length), total: nomes.length }, nomes, feitas, todasFeitas: estado !== 'entregue' && feitas >= nomes.length };
  }
  // Sem os nomes, só o `maisFatias` diz que há plano em fatias: um PR de conserto mergeado não vira "fatia 2".
  const fatia = estado !== 'entregue' && d.maisFatias === true ? { atual: mergeados + 1, total: null } : null;
  return { fatia, nomes: null, feitas: 0, todasFeitas: false };
}

// Com muitas fatias, as feitas viram uma linha (`feitasJuntas`), e das que faltam só as primeiras aparecem (`maisBolinhas`).
function cortarBolinhas(etapas, comNomes) {
  if (!comNomes || etapas.length <= FATIAS_SEM_CORTE) return { etapas, feitasJuntas: 0, maisBolinhas: 0 };
  const feitas = etapas.filter((e) => e.estado === 'feito');
  const agora = etapas.filter((e) => e.estado === 'agora');
  const faltam = etapas.filter((e) => e.estado === 'falta');
  return { etapas: [...agora, ...faltam.slice(0, FALTAM_A_MOSTRAR)], feitasJuntas: feitas.length, maisBolinhas: Math.max(0, faltam.length - FALTAM_A_MOSTRAR) };
}

// A ordem fina dos cartões: dentro de `parada`, a trava antes do parado; dentro de `na-fila`, a fila antes do PR fora dela.
function urgencia(s) {
  switch (s.estado) {
    case 'esperando': return 0;
    case 'parada': return ['sem-movimento', 'falhou', 'sem-dona'].includes(s.tipoDeParada) ? 2 : 1;
    case 'mergeando': return 3;
    case 'na-fila': return s.foraDaFila ? 5 : 4;
    case 'validando': return 6;
    case 'trabalhando': return 7;
    default: return 8;
  }
}

/** Conta do trilho: o que está fora do ritmo e que a seção Perguntas não conta (as paradas e a espera sem pergunta). */
const ehParada = (s) => s.estado === 'parada' || (s.estado === 'esperando' && !s.perguntas.length);

/**
 * As sessões do kit agrupadas por projeto. `pasta` é a do painel (`…/orquestracao/painel`); a batida, a fila de merge e as
 * sessões do Orca moram ao lado dela. `desdeMs` corta as entregas (o início do dia em São Paulo); `abertas` vem do
 * `lerPerguntas`; `workers` é o `worker-list` do Orca (opcional).
 */
export function sessoesDoKit(pasta, { agoraMs = Date.now(), desdeMs, abertas = [], workers = null } = {}) {
  const base = dirname(pasta);
  const { itens, ilegiveis } = lerFila(pasta);
  const batida = lerJson(join(base, 'batida', 'deduzido.json'));
  const emMs = Date.parse(batida?.em);
  // A batida no futuro é ilegível; a com mais de 25 min só serve para dizer a idade (a etapa volta a ser a declarada).
  const batidaEm = Number.isFinite(emMs) && emMs <= agoraMs ? batida.em : null;
  const usaDeduzido = batidaEm !== null && agoraMs - emMs <= BATIDA_DECLARADA_MS && batida?.itens && typeof batida.itens === 'object';
  const deduzidos = usaDeduzido ? batida.itens : {};
  const vivos = new Set(itens.filter(({ d }) => !FINAIS.has(d.etapa)).map(({ id }) => id));
  const filas = new Map();
  const sessoes = [];
  for (const { id, d } of itens) {
    const entregue = d.etapa === 'feito';
    if (entregue ? !(Date.parse(d.feitoEm) >= desdeMs) : FINAIS.has(d.etapa)) continue;
    const ded = !entregue && deduzidos[id] && typeof deduzidos[id] === 'object' ? deduzidos[id] : null;
    const projeto = texto(d.projeto);
    const fila = filaDeMerge(base, projeto, filas);
    const minhas = (Array.isArray(abertas) ? abertas : []).filter((q) => q?.item === id);
    const est = entregue ? { estado: 'entregue', desdeEm: iso(d.feitoEm) } : estadoDoItem(d, ded, fila, minhas, sessaoFalhou(base, d, workers));
    const mergeados = entregue ? inteiros(d.prs) : ded ? inteiros(ded.prsMergeados) : [];
    const abertos = entregue ? [] : ded ? inteiros(ded.prsAbertos) : inteiros(d.prs);
    const etapa = entregue ? 'feito' : ded?.etapa ?? d.etapa ?? null;
    const f = fatiaDe(d, mergeados.length, est.estado);
    const corte = cortarBolinhas(etapasDaSessao({ estado: est.estado, etapa, fatias: f.nomes, feitas: f.feitas }), Boolean(f.nomes));
    const titulo = texto(d.titulo) ?? texto(d.tema) ?? id;
    const agora = entregue ? null : texto(d.agora);
    sessoes.push({
      item: id, titulo, nome: `${id} · ${titulo}`, projeto, etapa,
      subEtapa: null, tipoDeParada: null, motivo: null, prNaFila: null, posicaoNaFila: null, foraDaFila: false,
      ...est,
      agora, notaEm: agora ? iso(d.atualizadoEm) : null,
      rodando: ded?.rodando === true,
      perguntas: minhas.map((q) => ({ id: q.id, titulo: q.titulo })),
      prs: { abertos, mergeados },
      fatia: f.fatia, todasFeitas: f.todasFeitas,
      ...corte,
      dependeDe: entregue ? [] : (Array.isArray(d.dependeDe) ? d.dependeDe : []).filter((x) => typeof x === 'string' && vivos.has(x)),
    });
  }
  const porProjeto = new Map();
  for (const s of sessoes) {
    if (!porProjeto.has(s.projeto)) porProjeto.set(s.projeto, []);
    porProjeto.get(s.projeto).push(s);
  }
  const projetos = [...porProjeto].map(([projeto, lista]) => ({
    projeto,
    filaIlegivel: filaDeMerge(base, projeto, filas).ilegivel,
    sessoes: lista.sort((a, b) => urgencia(a) - urgencia(b) || numeroDoItem(a.item) - numeroDoItem(b.item)),
  }));
  // O grupo com o cartão mais urgente sobe; entre iguais, o nome; o sem projeto fica no fim.
  projetos.sort((a, b) => (a.projeto === null) - (b.projeto === null) || urgencia(a.sessoes[0]) - urgencia(b.sessoes[0]) || String(a.projeto).localeCompare(String(b.projeto), 'pt'));
  return { projetos, paradas: sessoes.filter(ehParada).length, ilegiveis, batidaEm, erro: null, lidoEm: agoraMs };
}
