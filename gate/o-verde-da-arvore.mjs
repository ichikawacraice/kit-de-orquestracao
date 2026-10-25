#!/usr/bin/env node
/**
 * **O verde do gate, guardado pela árvore exata.**
 *
 * O gate pula a árvore que já passou. O pulo só é honesto se a chave enxerga
 * tudo o que decide o desfecho (árvore do git inclusive o não rastreado, runtime,
 * variáveis de ambiente — nome e valor entram só no hash —, `.env`, e os
 * `arvore.extras` do `kit.json`), se o registro não guarda segredo e se só o
 * verde da MESMA chave, dentro do prazo, vale. Árvore ilegível, ou arquivo com
 * `assume-unchanged`/`skip-worktree`, não tem verde possível.
 *
 * Guardado em `<git-common-dir>/<gate.verdeDir>` (um para todo worktree);
 * `KIT_GATE_VERDE_DIR` aponta outro; `KIT_GATE_SEM_CACHE=1` mede de novo.
 * `node o-verde-da-arvore.mjs` imprime a chave e o que passou.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  accessSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { carregarConfig, envKit, partirComando } from "./config.mjs";
import { RAIZ } from "./o-dist-que-o-gate-le.mjs";
import { rodarSePrincipal } from "./o-script-principal.mjs";

/** Quanto um verde vale: cobre a vida de um PR e limita o que o mundo de fora muda sob a mesma árvore. */
export const PRAZO_DO_VERDE_MS = 24 * 60 * 60 * 1000;

/** Registro mais velho que isto é apagado na próxima gravação. */
export const RETENCAO_MS = 7 * 24 * 60 * 60 * 1000;

/** A versão do formato do registro: registro de outro formato não vale. */
export const FORMATO = 1;

/** As etapas que guardam verde. */
export const ETAPAS = ["test", "typecheck"];

const PRAZO_DO_GIT_MS = 10_000;
const PRAZO_DO_ADD_MS = 30_000;
const PRAZO_DO_PSQL_MS = 30_000;

/** O mesmo default de `packages/runner/test/banco-local-da-arvore.ts` — a outra ponta desta consulta. */

/** Variáveis que mudam o desfecho da suíte: estes prefixos, mais as avulsas. */
/** Variáveis do próprio gate que não mudam o que a suíte mede. */

const sha256 = (texto) => createHash("sha256").update(texto).digest("hex");

/**
 * Primeira linha da causa. `stderr` de quem nem nasceu (ENOENT) é `undefined`
 * — `String(undefined)` seria a palavra "undefined" e ganharia do `||` —, e o
 * vazio cai para a mensagem: `||`, não `??`.
 */
function causa(e) {
  const stderr = e?.stderr == null ? "" : String(e.stderr).trim();
  return (stderr || String(e?.message ?? e)).split("\n")[0];
}

/** Roda um comando com prazo e SIGKILL ; `{ saida }` ou `{ erro }`. */
function rodar(cmd, args, opcoes = {}) {
  try {
    const saida = execFileSync(cmd, args, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: PRAZO_DO_GIT_MS,
      killSignal: "SIGKILL",
      ...opcoes,
    });
    return { saida: saida.trim(), erro: null };
  } catch (e) {
    return { saida: null, erro: causa(e) };
  }
}

/**
 * O hash da árvore do worktree como o git a versionaria AGORA: cópia do índice
 * real (traz o cache de `stat`) num índice temporário, `git add -A`,
 * `git write-tree`. **O índice real nunca é tocado.**
 */
