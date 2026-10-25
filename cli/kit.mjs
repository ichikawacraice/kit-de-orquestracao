#!/usr/bin/env node
// CLI do kit: --version, ajuda, iniciar, adotar, atualizar, doutor e remover.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adotar } from './adotar.mjs';
import { atualizar } from './atualizar.mjs';
import { doutor } from './doutor.mjs';
import { iniciar } from './iniciar.mjs';
import { remover } from './remover.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const versao = () => JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version;

const AJUDA = `kit — orquestração de sessões do Claude Code

uso:
  kit --version                              mostra a versão
  kit ajuda                                  mostra esta ajuda
  kit iniciar [--perfil simples|pnpm-workspace]
                                             prepara um projeto sem CLAUDE.md (gate, guarda, plugins, lock)
  kit adotar [--simular] [--trocar-test] [--parcial] [--perfil …]
                                             põe o kit num projeto em andamento, sem sobrescrever nada;
                                             com conflito não grava nada (--parcial grava o resto)
  kit atualizar [--simular] [--trocar-test]  troca pela versão nova o que você não editou; o resto vira conflito
  kit doutor                                 confere plugin, hooks, kit.json, versões e o disco com o lock
  kit remover [--simular]                    tira o que o kit pôs (blocos, chaves e arquivos cujo hash bate)
`;

const FLAGS = { iniciar: ['--perfil'], adotar: ['--simular', '--trocar-test', '--parcial', '--perfil'], atualizar: ['--simular', '--trocar-test'], remover: ['--simular'], doutor: [] };

/** Flag que o subcomando não conhece → mensagem com a lista das válidas (uma flag errada não pode virar adoção calada). */
function flagDesconhecida(cmd, argv) {
  const validas = FLAGS[cmd];
  if (!validas) return null;
  const rest = argv.slice(1);
  const ruins = rest.filter((a, i) => a.startsWith('-') && !validas.includes(a) && !(rest[i - 1] === '--perfil' && validas.includes('--perfil')));
  if (!ruins.length) return null;
  return `kit ${cmd}: flag desconhecida ${ruins.join(', ')} — válidas: ${validas.length ? validas.join(', ') : '(nenhuma)'}\n`;
}

function main(argv) {
  const [cmd] = argv;
  if (cmd === '--version' || cmd === '-v') { process.stdout.write(`${versao()}\n`); return 0; }
  if (cmd === undefined || cmd === 'ajuda' || cmd === '--help' || cmd === '-h') { process.stdout.write(AJUDA); return 0; }
  const ruim = flagDesconhecida(cmd, argv);
  if (ruim) { process.stderr.write(ruim); return 2; }
  if (cmd === 'iniciar') {
    const i = argv.indexOf('--perfil');
    const perfil = i === -1 ? undefined : argv[i + 1];
    if (i !== -1 && !perfil) { process.stderr.write('kit iniciar: --perfil pede um valor\n'); return 2; }
    const r = iniciar({ destino: process.cwd(), perfil, versao: versao() });
    (r.codigo === 0 ? process.stdout : process.stderr).write(`${r.mensagem}\n`);
    return r.codigo;
  }
  const flag = (n) => argv.includes(n);
  const imprimir = (r) => { if (r.saida) process.stdout.write(r.saida); if (r.erro) process.stderr.write(`${r.erro}\n`); return r.codigo; };
  const destino = process.cwd();
  if (cmd === 'adotar') {
    const i = argv.indexOf('--perfil');
    if (i !== -1 && !argv[i + 1]) { process.stderr.write('kit adotar: --perfil pede um valor\n'); return 2; }
    return imprimir(adotar({ destino, perfil: i === -1 ? undefined : argv[i + 1], versao: versao(), simular: flag('--simular'), trocarTest: flag('--trocar-test'), parcial: flag('--parcial') }));
  }
  if (cmd === 'atualizar') return imprimir(atualizar({ destino, versao: versao(), simular: flag('--simular'), trocarTest: flag('--trocar-test') }));
  if (cmd === 'remover') return imprimir(remover({ destino, simular: flag('--simular') }));
  if (cmd === 'doutor') return imprimir(doutor({ destino, versao: versao() }));
  process.stderr.write(`kit: comando desconhecido: ${cmd}\n\n${AJUDA}`);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
