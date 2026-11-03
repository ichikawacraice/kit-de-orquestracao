"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Faixa } from "@/components/ui/faixa"
import { Painel, RolagemDoPainel } from "@/components/ui/painel"
import { TopoDaPagina } from "@/components/ui/topo-da-pagina"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDaFaixa() {
  const [voltando, setVoltando] = React.useState(false)
  const [falhou, setFalhou] = React.useState(false)
  return (
    <Amostras>
      <Amostra titulo="Espera: a saída na própria faixa (cada amostra é uma tela)" primeira>
        <Faixa
          className="w-full"
          linhas={[
            {
              assunto: "versao",
              tom: "espera",
              frase: "Você está vendo uma versão que não está no ar.",
              saida: (
                <Button
                  variant="outline"
                  size="sm"
                  aria-disabled={voltando || undefined}
                  onClick={() => {
                    if (voltando) return
                    setVoltando(true)
                    setTimeout(() => setVoltando(false), 1500)
                  }}
                >
                  {voltando ? "Voltando" : "Voltar à versão no ar"}
                </Button>
              ),
            },
          ]}
        />
      </Amostra>
      <Amostra titulo="Ruim: a saída que falhou troca a frase">
        <Faixa
          className="w-full"
          linhas={[
            {
              assunto: "erro",
              tom: "ruim",
              frase: falhou
                ? "Não deu para publicar de novo. O que está no ar segue sendo a versão anterior."
                : "Não deu para publicar: o que está no ar é a versão anterior.",
              saida: (
                <Button variant="outline" size="sm" onClick={() => setFalhou(true)}>
                  Publicar de novo
                </Button>
              ),
            },
          ]}
        />
      </Amostra>
      <Amostra titulo="Neutro: sem pedido, sem saída obrigatória">
        <Faixa className="w-full" linhas={[{ assunto: "escopo", tom: "neutro", frase: "Você está vendo só os projetos da sua equipe." }]} />
      </Amostra>
      <Amostra titulo="Alheio: quem resolve é outra equipe">
        <Faixa
          className="w-full"
          linhas={[{ assunto: "conexao", tom: "alheio", frase: "O serviço de pagamentos está fora do ar; a equipe de finanças já foi avisada." }]}
        />
      </Amostra>
      <Amostra titulo="Vários assuntos numa faixa só, na ordem da regra">
        <Faixa
          className="w-full"
          linhas={[
            { assunto: "escopo", tom: "neutro", frase: "Você está vendo só os projetos da sua equipe." },
            { assunto: "previa", tom: "neutro", frase: "Prévia: as mudanças ainda não foram publicadas." },
            {
              assunto: "erro",
              tom: "ruim",
              frase: "Não deu para salvar o rascunho agora. As mudanças seguem nesta tela.",
              saida: (
                <Button variant="outline" size="sm">
                  Salvar de novo
                </Button>
              ),
            },
          ]}
        />
      </Amostra>
      <Amostra titulo="No lugar dela: abaixo do topo, fora da região que rola">
        <div className="flex h-56 w-full flex-col gap-3 rounded-xl bg-background p-4">
          <TopoDaPagina titulo="Relatório de outubro" />
          <Faixa linhas={[{ assunto: "previa", tom: "neutro", frase: "Prévia: as mudanças ainda não foram publicadas." }]} />
          <Painel className="min-h-0 flex-1">
            <RolagemDoPainel densidade="compacta" className="pt-4">
              {Array.from({ length: 8 }, (_, n) => (
                <p key={n} className="t-denso py-1">
                  Linha {n + 1} do relatório
                </p>
              ))}
            </RolagemDoPainel>
          </Painel>
        </div>
      </Amostra>
      <Amostra titulo="Frase longa, a 1280 px">
        <Faixa
          className="w-full"
          linhas={[
            {
              assunto: "versao",
              tom: "espera",
              frase:
                "Você está editando a versão de 28/10, que não é a que está no ar: o que mudar aqui só vale para quem usa depois de publicar, e a versão no ar segue como está até lá.",
              saida: (
                <Button variant="outline" size="sm">
                  Voltar à versão no ar
                </Button>
              ),
            },
          ]}
        />
      </Amostra>
    </Amostras>
  )
}