export function arvoreDoWorktree(raiz = RAIZ) {
  // `assume-unchanged` (letra minúscula) e `skip-worktree` (`S`) vão junto na
  // cópia do índice e fazem a edição desses arquivos não mudar a árvore: com
  // eles, a árvore não é a do disco, e não há verde a guardar.
  const marcados = rodar("git", ["ls-files", "-v"], { cwd: raiz, maxBuffer: 64 * 1024 * 1024 });
  if (marcados.erro) return { erro: `não li o índice do git (${marcados.erro})` };
  const comFlag = marcados.saida.split("\n").filter((l) => /^([a-z]|S) /.test(l));
  if (comFlag.length > 0) {
    return { erro: `${comFlag.length} arquivo(s) com assume-unchanged ou skip-worktree no índice (${comFlag[0].slice(2)})` };
  }
  const indice = rodar("git", ["rev-parse", "--path-format=absolute", "--git-path", "index"], { cwd: raiz });
  if (indice.erro) return { erro: `não li o índice do git (${indice.erro})` };
  const dir = mkdtempSync(join(tmpdir(), "kit-verde-"));
  try {
    const temporario = join(dir, "idx");
    if (existsSync(indice.saida)) copyFileSync(indice.saida, temporario);
    const env = { ...process.env, GIT_INDEX_FILE: temporario };
    const add = rodar("git", ["add", "-A"], { cwd: raiz, env, timeout: PRAZO_DO_ADD_MS });
    if (add.erro) return { erro: `git add -A no índice temporário falhou (${add.erro})` };
    const tree = rodar("git", ["write-tree"], { cwd: raiz, env, timeout: PRAZO_DO_ADD_MS });
    if (tree.erro) return { erro: `git write-tree falhou (${tree.erro})` };
    return { arvore: tree.saida };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Os nomes das variáveis que entram na chave, ordenados. */
export function nomesDoEnv(env = process.env, arvore = carregarConfig(RAIZ).arvore) {
  const prefixos = [...new Set([...arvore.prefixosEnv, "KIT_", "IZANAGI_"])];
  // As variáveis do próprio gate (a trava, o diretório do verde, o desligar do cache) não mudam o que se mede.
  const fora = new Set(prefixos.flatMap((p) => arvore.foraDaChave.map((n) => p + n)));
  return Object.keys(env)
    .filter(
      (n) =>
        env[n] !== undefined &&
        !fora.has(n) &&
        (arvore.prefixosEnv.some((p) => n.startsWith(p)) || arvore.avulsas.includes(n)),
    )
    .sort();
}

/**
 * `banco-postgres`: as versões de migration aplicadas num banco LOCAL (host
 * 127.0.0.1, localhost ou ::1), pelo hash delas ordenadas — ou `"ausente"`. Sem
 * banco, os testes de banco PULAM, e esse verde não pode valer para quem tem
 * banco. Endereço que não é local, porta fechada e `psql` ausente são
 * `"ausente"`, nunca exceção nem espera longa (o `psql` tem prazo de 30 s).
 * Campos: `urlEnv` (variável com a URL), `urlPadrao`, `consulta` (SQL que lista
 * uma versão por linha).
 */
export function impressaoDoBanco(env = process.env, extra = {}) {
  const url = (extra.urlEnv && env[extra.urlEnv]?.trim()) || extra.urlPadrao;
  if (!url) return "ausente";
  let host;
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return "ausente";
  }
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) return "ausente";
  const consulta = extra.consulta ?? "select version from supabase_migrations.schema_migrations";
  const r = rodar("psql", [url, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", consulta], {
    timeout: PRAZO_DO_PSQL_MS,
    env: { ...process.env, PGCONNECT_TIMEOUT: "3" },
  });
  if (r.erro) return "ausente";
  const versoes = r.saida
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .sort();
  return sha256(versoes.join(","));
}

/**
 * `diretorio-executavel`: cada instalação num diretório (um subdiretório por
 * versão) entra pelo seu binário EXECUTAR — não por existir. Instalação que não
 * executa (arquivo sem bit de execução) é outro verde. Campos: `dirEnv`,
 * `dirPadrao` (relativo ao tmpdir se não absoluto), `binario` (relativo a cada
 * instalação, ex. `node_modules/.bin/tailwindcss`).
 */
export function impressaoDoDiretorioExecutavel(env = process.env, extra = {}) {
  const pedido = (extra.dirEnv && env[extra.dirEnv]?.trim()) || extra.dirPadrao;
  if (!pedido || !extra.binario) return "ausente";
  const dir = isAbsolute(pedido) ? pedido : join(tmpdir(), pedido);
  let nomes;
  try {
    nomes = readdirSync(dir).sort();
  } catch {
    return "ausente";
  }
  const instalacoes = nomes.map((nome) => {
    try {
      accessSync(join(dir, nome, extra.binario), constants.X_OK);
      return `${nome}:executa`;
    } catch {
      return `${nome}:não executa`;
    }
  });
  return instalacoes.length === 0 ? "ausente" : sha256(instalacoes.join("\n"));
}

