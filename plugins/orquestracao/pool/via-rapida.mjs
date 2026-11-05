#!/usr/bin/env node
// O corte da via rápida da revisão (F348, protocolo `via-rapida-da-revisao`): o item pequeno que cabe se autorrevisa;
// o que não cabe vai ao `orquestracao:validador` separado.
//   node via-rapida.mjs [--base <ref>] [--json]
// Cabe quando: até LINHAS_MAX linhas mudadas (adições + remoções) em até ARQUIVOS_MAX arquivos, nenhum arquivo de
// contrato ou de trava (FORA_PADRAO mais `viaRapida.fora` do `.claude/kit.json`), nenhum removido ou renomeado, nenhum
// binário. O mesmo corte dá o modelo do validador (`validador`: `sonnet` sem contrato nem trava, `opus` com). Conta os commits da branch, a árvore de trabalho e os arquivos novos fora do índice. Sai 0 quando cabe, 1 quando
// não cabe, 2 em erro. O que o diff não mostra (estado gravado, segurança, item de risco) a dona declara no laudo.
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acharBase, casaGlob } from '../skills/orquestradora/scripts/testes-afetados.mjs';

export const LINHAS_MAX = 60;
export const ARQUIVOS_MAX = 4;
// Padrão sem `/` casa o nome em qualquer pasta (o `casaGlob` dos testes afetados).
export const FORA_PADRAO = [
  'docs/adr/**', 'docs/specs/**', '**/migrations/**', '*.sql', '*schema*',
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'yarn.lock',
  '.claude/kit.json', 'settings.json', 'settings.local.json', 'plugin.json', 'marketplace.json',
  '**/hooks/**', 'hooks.json', 'gate/**', '**/pool/protocolo.md', '**/pool/referencia.md', '**/pool/dona.md', '**/pool/via-rapida.mjs',
  '**/agents/**', 'skills-de-fora.json', '**/skills/papeis-e-modelos/**', 'CLAUDE.md', '.github/**',
];

// core.quotePath=false: o caminho com acento sai cru, e não entre aspas com escapes (que nenhum padrão casaria)
const git = (args, cwd) => execFileSync(process.env.GIT_BIN || 'git', ['-c', 'core.quotePath=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000, killSignal: 'SIGKILL', maxBuffer: 64 << 20 });
const linhas = (t) => t.split('\n').filter(Boolean);

function foraDoProjeto(raiz) {
  try {
    const v = JSON.parse(readFileSync(join(raiz, '.claude', 'kit.json'), 'utf8').replace(/^﻿/, ''))?.viaRapida?.fora;
    return Array.isArray(v) ? v.filter((g) => typeof g === 'string' && g) : [];
  } catch { return []; }
}

export function corte(cwd, base) {
  const raiz = git(['rev-parse', '--show-toplevel'], cwd).trim();
  const mb = git(['merge-base', base, 'HEAD'], raiz).trim();
  // Sem detectar renomeação: o renomeado aparece como removido + novo, e o removido já tira do corte.
  const arquivos = new Map(); // caminho → { linhas (null = binário), status }
  for (const l of linhas(git(['diff', '--numstat', '--no-renames', mb], raiz))) {
    const [a, r, ...cam] = l.split('\t');
    arquivos.set(cam.join('\t'), { linhas: a === '-' ? null : Number(a) + Number(r), status: 'M' });
  }
  for (const l of linhas(git(['diff', '--name-status', '--no-renames', '--diff-filter=D', mb], raiz))) {
    const cam = l.split('\t').slice(1).join('\t');
    arquivos.set(cam, { ...(arquivos.get(cam) ?? { linhas: 0 }), status: 'D' });
  }
  for (const f of linhas(git(['ls-files', '--others', '--exclude-standard'], raiz))) {
    let n = null;
    try { const t = readFileSync(join(raiz, f)); n = t.includes(0) ? null : linhas(t.toString('utf8')).length; } catch { /* ilegível: binário */ }
    arquivos.set(f, { linhas: n, status: 'A' });
  }
  const globs = [...FORA_PADRAO, ...foraDoProjeto(raiz)];
  const motivos = [];
  const risco = []; // o que pede o validador em Opus (F373): contrato, trava, removido, binário
  const lista = [...arquivos.entries()].map(([caminho, a]) => ({ caminho, ...a }));
  const total = lista.reduce((s, a) => s + (a.linhas ?? 0), 0);
  if (!lista.length) motivos.push('o diff está vazio');
  if (total > LINHAS_MAX) motivos.push(`${total} linhas mudadas (o corte é ${LINHAS_MAX})`);
  if (lista.length > ARQUIVOS_MAX) motivos.push(`${lista.length} arquivos (o corte é ${ARQUIVOS_MAX})`);
  for (const a of lista) {
    if (a.linhas === null) risco.push(`${a.caminho}: binário`);
    if (a.status === 'D') risco.push(`${a.caminho}: removido (ou renomeado)`);
    const g = globs.find((x) => casaGlob(a.caminho, x));
    if (g) risco.push(`${a.caminho}: contrato ou trava (${g})`);
  }
  motivos.push(...risco);
  // O modelo do validador (F373): Sonnet só com diff não vazio e sem risco; o resto fica no padrão do agente (Opus).
  const validador = lista.length && !risco.length ? 'sonnet' : 'opus';
  return { cabe: motivos.length === 0, base, linhas: total, arquivos: lista.map((a) => a.caminho), motivos, risco, validador };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const args = process.argv.slice(2);
    const i = args.indexOf('--base');
    const base = acharBase(process.cwd(), i >= 0 ? args[i + 1] : process.env.KIT_BASE);
    const r = corte(process.cwd(), base);
    process.stdout.write(args.includes('--json') ? `${JSON.stringify(r, null, 2)}\n`
      : `via rápida: ${r.cabe ? 'cabe' : 'não cabe'} (base ${r.base}, ${r.linhas} linhas em ${r.arquivos.length} arquivos)\n${r.motivos.map((m) => `- ${m}\n`).join('')}`
        + `validador: ${r.validador}${r.validador === 'opus' ? (r.risco.length ? ' (contrato, trava ou removido no diff)' : ' (diff vazio)') : ' (diff sem contrato nem trava; o hook usa Sonnet só com o item declarado "risco":false)'}\n`);
    process.exitCode = r.cabe ? 0 : 1;
  } catch (e) {
    process.stderr.write(`via-rapida: ${e?.message || e}\n`);
    process.exitCode = 2;
  }
}
