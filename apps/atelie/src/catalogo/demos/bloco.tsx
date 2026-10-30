"use client"

import { Button } from "@/components/ui/button"
import { Bloco } from "@/components/ui/bloco"

export default function DemoDoBloco() {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Bloco titulo="Dados do cliente" legenda="obrigatório" acao={<Button size="sm" variant="ghost">Editar</Button>} nivel={2}>
        <p className="text-sm text-foreground-2">O nome solto sobre o fundo, e o conteúdo num cartão.</p>
      </Bloco>
      <Bloco titulo="Histórico" recolhivel resumo="12 eventos desde agosto" abertoPorPadrao={false} nivel={2}>
        <p className="text-sm text-foreground-2">O bloco recolhível diz no cabeçalho o que tem dentro.</p>
      </Bloco>
    </div>
  )
}