/**
 * `arquivos-gerados`: o conteúdo de arquivos que uma ferramenta gera FORA do
 * git e que o typecheck lê (os tipos do Next em `apps/web/.next*\/types`).
 * Campos: `base` (relativo à raiz), `padraoDir` (regex dos subdiretórios de
 * `base` a varrer), `sub` (subdiretório dentro deles), `ext` (extensão).
 * Nenhum arquivo é `"ausente"`; arquivo que some ou sem permissão no meio da
 * leitura é `ilegível: …` — valor próprio, nunca exceção.
 */
export function impressaoDeArquivosGerados(raiz = RAIZ, extra = {}) {
  if (!extra.base || !extra.padraoDir) return "ausente";
  const base = join(raiz, extra.base);
  const padrao = new RegExp(extra.padraoDir);
  const ext = extra.ext ?? ".ts";
  const arquivos = [];
  const visitar = (dir) => {
    let itens;
    try {
      itens = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of itens) {
      const caminho = join(dir, item.name);
      if (item.isDirectory()) visitar(caminho);
      else if (item.isFile() && item.name.endsWith(ext)) arquivos.push(caminho);
    }
  };
  let raizDaBase;
  try {
    raizDaBase = readdirSync(base, { withFileTypes: true });
  } catch {
    return "ausente";
  }
  for (const item of raizDaBase) {
    if (item.isDirectory() && padrao.test(item.name)) visitar(extra.sub ? join(base, item.name, extra.sub) : join(base, item.name));
  }
  if (arquivos.length === 0) return "ausente";
  const hash = createHash("sha256");
  try {
    for (const caminho of arquivos.sort()) hash.update(`${caminho.slice(base.length)}\0`).update(readFileSync(caminho)).update("\0");
  } catch (e) {
    // O gerador regenerando no meio da leitura dá ENOENT; um arquivo sem permissão, EACCES.
    return `ilegível: ${causa(e)}`;
  }
  return hash.digest("hex");
}

/** A impressão de um `arvore.extras[]` do `kit.json`, pelo seu `tipo`. Tipo desconhecido é erro alto. */
export function impressaoDoExtra(extra, raiz = RAIZ, env = process.env) {
  switch (extra.tipo) {
    case "banco-postgres":
      return impressaoDoBanco(env, extra);
    case "diretorio-executavel":
      return impressaoDoDiretorioExecutavel(env, extra);
    case "arquivos-gerados":
      return impressaoDeArquivosGerados(raiz, extra);
    default:
      throw new Error(`arvore.extras: tipo "${extra.tipo}" desconhecido (${extra.nome}) — use banco-postgres, diretorio-executavel ou arquivos-gerados`);
  }
}

/**
 * Tudo o que decide o desfecho do gate, nesta ordem. Insumo ilegível vira um
 * valor próprio, nunca é omitido: chave que perde um componente calada casa
 * com mais coisa do que devia.
 */
export function insumosDaChave(raiz = RAIZ, env = process.env, cfg = carregarConfig(raiz)) {
  const arvore = arvoreDoWorktree(raiz);
  const ferramenta = ferramentaDe(cfg);
  const versao = rodar(ferramenta, ["--version"], { cwd: raiz });
  const nomes = nomesDoEnv(env, cfg.arvore);
  const dotenv = join(raiz, ".env");
  const extras = {};
  for (const extra of cfg.arvore.extras) extras[extra.nome] = impressaoDoExtra(extra, raiz, env);
  return {
    arvore: arvore.arvore ?? `ilegível: ${arvore.erro}`,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      ferramenta: versao.saida !== null ? `${ferramenta} ${versao.saida}` : `ilegível: ${versao.erro}`,
    },
    env: sha256(nomes.map((n) => `${n}=${env[n]}`).join("\n")),
    envNomes: nomes,
    dotenv: existsSync(dotenv) ? sha256(readFileSync(dotenv)) : "ausente",
    ...extras,
  };
}

