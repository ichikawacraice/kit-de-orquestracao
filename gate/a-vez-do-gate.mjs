#!/usr/bin/env node
/**
 * **O gate da raiz: um por vez na máquina, com teto de pacotes e verde guardado.**
 *
 * Várias sessões rodando o gate juntas travam a máquina. Este script, em ordem:
 *
 *   0. Confere a instalação (perfil `pnpm-workspace`) ANTES da fila.
 *   1. Consulta o **verde guardado** (`o-verde-da-arvore.mjs`): a mesma chave já
 *      passou nas últimas `verdeHoras`? Diz qual árvore, quando e onde, e sai 0
 *      sem tomar a vez — ler um arquivo não precisa da fila.
 *   2. Toma a **vez**: uma trava em arquivo, comum a todos os worktrees do
 *      repositório (no diretório comum do git; sem git legível, em
 *      `os.tmpdir()`, e diz isso). Quem chega e acha a trava ocupada ESPERA e
 *      diz por quem. Trava de processo morto é retomada; trava vencida também.
 *   3. Constrói o que o gate lê (perfil `pnpm-workspace`) e roda o comando da suíte.
 *   4. Grava o verde, só se a árvore não mudou durante a medida, e solta a trava.
 *
 * **No CI nada disto muda** (`process.env.CI`): sem fila, sem teto, sem verde.
 *
 * **Vagas.** `KIT_GATE_VAGAS=N` abre N vagas; o padrão é 1. A vaga 1 é a
 * trava de sempre; a k ≥ 2 leva o sufixo `.k`. O MESMO worktree nunca roda dois
 * gates juntos (construiriam o mesmo `dist`).
 *
 * **Duas filas.** `a-vez-do-gate.mjs <pacote> [args]` roda um pacote só pela
 * fila do CONSERTO (`gate.travaConserto`, `KIT_CONSERTO_VAGAS`, padrão 1), com 2
 * workers (`KIT_TESTE_WORKERS`, ou `KIT_CONSERTO_WORKERS`), e não espera o gate
 * completo — nem o contrário. Nunca grava o verde: só a suíte inteira prova a árvore.
 *
 * **Configuração**: `.claude/kit.json` (ver `config.mjs`). Os nomes `IZANAGI_*`
 * das variáveis continuam valendo como reserva dos `KIT_*`.
 *
 * **O que a retomada NÃO garante.** Entre ler a trava morta e apagá-la há uma
 * janela de microssegundos em que um segundo retomador pode apagar a trava que
 * o primeiro acabou de criar. O desfecho desse empate são dois gates juntos —
 * o mundo sem este arquivo —, nunca um gate preso para sempre.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, openSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { carregarConfig, envKit, inteiroDoEnv, partirComando } from "./config.mjs";
import { RAIZ, conferirInstalacao, constroi, projetosDoWorkspace } from "./o-dist-que-o-gate-le.mjs";
import { consultar, guardarSeAArvoreNaoMudou, linhaDoPulo } from "./o-verde-da-arvore.mjs";
import { rodarSePrincipal } from "./o-script-principal.mjs";

/** Quanto uma vez vale por padrão (`gate.prazos.vezMin`). O gate leva minutos; isto só existe para que um dono travado não segure a fila para sempre. */
export const PRAZO_DA_VEZ_MS = 60 * 60 * 1000;

/** Trava ilegível (alguém no meio da escrita, ou lixo) mais velha que isto é tratada como abandonada (`gate.prazos.ilegivelSeg`). */
const ILEGIVEL_ABANDONADA_MS = 30_000;

/** Prazo de cada `git` que este script chama — `git` parado num lock não pode parar o gate. */
const PRAZO_DO_GIT_MS = 10_000;

