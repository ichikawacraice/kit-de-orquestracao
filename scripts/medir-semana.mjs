#!/usr/bin/env node
// A linha de base semanal (F418, fase 0 do diagnóstico da orquestração): para uma janela, nos projetos que você
// nomear (o do kit por padrão), dá tokens e US$ por papel e por modelo, o custo por item fechado (mediana e p90), os turnos extras de trava por
// hook e o tempo de item aberto → PR → merge. Método em docs/research/2026-11-05-diagnostico-orquestracao.md#como-foi-medido.
// Reusa o preço e a leitura de transcripts do `custo-fixo` e o piso do `piso-da-sessao`; o que é novo aqui é o papel (pelo título
// da sessão), o item (pelo `F<n>` do título e do PR) e a trava (mensagem `Stop hook feedback`).
// Só lê. Os PRs vêm do `gh` (um por repositório) ou de `--prs <arquivo.json>` ({ kit: [...], <outro>: [...] }).
//   node scripts/medir-semana.mjs --desde AAAA-MM-DD --ate AAAA-MM-DD [--projeto chave=Pasta]… [--pasta <dir de projects>] [--prs <json>] [--sem-piso] [--json]
// `--desde` vale da meia-noite de São Paulo; `--ate` é inclusivo (o dia inteiro). Data com hora (ISO completo) vale como está.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { custoDaChamada, familia, linhas, tipoDoSubagente, transcripts } from './custo-fixo.mjs';
import { agregar } from './piso-da-sessao.mjs';

// Projeto → pasta em ~/Developer/Projects. O prefixo do diretório em ~/.claude/projects (que pega também os worktrees:
// `<prefixo>--claude-worktrees-…`) e o repositório (do `origin` da pasta) saem da pasta do usuário, sem nome fixo.
const PASTAS = { kit: 'kit-de-orquestracao' };
export function projetosDe(home = homedir(), pastas = PASTAS) {
  const base = join(home, 'Developer', 'Projects');
  return Object.fromEntries(Object.entries(pastas).map(([k, nome]) => [k, { dir: join(base, nome), prefixo: join(base, nome).replace(/[/.]/g, '-') }]));
}
export const PROJETOS = projetosDe();

// `dono/nome` do remote origin da pasta, ou null.
function repoDe(dir) {
  try {
    const u = execFileSync('git', ['-C', dir, 'remote', 'get-url', 'origin'], { encoding: 'utf8', timeout: 10000 }).trim();
    return u.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/)?.[1] ?? null;
  } catch { return null; }
}

// A mensagem de cada trava de Stop → o hook que a escreve. Mensagem nova cai em `outras`: confira a fatia dela na saída.
const TRAVAS = [
  [/Relatório sem a saída real/, 'criterio-da-dona'],
  [/Painel das sessões não atualizado/, 'painel-das-sessoes'],
  [/O visual do front mudou/, 'critico-de-ui'],
  [/Você é dona do item .*não o (?:atualizou|gravou)/s, 'fila-do-item'],
  [/^Contexto em \d+ mil/m, 'contexto-do-papel'],
  [/Ritual da orquestradora não feito/, 'ritual-da-orquestradora'],
  [/Item parado sem o papel da etapa/, 'espera-de-papel'],
  [/Você se declarou livre|Seu título ainda diz|Você saiu do item e o título|Você está no `fez`/, 'titulo-da-dona'],
  [/Livres além do teto|Piso do pool|sem nenhuma E no item/, 'piso-do-pool'],
  [/Item sem dona \(/, 'sem-dona'],
  [/A mensagem final marca \d+ decis/, 'perguntas-da-sessao'],
  [/A batida não roda/, 'batida'],
  [/Ainda roda em segundo plano/, 'espera-no-turno'],
  [/modo ausente/, 'operador-ausente'],
];

export function classificarTrava(texto) {
  const corpo = String(texto).replace(/^\s*Stop hook feedback:?\s*/, '');
  return TRAVAS.find(([re]) => re.test(corpo))?.[1] ?? 'outras';
}

export function papelDoTitulo(t) {
  if (/^🎛 orquestradora/.test(t ?? '')) return 'orquestradora';
  return /^F\d+ ·/.test(t ?? '') ? 'dona' : 'avulsa';
}

export const idDoItem = (pr) => /\bF\d+\b/.exec(pr.title ?? '')?.[0] ?? /\bf(\d+)\b/i.exec(pr.headRefName ?? '')?.[0]?.toUpperCase() ?? null;

export function quantil(valores, p) {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return 0;
  if (p === 0.5) return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return v[Math.max(0, Math.ceil(p * v.length) - 1)];
}

// 'AAAA-MM-DD' é o dia de São Paulo (UTC−3): `ate` sobe para o começo do dia seguinte. Com hora, vale como está.
export function dataDeSP(s, fim = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s);
  const d = new Date(`${s}T03:00:00.000Z`);
  return fim ? new Date(d.getTime() + 86400000) : d;
}

