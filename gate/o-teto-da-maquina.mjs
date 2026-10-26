#!/usr/bin/env node
/**
 * **O teto de núcleos da máquina para todos os testes** (ADR 0005, operador, 26/10).
 *
 * O Mac travou com testes de várias sessões e de vários projetos rodando juntos. A fila do gate é por
 * repositório e nada soma; aqui mora o que soma: um conjunto de **fichas**, uma por núcleo de teste, numa
 * pasta da máquina (`~/.claude/orquestracao/nucleos-de-teste`, ou `KIT_NUCLEOS_DIR`). A ficha k (de 1 ao
 * teto) é o arquivo `<pasta>/<k>`, criado com `openSync(…, 'wx')`, com `{pid, token, worktree, projeto, desde}`.
 * O contrato é o mesmo do ADR 0400 do Izanagi (arquivo `<k>`, PID dono): os dois projetos dividem as fichas.
 *
 * **O valor.** Em ordem: `KIT_NUCLEOS_DE_TESTE` (ou o legado `IZANAGI_NUCLEOS_DE_TESTE`); o arquivo
 * `<pasta>/teto.json` `{"nucleos": N}`; metade dos núcleos, no mínimo 1. No CI não há teto (`null`).
 *
 * **Quem toma.** Pede `quero`, leva o que houver livre (no mínimo 1) e só espera quando não há nenhuma,
 * dizendo por quem a cada minuto. A ficha de PID morto volta ao teto; a ilegível há mais de 30 s também.
 * Não há prazo de vez: o vitest em modo watch segura a ficha de propósito.
 *
 * Linha de comando: sem argumento imprime o estado; `--teto N` grava o `teto.json`; `--teto padrao` o apaga.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { availableParallelism, homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { envKit } from "./config.mjs";
import { rodarSePrincipal } from "./o-script-principal.mjs";

/** Ficha ilegível (alguém no meio da escrita, ou lixo) mais velha que isto é tratada como abandonada. */
const ILEGIVEL_ABANDONADA_MS = 30_000;

/** `true` se o PID existe. `EPERM` é processo vivo de outro usuário — vivo. (Mora aqui; o gate o reexporta.) */
export function processoVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e?.code === "EPERM";
  }
}

/** A pasta das fichas: `KIT_NUCLEOS_DIR` (os testes), senão a da máquina. */
export function pastaDoTeto(env = process.env) {
  const pedida = env["KIT_NUCLEOS_DIR"];
  if (pedida) return pedida;
  return join(homedir(), ".claude", "orquestracao", "nucleos-de-teste");
}

const inteiroPositivo = (n) => Number.isInteger(n) && n >= 1;

/**
 * O teto: `null` no CI; senão a env, o `<pasta>/teto.json` ou metade dos núcleos (mínimo 1). Valor inválido
 * é erro alto que cita a variável ou o arquivo.
 */
export function tetoDaMaquina(env = process.env, nucleos = availableParallelism(), pasta = pastaDoTeto(env)) {
  if (env["CI"]) return null;
  const pedido = envKit(env, "NUCLEOS_DE_TESTE");
  if (pedido !== undefined) {
    const n = Number(pedido);
    if (!inteiroPositivo(n)) throw new Error(`KIT_NUCLEOS_DE_TESTE precisa ser inteiro ≥ 1, e veio ${JSON.stringify(pedido)}`);
    return n;
  }
  const arquivo = join(pasta, "teto.json");
  let texto = null;
  try {
    texto = readFileSync(arquivo, "utf-8");
  } catch (e) {
    if (e?.code !== "ENOENT") throw new Error(`${arquivo} ilegível: ${e.message}`);
  }
  if (texto !== null) {
    let n;
    try {
      n = JSON.parse(texto)?.nucleos;
    } catch (e) {
      throw new Error(`${arquivo} ilegível: ${e.message}`);
    }
    if (!inteiroPositivo(n)) throw new Error(`${arquivo}: "nucleos" precisa ser inteiro ≥ 1, e veio ${JSON.stringify(n)}`);
    return n;
  }
  return Math.max(1, Math.floor(nucleos / 2));
}