/** As duas filas: o gate completo e o conserto (um pacote só), cada uma com a sua trava e as suas vagas. */
const FILAS = {
  gate: { trava: (cfg) => cfg.gate.trava, injecao: "GATE_TRAVA", vagas: "GATE_VAGAS" },
  conserto: { trava: (cfg) => cfg.gate.travaConserto, injecao: "CONSERTO_TRAVA", vagas: "CONSERTO_VAGAS" },
};

/**
 * Quantos pacotes rodam juntos fora do CI (perfil `pnpm-workspace`).
 * `KIT_GATE_PACOTES` sobrescreve (inteiro ≥ 1); no CI, `null` — sem a flag, o
 * default do pnpm.
 */
export function pacotesJuntos(env = process.env, cfg = carregarConfig(RAIZ)) {
  if (env["CI"]) return null;
  return inteiroDoEnv(env, "GATE_PACOTES", cfg.gate.pacotesJuntos);
}

/**
 * Quantas vagas a fila tem. `KIT_GATE_VAGAS` (gate) ou `KIT_CONSERTO_VAGAS`
 * (conserto): inteiro ≥ 1, padrão 1 — um por vez; no CI, `null` — sem trava.
 */
export function vagas(env = process.env, fila = "gate") {
  if (env["CI"]) return null;
  return inteiroDoEnv(env, FILAS[fila].vagas, 1);
}

/** O caminho da vaga k: a 1 é a trava de sempre, a k ≥ 2 leva o sufixo. */
export const caminhoDaVaga = (base, k) => (k === 1 ? base : `${base}.${k}`);

/** O argv sem o `--` que alguns chamadores põem na frente. */
const semSeparador = (argv) => (argv[0] === "--" ? argv.slice(1) : argv);

/**
 * Os pacotes que o gate aceita pelo nome curto: `[{ curto, filtro }]`. Com
 * `gate.pacotes: "auto"` (perfil `pnpm-workspace`), lidos do `pnpm-workspace.yaml`
 * — o nome curto é o `name` do `package.json` sem o escopo; com uma lista, os
 * nomes dela passados pelo `gate.filtroDePacote` (`{pacote}` é o nome curto).
 */