const tokensVazios = () => ({ entrada: 0, cacheRead: 0, cacheWrite: 0, saida: 0 });
const somaTokens = (t, u = {}) => {
  t.entrada += u.input_tokens ?? 0;
  t.cacheRead += u.cache_read_input_tokens ?? 0;
  t.cacheWrite += u.cache_creation_input_tokens ?? 0;
  t.saida += u.output_tokens ?? 0;
};
const novoGrupo = () => ({ chamadas: 0, usd: 0, tokens: tokensVazios(), porModelo: {} });
const somaGrupo = (g, usd, u, fam) => {
  g.chamadas++; g.usd += usd; somaTokens(g.tokens, u);
  const m = (g.porModelo[fam] ??= { chamadas: 0, usd: 0, tokens: tokensVazios() });
  m.chamadas++; m.usd += usd; somaTokens(m.tokens, u);
};

const textoDe = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((b) => b?.text ?? '').join('\n') : '');
const ehResultadoDeFerramenta = (j) => Array.isArray(j.message?.content) && j.message.content.some((b) => b?.type === 'tool_result');
const ultimoTitulo = (js) => { let t; for (const j of js) if (j.type === 'custom-title' && j.customTitle) t = j.customTitle; return t; };

function* arquivosDosProjetos(pasta, projetos) {
  let nomes = [];
  try { nomes = readdirSync(pasta); } catch { return; }
  for (const nome of nomes.sort()) {
    const projeto = Object.entries(projetos).find(([, p]) => nome === p.prefixo || nome.startsWith(`${p.prefixo}--`))?.[0];
    if (!projeto) continue;
    for (const f of transcripts(join(pasta, nome))) yield { projeto, f };
  }
}

