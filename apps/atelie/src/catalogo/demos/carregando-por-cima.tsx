"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { CarregandoPorCima } from "@/components/ui/carregando-por-cima"
import { Ficha, ParDaFicha } from "@/components/ui/ficha"

import { Amostra, Amostras } from "./_amostra"

function Versao({ numero }: { numero: number }) {
  return (
    <Ficha>
      <ParDaFicha rotulo="Versão">{numero}</ParDaFicha>
      <ParDaFicha rotulo="Publicada em">{numero === 1 ? "12/10/2026" : "28/10/2026"}</ParDaFicha>
      <ParDaFicha rotulo="Autor">{numero === 1 ? "Ana Souza" : "Bruno Lima"}</ParDaFicha>
    </Ficha>
  )
}

export default function DemoDoCarregandoPorCima() {
  const [versao, setVersao] = React.useState(1)
  const [trocando, setTrocando] = React.useState(false)
  const trocar = (espera: number) => {
    setTrocando(true)
    setTimeout(() => {
      setVersao((v) => (v === 1 ? 2 : 1))
      setTrocando(false)
    }, espera)
  }
  return (
    <Amostras>
      <Amostra titulo="A troca de contexto" primeira>
        <div className="flex w-full flex-col gap-3">
          <div className="flex gap-2">
            <Button variant="secondary" aria-disabled={trocando || undefined} onClick={() => !trocando && trocar(2000)}>
              Trocar de versão
            </Button>
            <Button variant="ghost" aria-disabled={trocando || undefined} onClick={() => !trocando && trocar(80)}>
              Troca rápida
            </Button>
          </div>
          <CarregandoPorCima ativo={trocando} frase="Abrindo a versão" className="max-w-md rounded-xl bg-muted p-4">
            <Versao numero={versao} />
          </CarregandoPorCima>
        </div>
      </Amostra>
      <Amostra titulo="O gatilho dentro da região: o foco vai ao cartão e volta">
        <CarregandoPorCima ativo={trocando} frase="Abrindo a versão" className="w-full max-w-md rounded-xl bg-muted p-4">
          <div className="flex flex-col gap-3">
            <Versao numero={versao} />
            <Button variant="outline" size="sm" className="self-start" onClick={() => trocar(2000)}>
              Abrir a outra versão
            </Button>
          </div>
        </CarregandoPorCima>
      </Amostra>
      <Amostra titulo="Numa região de altura fixa: a rolagem segue">
        <CarregandoPorCima ativo={trocando} frase="Abrindo a versão" className="h-40 w-full max-w-md overflow-hidden rounded-xl bg-muted">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {Array.from({ length: 12 }, (_, n) => (
              <p key={n} className="t-denso py-1">
                Linha {n + 1} da versão {versao}
              </p>
            ))}
          </div>
        </CarregandoPorCima>
      </Amostra>
      <Amostra titulo="Parado, para conferir o véu">
        <CarregandoPorCima ativo frase="Abrindo a versão" className="w-full max-w-md rounded-xl bg-muted p-4">
          <Versao numero={2} />
        </CarregandoPorCima>
      </Amostra>
    </Amostras>
  )
}