export function pacotesDoGate(raiz = RAIZ, cfg = carregarConfig(raiz)) {
  const { pacotes, filtroDePacote } = cfg.gate;
  if (pacotes === "auto") {
    return projetosDoWorkspace(raiz)
      .map((dir) => JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")).name)
      .filter((nome) => typeof nome === "string")
      .map((nome) => ({ curto: nome.replace(/^@[^/]+\//, ""), filtro: nome }));
  }
  return pacotes.map((p) => ({ curto: p, filtro: filtroDePacote.replace("{pacote}", p) }));
}

/** O pacote pedido no argv (`null` para a suíte inteira). Nome que não é pacote é erro alto, com a lista. */
export function pacoteDoArgv(argv = [], raiz = RAIZ, cfg = carregarConfig(raiz)) {
  const [pedido] = semSeparador(argv);
  if (pedido === undefined) return null;
  const todos = pacotesDoGate(raiz, cfg);
  const achado = todos.find((p) => p.curto === pedido);
  if (!achado) {
    throw new Error(`pacote "${pedido}" desconhecido — use um de: ${todos.map((p) => p.curto).join(", ") || "(nenhum declarado em gate.pacotes)"}`);
  }
  return achado;
}

/** A fila do argv: sem pacote, a do gate completo; com pacote, a do conserto. */
export const filaDoArgv = (argv = [], raiz = RAIZ, cfg = carregarConfig(raiz)) => (pacoteDoArgv(argv, raiz, cfg) === null ? "gate" : "conserto");

/** A variável que o gate põe no ambiente da suíte: o laço (suíte → `npm test` → gate) é detectado por ela, não pelo texto do comando. */
export const DENTRO = "KIT_GATE_DENTRO";

/** O erro de quem espera a vez de um gate que é seu próprio ancestral: esperar seria para sempre. */
export const MENSAGEM_DO_LACO = (detalhe, irmao = false) => `[gate] a suíte chama o gate ${irmao ? "de um worktree irmão que espera por ela" : "deste mesmo worktree"} (laço: ${irmao ? "o gate dela ocupa as vagas todas" : "o gate.comandoCompleto chama o próprio gate"}${detalhe ? `; ${detalhe}` : ""}) — recusado, sem esperar. Aponte o comando para o script da suíte do projeto.`;

/**
 * O ambiente do filho que roda a suíte. O conserto leva `KIT_TESTE_WORKERS`
 * (e o legado `IZANAGI_TESTE_WORKERS`, que o `vitest.teto.mjs` de quem migra
 * ainda lê) = `gate.workersConserto` quando quem chamou não definiu
 * (`KIT_CONSERTO_WORKERS` escolhe outro valor); o gate completo segue com o teto
 * do projeto.
 */
export function ambienteDoFilho(env = process.env, argv = [], raiz = RAIZ, cfg = carregarConfig(raiz)) {
  // `KIT_GATE_DENTRO`: o filho sabe que nasceu de um gate; um gate que nasce com ela recusa (o `comandoCompleto` chamou o próprio gate)
  const filho = { ...env, [DENTRO]: raizDoWorktree(raiz) };
  if (filaDoArgv(argv, raiz, cfg) !== "conserto") return filho;
  const pedido = envKit(env, "CONSERTO_WORKERS");
  let n = cfg.gate.workersConserto;
  if (pedido !== undefined) n = inteiroDoEnv(env, "CONSERTO_WORKERS", n);
  else if (envKit(env, "TESTE_WORKERS") !== undefined) return filho;
  filho["KIT_TESTE_WORKERS"] = String(n);
  filho["IZANAGI_TESTE_WORKERS"] = String(n);
  return filho;
}

/**
 * O comando que mede a suíte: `{ cmd, args }`. Perfil `pnpm-workspace`:
 * `pnpm -r [--workspace-concurrency=n] test`, ou `pnpm --filter <pacote> test …`.
 * Perfil `comando`: o `gate.comandoCompleto` (ou o `gate.comandoPorPacote` com
 * `{pacote}` trocado) — partido por espaço, sem shell. Sem o comando declarado,
 * recusa alto: o gate não adivinha como o projeto roda os testes.
 */
export function comandoDaSuite(env = process.env, argv = [], raiz = RAIZ, cfg = carregarConfig(raiz)) {
  const pacote = pacoteDoArgv(argv, raiz, cfg);
  const resto = pacote === null ? [] : semSeparador(argv).slice(1);
  if (cfg.gate.perfil === "pnpm-workspace") {
    if (pacote !== null) return { cmd: "pnpm", args: ["--filter", pacote.filtro, "test", ...resto] };
    const n = pacotesJuntos(env, cfg);
    return { cmd: "pnpm", args: n === null ? ["-r", "test"] : ["-r", `--workspace-concurrency=${n}`, "test"] };
  }
  if (pacote !== null) {
    if (!cfg.gate.comandoPorPacote) throw new Error("este projeto não declara gate.comandoPorPacote no .claude/kit.json — não sei rodar um pacote só");
    const [cmd, ...args] = partirComando(cfg.gate.comandoPorPacote.replaceAll("{pacote}", pacote.filtro));
    return { cmd, args: [...args, ...resto] };
  }
  if (!cfg.gate.comandoCompleto) throw new Error('falta "gate.comandoCompleto" no .claude/kit.json — o gate não adivinha o comando dos testes');
  const [cmd, ...args] = partirComando(cfg.gate.comandoCompleto);
  return { cmd, args };
}

/** Só os argumentos de {@link comandoDaSuite} — o que o `pnpm` recebe no perfil `pnpm-workspace`. */
export const argumentosDaSuite = (env = process.env, argv = [], raiz = RAIZ, cfg = carregarConfig(raiz)) => comandoDaSuite(env, argv, raiz, cfg).args;

/** Roda `git` com prazo, e devolve a saída — ou `null` com o motivo escrito em `erro`. */
function git(args, cwd) {
  try {
    const saida = execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: PRAZO_DO_GIT_MS,
      killSignal: "SIGKILL",
    });
    return { saida: saida.trim(), erro: null };
  } catch (e) {
    // `stderr` de quem nem nasceu (ENOENT) é `undefined` — `String()` faria dele
    // a palavra "undefined" —, e o vazio cai para a mensagem: `||`, não `??`.
    const erro = (e?.stderr == null ? "" : String(e.stderr).trim()) || String(e?.message ?? e);
    return { saida: null, erro };
  }
}

/**
 * O caminho da trava: `KIT_GATE_TRAVA` (ou o legado `IZANAGI_`), senão o diretório comum do git,
 * senão `os.tmpdir()`. Devolve também o aviso a imprimir quando caiu no último.
 */
export function caminhoDaTrava(env = process.env, raiz = RAIZ, fila = "gate", cfg = carregarConfig(raiz)) {
  const { trava, injecao } = FILAS[fila];
  const NOME_DA_TRAVA = trava(cfg);
  const pedido = envKit(env, injecao);
  if (pedido) return { caminho: pedido, aviso: null };
  const { saida, erro } = git(["rev-parse", "--git-common-dir"], raiz);
  if (saida) return { caminho: join(isAbsolute(saida) ? saida : join(raiz, saida), NOME_DA_TRAVA), aviso: null };
  return {
    caminho: join(tmpdir(), NOME_DA_TRAVA),
    aviso: `não li o diretório comum do git (${erro}); a trava fica em ${tmpdir()}, que só vale para quem tem o mesmo $TMPDIR`,
  };
}

/** `true` se o PID existe. `EPERM` é processo vivo de outro usuário — vivo. */
export function processoVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e?.code === "EPERM";
  }
}

/** A raiz do worktree, como o gate a conhece: `git rev-parse --show-toplevel` com `realpath` (sem git, a `raiz` dada). Vai em `KIT_GATE_DENTRO`. */
export function raizDoWorktree(raiz = RAIZ) {
  const topo = git(["rev-parse", "--show-toplevel"], raiz).saida ?? raiz;
  try {
    return realpathSync(topo);
  } catch {
    return topo;
  }
}

/** Os PIDs acima deste processo (pai, avô…), subindo com `ps -o ppid=` com prazo. Para quando não consegue ler. */
export function ancestrais(pid = process.pid) {
  const acima = [];
  let atual = pid;
  for (let i = 0; i < 64; i++) {
    const r = spawnSync("ps", ["-o", "ppid=", "-p", String(atual)], { encoding: "utf-8", timeout: 3_000, killSignal: "SIGKILL" });
    const pai = Number.parseInt(String(r.stdout ?? "").trim(), 10);
    if (r.status !== 0 || !Number.isInteger(pai) || pai <= 1 || acima.includes(pai)) break;
    acima.push(pai);
    atual = pai;
  }
  return acima;
}

/** Quem pede a vez: o que vai escrito na trava, para quem espera saber por quem. */
export function quemSouEu(raiz = RAIZ, agora = Date.now(), prazoMs = PRAZO_DA_VEZ_MS) {
  const sha = git(["rev-parse", "--short", "HEAD"], raiz);
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], raiz);
  return {
    pid: process.pid,
    token: randomUUID(),
    worktree: raiz,
    branch: branch.saida ?? `(branch ilegível: ${branch.erro})`,
    sha: sha.saida ?? `(sha ilegível: ${sha.erro})`,
    desde: new Date(agora).toISOString(),
    venceEm: new Date(agora + prazoMs).toISOString(),
  };
}

