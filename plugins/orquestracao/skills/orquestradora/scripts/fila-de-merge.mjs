// `painel fila-de-merge <PR…> [--gate "<cmd>"] [--preparar "<cmd>"] [--seco]` (ADR 0011, decisão 4): a parte que monta a
// combinação e roda o gate. Num worktree temporário destacado em `origin/<base>`, aplica cada PR na ordem dada por squash
// (`git merge --squash` + commit); o que conflita sai do lote. Roda o gate UMA vez na combinação. Verde: todos os aplicados
// passam. Vermelho: roda de novo uma vez (verde na repetição passa o lote e registra a suspeita de teste instável em
// `instavel.txt`); ainda vermelho, bisseção: divide ao meio sobre a parte verde, a metade verde entra sem retestar e a
// vermelha divide de novo, até sobrar o PR que quebra. O merge no GitHub e a escrita no painel ficam no painel.mjs (só ele
// tem a trava). GIT_BIN troca o git (teste).
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

// F314: o motivo do conflito diz à dona como resolver, antes da lista de arquivos: a devolução corta o `agora` do item em
// 300 caracteres, e o corte cai na lista (até 3 arquivos, o resto vira "e mais N"; a lista inteira segue em `arquivos`).
export function motivoDeConflito({ pr, sobre, arquivos, base }) {
  const lista = arquivos.length ? `${arquivos.slice(0, 3).join(', ')}${arquivos.length > 3 ? ` e mais ${arquivos.length - 3}` : ''}` : 'arquivos não listados';
  return `conflito com ${sobre}: traga a base pelo sync_with_base_branch do app (ou git rebase origin/${base}), resolva, rode os afetados e mande PR ${pr} pronto de novo; arquivos: ${lista}`;
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
      else devolvidos.push({ ...item, motivo: motivoDeConflito({ pr: item.pr, sobre: `${base} + o lote`, arquivos: a.arquivos, base }), arquivos: a.arquivos });
    }
    if (aplicados.length === 0) return { base, aprovados: [], devolvidos, gates, pasta };
    const todos = gateAqui('lote');
    if (todos.ok) return { base, aprovados: aplicados, devolvidos, gates, pasta };
    if (todos.preparo) throw new Error(`o preparo falhou (exit ${todos.status}); veja ${todos.log}`);
    // vermelho: uma repetição na mesma árvore antes de culpar alguém (o gate pode ter deixado arquivo solto)
    limpar(wt, 'HEAD');
    const repeticao = gateAqui('lote-repeticao');
    if (repeticao.preparo) throw new Error(`o preparo falhou (exit ${repeticao.status}); veja ${repeticao.log}`);
    if (repeticao.ok) {
      const suspeitaDeInstavel = `o gate do lote falhou (exit ${todos.status}) e passou ao repetir: suspeita de teste instável; logs ${todos.log} e ${repeticao.log}`;
      writeFileSync(join(pasta, 'instavel.txt'), `${suspeitaDeInstavel}\nPRs: ${aplicados.map((x) => `#${x.pr}`).join(', ')}\n`);
      return { base, aprovados: aplicados, devolvidos, gates, pasta, suspeitaDeInstavel };
    }
    // bisseção sobre a parte verde (`refVerde`): o que entra verde não se retesta
    const aprovados = [];
    let refVerde = `origin/${base}`;
    const sobre = () => `${base}${aprovados.length ? ` + ${aprovados.map((x) => `#${x.pr}`).join(', ')}` : ''}`;
    // monta `grupo` sobre a parte verde e roda o gate; o que conflita aqui sai do lote
    const testar = (grupo) => {
      limpar(wt, refVerde);
      const montado = [];
      for (const item of grupo) {
        const a = aplicar(wt, item.pr, item.sha);
        if (a.ok) montado.push(item);
        else devolvidos.push({ ...item, motivo: motivoDeConflito({ pr: item.pr, sobre: sobre(), arquivos: a.arquivos, base }), arquivos: a.arquivos });
      }
      if (!montado.length) return { ok: true, grupo: montado };
      const g = gateAqui(`pr-${montado.map((x) => x.pr).join('-')}`);
      if (g.preparo) throw new Error(`o preparo falhou (exit ${g.status}); veja ${g.log}`);
      return { ...g, grupo: montado };
    };
    const aceitar = (grupo) => { aprovados.push(...grupo); refVerde = gitOk(['rev-parse', 'HEAD'], wt).trim(); };
    // `grupo` é sabido vermelho sobre `refVerde` (`g` é o gate que o mostrou)
    const resolver = (grupo, g) => {
      if (grupo.length === 1) {
        devolvidos.push({ ...grupo[0], motivo: `gate vermelho (exit ${g.status}) com o PR sobre ${sobre()}`, log: g.log });
        return;
      }
      const meio = Math.ceil(grupo.length / 2);
      const esquerda = grupo.slice(0, meio);
      const direita = grupo.slice(meio);
      const e = testar(esquerda);
      if (e.ok) {
        aceitar(e.grupo);
        // a parte verde + a esquerda + a direita é a árvore vermelha de antes: a direita é vermelha sem novo gate,
        // a menos que algum PR da esquerda tenha saído por conflito (aí a árvore já não é a mesma)
        if (e.grupo.length === esquerda.length) { resolver(direita, g); return; }
      } else resolver(e.grupo, e);
      const d = testar(direita);
      if (d.ok) aceitar(d.grupo);
      else resolver(d.grupo, d);
    };
    resolver(aplicados, repeticao);
    return { base, aprovados, devolvidos, gates, pasta };
  } finally {
    git(['worktree', 'remove', '--force', wt], cwd);
    writeFileSync(join(pasta, 'LEIA.txt'), 'Logs da fila de merge; o worktree já foi removido.\n');
  }
}

export const limparPasta = (pasta) => { try { rmSync(pasta, { recursive: true, force: true }); } catch { /* fica no tmp */ } };
