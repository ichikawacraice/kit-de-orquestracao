#!/usr/bin/env node
/**
 * **Os números de deriva de um app React contra a base Wicomm — só lendo.**
 *
 * Uso: `node medir-deriva.mjs <raiz do projeto> [--pasta <pasta do front>] [--json]`.
 *
 * Mede o que a skill `auditar-projeto` pede em números: valor solto (os mesmos padrões do aviso na escrita,
 * `hooks/valor-solto.mjs`), bibliotecas de ícone, tamanhos de fonte, raios e alturas distintos, arquivos com animação
 * sem escape (`motion-reduce`/`prefers-reduced-motion`, MOV-02), o stack (framework, Tailwind, shadcn) e as peças da
 * pasta de componentes. Não escreve nada, não instala nada e não roda build.
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ICONE_DE_FORA, PADROES } from "../hooks/valor-solto.mjs";

// As mesmas extensões que a guarda e o aviso na escrita contam como tela: a linha de base da catraca sai daqui.
const EXTENSOES = /\.(tsx|jsx|vue|svelte|css|scss|html)$/;
const FORA = new Set(["node_modules", "dist", "build", ".next", ".git", "coverage", ".turbo", ".vercel", "out"]);
const TESTE = /\.(test|spec|stories)\.|__tests__/;
const DECLARA_TOKEN = /^\s*--[\w-]+\s*:/;

/** Os arquivos de tela da pasta, sem dependências, build e testes. */
export function arquivosDeTela(pasta) {
  const lista = [];
  const varrer = (dir) => {
    let entradas;
    try {
      entradas = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entradas) {
      if (e.name.startsWith(".") && e.name !== ".") continue;
      const caminho = join(dir, e.name);
      if (e.isDirectory()) {
        if (!FORA.has(e.name)) varrer(caminho);
      } else if (EXTENSOES.test(e.name) && !TESTE.test(caminho) && !/\.config\.|\.d\.ts$/.test(e.name)) lista.push(caminho);
    }
  };
  varrer(pasta);
  return lista.sort();
}

