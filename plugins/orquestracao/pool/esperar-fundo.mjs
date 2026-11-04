#!/usr/bin/env node
// Espera dentro do turno (F373, protocolo `espera-no-turno`): segura a chamada até os subagentes desta sessão terminarem, ou
// até os arquivos dados existirem, com teto de tempo. A dona que espera assim não termina o turno, e o aviso de fim de turno
// não acorda a orquestradora só para ler "aguardo".
//   esperar-fundo [--max <segundos>]               os subagentes da sessão (CLAUDE_CODE_SESSION_ID)
//   esperar-fundo --arquivo <caminho> [...] [--max <s>]   o marcador que o comando em segundo plano grava ao acabar
// Subagente rodando = `agent-*.meta.json` sem `"finished": true` (o Claude Code grava ao terminar) e com o transcript escrito
// nos últimos 15 min (o morto não segura ninguém). Pasta: KIT_PROJECTS_DIR, ou ~/.claude/projects.
// Sai 0 quando nada mais roda, 3 quando o teto passou com algo rodando (chame de novo), 2 em erro. Teto padrão 540 s, abaixo
// dos 600 s do timeout máximo do Bash.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const RECENTE_MS = 15 * 60_000;
const PASSO_MS = Number(process.env.KIT_ESPERA_PASSO_MS) || 3000;
const pasta = () => process.env.KIT_PROJECTS_DIR || join(homedir(), '.claude', 'projects');

export function subagentesRodando(sessao, raiz = pasta(), agora = Date.now()) {
  const rodando = [];
  let projetos = [];
  try { projetos = readdirSync(raiz); } catch { return rodando; }
  for (const p of projetos) {
    const dir = join(raiz, p, sessao, 'subagents');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.meta.json')) continue;
      let meta; try { meta = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
      if (meta.finished === true) continue;
      const transcript = join(dir, f.replace(/\.meta\.json$/, '.jsonl'));
      let mtime = 0; try { mtime = statSync(transcript).mtimeMs; } catch { /* sem transcript ainda: conta como novo */ mtime = agora; }
      if (agora - mtime > RECENTE_MS) continue;
      rodando.push(meta.description || meta.agentType || f);
    }
  }
  return rodando;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function main(argv) {
  const arquivos = [];
  let max = 540;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--arquivo') {
      const a = argv[++i];
      if (!a || a.startsWith('--')) throw new Error('--arquivo precisa de um caminho');
      arquivos.push(a);
    }
    else if (argv[i] === '--max') max = Number(argv[++i]);
  }
  if (!Number.isFinite(max) || max <= 0) throw new Error('--max precisa de segundos > 0');
  const sessao = process.env.CLAUDE_CODE_SESSION_ID;
  if (!arquivos.length && !sessao) throw new Error('sem CLAUDE_CODE_SESSION_ID no ambiente: passe --arquivo <marcador>');
  const pendentes = () => (arquivos.length ? arquivos.filter((a) => !existsSync(a)) : subagentesRodando(sessao));
  const inicio = Date.now();
  const vistos = new Set(pendentes());
  for (;;) {
    const p = pendentes();
    p.forEach((x) => vistos.add(x));
    const s = Math.round((Date.now() - inicio) / 1000);
    if (!p.length) {
      process.stdout.write(vistos.size ? `terminou em ${s}s: ${[...vistos].join('; ')}\n` : 'nada rodando\n');
      return 0;
    }
    if (Date.now() - inicio >= max * 1000) {
      process.stdout.write(`ainda roda após ${s}s: ${p.join('; ')}\n(chame esperar-fundo de novo para seguir esperando)\n`);
      return 3;
    }
    await dormir(Math.min(PASSO_MS, Math.max(50, max * 1000 - (Date.now() - inicio))));
  }
}

const principal = (() => { try { return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } })();
if (principal) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`esperar-fundo: ${e?.message || e}\n`);
    process.exitCode = 2;
  }
}
