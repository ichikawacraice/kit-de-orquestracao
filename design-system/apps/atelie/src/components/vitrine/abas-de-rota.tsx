"use client"

import { useRouter } from "next/navigation"

import { BarraDeModos } from "@/components/ui/seletor-de-vista"

export type Aba = { chave: string; rotulo: string; href: string }

/**
 * Abas entre páginas irmãs (CTRL-06): a aba aberta é a rota (CONV-06), então
 * o link e o F5 abrem a mesma aba.
 */
export function AbasDeRota({ rotulo, abas, atual }: { rotulo: string; abas: Aba[]; atual: string }) {
  const router = useRouter()
  return (
    <BarraDeModos
      densidade="abas"
      rotulo={rotulo}
      modos={abas.map(({ chave, rotulo }) => ({ chave, rotulo }))}
      valor={atual}
      onTrocar={(chave) => {
        const aba = abas.find((a) => a.chave === chave)
        if (aba && chave !== atual) router.push(aba.href)
      }}
    />
  )
}
