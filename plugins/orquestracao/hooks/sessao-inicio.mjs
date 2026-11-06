#!/usr/bin/env node
// SessionStart: injeta o resumo das regras globais (regras-globais.md, fonte única) como additionalContext e, quando o anfitrião
// informa a sessão (o `local_…` do app ou o `orca_session_id:<id>` do Orca, F439), as perguntas do painel que ela mesma abriu: depois de uma limpeza de
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

// F439 (ADR 0030): quem é esta sessão — o `local_…` no app, o `orca_session_id:<id>` no Orca (null no terminal). No Orca, o
// início grava `orca-sessoes/<id>.json` (o id do CLI, a pasta, a hora e o endereço do send) antes de tudo: é por ele que o
// registro da sessão, a batida e as travas a reconhecem.
// A gravação segue o endereço, não o anfitrião fixado: a sessão cujo endereço é do Orca grava, mesmo com a chave do projeto
// fixando outro anfitrião. Falha na gravação não apaga o endereço.
let quem = null;
try {
  const { quemSou } = await import('./anfitriao.mjs');
  quem = quemSou({ env: process.env, cwd: entrada.cwd || process.cwd() });
} catch { quem = process.env.CLAUDE_CODE_HOST_SESSION_ID || null; }
if (quem?.startsWith('orca_session_id:')) {
  try {
    const { gravarSessaoDoOrca } = await import('./orca-sessoes.mjs');
    gravarSessaoDoOrca({ env: process.env, cliId: entrada.session_id, cwd: entrada.cwd || process.cwd() });
  } catch { /* sem o arquivo, o painel não acha a sessão pelo id do CLI; o início segue */ }
}

let papel = '';
try {
  const { orquestradoraDeVolta } = await import('./orquestradora-de-volta.mjs');
  papel = orquestradoraDeVolta({ sessionId: entrada.session_id, localId: quem, cwd: entrada.cwd })?.texto ?? '';
} catch { /* sem o papel */ }

let perguntas = '';
try {
  const localId = quem;
  if (localId) {
    const { perguntasDaSessao, textoDasPerguntas } = await import('./perguntas-da-sessao.mjs');
    perguntas = textoDasPerguntas(perguntasDaSessao(localId), localId);
  }
} catch { /* sem perguntas */ }

// F347: sem as regras que o CLAUDE.md do projeto já traz (blocos `kit:`); sem o módulo, só tira os comentários de marcação.
try {
  const { resumoParaOProjeto } = await import('./regras-do-inicio.mjs');
  const { filtrarPorAnfitriao } = await import('./regras-do-inicio.mjs');
  let host = 'claude-desktop';
  try { host = (await import('./anfitriao.mjs')).anfitriao({ env: process.env, cwd: entrada.cwd || process.cwd() }).anfitriao; } catch { /* sem o módulo: variante do app */ }
  regras = resumoParaOProjeto(filtrarPorAnfitriao(regras, host), entrada.cwd);
} catch { regras = regras.replace(/\s*<!--[\s\S]*?-->/g, ''); }

// F438 (ADR 0030): a chave `anfitriao` do .claude/kit.json que contradiz os sinais vira uma linha, para o engano não passar
// calado; o valor desconhecido vai ao log. Sem contradição, nada.
let anfitriaoAviso = '';
try {
  const { anfitriao } = await import('./anfitriao.mjs');
  const a = anfitriao({ env: process.env, cwd: entrada.cwd || process.cwd() });
  if (a.contradicao) anfitriaoAviso = `**Anfitrião:** ${a.contradicao}`;
  if (a.desconhecido) {
    const { registrar } = await import('./hooks-crewai-comum.mjs');
    registrar(entrada.session_id, 'sessao-inicio', 'anfitriao-desconhecido', a.desconhecido);
  }
} catch { /* sem o aviso */ }

try {
  const partes = [papel, anfitriaoAviso, regras && comAviso(regras), perguntas && comAviso(perguntas)].filter(Boolean);
  if (partes.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: partes.join('\n\n') } }));
} catch { /* sessão segue */ }
process.exitCode = 0;
