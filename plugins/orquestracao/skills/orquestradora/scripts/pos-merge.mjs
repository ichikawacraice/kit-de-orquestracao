// F373 (fatia 3, ADR 0023): o pós-merge sem turno da orquestradora. A rodada da fila sem turno que mergeou chama `posMerge` e
// grava o resultado no desfecho; a orquestradora só acorda se algo der erro.
// - versão: com `.claude-plugin/marketplace.json` em origin/<base>, `subir-versao --empurrar --destacado` num worktree temporário
//   destacado em origin/<base> (o checkout principal pode estar em outra branch, e a base não cabe em dois worktrees). O pós-merge
//   roda fora da trava da fila: outra rodada pode mergear no meio e o push ser recusado; refaz do fetch, até TENTATIVAS vezes;
// - plugins: só no marketplace do kit e só quando a versão subiu, `atualizar-plugins --json`, sob a trava do botão do pane
//   (`<pastaOrq>/batida/atualizando-kit.json`: duas atualizações juntas não); a versão que falhou deixa os plugins por fazer, com erro;
// - estado: o arquivo `<pastaOrq>/<nome>.md` da orquestradora, se existe, gira (`estado-girar.mjs`).
// → { versao?, plugins?, estado?, erros?: ['<etapa>: <motivo>'] }; nunca lança.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const TENTATIVAS = 3;
const TRAVA_DO_KIT_MS = 10 * 60_000; // a mesma do mod painel-sessoes: depois disso, quem a gravou caiu no meio
const esperarMs = (n) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n); } catch { /* sem espera */ } };
// o motivo do git que conta: a linha do `! [rejected]` ou do `fatal:`, não o `To <url>` que vem antes
const motivoDoGit = (t) => { const ls = String(t ?? '').split('\n').map((l) => l.trim()).filter(Boolean); return ls.find((l) => /rejected|fatal:|error:/i.test(l)) ?? ls[0] ?? ''; };
const KIT = new Set(['ichikawa-kit', 'kit-de-orquestracao']);
const primeiraLinha = (x) => String(x ?? '').trim().split('\n')[0];

export function posMerge({ cwd, base = 'main', nomes = [], pastaOrq, env = process.env }) {
  const GIT = env.GIT_BIN || 'git';
  const git = (args, onde = cwd) => execFileSync(GIT, args, { cwd: onde, env, encoding: 'utf8', timeout: 120_000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const script = (nome, args, onde, timeout) => {
    const r = spawnSync(process.execPath, [join(AQUI, nome), ...args], { cwd: onde, env, encoding: 'utf8', timeout, killSignal: 'SIGKILL' });
    let json = null;
    const saida = String(r.stdout ?? '').trim();
    try { json = JSON.parse(saida); } catch { try { json = JSON.parse(saida.split('\n').pop()); } catch { /* sem JSON */ } }
    const motivo = json?.motivo ?? (json?.plugins ?? []).filter((p) => p?.mensagem).map((p) => `${p.id}: ${p.mensagem}`).join('; ');
    return { ok: r.status === 0, json, motivo: motivo || motivoDoGit(r.stderr) || primeiraLinha(r.error?.message) || `saiu ${r.status}` };
  };
  const out = {}; const erros = [];
  const erro = (etapa, e) => erros.push(`${etapa}: ${typeof e === 'string' ? e : motivoDoGit(e?.stderr) || primeiraLinha(e?.message || e)}`);

  let marketplace = null;
  try {
    git(['fetch', '-q', 'origin', `+refs/heads/${base}:refs/remotes/origin/${base}`]);
    try { marketplace = JSON.parse(git(['show', `origin/${base}:.claude-plugin/marketplace.json`])); } catch { marketplace = null; }
  } catch (e) { erro('versao', e); }

  if (marketplace) {
    let motivo = '';
    for (let i = 1; i <= TENTATIVAS && !out.versao; i++) {
      const wt = mkdtempSync(join(tmpdir(), 'pos-merge-'));
      try {
        if (i > 1) git(['fetch', '-q', 'origin', `+refs/heads/${base}:refs/remotes/origin/${base}`]);
        git(['worktree', 'add', '-q', '--detach', wt, `origin/${base}`]);
        const r = script('subir-versao.mjs', ['--empurrar', '--destacado', '--base', base], wt, 180_000);
        if (r.ok && r.json) out.versao = r.json; else motivo = r.motivo;
      } catch (e) { motivo = motivoDoGit(e?.stderr) || primeiraLinha(e?.message || e); } finally {
        try { git(['worktree', 'remove', '--force', wt]); } catch { /* a pasta sai abaixo */ }
        rmSync(wt, { recursive: true, force: true });
        try { git(['worktree', 'prune']); } catch { /* nada a podar */ }
      }
    }
    if (!out.versao) erro('versao', `${motivo} (${TENTATIVAS} tentativas)`);
    if (KIT.has(marketplace.name)) {
      if (!out.versao) erro('plugins', 'não rodou porque a versão falhou: depois de subir a versão, rode atualizar-plugins');
      else if (out.versao.subiu?.length) {
        const trava = pastaOrq ? join(pastaOrq, 'batida', 'atualizando-kit.json') : null;
        const minha = { em: new Date().toISOString(), por: 'pos-merge', pid: process.pid };
        try {
          if (trava) {
            for (let espera = 0; espera < TRAVA_DO_KIT_MS; espera += 5000) {
              let t = null; try { t = JSON.parse(readFileSync(trava, 'utf8')); } catch { t = null; }
              const em = Date.parse(t?.em ?? '');
              if (!t || t.falhou || Number.isNaN(em) || Date.now() - em >= TRAVA_DO_KIT_MS) break;
              esperarMs(Number(env.KIT_POS_MERGE_ESPERA_MS) || 5000);
            }
            mkdirSync(dirname(trava), { recursive: true });
            writeFileSync(trava, JSON.stringify(minha));
          }
          const r = script('atualizar-plugins.mjs', ['--json'], cwd, 600_000);
          if (r.ok) out.plugins = r.json ?? { ok: true }; else erro('plugins', r.motivo);
        } catch (e) { erro('plugins', e); } finally {
          // a trava sai só se ainda é a minha (o pane pode ter gravado a dele por cima)
          try { if (trava && JSON.parse(readFileSync(trava, 'utf8'))?.em === minha.em) rmSync(trava, { force: true }); } catch { /* sem trava */ }
        }
      }
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
