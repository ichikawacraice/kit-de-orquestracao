#!/usr/bin/env node
/**
 * **O teto de núcleos da máquina para todos os testes** (ADR 0005, operador, 26/10).
 *
 * O Mac travou com testes de várias sessões e de vários projetos rodando juntos. A fila do gate é por
 * repositório e nada soma; aqui mora o que soma: um conjunto de **fichas**, uma por núcleo de teste, numa
 * pasta da máquina (`~/.claude/orquestracao/nucleos-de-teste`, ou `KIT_NUCLEOS_DIR`). A ficha k (de 1 ao
 * teto) é o arquivo `<pasta>/<k>`, criado com `openSync(…, 'wx')`, com `{pid, token, worktree, projeto, desde}`.
 *
 * **O valor** (ADR 0008, operador, 26/10: o teto é fração dos núcleos). Em ordem: `KIT_NUCLEOS_DE_TESTE`, absoluto; `KIT_FRACAO_DE_TESTE`; o arquivo `<pasta>/teto.json` com `{"nucleos": N}` (absoluto,
 * vence) ou `{"fracao": f}`; 2/3 dos núcleos (`floor`, mínimo 1). No CI não há teto (`null`).
 *
 * **Duas faixas** (ADR 0008). Faixa do gate: fichas `1..G`, G = floor(T × 0,7) (`KIT_FRACAO_DO_GATE`); faixa normal:
 * `G+1..T`. O gate completo toma só da faixa dele, depois de tomar a **vez do gate da máquina** (`<pasta>/gate`, um por vez,
 * de qualquer projeto); o teste normal toma de `T` para baixo e, sem gate rodando, **empresta** da faixa do gate (ficha marcada
 * `"emprestada": true`), sem nunca passar do que pediu.
 *
 * **Quem toma.** Pede `quero`, leva o que houver livre (no mínimo 1) e só espera quando não há nenhuma,
 * dizendo por quem a cada minuto. A ficha de PID morto volta ao teto; a ilegível há mais de 30 s também.
 * Não há prazo de vez: o vitest em modo watch segura a ficha de propósito.
 *
 * Linha de comando: sem argumento imprime o estado e as duas faixas; `--teto N` grava o `teto.json` (e avisa que número fixo não acompanha
 * a máquina); `--fracao f` grava `{"fracao": f}`; `--teto padrao` o apaga.
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

/** A fração padrão dos núcleos para teste (ADR 0008: 10 em 15) e a do teto que vai para o gate. O plugin repete estes números (um teste compara). */
export const FRACAO_PADRAO_DE_TESTE = 2 / 3;
export const FRACAO_PADRAO_DO_GATE = 0.7;
/** O nome da vez do gate da máquina dentro da pasta das fichas (não casa com `^[1-9]\d*$`: nunca é ficha). */
export const NOME_DA_VEZ_DO_GATE = "gate";

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

/** Uma fração em `(0, 1]` (ou `(0, 1)` com `aberta`): o número, ou `null` se não vale. */
function fracaoValida(valor, aberta = false) {
  if (valor === null || valor === undefined || valor === "" || typeof valor === "boolean") return null;
  const f = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(f) || f <= 0 || f > 1 || (aberta && f >= 1)) return null;
  return f;
}

/**
 * O teto: `null` no CI; senão a env absoluta, `KIT_FRACAO_DE_TESTE`, o `<pasta>/teto.json` (`nucleos` vence `fracao`) ou 2/3 dos
 * núcleos (`floor`, mínimo 1). Valor inválido é erro alto que cita a variável ou o arquivo.
 */
