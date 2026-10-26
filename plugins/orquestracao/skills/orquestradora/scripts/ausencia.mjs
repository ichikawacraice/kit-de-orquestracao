#!/usr/bin/env node
// F59: resumo do período do modo ausente. O script junta os FATOS (git, painel); o texto ao operador é da orquestradora
// (SKILL.md da orquestradora, seção `resumo-da-ausencia`).
//   ausencia.mjs periodo                                  → {desde, ate, por} do último período desligado, ou null
//   ausencia.mjs resumo [--projeto p] [--desde ISO --ate ISO] [--repo dir] [--branch b] [--md]
//   ausencia.mjs pendente [--projeto p]                   → {desde, ate} (período ≤ 7 dias sem entrega) ou null
//   ausencia.mjs entregue [--projeto p] [--repo dir]      → grava <BASE>/ausencias/<desde>--<projeto>.json
// Ambiente (testes): HOOKS_CREWAI_BASE (padrão ~/.claude/orquestracao) e PAINEL_DIR (padrão <BASE>/painel).
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BASE = () => process.env.HOOKS_CREWAI_BASE || join(homedir(), '.claude', 'orquestracao');
const PAINEL = () => process.env.PAINEL_DIR || process.env.IZANAGI_PAINEL_DIR || join(BASE(), 'painel');
const VALIDADE_MS = 7 * 24 * 3600 * 1000;
const FECHADAS = new Set(['feito', 'descartado']);
const git = (cwd, args, timeout = 20000) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'] });
const ms = (v) => { const t = Date.parse(v); return Number.isNaN(t) ? null : t; };

export function projetoDoRepo(dir) {
  try {
    const repo = git(dir, ['rev-parse', '--path-format=absolute', '--git-common-dir'], 5000).trim();
    if (!repo) return null;
    const raiz = basename(repo) === '.git' ? dirname(repo) : repo;
    return basename(raiz).replace(/\.git$/, '').toLowerCase() || null;
  } catch { return null; }
}

function lerBandeira() {
  try { const b = JSON.parse(readFileSync(join(BASE(), 'operador-ausente.json'), 'utf8')); return b && typeof b === 'object' ? b : null; } catch { return null; }
}

// Último período desligado: bandeira `ligado:false` com `desde` e `desligadoEm` válidos.
export function periodoDesligado() {
  const b = lerBandeira();
  if (!b || b.ligado !== false || ms(b.desde) === null || ms(b.desligadoEm) === null) return null;
  return { desde: b.desde, ate: b.desligadoEm, por: b.por ?? null };
}

const arquivoDeEntrega = (desde, projeto) => join(BASE(), 'ausencias', `${String(desde).replaceAll(':', '-')}--${projeto}.json`);

// Período desligado há ≤ 7 dias sem arquivo de entrega do projeto → {desde, ate}; senão null.
export function pendente(projeto) {
  const p = periodoDesligado();
  if (!p || !projeto) return null;
  if (Date.now() - ms(p.ate) > VALIDADE_MS) return null;
  if (existsSync(arquivoDeEntrega(p.desde, projeto))) return null;
  return { desde: p.desde, ate: p.ate };
}

function lerColecao(colecao, avisos) {
  const dir = join(PAINEL(), colecao);
  let nomes = [];
  try { nomes = readdirSync(dir).filter((n) => n.endsWith('.json')); } catch { return []; }
  const out = [];
  for (const n of nomes) {
    try {
      const j = JSON.parse(readFileSync(join(dir, n), 'utf8'));
      const data = j?.data;
      if (!data || typeof data !== 'object') throw new Error('sem data');
      out.push({ id: j.id ?? n.replace(/\.json$/, ''), ...data });
    } catch (e) { avisos.push(`${colecao}/${n}: ilegível (${e.message})`); }
  }
  return out;
}

const etapaDe = (h) => h?.etapa ?? h?.para ?? null;

