// `painel mergear <PR> <sha> [--seco]` (F150): a parte que fala com o GitHub e o git. A escrita no painel fica no painel.mjs
// (só ele tem a trava). Executáveis: GH_BIN e GIT_BIN (env) trocam `gh` e `git`, para teste.
import { execFileSync } from 'node:child_process';

export const SHA_VALIDADO = /^[0-9a-f]{7,40}$/i;
const LIMITE_MS = Number(process.env.KIT_GH_TIMEOUT_MS) || 120_000;

function rodar(bin, args, cwd) {
  try {
    return { status: 0, out: execFileSync(bin, args, { cwd, encoding: 'utf8', timeout: LIMITE_MS, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    if (e?.code === 'ENOENT') throw new Error(`${bin} não encontrado no PATH`);
    if (e?.signal === 'SIGKILL' || e?.code === 'ETIMEDOUT') throw new Error(`${bin} ${args.slice(0, 2).join(' ')} não respondeu em ${LIMITE_MS / 1000} s`);
    return { status: e?.status ?? 1, out: String(e?.stdout ?? ''), err: String(e?.stderr ?? '').trim() };
  }
}
const gh = (args, cwd) => {
  const r = rodar(process.env.GH_BIN || 'gh', args, cwd);
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(' ')} falhou: ${r.err || `exit ${r.status}`}`);
  return r.out;
};
const git = (args, cwd) => rodar(process.env.GIT_BIN || 'git', args, cwd);

export function dadosDoPr(pr, cwd) {
  const v = JSON.parse(gh(['pr', 'view', String(pr), '--json', 'number,state,headRefOid,baseRefName,headRefName'], cwd));
  if (!v || typeof v.headRefOid !== 'string') throw new Error(`gh pr view ${pr}: resposta sem headRefOid`);
  return v;
}
export const estadoDoPr = (pr, cwd) => String(JSON.parse(gh(['pr', 'view', String(pr), '--json', 'state'], cwd))?.state ?? '');

// Confere o PR contra o sha validado. Devolve { ok:true, pr, sha, base } ou { recusado:true, motivo, … }.
export function conferir(pr, shaCurto, cwd) {
  const v = dadosDoPr(pr, cwd);
  if (v.state !== 'OPEN') return { recusado: true, pr, motivo: `o PR não está aberto (${v.state})` };
  const pedido = shaCurto.toLowerCase();
  if (!v.headRefOid.toLowerCase().startsWith(pedido)) {
    return { recusado: true, pr, motivo: `a ponta mudou: validado ${shaCurto}, agora ${v.headRefOid.slice(0, 7)}; peça nova validação` };
  }
  const sha = v.headRefOid.toLowerCase();
  const base = v.baseRefName;
  for (const args of [['fetch', '-q', 'origin', `+refs/heads/${base}:refs/remotes/origin/${base}`], ['fetch', '-q', 'origin', `refs/pull/${pr}/head`]]) {
    const f = git(args, cwd);
    if (f.status !== 0) throw new Error(`git ${args.slice(0, 2).join(' ')} falhou: ${f.err || `exit ${f.status}`}`);
  }
  const m = git(['merge-tree', '--write-tree', '--name-only', `origin/${base}`, sha], cwd);
  if (m.status === 1 && /CONFLICT/.test(m.out)) {
    const [, ...resto] = m.out.split('\n');
    const arquivos = [];
    for (const l of resto) { if (l === '') break; arquivos.push(l); }
    return { recusado: true, conflito: true, pr, arquivos, motivo: `conflito com ${base} em ${arquivos.join(', ') || 'arquivos não listados'}; devolva à dona` };
  }
  if (m.status !== 0) throw new Error(`git merge-tree saiu com ${m.status}: ${(m.out + (m.err ?? '')).trim()}`);
  const aviso = avisoDeVersao(base, sha, cwd);
  return { ok: true, pr, sha, base, ...(aviso ? { aviso } : {}) };
}

// F173: o PR de item não sobe a `version` dos plugins (a orquestradora sobe depois do lote). PR já aberto com bump passa, só avisa.
function avisoDeVersao(base, sha, cwd) {
  const d = git(['diff', '-U0', `origin/${base}...${sha}`, '--', 'plugins/*/.claude-plugin/plugin.json'], cwd);
  if (d.status !== 0) return null;
  const plugins = new Set();
  let atual = null;
  for (const l of d.out.split('\n')) {
    const arq = /^\+\+\+ b\/plugins\/([^/]+)\/\.claude-plugin\/plugin\.json$/.exec(l);
    if (arq) { atual = arq[1]; continue; }
    if (atual && /^[+-]\s*"version"/.test(l)) plugins.add(atual);
  }
  if (plugins.size === 0) return null;
  return `o PR sobe a versão de ${[...plugins].join(', ')}; a versão é da orquestradora depois do lote (rode subir-versao)`;
}

export function mergearNoGitHub(pr, sha, cwd) {
  gh(['pr', 'merge', String(pr), '--squash', '--match-head-commit', sha], cwd);
}
