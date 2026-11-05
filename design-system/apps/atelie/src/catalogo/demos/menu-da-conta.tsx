"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { MenuDaConta, Monograma } from "@/components/ui/menu-da-conta"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoMenuDaConta() {
  const [desfecho, setDesfecho] = React.useState("Nenhuma ação escolhida.")
  return (
    <Amostras>
      <Amostra titulo="O menu da conta" primeira>
        <MenuDaConta
          id="pessoa-ana"
          nome="Ana Souza"
          email="ana.souza@exemplo.com.br"
          onAbrirConta={() => setDesfecho("Abrir a conta.")}
          onSair={() => setDesfecho("Sair.")}
        >
          <Button variant="ghost">
            <Monograma nome="Ana Souza" chave="pessoa-ana" />
            Ana Souza
          </Button>
        </MenuDaConta>
        <p role="status" className="text-sm text-foreground-2">
          {desfecho}
        </p>
      </Amostra>
    </Amostras>
  )
}
