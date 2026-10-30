// O que o ateliê lista sai do registry.json do registro — a mesma lista que o
// `shadcn build` serve em /r/v{versao}/. Item novo no registro entra aqui sozinho;
// a demonstração viva dele é que precisa ser escrita (test/catalogo.test.tsx cobra).
import registryJson from "@wicomm/registro/registry.json"
import pacote from "@wicomm/registro/package.json"

export type Item = {
  name: string
  type: string
  title: string
  description: string
  dependencies?: string[]
  registryDependencies?: string[]
  files: { path: string; type: string }[]
}

export const VERSAO: string = pacote.version
/**
 * O piso de altura do palco, para o item que abre camada por cima (diálogo,
 * menu, lista, aviso, dica): a camada se mede pela janela do iframe, não pelo
 * conteúdo. Os outros ficam com a altura do que mostram.
 */
export const PISO_DO_PALCO: Record<string, number> = {
  dialog: 420,
  "confirm-dialog": 420,
  menu: 420,
  select: 300,
  toast: 300,
  tooltip: 200,
  "dica-de-ajuda": 200,
  "com-motivo": 200,
}

/**
 * O endereço do ateliê nos comandos de instalação: o `Comando` troca pela
 * origem de onde a página está servida, ao montar — o registro mora no mesmo host.
 */
export const HOST = "{origem}"
export const ITENS: Item[] = (registryJson as { items: Item[] }).items

/** As seções do catálogo, pela ordem da navegação. O tipo do item decide a seção. */
export const SECOES = [
  { id: "fundamentos", titulo: "Fundamentos", tipos: ["registry:style", "registry:theme", "registry:lib"], vazio: "" },
  { id: "pecas", titulo: "Peças", tipos: ["registry:ui", "registry:component", "registry:hook"], vazio: "" },
  {
    id: "blocos",
    titulo: "Blocos de tela",
    tipos: ["registry:block", "registry:page"],
    vazio: "O registro ainda não tem bloco de tela.",
  },
] as const

export type IdDaSecao = (typeof SECOES)[number]["id"]

export function secaoDoItem(item: Item): IdDaSecao {
  return SECOES.find((s) => (s.tipos as readonly string[]).includes(item.type))?.id ?? "pecas"
}

export function itensDaSecao(id: IdDaSecao): Item[] {
  return ITENS.filter((i) => secaoDoItem(i) === id)
}

export function itemPeloNome(nome: string): Item | undefined {
  return ITENS.find((i) => i.name === nome)
}

/**
 * A descrição do registro começa pelo nome do equivalente no shadcn
 * (`button — o botão: …`), para a busca; o ateliê mostra as duas partes
 * separadas.
 */
export function descricaoDoItem(item: Item): { equivalente: string | null; texto: string } {
  // O código de regra entre parênteses é para quem mantém a peça, não para a tela (MSG-05).
  const descricao = item.description.replace(/\s*\((?:[A-Z]+-\d+(?:,\s*)?)+\)/g, "")
  const i = descricao.indexOf(" — ")
  if (i < 0) return { equivalente: null, texto: descricao }
  // "o botão: escala…" → "escala…": o nome já está no título ao lado.
  const texto = descricao.slice(i + 3).replace(/^(?:o|a)\s+\S+(?:\s\S+)?:\s+/i, "")
  // Só a palavra comum ganha maiúscula: `useConfirm()` continua sendo o nome do hook.
  const comum = /^[a-zà-ú]+[\s,:]/.test(texto)
  return { equivalente: descricao.slice(0, i), texto: comum ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto }
}

/** `@wicomm/estilo` → `estilo`. */
export function nomeDaDependencia(dep: string): string {
  return dep.replace(/^@wicomm\//, "")
}

export const TEMAS = [
  { id: "claro", titulo: "Claro" },
  { id: "escuro", titulo: "Escuro" },
] as const

export type Tema = (typeof TEMAS)[number]["id"]