/** Quem toma as fichas: o que vai escrito nelas, para quem espera saber por quem. */
export function quemSouEuNasFichas(cwd = process.cwd()) {
  let projeto = basename(cwd);
  const r = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, encoding: "utf-8", timeout: 3_000, killSignal: "SIGKILL" });
  const comum = r.status === 0 ? String(r.stdout).trim() : "";
  if (comum) projeto = basename(dirname(comum));
  return { pid: process.pid, token: randomUUID(), worktree: cwd, projeto, desde: new Date().toISOString() };
}

/** Lê uma ficha: `null` se não existe; `{ texto, dono }` com `dono` `null` quando não é legível (JSON com `pid` inteiro). */
function lerFicha(caminho) {
  let texto;
  try {
    texto = readFileSync(caminho, "utf-8");
  } catch (e) {
    if (e?.code === "ENOENT") return null;
    throw e;
  }
  try {
    const dono = JSON.parse(texto);
    return { texto, dono: dono && Number.isInteger(dono.pid) ? dono : null };
  } catch {
    return { texto, dono: null };
  }
}

/** Por que a ficha pode ser retomada — ou `null` se o dono dela vale. */
function motivoParaRetomar(caminho, lida, agora, ilegivelMs) {
  if (lida.dono === null) {
    let idade = 0;
    try {
      idade = agora - statSync(caminho).mtimeMs;
    } catch {
      return null; // sumiu entre ler e medir: a próxima tentativa decide
    }
    return idade > ilegivelMs ? `ilegível há mais de ${Math.round(ilegivelMs / 1000)} s` : null;
  }
  return processoVivo(lida.dono.pid) ? null : `o PID ${lida.dono.pid} não está vivo`;
}

/** Tenta a ficha k: `{ tomou: true }` ou `{ tomou: false, dono }` (`dono` `null` = sendo escrita). */
function tentarFicha(caminho, eu, agora, ilegivelMs, avisar) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const fd = openSync(caminho, "wx");
      try {
        writeFileSync(fd, JSON.stringify(eu));
      } finally {
        closeSync(fd);
      }
      return { tomou: true };
    } catch (e) {
      if (e?.code !== "EEXIST") throw e;
    }
    const lida = lerFicha(caminho);
    if (lida === null) continue; // soltaram entre o `wx` e a leitura
    const motivo = motivoParaRetomar(caminho, lida, agora, ilegivelMs);
    if (motivo === null) return { tomou: false, dono: lida.dono };
    // Apaga só se ainda é a MESMA ficha que foi julgada. A janela que sobra, como na trava do gate, termina em duas
    // fichas para o mesmo núcleo — o mundo sem este arquivo —, nunca em ficha presa para sempre.
    const deNovo = lerFicha(caminho);
    if (deNovo !== null && deNovo.texto === lida.texto) {
      try {
        unlinkSync(caminho);
      } catch (e) {
        if (e?.code !== "ENOENT") throw e;
      }
      avisar(`[teto] retomando a ficha ${basename(caminho)}: ${motivo}`);
    }
  }
  const lida = lerFicha(caminho);
  return { tomou: false, dono: lida?.dono ?? null };
}

/**
 * Uma tentativa de tomar até `quero` das `teto` fichas: `{ levou: [k…], donos }`. Leva o que houver livre; `donos` são
 * os das fichas ocupadas (um pode ser `null`: ficha sendo escrita).
 */
export function tentarTomarFichas(pasta, teto, quero, eu, opcoes = {}) {
  const { agora = Date.now(), ilegivelMs = ILEGIVEL_ABANDONADA_MS, avisar = (m) => console.error(m) } = opcoes;
  mkdirSync(pasta, { recursive: true });
  const levou = [];
  const donos = [];
  for (let k = 1; k <= teto && levou.length < quero; k++) {
    const r = tentarFicha(join(pasta, String(k)), eu, agora, ilegivelMs, avisar);
    if (r.tomou) levou.push(k);
    else donos.push(r.dono);
  }
  return { levou, donos };
}

