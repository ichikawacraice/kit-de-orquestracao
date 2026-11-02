#!/usr/bin/env node
// SessionStart: injeta o resumo das regras globais (regras-globais.md, fonte única) como additionalContext e, quando o app
// informa a sessão (CLAUDE_CODE_HOST_SESSION_ID), as perguntas do painel que ela mesma abriu: depois de uma limpeza de
// contexto, é por aqui que ela as reconhece. Na orquestradora, antes de tudo, a ordem de voltar ao papel e o marcador
// recriado (orquestradora-de-volta.mjs, F208). Nunca trava o início da sessão: qualquer erro escreve só o que já tinha e sai 0.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// O aviso de injeção é opcional: se a varredura faltar ou falhar ao carregar, a sessão começa sem ele.
// O texto das perguntas vem do painel (escrito por outras sessões): é dado, e o aviso vai antes dele quando casa.
let avisoDeInjecao = () => '';
try { ({ avisoDeInjecao } = await import('./varredura-entre-sessoes.mjs')); } catch { /* sem aviso */ }

const comAviso = (t) => { const a = avisoDeInjecao(t); return a ? `${a}\n${t}` : t; };

let regras = '';
try {
  regras = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'regras-globais.md'), 'utf8').trim();
} catch { /* sem regras */ }

let entrada = {};
try { entrada = JSON.parse(readFileSync(0, 'utf8') || '{}') ?? {}; } catch { /* sem entrada */ }

let papel = '';
try {
  const { orquestradoraDeVolta } = await import('./orquestradora-de-volta.mjs');
  papel = orquestradoraDeVolta({ sessionId: entrada.session_id, localId: process.env.CLAUDE_CODE_HOST_SESSION_ID, cwd: entrada.cwd })?.texto ?? '';
} catch { /* sem o papel */ }

let perguntas = '';
try {
  const localId = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  if (localId) {
    const { perguntasDaSessao, textoDasPerguntas } = await import('./perguntas-da-sessao.mjs');
    perguntas = textoDasPerguntas(perguntasDaSessao(localId), localId);
  }
} catch { /* sem perguntas */ }

// F347: sem as regras que o CLAUDE.md do projeto já traz (blocos `kit:`); sem o módulo, só tira os comentários de marcação.
try {
  const { resumoParaOProjeto } = await import('./regras-do-inicio.mjs');
  regras = resumoParaOProjeto(regras, entrada.cwd);
} catch { regras = regras.replace(/\s*<!--[\s\S]*?-->/g, ''); }

try {
  const partes = [papel, regras && comAviso(regras), perguntas && comAviso(perguntas)].filter(Boolean);
  if (partes.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: partes.join('\n\n') } }));
} catch { /* sessão segue */ }
process.exitCode = 0;
