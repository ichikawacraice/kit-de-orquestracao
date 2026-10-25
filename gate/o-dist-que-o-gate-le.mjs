#!/usr/bin/env node
/**
 * **Constrói o `dist` que o gate lê, antes de o gate medir qualquer coisa** —
 * só no perfil `pnpm-workspace`; no perfil `comando` não há build nem conferência
 * de instalação, e as duas funções devolvem 0.
 *
 * Sem isto o gate mede uma combinação que não existe em lugar nenhum: fonte
 * novo dos pacotes contra `dist` velho. A lista de pacotes a construir é
 * DERIVADA (uma propriedade de cada `package.json`: porta de entrada dentro de
 * `dist/` = "consumido compilado"), nunca escrita — uma segunda lista teria de
 * concordar com os `package.json` sem nada forçando. Apps não têm `main`, então
 * nunca entram, e o `next build` da raiz não tem por onde acontecer.
 *
 * A instalação (`node_modules/.pnpm/lock.yaml` contra `pnpm-lock.yaml`) se
 * confere ANTES da fila: esperar a vez por minutos para morrer em 2 s com um
 * pacote ausente é o pior dos dois mundos. Não instala sozinho.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { carregarConfig, raizDoProjeto } from "./config.mjs";
import { rodarSePrincipal } from "./o-script-principal.mjs";

export const RAIZ = raizDoProjeto();

/**
 * Os diretórios de projeto do workspace, lidos do `pnpm-workspace.yaml` DE
 * VERDADE — não de uma cópia da lista aqui.
 *
 * Padrão que este resolvedor não entende vira ERRO, nunca silêncio: um
 * `libs/**` novo que ele ignorasse tiraria aquele pacote do gate sem nada
 * acusar, que é exatamente o defeito que este arquivo existe para fechar.
 */
