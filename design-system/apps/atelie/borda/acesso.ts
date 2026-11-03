// A guarda de acesso do ateliê: o Routing Middleware da Vercel (`proxy` do
// vercel.json) roda antes de todo arquivo do site estático. Abre para quem
// manda a senha compartilhada (Basic Auth, o navegador pergunta e lembra) e,
// só no registro (`/r/`), para o `shadcn add` dos projetos, que manda o segredo
// de bypass da Vercel pelo `components.json`. Sem senha no ambiente, fecha: nunca abre por falta
// de configuração. Como pedir acesso e trocar a senha: docs/publicar-atelie.md.
import { createHash, timingSafeEqual } from "node:crypto"
import { next } from "@vercel/functions"

type Ambiente = Partial<Record<"ATELIE_SENHA" | "VERCEL_AUTOMATION_BYPASS_SECRET", string>>
export type Decisao = "liberar" | "pedir-senha" | "sem-senha"

// Compara pelo hash: o tempo não depende do tamanho nem do primeiro caractere errado.
const igual = (a: string, b: string) =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest())

function senhaDoPedido(request: Request): string | null {
  const [esquema, credencial] = (request.headers.get("authorization") ?? "").split(" ")
  if (esquema?.toLowerCase() !== "basic" || !credencial) return null
  const usuarioESenha = Buffer.from(credencial, "base64").toString("utf8")
  const separador = usuarioESenha.indexOf(":")
  // O usuário não importa: só a senha, que pode ter dois-pontos.
  return separador < 0 ? null : usuarioESenha.slice(separador + 1)
}

export function decidir(request: Request, env: Ambiente): Decisao {
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET
  const bypassDoPedido = request.headers.get("x-vercel-protection-bypass")
  // O segredo circula no ambiente de cada dev e CI: abre só o registro, nunca a vitrine.
  const noRegistro = new URL(request.url).pathname.startsWith("/r/")
  if (noRegistro && bypass && bypassDoPedido && igual(bypassDoPedido, bypass)) return "liberar"

  const senha = env.ATELIE_SENHA?.trim()
  if (!senha) return "sem-senha"
  const senhaDoPedidoAtual = senhaDoPedido(request)
  return senhaDoPedidoAtual !== null && igual(senhaDoPedidoAtual, senha) ? "liberar" : "pedir-senha"
}

export function responder(request: Request, env: Ambiente): Response {
  switch (decidir(request, env)) {
    case "liberar":
      return next()
    case "sem-senha":
      return new Response("O ateliê está sem senha configurada (ATELIE_SENHA), e fica fechado até ela voltar.\n", {
        status: 503,
        headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
      })
    case "pedir-senha":
      return new Response("O ateliê da Wicomm pede a senha. Como pedir acesso: fale com o time de design system.\n", {
        status: 401,
        headers: {
          "www-authenticate": 'Basic realm="Atelie Wicomm", charset="UTF-8"',
          "cache-control": "no-store",
          "content-type": "text/plain; charset=utf-8",
        },
      })
  }
}

// A Vercel chama com (request, context): o ambiente vem sempre do processo.
export default function acesso(request: Request): Response {
  const { ATELIE_SENHA, VERCEL_AUTOMATION_BYPASS_SECRET } = process.env
  return responder(request, { ATELIE_SENHA, VERCEL_AUTOMATION_BYPASS_SECRET })
}
