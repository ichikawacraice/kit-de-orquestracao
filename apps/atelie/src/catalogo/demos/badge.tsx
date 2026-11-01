import { Badge } from "@/components/ui/badge"
import { ChipDeEstado } from "@/components/ui/chip-de-estado"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoValorRotulado() {
  return (
    <Amostras>
      <Amostra titulo="Neutro e de marca" primeira>
        <Badge>Plano anual</Badge>
        <Badge>Importado</Badge>
        {/* De marca, no máximo um por vista: o valor que a Wicomm assina. */}
        <Badge variant="marca">Recomendado</Badge>
      </Amostra>
      <Amostra titulo="Ao lado do estado: a mesma forma, outra função">
        <Badge>Plano anual</Badge>
        <ChipDeEstado tom="neutro">Rascunho</ChipDeEstado>
      </Amostra>
      <Amostra titulo="Numa linha">
        <span className="flex items-center gap-2 t-denso">
          Portal do cliente <Badge>Contrato mensal</Badge>
        </span>
      </Amostra>
      <Amostra titulo="Sobre os fundos">
        {["bg-card", "bg-background", "bg-muted"].map((fundo) => (
          <span key={fundo} className={`flex gap-2 rounded-lg p-3 ${fundo}`}>
            <Badge>Plano anual</Badge>
          </span>
        ))}
      </Amostra>
    </Amostras>
  )
}