/**
 * Lê a trava: `null` se não existe; `{ texto, dono }` se existe, com `dono`
 * `null` quando o conteúdo não é um dono legível.
 */
export function lerTrava(caminho) {
  let texto;
  try {
    texto = readFileSync(caminho, "utf-8");
  } catch (e) {
    if (e?.code === "ENOENT") return null;
    throw e;
  }
  try {
    const dono = JSON.parse(texto);
    const legivel = dono && Number.isInteger(dono.pid) && typeof dono.token === "string" && typeof dono.venceEm === "string";
    return { texto, dono: legivel ? dono : null };
  } catch {
    return { texto, dono: null };
  }
}

/**
 * Por que a trava atual pode ser retomada — ou `null` se o dono dela vale.
 * Exportada para o teste nomear cada ramo.
 */
export function motivoParaRetomar(caminho, lida, agora = Date.now(), ilegivelMs = ILEGIVEL_ABANDONADA_MS) {
  if (lida.dono === null) {
    let idade = 0;
    try {
      idade = agora - statSync(caminho).mtimeMs;
    } catch {
      return null; // sumiu entre ler e medir: a próxima tentativa decide
    }
    return idade > ilegivelMs ? `ilegível há mais de ${Math.round(ilegivelMs / 1000)} s` : null;
  }
  if (!processoVivo(lida.dono.pid)) return `o PID ${lida.dono.pid} não está vivo`;
  if (agora > Date.parse(lida.dono.venceEm)) return `venceu às ${hora(lida.dono.venceEm)}`;
  return null;
}

