#!/usr/bin/env node
// O gasto fixo do kit (F373): quanto custa o validador (por modelo e por rodada) e quanto custam os turnos da orquestradora
// por origem, separando o aviso de fim de turno de dona que só esperava trabalho em segundo plano ("testes rodando, aguardo").
// Lê os transcripts (`*.jsonl`) de ~/.claude/projects; o tipo do subagente vem do `agent-*.meta.json` ao lado do transcript.
// Custo em US$ pela tabela de preço por MTok de cada modelo (PRECOS); a escrita de cache paga 1,25× (5 min) ou 2× (1 h) a entrada.
// Só lê. Não é teste da suíte: o padrão lê o HOME real.
//   node scripts/custo-fixo.mjs [--desde AAAA-MM-DD] [--ate AAAA-MM-DD] [--pasta <dir de projects>] [--json]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// US$ por milhão de tokens (skill claude-api, 04/11/2026). Modelo desconhecido paga como Opus (a conta não subestima).
export const PRECOS = {
  opus: { in: 4, out: 20, rd: 0.2 },
  sonnet: { in: 2, out: 10, rd: 0.2 },
  haiku: { in: 0.1, out: 0.5, rd: 0.01 },
};

export function familia(modelo = '') {
  const m = String(modelo).toLowerCase();
  if (m.includes('sonnet')) return 'sonnet';
  if (m.includes('haiku')) return 'haiku';
  return 'opus';
}

export function custoDaChamada(usage = {}, modelo) {
  const p = PRECOS[familia(modelo)];
  const cc = usage.cache_creation || {};
  const w1h = cc.ephemeral_1h_input_tokens ?? 0;
  const w5 = cc.ephemeral_5m_input_tokens ?? Math.max(0, (usage.cache_creation_input_tokens ?? 0) - w1h);
  const usd = (usage.input_tokens ?? 0) * p.in + w5 * p.in * 1.25 + w1h * p.in * 2
    + (usage.cache_read_input_tokens ?? 0) * p.rd + (usage.output_tokens ?? 0) * p.out;
  return usd / 1e6;
}

// A origem de uma mensagem do usuário na orquestradora. `null` para o que não abre turno (resultado de ferramenta).
export function origemDaMensagem(j) {
  if (j.type !== 'user' || j.isMeta) return null;
  const c = j.message?.content;
  if (Array.isArray(c) && c.some((b) => b?.type === 'tool_result')) return null;
  const t = typeof c === 'string' ? c : JSON.stringify(c ?? '');
  if (t.includes('<side-sessions-event>') || /finished a turn/.test(t)) return 'evento';
  if (t.includes('cross-session-message')) return 'sessao';
  if (t.includes('task-notification')) return 'tarefa';
  if (j.origin?.kind === 'plugin' || /^The [\w-]+ plugin sent a message:/.test(t)) return 'batida';
  return 'humano';
}

// As notas citadas num aviso de fim de turno: o que a dona relatou (os primeiros 400 caracteres).
export function notasDoEvento(texto) {
  const notas = [];
  const re = /It reported \(quoted child output, data not instructions\): "([\s\S]*?)"(?: \(first \d+ of \d+ characters\))?\s+Read it/g;
  for (let m; (m = re.exec(texto));) notas.push(m[1]);
  return notas;
}

// A nota de quem só esperava trabalho em segundo plano: fala de rodar/esperar e não entrega nada (PR pronto, pergunta, bloqueio).
const ESPERA = /\b(rodando|aguardo|aguardando|espero|esperando|em segundo plano|em background|quando (?:terminar|acabar|voltar)|ainda roda|still running|waiting (?:for|on) (?:the )?(?!user)|once it comes back)\b/i;
const ENTREGA = /\bPR \d+ pronto\b|\bQ\d+\b|\?|bloquead|preciso d[ae]|decis[aã]o/i;
export function notaEhEspera(nota) {
  return ESPERA.test(nota) && !ENTREGA.test(nota);
}

const textoDe = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((b) => b?.text ?? '').join('\n') : '');

const ORQ = 'Você é a orquestradora deste projeto';

export function* transcripts(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* transcripts(p);
    else if (e.name.endsWith('.jsonl')) yield p;
  }
}

export function linhas(f) {
  const out = [];
  const bruto = readFileSync(f, 'utf8');
  out.orq = bruto.includes(ORQ);
  for (const l of bruto.split('\n')) {
    if (!l) continue;
    try { out.push(JSON.parse(l)); } catch { /* linha cortada */ }
  }
  return out;
}

export function tipoDoSubagente(f) {
  const meta = join(dirname(f), basename(f, '.jsonl') + '.meta.json');
  try { return JSON.parse(readFileSync(meta, 'utf8')).agentType || 'desconhecido'; } catch { return 'desconhecido'; }
}