export function medirSemana({ pasta = join(homedir(), '.claude', 'projects'), desde = new Date(0), ate = new Date(8.64e15), prs = {}, piso = true, projetos = PROJETOS } = {}) {
  const dentro = (ts) => { const d = new Date(ts); return d >= desde && d < ate; };
  const vistos = new Set();
  const papeis = { orquestradora: novoGrupo(), dona: novoGrupo(), avulsa: novoGrupo(), subagente: { ...novoGrupo(), porTipo: {} } };
  const sessoesVivas = { orquestradora: new Set(), dona: new Set(), avulsa: new Set() };
  const sessoes = new Map(); // caminho da sessão principal → { projeto, papel, item, abriu, usdTodo }
  const travas = { total: 0, usd: 0, porHook: {}, porPapel: {} };
  const arquivosPiso = [];
  const subs = [];

  for (const { projeto, f } of arquivosDosProjetos(pasta, projetos)) {
    if (statSync(f).mtime < desde) continue;
    const sub = basename(dirname(f)) === 'subagents';
    const js = linhas(f);
    arquivosPiso.push(f);
    const titulo = sub ? null : ultimoTitulo(js);
    const papel = sub ? 'subagente' : papelDoTitulo(titulo);
    const chave = sub ? join(dirname(dirname(f)) + '.jsonl') : f;
    const reg = sub ? null : { projeto, papel, item: /^F\d+(?= ·)/.exec(titulo ?? '')?.[0] ?? null, abriu: null, usdTodo: 0 };
    if (reg) sessoes.set(f, reg);
    const tipo = sub ? tipoDoSubagente(f) : null;
    let rodada = false;
    let aberta = null; // turno aberto por uma trava: { hook, usd }
    const fecha = () => {
      if (!aberta) return;
      const h = (travas.porHook[aberta.hook] ??= { turnos: 0, usd: 0 });
      h.turnos++; h.usd += aberta.usd;
      travas.total++; travas.usd += aberta.usd;
      travas.porPapel[papel] = (travas.porPapel[papel] ?? 0) + 1;
      aberta = null;
    };
    for (const j of js) {
      if (!j.timestamp) continue;
      if (reg && !reg.abriu) reg.abriu = j.timestamp;
      if (!sub && j.type === 'user' && !ehResultadoDeFerramenta(j)) {
        fecha();
        const t = textoDe(j.message?.content);
        if (dentro(j.timestamp) && /^\s*Stop hook feedback/.test(t)) aberta = { hook: classificarTrava(t), usd: 0 };
      }
      const m = j.message;
      if (j.type !== 'assistant' || !m?.usage) continue;
      const id = `${m.id}:${j.requestId}`;
      if (vistos.has(id)) continue;
      vistos.add(id);
      const usd = custoDaChamada(m.usage, m.model);
      const fam = familia(m.model);
      if (sub) subs.push({ chave, usd });
      else reg.usdTodo += usd;
      if (!dentro(j.timestamp)) continue;
      somaGrupo(papeis[papel], usd, m.usage, fam);
      if (sub) {
        const t = (papeis.subagente.porTipo[tipo] ??= { rodadas: 0, chamadas: 0, usd: 0 });
        t.chamadas++; t.usd += usd;
        if (!rodada) { t.rodadas++; rodada = true; }
      } else sessoesVivas[papel].add(f);
      if (aberta) aberta.usd += usd;
    }
    fecha();
  }
  for (const s of subs) { const r = sessoes.get(s.chave); if (r) r.usdTodo += s.usd; }
  for (const [p, set] of Object.entries(sessoesVivas)) papeis[p].sessoes = set.size;

  // Itens fechados: PR mergeado na janela, agrupado pelo `F<n>` do título (ou da branch) do PR.
  const porItem = new Map();
  const minutosPorPr = []; // PR aberto → merge de cada PR mergeado na janela, com ou sem item (o número do diagnóstico)
  let semItem = 0;
  const avisos = [];
  for (const projeto of Object.keys(projetos)) if (!(projeto in prs)) avisos.push(`sem os PRs de ${projeto}: itens desse projeto ficam de fora`);
  for (const [projeto, lista] of Object.entries(prs)) {
    if (lista == null) { avisos.push(`sem os PRs de ${projeto}: itens desse projeto ficam de fora`); continue; }
    for (const pr of lista) {
      const merge = new Date(pr.mergedAt);
      if (!pr.mergedAt || merge < desde || merge >= ate) continue;
      minutosPorPr.push({ projeto, min: (merge - new Date(pr.createdAt)) / 60000 });
      const item = idDoItem(pr);
      if (!item) { semItem++; continue; }
      const k = `${projeto}:${item}`;
      const x = porItem.get(k) ?? { projeto, item, prs: [], criado: Infinity, mergeado: -Infinity };
      x.prs.push(pr.number);
      x.criado = Math.min(x.criado, new Date(pr.createdAt).getTime());
      x.mergeado = Math.max(x.mergeado, merge.getTime());
      porItem.set(k, x);
    }
  }
  const lista = [];
  for (const x of porItem.values()) {
    const donas = [...sessoes.values()].filter((s) => s.projeto === x.projeto && s.item === x.item);
    const abriu = donas.length ? Math.min(...donas.map((s) => new Date(s.abriu).getTime())) : null;
    const min = (a, b) => (a != null && b >= a ? Math.round((b - a) / 60000) : null);
    lista.push({
      projeto: x.projeto, item: x.item, prs: x.prs,
      usd: donas.length ? donas.reduce((s, d) => s + d.usdTodo, 0) : null,
      minutos: { abertoAtePr: min(abriu, x.criado), prAteMerge: min(x.criado, x.mergeado), abertoAteMerge: min(abriu, x.mergeado) },
    });
  }
  lista.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
  const custos = lista.map((i) => i.usd).filter((v) => v != null);
  const tempo = (campo) => { const v = lista.map((i) => i.minutos[campo]).filter((x) => x != null); return { n: v.length, mediana: quantil(v, 0.5), p90: quantil(v, 0.9) }; };
  const itens = {
    fechados: lista.length, semItem, semCusto: lista.length - custos.length,
    custo: { n: custos.length, total: custos.reduce((s, x) => s + x, 0), mediana: quantil(custos, 0.5), p90: quantil(custos, 0.9) },
    tempos: { porPr: { n: minutosPorPr.length, mediana: quantil(minutosPorPr.map((x) => x.min), 0.5), p90: quantil(minutosPorPr.map((x) => x.min), 0.9), porProjeto: Object.fromEntries(Object.keys(projetos).map((k) => { const v = minutosPorPr.filter((x) => x.projeto === k).map((x) => x.min); return [k, { n: v.length, mediana: quantil(v, 0.5), p90: quantil(v, 0.9) }]; })) }, abertoAtePr: tempo('abertoAtePr'), prAteMerge: tempo('prAteMerge'), abertoAteMerge: tempo('abertoAteMerge') },
    lista,
  };

  const total = { chamadas: 0, usd: 0, tokens: tokensVazios() };
  for (const g of Object.values(papeis)) {
    total.chamadas += g.chamadas; total.usd += g.usd;
    for (const k of Object.keys(total.tokens)) total.tokens[k] += g.tokens[k];
  }
  return {
    janela: { desde: desde.toISOString(), ate: ate.toISOString() },
    total, papeis, travas, itens, avisos,
    piso: piso ? agregar(arquivosPiso) : null,
  };
}

