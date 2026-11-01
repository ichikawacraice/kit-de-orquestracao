"use client"

import * as React from "react"
import { CircleAlertIcon } from "lucide-react"

import { COR_DO_TOM_DENSO } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"
import { Button } from "@/registry/wicomm/ui/button"
import { Dialog, DialogFooter, DialogLongo } from "@/registry/wicomm/ui/dialog"

/** O que a linha de erro diz quando quem chama não traduz a falha. Não afirma que nada mudou: a peça não sabe. */
const FALHA_PADRAO = "Não deu para concluir agora. Tente de novo."
const ESPERA_ESGOTADA = "Está demorando mais que o normal. Confira se aconteceu antes de tentar de novo."

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
 * **A ação que roda no servidor e pode falhar** passa `onConfirmar` (com o
 * `rotuloRodando`, que o tipo exige). Ela roda com o diálogo ABERTO:
 * - o confirmar vira o gerúndio e fica `aria-disabled` (guarda o foco, sem
 *   clique duplo); Cancelar, a alternativa e o X ficam desligados; Esc e
 *   clique fora não fecham; o corpo fica `inert`;
 * - a falha aparece no próprio diálogo, acima dos botões (MSG-04), na frase do
 *   `descreverErro` — nunca o erro técnico cru (MSG-03), que vai ao console — e
 *   o diálogo segue aberto para tentar de novo;
 * - passada a `esperaMaxima` (30s), a espera vira desfecho: tudo destrava e a
 *   linha pede para conferir antes de repetir (EST-03). Se a resposta chegar
 *   depois, vale ela;
 * - `pedir()` resolve `true` só depois do sucesso, que fecha o diálogo.
 *
 * Trabalho que vai para uma fila não usa `onConfirmar`: confirma, fecha, e a
 * rodada se acompanha no chip ou no botão (CONV-07).
 *
 * O destrutivo é a variante em contorno (MARCA-05). Os rótulos dos botões não
 * levam reticências (CTRL-07).
 */
