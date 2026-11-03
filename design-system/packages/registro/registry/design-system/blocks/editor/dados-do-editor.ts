/**
 * Os dados do EXEMPLO do Editor — o projeto apaga este arquivo e liga o próprio
 * documento. `?estado=` na página de exemplo escolhe o momento da tela.
 */
export type TipoDeSecao = "capa" | "texto" | "lista" | "assinatura"

export type Alinhamento = "esquerda" | "centro"
export type Fundo = "liso" | "tinta"

export type SecaoDoDocumento = {
  id: string
  tipo: TipoDeSecao
  nome: string
  titulo: string
  subtitulo: string
  alinhamento: Alinhamento
  fundo: Fundo
}

export type MomentoDoEditor =
  | "carregando"
  | "erro-de-carga"
  | "vazio"
  | "nada-selecionado"
  | "pronto"
  | "andando"
  | "erro"
  | "recusa"
  | "sucesso"
  | "sem-permissao"

export type CargaDoEditor = {
  momento: MomentoDoEditor
  documento: { id: string; nome: string }
  secoes: SecaoDoDocumento[]
  /** A seção aberta no inspector ao chegar; `null`, nada selecionado. */
  selecionada: string | null
  /** Quantas mudanças o rascunho tem sobre o que está no ar. */
  mudancas: number
}

export const MOMENTOS: MomentoDoEditor[] = ["carregando", "erro-de-carga", "vazio", "nada-selecionado", "pronto", "andando", "erro", "recusa", "sucesso", "sem-permissao"]

const SECOES: SecaoDoDocumento[] = [
  { id: "capa", tipo: "capa", nome: "Capa", titulo: "Proposta de parceria", subtitulo: "Para a equipe de compras", alinhamento: "centro", fundo: "tinta" },
  { id: "introducao", tipo: "texto", nome: "Introdução", titulo: "Por que agora", subtitulo: "O que muda no próximo trimestre", alinhamento: "esquerda", fundo: "liso" },
  { id: "itens", tipo: "lista", nome: "Itens", titulo: "O que entra", subtitulo: "Três frentes, com prazo e responsável", alinhamento: "esquerda", fundo: "liso" },
  { id: "assinatura", tipo: "assinatura", nome: "Assinatura", titulo: "De acordo", subtitulo: "Assinam as duas partes", alinhamento: "esquerda", fundo: "liso" },
]

export function cargaDoEditor(id: string, estado: string | undefined): CargaDoEditor {
  const momento = MOMENTOS.includes(estado as MomentoDoEditor) ? (estado as MomentoDoEditor) : "pronto"
  const documento = { id, nome: "Proposta comercial" }
  if (momento === "vazio") return { momento, documento, secoes: [], selecionada: null, mudancas: 0 }
  // A recusa: o título da capa ficou vazio, e o documento não publica com ele assim.
  const secoes = momento === "recusa" ? SECOES.map((s) => (s.id === "capa" ? { ...s, titulo: "" } : s)) : SECOES
  const mudancas = momento === "sucesso" ? 0 : 2
  // O pouso: a Capa aberta no inspector. O carregando já pousa com seleção, para a forma não mudar quando a carga chega.
  const selecionada = momento === "nada-selecionado" || momento === "erro-de-carga" ? null : momento === "recusa" ? "itens" : "capa"
  return { momento, documento, secoes, selecionada, mudancas }
}

/** O que falta para publicar: cada seção com título vazio é uma pendência. */
export function pendenciasDe(secoes: SecaoDoDocumento[]): SecaoDoDocumento[] {
  return secoes.filter((s) => s.titulo.trim() === "")
}