/**
 * Uma tentativa de tomar a vez. `{ tomou: true, retomada? }` ou
 * `{ tomou: false, dono }` — `dono` pode ser `null` (trava sendo escrita).
 */
export function tentarTomar(caminho, eu, agora = Date.now(), ilegivelMs = ILEGIVEL_ABANDONADA_MS) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const fd = openSync(caminho, "wx");
      try {
        writeFileSync(fd, JSON.stringify(eu, null, 2));
      } finally {
        closeSync(fd);
      }
      return { tomou: true };
    } catch (e) {
      if (e?.code !== "EEXIST") throw e;
    }
    const lida = lerTrava(caminho);
    if (lida === null) continue; // soltaram entre o `wx` e a leitura
    const motivo = motivoParaRetomar(caminho, lida, agora, ilegivelMs);
    if (motivo === null) return { tomou: false, dono: lida.dono };
    // Apaga só se ainda é a MESMA trava que foi julgada — a janela que sobra está no cabeçalho.
    const deNovo = lerTrava(caminho);
    if (deNovo !== null && deNovo.texto === lida.texto) {
      try {
        unlinkSync(caminho);
      } catch (e) {
        if (e?.code !== "ENOENT") throw e;
      }
      console.error(`[gate] retomando a vez: ${motivo} (${descrever(lida.dono)})`);
    }
  }
  const lida = lerTrava(caminho);
  return { tomou: false, dono: lida?.dono ?? null };
}

/**
 * Uma tentativa de tomar uma das `n` vagas. `{ tomou: true, vaga }`, ou
 * `{ tomou: false, donos, mesmoWorktree? }` — `donos` são os das vagas
 * ocupadas (um pode ser `null`: trava sendo escrita). Se outra vaga viva é do
 * MESMO worktree — nesta fila ou numa das `outras` (`[{ base, n }]`) —, não toma
 * nenhuma e devolve esse dono em `mesmoWorktree`.
 */
export function tentarTomarUmaVaga(base, n, eu, agora = Date.now(), outras = [], ilegivelMs = ILEGIVEL_ABANDONADA_MS) {
  // O mesmo worktree, em qualquer vaga desta fila ou das `outras` .
  for (const { base: b, n: m } of [{ base, n }, ...outras]) {
    for (let k = 1; k <= m; k++) {
      const lida = lerTrava(caminhoDaVaga(b, k));
      if (lida === null || lida.dono === null) continue;
      if (lida.dono.worktree === eu.worktree && motivoParaRetomar(caminhoDaVaga(b, k), lida, agora, ilegivelMs) === null) {
        return { tomou: false, donos: [lida.dono], mesmoWorktree: lida.dono };
      }
    }
  }
  const donos = [];
  for (let k = 1; k <= n; k++) {
    const r = tentarTomar(caminhoDaVaga(base, k), eu, agora, ilegivelMs);
    if (r.tomou) return { tomou: true, vaga: k };
    donos.push(r.dono);
  }
  return { tomou: false, donos };
}