const usd = (x) => `US$ ${x.toFixed(2)}`;
const mi = (n) => `${(n / 1e6).toFixed(1)} M`;
const pct = (x, t) => `${t ? ((100 * x) / t).toFixed(1) : '0.0'}%`;
const dur = (min) => (min >= 120 ? `${(min / 60).toFixed(1)} h` : `${Math.round(min)} min`);
const tabela = (cab, linhas_) => [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, ...linhas_.map((l) => `| ${l.join(' | ')} |`)].join('\n');

export function relatorioMarkdown(r) {
  const out = [`# Linha de base da orquestração`, '', `Janela: ${r.janela.desde} a ${r.janela.ate} (fim exclusivo). Total: ${r.total.chamadas} chamadas, ${usd(r.total.usd)}, ${mi(r.total.tokens.entrada + r.total.tokens.cacheRead + r.total.tokens.cacheWrite + r.total.tokens.saida)} de tokens.`];
  for (const a of r.avisos) out.push('', `> ${a}`);
  out.push('', '## Por papel', '');
  const linhasPapel = [];
  for (const [p, g] of Object.entries(r.papeis)) {
    if (!g.chamadas) continue;
    linhasPapel.push([p, g.sessoes ?? '–', g.chamadas, mi(g.tokens.cacheRead), mi(g.tokens.cacheWrite), mi(g.tokens.entrada + g.tokens.saida), usd(g.usd), pct(g.usd, r.total.usd)]);
    for (const [m, x] of Object.entries(g.porModelo)) linhasPapel.push([`↳ ${m}`, '', x.chamadas, mi(x.tokens.cacheRead), mi(x.tokens.cacheWrite), mi(x.tokens.entrada + x.tokens.saida), usd(x.usd), pct(x.usd, g.usd) + ' do papel']);
  }
  out.push(tabela(['papel', 'sessões', 'chamadas', 'cache lido', 'cache escrito', 'entrada+saída', 'US$', 'fatia'], linhasPapel));
  const tipos = Object.entries(r.papeis.subagente.porTipo).sort((a, b) => b[1].usd - a[1].usd);
  if (tipos.length) out.push('', 'Subagentes por tipo:', '', tabela(['tipo', 'rodadas', 'chamadas', 'US$'], tipos.map(([t, x]) => [t, x.rodadas, x.chamadas, usd(x.usd)])));

  const i = r.itens;
  out.push('', '## Custo por item fechado', '');
  out.push(`${i.fechados} itens fechados (PR mergeado na janela); ${i.semItem} PRs sem item no título ou na branch; ${i.semCusto} itens sem sessão achada. Custo do item = dona + os subagentes dela, em todas as chamadas da sessão.`);
  out.push('', `- mediana: ${usd(i.custo.mediana)}`, `- p90: ${usd(i.custo.p90)}`, `- total dos itens: ${usd(i.custo.total)} (${i.custo.n} com custo)`);
  if (i.lista.length) out.push('', `Os ${Math.min(15, i.lista.length)} itens mais caros (a lista inteira está no \`--json\`):`, '', tabela(['projeto', 'item', 'PRs', 'US$', 'aberto→1º PR', '1º PR→último merge'], i.lista.slice(0, 15).map((x) => [x.projeto, x.item, x.prs.length, x.usd == null ? '–' : usd(x.usd), x.minutos.abertoAtePr == null ? '–' : dur(x.minutos.abertoAtePr), x.minutos.prAteMerge == null ? '–' : dur(x.minutos.prAteMerge)])));

  const t = r.travas;
  out.push('', '## Turnos extras de trava', '', `${t.total} turnos abertos por \`Stop hook feedback\`, ${usd(t.usd)}.`);
  const hooks = Object.entries(t.porHook).sort((a, b) => b[1].turnos - a[1].turnos);
  if (hooks.length) out.push('', tabela(['hook', 'turnos', 'US$'], hooks.map(([h, x]) => [h, x.turnos, usd(x.usd)])));
  const pp = Object.entries(t.porPapel);
  if (pp.length) out.push('', `Por papel: ${pp.map(([p, n]) => `${p} ${n}`).join(', ')}.`);

  out.push('', '## Tempo até o merge', '', tabela(['etapa', 'n', 'mediana', 'p90'], [['cada PR: aberto → merge', 'porPr'], ['item: aberto → 1º PR', 'abertoAtePr'], ['item: 1º PR → último merge', 'prAteMerge'], ['item: aberto → último merge', 'abertoAteMerge']].map(([n, k]) => [n, i.tempos[k].n, dur(i.tempos[k].mediana), dur(i.tempos[k].p90)])));
  out.push('', `Cada PR por projeto: ${Object.entries(i.tempos.porPr.porProjeto).filter(([, x]) => x.n).map(([k, x]) => `${k} ${dur(x.mediana)} (p90 ${dur(x.p90)}, ${x.n} PRs)`).join('; ')}.`);

  if (r.piso) {
    out.push('', '## Piso da sessão (1ª chamada)', '');
    for (const [tipo, p] of Object.entries(r.piso)) out.push(`- ${tipo}: mediana ${(p.piso / 1000).toFixed(1)} mil tokens em ${p.sessoes} sessões; maiores fontes: ${Object.entries(p.fontes).slice(0, 3).map(([f, n]) => `${f} ${(n / 1000).toFixed(1)} mil`).join(', ')}`);
  }
  return out.join('\n');
}

