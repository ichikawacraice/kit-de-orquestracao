// F438 (ADR 0030): quando a chave `anfitriao` do .claude/kit.json contradiz os sinais da sessão, o início avisa numa linha;
// sem contradição, a linha não existe. Valor desconhecido vai ao log. Nada aqui toca ~/.claude: HOME, PAINEL_DIR e a pasta do
// log apontam para diretório temporário, e os sinais do anfitrião de quem roda o teste são apagados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEM_SINAIS = { CLAUDE_CODE_HOST_SESSION_ID: '', ORCA_AGENT_SESSION_ID: '', ORCA_STRUCTURED_SESSION: '', KIT_ANFITRIAO: '' };

function inicio(kit, sinais = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'anfitriao-inicio-'));
  try {
    const proj = join(dir, 'proj'); mkdirSync(join(proj, '.git'), { recursive: true }); mkdirSync(join(proj, '.claude'));
    writeFileSync(join(proj, '.claude', 'kit.json'), JSON.stringify(kit));
    const out = execFileSync(process.execPath, [join(HOOKS, 'sessao-inicio.mjs')], {
      input: JSON.stringify({ session_id: 's1', hook_event_name: 'SessionStart', source: 'startup', cwd: proj }), encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
      env: { ...process.env, HOME: dir, PAINEL_DIR: dir, HOOKS_CREWAI_BASE: dir, ...SEM_SINAIS, ...sinais },
    });
    const log = existsSync(join(dir, 'hooks-crewai.log')) ? readFileSync(join(dir, 'hooks-crewai.log'), 'utf8') : '';
    return { contexto: out ? JSON.parse(out).hookSpecificOutput.additionalContext : '', log };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('a chave que contradiz os sinais vira uma linha no início; sem contradição, nada', () => {
  const sem = inicio({ anfitriao: 'claude-desktop' }, { CLAUDE_CODE_HOST_SESSION_ID: 'local_1' });
  assert.ok(sem.contexto.length > 0, 'o início deveria ter conteúdo');
  assert.doesNotMatch(sem.contexto, /fixa o anfitrião/);
  const com = inicio({ anfitriao: 'claude-desktop' }, { ORCA_AGENT_SESSION_ID: 'abc-1' });
  assert.match(com.contexto, /fixa o anfitrião em "claude-desktop".*"orca"/);
  assert.doesNotMatch(inicio({ anfitriao: 'auto' }, { ORCA_AGENT_SESSION_ID: 'abc-1' }).contexto, /fixa o anfitrião/);
});

test('valor desconhecido da chave vai ao log', () => {
  const r = inicio({ anfitriao: 'vscode' });
  assert.match(r.log, /\tsessao-inicio\tanfitriao-desconhecido\tvscode/);
  assert.equal(inicio({ anfitriao: 'auto' }).log, '');
});
