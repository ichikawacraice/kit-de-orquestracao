"use client"

import { CascoDoEditor, EditorDeDocumento } from "@/registry/wicomm/blocks/editor/editor-de-documento"
import { cargaDoEditor } from "@/registry/wicomm/blocks/editor/dados-do-editor"

import { CONTA, LinkDoPalco, Tela } from "./_tela"

export default function DemoDoEditor() {
  return (
    <Tela>
      <CascoDoEditor link={LinkDoPalco}>
        <EditorDeDocumento carga={cargaDoEditor("7", undefined)} conta={CONTA} />
      </CascoDoEditor>
    </Tela>
  )
}
