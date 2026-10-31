import { describe, expect, it } from "vitest"
import { decidir, responder } from "../borda/acesso"

const ENV = { ATELIE_SENHA: "senha-certa", VERCEL_AUTOMATION_BYPASS_SECRET: "segredo-do-registro" }
const basic = (usuario: string, senha: string) => `Basic ${Buffer.from(`${usuario}:${senha}`).toString("base64")}`
const pedido = (cabecalhos: Record<string, string> = {}, caminho = "/") =>
  new Request(`https://atelie.exemplo${caminho}`, { headers: cabecalhos })

describe("a guarda de acesso do ateliê", () => {
  it("barra quem chega sem senha, pedindo a senha ao navegador", () => {
    expect(decidir(pedido(), ENV)).toBe("pedir-senha")
    const resposta = responder(pedido(), ENV)
    expect(resposta.status).toBe(401)
    expect(resposta.headers.get("www-authenticate")).toMatch(/^Basic realm="Atelie Wicomm"/)
    expect(resposta.headers.get("cache-control")).toBe("no-store")
  })

  it("barra a senha errada e a senha vazia", () => {
    expect(decidir(pedido({ authorization: basic("wicomm", "errada") }), ENV)).toBe("pedir-senha")
    expect(decidir(pedido({ authorization: basic("wicomm", "") }), ENV)).toBe("pedir-senha")
    expect(decidir(pedido({ authorization: "Basic !!!" }), ENV)).toBe("pedir-senha")
    expect(decidir(pedido({ authorization: "Bearer senha-certa" }), ENV)).toBe("pedir-senha")
  })

  it("abre com a senha certa, qualquer que seja o usuário, e a senha pode ter dois-pontos", () => {
    expect(decidir(pedido({ authorization: basic("", "senha-certa") }), ENV)).toBe("liberar")
    expect(decidir(pedido({ authorization: basic("maria", "senha-certa") }), ENV)).toBe("liberar")
    const comDoisPontos = { ...ENV, ATELIE_SENHA: "a:b:c" }
    expect(decidir(pedido({ authorization: basic("x", "a:b:c") }), comDoisPontos)).toBe("liberar")
    expect(responder(pedido({ authorization: basic("x", "senha-certa") }), ENV).headers.get("x-middleware-next")).toBe("1")
  })

  it("abre o registro para o cabeçalho de bypass da Vercel, o que o components.json dos projetos já manda", () => {
    const comBypass = { "x-vercel-protection-bypass": "segredo-do-registro" }
    expect(decidir(pedido(comBypass, "/r/v0.1.0/button.json"), ENV)).toBe("liberar")
    expect(decidir(pedido({ "x-vercel-protection-bypass": "outro" }, "/r/v0.1.0/button.json"), ENV)).toBe("pedir-senha")
  })

  it("o segredo do registro não abre a vitrine", () => {
    const comBypass = { "x-vercel-protection-bypass": "segredo-do-registro" }
    for (const caminho of ["/", "/catalogo/button/", "/regras/", "/rr/x.json"]) {
      expect(decidir(pedido(comBypass, caminho), ENV)).toBe("pedir-senha")
    }
  })

  it("sem segredo de bypass no ambiente, o cabeçalho vazio não abre nada", () => {
    const semBypass = { ATELIE_SENHA: "senha-certa" }
    expect(decidir(pedido({ "x-vercel-protection-bypass": "" }, "/r/v0.1.0/registry.json"), semBypass)).toBe("pedir-senha")
    expect(decidir(pedido({ "x-vercel-protection-bypass": "undefined" }, "/r/v0.1.0/registry.json"), semBypass)).toBe("pedir-senha")
  })

  it("sem senha configurada, fecha o site inteiro em vez de abrir", () => {
    for (const env of [{}, { ATELIE_SENHA: "" }, { ATELIE_SENHA: "   " }]) {
      expect(decidir(pedido({ authorization: basic("x", "") }), env)).toBe("sem-senha")
      expect(responder(pedido(), env).status).toBe(503)
    }
    // O bypass do registro segue valendo: a falta da senha não derruba o `shadcn add`.
    expect(decidir(pedido({ "x-vercel-protection-bypass": "segredo-do-registro" }, "/r/v0.1.0/registry.json"), { VERCEL_AUTOMATION_BYPASS_SECRET: "segredo-do-registro" })).toBe("liberar")
  })
})
