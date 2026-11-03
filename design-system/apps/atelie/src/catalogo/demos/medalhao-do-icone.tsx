import { CircleAlertIcon, InboxIcon, LockIcon, PackageCheckIcon } from "lucide-react"

import { MedalhaoDoIcone } from "@/components/ui/medalhao-do-icone"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoMedalhao() {
  return (
    <Amostras>
      <Amostra titulo="Neutro, nos dois tamanhos" primeira>
        <MedalhaoDoIcone icone={InboxIcon} tamanho="sm" />
        <MedalhaoDoIcone icone={InboxIcon} tamanho="md" />
      </Amostra>
      <Amostra titulo="Com voz">
        <MedalhaoDoIcone icone={PackageCheckIcon} tom="ok" tamanho="md" />
        <MedalhaoDoIcone icone={CircleAlertIcon} tom="ruim" tamanho="md" />
        <MedalhaoDoIcone icone={LockIcon} tom="alheio" tamanho="md" />
      </Amostra>
    </Amostras>
  )
}
