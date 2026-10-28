// `painel pode-reiniciar` (F152): dá para reiniciar o app agora sem derrubar trabalho? Reiniciar derruba todas as sessões da máquina,
// de todos os projetos: conta sessão com turno rodando, teste rodando (fichas do teto + processos soltos) e merge/rebase no meio.
// Este módulo é só o julgamento e a leitura (fichas, `ps`); a gravação e os argumentos ficam no painel.mjs. O plugin não importa
// `gate/` (que não vai junto quando ele é instalado): a leitura das fichas repete o contrato de `gate/o-teto-da-maquina.mjs` e um
// teste compara as duas.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// Atualização que só entra com o app reiniciado: o app com a versão nova já baixada pelo ShipIt (instala ao fechar) e o motor
// (claude-code) com versão mais nova na pasta do app do que a que alguma sessão roda. Tudo lido do HOME; fora do macOS nada existe.
const versaoDoPlist = (app) => {
  try { return /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/.exec(readFileSync(join(app, 'Contents', 'Info.plist'), 'utf8'))?.[1] ?? null; } catch { return null; }
};
const deUrl = (u) => { try { return typeof u === 'string' && u.startsWith('file:') ? fileURLToPath(u) : null; } catch { return null; } };
const RELEASE = /^(\d+)\.(\d+)\.(\d+)$/;
const compararVersao = (a, b) => { const x = RELEASE.exec(a).slice(1).map(Number); const y = RELEASE.exec(b).slice(1).map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };

/** → `{ app?: { instalada, baixada }, motor?: { rodando, baixada } }`, ou `null` sem nada esperando. `rodando` é a mais velha em uso. */
export function lerAtualizacao({ home, ps }) {
  const r = {};
  try {
    const estado = JSON.parse(readFileSync(join(home, 'Library', 'Caches', 'com.anthropic.claudefordesktop.ShipIt', 'ShipItState.plist'), 'utf8'));
    const alvo = deUrl(estado?.targetBundleURL);
    const novo = deUrl(estado?.updateBundleURL);
    const instalada = alvo && versaoDoPlist(alvo);
    const baixada = novo && versaoDoPlist(novo);
    if (instalada && baixada && instalada !== baixada) r.app = { instalada, baixada };
  } catch { /* sem ShipIt: nada baixado */ }
  let pastas = [];
  try { pastas = readdirSync(join(home, 'Library', 'Application Support', 'Claude', 'claude-code')).filter((n) => RELEASE.test(n)); } catch { /* sem pasta */ }
  const rodando = ps.flatMap((p) => { const m = /\/claude-code\/(\d+\.\d+\.\d+)\//.exec(p.command); return m ? [m[1]] : []; });
  if (pastas.length && rodando.length) {
    const baixada = pastas.sort(compararVersao).at(-1);
    const velha = rodando.sort(compararVersao)[0];
    if (compararVersao(velha, baixada) < 0) r.motor = { rodando: velha, baixada };
  }
  return r.app || r.motor ? r : null;
}

/** A linha da atualização: `null` sem nada esperando. */
export function fraseDaAtualizacao(a) {
  if (!a) return null;
  const partes = [a.app && `app ${a.app.baixada}`, a.motor && `motor ${a.motor.baixada}`].filter(Boolean);
  return `Atualização baixada (${partes.join(', ')}): reinicie o app para instalar.`;
}

/** O texto da resposta. `idadeMin` só quando a lista é a da batida. */
export function textoDoReinicio({ pode, motivos, sessoesDe, idadeMin, atualizacao }) {
  const idade = sessoesDe === 'batida' && idadeMin !== undefined ? `(lista de há ${idadeMin} min)\n` : '';
  const att = atualizacao ? `${fraseDaAtualizacao(atualizacao)}\n` : '';
  return pode ? `Pode reiniciar.\n${att}${idade}` : `Não reinicie agora:\n${motivos.map((m) => m.texto).join('\n')}\n${att}${idade}`;
}
