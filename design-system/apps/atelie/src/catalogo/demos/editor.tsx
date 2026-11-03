"use client"

import { CascoDoEditor, EditorDeDocumento } from "@/registry/design-system/blocks/editor/editor-de-documento"
import { cargaDoEditor } from "@/registry/design-system/blocks/editor/dados-do-editor"

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
