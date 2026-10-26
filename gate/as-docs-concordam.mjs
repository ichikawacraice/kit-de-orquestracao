#!/usr/bin/env node
/**
 * **As docs concordam: o gate confere o que a convenção só pede.**
 *
 * Convenção de documento sem verificação apodrece: o status da spec inventado, o ADR que existe e não
 * está no índice, a linha do roadmap que virou parágrafo, o link que leva ao topo, o diário de meio MB.
 * Cada regra abaixo é ligável à parte em `documentos.conferir` do `.claude/kit.json` (sem a lista, o gate
 * não confere nada). Saída: uma linha `arquivo:linha — motivo` por achado, `process.exitCode = 1` se houver.
 *
 *   status-da-spec    vocabulário fechado de status e o índice da pasta de specs concorda com cada cabeçalho
 *   indice-de-adr     todo ADR está no índice e toda linha do índice aponta para um ADR; a célula Decisão cabe
 *   linha-do-roadmap  linha de item ≤ 400 caracteres, ≤ 2 links de spec/ADR e âncora EXPLÍCITA no destino
 *   links-relativos   todo link relativo em `docs/` resolve, e o `#slug` existe (`<a id>` ou título)
 *   tamanho-do-diario cada parte do diário ≤ 150 KB; cada entrada `AAAA-MM/DD-<ancora>.md` no formato, não vazia, com `<a id>` igual à âncora;
 *                     mês depois da primeira pasta não nasce como arquivo único
 *
 * Pasta que não existe, ou existe sem documento, diz "nada a conferir" — nunca um verde calado.
 * Uso: `node as-docs-concordam.mjs [--regra x]…` (sem `--regra`: as de `documentos.conferir`; lista vazia: nenhuma).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { carregarConfig, DOCUMENTOS_PADRAO, REGRAS_DE_DOCUMENTO, raizDoProjeto } from "./config.mjs";
import { rodarSePrincipal } from "./o-script-principal.mjs";

const PASTAS_IGNORADAS = new Set(["node_modules", "worktrees", ".git", "vendor", "dist", "build", "coverage"]);
const ANCORA_EXPLICITA = /<a\s+(?:id|name)=["']([^"']+)["']/gi;
const TITULO = /^(#{1,6})\s+(.+?)\s*$/gm;
const LINK = /\[[^\]]*\]\(\s*(<[^>\s]*>|[^)\s]+)/g;
const MES_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;
const NOME_DE_ENTRADA = /^(0[1-9]|[12]\d|3[01])-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const ITEM = /^(\s*)- \[[x ~]\] (.*)$/;
const STATUS = /\*\*Status:\*\*\s*(.*?)(?=\s*·\s*\*\*|\s*$)/m;

const ler = (caminho) => readFileSync(caminho, "utf-8").replace(/^\uFEFF/, "");
const linhaDe = (texto, indice) => texto.slice(0, indice).split("\n").length;
const decodificar = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Troca o código por espaços, mantendo as quebras: o link que está entre crases é o padrão ilustrado, e o número da linha não muda. */
const semCodigo = (md) => md.replace(/```[\s\S]*?```/g, (b) => b.replace(/[^\n]/g, " ")).replace(/`[^`\n]*`/g, (b) => " ".repeat(b.length));
/** Só a cerca sai: o conteúdo da crase faz parte do título renderizado, e do slug. */
const semCerca = (md) => md.replace(/^```[\s\S]*?^```/gm, (b) => b.replace(/[^\n]/g, " "));

/** O slug que o GitHub gera do texto do título: minúsculas, pontuação fora, CADA espaço vira um hífen, acento fica. */
export function slugDeTitulo(titulo) {
  return titulo
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/<[!/a-z][^>]*>/gi, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N} \t-]/gu, "")
    .replace(/[ \t]/g, "-");
}

/** As âncoras que um documento oferece: `explicitas` (`<a id>`) e `geradas` (dos títulos, com sufixo no repetido). */
export function ancorasDe(md) {
  const explicitas = new Set([...md.matchAll(ANCORA_EXPLICITA)].map((m) => m[1]));
  const geradas = new Set();
  const vezes = new Map();
  for (const [, , titulo] of semCerca(md).matchAll(TITULO)) {
    const slug = slugDeTitulo(titulo);
    if (!slug) continue;
    const n = vezes.get(slug) ?? 0;
    vezes.set(slug, n + 1);
    geradas.add(n === 0 ? slug : `${slug}-${n}`);
  }
  return { explicitas, geradas };
}

/** Os links relativos de um markdown, com a linha: `{ linha, caminho, ancora }`. Externo, `mailto:` e vazio não são arquivo. */
function linksDe(md) {
  const achados = [];
  semCodigo(md).split("\n").forEach((texto, i) => {
    for (const m of texto.matchAll(LINK)) {
      const alvo = (m[1] ?? "").replace(/^<|>$/g, "");
      if (alvo === "" || alvo === "#" || alvo === "…" || /^[a-z][a-z0-9+.-]*:/i.test(alvo)) continue;
      const [caminho = "", ancora = ""] = alvo.split("#");
      achados.push({ linha: i + 1, alvo, caminho: decodificar(caminho), ancora: decodificar(ancora) });
    }
  });
  return achados;
}

/** Os `.md` sob `dir`, recursivo, sem as pastas de máquina. Link simbólico pendurado é pulado, não derruba. */
function markdownsSob(dir) {
  const achados = [];
  for (const nome of readdirSync(dir).sort()) {
    if (PASTAS_IGNORADAS.has(nome)) continue;
    const cheio = join(dir, nome);
    let info;
    try {
      info = statSync(cheio);
    } catch {
      continue;
    }
    if (info.isDirectory()) achados.push(...markdownsSob(cheio));
    else if (nome.endsWith(".md")) achados.push(cheio);
  }
  return achados;
}

const arquivosDe = (dir, padrao) => (existsSync(dir) && statSync(dir).isDirectory() ? readdirSync(dir).filter((f) => padrao.test(f)).sort() : []);

/** O contexto de uma conferência: raiz, pastas absolutas e orçamentos, já mesclados com os padrões. */
function contexto(raiz, documentos) {
  const d = { ...DOCUMENTOS_PADRAO, ...documentos, orcamentos: { ...DOCUMENTOS_PADRAO.orcamentos, ...documentos?.orcamentos } };
  const abs = (p) => join(raiz, p);
  return {
    raiz,
    adr: abs(d.adr),
    specs: abs(d.specs),
    roadmap: abs(d.roadmap),
    diario: abs(d.diario),
    docs: abs(d.docs),
    estados: d.estados,
    orc: d.orcamentos,
    vistos: 0, // quantos arquivos a regra em curso examinou (a linha de fecho)
    rel: (caminho) => relative(raiz, caminho).split("\\").join("/"),
  };
}

/** Cada regra devolve `{ achados: [{ arquivo, linha, motivo }], nada: string | null }`; `nada` diz por que não havia o que conferir. */
const REGRAS = {
  "status-da-spec"(c) {
    const arquivos = arquivosDe(c.specs, /^SPEC-\d{3}-.*\.md$/);
    c.vistos = arquivos.length;
    if (arquivos.length === 0) return { achados: [], nada: `nenhuma SPEC-NNN-*.md em ${c.rel(c.specs)}` };
    const achados = [];
    const readme = join(c.specs, "README.md");
    const indice = existsSync(readme) ? ler(readme) : null;
    const statusDe = (texto) => {
      const m = STATUS.exec(texto);
      return m === null ? null : { valor: m[1].trim(), linha: linhaDe(texto, m.index) };
    };
    for (const arquivo of arquivos) {
      const caminho = join(c.specs, arquivo);
      const status = statusDe(ler(caminho));
      if (status === null) {
        achados.push({ arquivo: c.rel(caminho), linha: 1, motivo: "sem o campo **Status:**" });
        continue;
      }
      if (!c.estados.includes(status.valor)) {
        achados.push({
          arquivo: c.rel(caminho),
          linha: status.linha,
          motivo: `status "${status.valor}" fora do vocabulário (${c.estados.join(" · ")}); a nuance vai em **Pendências:**`,
        });
        continue;
      }
      const numero = arquivo.slice(0, 8);
      if (indice === null) continue;
      const linhas = indice.split("\n");
      const i = linhas.findIndex((l) => new RegExp(`^\\|\\s*\\[${numero}\\]\\(`).test(l));
      if (i < 0) {
        achados.push({ arquivo: c.rel(caminho), linha: status.linha, motivo: `${numero} fora do índice ${c.rel(readme)}` });
        continue;
      }
      const celulas = linhas[i].split("|").map((x) => x.trim());
      if (celulas[3] !== status.valor) {
        achados.push({ arquivo: c.rel(readme), linha: i + 1, motivo: `${numero}: o índice diz "${celulas[3]}" e a spec diz "${status.valor}"` });
      }
    }
    if (indice === null) achados.push({ arquivo: c.rel(readme), linha: 1, motivo: "há specs e não há índice (README.md) para concordar com elas" });
    return { achados, nada: null };
  },

  "indice-de-adr"(c) {
    const arquivos = arquivosDe(c.adr, /^\d{4}-.*\.md$/);
    c.vistos = arquivos.length;
    if (arquivos.length === 0) return { achados: [], nada: `nenhum NNNN-*.md em ${c.rel(c.adr)}` };
    const achados = [];
    const readme = join(c.adr, "README.md");
    if (!existsSync(readme)) return { achados: [{ arquivo: c.rel(readme), linha: 1, motivo: "há ADRs e não há índice (README.md)" }], nada: null };
    const linhas = ler(readme).split("\n");
    const linhasDoIndice = [];
    linhas.forEach((texto, i) => {
      // o rótulo é `NNNN` ou `ADR NNNN` e o número é o do arquivo linkado; rótulo livre reprova. `./` no link é normalizado
      const m = /^\|\s*\[([^\]]*)\]\(([^)]+\.md)\)\s*\|([^|]*)\|/.exec(texto);
      if (m) linhasDoIndice.push({ n: i + 1, rotulo: m[1], numero: /^(?:ADR\s+)?(\d{4})$/.exec(m[1].trim())?.[1] ?? null, arquivo: m[2].replace(/^(?:\.\/)+/, ""), decisao: m[3].trim() });
    });
    const noIndice = new Set(linhasDoIndice.map((l) => l.arquivo));
    for (const arquivo of arquivos) {
      if (!noIndice.has(arquivo)) achados.push({ arquivo: c.rel(join(c.adr, arquivo)), linha: 1, motivo: `ADR fora do índice ${c.rel(readme)}` });
    }
    for (const l of linhasDoIndice) {
      if (!arquivos.includes(l.arquivo)) achados.push({ arquivo: c.rel(readme), linha: l.n, motivo: `o índice aponta para ${l.arquivo}, que não existe` });
      else if (l.numero !== l.arquivo.slice(0, 4)) achados.push({ arquivo: c.rel(readme), linha: l.n, motivo: `rótulo [${l.rotulo}] para o arquivo ${l.arquivo}` });
      if (l.decisao.length > c.orc.decisaoDoAdr) {
        achados.push({
          arquivo: c.rel(readme),
          linha: l.n,
          motivo: `célula Decisão com ${l.decisao.length} caracteres (+${l.decisao.length - c.orc.decisaoDoAdr} sobre ${c.orc.decisaoDoAdr}); o índice diz o que a decisão É`,
        });
      }
    }
    return { achados, nada: null };
  },

  "linha-do-roadmap"(c) {
    if (!existsSync(c.roadmap)) return { achados: [], nada: `${c.rel(c.roadmap)} não existe` };
    c.vistos = 1;
    const texto = ler(c.roadmap);
    const linhas = texto.split("\n");
    const itens = linhas.flatMap((l, i) => (ITEM.test(l) ? [{ n: i + 1, texto: l }] : []));
    const achados = [];
    const arquivo = c.rel(c.roadmap);
    const aqui = dirname(c.roadmap);
    const dentro = (alvo, pasta) => alvo === pasta || alvo.startsWith(pasta + "/");
    const linksPorLinha = new Map();
    for (const l of linksDe(texto)) linksPorLinha.set(l.linha, [...(linksPorLinha.get(l.linha) ?? []), l]);
    for (const it of itens) {
      if (it.texto.length > c.orc.linhaDoRoadmap) {
        achados.push({
          arquivo,
          linha: it.n,
          motivo: `linha de item com ${it.texto.length} caracteres (+${it.texto.length - c.orc.linhaDoRoadmap} sobre ${c.orc.linhaDoRoadmap}); a narrativa vai para o diário e a linha aponta`,
        });
      }
      const rastro = (linksPorLinha.get(it.n) ?? []).filter((l) => {
        const alvo = normalize(join(aqui, l.caminho));
        return l.caminho !== "" && (dentro(alvo, c.specs) || dentro(alvo, c.adr));
      });
      if (rastro.length > c.orc.linksDoRoadmap) {
        achados.push({ arquivo, linha: it.n, motivo: `${rastro.length} links de spec/ADR (o limite é ${c.orc.linksDoRoadmap}); o resto mora na entrada do diário` });
      }
    }
    const cache = new Map();
    // spec, ADR e diário citam âncora EXPLÍCITA (o slug do título morre na primeira reescrita); outro doc aceita o slug do título
    const ancorasDoDestino = (alvo) => {
      if (!cache.has(alvo)) {
        if (!(existsSync(alvo) && statSync(alvo).isFile())) cache.set(alvo, null);
        else {
          const { explicitas, geradas } = ancorasDe(ler(alvo));
          const rigido = dentro(alvo, c.specs) || dentro(alvo, c.adr) || dentro(alvo, c.diario);
          cache.set(alvo, { ancoras: rigido ? explicitas : new Set([...explicitas, ...geradas]), rigido });
        }
      }
      return cache.get(alvo);
    };
    for (const l of linksDe(texto)) {
      if (l.ancora === "" || l.caminho === "") continue;
      const alvo = normalize(join(aqui, l.caminho));
      if (!alvo.endsWith(".md")) continue;
      const destino = ancorasDoDestino(alvo);
      if (destino === null) continue; // arquivo ausente é do `links-relativos`
      if (!destino.ancoras.has(l.ancora)) {
        achados.push({
          arquivo,
          linha: l.linha,
          motivo: destino.rigido
            ? `${l.alvo}: o destino não declara <a id="${l.ancora}"> (âncora explícita; slug de título morre na primeira reescrita)`
            : `${l.alvo}: a âncora não existe no destino`,
        });
      }
    }
    if (itens.length === 0 && achados.length === 0) return { achados, nada: `nenhum item "- [ ]"/"- [x]" em ${arquivo}` };
    return { achados, nada: null };
  },

  "links-relativos"(c) {
    if (!existsSync(c.docs) || !statSync(c.docs).isDirectory()) return { achados: [], nada: `${c.rel(c.docs)} não existe` };
    const arquivos = markdownsSob(c.docs);
    c.vistos = arquivos.length;
    if (arquivos.length === 0) return { achados: [], nada: `nenhum .md em ${c.rel(c.docs)}` };
    const achados = [];
    const cache = new Map();
    const ancoras = (abs) => {
      if (!cache.has(abs)) {
        const { explicitas, geradas } = ancorasDe(ler(abs));
        cache.set(abs, new Set([...explicitas, ...geradas]));
      }
      return cache.get(abs);
    };
    for (const arquivo of arquivos) {
      for (const l of linksDe(ler(arquivo))) {
        // `/x` resolve a partir da raiz do repositório, como o GitHub renderiza
        const destino = l.caminho === "" ? arquivo : l.caminho.startsWith("/") ? normalize(join(c.raiz, l.caminho)) : normalize(join(dirname(arquivo), l.caminho));
        const onde = { arquivo: c.rel(arquivo), linha: l.linha };
        if (!existsSync(destino)) {
          achados.push({ ...onde, motivo: `${l.alvo}: o arquivo não existe` });
          continue;
        }
        if (l.ancora === "") continue;
        if (statSync(destino).isDirectory()) achados.push({ ...onde, motivo: `${l.alvo}: pasta não tem âncora` });
        else if (destino.endsWith(".md") && !ancoras(destino).has(l.ancora)) {
          achados.push({ ...onde, motivo: `${l.alvo}: a âncora não existe no destino (declare <a id="…"> lá; não chute o slug)` });
        }
      }
    }
    return { achados, nada: null };
  },

  "tamanho-do-diario"(c) {
    const acervo = arquivosDe(c.diario, /^\d{4}-\d{2}(-parte-\d+)?\.md$/);
    const subpastas = existsSync(c.diario) && statSync(c.diario).isDirectory() ? readdirSync(c.diario).filter((f) => statSync(join(c.diario, f)).isDirectory()).sort() : [];
    const entradas = subpastas.filter(MES_VALIDO.test.bind(MES_VALIDO)).flatMap((mes) => arquivosDe(join(c.diario, mes), /\.md$/).map((f) => `${mes}/${f}`));
    c.vistos = acervo.length + entradas.length;
    if (c.vistos === 0 && subpastas.length === 0) return { achados: [], nada: `nenhum AAAA-MM.md nem AAAA-MM/DD-*.md em ${c.rel(c.diario)}` };
    const achados = [];
    const acha = (arquivo, motivo) => achados.push({ arquivo: c.rel(join(c.diario, arquivo)), linha: 1, motivo });
    const sobre = (bytes) => `${bytes} bytes (+${bytes - c.orc.diarioEmBytes} sobre ${c.orc.diarioEmBytes})`;
    for (const arquivo of acervo) {
      const bytes = statSync(join(c.diario, arquivo)).size;
      if (bytes > c.orc.diarioEmBytes) acha(arquivo, `${sobre(bytes)}; o mês que passa do orçamento fatia em AAAA-MM-parte-N.md`);
    }
    for (const nome of subpastas) {
      if (!MES_VALIDO.test(nome)) acha(nome, `pasta do mês fora de AAAA-MM: "${nome}"`);
    }
    for (const entrada of entradas) {
      const texto = ler(join(c.diario, entrada));
      const bytes = statSync(join(c.diario, entrada)).size;
      const m = NOME_DE_ENTRADA.exec(entrada.split("/")[1]);
      if (!m) acha(entrada, `nome fora do formato DD-<ancora>.md (dia 01-31, âncora em minúsculas, dígitos e hífen)`);
      if (texto.trim() === "") acha(entrada, "arquivo vazio");
      if (bytes > c.orc.diarioEmBytes) acha(entrada, `${sobre(bytes)}; a entrada passa do orçamento; divida em duas entradas`);
      if (m && texto.trim() !== "" && !ancorasDe(texto).explicitas.has(m[2])) acha(entrada, `falta <a id="${m[2]}">: a âncora do nome tem de estar declarada no arquivo`);
    }
    const primeira = subpastas.find((n) => MES_VALIDO.test(n));
    if (primeira) {
      for (const arquivo of acervo) {
        if (arquivo.slice(0, 7) > primeira) acha(arquivo, `mês depois da primeira pasta (${primeira}) vira pasta: use ${arquivo.slice(0, 7)}/DD-<ancora>.md`);
      }
    }
    return { achados, nada: null };
  },
};

/**
 * Confere as `regras` (nomes) sobre `raiz` com a seção `documentos` do kit.json.
 * Devolve `{ achados: [{ regra, arquivo, linha, motivo }], nada: [{ regra, motivo }], regras, arquivos }`
 * (`arquivos`: quantos a conferência examinou, para a linha de fecho).
 */
export function conferirDocs(raiz, documentos, regras) {
  const c = contexto(raiz, documentos);
  const achados = [];
  const nada = [];
  let arquivos = 0;
  for (const regra of regras) {
    if (!REGRAS[regra]) throw new Error(`regra de documento desconhecida: ${JSON.stringify(regra)} — as conhecidas são ${REGRAS_DE_DOCUMENTO.join(", ")}`);
    c.vistos = 0;
    const r = REGRAS[regra](c);
    arquivos += c.vistos;
    for (const a of r.achados) achados.push({ regra, ...a });
    if (r.nada !== null) nada.push({ regra, motivo: r.nada });
  }
  return { achados, nada, regras: regras.length, arquivos };
}

/** Escreve o resultado (`arquivo:linha — motivo`, o "nada a conferir" por regra e, sem achado, `N regras, M arquivos, 0 achados`) e devolve o código de saída. */
export function relatar(resultado, escrever = (t) => console.log(t)) {
  for (const { regra, motivo } of resultado.nada) escrever(`[${regra}] nada a conferir: ${motivo}`);
  for (const a of resultado.achados) escrever(`${a.arquivo}:${a.linha} — ${motivo(a)}`);
  if (resultado.achados.length > 0) return 1;
  escrever(`${resultado.regras} regras, ${resultado.arquivos} arquivos, 0 achados`);
  return 0;
}
const motivo = (a) => `${a.motivo} [${a.regra}]`;

export function main(argv = process.argv.slice(2), raiz = raizDoProjeto()) {
  const regras = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--regra" && argv[i + 1]) regras.push(argv[++i]);
    else {
      console.error(`[docs] argumento desconhecido: ${argv[i]} — uso: as-docs-concordam.mjs [--regra <nome>]…`);
      return 2;
    }
  }
  const cfg = carregarConfig(raiz);
  const escolhidas = regras.length > 0 ? regras : cfg.documentos.conferir;
  if (escolhidas.length === 0) {
    console.log(`[docs] nenhuma regra ligada (${cfg.documentos.origemDoConferir === "plugin-desligado" ? "o plugin processos está desligado" : cfg.documentos.origemDoConferir === "kit.json" ? "documentos.conferir está vazio no kit.json" : "todas as opções do plugin processos estão desligadas"}); passe --regra <nome> para conferir uma à mão`);
    return 0;
  }
  const codigo = relatar(conferirDocs(raiz, cfg.documentos, escolhidas));
  if (codigo !== 0) console.error(`[docs] as docs não concordam — conserte no arquivo apontado, não na regra`);
  return codigo;
}

rodarSePrincipal(import.meta.url, () => main(), "[docs]");
