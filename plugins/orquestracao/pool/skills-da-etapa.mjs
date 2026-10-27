#!/usr/bin/env node
// As skills que a dona carrega ao entrar em cada etapa do item, lidas de `skills-por-etapa.json`.
//   node skills-da-etapa.mjs <planejamento|design|execucao|validacao> [--json]
// Sem I/O além de ler o mapa (SKILLS_MAPA troca o arquivo, para teste).
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ETAPAS = ['planejamento', 'design', 'execucao', 'validacao'];
const MAPA = process.env.SKILLS_MAPA || join(dirname(fileURLToPath(import.meta.url)), 'skills-por-etapa.json');

export function skillsDaEtapa(etapa, mapa = JSON.parse(readFileSync(MAPA, 'utf8'))) {
  if (!ETAPAS.includes(etapa)) throw new Error(`etapa "${etapa}" não é ${ETAPAS.join(', ')}`);
  const lista = mapa.etapas?.[etapa];
  if (!Array.isArray(lista)) throw new Error(`o mapa não tem a etapa "${etapa}"`);
  return lista;
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
