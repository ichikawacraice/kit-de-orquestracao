#!/usr/bin/env node
// PreToolUse (Q62, ideia 1 do estudo CrewAI): a orquestradora não executa frente, como TRAVA.
// Vale para a sessão com marcador ~/.claude/orquestracao/ativas/<session_id> — inclusive os
// subagentes dela, que chegam com o mesmo session_id (a reincidência de 11–13/10 foi por subagente).
// Edit/Write/NotebookEdit fora das pastas da orquestração → `ask` (vale em bypass, de propósito,
// ao contrário da guarda de operação: decisão do operador no Q62). Em subagente em
// background, que não pode abrir pergunta, o Claude Code converte o `ask` em recusa.
// Bash fica de fora, de propósito: nas orquestradoras de 20–22/10 houve 1.700+ comandos que
// gravam (360+ `sed -i` só no arquivo de estado da orquestradora), e parsear shell deu 50 alertas falsos em 3 sessões
// mesmo só registrando. A reincidência medida (11–13/10) foi Edit/Write de subagente — coberta.
// Erro do hook vai para o log e a ferramenta segue.
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BASE, registrar, lerEntrada } from './hooks-crewai-comum.mjs';
import { repoDoMarcador } from './pool-comum.mjs';

const HOOK = 'orquestradora-nao-edita';
const H = homedir();

// O que é da orquestração, não de frente: toda a ~/.claude (estado, log, memória, planos, skills,
// hooks, registro de uso, CLAUDE.md global — a validação de 23/10 achou legítimos fora da lista
// estreita), notas de release, rascunho (scratchpad/tmp) e notas entre sessões. Frente é código
// de produto no repositório; é isso que a trava guarda.
const LIVRES = [
  (p) => p.startsWith(BASE + '/'),
  (p) => p.startsWith(join(H, '.claude') + '/'),
  (p) => p.includes('/docs/releases/'),
  (p) => p.startsWith(join(H, 'Library', 'Application Support', 'Claude', 'side-session-notes') + '/'),
  (p) => /^\/(private\/)?tmp\//.test(p) || p.startsWith('/var/folders/') || p.startsWith('/private/var/folders/'),
  (p) => p.startsWith(resolve(tmpdir()) + '/'),
];

// Só nos repositórios listados em trava-edicao-repos.txt (o git dir, um por linha, como no
// marcador). O battlewand manda a orquestradora delegar código a subagentes (CLAUDE.md dele),
// e a trava lá daria centenas de perguntas falsas (validação de 23/10: 480 em 14 sessões).
// Sem o arquivo, vale em todo repositório com marcador. Marcador sem repo (formato antigo, vazio,
// ou `null` quando o gitCommonDir falhou) resolve o repo pelo cwd; sem conseguir, pergunta —
// a trava erra para o lado de perguntar, nunca para o de se desligar calada.
function repoDoCwd(cwd) {
  try {
    const out = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd, encoding: 'utf8', timeout: 2000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim();
  } catch { return ''; }
}
function repoCoberto(marcador, cwd) {
  const lista = join(BASE, 'trava-edicao-repos.txt');
  if (!existsSync(lista)) return true;
  let repo = repoDoMarcador(readFileSync(marcador, 'utf8'));
  if (!repo) repo = cwd ? repoDoCwd(cwd) : '';
  if (!repo) return true;
  return readFileSync(lista, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).includes(repo);
}

function caminhoDe(entrada) {
  const ti = entrada.tool_input || {};
  let p = ti.file_path || ti.notebook_path || '';
  if (!p) return '';
  if (p.startsWith('~/')) p = join(H, p.slice(2));
  return resolve(entrada.cwd || process.cwd(), p);
}

function main() {
  const e = lerEntrada();
  const marcador = e.session_id && join(BASE, 'ativas', e.session_id);
  if (!marcador || !existsSync(marcador) || !repoCoberto(marcador, e.cwd)) return;
  const quem = e.agent_id ? `subagente ${e.agent_type || e.agent_id}` : 'principal';

  const p = caminhoDe(e);
  if (!p || LIVRES.some((f) => f(p))) return;

  registrar(e.session_id, HOOK, 'perguntou', `${quem} ${e.tool_name} ${p}`);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        `Orquestradora editando ${p}. Frente nova vira sessão (card com título, motivo e prompt), ` +
        'não edição aqui nem por subagente. Aprove só se for trabalho da orquestração.',
    },
  }));
}

try {
  main();
} catch (err) {
  registrar('-', HOOK, 'erro', err?.stack || err);
}
process.exitCode = 0;
