// `painel pode-reiniciar` (F152): dá para reiniciar o app agora sem derrubar trabalho? Reiniciar derruba todas as sessões da máquina,
// de todos os projetos: conta sessão com turno rodando, teste rodando (fichas do teto + processos soltos) e merge/rebase no meio.
// Este módulo é só o julgamento e a leitura (fichas, `ps`); a gravação e os argumentos ficam no painel.mjs. O plugin não importa
// `gate/` (que não vai junto quando ele é instalado): a leitura das fichas repete o contrato de `gate/o-teto-da-maquina.mjs` e um
// teste compara as duas.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const vivo = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; }
};

/** As fichas do teto com dono vivo: [{ k, pid, worktree, projeto }]. Pasta que não existe = nenhuma. */
export function lerFichas(pasta) {
  let nomes = [];
  try { nomes = readdirSync(pasta); } catch (e) { if (e?.code !== 'ENOENT') throw e; }
  const fichas = [];
  for (const nome of nomes) {
    if (!/^[1-9]\d*$/.test(nome)) continue;
    let dono = null;
    try { dono = JSON.parse(readFileSync(`${pasta}/${nome}`, 'utf8')); } catch { continue; }
    if (!Number.isInteger(dono?.pid) || !vivo(dono.pid)) continue;
    fichas.push({ k: Number(nome), pid: dono.pid, worktree: dono.worktree ?? dono.cwd ?? null, projeto: dono.projeto ?? null });
  }
  return fichas.sort((a, b) => a.k - b.k);
}

/** `ps -axo pid=,ppid=,command=` → [{ pid, ppid, command }]. `PODE_REINICIAR_PS` aponta um arquivo com a saída (teste). */
export function lerPs(env = process.env) {
  const bruto = env.PODE_REINICIAR_PS
    ? readFileSync(env.PODE_REINICIAR_PS, 'utf8')
    : execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL', maxBuffer: 32 * 1024 * 1024 });
  const linhas = [];
  for (const l of bruto.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(l);
    if (m) linhas.push({ pid: Number(m[1]), ppid: Number(m[2]), command: m[3] });
  }
  return linhas;
}