export function tetoDaMaquina(env = process.env, nucleos = availableParallelism(), pasta = pastaDoTeto(env)) {
  if (env["CI"]) return null;
  const pedido = envKit(env, "NUCLEOS_DE_TESTE");
  if (pedido !== undefined) {
    const n = Number(pedido);
    if (!inteiroPositivo(n)) throw new Error(`KIT_NUCLEOS_DE_TESTE precisa ser inteiro ≥ 1, e veio ${JSON.stringify(pedido)}`);
    return n;
  }
  const dosNucleos = (f) => Math.max(1, Math.floor(nucleos * f));
  const fracaoPedida = env["KIT_FRACAO_DE_TESTE"];
  const arquivo = join(pasta, "teto.json");
  let texto = null;
  try {
    texto = readFileSync(arquivo, "utf-8");
  } catch (e) {
    if (e?.code !== "ENOENT") throw new Error(`${arquivo} ilegível: ${e.message}`);
  }
  let json = null;
  if (texto !== null) {
    try {
      json = JSON.parse(texto);
    } catch (e) {
      throw new Error(`${arquivo} ilegível: ${e.message}`);
    }
  }
  // A env de fração vence o arquivo; validada mesmo quando o arquivo traria `nucleos`? Não: o absoluto do arquivo só perde para a env.
  if (fracaoPedida !== undefined && fracaoPedida !== "") {
    const f = fracaoValida(fracaoPedida);
    if (f === null) throw new Error(`KIT_FRACAO_DE_TESTE precisa ser um número em (0, 1], e veio ${JSON.stringify(fracaoPedida)}`);
    return dosNucleos(f);
  }
  if (json !== null && json?.nucleos !== undefined) {
    if (!inteiroPositivo(json.nucleos)) throw new Error(`${arquivo}: "nucleos" precisa ser inteiro ≥ 1, e veio ${JSON.stringify(json.nucleos)}`);
    return json.nucleos;
  }
  if (json !== null && json?.fracao !== undefined) {
    const f = fracaoValida(json.fracao);
    if (f === null) throw new Error(`${arquivo}: "fracao" precisa ser um número em (0, 1], e veio ${JSON.stringify(json.fracao)}`);
    return dosNucleos(f);
  }
  if (json !== null && !(json && typeof json === "object")) throw new Error(`${arquivo}: precisa ser um objeto com "nucleos" ou "fracao"`);
  return dosNucleos(FRACAO_PADRAO_DE_TESTE);
}

/**
 * As duas faixas do teto `T` (ADR 0008): `{ gate: G, normal: T − G, compartilhada }`. G = floor(T × fração do gate), com ao menos 1 em
 * cada faixa quando T ≥ 2. T = 1: as duas faixas são a mesma ficha (`compartilhada: true`). Faixa do gate = fichas `1..G`; normal = `G+1..T`
 * (com `compartilhada`, a ficha 1).
 */
export function faixas(teto, env = process.env) {
  const pedida = env["KIT_FRACAO_DO_GATE"];
  let f = FRACAO_PADRAO_DO_GATE;
  if (pedida !== undefined && pedida !== "") {
    f = fracaoValida(pedida, true);
    if (f === null) throw new Error(`KIT_FRACAO_DO_GATE precisa ser um número em (0, 1), e veio ${JSON.stringify(pedida)}`);
  }
  if (teto <= 1) return { gate: 1, normal: 1, compartilhada: true };
  const gate = Math.min(teto - 1, Math.max(1, Math.floor(teto * f)));
  return { gate, normal: teto - gate, compartilhada: false };
}

/** Os `k` da faixa normal, na ordem em que o teste normal tenta: de `T` para baixo. */
const ordemNormal = (teto, f) => (f.compartilhada ? [1] : Array.from({ length: f.normal }, (_, i) => teto - i));
/** Os `k` da faixa do gate emprestáveis, de `G` para baixo (o gate toma de 1 para cima: os dois se encontram o mais tarde possível). */
const ordemEmprestada = (f) => Array.from({ length: f.gate }, (_, i) => f.gate - i);

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
  const { agora = Date.now(), ilegivelMs = ILEGIVEL_ABANDONADA_MS, avisar = (m) => console.error(m), emprestadas = new Set() } = opcoes;
  const ordem = opcoes.ordem ?? Array.from({ length: teto }, (_, i) => i + 1);
  mkdirSync(pasta, { recursive: true });
  const levou = [];
  const donos = [];
  for (const k of ordem) {
    if (levou.length >= quero) break;
    const r = tentarFicha(join(pasta, String(k)), emprestadas.has(k) ? { ...eu, emprestada: true } : eu, agora, ilegivelMs, avisar);
    if (r.tomou) levou.push(k);
    else donos.push(r.dono);
  }
  return { levou, donos };
}

/** O dono vivo da vez do gate da máquina (`<pasta>/gate`), ou `null` sem ela, com PID morto ou ilegível há mais de `ilegivelMs`. */
export function donoDoGate(pasta, agora = Date.now(), ilegivelMs = ILEGIVEL_ABANDONADA_MS) {
  const caminho = join(pasta, NOME_DA_VEZ_DO_GATE);
  const lida = lerFicha(caminho);
  if (lida === null || motivoParaRetomar(caminho, lida, agora, ilegivelMs) !== null) return null;
  return lida.dono ?? { pid: null };
}

/** Uma tentativa de tomar a vez do gate da máquina: `{ tomou: true }` ou `{ tomou: false, dono }`. Mesmo contrato da ficha (`wx`, PID morto retomado). */
export function tentarAVezDoGate(pasta, eu, opcoes = {}) {
  const { agora = Date.now(), ilegivelMs = ILEGIVEL_ABANDONADA_MS, avisar = (m) => console.error(m) } = opcoes;
  mkdirSync(pasta, { recursive: true });
  return tentarFicha(join(pasta, NOME_DA_VEZ_DO_GATE), eu, agora, ilegivelMs, avisar);
}

