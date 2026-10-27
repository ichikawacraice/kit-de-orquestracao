// `painel fila-de-merge <PR…> [--gate "<cmd>"] [--preparar "<cmd>"] [--seco]` (ADR 0011, decisão 4): a parte que monta a
// combinação e roda o gate. Num worktree temporário destacado em `origin/<base>`, aplica cada PR na ordem dada por squash
// (`git merge --squash` + commit); o que conflita sai do lote. Roda o gate UMA vez na combinação. Verde: todos os aplicados
// passam. Vermelho: refaz do zero, um PR por vez, com o gate depois de cada um; o que deixa vermelho sai do lote e o verde
// acumula. O merge no GitHub e a escrita no painel ficam no painel.mjs (só ele tem a trava). GIT_BIN troca o git (teste).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIMITE_GIT_MS = 120_000;
const LIMITE_GATE_MS = Number(process.env.KIT_FILA_GATE_TIMEOUT_MS) || 60 * 60_000;
export const GATE_PADRAO = 'npm test';

function git(args, cwd) {
  try {
    return { status: 0, out: execFileSync(process.env.GIT_BIN || 'git', args, { cwd, encoding: 'utf8', timeout: LIMITE_GIT_MS, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    if (e?.code === 'ENOENT') throw new Error('git não encontrado no PATH');
    return { status: e?.status ?? 1, out: String(e?.stdout ?? ''), err: String(e?.stderr ?? '').trim() };
  }
}
function gitOk(args, cwd) {
  const r = git(args, cwd);
  if (r.status !== 0) throw new Error(`git ${args.slice(0, 2).join(' ')} falhou: ${r.err || r.out || `exit ${r.status}`}`);
  return r.out;
}

// Roda um comando de shell no worktree, com a saída num arquivo. → { ok, status, log }
export function rodarComando(cmd, cwd, log) {
  const fd = openSync(log, 'w');
  try {
    const r = spawnSync('sh', ['-c', cmd], { cwd, stdio: ['ignore', fd, fd], timeout: LIMITE_GATE_MS, killSignal: 'SIGKILL', env: process.env });
    return { ok: r.status === 0, status: r.status ?? (r.signal ? `sinal ${r.signal}` : 1), log };
  } finally { closeSync(fd); }
}

// Volta a árvore ao `ref` e apaga o que o gate deixou fora do índice (sem `-x`: o ignorado, como node_modules, fica);
// arquivo solto do gate faria o squash seguinte abortar com "untracked … would be overwritten", sem conflito real.
function limpar(wt, ref) {
  gitOk(['reset', '-q', '--hard', ref], wt);
  gitOk(['clean', '-q', '-fd'], wt);
}

// Aplica um PR (sha) por squash no HEAD do worktree. → { ok:true } | { ok:false, arquivos }
function aplicar(wt, pr, sha) {
  const m = git(['merge', '--squash', '--no-commit', sha], wt);
  if (m.status !== 0) {
    const st = git(['diff', '--name-only', '--diff-filter=U'], wt);
    const arquivos = st.out.split('\n').filter(Boolean);
    limpar(wt, 'HEAD');
    return { ok: false, arquivos };
  }
  // squash sem mudança (PR já contido na base) não gera commit; o `--allow-empty` mantém um commit por PR
  gitOk(['-c', 'user.name=fila-de-merge', '-c', 'user.email=fila@kit', 'commit', '-q', '--allow-empty', '-m', `fila: PR ${pr}`], wt);
  return { ok: true };
}

// prs: [{ pr, sha }] na ordem. → { base, aprovados: [{pr, sha}], devolvidos: [{pr, sha, motivo, arquivos?, log?}], gates, pasta }
export function montarLote({ prs, base, cwd, gate = GATE_PADRAO, preparar = null }) {
  if (!Array.isArray(prs) || prs.length === 0) throw new Error('fila-de-merge: nenhum PR');
  gitOk(['fetch', '-q', 'origin', `+refs/heads/${base}:refs/remotes/origin/${base}`], cwd);
  for (const { pr } of prs) gitOk(['fetch', '-q', 'origin', `refs/pull/${pr}/head`], cwd);
  const pasta = mkdtempSync(join(tmpdir(), 'fila-de-merge-'));
  const wt = join(pasta, 'arvore');
  gitOk(['worktree', 'add', '-q', '--detach', wt, `origin/${base}`], cwd);
  const devolvidos = [];
  let gates = 0;
  const gateAqui = (nome) => {
    gates += 1;
    if (preparar) {
      const p = rodarComando(preparar, wt, join(pasta, `preparar-${nome}.log`));
      if (!p.ok) return { ...p, preparo: true };
    }
    return rodarComando(gate, wt, join(pasta, `gate-${nome}.log`));
  };
  try {
    const aplicados = [];
    for (const item of prs) {
      const a = aplicar(wt, item.pr, item.sha);
      if (a.ok) aplicados.push(item);
      else devolvidos.push({ ...item, motivo: `conflito com ${base} + o lote em ${a.arquivos.join(', ') || 'arquivos não listados'}`, arquivos: a.arquivos });
    }
    if (aplicados.length === 0) return { base, aprovados: [], devolvidos, gates, pasta };
    const todos = gateAqui('lote');
    if (todos.ok) return { base, aprovados: aplicados, devolvidos, gates, pasta };
    if (todos.preparo) throw new Error(`o preparo falhou (exit ${todos.status}); veja ${todos.log}`);
    // vermelho: um por vez sobre a parte verde, para achar quem quebra
    limpar(wt, `origin/${base}`);
    const aprovados = [];
    for (const item of aplicados) {
      const a = aplicar(wt, item.pr, item.sha);
      if (!a.ok) { devolvidos.push({ ...item, motivo: `conflito com ${base} + a parte verde em ${a.arquivos.join(', ')}`, arquivos: a.arquivos }); continue; }
      limpar(wt, 'HEAD'); // o gate do lote pode ter deixado arquivo solto
      const g = gateAqui(`pr-${item.pr}`);
      if (g.ok) { aprovados.push(item); continue; }
      devolvidos.push({ ...item, motivo: `gate vermelho (exit ${g.status}) com o PR sobre ${base}${aprovados.length ? ` + ${aprovados.map((x) => `#${x.pr}`).join(', ')}` : ''}`, log: g.log });
      limpar(wt, 'HEAD~1');
    }
    return { base, aprovados, devolvidos, gates, pasta };
  } finally {
    git(['worktree', 'remove', '--force', wt], cwd);
    writeFileSync(join(pasta, 'LEIA.txt'), 'Logs da fila de merge; o worktree já foi removido.\n');
  }
}

export const limparPasta = (pasta) => { try { rmSync(pasta, { recursive: true, force: true }); } catch { /* fica no tmp */ } };