/** O gerenciador cuja versão entra na chave: `pnpm` no perfil pnpm-workspace; senão o primeiro termo do `comandoCompleto`. */
function ferramentaDe(cfg) {
  if (cfg.gate.perfil === "pnpm-workspace") return "pnpm";
  return cfg.gate.comandoCompleto ? partirComando(cfg.gate.comandoCompleto)[0] : "node";
}

/**
 * Por que estes insumos não guardam nem acham verde, ou `null`. Árvore ou
 * runtime ilegível viraria uma chave CONSTANTE — a mesma mensagem de erro para
 * qualquer conteúdo — e casaria com tudo: é o contrário do que o "ilegível"
 * existe para fazer.
 */
export function recusaDoCache(insumos) {
  if (insumos.arvore.startsWith("ilegível")) return `a árvore não foi lida (${insumos.arvore.slice("ilegível: ".length)})`;
  if (insumos.runtime.ferramenta.startsWith("ilegível")) return `a versão do gerenciador não foi lida (${insumos.runtime.ferramenta.slice("ilegível: ".length)})`;
  return null;
}

/** A chave: o hash dos insumos, sem a lista de nomes (que já está no hash do `env`). */
export function chaveDe(insumos) {
  const { envNomes: _nomes, ...resto } = insumos;
  return sha256(JSON.stringify(resto));
}

/** Os nomes dos insumos que diferem entre duas leituras (o runtime por campo). */
export function insumosQueDiferem(a, b) {
  // Os campos saem dos próprios insumos, nunca de uma lista à parte: insumo
  // novo em `insumosDaChave` aparece aqui sem ninguém lembrar.
  const campos = (x, y) => [...new Set([...Object.keys(x ?? {}), ...Object.keys(y ?? {})])].sort();
  const nomes = [];
  for (const nome of campos(a, b)) {
    if (nome === "envNomes") continue;
    if (nome === "runtime") {
      for (const campo of campos(a?.runtime, b?.runtime)) {
        if (a?.runtime?.[campo] !== b?.runtime?.[campo]) nomes.push(`runtime.${campo}`);
      }
    } else if (a?.[nome] !== b?.[nome]) {
      nomes.push(nome === "env" ? `env (${diferencaDeNomes(a?.envNomes, b?.envNomes)})` : nome);
    }
  }
  return nomes;
}

/** As variáveis que só uma das leituras tem — ou "mesmos nomes, outro valor". Só nomes, nunca valor. */
function diferencaDeNomes(listaA, listaB) {
  // Registro corrompido não derruba a consulta.
  const a = Array.isArray(listaA) ? listaA : [];
  const b = Array.isArray(listaB) ? listaB : [];
  const so = (x, y) => x.filter((n) => !y.includes(n));
  const partes = [];
  if (so(a, b).length) partes.push(`só no verde: ${so(a, b).join(", ")}`);
  if (so(b, a).length) partes.push(`só agora: ${so(b, a).join(", ")}`);
  return partes.join("; ") || "mesmos nomes, outro valor";
}

/** Os registros válidos da mesma etapa e da mesma árvore, com qualquer chave — para dizer o que difere. */
export function verdesDaMesmaArvore(dir, etapa, arvore, agora = Date.now()) {
  let nomes;
  try {
    nomes = readdirSync(dir).filter((n) => n.startsWith(`${etapa}-`) && n.endsWith(".json"));
  } catch {
    return [];
  }
  const achados = [];
  for (const nome of nomes) {
    const r = procurarVerde(dir, etapa, nome.slice(etapa.length + 1, -".json".length), agora);
    if (r && r.arvore === arvore) achados.push(r);
  }
  return achados;
}

/** Roda `git` e devolve a saída, ou o motivo entre parênteses. */
function gitOuMotivo(args, raiz) {
  const r = rodar("git", args, { cwd: raiz });
  return r.saida ?? `(ilegível: ${r.erro})`;
}

/**
 * Onde mora o registro: `KIT_GATE_VERDE_DIR` (ou o legado `IZANAGI_`), senão o diretório comum do
 * git (o mesmo da trava, um só para todos os worktrees), senão `os.tmpdir()`
 * — e aí devolve o aviso.
 */