const EXECUTORES_DE_TESTE = new Set(['node', 'npx', 'pnpm', 'yarn', 'bun', 'vitest', 'jest', 'sh', 'bash', 'zsh']);
// grep/rg que PROCURA a palavra (puro ou dentro de um `zsh -c`) não roda teste: o trecho do grep sai antes de olhar
const semBusca = (command) => command.replace(/(^|[;&|(]\s*|\s)(?:e?grep|rg|ag|ack)\s[^;&|]*/g, '$1');
const ehTeste = (command) => {
  const t = command.split(/\s+/);
  return EXECUTORES_DE_TESTE.has(basename(t[0])) && /vitest|jest|node(\s+\S+)*\s+--test/.test(semBusca(command));
};
// git: pula as opções que levam valor (-C dir, -c k=v) e olha o primeiro argumento solto
const ehMerge = (command) => {
  const t = command.split(/\s+/);
  const exe = basename(t[0]);
  if (exe === 'gh') return t[1] === 'pr' && t[2] === 'merge';
  if (exe !== 'git') return false;
  let i = 1;
  while (i < t.length && t[i].startsWith('-')) i += ['-C', '-c'].includes(t[i]) ? 2 : 1;
  return ['rebase', 'merge', 'cherry-pick'].includes(t[i]);
};
const curto = (command, max = 60) => {
  const t = command.split(/\s+/);
  t[0] = basename(t[0]);
  const s = t.join(' ');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/**
 * O julgamento, puro. `sessoes`: linhas do list_sessions; `fichas`: de `lerFichas`; `ps`: de `lerPs`; `euPid`: pids do próprio comando
 * (ele e os pais) que não contam. → [{ tipo: 'sessao'|'teste'|'merge', texto, localId? }] na ordem sessão, teste, merge (quem mostra
 * reordena). Devolve TODOS os motivos, a sessão que perguntou incluída: o arquivo guarda tudo, a saída do comando tira a própria.
 */
export function julgarReinicio({ sessoes, fichas, ps, euPid = new Set() }) {
  const motivos = [];
  for (const r of sessoes) {
    if (r?.isRunning === true && r?.isArchived !== true) motivos.push({ tipo: 'sessao', texto: `${r.title ?? r.sessionId} trabalhando`, localId: r.sessionId });
  }
  const porPid = new Map();
  for (const f of fichas) porPid.set(f.pid, [...(porPid.get(f.pid) ?? []), f]);
  for (const [, lista] of porPid) {
    const { projeto, worktree } = lista[0];
    const onde = worktree ? ` em ${basename(worktree)}` : '';
    motivos.push({ tipo: 'teste', texto: `teste de ${projeto ?? '?'}${onde} (${lista.length} ${lista.length === 1 ? 'ficha' : 'fichas'})` });
  }
  const dePid = new Map(ps.map((p) => [p.pid, p]));
  const dentroDeFicha = (p) => {
    for (let n = 0, atual = p; atual && n < 50; n += 1, atual = dePid.get(atual.ppid)) if (porPid.has(atual.pid)) return true;
    return false;
  };
  // os pais do dono da ficha (o `zsh -c` que o lançou, o `npm test`) são o mesmo teste, não outro
  const paisDeFicha = new Set();
  for (const pid of porPid.keys()) {
    for (let n = 0, atual = dePid.get(dePid.get(pid)?.ppid); atual && n < 50; n += 1, atual = dePid.get(atual.ppid)) paisDeFicha.add(atual.pid);
  }
  const candidatos = ps.filter((p) => !euPid.has(p.pid) && ehTeste(p.command) && !dentroDeFicha(p) && !paisDeFicha.has(p.pid));
  // só a folha: o pai de outro candidato (o `zsh -c` de cima do gate na fila) é o mesmo teste
  const paisDeCandidato = new Set();
  for (const c of candidatos) {
    for (let n = 0, atual = dePid.get(c.ppid); atual && n < 50; n += 1, atual = dePid.get(atual.ppid)) paisDeCandidato.add(atual.pid);
  }
  for (const p of ps) {
    if (euPid.has(p.pid)) continue;
    if (candidatos.includes(p)) {
      if (paisDeCandidato.has(p.pid)) continue;
      const fila = /com-fichas\.mjs/.test(p.command);
      motivos.push({ tipo: 'teste', texto: `teste ${fila ? 'na fila do teto' : 'fora do teto'}: ${curto(p.command)}` });
    } else if (ehMerge(p.command)) motivos.push({ tipo: 'merge', texto: `merge/rebase no meio: ${curto(p.command)}` });
  }
  return motivos;
}

const RELEASE = /^(\d+)\.(\d+)\.(\d+)$/;
const compararVersao = (a, b) => { const x = RELEASE.exec(a).slice(1).map(Number); const y = RELEASE.exec(b).slice(1).map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };

// F209: os plugins do kit (o marketplace `ichikawa-kit`, ou `kit-de-orquestracao` na conta que não migrou — F344; escopo user). O app carrega os plugins quando abre: plugin com
// `lastUpdated` depois do início do processo do app ainda não vale. "Para baixar" é a versão do `main` publicado mais nova que a
// instalada, lida por `git fetch` no clone do marketplace (o FETCH_HEAD, ou o `origin/main` do clone se o fetch falhar; a árvore do clone não anda), com cache de 30 min.
const MARKETPLACES = ['ichikawa-kit', 'kit-de-orquestracao']; // o nome novo primeiro: com os dois instalados, vale o novo
export const KIT_PUBLICADO_VALE_MS = 30 * 60_000;
const GIT_TIMEOUT_MS = 20_000;

/** Os plugins do kit com escopo user: [{ nome, versao, lastUpdated }]. Sem o arquivo, nenhum. */
/** Plugin do kit que mudou de nome: velho → novo (o mesmo mapa do `atualizar-plugins`). */
const RENOMEADOS = { design: 'kit-design' };

export function lerInstaladosDoKit(home) {
  let reg = null;
  try { reg = JSON.parse(readFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), 'utf8')); } catch { return []; }
  const ids = Object.keys(reg?.plugins ?? {});
  const marketplace = MARKETPLACES.find((m) => ids.some((id) => id.endsWith(`@${m}`))) ?? MARKETPLACES[0];
  return Object.entries(reg?.plugins ?? {}).flatMap(([id, lista]) => {
    if (!id.endsWith(`@${marketplace}`) || !Array.isArray(lista)) return [];
    const user = lista.find((e) => e?.scope === 'user' && typeof e.version === 'string');
    return user ? [{ nome: id.slice(0, -marketplace.length - 1), versao: user.version, lastUpdated: user.lastUpdated ?? null, marketplace }] : [];
  });
}

