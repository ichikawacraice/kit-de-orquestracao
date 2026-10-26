# ADR 0004 — Via rápida para item simples, escopo trancado no plano e piso de uma executora livre

- Data: 2026-10-26
- Status: Aceito (Q370 respondida pelo operador em 2026-10-26: "todas")
- Autor: sessão do kit, a pedido da orquestradora do Izanagi
- Relacionados: substitui a regra "Sem piso" do protocolo do pool (`plugins/orquestracao/pool/protocolo.md`); reforça o teto da crítica (Q207)

<a id="contexto"></a>
## Contexto
- No Izanagi, um item que só acrescentava ao editor um botão que já existe fora dele levou cerca de 2h40 da criação ao merge. O tempo foi para cinco coisas: a revisão de design e um ADR novo antes do código; a espera por uma executora, porque todas estavam ocupadas e o cartão de vaga nova esperava um clique; a crítica 22/30 seguida de conserto, recrítica perdida numa limpeza e refeita; ajustes que a crítica achou além do pedido e entraram no mesmo PR; a fila de teste e um conflito no diário.
- As duas últimas causas são do projeto e o Izanagi cuida delas. As outras três estão nas regras do pool do kit:
  - todo item de tela passa pela D e pela revisão antes da E;
  - nenhuma regra impede que um achado da crítica fora do pedido entre no PR;
  - o pool é sob demanda e sem piso ("nenhum membro existe sempre"). Fora do turno do operador, a vaga nova é um cartão para clicar.

<a id="decisao"></a>
## Decisão
1. **Via rápida.** A planejadora pode marcar o item com `via: "rapida"` quando ele cumpre as duas condições: reaproveita um componente ou padrão que o produto já tem, e não muda nenhuma decisão registrada (ADR, spec ou revisão de design aprovada). Item na via rápida:
   - vai da planejadora direto à E, sem revisão de design e sem ADR;
   - recebe **uma crítica só**, depois do código, sem recrítica;
   - tem validação leve: gate, escopo do diff e a tela aberta, sem auditoria.
   Uma crítica abaixo de 24/30, ou uma descoberta de que o item muda decisão, tira o item da via rápida e o devolve à planejadora, que segue o fluxo normal.
2. **Escopo trancado no plano.** O plano diz o que entra. O que a crítica ou a V acharem fora desse escopo vira item novo na fila (`depois` com o `F<n>`) e nunca entra no mesmo PR, qualquer que seja o peso. Dentro do escopo, vale o teto da Q207: ressalva alta volta para conserto, média e baixa viram item.
3. **Piso de uma executora livre.** Fora do modo ausente, o pool de cada projeto mantém pelo menos uma E livre. Quando não há nenhuma, a orquestradora pede a vaga no mesmo turno (no turno do operador abre a sessão; fora dele, propõe o cartão). Também não arquiva sozinha a última E livre do projeto. O pedido digitado pelo operador no turno dele continua valendo para qualquer membro (Q245).

<a id="alternativas"></a>
## Alternativas consideradas
- **Manter um fluxo só e encurtar cada etapa.** Rejeitada: o custo principal está nas etapas que não acrescentam nada ao item simples (revisão e ADR de algo que já existe), e não na duração de cada uma.
- **Via rápida decidida pela executora.** Rejeitada: quem lê as decisões registradas e sabe se o item muda alguma é a planejadora. A E só devolve o item quando descobre que ele muda decisão.
- **Piso de uma vaga livre por papel.** Rejeitada por ora: o que travou foi a falta de E. A V e a P esperam menos, porque a V entra depois do código e a P quase sempre já existe. Se a espera aparecer nelas, um novo ADR estende o piso.

<a id="consequencias"></a>
## Consequências
- Item simples pula a D e a recrítica. O risco é a tela sair sem revisão, coberto pela crítica única depois do código e pela volta ao fluxo normal quando a nota fica abaixo de 24.
- O PR fica do tamanho do pedido, e a fila ganha mais itens pequenos vindos das críticas.
- Uma sessão E fica parada fora do modo ausente. Membro parado não gasta nada (decisão do operador, 24/10).
- O ritual da orquestradora cobra a vaga quando falta E livre, e a trava de arquivar recusa a última E livre do projeto fora do turno do operador.
