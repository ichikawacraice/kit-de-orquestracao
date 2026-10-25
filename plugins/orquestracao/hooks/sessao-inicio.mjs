#!/usr/bin/env node
// SessionStart: injeta o resumo das regras globais (regras-globais.md, fonte única) como additionalContext.
// Nunca trava o início da sessão: sem o .md, ou com qualquer erro, não escreve nada e sai 0.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const texto = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'regras-globais.md'), 'utf8').trim();
  if (texto) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texto } }));
} catch { /* sem regras: sessão segue */ }
process.exitCode = 0;
