#!/usr/bin/env node
/**
 * **O contraste dos tokens de tema de um projeto contra o piso da base Wicomm — só lendo.**
 *
 * Uso: `node medir-contraste.mjs <folha.css> [<outra.css> …] [--json]`.
 *
 * Lê as variáveis de `:root` (claro) e de `.dark` / `@media (prefers-color-scheme: dark)` (escuro), em `#hex`,
 * `rgb()`, `hsl()`, canais soltos do shadcn (`222 84% 5%`) ou `oklch()`, compõe o alfa sobre o fundo e devolve a
 * matriz da COR-12 (a rampa de tinta no pior dos quatro fundos, o texto de cada par `x-foreground × x`, o anel de
 * foco), a COR-11 (o contorno de controle `--input` a 3:1), a CONV-03 (token `transparent`) e a MARCA-01. O que só
 * se mede no navegador (texto sobre vidro, sobre imagem, sobre manchas) fica fora: diga que não mediu.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lerCor, opaca, razao } from "./lib/contraste.mjs";
import { declaracoes, varsDoTema } from "./lib/fonte.mjs";

export const MARCA = "#F30B42";
export const FUNDOS = ["--background", "--card", "--muted", "--accent"];
/** COR-12: a rampa de tinta e o piso de cada degrau, medido no pior fundo. */
export const RAMPA = [
  ["--foreground", 14],
  ["--foreground-2", 5.9],
  ["--muted-foreground", 4.6],
];
// `muted-foreground × muted` já está na rampa.
const PARES = ["primary", "secondary", "accent", "destructive", "card", "popover"];

/** As variáveis de cada tema, das folhas na ordem dada (a última vence). */
export function temas(folhas) {
  const decl = folhas.flatMap((css) => declaracoes(css));
  const claro = varsDoTema(decl, "claro");
  const temEscuro = decl.some((d) => d.tema === "escuro");
  return { claro, ...(temEscuro ? { escuro: varsDoTema(decl, "escuro") } : {}) };
}

/** A matriz de um tema: `[{ regra, par, razao, piso, passa, nota? }]`. */
export function matriz(vars) {
  const linhas = [];
  const cor = (nome) => (vars[nome] === undefined ? null : lerCor(vars[nome], vars));
  const chao = cor("--background");
  const base = chao ? opaca(chao, "#FFFFFF") : "#FFFFFF";
  const fundo = (nome) => {
    const c = cor(nome);
    return c ? opaca(c, base) : null;
  };
  const fundos = FUNDOS.map((f) => [f, fundo(f)]).filter(([, h]) => h);
  const par = (regra, frente, tras, piso, nota) => {
    const f = cor(frente);
    const t = fundo(tras);
    if (!f || !t) return;
    const r = razao(opaca(f, t), t);
    linhas.push({ regra, par: `${frente} × ${tras}`, razao: r, piso, passa: r >= piso, ...(nota ? { nota } : {}) });
  };
  for (const [tinta, piso] of RAMPA) {
    if (!cor(tinta)) continue;
    for (const [f] of fundos) par("COR-12", tinta, f, piso, "rampa, no pior fundo");
  }
  const daMarca = cor("--primary")?.hex === MARCA;
  for (const nome of PARES) {
    // MARCA-01: o branco sobre a marca mede 4,25 e a base aceita esse número, só esse.
    if (nome === "primary" && daMarca) par("MARCA-01", "--primary-foreground", "--primary", 4.25, "a marca aceita os 4,25 dela");
    else par("COR-12", `--${nome}-foreground`, `--${nome}`, 4.5);
  }
  for (const [f] of fundos) par("COR-12", "--destructive", f, 4.5, "o vermelho escreve a frase de erro");
  par("COR-12", "--ring", "--background", 3, "anel de foco");
  for (const [f] of fundos) par("COR-11", "--input", f, 3, "contorno de controle");
  const transparentes = Object.entries(vars).filter(([, v]) => /^\s*transparent\s*$/i.test(v)).map(([k]) => k);
  const primaria = cor("--primary");
  return {
    linhas,
    pior: Object.fromEntries(RAMPA.filter(([t]) => cor(t)).map(([t, piso]) => {
      const rs = linhas.filter((l) => l.par.startsWith(`${t} ×`));
      const min = Math.min(...rs.map((l) => l.razao));
      return [t, { razao: min, piso, passa: min >= piso, fundo: rs.find((l) => l.razao === min)?.par.split(" × ")[1] }];
    })),
    transparentes,
    marca: primaria ? { primary: primaria.hex, igual: primaria.hex === MARCA && primaria.alfa === 1 } : null,
  };
}

/** A medida completa das folhas: um bloco por tema. */
export function medirContraste(folhas) {
  return Object.fromEntries(Object.entries(temas(folhas)).map(([tema, vars]) => [tema, matriz(vars)]));
}

const num = (n) => String(n).replace(".", ",");

export function emMarkdown(m) {
  const saida = ["## Contraste dos tokens (COR-12, COR-11)", ""];
  if (!m.escuro) saida.push("- **Tema escuro:** nenhuma variável em `.dark` nem em `prefers-color-scheme: dark`.", "");
  for (const [tema, t] of Object.entries(m)) {
    saida.push(`### Tema ${tema}`, "", "| Regra | Par | Razão | Piso | Veredito |", "|---|---|---|---|---|");
    for (const l of t.linhas) saida.push(`| ${l.regra} | \`${l.par}\`${l.nota ? ` (${l.nota})` : ""} | ${num(l.razao)} | ${num(l.piso)} | ${l.passa ? "passa" : "**falha**"} |`);
    const rampa = Object.entries(t.pior).map(([k, v]) => `\`${k}\` ${num(v.razao)} em \`${v.fundo}\` (${v.passa ? "passa" : `**falha**, piso ${num(v.piso)}`})`);
    saida.push("", `- **Rampa no pior fundo:** ${rampa.join(" · ") || "—"}`);
    if (t.transparentes.length) saida.push(`- **Token \`transparent\` (CONV-03):** ${t.transparentes.map((k) => `\`${k}\``).join(", ")}`);
    if (t.marca) saida.push(`- **Marca (MARCA-01):** \`--primary\` ${t.marca.primary}${t.marca.igual ? " (é a da Wicomm)" : ` — a da Wicomm é ${MARCA}`}`);
    saida.push("");
  }
  saida.push("Fora desta conta: texto sobre vidro, imagem ou mancha, e as classes de paleta usadas direto — só no navegador (MED-01).");
  return saida.join("\n");
}

const real = (c) => {
  try {
    return realpathSync(c);
  } catch {
    return null;
  }
};
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const folhas = args.filter((a) => !a.startsWith("--"));
  if (folhas.length === 0 || folhas.some((f) => !existsSync(f))) {
    console.error("uso: node medir-contraste.mjs <folha.css> [<outra.css> …] [--json]");
    process.exitCode = 2;
  } else {
    const m = medirContraste(folhas.map((f) => readFileSync(f, "utf-8")));
    process.stdout.write(args.includes("--json") ? JSON.stringify(m, null, 2) + "\n" : emMarkdown(m) + "\n");
  }
}
