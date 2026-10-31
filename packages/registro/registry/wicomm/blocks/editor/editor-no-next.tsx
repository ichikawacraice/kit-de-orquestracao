"use client"

import Link from "next/link"

import { CascoDoEditor, EditorDeDocumento } from "@/registry/wicomm/blocks/editor/editor-de-documento"
import type { CargaDoEditor } from "@/registry/wicomm/blocks/editor/dados-do-editor"

/**
 * A cola do Editor com o Next (EXEMPLO): o link pelo `next/link`. A conta e o
 * "Sair" vêm da autenticação do app; aqui são de mentira. Num app Vite, a mesma
 * cola usa o roteador dele.
 */
export function EditorNoNext({ carga }: { carga: CargaDoEditor }) {
  return (
    <CascoDoEditor link={Link}>
      <EditorDeDocumento carga={carga} conta={{ nome: "Ana Souza", email: "ana.souza@exemplo.com.br", onSair: () => {} }} />
    </CascoDoEditor>
  )
}
