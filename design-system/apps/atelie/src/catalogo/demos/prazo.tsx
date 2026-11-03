import { Prazo } from "@/components/ui/prazo"

import { Amostra, Amostras } from "./_amostra"

// O dia de referência é fixo: a vitrine nasce no build e não pode mudar de texto ao abrir.
const HOJE = new Date("2026-07-12T12:00:00-03:00")

export default function DemoDoPrazo() {
  return (
    <Amostras>
      <Amostra titulo="Sem voz: nunca pinta" primeira>
        <div className="flex flex-wrap items-start gap-10">
          <Prazo periodo="2026-07-24" hoje={HOJE} />
          <Prazo periodo={{ inicio: "2026-06-02", fim: "2026-07-24" }} hoje={HOJE} />
          <Prazo periodo={{ fim: "2027-01-10" }} hoje={HOJE} />
          <Prazo periodo={{ inicio: "2026-06-02" }} hoje={HOJE} />
          <Prazo periodo={{ inicio: "2026-07-27", fim: "2026-07-27" }} hoje={HOJE} />
        </div>
      </Amostra>
      <Amostra titulo="Só a data (sem a legenda relativa) e numa linha">
        <div className="flex flex-wrap items-start gap-10">
          <Prazo periodo="2026-02-04" relativo={false} hoje={HOJE} />
          <Prazo periodo={{ inicio: "2026-06-02", fim: "2026-07-24" }} relativo={false} hoje={HOJE} />
          <Prazo periodo="2026-07-14" tom="espera" emLinha hoje={HOJE} />
        </div>
      </Amostra>
      <Amostra titulo="Com a voz que quem chama declara">
        <div className="flex flex-wrap items-start gap-10">
          <Prazo periodo="2026-07-14" tom="espera" hoje={HOJE} />
          <Prazo periodo="2026-07-09" tom="ruim" hoje={HOJE} />
          <Prazo periodo="2026-07-12" tom="espera" hoje={HOJE} />
        </div>
      </Amostra>
      <Amostra titulo="Quando o prazo é o estado do objeto (chip)">
        <div className="flex flex-wrap items-start gap-10">
          <Prazo periodo="2026-07-22" forma="chip" hoje={HOJE} />
          <Prazo periodo="2026-07-15" forma="chip" tom="espera" hoje={HOJE} />
          <Prazo periodo="2026-07-01" forma="chip" tom="ruim" hoje={HOJE} />
        </div>
      </Amostra>
      <Amostra titulo="Sem data, proposta, concluído, parcial">
        <div className="flex flex-wrap items-start gap-10">
          <Prazo periodo={null} hoje={HOJE} />
          <Prazo periodo="2026-08-03" proposta hoje={HOJE} />
          <Prazo periodo="2026-07-02" concluido hoje={HOJE} />
          <Prazo periodo="2026-07-30" parcial="Prazo de 4 de 20 tarefas" hoje={HOJE} />
        </div>
      </Amostra>
    </Amostras>
  )
}
