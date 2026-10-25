#!/usr/bin/env node
// Replay da trava de anúncio (F28) sobre os transcripts reais: porte do extrai.py + regra.py da calibração,
// mas com a MESMA regra do hook (executor-anuncia-regra.mjs). Só lê; nenhum subprocesso.
// Uso: node executor-anuncia.replay.mjs [--ate 2026-10-25T12:00:00Z] [--estresse]
//   (padrão) executoras do registro do app (título `E<n> · …` ou `exec · …`), fins de turno até --ate;
//   --estresse: todas as OUTRAS sessões (não serão vigiadas; é só referência).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { ehMensagemDeAbertura, textoDe } from '../hooks-crewai-comum.mjs';
import { classificar } from '../executor-anuncia-regra.mjs';

const args = process.argv.slice(2);
const arg = (nome, padrao) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : padrao; };
const ATE = Date.parse(arg('--ate', '2026-10-25T12:00:00Z'));
const ESTRESSE = args.includes('--estresse');
const SESSOES = process.env.POOL_APP_SESSOES_DIR || join(homedir(), 'Library', 'Application Support', 'Claude', 'claude-code-sessions');
const PROJETOS = process.env.PROJETOS_DIR || join(homedir(), '.claude', 'projects');
const EXECUTORA = /^(E\d+|exec)\s*·/i;

function* locais(dir) {
  let es; try { es = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of es) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* locais(p);
    else if (e.name.startsWith('local_') && e.name.endsWith('.json')) yield p;
  }
}
// cliSessionId -> título, de todo registro do app.
const titulos = new Map();
for (const p of locais(SESSOES)) {
  try {
    const r = JSON.parse(readFileSync(p, 'utf8'));
    for (const id of [r.cliSessionId, ...(r.priorCliSessionIds || [])]) if (id) titulos.set(id, r.title || '');
  } catch { /* registro quebrado */ }
}
const transcripts = [];
for (const d of readdirSync(PROJETOS, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  for (const f of readdirSync(join(PROJETOS, d.name))) if (f.endsWith('.jsonl')) transcripts.push(join(PROJETOS, d.name, f));
}
const ehExec = (id) => EXECUTORA.test(titulos.get(id) || '');

const ts = (e) => { const t = Date.parse(e?.timestamp); return Number.isNaN(t) ? null : t; };
function fimsDeTurno(caminho) {
  const entradas = [];
  for (const l of readFileSync(caminho, 'utf8').split('\n')) { if (!l) continue; try { entradas.push(JSON.parse(l)); } catch { /* parcial */ } }
  const idx = [];
  entradas.forEach((e, k) => { if (ehMensagemDeAbertura(e)) idx.push(k); });
  const fins = [];
  idx.forEach((k, j) => {
    const fim = j + 1 < idx.length ? idx[j + 1] : entradas.length;
    let ultimo = ''; let ultTs = null; const fundo = new Set();
    for (const e of entradas.slice(k + 1, fim)) {
      if (e.type === 'assistant') {
        for (const c of e.message?.content || []) {
          if (c?.type === 'tool_use' && (c.name === 'Monitor' || c.input?.run_in_background === true)) fundo.add(c.id);
        }
        const t = textoDe(e.message);
        if (t.trim()) { ultimo = t; ultTs = ts(e); }
      }
      const t2 = e.type === 'user' ? textoDe(e.message) : '';
      for (const m of t2.matchAll(/<tool-use-id>([^<]+)<\/tool-use-id>/g)) fundo.delete(m[1]);
    }
    const prox = fim < entradas.length ? entradas[fim] : null;
    const a = ts(prox);
    fins.push({ texto: ultimo, ts: ultTs, fundo: fundo.size, gap: a && ultTs ? (a - ultTs) / 60000 : null, origem: prox ? (prox.origin?.kind || 'user') : null, prox: prox ? textoDe(prox.message).slice(0, 120).replace(/\s+/g, ' ') : '' });
  });
  return fins;
}

let total = 0; let anunciam = 0; let adiados = 0; let semTexto = 0; const cobrados = []; const poSessao = new Map();
for (const caminho of transcripts) {
  const id = basename(caminho, '.jsonl');
  if (ehExec(id) === ESTRESSE) continue; // padrão: só executoras; estresse: só as outras
  for (const f of fimsDeTurno(caminho)) {
    if (!ESTRESSE && f.ts !== null && f.ts > ATE) continue;
    if (!f.texto.trim()) { semTexto++; continue; } // fim de turno sem fala do assistente: nada a ler
    total++;
    const { tipo, achado } = classificar(f.texto);
    if (tipo !== 'nao-anuncia') anunciam++;
    // O hook recebe `background_tasks` do evento: tarefa lançada em turno anterior também conta. No replay, o
    // sinal disso é a notificação que reabre o turno seguinte (origem task-notification).
    const noFundo = f.fundo > 0 || f.origem === 'task-notification';
    if (tipo === 'anuncia' && noFundo) adiados++;
    if (tipo === 'anuncia' && !noFundo) cobrados.push({ titulo: titulos.get(id) || '(sem título)', id, ...f, frase: achado.frase });
  }
}
console.log(`corpus: ${ESTRESSE ? 'estresse (outras sessões)' : 'executoras'} · fins de turno com texto ${total} (sem texto, fora da conta: ${semTexto}) · anunciam ${anunciam} · adiados por background ${adiados} · cobrados ${cobrados.length}`);
for (const c of cobrados) {
  console.log(`- ${c.titulo} · ${c.ts ? new Date(c.ts).toISOString() : '?'} · parada ${c.gap === null ? '?' : Math.round(c.gap) + ' min'} · próx: ${c.origem} "${c.prox.slice(0, 50)}"\n    «${c.frase.slice(0, 140)}»`);
}
