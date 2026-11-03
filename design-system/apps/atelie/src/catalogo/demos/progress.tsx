import { Progress } from "@/components/ui/progress"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoProgresso() {
  return (
    <Amostras>
      <Amostra titulo="Ao longo das etapas" primeira>
        <div className="flex w-full max-w-md flex-col gap-4">
          <Progress value={0} max={8} rotulo="Arquivos enviados" />
          <Progress value={1} max={8} rotulo="Arquivos enviados" />
          <Progress value={3} max={8} rotulo="Arquivos enviados" />
          <Progress value={7} max={8} rotulo="Arquivos enviados" />
        </div>
      </Amostra>
      <Amostra titulo="Com o valor escrito por quem monta">
        <div className="w-full max-w-md">
          <Progress value={12} max={40} rotulo="Importação" valorEscrito="12 de 40 arquivos" />
        </div>
      </Amostra>
      <Amostra titulo="Rótulo e valor escritos por quem monta">
        <div className="flex w-full max-w-md items-center gap-3">
          <span className="t-denso shrink-0 text-foreground-2">Envio</span>
          <Progress value={2} max={5} rotulo="Envio" rotuloSoParaLeitor />
          <span className="t-medida shrink-0">2 de 5</span>
        </div>
      </Amostra>
      <Amostra titulo="A ponta do indicador, para medir contra a trilha">
        <div className="flex w-full max-w-md flex-col gap-4">
          <Progress value={1} max={8} rotulo="No começo" />
          <Progress value={7} max={8} rotulo="Perto do fim" />
        </div>
      </Amostra>
      <Amostra titulo="Sobre o degrau afundado">
        <div className="w-full max-w-md rounded-xl bg-muted p-4">
          <Progress value={5} max={8} rotulo="Conferência" />
        </div>
      </Amostra>
    </Amostras>
  )
}
