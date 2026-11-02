import { Suspense } from "react"

import { EditorNoNext } from "@/registry/design-system/blocks/editor/editor-no-next"
import { cargaDoEditor } from "@/registry/design-system/blocks/editor/dados-do-editor"

type Rota = Promise<{ id: string }>
type Busca = Promise<{ estado?: string }>

async function EditorDoEndereco({ params, searchParams }: { params: Rota; searchParams: Busca }) {
  const [{ id }, { estado }] = await Promise.all([params, searchParams])
  return <EditorNoNext key={estado ?? "pronto"} carga={cargaDoEditor(id, estado)} />
}

/**
 * A página de EXEMPLO do Editor, fora do casco (ANATOMIA CASCO-01). `?estado=`
 * escolhe o momento (`carregando`, `erro-de-carga`, `vazio`, `nada-selecionado`, `andando`,
 * `erro`, `recusa`, `sucesso`, `sem-permissao`). A espera da leitura é o
 * estado de carregando do próprio Editor.
 */
export default function PaginaDoEditor({ params, searchParams }: { params: Rota; searchParams: Busca }) {
  return (
    <Suspense fallback={<EditorNoNext carga={cargaDoEditor("", "carregando")} />}>
      <EditorDoEndereco params={params} searchParams={searchParams} />
    </Suspense>
  )
}
