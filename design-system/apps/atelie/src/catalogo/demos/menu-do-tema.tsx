"use client"

import { Button } from "@/components/ui/button"
import { ICONE_DO_TEMA, MenuDoTema, ROTULO_DO_TEMA } from "@/components/ui/menu-do-tema"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoMenuDoTema() {
  return (
    <Amostras>
      <Amostra titulo="A escolha já é a ação" primeira>
        <MenuDoTema>
          {(tema) => {
            const Icone = ICONE_DO_TEMA[tema]
            return (
              <Button variant="secondary">
                <Icone />
                Tema: {ROTULO_DO_TEMA[tema].toLowerCase()}
              </Button>
            )
          }}
        </MenuDoTema>
        <p className="text-sm text-foreground-2">No ateliê, cada palco fica no tema dele; no app, a escolha troca a tela inteira.</p>
      </Amostra>
    </Amostras>
  )
}