/** Solta a vez do gate da máquina — só se `pid` e `token` são os de `eu`. Devolve se soltou. */
export function soltarAVezDoGate(pasta, eu) {
  return soltarFichas(pasta, [NOME_DA_VEZ_DO_GATE], eu).length > 0;
}

/**
 * Uma tentativa do teste normal: a faixa normal de `T` para baixo; depois, só se não há gate rodando, a faixa do gate de `G` para baixo
 * como empréstimo (marcada `emprestada`). Nunca leva mais que `quero`: o empréstimo faz caber mais testes juntos, não um teste maior.
 */
export function tentarTomarFichasNormais(pasta, teto, quero, eu, opcoes = {}) {
  const { agora = Date.now(), ilegivelMs = ILEGIVEL_ABANDONADA_MS, env = process.env } = opcoes;
  const f = faixas(teto, env);
  const ordemDoNormal = ordemNormal(teto, f);
  const gateRodando = f.compartilhada ? null : donoDoGate(pasta, agora, ilegivelMs);
  const emprestadas = f.compartilhada || gateRodando !== null ? [] : ordemEmprestada(f);
  const { env: _, ...resto } = opcoes;
  return tentarTomarFichas(pasta, teto, quero, eu, { ...resto, ordem: [...ordemDoNormal, ...emprestadas], emprestadas: new Set(emprestadas) });
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

/**
 * O estado do teto: `{ teto, tomadas: [{ k, dono }], livres, faixas, gateRodando, tomadasNaFaixa: { gate, normal } }`, contando só ficha viva
 * (ou ilegível recente). `gateRodando` é o dono da vez do gate da máquina, ou `null`.
 */
export function estadoDoTeto(pasta, teto, agora = Date.now(), ilegivelMs = ILEGIVEL_ABANDONADA_MS, env = process.env) {
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
  const f = faixas(teto, env);
  const naFaixaDoGate = tomadas.filter((t) => t.k <= f.gate).length;
  return {
    teto,
    tomadas,
    livres: Math.max(0, teto - tomadas.length),
    faixas: f,
    gateRodando: donoDoGate(pasta, agora, ilegivelMs),
    tomadasNaFaixa: { gate: naFaixaDoGate, normal: tomadas.length - naFaixaDoGate },
  };
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
    tentar = tentarTomarFichas,
  } = opcoes;
  const inicio = agora();
  let ultimoAviso = null;
  for (;;) {
    const r = tentar(pasta, teto, quero, eu, { agora: agora(), avisar });
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

/** {@link tomarFichas} pelo teste normal: faixa normal, e a do gate emprestada sem gate rodando. A ordem se recalcula a cada tentativa da espera. */
export const tomarFichasNormais = (opcoes) => tomarFichas({ ...opcoes, tentar: tentarTomarFichasNormais });

/**
 * Toma a vez do gate da máquina, esperando se outro gate (de qualquer projeto) a tem: avisa por quem ao começar e a cada `avisoMs`.
 * `dormir`, `agora` e `avisar` são injetáveis.
 */
export async function esperarAVezDoGate(opcoes) {
  const {
    pasta,
    eu,
    intervaloMs = 2_000,
    avisoMs = 60_000,
    dormir = (ms) => new Promise((r) => setTimeout(r, ms)),
    agora = () => Date.now(),
    avisar = (m) => console.error(m),
  } = opcoes;
  const inicio = agora();
  let ultimoAviso = null;
  for (;;) {
    const r = tentarAVezDoGate(pasta, eu, { agora: agora(), avisar });
    if (r.tomou) {
      if (ultimoAviso !== null) avisar(`[teto] a vez do gate da máquina chegou depois de ${Math.round((agora() - inicio) / 1000)} s`);
      return;
    }
    if (ultimoAviso === null) {
      avisar(`[teto] esperando a vez do gate da máquina — outro gate está rodando: ${quemSegura([r.dono])}`);
      ultimoAviso = agora();
    } else if (agora() - ultimoAviso >= avisoMs) {
      avisar(`[teto] ainda esperando a vez do gate da máquina (${Math.round((agora() - inicio) / 60_000)} min) — ${quemSegura([r.dono])}`);
      ultimoAviso = agora();
    }
    await dormir(intervaloMs);
  }
}

/**
 * As fichas do gate (já com a vez da máquina): só da faixa dele, de 1 para cima, até `quero`. Leva o livre e espera a devolução das
 * emprestadas até `prazoMs`; vencido o prazo, começa com o que tem se for ao menos `minimo` (padrão `ceil(quero / 2)`), senão segue
 * esperando e diz por quem a cada `avisoMs`. Devolve os `k` levados. Quem segura ficha na faixa e nunca devolve (o vitest em watch)
 * não trava o gate, enquanto sobrar o `minimo`.
 */
export async function tomarFichasDoGate(opcoes) {
  const {
    quero,
    pasta,
    teto,
    eu,
    minimo = Math.ceil(quero / 2),
    prazoMs = 300_000,
    intervaloMs = 2_000,
    avisoMs = 60_000,
    dormir = (ms) => new Promise((r) => setTimeout(r, ms)),
    agora = () => Date.now(),
    avisar = (m) => console.error(m),
    env = process.env,
  } = opcoes;
  const f = faixas(teto, env);
  const faixaDoGate = Array.from({ length: f.gate }, (_, i) => i + 1);
  const pedido = Math.min(quero, f.gate);
  const levou = [];
  const inicio = agora();
  let ultimoAviso = null;
  for (;;) {
    const r = tentarTomarFichas(pasta, teto, pedido - levou.length, eu, { agora: agora(), avisar, ordem: faixaDoGate.filter((k) => !levou.includes(k)) });
    levou.push(...r.levou);
    if (levou.length >= pedido) return levou.sort((a, b) => a - b);
    const esperou = agora() - inicio;
    if (esperou >= prazoMs && levou.length >= Math.min(minimo, pedido)) {
      avisar(`[teto] o prazo da devolução (${Math.round(prazoMs / 1000)} s) venceu: o gate começa com ${levou.length} de ${pedido} fichas`);
      return levou.sort((a, b) => a - b);
    }
    if (ultimoAviso === null || agora() - ultimoAviso >= avisoMs) {
      avisar(
        `[teto] o gate tem ${levou.length} de ${pedido} fichas — esperando a devolução das emprestadas por: ${quemSegura(r.donos)}` +
          (esperou >= prazoMs ? ` (prazo vencido, mas falta chegar a ${Math.min(minimo, pedido)})` : ""),
      );
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
    tentar = tentarTomarFichas,
  } = opcoes;
  const inicio = agora();
  let ultimoAviso = null;
  for (;;) {
    const r = tentar(pasta, teto, quero, eu, { agora: agora(), avisar });
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

/** {@link tomarFichasSync} pelo teste normal (o vitest de pacote, o typecheck). */
export const tomarFichasNormaisSync = (opcoes) => tomarFichasSync({ ...opcoes, tentar: tentarTomarFichasNormais });

/** A linha de comando: estado, `--teto N`, `--teto padrao`. Devolve o código de saída. */
export function main(env = process.env, argv = process.argv.slice(2)) {
  const pasta = pastaDoTeto(env);
  const j = argv.indexOf("--fracao");
  if (j !== -1) {
    const valor = argv[j + 1];
    const f = fracaoValida(valor);
    if (f === null) {
      console.error(`[teto] --fracao precisa de um número em (0, 1], e veio ${JSON.stringify(valor)}`);
      return 2;
    }
    const arquivo = join(pasta, "teto.json");
    mkdirSync(pasta, { recursive: true });
    writeFileSync(arquivo, JSON.stringify({ fracao: f }));
    console.log(`teto.json gravado em ${arquivo}: fração ${f} dos núcleos`);
    return 0;
  }
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
      console.log(`teto.json apagado: vale o padrão (2/3 dos núcleos)`);
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
    console.log(`[teto] aviso: número fixo não acompanha a máquina; prefira --fracao f (0 < f ≤ 1)`);
    return 0;
  }
  const teto = tetoDaMaquina(env, availableParallelism(), pasta);
  if (teto === null) {
    console.log("CI: sem teto");
    return 0;
  }
  const e = estadoDoTeto(pasta, teto, Date.now(), ILEGIVEL_ABANDONADA_MS, env);
  console.log(`teto ${e.teto} · tomadas ${e.tomadas.length} · livres ${e.livres}`);
  console.log(`faixa do gate ${e.faixas.gate} (tomadas ${e.tomadasNaFaixa.gate}) · faixa normal ${e.faixas.normal} (tomadas ${e.tomadasNaFaixa.normal})${e.faixas.compartilhada ? " · faixas na mesma ficha" : ""}`);
  console.log(`vez do gate: ${e.gateRodando ? descrever(e.gateRodando) : "livre"}`);
  for (const { k, dono } of e.tomadas) {
    console.log(`  ${k} · ${dono?.projeto ?? "?"} · ${dono?.worktree ?? dono?.cwd ?? "?"} · PID ${dono?.pid ?? "?"} · desde ${hora(dono?.desde)}`);
  }
  return 0;
}

// Pelo caminho REAL dos dois lados; `exitCode`, nunca `process.exit()`.
rodarSePrincipal(import.meta.url, () => main(), "[teto]");
