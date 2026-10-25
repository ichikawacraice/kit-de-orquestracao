#!/usr/bin/env node
// SessionStart: injeta o resumo das regras globais (regras-globais.md, fonte única) como additionalContext.
// Nunca trava o início da sessão: sem o .md, ou com qualquer erro, não escreve nada e sai 0.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// O aviso de injeção é opcional: se a varredura faltar ou falhar ao carregar, a sessão começa sem ele.
// Hoje ele não protege nada (o texto injetado é o das regras do próprio kit); prepara o caso de o texto do painel entrar aqui.
let avisoDeInjecao = () => '';
try { ({ avisoDeInjecao } = await import('./varredura-entre-sessoes.mjs')); } catch { /* sem aviso */ }

try {
  const texto = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'regras-globais.md'), 'utf8').trim();
  const aviso = avisoDeInjecao(texto);
  if (texto) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: aviso ? `${aviso}\n${texto}` : texto } }));
} catch { /* sem regras: sessão segue */ }
process.exitCode = 0;
