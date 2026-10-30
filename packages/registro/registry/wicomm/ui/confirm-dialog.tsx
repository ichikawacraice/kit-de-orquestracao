"use client"

import * as React from "react"

import { Button } from "@/registry/wicomm/ui/button"
import { Dialog, DialogFooter, DialogLongo } from "@/registry/wicomm/ui/dialog"

/**
 * A confirmação — no lugar do `window.confirm`.
 *
 * O `confirm` nativo é do sistema operacional: não tem a tipografia nem as cores
 * do produto, aparece longe do botão que a pessoa clicou, não diz o que a ação
 * faz além de uma frase, e trava a página inteira.
 *
 * `useConfirm()` devolve a trinca `[elemento, pedir, definirPodeConfirmar]`:
 * - o `elemento` entra uma vez no componente;
 * - `pedir(opcoes)` abre o diálogo e resolve com a resposta — o código de quem
 *   chama fica tão direto quanto era com o `confirm`;
 * - `definirPodeConfirmar(false)` trava o botão de confirmar, para quem usa o
 *   `corpo` com um campo obrigatório. Cada pedido novo começa destravado.
 *
 * O destrutivo é a variante em contorno (MARCA-05). Os rótulos dos botões não
 * levam reticências (CTRL-07).
 */
function useConfirm(): [React.ReactNode, (opcoes: OpcoesDaConfirmacao) => Promise<boolean>, (pode: boolean) => void] {
  const [pedido, setPedido] = React.useState<(OpcoesDaConfirmacao & { resolve: (v: boolean) => void }) | null>(null)
  const [podeConfirmar, setPodeConfirmar] = React.useState(true)
  // Para onde o foco vai quando o diálogo sai de cena. Fica fora do estado:
  // `responder` zera o pedido antes de o diálogo desmontar, e é só nessa
  // desmontagem que o Radix devolve o foco.
  const devolverFoco = React.useRef<HTMLElement | null>(null)

  const pedir = React.useCallback(
    (opcoes: OpcoesDaConfirmacao) =>
      new Promise<boolean>((resolve) => {
        devolverFoco.current = opcoes.devolverFoco ?? null
        setPodeConfirmar(true)
        setPedido({ ...opcoes, resolve })
      }),
    []
  )

  const responder = (valor: boolean) => {
    pedido?.resolve(valor)
    setPedido(null)
    setPodeConfirmar(true)
  }

  const elemento = (
    <Dialog open={pedido !== null} onOpenChange={(aberto) => !aberto && responder(false)}>
      <DialogLongo
        largura="sm:max-w-lg"
        titulo={pedido?.titulo}
        descricao={pedido?.descricao}
        onCloseAutoFocus={(e) => {
          const alvo = devolverFoco.current
          devolverFoco.current = null
          // Só toma o foco se ninguém o levou para outro lugar (a ação confirmada pode ter focado um campo).
          const ativo = document.activeElement
          const solto = !ativo || ativo === document.body || !ativo.isConnected
          if (alvo?.isConnected && solto) {
            e.preventDefault()
            alvo.focus()
          }
        }}
        rodape={
          <DialogFooter>
            <Button variant="ghost" onClick={() => responder(false)}>
              {pedido?.cancelar ?? "Cancelar"}
            </Button>
            {pedido?.alternativa ? (
              <Button
                variant="outline"
                onClick={() => {
                  pedido.alternativa!.onEscolher()
                  responder(false)
                }}
              >
                {pedido.alternativa.rotulo}
              </Button>
            ) : null}
            <Button
              variant={pedido?.destrutivo ? "destructive" : "default"}
              disabled={!podeConfirmar}
              onClick={() => responder(true)}
            >
              {pedido?.confirmar ?? "Confirmar"}
            </Button>
          </DialogFooter>
        }
      >
        {/* O corpo rola dentro do diálogo: em janela baixa os botões do rodapé seguem à vista. */}
        {pedido?.corpo ?? null}
      </DialogLongo>
    </Dialog>
  )

  return [elemento, pedir, setPodeConfirmar]
}

interface OpcoesDaConfirmacao {
  titulo: string
  /** O que acontece de fato — é aqui que se diz o que NÃO se desfaz. */
  descricao?: string
  /** Um campo dentro da própria confirmação (o motivo escrito, por exemplo). Quem monta é dono do campo. */
  corpo?: React.ReactNode
  confirmar?: string
  cancelar?: string
  destrutivo?: boolean
  /**
   * Um gesto mais brando no lugar do destrutivo ("Arquivar em vez disso").
   * Escolher a alternativa roda o gesto dela e fecha com `false`: a ação
   * destrutiva não acontece.
   */
  alternativa?: { rotulo: string; onEscolher: () => void }
  /** Quem recebe o foco quando o diálogo sai, no lugar de quem o abriu (que pode ter desmontado). */
  devolverFoco?: HTMLElement | null
}

export { useConfirm, type OpcoesDaConfirmacao }
