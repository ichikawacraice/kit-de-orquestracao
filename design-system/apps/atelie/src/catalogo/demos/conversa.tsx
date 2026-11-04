import { AutorDaConversa, BalaoDaConversa, Conversa, DiaDaConversa, TextoComLinks } from "@/components/ui/conversa"
import { corDaPessoa } from "@/components/ui/monograma"

import { Amostra, Amostras } from "./_amostra"

const ANA = { id: "pessoa-ana", nome: "Ana Souza" }
const BRUNO = { id: "pessoa-bruno", nome: "Bruno Lima" }

export default function DemoDaConversa() {
  return (
    <Amostras>
      <Amostra titulo="A conversa entre pessoas" primeira>
        <div className="max-w-md">
          <Conversa rotulo="Mensagens da tarefa">
            <DiaDaConversa>Ontem</DiaDaConversa>
            <BalaoDaConversa
              lado="outro"
              primeira
              autor={<AutorDaConversa nome={ANA.nome} selo="Cliente" cor={corDaPessoa(ANA.id)} />}
              paraLeitor="Ana Souza, cliente, ontem às 16:05:"
              hora="16:05"
              instante="2026-11-03T19:05:00.000Z"
            >
              A versão nova do banner já pode subir?
            </BalaoDaConversa>
            <BalaoDaConversa
              lado="outro"
              primeira={false}
              paraLeitor="Ana Souza, cliente, ontem às 16:06:"
              hora="16:06"
              instante="2026-11-03T19:06:00.000Z"
            >
              <TextoComLinks texto="O texto do botão mudou também: https://loja.example/produto/1, confere?" />
            </BalaoDaConversa>
            <DiaDaConversa>Hoje</DiaDaConversa>
            <BalaoDaConversa
              lado="meu"
              primeira
              paraLeitor="Você, hoje às 09:12:"
              hora="09:12"
              instante="2026-11-04T12:12:00.000Z"
            >
              Pode, sim. Subo depois da revisão de hoje.
            </BalaoDaConversa>
            <BalaoDaConversa
              lado="outro"
              primeira
              autor={<AutorDaConversa nome={BRUNO.nome} cor={corDaPessoa(BRUNO.id)} />}
              paraLeitor="Bruno Lima, hoje às 09:20:"
              hora="09:20"
              instante="2026-11-04T12:20:00.000Z"
              chegou
            >
              Revisei: o contraste do botão passou.
            </BalaoDaConversa>
          </Conversa>
        </div>
      </Amostra>
    </Amostras>
  )
}
