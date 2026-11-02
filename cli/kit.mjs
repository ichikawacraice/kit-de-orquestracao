#!/usr/bin/env node
// CLI do kit: --version, ajuda, iniciar, adotar, atualizar, doutor, remover e migrar-marketplace.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adotar } from './adotar.mjs';
import { atualizar } from './atualizar.mjs';
import { doutor } from './doutor.mjs';
import { iniciar } from './iniciar.mjs';
import { migrarMarketplace } from './migrar-marketplace.mjs';
import { remover } from './remover.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const versao = () => JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version;

const AJUDA = `kit — Ichikawa's Kit: orquestração de sessões do Claude Code

uso:
  kit --version                              mostra a versão
  kit ajuda                                  mostra esta ajuda
  kit iniciar [--perfil simples|pnpm-workspace] [--design <pasta do front>]
                                             prepara um projeto sem CLAUDE.md (gate, guarda, plugins, lock)
  kit adotar [--simular] [--trocar-test] [--parcial] [--perfil …] [--design <pasta do front>]
                                             põe o kit num projeto em andamento, sem sobrescrever nada;
                                             com conflito não grava nada (--parcial grava o resto)
                                             --design <pasta>: modelos de front na pasta e o Impeccable (recomendado) no settings
  kit atualizar [--simular] [--trocar-test]  troca pela versão nova o que você não editou; o resto vira conflito
  kit doutor                                 confere plugin, hooks, kit.json, skills de fora, versões e o disco com o lock
  kit remover [--simular]                    tira o que o kit pôs (blocos, chaves e arquivos cujo hash bate)
  kit migrar-marketplace [--aplicar] [--projeto <pasta>]… [--desfazer <backup>]
                                             troca as instalações do marketplace kit-de-orquestracao pelo ichikawa-kit,
                                             na conta e nos projetos (seco sem --aplicar; com backup; falha desfaz sozinha)
`;

const FLAGS = { iniciar: ['--perfil', '--design'], adotar: ['--simular', '--trocar-test', '--parcial', '--perfil', '--design'], atualizar: ['--simular', '--trocar-test'], remover: ['--simular'], doutor: [], 'migrar-marketplace': ['--aplicar', '--projeto', '--desfazer'] };

/** Flag que o subcomando não conhece → mensagem com a lista das válidas (uma flag errada não pode virar adoção calada). */
function flagDesconhecida(cmd, argv) {
  const validas = FLAGS[cmd];
  if (!validas) return null;
  const rest = argv.slice(1);
  const ruins = rest.filter((a, i) => a.startsWith('-') && !validas.includes(a) && !(['--perfil', '--design', '--projeto', '--desfazer'].includes(rest[i - 1]) && validas.includes(rest[i - 1])));
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
    const d = argv.indexOf('--design');
    if (d !== -1 && (argv[d + 1] === undefined || argv[d + 1].startsWith('-'))) { process.stderr.write('kit iniciar: --design pede a pasta do front (ex.: --design apps/web)\n'); return 2; }
    const r = iniciar({ destino: process.cwd(), perfil, versao: versao(), design: d === -1 ? undefined : argv[d + 1] });
    (r.codigo === 0 ? process.stdout : process.stderr).write(`${r.mensagem}\n`);
    return r.codigo;
  }
  const flag = (n) => argv.includes(n);
  const imprimir = (r) => { if (r.saida) process.stdout.write(r.saida); if (r.erro) process.stderr.write(`${r.erro}\n`); return r.codigo; };
  const destino = process.cwd();
  if (cmd === 'adotar') {
    const i = argv.indexOf('--perfil');
    if (i !== -1 && !argv[i + 1]) { process.stderr.write('kit adotar: --perfil pede um valor\n'); return 2; }
    const d = argv.indexOf('--design');
    if (d !== -1 && (argv[d + 1] === undefined || argv[d + 1].startsWith('-'))) { process.stderr.write('kit adotar: --design pede a pasta do front (ex.: --design apps/web)\n'); return 2; }
    return imprimir(adotar({ destino, perfil: i === -1 ? undefined : argv[i + 1], versao: versao(), simular: flag('--simular'), trocarTest: flag('--trocar-test'), parcial: flag('--parcial'), design: d === -1 ? undefined : argv[d + 1] }));
  }
  if (cmd === 'atualizar') return imprimir(atualizar({ destino, versao: versao(), simular: flag('--simular'), trocarTest: flag('--trocar-test') }));
  if (cmd === 'remover') return imprimir(remover({ destino, simular: flag('--simular') }));
  if (cmd === 'doutor') return imprimir(doutor({ destino, versao: versao() }));
  if (cmd === 'migrar-marketplace') {
    const valores = (n) => argv.flatMap((a, i) => (a === n ? [argv[i + 1]] : []));
    const ruim = ['--projeto', '--desfazer'].find((n) => valores(n).some((v) => v === undefined || v.startsWith('-')));
    if (ruim) { process.stderr.write(`kit migrar-marketplace: ${ruim} pede uma pasta\n`); return 2; }
    return imprimir(migrarMarketplace({ aplicarMesmo: flag('--aplicar'), desfazerDe: valores('--desfazer')[0] ?? null, projetos: valores('--projeto') }));
  }
  process.stderr.write(`kit: comando desconhecido: ${cmd}\n\n${AJUDA}`);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
