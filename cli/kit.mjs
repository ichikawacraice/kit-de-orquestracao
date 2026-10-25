#!/usr/bin/env node
// CLI do kit: --version, ajuda, iniciar e doutor (K6); adotar, atualizar e remover chegam na K7.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { doutor } from './doutor.mjs';
import { iniciar } from './iniciar.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const versao = () => JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version;

const AJUDA = `kit — orquestração de sessões do Claude Code

uso:
  kit --version                              mostra a versão
  kit ajuda                                  mostra esta ajuda
  kit iniciar [--perfil simples|pnpm-workspace]
                                             prepara um projeto sem CLAUDE.md (gate, guarda, plugins, lock)
  kit doutor                                 confere o disco com o .claude/kit.lock.json

(adotar, atualizar e remover chegam na próxima fatia)
`;

function main(argv) {
  const [cmd] = argv;
  if (cmd === '--version' || cmd === '-v') { process.stdout.write(`${versao()}\n`); return 0; }
  if (cmd === undefined || cmd === 'ajuda' || cmd === '--help' || cmd === '-h') { process.stdout.write(AJUDA); return 0; }
  if (cmd === 'iniciar') {
    const i = argv.indexOf('--perfil');
    const perfil = i === -1 ? undefined : argv[i + 1];
    if (i !== -1 && !perfil) { process.stderr.write('kit iniciar: --perfil pede um valor\n'); return 2; }
    const r = iniciar({ destino: process.cwd(), perfil, versao: versao() });
    (r.codigo === 0 ? process.stdout : process.stderr).write(`${r.mensagem}\n`);
    return r.codigo;
  }
  if (cmd === 'doutor') {
    const r = doutor({ destino: process.cwd() });
    if (r.saida) process.stdout.write(r.saida);
    if (r.erro) process.stderr.write(`${r.erro}\n`);
    return r.codigo;
  }
  process.stderr.write(`kit: comando desconhecido: ${cmd}\n\n${AJUDA}`);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
