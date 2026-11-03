"use client"

import * as React from "react"

import { COR_DO_TOM_DENSO, type Tom } from "@/registry/design-system/lib/idioma-de-cor"
import { cn } from "@/registry/design-system/lib/utils"
import { Button } from "@/registry/design-system/ui/button"
import { Card } from "@/registry/design-system/ui/card"
import { Input } from "@/registry/design-system/ui/input"
import { Label } from "@/registry/design-system/ui/label"
import { Logotipo } from "@/registry/design-system/ui/logotipo"

type MomentoDaEntrada = "pronto" | "andando" | "erro-campo" | "erro" | "recusa"

type Desfecho = { tom: Extract<Tom, "ruim" | "alheio">; texto: string }

const DESFECHO_DO_MOMENTO: Partial<Record<MomentoDaEntrada, Desfecho>> = {
  erro: { tom: "ruim", texto: "E-mail ou senha não conferem." },
  recusa: { tom: "alheio", texto: "Esta conta não tem acesso a este app. Fale com quem administra." },
}

const EMAIL_COMPLETO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * O arquétipo ENTRADA (ANATOMIA ARQ-01): *qual é o único passo?* — o cartão
 * sozinho no fundo, fora do casco, e uma ação `xl` (CTRL-02: o botão que
 * conclui é `xl`, os campos `xl`, nada `sm`).
 *
 * - O rótulo de campo é frase de quem usa (`voz="campo"`): a Entrada é vista
 *   por quem não opera o dia todo (DENS-02).
 * - A validação de um campo mora no campo (`aria-describedby`); a recusa do
 *   passo inteiro mora no cartão, acima do botão, e o foco volta ao primeiro
 *   campo (MSG-04). Nunca o erro cru do servidor (MSG-03).
 * - EXEMPLO: `aoEntrar` é a autenticação do app; sem ela, a recusa de exemplo.
 */
function TelaDeEntrada({
  momento = "pronto",
  aoEntrar,
  hrefDeSenhaNova = "#",
}: {
  momento?: MomentoDaEntrada
  /** Devolve o desfecho da recusa, ou `null` quando entrou (e o app navega). */
  aoEntrar?: (email: string, senha: string) => Promise<Desfecho | null>
  hrefDeSenhaNova?: string
}) {
  const [andando, setAndando] = React.useState(momento === "andando")
  const [erroDoEmail, setErroDoEmail] = React.useState<string | null>(momento === "erro-campo" ? "Escreva um e-mail completo." : null)
  const [desfecho, setDesfecho] = React.useState<Desfecho | null>(DESFECHO_DO_MOMENTO[momento] ?? null)
  const emailRef = React.useRef<HTMLInputElement>(null)
  const idDoErro = React.useId()
  const idDoDesfecho = React.useId()

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const dados = new FormData(e.currentTarget)
    const email = String(dados.get("email") ?? "")
    const senha = String(dados.get("senha") ?? "")
    setDesfecho(null)
    if (!EMAIL_COMPLETO.test(email)) {
      setErroDoEmail("Escreva um e-mail completo.")
      emailRef.current?.focus()
      return
    }
    setErroDoEmail(null)
    setAndando(true)
    const recusa = aoEntrar
      ? await aoEntrar(email, senha)
      : await new Promise<Desfecho>((ok) => setTimeout(() => ok(DESFECHO_DO_MOMENTO.erro!), 900))
    setAndando(false)
    if (recusa) {
      setDesfecho(recusa)
      emailRef.current?.focus()
    }
  }

  return (
    <div data-slot="tela-de-entrada" className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <Card className="flex w-full max-w-sm flex-col gap-6 p-6">
        <div className="flex flex-col gap-3">
          <Logotipo variante="horizontal" />
          <h1 className="t-display">Entrar</h1>
        </div>
        <form noValidate onSubmit={enviar} aria-describedby={desfecho ? idDoDesfecho : undefined} className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entrada-email" voz="campo">
                E-mail
              </Label>
              <Input
                ref={emailRef}
                id="entrada-email"
                name="email"
                type="email"
                autoComplete="email"
                tamanho="xl"
                // No exemplo, os momentos depois do envio mostram o e-mail que foi enviado.
                defaultValue={momento === "pronto" || momento === "erro-campo" ? undefined : "ana.souza@exemplo.com.br"}
                readOnly={andando}
                aria-invalid={erroDoEmail ? true : undefined}
                aria-describedby={erroDoEmail ? idDoErro : undefined}
              />
              {erroDoEmail ? (
                <p id={idDoErro} className={cn("text-legenda", COR_DO_TOM_DENSO.ruim)}>
                  {erroDoEmail}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="entrada-senha" voz="campo">
                  Senha
                </Label>
                <Button asChild variant="link" className="text-legenda">
                  <a href={hrefDeSenhaNova}>Esqueci a senha</a>
                </Button>
              </div>
              <Input
                id="entrada-senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                tamanho="xl"
                defaultValue={momento === "pronto" || momento === "erro-campo" ? undefined : "senha-de-exemplo"}
                readOnly={andando}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {desfecho ? (
              <p id={idDoDesfecho} role="alert" data-tom={desfecho.tom} className={cn("t-denso", COR_DO_TOM_DENSO[desfecho.tom])}>
                {desfecho.texto}
              </p>
            ) : null}
            <Button type="submit" size="xl" disabled={andando}>
              {andando ? "Entrando" : "Entrar"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export { TelaDeEntrada, type MomentoDaEntrada }
