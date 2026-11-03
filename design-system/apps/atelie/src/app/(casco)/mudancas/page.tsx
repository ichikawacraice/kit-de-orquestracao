import { HistoryIcon } from "lucide-react"

import { Bloco } from "@/components/ui/bloco"
import { Secao } from "@/components/ui/secao"
import { Vazio } from "@/components/ui/vazio"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { mudancas } from "@/vitrine/mudancas"

export const metadata = { title: "Mudanças" }

const PROSA = "flex flex-col gap-1 text-sm text-foreground-2 [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5"

export default function Mudancas() {
  const versoes = mudancas()
  return (
    <PaginaDaVitrine
      titulo="Mudanças"
      abertura="O que mudou em cada versão do sistema e o que fazer num projeto que já o usa, da versão mais nova para a mais velha."
    >
      {versoes.length === 0 ? (
        <Bloco titulo="Versões">
          <Vazio causa="nada-ainda" icone={HistoryIcon} titulo="Ainda não há versão registrada" />
        </Bloco>
      ) : (
        versoes.map((v) => (
          <Bloco key={v.versao} nome={`v${v.versao}`} titulo={`Versão ${v.versao}`} legenda={`${v.data} · ${v.camadas.join(", ")}`} className="flex max-w-medida flex-col gap-6">
            <Secao titulo="O que muda" primeira>
              <div className={PROSA} dangerouslySetInnerHTML={{ __html: v.muda }} />
            </Secao>
            <Secao titulo="Migração" primeira>
              <div className={PROSA} dangerouslySetInnerHTML={{ __html: v.migracao }} />
            </Secao>
          </Bloco>
        ))
      )}
    </PaginaDaVitrine>
  )
}