/** Solta a trava — só se ela ainda é minha. Devolve se soltou. */
export function soltar(caminho, eu) {
  const lida = lerTrava(caminho);
  if (lida === null || lida.dono === null) return false;
  if (lida.dono.pid !== eu.pid || lida.dono.token !== eu.token) return false;
  try {
    unlinkSync(caminho);
    return true;
  } catch (e) {
    if (e?.code === "ENOENT") return false;
    throw e;
  }
}

const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function descrever(dono) {
  if (!dono) return "dono ilegível";
  return `${dono.worktree} — ${dono.branch} @ ${dono.sha}, PID ${dono.pid}, desde ${hora(dono.desde)}`;
}

/**
 * Espera uma das `n` vagas e devolve qual tomou. Avisa por quem espera ao começar, quando o dono muda e a cada
 * minuto. `dormir` e `agora` são injetáveis para o teste não depender de relógio.
 */
export async function esperarAVez(base, n, eu, opcoes = {}) {
  const {
    intervaloMs = 2_000,
    avisoMs = 60_000,
    dormir = (ms) => new Promise((r) => setTimeout(r, ms)),
    agora = () => Date.now(),
    avisar = (msg) => console.error(msg),
    outras = [],
    fila = "gate",
    ilegivelMs = ILEGIVEL_ABANDONADA_MS,
    ancestraisDe = ancestrais,
  } = opcoes;
  const naFila = fila === "gate" ? "" : ` (fila do ${fila})`;
  const inicio = agora();
  let ultimaChave = undefined;
  let chaveDosAncestrais = undefined;
  let acima = [];
  let ultimoAviso = 0;
  const quem = (r) => (r.donos.length === 0 ? "dono ilegível" : r.donos.map(descrever).join(" | "));
  for (;;) {
    const r = tentarTomarUmaVaga(base, n, eu, agora(), outras, ilegivelMs);
    if (r.tomou) {
      if (ultimaChave !== undefined) avisar(`[gate] a vez chegou depois de ${Math.round((agora() - inicio) / 1000)} s`);
      return r.vaga;
    }
    const chave = r.donos.map((d) => (d ? d.token : "?")).join(",");
    // um dono é ANCESTRAL deste processo: a suíte dele chamou este gate (mesmo com a env limpa) e esperar é para sempre. Vale para o
    // dono do mesmo worktree e, com todas as vagas ocupadas, para qualquer dono (um worktree irmão chamado de dentro da suíte, com 1 vaga).
    // Os ancestrais se olham uma vez por dono (`chave`): cada `ps` custa até 3 s.
    if (chave !== chaveDosAncestrais) {
      acima = ancestraisDe();
      chaveDosAncestrais = chave;
    }
    // mesmo worktree: basta o dono ser ancestral. Outro worktree: só quando TODAS as vagas são de ancestrais (se uma é de quem sai logo, esperar basta).
    const ehAncestral = (d) => d && acima.includes(d.pid);
    const ancestral = r.mesmoWorktree
      ? (ehAncestral(r.mesmoWorktree) ? r.mesmoWorktree : undefined)
      : (r.donos.length > 0 && r.donos.every(ehAncestral) ? r.donos[0] : undefined);
    if (ancestral) {
      const detalhe = r.mesmoWorktree
        ? `o dono da vez, PID ${ancestral.pid}, é ancestral deste processo`
        : `${r.donos.length === 1 ? "o dono da vaga" : `os donos das ${r.donos.length} vagas`}, de outro worktree (${r.donos.map((d) => d.worktree).join(", ")}), ${r.donos.length === 1 ? "é ancestral" : "são ancestrais"} deste processo`;
      throw Object.assign(new Error(MENSAGEM_DO_LACO(detalhe, !r.mesmoWorktree)), { codigo: "LACO" });
    }
    if (chave !== ultimaChave) {
      avisar(
        r.mesmoWorktree
          ? `[gate] esperando a vez${naFila} — este mesmo worktree já tem um gate rodando (dois juntos construiriam o mesmo dist): ${quem(r)}`
          : `[gate] esperando a vez${naFila} — ${n === 1 ? "outro gate está" : `as ${n} vagas estão ocupadas`} rodando nesta máquina: ${quem(r)}` +
              (r.donos.length === 1 && r.donos[0] ? `; a vez dele vence às ${hora(r.donos[0].venceEm)}` : ""),
      );
      ultimaChave = chave;
      ultimoAviso = agora();
    } else if (agora() - ultimoAviso >= avisoMs) {
      avisar(`[gate] ainda esperando (${Math.round((agora() - inicio) / 60_000)} min) — ${quem(r)}`);
      ultimoAviso = agora();
    }
    await dormir(intervaloMs);
  }
}

