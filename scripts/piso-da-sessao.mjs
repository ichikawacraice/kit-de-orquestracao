#!/usr/bin/env node
// O piso da sessão: quanto contexto a 1ª chamada à API já leva, separado por fonte (system prompt, esquema das ferramentas,
// CLAUDE.md, contexto injetado no início, lista de skills…). Lê os transcripts (`*.jsonl`) que o Claude Code grava com a
// forma da requisição (`api-request-shape`) e as mensagens dela (`api-request-blob`); o token de cada fonte é o tamanho dela
// em caracteres na proporção do total de tokens que a 1ª chamada pagou (`usage`), então soma exatamente o piso medido.
// Só lê. Não é teste da suíte: o padrão lê o HOME real.
//   node scripts/piso-da-sessao.mjs [--desde AAAA-MM-DD] [--pasta <dir de projects>] [--sessao <arquivo.jsonl>] [--json]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Marcadores das fontes dentro das mensagens do início, na ordem em que aparecem. Cada fonte vai do marcador dela até o
// próximo marcador (de qualquer fonte); `outros` fecha as fontes cujo fim não tem marcador próprio.
export const MARCADORES = [
  [/^<\/?system-reminder>/m, 'outros'],
  [/^Contents of .*\/\.claude\/CLAUDE\.md \(user's private global/m, 'claude-md-global'],
  [/^Contents of .*CLAUDE\.md \(project instructions/m, 'claude-md-projeto'],
  [/^Contents of .*MEMORY\.md/m, 'memoria'],
  [/<EXTREMELY_IMPORTANT>\nYou have superpowers/, 'hook-superpowers'],
  [/^<\/EXTREMELY_IMPORTANT>/m, 'outros'],
  [/^# Regras do kit de orquestração/m, 'hook-kit'],
  [/^# Environment$/m, 'outros'],
  [/^The following deferred tools are now available/m, 'nomes-de-ferramentas-adiadas'],
  [/^The following MCP servers require authentication/m, 'mcp-sem-login'],
  [/^The following MCP servers are still connecting/m, 'outros'],
  [/^Available agent types for the Agent tool/m, 'agentes'],
  [/^# MCP Server Instructions/m, 'mcp-instrucoes'],
  [/^The following skills are available for use with the Skill tool/m, 'skills'],
  [/^While bypass permissions mode is active/m, 'outros'],
  [/^Concise output style is active/m, 'outros'],
];

// Grupo do esquema de cada ferramenta: o servidor MCP (`mcp__<servidor>__…`) ou o nome, para as do próprio Claude Code.
export function grupoDaFerramenta(nome) {
  const m = /^mcp__([^_]+(?:_[^_]+)*?)__/.exec(nome);
  if (m) return `ferramentas:mcp:${m[1]}`;
  return nome === 'Artifact' ? 'ferramentas:Artifact' : 'ferramentas:nativas';
}

export function fatiar(texto) {
  const achados = [];
  for (const [re, fonte] of MARCADORES) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const m of texto.matchAll(g)) achados.push([m.index, fonte]);
  }
  achados.sort((a, b) => a[0] - b[0]);
  const out = {};
  const soma = (f, n) => { if (n > 0) out[f] = (out[f] ?? 0) + n; };
  soma('outros', achados.length ? achados[0][0] : texto.length);
  achados.forEach(([i, f], k) => soma(f, (k + 1 < achados.length ? achados[k + 1][0] : texto.length) - i));
  return out;
}

const linhas = (arquivo) => readFileSync(arquivo, 'utf8').split('\n').flatMap((l) => { try { return l ? [JSON.parse(l)] : []; } catch { return []; } });

// Piso de um transcript: { piso, fontes: {fonte: tokens} } ou null quando não há forma da requisição nem uso.
export function pisoDoTranscript(arquivo) {
  const L = linhas(arquivo);
  const forma = L.find((j) => j.type === 'api-request-shape')?.shape;
  const iResp = L.findIndex((j) => j.type === 'assistant' && j.message?.usage);
  if (!forma || iResp < 0) return null;
  const u = L[iResp].message.usage;
  const piso = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  const chars = {};
  const soma = (f, n) => { chars[f] = (chars[f] ?? 0) + n; };
  soma('system-prompt', (forma.system ?? []).reduce((s, b) => s + (b.text?.length ?? 0), 0));
  for (const t of forma.tools ?? []) soma(grupoDaFerramenta(t.name ?? ''), JSON.stringify(t).length);
  // As mensagens da 1ª requisição: os blobs gravados antes da 1ª resposta com uso.
  for (const j of L.slice(0, iResp)) {
    if (j.type !== 'api-request-blob') continue;
    const c = j.message?.content;
    const texto = typeof c === 'string' ? c : (c ?? []).map((p) => p.text ?? JSON.stringify(p)).join('\n');
    for (const [f, n] of Object.entries(fatiar(texto))) soma(f, n);
  }
  const total = Object.values(chars).reduce((s, n) => s + n, 0);
  if (!total || !piso) return null;
  const fontes = Object.fromEntries(Object.entries(chars).map(([f, n]) => [f, Math.round((n * piso) / total)]));
  return { piso, fontes };
}

function* transcripts(dir, desde) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* transcripts(p, desde);
    else if (e.name.endsWith('.jsonl') && statSync(p).mtime >= desde) yield p;
  }
}

const mediana = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// Agrega por tipo (principal × subagente): mediana do piso e mediana de cada fonte (fonte ausente conta 0).
export function agregar(arquivos) {
  const tipos = {};
  for (const f of arquivos) {
    const r = pisoDoTranscript(f);
    if (!r) continue;
    const tipo = f.includes('/subagents/') ? 'subagente' : 'principal';
    (tipos[tipo] ??= []).push(r);
  }
  const out = {};
  for (const [tipo, rs] of Object.entries(tipos)) {
    const nomes = [...new Set(rs.flatMap((r) => Object.keys(r.fontes)))];
    const fontes = Object.fromEntries(nomes.map((n) => [n, mediana(rs.map((r) => r.fontes[n] ?? 0))]).sort((a, b) => b[1] - a[1]));
    out[tipo] = { sessoes: rs.length, piso: mediana(rs.map((r) => r.piso)), fontes };
  }
  return out;
}

function principal(argv) {
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const sessao = arg('--sessao');
  const res = sessao
    ? { sessao: pisoDoTranscript(sessao) }
    : agregar([...transcripts(arg('--pasta') ?? join(homedir(), '.claude', 'projects'), new Date(arg('--desde') ?? '1970-01-01'))]);
  if (argv.includes('--json')) { console.log(JSON.stringify(res, null, 2)); return; }
  const mil = (n) => (n / 1000).toFixed(1) + ' mil';
  for (const [tipo, r] of Object.entries(res)) {
    if (!r) { console.log(`${tipo}: sem forma da requisição no transcript`); process.exitCode = 1; continue; }
    console.log(`${tipo}: piso ${mil(r.piso)}${r.sessoes ? ` (mediana de ${r.sessoes} sessões)` : ''}`);
    for (const [f, n] of Object.entries(r.fontes).sort((a, b) => b[1] - a[1])) console.log(`  ${f.padEnd(40)} ${mil(n).padStart(9)}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal(process.argv.slice(2));