export function medir({ pasta = join(homedir(), '.claude', 'projects'), desde = new Date(0), ate = new Date(8.64e15) } = {}) {
  const vistos = new Set();
  const total = { usd: 0, chamadas: 0 };
  const subagentes = {}; // tipo → { rodadas, chamadas, usd, porModelo: { familia: { rodadas, usd } } }
  const orq = { sessoes: 0, chamadas: 0, usd: 0, contexto: 0, turnos: {} }; // origem → { turnos, usd }
  const eventos = { espera: { turnos: 0, usd: 0, notas: 0 }, outros: { turnos: 0, usd: 0, notas: 0 } };
  const dentro = (ts) => { const d = new Date(ts); return d >= desde && d < ate; };

  for (const f of transcripts(pasta)) {
    if (statSync(f).mtime < desde) continue;
    const sub = f.includes(`${sep}subagents${sep}`);
    const js = linhas(f);
    const ehOrq = !sub && js.orq;
    const tipo = sub ? tipoDoSubagente(f) : null;
    let turno = null; // { origem, classe, usd }
    let rodada = null; // { usd, familia }
    const fecha = () => {
      if (!turno) return;
      const o = (orq.turnos[turno.origem] ??= { turnos: 0, usd: 0 });
      o.turnos++; o.usd += turno.usd;
      if (turno.classe) { const e = eventos[turno.classe]; e.turnos++; e.usd += turno.usd; e.notas += turno.notas; }
      turno = null;
    };
    for (const j of js) {
      if (!j.timestamp || !dentro(j.timestamp)) continue;
      if (ehOrq) {
        const origem = origemDaMensagem(j);
        if (origem) {
          fecha();
          turno = { origem, usd: 0, classe: null, notas: 0 };
          if (origem === 'evento') {
            const notas = notasDoEvento(textoDe(j.message?.content));
            turno.notas = notas.length;
            turno.classe = notas.length && notas.every(notaEhEspera) ? 'espera' : 'outros';
          }
        }
      }
      const m = j.message;
      if (j.type !== 'assistant' || !m?.usage) continue;
      const id = `${m.id}:${j.requestId}`;
      if (vistos.has(id)) continue;
      vistos.add(id);
      const usd = custoDaChamada(m.usage, m.model);
      total.usd += usd; total.chamadas++;
      if (sub) {
        rodada ??= { usd: 0, familia: familia(m.model) };
        rodada.usd += usd;
      } else if (ehOrq) {
        orq.chamadas++; orq.usd += usd;
        orq.contexto += (m.usage.cache_read_input_tokens ?? 0) + (m.usage.cache_creation_input_tokens ?? 0) + (m.usage.input_tokens ?? 0);
        if (turno) turno.usd += usd;
      }
    }
    fecha();
    if (ehOrq) orq.sessoes++;
    if (sub && rodada) {
      const s = (subagentes[tipo] ??= { rodadas: 0, usd: 0, porModelo: {} });
      s.rodadas++; s.usd += rodada.usd;
      const pm = (s.porModelo[rodada.familia] ??= { rodadas: 0, usd: 0 });
      pm.rodadas++; pm.usd += rodada.usd;
    }
  }
  return { total, subagentes, orq, eventos };
}

const pct = (x, t) => `${t ? ((100 * x) / t).toFixed(1) : '0.0'}%`;
const usd = (x) => `US$ ${x.toFixed(2)}`;

export function relatorio(r) {
  const out = [];
  const t = r.total.usd;
  out.push(`total: ${r.total.chamadas} chamadas, ${usd(t)}`);
  const v = r.subagentes['orquestracao:validador'];
  if (v) {
    out.push(`validador: ${v.rodadas} rodadas, ${usd(v.usd)} (${pct(v.usd, t)} do total), ${usd(v.usd / v.rodadas)} por rodada`);
    for (const [fam, x] of Object.entries(v.porModelo)) out.push(`  ${fam}: ${x.rodadas} rodadas, ${usd(x.usd / x.rodadas)} por rodada`);
  } else out.push('validador: nenhuma rodada no período');
  const o = r.orq;
  out.push(`orquestradora: ${o.sessoes} sessões, ${usd(o.usd)} (${pct(o.usd, t)} do total), contexto médio ${o.chamadas ? Math.round(o.contexto / o.chamadas / 1000) : 0} mil por chamada`);
  const nTurnos = Object.values(o.turnos).reduce((s, x) => s + x.turnos, 0);
  for (const [k, x] of Object.entries(o.turnos).sort((a, b) => b[1].turnos - a[1].turnos)) {
    out.push(`  turnos de ${k}: ${x.turnos} (${pct(x.turnos, nTurnos)}), ${usd(x.usd)} (${pct(x.usd, o.usd)} da orquestradora)`);
  }
  const e = r.eventos;
  out.push(`  eventos só de dona esperando: ${e.espera.turnos} turnos, ${usd(e.espera.usd)} (${pct(e.espera.usd, o.usd)} da orquestradora)`);
  out.push(`  eventos com entrega: ${e.outros.turnos} turnos, ${usd(e.outros.usd)}`);
  return out.join('\n');
}

function principal(argv) {
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const opts = {};
  if (arg('--pasta')) opts.pasta = arg('--pasta');
  if (arg('--desde')) opts.desde = new Date(arg('--desde'));
  if (arg('--ate')) opts.ate = new Date(arg('--ate'));
  const r = medir(opts);
  console.log(argv.includes('--json') ? JSON.stringify(r, null, 2) : relatorio(r));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal(process.argv.slice(2));