const contar = (mapa, chave, n = 1) => mapa.set(chave, (mapa.get(chave) ?? 0) + n);
const ordenado = (mapa) => [...mapa.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

/** Os números de deriva de uma lista de arquivos (`{ caminho, texto }`). */
export function medir(arquivos) {
  const porCategoria = new Map();
  const porArquivo = new Map();
  const icones = new Map();
  const tamanhos = new Map();
  const raios = new Map();
  const alturas = new Map();
  const semEscape = [];
  for (const { caminho, texto } of arquivos) {
    let doArquivo = 0;
    for (const linha of texto.split("\n")) {
      if (DECLARA_TOKEN.test(linha)) continue;
      for (const p of PADROES) {
        const n = [...linha.matchAll(p.re)].length;
        if (n) {
          contar(porCategoria, `${p.nome} (${p.regra})`, n);
          doArquivo += n;
        }
      }
      for (const m of linha.matchAll(ICONE_DE_FORA)) {
        contar(porCategoria, "ícone de outra biblioteca (CTRL-09)");
        doArquivo += 1;
        contar(icones, m[1].split("/").slice(0, m[1].startsWith("@") ? 2 : 1).join("/"));
      }
      if (/from\s+['"]lucide-react['"]/.test(linha)) contar(icones, "lucide-react");
      for (const m of linha.matchAll(/(?<![\w-])text-(xs|sm|base|lg|[2-9]?xl|\[\d[^\]]*\])(?![\w-])/g)) contar(tamanhos, `text-${m[1]}`);
      for (const m of linha.matchAll(/(?<![\w-])rounded(?:-(none|xs|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?(?![\w-])/g)) contar(raios, m[1] ? `rounded-${m[1]}` : "rounded");
      for (const m of linha.matchAll(/(?<![\w:-])h-(\d+(?:\.5)?|\[[^\]]+\])(?![\w-])/g)) contar(alturas, `h-${m[1]}`);
    }
    if (doArquivo) porArquivo.set(caminho, doArquivo);
    if (/(?<![\w-])(animate-[\w-]+|transition(?:-[\w]+)?)(?![\w-])|@keyframes/.test(texto) && !/motion-reduce|motion-safe|prefers-reduced-motion/.test(texto)) semEscape.push(caminho);
  }
  return {
    arquivos: arquivos.length,
    valorSolto: { total: [...porCategoria.values()].reduce((a, b) => a + b, 0), porCategoria: ordenado(porCategoria), piores: ordenado(porArquivo).slice(0, 10) },
    icones: ordenado(icones),
    tamanhosDeFonte: ordenado(tamanhos),
    raios: ordenado(raios),
    alturas: ordenado(alturas),
    animacaoSemEscape: semEscape,
  };
}

const lerJson = (c) => {
  try {
    return JSON.parse(readFileSync(c, "utf-8"));
  } catch {
    return null;
  }
};

/** O stack do front: framework, Tailwind (versão e config), shadcn (components.json) e a pasta de componentes. */
export function stack(raizDoFront) {
  const pkg = lerJson(join(raizDoFront, "package.json")) ?? {};
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const framework = deps.next ? `next ${deps.next}` : deps.vite ? `vite ${deps.vite}` : deps["react-scripts"] ? `cra ${deps["react-scripts"]}` : "desconhecido";
  const tailwind = deps.tailwindcss ?? null;
  const configTw = ["tailwind.config.ts", "tailwind.config.js", "tailwind.config.mjs", "tailwind.config.cjs"].find((f) => existsSync(join(raizDoFront, f))) ?? null;
  const shadcn = lerJson(join(raizDoFront, "components.json"));
  const pastaUi = ["src/components/ui", "components/ui", "app/components/ui"].map((p) => join(raizDoFront, p)).find((p) => existsSync(p)) ?? null;
  const pecas = pastaUi ? readdirSync(pastaUi).filter((f) => /\.(tsx|jsx)$/.test(f) && !TESTE.test(f)).map((f) => f.replace(/\.(tsx|jsx)$/, "")).sort() : [];
  return {
    react: deps.react ?? null,
    framework,
    loja: Boolean(deps["@faststore/core"] || deps["@faststore/ui"] || Object.keys(deps).some((d) => d.startsWith("@vtex/") || d.startsWith("@wake"))),
    tailwind,
    tailwindV3: Boolean(tailwind && /^[\^~]?3\./.test(tailwind)) || Boolean(configTw),
    configTailwind: configTw,
    shadcn: shadcn ? { estilo: shadcn.style ?? null, registries: Object.keys(shadcn.registries ?? {}) } : null,
    pastaUi: pastaUi ? relative(raizDoFront, pastaUi) : null,
    pecas,
  };
}

/** A medição completa de um front. */
export function medirProjeto(raiz, pasta = ".") {
  const front = join(raiz, pasta);
  const arquivos = arquivosDeTela(join(front, existsSync(join(front, "src")) ? "src" : "")).map((c) => ({ caminho: relative(raiz, c), texto: readFileSync(c, "utf-8") }));
  return { raiz, pasta, stack: stack(front), ...medir(arquivos) };
}

const linhas = (pares, vazio = "—") => (pares.length ? pares.map(([k, v]) => `\`${k}\` ${v}`).join(" · ") : vazio);

/** O relatório em markdown, para colar na auditoria. */
export function emMarkdown(m) {
  return [
    `## Números de deriva — ${m.pasta}`,
    "",
    `- **Stack:** React ${m.stack.react ?? "?"} · ${m.stack.framework} · Tailwind ${m.stack.tailwind ?? "ausente"}${m.stack.configTailwind ? ` (${m.stack.configTailwind})` : ""} · shadcn ${m.stack.shadcn ? `estilo ${m.stack.shadcn.estilo ?? "?"}` : "sem components.json"}`,
    `- **Arquivos de tela medidos:** ${m.arquivos}`,
    `- **Valor solto:** ${m.valorSolto.total} — ${linhas(m.valorSolto.porCategoria)}`,
    `- **Piores arquivos:** ${linhas(m.valorSolto.piores)}`,
    `- **Ícones:** ${linhas(m.icones)}`,
    `- **Tamanhos de fonte distintos:** ${m.tamanhosDeFonte.length} — ${linhas(m.tamanhosDeFonte)}`,
    `- **Raios distintos:** ${m.raios.length} — ${linhas(m.raios)}`,
    `- **Alturas distintas:** ${m.alturas.length} — ${linhas(m.alturas.slice(0, 15))}`,
    `- **Animação sem escape (MOV-02):** ${m.animacaoSemEscape.length}${m.animacaoSemEscape.length ? ` — ${m.animacaoSemEscape.slice(0, 10).map((c) => `\`${c}\``).join(", ")}` : ""}`,
    `- **Peças em ${m.stack.pastaUi ?? "(sem pasta ui)"}:** ${m.stack.pecas.length} — ${m.stack.pecas.join(", ") || "—"}`,
  ].join("\n");
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
  const raiz = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--pasta");
  if (!raiz || !existsSync(raiz)) {
    console.error("uso: node medir-deriva.mjs <raiz do projeto> [--pasta <pasta do front>] [--json]");
    process.exitCode = 2;
  } else {
    const i = args.indexOf("--pasta");
    const m = medirProjeto(raiz, i >= 0 ? args[i + 1] : ".");
    process.stdout.write(args.includes("--json") ? JSON.stringify(m, null, 2) + "\n" : emMarkdown(m) + "\n");
  }
}
