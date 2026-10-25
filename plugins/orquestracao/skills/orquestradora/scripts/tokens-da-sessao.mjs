#!/usr/bin/env node
// Q69 (23/10): o gasto de uma sessão em tokens, para gravar na linha do painel ao arquivá-la.
// `get_usage` não serve aqui: em sessão ociosa ou arquivada devolve "unavailable" (sem processo),
// e mesmo viva ele mede a JANELA atual, não o gasto acumulado. O gasto mora no transcript.
// Uso: node tokens-da-sessao.mjs --cwd <cwd> --titulo "<título exato>" [--desde <createdAt> --ate <lastActivityAt>]
// O título se repete (a orquestradora de cada dia; a sessão que limpou o contexto gera vários
// arquivos): `--desde`/`--ate` (createdAt e lastActivityAt do get_session) ficam só com os
// transcripts que COMEÇARAM dentro da vida da sessão, e todos eles são somados — são a mesma
// sessão em vários arquivos. Só o `--desde` não basta: somaria as homônimas abertas depois
// (medido em 23/10: 7 arquivos e 416 M de tokens para uma orquestradora que acabou em 16/10).
// Saída: JSON com as somas (deduplicadas por message.id) do fio principal e dos subagentes,
// inclusive os aninhados (subagents/workflows/**), que podem ser 80% do gasto.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function arg(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function linhas(f) {
  const out = [];
  for (const l of readFileSync(f, 'utf8').split('\n')) {
    if (!l) continue;
    try { out.push(JSON.parse(l)); } catch { /* linha parcial */ }
  }
  return out;
}

function somar(arquivos) {
  const t = { entrada: 0, cacheLido: 0, cacheEscrito: 0, saida: 0 };
  const vistos = new Set();
  for (const f of arquivos) {
    for (const e of linhas(f)) {
      const m = e.message;
      if (e.type !== 'assistant' || !m?.usage || !m.id || vistos.has(m.id)) continue;
      vistos.add(m.id); // o streaming grava uma entrada por bloco, com o mesmo usage
      t.entrada += m.usage.input_tokens || 0;
      t.cacheLido += m.usage.cache_read_input_tokens || 0;
      t.cacheEscrito += m.usage.cache_creation_input_tokens || 0;
      t.saida += m.usage.output_tokens || 0;
    }
  }
  return { ...t, total: t.entrada + t.cacheLido + t.cacheEscrito + t.saida };
}

function jsonlsAbaixo(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? jsonlsAbaixo(join(dir, d.name)) : d.name.endsWith('.jsonl') ? [join(dir, d.name)] : []);
}
const inicioDe = (f) => linhas(f).find((e) => e.timestamp)?.timestamp ?? '';

function main() {
  const cwd = arg('cwd');
  const titulo = arg('titulo');
  if (!cwd || !titulo) {
    console.error('uso: tokens-da-sessao.mjs --cwd <cwd> --titulo "<título>"');
    return 2;
  }
  const pasta = join(homedir(), '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
  if (!existsSync(pasta)) {
    console.error(`sem pasta de transcripts para o cwd: ${pasta}`);
    return 1;
  }
  const datas = {};
  for (const nome of ['desde', 'ate']) {
    const v = arg(nome);
    if (v === undefined) continue;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) { console.error(`--${nome} não é data: ${v}`); return 2; }
    datas[nome] = d.toISOString();
  }
  const { desde, ate } = datas;
  // O título vive na última entrada custom-title; a sessão renomeada casa pelo nome atual.
  const candidatos = readdirSync(pasta).filter((f) => f.endsWith('.jsonl')).filter((f) => {
    const t = linhas(join(pasta, f)).filter((e) => e.type === 'custom-title').pop()?.customTitle;
    if (t !== titulo) return false;
    const ini = inicioDe(join(pasta, f));
    return (!desde || ini >= desde) && (!ate || ini <= ate);
  });
  if (candidatos.length === 0 || (candidatos.length > 1 && !(desde && ate))) {
    console.error(`${candidatos.length} transcripts com o título "${titulo}" em ${pasta}` +
      (candidatos.length > 1 ? ' — passe --desde <createdAt> e --ate <lastActivityAt> do get_session' : '') + `: ${candidatos.join(', ') || '(nenhum)'}`);
    return 1;
  }
  const principais = candidatos.map((c) => join(pasta, c));
  const subs = candidatos.flatMap((c) => jsonlsAbaixo(join(pasta, c.replace(/\.jsonl$/, ''), 'subagents')));
  const fio = somar(principais);
  const subagentes = somar(subs);
  console.log(JSON.stringify({
    transcripts: principais,
    total: fio.total + subagentes.total,
    fio,
    subagentes: { n: subs.length, ...subagentes },
  }));
  return 0;
}

process.exitCode = main();
