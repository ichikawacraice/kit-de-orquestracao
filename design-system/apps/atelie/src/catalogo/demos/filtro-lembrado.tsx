"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { OpcaoDeMarcar } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { algumasDas, chaveDoFiltro, useFiltroLembrado, verdadeiroOuFalso, type Esquema } from "@/lib/filtro-lembrado"

import { Amostra, Amostras } from "./_amostra"

const ESTADOS = ["Aberto", "Aguarda você", "Feito"] as const
type Filtros = { estados: string[]; meus: boolean }
const PADRAO: Filtros = { estados: [], meus: false }
const ESQUEMA: Esquema<Filtros> = { estados: algumasDas(ESTADOS), meus: verdadeiroOuFalso }
const DONO = { app: "atelie", tela: "demonstracao", versao: 1, pessoa: "quem-ve" }

export default function DemoDoFiltroLembrado() {
  const { filtros, lido, foraDoPadrao, mudar, limpar } = useFiltroLembrado({ ...DONO, padrao: PADRAO, esquema: ESQUEMA })
  const alternar = (estado: string, marcado: boolean) =>
    mudar({ estados: marcado ? [...filtros.estados, estado] : filtros.estados.filter((e) => e !== estado) })

  return (
    <Amostras>
      <Amostra titulo="Escolha um recorte e recarregue a página: ele volta como você deixou" primeira>
        {lido ? (
          <>
            {ESTADOS.map((estado) => (
              <OpcaoDeMarcar
                key={estado}
                rotulo={estado}
                checked={filtros.estados.includes(estado)}
                onCheckedChange={(v) => alternar(estado, v === true)}
              />
            ))}
            <OpcaoDeMarcar rotulo="Só os meus" checked={filtros.meus} onCheckedChange={(v) => mudar({ meus: v === true })} />
            {foraDoPadrao && (
              <Button variant="ghost" size="sm" onClick={limpar}>
                Limpar filtros
              </Button>
            )}
          </>
        ) : (
          <Skeleton className="h-ctrl w-72" />
        )}
      </Amostra>
      <Amostra titulo="A chave no navegador">
        <code className="font-mono text-xs text-foreground-2">{chaveDoFiltro(DONO)}</code>
      </Amostra>
    </Amostras>
  )
}