/** Solta as fichas `ks` — só as que ainda são minhas (mesmo `pid` e `token`). Devolve as que soltou. */
export function soltarFichas(pasta, ks, eu) {
  const soltas = [];
  for (const k of ks) {
    const caminho = join(pasta, String(k));
    const lida = lerFicha(caminho);
    if (lida === null || lida.dono === null) continue;
    if (lida.dono.pid !== eu.pid || lida.dono.token !== eu.token) continue;
    try {
      unlinkSync(caminho);
      soltas.push(k);
    } catch (e) {
      if (e?.code !== "ENOENT") throw e;
    }
  }
  return soltas;
}

/** O estado do teto: `{ teto, tomadas: [{ k, dono }], livres }`, contando só ficha viva (ou ilegível recente). */
export function estadoDoTeto(pasta, teto, agora = Date.now(), ilegivelMs = ILEGIVEL_ABANDONADA_MS) {
  const tomadas = [];
  let nomes = [];
  try {
    nomes = readdirSync(pasta);
  } catch (e) {
    if (e?.code !== "ENOENT") throw e;
  }
  for (const nome of nomes) {
    if (!/^[1-9]\d*$/.test(nome)) continue;
    const caminho = join(pasta, nome);
    const lida = lerFicha(caminho);
    if (lida === null || motivoParaRetomar(caminho, lida, agora, ilegivelMs) !== null) continue;
    tomadas.push({ k: Number(nome), dono: lida.dono });
  }
  tomadas.sort((a, b) => a.k - b.k);
  return { teto, tomadas, livres: Math.max(0, teto - tomadas.length) };
}

const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "?");

/** Por quem se espera: worktree e PID de cada dono. */
const descrever = (dono) => (dono ? `${dono.worktree ?? dono.cwd ?? "?"}${dono.projeto ? ` (${dono.projeto})` : ""}, PID ${dono.pid}, desde ${hora(dono.desde)}` : "dono ilegível");

/** Os `donos` de uma tentativa, sem repetir o mesmo PID. */
function quemSegura(donos) {
  const vistos = new Set();
  const linhas = [];
  for (const d of donos) {
    const chave = d ? `${d.pid}:${d.worktree ?? d.cwd}` : "?";
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    linhas.push(descrever(d));
  }
  return linhas.join(" | ");
}

/**
 * Toma as fichas, esperando se não houver nenhuma: devolve os `k` que levou (1 a `quero`). Avisa por quem espera ao
 * começar e a cada `avisoMs`. `dormir`, `agora` e `avisar` são injetáveis para o teste não depender de relógio.
 */
export async function tomarFichas(opcoes) {
  const {
    quero,
    pasta,
    teto,
    eu = quemSouEuNasFichas(),
    intervaloMs = 2_000,
    avisoMs = 60_000,
    dormir = (ms) => new Promise((r) => setTimeout(r, ms)),
    agora = () => Date.now(),
    avisar = (m) => console.error(m),
  } = opcoes;
  const inicio = agora();
  let ultimoAviso = null;
  for (;;) {
    const r = tentarTomarFichas(pasta, teto, quero, eu, { agora: agora(), avisar });
    if (r.levou.length > 0) {
      if (ultimoAviso !== null) avisar(`[teto] as fichas chegaram depois de ${Math.round((agora() - inicio) / 1000)} s: ${r.levou.length} de ${quero}`);
      return r.levou;
    }
    if (ultimoAviso === null) {
      avisar(`[teto] esperando fichas — as ${teto} do teto da máquina estão tomadas por: ${quemSegura(r.donos)}`);
      ultimoAviso = agora();
    } else if (agora() - ultimoAviso >= avisoMs) {
      avisar(`[teto] ainda esperando fichas (${Math.round((agora() - inicio) / 60_000)} min) — ${quemSegura(r.donos)}`);
      ultimoAviso = agora();
    }
    await dormir(intervaloMs);
  }
}

