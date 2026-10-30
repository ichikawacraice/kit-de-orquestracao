"use client"

import { Input, classeDoCampo } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoCampo() {
  return (
    <Amostras>
      <Amostra titulo="Padrão" primeira>
        <div className="flex w-64 flex-col gap-1.5">
          <Label htmlFor="demo-campo-nome">Nome</Label>
          <Input id="demo-campo-nome" placeholder="Como aparece na lista" />
        </div>
        <div className="flex w-64 flex-col gap-1.5">
          <Label htmlFor="demo-campo-off">Código</Label>
          <Input id="demo-campo-off" defaultValue="WC-0142" disabled />
        </div>
      </Amostra>
      <Amostra titulo="Tela de entrada (xl)">
        <div className="flex w-72 flex-col gap-1.5">
          <Label htmlFor="demo-campo-email">E-mail</Label>
          <Input id="demo-campo-email" tamanho="xl" type="email" placeholder="voce@wicomm.com.br" />
        </div>
      </Amostra>
      <Amostra titulo="Controle nativo com a forma do campo">
        <div className="flex w-64 flex-col gap-1.5">
          <Label htmlFor="demo-campo-nota">Observação</Label>
          <textarea id="demo-campo-nota" rows={3} className={classeDoCampo() + " h-auto py-2"} />
        </div>
      </Amostra>
    </Amostras>
  )
}
