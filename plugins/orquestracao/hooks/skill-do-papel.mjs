#!/usr/bin/env node
// PreToolUse (matcher Skill, F6/24-10): AVISA — nunca recusa — quando o papel da sessão carrega skill que o
// mapa ~/.claude/orquestracao/pool/skills-por-papel.json põe fora da sua coluna (`nao`/`desligada`).
// Cobre o que o `skillOverrides` por worktree não filtra: skill de plugin e o checkout principal.
// Papel: título do registro do app (`P|D|E|V<n> · …`) ou orquestradora (`O`). Sem papel: passa calado.
// Erro do hook vai para o log e a skill segue.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { registrar, lerEntrada, semPrefixoDoPlugin } from './hooks-crewai-comum.mjs';
import { registroDaSessao, membroDoPool, ehOrquestradora } from './pool-comum.mjs';

const HOOK = 'skill-do-papel';
const MAPA = process.env.SKILLS_MAPA || join(homedir(), '.claude', 'orquestracao', 'pool', 'skills-por-papel.json');

function main() {
  const e = lerEntrada();
  const sid = e.session_id || '-';
  const skill = semPrefixoDoPlugin(String(e.tool_input?.skill || '').replace(/^\//, ''));
  if (!skill) return;
  const reg = registroDaSessao(e.session_id);
  const papel = ehOrquestradora(e.session_id, reg?.titulo) ? 'O' : membroDoPool(reg?.titulo)?.papel;
  if (!papel) return;
  const mapa = JSON.parse(readFileSync(MAPA, 'utf8'));
  const entrada = mapa.skills[skill] ?? mapa.skills[mapa.apelidos?.[skill]];
  if (!entrada) return registrar(sid, HOOK, 'fora-do-mapa', `${papel} ${skill}`);
  const valor = entrada[papel];
  if (valor !== 'nao' && valor !== 'desligada') return;
  registrar(sid, HOOK, 'avisou', `${papel} ${skill} ${valor}`);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `A skill \`${skill}\` não é do papel ${papel} (mapa em ~/.claude/orquestracao/pool/skills-por-papel.md). Se o trabalho pede essa skill, ele é de outro papel: devolva ou despache o item em vez de aplicá-la.`,
    },
  }));
}

try { main(); } catch (err) { registrar('-', HOOK, 'erro', err?.stack || err); }
process.exitCode = 0;
