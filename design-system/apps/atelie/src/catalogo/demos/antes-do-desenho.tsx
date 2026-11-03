import { CODIGO_ANTES_DO_DESENHO } from "@/lib/antes-do-desenho"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDeAntesDoDesenho() {
  return (
    <Amostras>
      <Amostra titulo="O script do <head> do layout raiz" primeira>
        <p className="max-w-medida text-sm text-foreground-2">
          Marca o tema e a barra recolhida no &lt;html&gt; antes do primeiro desenho: o F5 não pisca nem pula. No Next, vai
          como &lt;ScriptsAntesDoDesenho /&gt; no layout raiz; no Vite, no index.html.
        </p>
      </Amostra>
      <Amostra titulo="O código">
        <pre className="w-full overflow-x-auto rounded-cartao bg-muted p-3 font-mono text-xs text-foreground-2">
          <code>{CODIGO_ANTES_DO_DESENHO}</code>
        </pre>
      </Amostra>
    </Amostras>
  )
}
