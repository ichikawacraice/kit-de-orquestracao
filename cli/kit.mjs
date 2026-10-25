#!/usr/bin/env node
// CLI do kit. Nesta fatia (K1) só responde --version e ajuda; os comandos entram nas fatias K6 e K7.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const versao = () => JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version;

const AJUDA = `kit — orquestração de sessões do Claude Code

uso:
  kit --version   mostra a versão
  kit ajuda       mostra esta ajuda

(iniciar, adotar, atualizar, doutor e remover chegam nas próximas fatias)
`;

function main(argv) {
  const [cmd] = argv;
  if (cmd === '--version' || cmd === '-v') { process.stdout.write(`${versao()}\n`); return 0; }
  if (cmd === undefined || cmd === 'ajuda' || cmd === '--help' || cmd === '-h') { process.stdout.write(AJUDA); return 0; }
  process.stderr.write(`kit: comando desconhecido: ${cmd}\n\n${AJUDA}`);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