/**
 * Roda a suíte num grupo de processos próprio, com prazo, e repassa Ctrl-C e
 * SIGTERM ao grupo inteiro — matar só o gerenciador deixaria os workers do vitest
 * vivos.
 */
function rodarASuite({ cmd, args }, prazoMs, env = process.env, raiz = RAIZ) {
  return new Promise((resolve) => {
    const filho = spawn(cmd, args, {
      cwd: raiz,
      env,
      stdio: "inherit",
      detached: process.platform !== "win32",
      shell: process.platform === "win32",
    });
    const matarGrupo = (sinal) => {
      try {
        if (process.platform === "win32") filho.kill(sinal);
        else process.kill(-filho.pid, sinal);
      } catch {
        /* o grupo já saiu */
      }
    };
    const prazo = setTimeout(() => {
      console.error(`[gate] a suíte passou de ${Math.round(prazoMs / 60_000)} min — matando o grupo inteiro`);
      matarGrupo("SIGKILL");
    }, prazoMs);
    const repassar = (sinal) => () => matarGrupo(sinal);
    const sinais = ["SIGINT", "SIGTERM", "SIGHUP"].map((s) => [s, repassar(s)]);
    for (const [s, h] of sinais) process.on(s, h);
    filho.on("error", (e) => {
      console.error(`[gate] não consegui rodar o ${cmd}: ${e.message}`);
    });
    filho.on("close", (codigo, sinal) => {
      clearTimeout(prazo);
      for (const [s, h] of sinais) process.off(s, h);
      if (sinal) console.error(`[gate] a suíte terminou pelo sinal ${sinal}`);
      resolve(codigo ?? 1);
    });
  });
}