export function montarResumo({ projeto, desde, ate, repo, branch = 'main' }) {
  const d0 = ms(desde); const d1 = ms(ate);
  // Data só-dia (AAAA-MM-DD) vale como o dia inteiro em UTC: está dentro se o dia cruza o período.
  const dentro = (v) => {
    const t = ms(v); if (t === null) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(v).trim())) return t <= d1 && t + 86400000 > d0;
    return t >= d0 && t <= d1;
  };
  const avisos = [];
  const mesmo = (p) => p && String(p).toLowerCase() === projeto;

  let main = [];
  try {
    try { git(repo, ['fetch', '-q', 'origin', branch], 30000); } catch (e) { avisos.push(`sem fetch: ${String(e.message).split('\n')[0]}`); }
    const saida = git(repo, ['log', `origin/${branch}`, '--first-parent', `--since=${desde}`, `--until=${ate}`, '--format=%h%x09%s']);
    main = saida.split('\n').filter(Boolean).map((l) => {
      const [sha, ...r] = l.split('\t'); const titulo = r.join('\t');
      const prs = [...titulo.matchAll(/\(#(\d+)\)/g)];
      return { sha, titulo, pr: prs.length ? Number(prs[prs.length - 1][1]) : null };
    });
  } catch (e) { avisos.push(`git log falhou: ${String(e.message).split('\n')[0]}`); }

  const sessoes = lerColecao('sessoes', avisos);
  const projetoDaSessao = new Map(sessoes.map((s) => [s.id, s.projeto]));
  const itens = lerColecao('fila', avisos).filter((i) => mesmo(i.projeto));
  const feitos = []; const andaram = []; const parados = [];
  for (const i of itens) {
    const hist = Array.isArray(i.historico) ? i.historico : [];
    if (FECHADAS.has(i.etapa)) {
      if (dentro(i.feitoEm)) feitos.push({ id: i.id, titulo: i.titulo, etapa: i.etapa, prs: i.prs ?? [] });
      continue;
    }
    const noPeriodo = hist.filter((h) => dentro(h.em));
    if (noPeriodo.length) {
      const primeira = noPeriodo[0];
      const idx = hist.indexOf(primeira);
      const de = primeira.de ?? (idx > 0 ? etapaDe(hist[idx - 1]) : null);
      andaram.push({ id: i.id, titulo: i.titulo, de, para: i.etapa ?? null, dono: i.dono ?? null });
    } else {
      let motivo = 'sem movimento';
      if (i.trava) motivo = `travado: ${i.trava.texto ?? i.trava.motivo ?? ''}`.trim();
      else if (i.espera) motivo = `espera ${i.espera.motivo ?? ''}: ${i.espera.texto ?? ''}`.trim();
      else if (!i.dono && !(Array.isArray(i.com) && i.com.length)) motivo = 'sem ninguém';
      parados.push({ id: i.id, titulo: i.titulo, etapa: i.etapa ?? null, motivo });
    }
  }

  // Pergunta sem projeto cuja sessão também não resolve não some: assumida e aberta vão em `semProjeto` (quem lê decide).
  const todasPerguntas = lerColecao('perguntas', avisos);
  const projetoDe = (q) => q.projeto ?? projetoDaSessao.get(q.sessaoId);
  const perguntas = todasPerguntas.filter((q) => mesmo(projetoDe(q)));
  const resumoDe = (q) => ({ id: q.id, titulo: q.titulo, recomendacao: q.recomendacao ?? null, sessaoId: q.sessaoId ?? null });
  const assumidas = perguntas.filter((q) => q.estado === 'assumida').map((q) => ({ ...resumoDe(q), noPeriodo: dentro(q.criadaEm) || dentro(q.atualizadoEm) }));
  const abertas = perguntas.filter((q) => q.estado === 'aberta').map(resumoDe);
  const semProjeto = todasPerguntas.filter((q) => !projetoDe(q) && (q.estado === 'assumida' || q.estado === 'aberta')).map((q) => ({ ...resumoDe(q), estado: q.estado }));
  const sessoesArquivadas = sessoes.filter((s) => mesmo(s.projeto) && s.estado === 'concluida' && dentro(s.atualizadoEm)).map((s) => ({ id: s.id, titulo: s.titulo }));

  const pedeAcao = [
    ...abertas.map((q) => ({ tipo: 'pergunta', id: q.id, texto: q.titulo })),
    ...assumidas.map((q) => ({ tipo: 'pergunta', id: q.id, texto: q.titulo })),
    ...semProjeto.map((q) => ({ tipo: 'pergunta', id: q.id, texto: q.titulo })),
    ...itens.filter((i) => !FECHADAS.has(i.etapa)).flatMap((i) => {
      const l = [];
      if (i.espera?.motivo === 'operador') l.push({ tipo: 'espera', id: i.id, texto: i.espera.texto ?? i.titulo });
      if (['operador', 'acesso'].includes(i.trava?.motivo)) l.push({ tipo: 'trava', id: i.id, texto: i.trava.texto ?? i.titulo });
      return l;
    }),
  ];
  return { projeto, periodo: { desde, ate }, main, itens: { feitos, andaram, parados }, perguntas: { assumidas, abertas, semProjeto }, sessoesArquivadas, pedeAcao, avisos };
}

export function emMarkdown(r) {
  const L = [`## Resumo do modo ausente — ${r.projeto}`, `Período: ${r.periodo.desde} → ${r.periodo.ate}`, ''];
  const sec = (t, linhas) => { L.push(`### ${t}`); L.push(...(linhas.length ? linhas : ['- nada'])); L.push(''); };
  sec('Entrou na main', r.main.map((m) => `- ${m.pr ? `#${m.pr} ` : ''}${m.titulo} (${m.sha})`));
  sec('Itens feitos', r.itens.feitos.map((i) => `- ${i.id} · ${i.titulo}${i.prs.length ? ` (PR ${i.prs.join(', ')})` : ''}`));
  sec('Itens que andaram', r.itens.andaram.map((i) => `- ${i.id} · ${i.titulo}: ${i.de ?? '?'} → ${i.para ?? '?'}`));
  sec('Itens parados', r.itens.parados.map((i) => `- ${i.id} · ${i.titulo}: ${i.motivo}`));
  sec('Decisões assumidas (a confirmar)', r.perguntas.assumidas.map((q) => `- ${q.id} · ${q.titulo}${q.noPeriodo ? ' (dentro do período)' : ''}${q.recomendacao ? ` — assumi: ${q.recomendacao}` : ''}`));
  sec('Perguntas abertas', r.perguntas.abertas.map((q) => `- ${q.id} · ${q.titulo}`));
  sec('Perguntas sem projeto', r.perguntas.semProjeto.map((q) => `- ${q.id} · ${q.titulo} (${q.estado})`));
  sec('Sessões arquivadas', r.sessoesArquivadas.map((s) => `- ${s.titulo} (${s.id})`));
  sec('Pede ação do operador', r.pedeAcao.map((p) => `- ${p.tipo} ${p.id}: ${p.texto}`));
  if (r.avisos.length) sec('Avisos', r.avisos.map((a) => `- ${a}`));
  return L.join('\n');
}

function opcoes(args) {
  const o = { md: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--md') o.md = true;
    else if (a.startsWith('--')) { o[a.slice(2)] = args[++i]; }
  }
  return o;
}

function main(argv) {
  const [cmd, ...resto] = argv;
  const o = opcoes(resto);
  const repo = o.repo || process.cwd();
  const projeto = (o.projeto || projetoDoRepo(repo) || '').toLowerCase();
  const sai = (v) => process.stdout.write(`${JSON.stringify(v)}\n`);
  const falha = (m) => { process.stderr.write(`ausencia.mjs: ${m}\n`); process.exitCode = 1; };
  const periodoEscolhido = () => (o.desde && o.ate ? { desde: o.desde, ate: o.ate } : periodoDesligado());
  if (cmd === 'periodo') return sai(periodoDesligado());
  if (cmd === 'pendente') return sai(pendente(projeto));
  if (cmd === 'resumo' || cmd === 'entregue') {
    const p = periodoEscolhido();
    if (!p || ms(p.desde) === null || ms(p.ate) === null) return falha('sem período: a bandeira não tem um período desligado; passe --desde e --ate');
    if (!projeto) return falha('projeto não resolvido: rode dentro do repositório ou passe --projeto');
    const r = montarResumo({ projeto, desde: p.desde, ate: p.ate, repo, branch: o.branch || 'main' });
    if (cmd === 'resumo') return o.md ? process.stdout.write(`${emMarkdown(r)}\n`) : sai(r);
    const arq = arquivoDeEntrega(p.desde, projeto);
    mkdirSync(dirname(arq), { recursive: true });
    writeFileSync(arq, `${JSON.stringify({ periodo: { desde: p.desde, ate: p.ate }, projeto, entregueEm: new Date().toISOString(), resumo: r }, null, 2)}\n`);
    return sai({ entregue: arq });
  }
  return falha('uso: ausencia.mjs periodo | resumo [--md] | pendente | entregue');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(`ausencia.mjs: ${e?.stack || e}\n`); process.exitCode = 1; }
}