export function dirDoVerde(env = process.env, raiz = RAIZ, cfg = carregarConfig(raiz)) {
  const nome = cfg.gate.verdeDir;
  const pedido = envKit(env, "GATE_VERDE_DIR");
  if (pedido) return { dir: pedido, aviso: null };
  const r = rodar("git", ["rev-parse", "--git-common-dir"], { cwd: raiz });
  if (r.saida) return { dir: join(isAbsolute(r.saida) ? r.saida : join(raiz, r.saida), nome), aviso: null };
  return {
    dir: join(tmpdir(), nome),
    aviso: `não li o diretório comum do git (${r.erro}); o verde fica em ${tmpdir()}, que só vale para quem tem o mesmo $TMPDIR`,
  };
}

const arquivoDo = (dir, etapa, chave) => join(dir, `${etapa}-${chave}.json`);

/** O registro da mesma etapa e chave dentro do prazo, ou `null`. Registro ilegível é `null`, nunca exceção. */
export function procurarVerde(dir, etapa, chave, agora = Date.now(), prazoMs = PRAZO_DO_VERDE_MS) {
  let registro;
  try {
    registro = JSON.parse(readFileSync(arquivoDo(dir, etapa, chave), "utf-8"));
  } catch {
    return null;
  }
  if (!registro || typeof registro !== "object") return null;
  if (registro.formato !== FORMATO || registro.etapa !== etapa || registro.chave !== chave) return null;
  const quando = Date.parse(registro.quando);
  if (!Number.isFinite(quando) || agora - quando > prazoMs) return null;
  return registro;
}

/** Grava o registro (escrita atômica) e apaga os mais velhos que a retenção. */
export function gravarVerde(dir, registro, agora = Date.now(), retencaoMs = RETENCAO_MS) {
  mkdirSync(dir, { recursive: true });
  const destino = arquivoDo(dir, registro.etapa, registro.chave);
  const temporario = `${destino}.${process.pid}.tmp`;
  writeFileSync(temporario, `${JSON.stringify({ formato: FORMATO, ...registro }, null, 2)}\n`);
  renameSync(temporario, destino);
  for (const nome of readdirSync(dir)) {
    // O rascunho de uma gravação interrompida (`.tmp`) também envelhece e sai.
    if (!nome.endsWith(".json") && !nome.endsWith(".tmp")) continue;
    const caminho = join(dir, nome);
    try {
      if (agora - statSync(caminho).mtimeMs > retencaoMs) unlinkSync(caminho);
    } catch {
      /* outro gate apagou primeiro */
    }
  }
  return destino;
}

/** O registro de um verde que acabou de passar, com quem passou e onde. */
export function registroDe(etapa, insumos, duracaoMs, raiz = RAIZ, agora = Date.now()) {
  return {
    formato: FORMATO,
    etapa,
    chave: chaveDe(insumos),
    arvore: insumos.arvore,
    head: gitOuMotivo(["rev-parse", "--short", "HEAD"], raiz),
    branch: gitOuMotivo(["rev-parse", "--abbrev-ref", "HEAD"], raiz),
    worktree: raiz,
    quando: new Date(agora).toISOString(),
    duracaoMs,
    insumos,
  };
}

/** A linha do pulo: nunca "verde" sem a árvore, o quando e o onde. */
export function linhaDoPulo(registro) {
  const { arvore, etapa, quando, worktree, branch, head, duracaoMs } = registro;
  return (
    `[gate] verde guardado: a árvore ${arvore} passou o \`${etapa}\` em ${quando} ` +
    `(${worktree}, ${branch} @ ${head}, ${Math.round(duracaoMs / 1000)} s) — pulando. KIT_GATE_SEM_CACHE=1 mede de novo.`
  );
}

/** `KIT_GATE_SEM_CACHE=1` (ou o legado `IZANAGI_`) mede de novo e regrava. */
export const semCache = (env = process.env) => envKit(env, "GATE_SEM_CACHE") === "1";

/**
 * Consulta o verde da árvore atual para uma etapa: `{ insumos, chave, dir,
 * registro }` — `registro` `null` quando não passou (ou quando o cache foi
 * desligado). Quem chama decide o que dizer.
 */