/** O gate inteiro. Devolve o código de saída. */
export async function main(env = process.env, argv = process.argv.slice(2), raiz = RAIZ, cfg = carregarConfig(raiz)) {
  // só o gate DESTE worktree que chamou a suíte é laço; o de outro repositório ou worktree tem outra trava (ou outra vaga) e segue
  if (env[DENTRO] && env[DENTRO] === raizDoWorktree(raiz)) {
    console.error(MENSAGEM_DO_LACO(`o gate de ${env[DENTRO]} chamou a suíte`));
    return 2;
  }
  const comando = comandoDaSuite(env, argv, raiz, cfg);
  const pacote = pacoteDoArgv(argv, raiz, cfg);
  const prazoMs = cfg.gate.prazos.vezMin * 60_000;
  if (env["CI"]) {
    console.error("[gate] CI: sem fila e sem teto de pacotes — o comportamento de antes");
    const codigo = constroi(raiz, env, cfg);
    return codigo !== 0 ? codigo : rodarASuite(comando, prazoMs, { ...env, [DENTRO]: raizDoWorktree(raiz) }, raiz);
  }

  // A instalação se confere ANTES da fila: esperar a vez por minutos para morrer
  // em 2 s com um pacote ausente é o pior dos dois mundos.
  const instalacao = conferirInstalacao(raiz, env, undefined, cfg);
  if (instalacao !== 0) return instalacao;

  // O verde guardado: só a suíte inteira consulta e grava.
  let verde = null;
  if (pacote === null) {
    verde = consultar("test", raiz, env, undefined, cfg);
    if (verde.registro) {
      console.error(linhaDoPulo(verde.registro));
      return 0;
    }
    console.error(
      verde.recusa !== null
        ? `[gate] sem verde guardado possível: ${verde.recusa} — medindo, sem guardar`
        : `[gate] a árvore ${verde.insumos.arvore} não tem verde guardado — medindo`,
    );
  } else {
    console.error(`[gate] só o pacote ${pacote.filtro} — não guarda o verde; o gate completo roda antes do push`);
  }

  const fila = filaDoArgv(argv, raiz, cfg);
  const outraFila = fila === "gate" ? "conserto" : "gate";
  const { caminho, aviso } = caminhoDaTrava(env, raiz, fila, cfg);
  if (aviso) console.error(`[gate] ${aviso}`);
  const outra = { base: caminhoDaTrava(env, raiz, outraFila, cfg).caminho, n: vagas(env, outraFila) ?? 1 };
  const eu = quemSouEu(raiz, Date.now(), prazoMs);
  const n = vagas(env, fila) ?? 1;
  const filho = ambienteDoFilho(env, argv, raiz, cfg);
  let vaga;
  try {
    vaga = await esperarAVez(caminho, n, eu, { outras: [outra], fila, ilegivelMs: cfg.gate.prazos.ilegivelSeg * 1000 });
  } catch (e) {
    if (e?.codigo !== "LACO") throw e;
    console.error(e.message);
    return 2;
  }
  const minha = caminhoDaVaga(caminho, vaga);
  console.error(
    `[gate] a vez é minha (fila do ${fila}, vaga ${vaga} de ${n}, ${minha}) — ${comando.cmd} ${comando.args.join(" ")}, até ${availableParallelism()} núcleos repartidos pelo teto`,
  );

  // Soltar no fim é o caminho normal; o `exit` cobre a saída por exceção. Um
  // SIGKILL — ou um Ctrl-C durante o build, que é síncrono — não passa por
  // nenhum dos dois: por isso a trava de PID morto é retomada.
  const soltarAoSair = () => soltar(minha, eu);
  process.on("exit", soltarAoSair);
  try {
    // De novo, já com a vez: a sessão que estava na frente pode ter acabado de
    // guardar o verde desta mesma árvore — e a chave do começo da medida é a de
    // AGORA, não a de antes da espera, em que a árvore ainda podia mudar.
    if (verde !== null) {
      verde = consultar("test", raiz, env, undefined, cfg);
      if (verde.registro) {
        console.error(linhaDoPulo(verde.registro));
        return 0;
      }
    }
    const inicio = Date.now();
    const codigo = constroi(raiz, env, cfg);
    if (codigo !== 0) return codigo;
    const resultado = await rodarASuite(comando, prazoMs, filho, raiz);
    if (resultado === 0 && verde !== null) guardarSeAArvoreNaoMudou("test", verde, inicio, raiz, env, undefined, cfg);
    return resultado;
  } finally {
    soltar(minha, eu);
    process.off("exit", soltarAoSair);
  }
}

// Pelo caminho REAL dos dois lados — link e espaço no caminho não podem virar
// saída 0 sem rodar; `exitCode`, nunca `process.exit()` .
rodarSePrincipal(import.meta.url, () => main(), "[gate]");
