import { Pessoa, PilhaDePessoas } from "@/components/ui/pessoa"

import { Amostra, Amostras } from "./_amostra"
import { pessoaDaDemo } from "./_pessoas"

const EQUIPE = ["Ana Souza", "Bruno Lima", "Carla Dias", "Davi Melo", "Eva Reis"].map((nome) => pessoaDaDemo(nome)!)
/** Ana e Caio caem na mesma família: o anel e as iniciais separam os dois círculos. */
const MESMA_FAMILIA = ["Ana Souza", "Caio Nunes"].map((nome) => pessoaDaDemo(nome)!)

export default function DemoDaPessoa() {
  return (
    <Amostras>
      <Amostra titulo="A pessoa" primeira>
        <div className="flex flex-wrap items-center gap-8">
          <Pessoa pessoa={pessoaDaDemo("Ana Souza")} />
          <Pessoa pessoa={pessoaDaDemo("Bruno Lima")} papel="Gerente" />
          <Pessoa pessoa={pessoaDaDemo("Carla Dias")} densidade="site" />
        </div>
      </Amostra>
      <Amostra titulo="Ausente, sem nome (o ? na cor do id), sem id (neutro), carregando">
        <div className="flex flex-wrap items-center gap-8">
          <Pessoa pessoa={null} semPessoa="Sem responsável" />
          <Pessoa pessoa={{ id: "pessoa-sem-nome", nome: null }} />
          <Pessoa pessoa={{ id: null, nome: "Sem id no app" }} />
          <Pessoa pessoa={null} carregando />
        </div>
      </Amostra>
      <Amostra titulo="Só o monograma (o nome na dica)">
        <Pessoa pessoa={pessoaDaDemo("Ana Souza")} papel="Gerente" soMonograma />
        <Pessoa pessoa={null} semPessoa="Sem responsável" soMonograma />
      </Amostra>
      <Amostra titulo="A pilha">
        <div className="flex flex-wrap items-center gap-8">
          <PilhaDePessoas pessoas={EQUIPE.slice(0, 1)} />
          <PilhaDePessoas pessoas={EQUIPE.slice(0, 3)} />
          <PilhaDePessoas pessoas={EQUIPE} />
          <PilhaDePessoas pessoas={MESMA_FAMILIA} />
          <span className="rounded-xl bg-muted px-3 py-2">
            <PilhaDePessoas pessoas={EQUIPE} sobre="muted" />
          </span>
        </div>
      </Amostra>
      <Amostra titulo="A pilha decorativa (a frase ao lado diz os nomes)">
        <div className="flex flex-wrap items-center gap-8">
          <Pessoa pessoa={pessoaDaDemo("Ana Souza")} />
          <span className="inline-flex items-center gap-2">
            <PilhaDePessoas
              decorativa
              pessoas={EQUIPE.slice(0, 3)}
            />
            <span className="t-denso text-muted-foreground">Ana Souza, Bruno Lima e Carla Dias leram</span>
          </span>
        </div>
      </Amostra>
    </Amostras>
  )
}
