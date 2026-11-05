"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { ChipQueAbre } from "@/components/ui/chip-de-estado"
import { IntervaloDeCampos } from "@/components/ui/intervalo-de-campos"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import { Amostra, Amostras } from "./_amostra"

function PopoverNaLargura({ largura, botao, children }: { largura?: "padrao" | "larga" | "conteudo"; botao: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {botao}
        </Button>
      </PopoverTrigger>
      <PopoverContent largura={largura}>{children}</PopoverContent>
    </Popover>
  )
}

function FiltroDoPrazo() {
  const [valor, setValor] = React.useState({ de: "2026-11-02", ate: "" })
  return (
    <PopoverNaLargura botao="Prazo">
      <IntervaloDeCampos legenda="Prazo" tipo="date" valor={valor} aoMudar={(lado, v) => setValor((a) => ({ ...a, [lado]: v }))} />
    </PopoverNaLargura>
  )
}

export default function DemoDoPopover() {
  const [aberto, setAberto] = React.useState(false)
  return (
    <Amostras>
      <Amostra titulo="O detalhe que o carimbo abre" primeira>
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverAnchor asChild>
            <ChipQueAbre tom="ruim" aberto={aberto} onAbrir={() => setAberto((a) => !a)}>
              Não publicou
            </ChipQueAbre>
          </PopoverAnchor>
          <PopoverContent>Não deu para publicar agora. As mudanças estão guardadas; tente publicar de novo em alguns minutos.</PopoverContent>
        </Popover>
      </Amostra>
      <Amostra titulo="As três larguras: padrão (288px), larga (320px) e a do conteúdo">
        <PopoverNaLargura botao="Padrão">O detalhe curto cabe na largura padrão, que quebra a frase em linhas de leitura.</PopoverNaLargura>
        <PopoverNaLargura botao="Larga" largura="larga">
          A larga é para o formulário curto com dois campos de texto, ou para a frase que precisa de mais ar.
        </PopoverNaLargura>
        <PopoverNaLargura botao="Do conteúdo" largura="conteudo">
          Só uma linha
        </PopoverNaLargura>
      </Amostra>
      <Amostra titulo="Um intervalo de datas dentro, na largura padrão">
        <FiltroDoPrazo />
      </Amostra>
      <Amostra titulo="Perto da borda direita: o popover abre para dentro e fica na janela">
        <div className="flex w-full justify-end gap-2">
          <PopoverNaLargura botao="Larga, na borda" largura="larga">
            A larga aberta de um gatilho encostado na borda: ela abre para dentro, sem passar da janela.
          </PopoverNaLargura>
          <FiltroDoPrazo />
        </div>
      </Amostra>
    </Amostras>
  )
}