export function projetosDoWorkspace(raiz = RAIZ) {
  const caminho = join(raiz, "pnpm-workspace.yaml");
  if (!existsSync(caminho)) throw new Error(`não achei o pnpm-workspace.yaml em ${raiz}`);

  const padroes = readFileSync(caminho, "utf-8")
    .split("\n")
    .map((linha) => /^\s*-\s*["']?(.+?)["']?\s*$/.exec(linha)?.[1])
    .filter((p) => p !== undefined);
  if (padroes.length === 0) throw new Error(`o pnpm-workspace.yaml de ${raiz} não lista pacote nenhum`);

  const dirs = [];
  for (const padrao of padroes) {
    if (padrao.includes("*")) {
      const [prefixo, resto] = [padrao.slice(0, padrao.indexOf("*")), padrao.slice(padrao.indexOf("*"))];
      if (resto !== "*" || !prefixo.endsWith("/")) {
        throw new Error(
          `padrão "${padrao}" do pnpm-workspace.yaml: este resolvedor só entende "<dir>/*". ` +
            `Ensine-o antes de usar o padrão novo — ignorá-lo tiraria um pacote do gate em silêncio.`,
        );
      }
      const base = join(raiz, prefixo);
      if (!existsSync(base)) continue;
      for (const nome of readdirSync(base)) {
        const dir = join(base, nome);
        if (statSync(dir).isDirectory() && existsSync(join(dir, "package.json"))) dirs.push(dir);
      }
    } else {
      const dir = join(raiz, padrao);
      if (existsSync(join(dir, "package.json"))) dirs.push(dir);
    }
  }
  return dirs;
}

/** `true` para um caminho de pacote que aponta para dentro de `dist/`. */
const apontaParaDist = (valor) => typeof valor === "string" && /^\.?\/?dist\//.test(valor);

/**
 * Todo caminho declarado por um `package.json` como porta de entrada: `main`,
 * `types`/`typings`, e cada folha de `exports` — que é uma árvore de
 * profundidade livre (`"."` → `import`/`types` → …).
 *
 * `exports` entra junto com `main` porque um pacote pode declarar SÓ ele: era
 * o único jeito de um pacote consumido compilado escapar desta varredura em
 * silêncio, que é o defeito que este arquivo fecha, por dentro.
 */
function portasDeEntrada(pkg) {
  const saida = [pkg.main, pkg.types, pkg.typings];
  const desce = (no) => {
    if (typeof no === "string") saida.push(no);
    else if (no && typeof no === "object") for (const filho of Object.values(no)) desce(filho);
  };
  desce(pkg.exports);
  return saida;
}

/**
 * Os pacotes que o gate tem de construir: os que são consumidos COMPILADOS,
 * isto é, que declaram alguma porta de entrada dentro de `dist/`.
 *
 * `apps/web` não declara nenhuma — por isso ele nunca entra, e não por estar
 * nomeado numa exceção que alguém possa apagar.
 */
export function pacotesConsumidosCompilados(raiz = RAIZ) {
  const nomes = [];
  for (const dir of projetosDoWorkspace(raiz)) {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
    if (typeof pkg.name === "string" && portasDeEntrada(pkg).some(apontaParaDist)) nomes.push(pkg.name);
  }
  return nomes.sort();
}

/**
 * **A instalação corresponde ao `pnpm-lock.yaml`?** — conferido ANTES de
 * construir, e antes de esperar a vez ().
 *
 * **O caso (2026-10-11, duas vezes).** Num worktree com `node_modules` de
 * antes do PR #831, que trouxe o `parse5` ao lockfile, o gate morria em ~2 s
 * com o erro de um pacote ausente no meio do build — e nada na mensagem dizia
 * que bastava `pnpm install --frozen-lockfile`. Sem `node_modules` nenhum, o
 * desfecho é `sh: tsc: command not found` (medido no mesmo dia), que também
 * não diz o que fazer.
 *
 * **O que se compara, e por que é o conteúdo.** O pnpm daqui (9.12.3) grava,
 * a cada instalação, uma cópia do lockfile que instalou em
 * `node_modules/.pnpm/lock.yaml` — medido: byte a byte igual ao
 * `pnpm-lock.yaml` depois de `pnpm install --frozen-lockfile`, inclusive os
 * pacotes de outra plataforma, que ficam no arquivo mesmo sem serem baixados.
 * O `node_modules/.modules.yaml` não serve: guarda o layout (`hoistPattern`,
 * `prunedAt`), não o lockfile. E data de arquivo (`mtime`) não serve: trocar
 * de branch e voltar reescreve o lockfile com o MESMO conteúdo e o faria
 * parecer mais novo, parando o gate sem motivo.
 *
 * Devolve `{ ok: true }` ou `{ ok: false, ramo, motivo }`. O `ramo` existe para
 * o teste afirmar POR QUE parou: os quatro desfechos de recusa dizem a mesma
 * coisa ao operador (rode o install), mas só um é "a instalação é velha".
 */
export function instalacaoEmDia(raiz = RAIZ) {
  const lockfile = join(raiz, "pnpm-lock.yaml");
  const instalado = join(raiz, "node_modules", ".pnpm", "lock.yaml");
  if (!existsSync(lockfile)) {
    return { ok: false, ramo: "sem-lockfile", motivo: `não achei o pnpm-lock.yaml em ${raiz}` };
  }
  const esperado = readFileSync(lockfile, "utf-8");
  // Guarda com insumo vazio: dois arquivos vazios são iguais, e o vazio
  // atravessaria a comparação como "em dia".
  if (esperado.trim() === "") {
    return { ok: false, ramo: "lockfile-vazio", motivo: `o pnpm-lock.yaml de ${raiz} está vazio` };
  }
  if (!existsSync(join(raiz, "node_modules"))) {
    return { ok: false, ramo: "sem-instalacao", motivo: `não há node_modules em ${raiz} — nada foi instalado neste worktree` };
  }
  if (!existsSync(instalado)) {
    return {
      ok: false,
      ramo: "sem-registro-da-instalacao",
      motivo: `há node_modules em ${raiz}, mas sem o node_modules/.pnpm/lock.yaml que diz o que foi instalado`,
    };
  }
  if (readFileSync(instalado, "utf-8") !== esperado) {
    return {
      ok: false,
      ramo: "instalacao-velha",
      motivo: `o node_modules de ${raiz} foi instalado de outro pnpm-lock.yaml (o lockfile mudou depois do último install — rebase e pull trazem isso)`,
    };
  }
  return { ok: true };
}

/**
 * Confere a instalação e, se ela não corresponde ao lockfile, diz o comando
 * que resolve. **Não instala sozinho**: o install mexe no `node_modules` que o
 * `next dev` e o worker deste worktree podem estar usando. Devolve o código de
 * saída (0 segue). No CI não confere — o `pnpm install --frozen-lockfile` roda
 * no mesmo job, passos antes —, e diz isso.
 */
export function conferirInstalacao(raiz = RAIZ, env = process.env, avisar = (msg) => console.error(msg), cfg = carregarConfig(raiz)) {
  if (cfg.gate.perfil !== "pnpm-workspace") return 0;
  if (env["CI"]) {
    avisar("[gate] CI: a instalação acabou de ser feita neste job — sem conferir o lockfile");
    return 0;
  }
  const r = instalacaoEmDia(raiz);
  if (r.ok) return 0;
  avisar(
    `[gate] a instalação não corresponde ao pnpm-lock.yaml: ${r.motivo}.\n` +
      `[gate] rode \`pnpm install --frozen-lockfile\` em ${raiz} e repita — o gate não instala sozinho.`,
  );
  return 1;
}

/** Roda o build filtrado, depois de conferir a instalação. Devolve o código de saída. */
export function constroi(raiz = RAIZ, env = process.env, cfg = carregarConfig(raiz)) {
  if (cfg.gate.perfil !== "pnpm-workspace") return 0;
  const instalacao = conferirInstalacao(raiz, env, undefined, cfg);
  if (instalacao !== 0) return instalacao;
  const prazoMs = cfg.gate.prazos.buildMin * 60_000; // lento ≠ pendurado: o build leva segundos
  const pacotes = pacotesConsumidosCompilados(raiz);
  if (pacotes.length === 0) {
    // Zero pacotes não é "nada a fazer": é "não achei o workspace". Seguir em
    // frente aqui devolveria o gate exatamente ao buraco que ele fechou.
    console.error(`[dist] nenhum pacote consumido compilado em ${raiz} — o workspace não foi lido.`);
    return 1;
  }
  console.error(`[dist] construindo o que o gate lê: ${pacotes.join(", ")}`);
  const { status, signal, error } = spawnSync("pnpm", [...pacotes.flatMap((p) => ["--filter", p]), "build"], {
    cwd: raiz,
    stdio: "inherit",
    shell: process.platform === "win32",
    // Prazo e SIGKILL: o build leva segundos; um `tsc` pendurado não pode segurar o gate — nem a vez dele.
    timeout: prazoMs,
    killSignal: "SIGKILL",
  });
  if (error) console.error(`[dist] o build não rodou: ${error.message}`);
  if (signal) console.error(`[dist] o build terminou pelo sinal ${signal} (prazo de ${prazoMs / 60_000} min)`);
  return status ?? 1;
}

// Pelo caminho REAL dos dois lados — link e espaço no caminho não podem virar saída 0 sem rodar.
rodarSePrincipal(import.meta.url, () => constroi(), "[dist]");
