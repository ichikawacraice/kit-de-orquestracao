"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoSeletor() {
  return (
    <Amostras>
      <Amostra titulo="Seletor" primeira>
        <div className="flex w-64 flex-col gap-1.5">
          <Label id="demo-seletor-rotulo">Situação</Label>
          <Select defaultValue="aberto">
            <SelectTrigger aria-labelledby="demo-seletor-rotulo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aberto">Em aberto</SelectItem>
              <SelectItem value="andamento">Em andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-64 flex-col gap-1.5">
          <Label id="demo-seletor-vazio">Responsável</Label>
          <Select>
            <SelectTrigger aria-labelledby="demo-seletor-vazio">
              <SelectValue placeholder="Escolha uma pessoa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ana">Ana</SelectItem>
              <SelectItem value="bruno">Bruno</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Amostra>
    </Amostras>
  )
}