/** O início do processo do app (ms) pelo `ps -axo lstart=,command=` (`LC_ALL=C`); `PODE_REINICIAR_PS_INICIO` aponta um arquivo (teste). `null` = não medi. */
export function lerInicioDoApp(env = process.env) {
  let bruto;
  try {
    bruto = env.PODE_REINICIAR_PS_INICIO
      ? readFileSync(env.PODE_REINICIAR_PS_INICIO, 'utf8')
      : env.PODE_REINICIAR_PS ? '' : execFileSync('ps', ['-axo', 'lstart=,command='], { encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL', maxBuffer: 32 * 1024 * 1024, env: { ...env, LC_ALL: 'C' } });
  } catch { return null; }
  for (const l of bruto.split('\n')) {
    const m = /^\s*(\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s+(.+?)\s*$/.exec(l);
    if (m?.[2]?.endsWith('Claude.app/Contents/MacOS/Claude')) { const t = Date.parse(m[1]); return Number.isNaN(t) ? null : t; }
  }
  return null;
}

/** Plugins do kit instalados depois que o app abriu: [{ nome, versao }]. Sem medir o início do app, nenhum. */
export function pluginsEsperandoReinicio({ home, inicioDoApp }) {
  if (inicioDoApp === null) return [];
  return lerInstaladosDoKit(home).flatMap((p) => {
    const t = Date.parse(p.lastUpdated ?? '');
    return !Number.isNaN(t) && t > inicioDoApp ? [{ nome: p.nome, versao: p.versao }] : [];
  });
}

const gitNoClone = (env, clone, args) => execFileSync(env.GIT_BIN || 'git', ['-C', clone, ...args], { encoding: 'utf8', timeout: GIT_TIMEOUT_MS, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'] });

/** As versões publicadas no `main` do marketplace ({ nome: versao }), ou `null` sem clone ou sem rede. Grava o cache. */
function conferirPublicado({ clone, cache, agoraMs, env }) {
  let publicado = null;
  // dois fetch no mesmo clone ao mesmo tempo: o que perde a trava do ref falha, mas o `origin/main` que o outro gravou vale igual
  let ref = 'FETCH_HEAD';
  try { gitNoClone(env, clone, ['fetch', '--quiet', 'origin', 'main']); } catch { ref = 'origin/main'; }
  try {
    const entradas = JSON.parse(gitNoClone(env, clone, ['show', `${ref}:.claude-plugin/marketplace.json`])).plugins;
    publicado = {};
    for (const { name: nome, source } of entradas) {
      // a pasta da entrada (F357: o design-system mora em design-system/plugins/); a de origem remota não tem manifesto no clone
      const pasta = typeof source === 'string' ? source.replace(/^\.\//, '').replace(/\/$/, '') : `plugins/${nome}`;
      try { publicado[nome] = JSON.parse(gitNoClone(env, clone, ['show', `${ref}:${pasta}/.claude-plugin/plugin.json`])).version; } catch { /* sem manifesto */ }
    }
  } catch { publicado = null; }
  // sem rede o cache guarda a tentativa: a próxima ida à rede espera a janela, e não a cada leitura do pane
  try { mkdirSync(dirname(cache), { recursive: true }); writeFileSync(cache, `${JSON.stringify({ em: new Date(agoraMs).toISOString(), publicado })}\n`); } catch { /* sem cache */ }
  return publicado;
}

/** Os plugins do kit com versão publicada mais nova que a instalada: [{ nome, instalada, publicada }]. */
export function lerParaBaixar({ home, cache, agoraMs = Date.now(), env = process.env }) {
  const instalados = lerInstaladosDoKit(home);
  if (!instalados.length) return [];
  const clone = env.KIT_MARKETPLACE_DIR || join(home, '.claude', 'plugins', 'marketplaces', instalados[0].marketplace);
  let publicado;
  try {
    const c = JSON.parse(readFileSync(cache, 'utf8'));
    const em = Date.parse(c?.em ?? '');
    if (!Number.isNaN(em) && agoraMs - em < KIT_PUBLICADO_VALE_MS && agoraMs >= em) publicado = c.publicado ?? null;
  } catch { /* sem cache */ }
  if (publicado === undefined) {
    try { readdirSync(clone); } catch { return []; }
    publicado = conferirPublicado({ clone, cache, agoraMs, env });
  }
  if (!publicado) return [];
  return instalados.flatMap((p) => {
    // plugin renomeado (F332): o velho instalado e só o novo publicado pede o atualizar-plugins, que troca um pelo outro
    const novo = RENOMEADOS[p.nome];
    if (novo && publicado[novo] && !publicado[p.nome]) return RELEASE.test(publicado[novo]) ? [{ nome: novo, instalada: p.versao, publicada: publicado[novo] }] : [];
    const v = publicado[p.nome];
    return RELEASE.test(v ?? '') && RELEASE.test(p.versao) && compararVersao(p.versao, v) < 0 ? [{ nome: p.nome, instalada: p.versao, publicada: v }] : [];
  });
}

/** O texto da resposta. `idadeMin` só quando a lista é a da batida. As linhas do kit vêm por último e não são motivo. */
export function textoDoReinicio({ pode, motivos, sessoesDe, idadeMin, paraAplicar, paraBaixar }) {
  const idade = sessoesDe === 'batida' && idadeMin !== undefined ? `(lista de há ${idadeMin} min)\n` : '';
  const aplicar = paraAplicar?.length ? `Plugins do kit instalados (${paraAplicar.map((p) => `${p.nome} ${p.versao}`).join(', ')}): reinicie o app para aplicar.\n` : '';
  const baixar = paraBaixar?.length ? `Atualização do kit para baixar (${paraBaixar.map((p) => `${p.nome} ${p.publicada}`).join(', ')}): rode atualizar-plugins.\n` : '';
  const kit = `${aplicar}${baixar}`;
  return pode ? `Pode reiniciar.\n${kit}${idade}` : `Não reinicie agora:\n${motivos.map((m) => m.texto).join('\n')}\n${kit}${idade}`;
}
