"use client"

import * as React from "react"

const EVENTO = "parametro-do-endereco"

/**
 * Um parâmetro do endereço (`?q=`, `?movimento=`) como estado de vista
 * (CONV-06). Lido depois de montar, e não pelo gancho do roteador: a página
 * estática nasce inteira no HTML, e o filtro se aplica ao montar. `pronto` diz
 * se o endereço já foi lido, para o campo não parecer filtrado antes.
 */
export function useParametroDoEndereco(nome: string): { valor: string; trocar: (novo: string) => void; pronto: boolean } {
  const [valor, setValor] = React.useState("")
  const [pronto, setPronto] = React.useState(false)
  React.useEffect(() => {
    const ler = () => setValor(new URLSearchParams(location.search).get(nome) ?? "")
    ler()
    setPronto(true)
    window.addEventListener("popstate", ler)
    window.addEventListener(EVENTO, ler)
    return () => {
      window.removeEventListener("popstate", ler)
      window.removeEventListener(EVENTO, ler)
    }
  }, [nome])
  const trocar = React.useCallback(
    (novo: string) => {
      const url = new URL(location.href)
      if (novo) url.searchParams.set(nome, novo)
      else url.searchParams.delete(nome)
      history.replaceState(history.state, "", url)
      // Quem mais lê o endereço (o filtro no topo e a lista na rolagem) relê junto.
      window.dispatchEvent(new Event(EVENTO))
    },
    [nome]
  )
  return { valor, trocar, pronto }
}

/** Sem acento e sem caixa: "Superfície" casa com "superficie". */
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