// PRs mergeados na janela de um repositório, pelo `gh`. Falha (sem rede, sem login) devolve null e o relatório avisa.
function buscarPrs(repo, desde, ate) {
  const dia = (d) => new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10);
  try {
    const saida = execFileSync('gh', ['pr', 'list', '--repo', repo, '--state', 'merged', '--limit', '1000', '--search', `merged:${dia(new Date(desde.getTime() - 86400000))}..${dia(new Date(Math.min(ate.getTime(), Date.now()) + 86400000))}`, '--json', 'number,title,headRefName,createdAt,mergedAt'], { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(saida);
  } catch { return null; }
}

async function principal(argv) {
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  if (!arg('--desde')) { console.error('uso: medir-semana --desde AAAA-MM-DD [--ate AAAA-MM-DD] [--projeto chave=Pasta]… [--pasta <dir>] [--prs <json>] [--sem-piso] [--json]'); process.exitCode = 2; return; }
  const desde = dataDeSP(arg('--desde'));
  const ate = arg('--ate') ? dataDeSP(arg('--ate'), true) : new Date();
  const extras = argv.flatMap((a, i) => (a === '--projeto' ? [argv[i + 1]] : [])).map((x) => x.split('='));
  const projetos = projetosDe(homedir(), { ...PASTAS, ...Object.fromEntries(extras) });
  let prs;
  if (arg('--prs')) prs = JSON.parse((await import('node:fs')).readFileSync(arg('--prs'), 'utf8'));
  else prs = Object.fromEntries(Object.entries(projetos).map(([k, p]) => { const repo = repoDe(p.dir); return [k, repo ? buscarPrs(repo, desde, ate) : null]; }));
  const r = medirSemana({ projetos, pasta: arg('--pasta') ?? join(homedir(), '.claude', 'projects'), desde, ate, prs, piso: !argv.includes('--sem-piso') });
  console.log(argv.includes('--json') ? JSON.stringify(r, null, 2) : relatorioMarkdown(r));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal(process.argv.slice(2));
