import { Pessoa, PilhaDePessoas } from "@/components/ui/pessoa"

import { Amostra, Amostras } from "./_amostra"

const EQUIPE = ["Ana Souza", "Bruno Lima", "Carla Dias", "Davi Melo", "Eva Reis"].map((nome) => ({ nome }))

export default function DemoDaPessoa() {
  return (
    <Amostras>
      <Amostra titulo="A pessoa" primeira>
        <div className="flex flex-wrap items-center gap-8">
          <Pessoa pessoa={{ nome: "Ana Souza" }} />
          <Pessoa pessoa={{ nome: "Bruno Lima" }} papel="Gerente" />
          <Pessoa pessoa={{ nome: "Carla Dias" }} densidade="site" />
        </div>
      </Amostra>
      <Amostra titulo="Ausente, sem nome, carregando">
        <div className="flex flex-wrap items-center gap-8">
          <Pessoa pessoa={null} semPessoa="Sem responsável" />
          <Pessoa pessoa={{ nome: null }} />
          <Pessoa pessoa={null} carregando />
        </div>
      </Amostra>
      <Amostra titulo="Só o monograma (o nome na dica)">
        <Pessoa pessoa={{ nome: "Ana Souza" }} papel="Gerente" soMonograma />
        <Pessoa pessoa={null} semPessoa="Sem responsável" soMonograma />
      </Amostra>
      <Amostra titulo="A pilha">
        <div className="flex flex-wrap items-center gap-8">
          <PilhaDePessoas pessoas={EQUIPE.slice(0, 1)} />
          <PilhaDePessoas pessoas={EQUIPE.slice(0, 3)} />
          <PilhaDePessoas pessoas={EQUIPE} />
          <span className="rounded-xl bg-muted px-3 py-2">
            <PilhaDePessoas pessoas={EQUIPE} sobre="muted" />
          </span>
        </div>
      </Amostra>
    </Amostras>
  )
}