function useConfirm(): [React.ReactNode, (opcoes: OpcoesDaConfirmacao) => Promise<boolean>, (pode: boolean) => void] {
  const [pedido, setPedido] = React.useState<(OpcoesDaConfirmacao & { resolve: (v: boolean) => void }) | null>(null)
  const [podeConfirmar, setPodeConfirmar] = React.useState(true)
  const [rodando, setRodandoNoEstado] = React.useState(false)
  // O mesmo `rodando`, para o `definirPodeConfirmar` ficar estável entre desenhos.
  const rodandoAgora = React.useRef(false)
  const setRodando = (valor: boolean) => {
    rodandoAgora.current = valor
    setRodandoNoEstado(valor)
  }
  const definirPodeConfirmar = React.useCallback((pode: boolean) => {
    if (!rodandoAgora.current) setPodeConfirmar(pode)
  }, [])
  const [aviso, setAviso] = React.useState<{ tom: "ruim" | "espera"; frase: string; chave: number } | null>(null)
  // A tentativa vigente. Resposta de uma tentativa que já não vale (o diálogo
  // fechou, ou outra começou) é ignorada.
  const tentativa = React.useRef(0)
  // Para onde o foco vai quando o diálogo sai de cena. Fica fora do estado:
  // `responder` zera o pedido antes de o diálogo desmontar, e é só nessa
  // desmontagem que o Radix devolve o foco.
  const devolverFoco = React.useRef<HTMLElement | null>(null)

  const pedir = React.useCallback(
    (opcoes: OpcoesDaConfirmacao) =>
      new Promise<boolean>((resolve) => {
        devolverFoco.current = opcoes.devolverFoco ?? null
        tentativa.current++
        rodandoAgora.current = false
        setPodeConfirmar(true)
        setRodandoNoEstado(false)
        setAviso(null)
        setPedido({ ...opcoes, resolve })
      }),
    []
  )

  const fechar = (valor: boolean) => {
    tentativa.current++
    pedido?.resolve(valor)
    setPedido(null)
    setPodeConfirmar(true)
    setRodando(false)
    setAviso(null)
  }

  const responder = (valor: boolean) => {
    if (rodando) return
    fechar(valor)
  }

  const confirmar = async () => {
    if (!pedido || rodando || !podeConfirmar) return
    if (!pedido.onConfirmar) return responder(true)
    const minha = ++tentativa.current
    const vale = () => tentativa.current === minha
    setRodando(true)
    setAviso(null)
    const relogio = setTimeout(() => {
      if (!vale()) return
      setRodando(false)
      setAviso({ tom: "espera", frase: ESPERA_ESGOTADA, chave: minha })
    }, pedido.esperaMaxima ?? 30_000)
    try {
      await pedido.onConfirmar()
      clearTimeout(relogio)
      if (!vale()) return
      pedido.resolve(true)
      tentativa.current++
      setPedido(null)
      setPodeConfirmar(true)
      setRodando(false)
      setAviso(null)
    } catch (erro) {
      clearTimeout(relogio)
      if (!vale()) return
      // O erro cru é de quem opera (MSG-03): vai ao console, não à tela.
      console.error(erro)
      setRodando(false)
      setAviso({ tom: "ruim", frase: fraseDoErro(pedido.descreverErro, erro), chave: minha })
    }
  }

  const travar = (e: Event) => {
    if (rodando) e.preventDefault()
  }

  const elemento = (
    <Dialog open={pedido !== null} onOpenChange={(aberto) => !aberto && responder(false)}>
      <DialogLongo
        largura="sm:max-w-lg"
        titulo={pedido?.titulo}
        descricao={pedido?.descricao}
        aria-busy={rodando || undefined}
        fecharDesligado={rodando}
        onEscapeKeyDown={travar}
        onPointerDownOutside={travar}
        onInteractOutside={travar}
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
          <div className="flex flex-col gap-2">
            {aviso ? (
              // A chave é a tentativa: a segunda falha igual é anunciada de novo.
              <p
                key={aviso.chave}
                role="alert"
                data-slot="erro-da-confirmacao"
                data-tom={aviso.tom}
                className={cn("t-denso flex items-start gap-1.5", COR_DO_TOM_DENSO[aviso.tom])}
              >
                <CircleAlertIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                {aviso.frase}
              </p>
            ) : null}
            <DialogFooter>
              <Button variant="ghost" disabled={rodando} onClick={() => responder(false)}>
                {pedido?.cancelar ?? "Cancelar"}
              </Button>
              {pedido?.alternativa ? (
                <Button
                  variant="outline"
                  disabled={rodando}
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
                aria-disabled={rodando || undefined}
                onClick={confirmar}
              >
                {rodando ? pedido?.rotuloRodando : (pedido?.confirmar ?? "Confirmar")}
              </Button>
            </DialogFooter>
            {/* O nome do botão que muda não é anunciado com confiança; esta linha é. */}
            <span role="status" className="sr-only">
              {rodando ? pedido?.rotuloRodando : ""}
            </span>
          </div>
        }
      >
        {/* O corpo rola dentro do diálogo: em janela baixa os botões do rodapé seguem à vista. Rodando, ele não muda mais. */}
        {pedido?.corpo ? <div inert={rodando || undefined}>{pedido.corpo}</div> : null}
      </DialogLongo>
    </Dialog>
  )

  return [elemento, pedir, definirPodeConfirmar]
}

function fraseDoErro(descrever: ((erro: unknown) => string) | undefined, erro: unknown) {
  try {
    return descrever?.(erro)?.trim() || FALHA_PADRAO
  } catch {
    return FALHA_PADRAO
  }
}

interface OpcoesBase {
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

/**
 * Sem `onConfirmar`, a confirmação de sempre: fecha e resolve. Com ele, a ação
 * roda com o diálogo aberto, e o tipo exige o `rotuloRodando` — o gerúndio do
 * botão enquanto roda ("Excluindo"), sem reticências.
 */
type OpcoesDaConfirmacao = OpcoesBase &
  (
    | { onConfirmar?: undefined; rotuloRodando?: undefined; descreverErro?: undefined; esperaMaxima?: undefined }
    | {
        onConfirmar: () => Promise<void>
        rotuloRodando: string
        /** A frase da falha para quem usa ("Outra pessoa mudou este relatório. Recarregue antes de excluir."). Vazia ou lançando, vale a padrão. */
        descreverErro?: (erro: unknown) => string
        /** Em milissegundos; padrão 30s. Passado esse tempo, a espera vira desfecho. */
        esperaMaxima?: number
      }
  )

export { useConfirm, type OpcoesDaConfirmacao }
