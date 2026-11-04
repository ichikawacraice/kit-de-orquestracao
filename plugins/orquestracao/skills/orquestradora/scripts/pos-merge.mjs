// F373 (fatia 3, ADR 0023): o pós-merge sem turno da orquestradora. A rodada da fila sem turno que mergeou chama `posMerge` e
// grava o resultado no desfecho; a orquestradora só acorda se algo der erro.
// - versão: com `.claude-plugin/marketplace.json` em origin/<base>, `subir-versao --empurrar --destacado` num worktree temporário
//   destacado em origin/<base> (o checkout principal pode estar em outra branch, e a base não cabe em dois worktrees);
// - plugins: só no marketplace do kit e só quando a versão subiu, `atualizar-plugins --json`;
// - estado: o arquivo `<pastaOrq>/<nome>.md` da orquestradora, se existe, gira (`estado-girar.mjs`).
// → { versao?, plugins?, estado?, erros?: ['<etapa>: <motivo>'] }; nunca lança.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const KIT = new Set(['ichikawa-kit', 'kit-de-orquestracao']);
const primeiraLinha = (x) => String(x ?? '').trim().split('\n')[0];

export function posMerge({ cwd, base = 'main', nomes = [], pastaOrq, env = process.env }) {
  const GIT = env.GIT_BIN || 'git';
  const git = (args, onde = cwd) => execFileSync(GIT, args, { cwd: onde, env, encoding: 'utf8', timeout: 120_000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const script = (nome, args, onde, timeout) => {
    const r = spawnSync(process.execPath, [join(AQUI, nome), ...args], { cwd: onde, env, encoding: 'utf8', timeout, killSignal: 'SIGKILL' });
    let json = null;
    try { json = JSON.parse(String(r.stdout ?? '').trim().split('\n').pop()); } catch { /* sem JSON */ }
    return { ok: r.status === 0, json, motivo: json?.motivo ?? primeiraLinha(r.stderr || r.error?.message || `saiu ${r.status}`) };
  };
  const out = {}; const erros = [];
  const erro = (etapa, e) => erros.push(`${etapa}: ${primeiraLinha(e?.stderr || e?.message || e)}`);

  let marketplace = null;
  try {
    git(['fetch', '-q', 'origin', `+refs/heads/${base}:refs/remotes/origin/${base}`]);
    try { marketplace = JSON.parse(git(['show', `origin/${base}:.claude-plugin/marketplace.json`])); } catch { marketplace = null; }
  } catch (e) { erro('versao', e); }

  if (marketplace) {
    const wt = mkdtempSync(join(tmpdir(), 'pos-merge-'));
    try {
      git(['worktree', 'add', '-q', '--detach', wt, `origin/${base}`]);
      const r = script('subir-versao.mjs', ['--empurrar', '--destacado', '--base', base], wt, 180_000);
      if (r.ok && r.json) out.versao = r.json; else erro('versao', r.motivo);
    } catch (e) { erro('versao', e); } finally {
      try { git(['worktree', 'remove', '--force', wt]); } catch { /* a pasta sai abaixo */ }
      rmSync(wt, { recursive: true, force: true });
      try { git(['worktree', 'prune']); } catch { /* nada a podar */ }
    }
    if (out.versao?.subiu?.length && KIT.has(marketplace.name)) {
      const r = script('atualizar-plugins.mjs', ['--json'], cwd, 600_000);
      if (r.ok) out.plugins = r.json ?? { ok: true }; else erro('plugins', r.motivo);
    }
  }

  const arquivo = pastaOrq ? [...new Set(nomes)].filter(Boolean).map((n) => join(pastaOrq, `${n}.md`)).find((f) => existsSync(f)) : null;
  if (arquivo) {
    const r = script('estado-girar.mjs', [arquivo], cwd, 60_000);
    if (r.ok) out.estado = r.json ?? { ok: true }; else erro('estado', r.motivo);
  }
  if (erros.length) out.erros = erros;
  return out;
}