export function consultar(etapa, raiz = RAIZ, env = process.env, avisar = (msg) => console.error(msg), cfg = carregarConfig(raiz)) {
  const insumos = insumosDaChave(raiz, env, cfg);
  const chave = chaveDe(insumos);
  const { dir, aviso } = dirDoVerde(env, raiz, cfg);
  if (aviso) avisar(`[gate] ${aviso}`);
  const recusa = recusaDoCache(insumos);
  const registro = recusa !== null || semCache(env) ? null : procurarVerde(dir, etapa, chave, Date.now(), cfg.gate.prazos.verdeHoras * 3_600_000);
  return { insumos, chave, dir, recusa, registro };
}

/**
 * Depois de uma etapa verde: recalcula a chave e grava — só se a árvore não
 * mudou durante a medida. Falha ao gravar só avisa; nunca muda o desfecho.
 */
export function guardarSeAArvoreNaoMudou(etapa, antes, inicioMs, raiz = RAIZ, env = process.env, avisar = (msg) => console.error(msg), cfg = carregarConfig(raiz)) {
  try {
    const depois = insumosDaChave(raiz, env, cfg);
    const recusa = recusaDoCache(depois);
    if (recusa !== null) {
      avisar(`[gate] o verde NÃO foi guardado: ${recusa}`);
      return false;
    }
    if (chaveDe(depois) !== antes.chave) {
      const mudou =
        depois.arvore !== antes.insumos.arvore
          ? `${antes.insumos.arvore} → ${depois.arvore}`
          : `a árvore é a mesma; mudou: ${insumosQueDiferem(antes.insumos, depois).join(", ")}`;
      avisar(`[gate] a árvore mudou durante o gate (${mudou}) — o verde NÃO foi guardado`);
      return false;
    }
    gravarVerde(antes.dir, registroDe(etapa, depois, Date.now() - inicioMs, raiz), Date.now(), cfg.gate.prazos.retencaoDias * 86_400_000);
    avisar(`[gate] verde guardado para a árvore ${depois.arvore}`);
    return true;
  } catch (e) {
    avisar(`[gate] não consegui guardar o verde (${causa(e)}) — o desfecho do gate não muda`);
    return false;
  }
}

const presenca = (valor) => (valor === "ausente" ? "ausente" : "presente");

/** A consulta direta: o que a árvore atual já passou. 0 se as duas etapas passaram, 1 senão. */
export function main(raiz = RAIZ, env = process.env, cfg = carregarConfig(raiz)) {
  const insumos = insumosDaChave(raiz, env, cfg);
  const chave = chaveDe(insumos);
  const { dir, aviso } = dirDoVerde(env, raiz, cfg);
  const prazoMs = cfg.gate.prazos.verdeHoras * 3_600_000;
  if (aviso) console.error(`[verde] ${aviso}`);
  console.log(`árvore: ${insumos.arvore}`);
  console.log(`chave: ${chave}`);
  const recusa = recusaDoCache(insumos);
  if (recusa !== null) console.log(`sem verde possível: ${recusa}`);
  let todas = true;
  for (const etapa of ETAPAS) {
    const r = recusa === null ? procurarVerde(dir, etapa, chave, Date.now(), prazoMs) : null;
    if (r) console.log(`${etapa}: passou em ${r.quando} (${r.worktree}, ${r.branch} @ ${r.head})`);
    else {
      console.log(`${etapa}: não passou nas últimas ${cfg.gate.prazos.verdeHoras} h`);
      // A mesma árvore com outra chave: diga o QUE difere, senão quem valida
      // roda o gate inteiro de novo achando que a árvore nunca passou.
      if (recusa === null) {
        for (const outro of verdesDaMesmaArvore(dir, etapa, insumos.arvore)) {
          console.log(`  a mesma árvore passou em ${outro.quando} (${outro.worktree}) com outro: ${insumosQueDiferem(outro.insumos, insumos).join(", ")}`);
        }
      }
      todas = false;
    }
  }
  console.log(`variáveis na chave: ${insumos.envNomes.join(", ") || "(nenhuma)"}`);
  const presencas = [...cfg.arvore.extras.map((e) => `${e.nome}: ${presenca(insumos[e.nome])}`), `.env: ${presenca(insumos.dotenv)}`];
  console.log(presencas.join(" · "));
  return todas ? 0 : 1;
}

// Pelo caminho REAL dos dois lados; `exitCode`, nunca `process.exit()` .
rodarSePrincipal(import.meta.url, () => main(), "[verde]");
