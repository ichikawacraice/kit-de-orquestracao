#!/usr/bin/env node
// ADR 0011: as skills que a dona carrega ao entrar em cada etapa do item. A fonte é a mesma do pool, `skills-por-papel.json`:
// cada etapa lê a coluna do papel que a fazia (planejamento → P, design → D, execucao → E, validacao → V), só os `le`, e o
// nome curto sai quando a irmã prefixada (`plugin:nome`) também está na lista.
//   node skills-da-etapa.mjs <planejamento|design|execucao|validacao> [--json]
// Sem I/O além de ler o mapa (SKILLS_MAPA troca o arquivo, para teste).
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COLUNA_DA_ETAPA = { planejamento: 'P', design: 'D', execucao: 'E', validacao: 'V' };
const MAPA = process.env.SKILLS_MAPA || join(dirname(fileURLToPath(import.meta.url)), 'skills-por-papel.json');

export function skillsDaEtapa(etapa, mapa = JSON.parse(readFileSync(MAPA, 'utf8'))) {
  const coluna = COLUNA_DA_ETAPA[etapa];
  if (!coluna) throw new Error(`etapa "${etapa}" não é ${Object.keys(COLUNA_DA_ETAPA).join(', ')}`);
  const le = Object.entries(mapa.skills ?? {}).filter(([, s]) => s?.[coluna] === 'le').map(([n]) => n);
  return le.filter((n) => n.includes(':') || !le.some((o) => o.endsWith(`:${n}`)));
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const [etapa, ...resto] = process.argv.slice(2);
    const lista = skillsDaEtapa(etapa);
    process.stdout.write(resto.includes('--json') ? `${JSON.stringify(lista)}\n` : lista.map((s) => `${s}\n`).join(''));
  } catch (e) {
    process.stderr.write(`skills-da-etapa: ${e?.message || e}\n`);
    process.exitCode = 1;
  }
}