/** Dorme `ms` sem ocupar a CPU: `Atomics.wait` num `SharedArrayBuffer` que ninguém acorda. */
const dormirSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * {@link tomarFichas} síncrona, para quem não pode esperar uma promessa (o `vitest.config`, o typecheck). `limiteMs`
 * existe para o teste: passado esse tempo sem ficha, devolve `[]` em vez de esperar para sempre.
 */
export function tomarFichasSync(opcoes) {
  const {
    quero,
    pasta,
    teto,
    eu = quemSouEuNasFichas(),
    intervaloMs = 2_000,
    avisoMs = 60_000,
    dormir = dormirSync,
    agora = () => Date.now(),
    avisar = (m) => console.error(m),
    limiteMs = Infinity,
  } = opcoes;
  const inicio = agora();
  let ultimoAviso = null;
  for (;;) {
    const r = tentarTomarFichas(pasta, teto, quero, eu, { agora: agora(), avisar });
    if (r.levou.length > 0) {
      if (ultimoAviso !== null) avisar(`[teto] as fichas chegaram depois de ${Math.round((agora() - inicio) / 1000)} s: ${r.levou.length} de ${quero}`);
      return r.levou;
    }
    if (ultimoAviso === null) {
      avisar(`[teto] esperando fichas — as ${teto} do teto da máquina estão tomadas por: ${quemSegura(r.donos)}`);
      ultimoAviso = agora();
    } else if (agora() - ultimoAviso >= avisoMs) {
      avisar(`[teto] ainda esperando fichas (${Math.round((agora() - inicio) / 60_000)} min) — ${quemSegura(r.donos)}`);
      ultimoAviso = agora();
    }
    if (agora() - inicio >= limiteMs) return [];
    dormir(intervaloMs);
  }
}

/** A linha de comando: estado, `--teto N`, `--teto padrao`. Devolve o código de saída. */
export function main(env = process.env, argv = process.argv.slice(2)) {
  const pasta = pastaDoTeto(env);
  const i = argv.indexOf("--teto");
  if (i !== -1) {
    const valor = argv[i + 1];
    const arquivo = join(pasta, "teto.json");
    if (valor === "padrao") {
      try {
        unlinkSync(arquivo);
      } catch (e) {
        if (e?.code !== "ENOENT") throw e;
      }
      console.log(`teto.json apagado: vale o padrão (metade dos núcleos)`);
      return 0;
    }
    const n = Number(valor);
    if (!inteiroPositivo(n)) {
      console.error(`[teto] --teto precisa de um inteiro ≥ 1 ou "padrao", e veio ${JSON.stringify(valor)}`);
      return 2;
    }
    mkdirSync(pasta, { recursive: true });
    writeFileSync(arquivo, JSON.stringify({ nucleos: n }));
    console.log(`teto.json gravado em ${arquivo}: ${n} núcleos`);
    return 0;
  }
  const teto = tetoDaMaquina(env, availableParallelism(), pasta);
  if (teto === null) {
    console.log("CI: sem teto");
    return 0;
  }
  const e = estadoDoTeto(pasta, teto);
  console.log(`teto ${e.teto} · tomadas ${e.tomadas.length} · livres ${e.livres}`);
  for (const { k, dono } of e.tomadas) {
    console.log(`  ${k} · ${dono?.projeto ?? "?"} · ${dono?.worktree ?? dono?.cwd ?? "?"} · PID ${dono?.pid ?? "?"} · desde ${hora(dono?.desde)}`);
  }
  return 0;
}

// Pelo caminho REAL dos dois lados; `exitCode`, nunca `process.exit()`.
rodarSePrincipal(import.meta.url, () => main(), "[teto]");
