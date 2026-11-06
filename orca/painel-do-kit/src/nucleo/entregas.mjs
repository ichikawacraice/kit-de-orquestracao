// Entregas por sessão (F436): o que cada sessão entregou nos últimos dias, de duas origens, lido sem acionar modelo.
// Painel do app do Claude: o campo `entrega` do item feito (`fila/<F>.json`, o mesmo do `painel entregas`).
// Orca: os `worker_done` da caixa (`orca orchestration inbox --full --json`), com a worktree do worker pelo `worker-list`.
// "Limpar" é estado da aba, não fato do item: as chaves limpas ficam no armazenamento do plugin.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const texto = (v) => (typeof v === 'string' && v.trim() ? v : null);
const ITEM = /^(F\d+)\b/;

export function entregasDoPainel(pasta, { desdeMs }) {
  let nomes = [];
  try { nomes = readdirSync(join(pasta, 'fila')).filter((n) => /^F\d+\.json$/.test(n)); } catch { return []; }
  const saida = [];
  for (const n of nomes) {
    let d;
    try { d = JSON.parse(readFileSync(join(pasta, 'fila', n), 'utf8'))?.data; } catch { continue; }
    if (!d || d.etapa !== 'feito' || !d.entrega || typeof d.entrega !== 'object' || !texto(d.feitoEm)) continue;
    if (!(Date.parse(d.feitoEm) >= desdeMs)) continue;
    const item = n.slice(0, -5);
    const chave = `painel:${item}@${d.feitoEm}`;
    saida.push({
      chave, chaves: [chave], origem: 'painel', item, titulo: texto(d.titulo) ?? item, projeto: texto(d.projeto), em: d.feitoEm,
      prs: Array.isArray(d.prs) ? d.prs.filter(Number.isInteger) : [], entrega: d.entrega, sessao: texto(d.donaAoFechar?.donoApelido),
    });
  }
  return saida.sort((a, b) => b.em.localeCompare(a.em));
}

function payloadDe(m) {
  if (m.payload && typeof m.payload === 'object') return m.payload;
  try { return JSON.parse(m.payload) ?? {}; } catch { return {}; }
}
// A worktree diz a sessão e o projeto: …/workspaces/<projeto>/<worktree>.
function ondeTrabalha(ws) {
  const caminho = String(ws ?? '').split('::').pop();
  const m = caminho.match(/\/([^/]+)\/([^/]+)\/?$/);
  return m ? { projeto: m[1], sessao: m[2] } : { projeto: null, sessao: null };
}
const TERMINAIS = new Set(['succeeded', 'failed', 'cancelled', 'stopped']);

export function entregasDoOrca(inbox, workers, { desdeMs }) {
  const msgs = Array.isArray(inbox?.result?.messages) ? inbox.result.messages : [];
  const porDispatch = new Map((Array.isArray(workers?.result?.workers) ? workers.result.workers : []).map((w) => [w.dispatchId, w]));
  const saida = [];
  for (const m of msgs) {
    if (m?.type !== 'worker_done' || !(Date.parse(m.created_at) >= desdeMs)) continue;
    const p = payloadDe(m);
    const w = porDispatch.get(p.dispatchId);
    const onde = ondeTrabalha(w?.workspace);
    const titulo = texto(m.subject) ?? '(sem assunto)';
    saida.push({
      chave: `orca:${m.id}`, chaves: [`orca:${m.id}`], origem: 'orca', messageId: m.id, item: titulo.match(ITEM)?.[1] ?? null,
      titulo, corpo: texto(m.body) ?? '', em: m.created_at, run: texto(m.run_id), dispatchId: texto(p.dispatchId), resultado: texto(p.outcome),
      vivo: Boolean(w && !TERMINAIS.has(w.state) && w.terminalState !== 'released'), sessao: onde.sessao ?? texto(m.from_handle), projeto: onde.projeto,
    });
  }
  return saida.sort((a, b) => b.em.localeCompare(a.em));
}

/** O worker_done do mesmo item entra no cartão da entrega do painel (um cartão, as duas chaves). */
export function juntarEntregas(painel, orca) {
  const runPorProjeto = new Map();
  for (const o of orca) if (o.projeto && o.run && !runPorProjeto.has(o.projeto)) runPorProjeto.set(o.projeto, o.run); // orca vem do mais recente
  const usados = new Set();
  const juntas = painel.map((e) => {
    const o = orca.find((x) => x.item && x.item === e.item && !usados.has(x.chave));
    if (o) usados.add(o.chave);
    return { ...e, chaves: o ? [...e.chaves, o.chave] : e.chaves, ...(o ? { orca: o } : {}), runDoProjeto: (e.projeto && runPorProjeto.get(e.projeto)) || null };
  });
  return [...juntas, ...orca.filter((o) => !usados.has(o.chave))].sort((a, b) => b.em.localeCompare(a.em));
}

// As contas do "limpar" moram em `lidas.mjs`, sem import nenhum, porque o painel também as usa (ele não importa `node:fs`).
export { separarLidas, limpar, desfazer, podarLidas } from './lidas.mjs';
