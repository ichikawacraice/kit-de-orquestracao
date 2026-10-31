import { BarraDoEditor } from '@/components/ui/barra-do-editor'
import { Card } from '@/components/ui/card'

export function EditorDoDocumento() {
  return (
    <div className="flex h-screen flex-col gap-2 p-2">
      <BarraDoEditor voltar="/documentos" nome="O documento" />
      <Card>A página do documento</Card>
    </div>
  )
}
