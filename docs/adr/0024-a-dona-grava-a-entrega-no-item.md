# ADR 0024 — A dona grava a entrega no item

- Data: 2026-11-05
- Status: Proposto
- Autor: sessão dona do F404, a partir do pedido do operador repassado pela orquestradora em 05/11
- Relacionados: [ADR 0022](0022-a-orquestradora-so-acorda-quando-precisa.md) (a dona se desliga da orquestradora; este ADR o mantém e devolve ao operador o que ele perdeu); [ADR 0023](0023-o-pos-merge-roda-sem-turno-da-orquestradora.md) (o desfecho sem turno vai ao `desfechos.log`); plano em [`docs/planos/2026-11-05-entrega-do-item.md`](../planos/2026-11-05-entrega-do-item.md)

<a id="contexto"></a>
## Contexto
- Depois do ADR 0022, a dona não avisa mais a orquestradora no fim do turno. O operador deixou de saber o que cada item entregou. O F387 do izanagi levou a home de 984 ms para 270 ms, e ele só soube porque foi ver.
- O item fechado guarda só `agora: "mergeado, ponta <sha>"`, e o `desfechos.log` diz só "F387 fechou". O pane já tem "Feitos hoje" (24 h), mas o cartão não tem o que mostrar.
- Medido nos transcripts da orquestradora do kit, na mesma janela de horário (20–24h): 03/11, antes do 0022, 444 chamadas e 104,8 M de cache lido (~26 M/h); 04/11, depois dele, 486 chamadas e 66,8 M (~16,7 M/h). Os avisos de fim de turno das donas caíram de 187 para 9. O custo caiu, e o que sobra é dominado pelos turnos do operador. Desfazer o 0022 traria o custo de volta para resolver um problema que é de registro, não de aviso.

<a id="decisao"></a>
## Decisão
- **O item ganha o campo `entrega`**, gravado pela dona no PR que fecha o item (o que não tem `maisFatias: true`):
  - `resultado` (texto, obrigatório): o que mudou para quem usa, com o número quando há;
  - `medido` (texto): o que foi medido e como;
  - `naoMedido` (texto): o que ficou sem medir ou sem conferir;
  - `proximos` (lista de texto): os próximos passos que a dona vê.

  O `painel` valida a forma. A entrega sai do item quando ele é reaberto (feito → vivo), como o `feitoEm`, e no merge de uma fatia (`maisFatias: true`): a entrega velha não descreve a fatia nova. O item descartado não mostra entrega, mesmo com o campo gravado.
- **A trava cobra:** o Stop hook `fila-do-item` bloqueia o turno que mudou algo da dona cujo item está em `merge`, com PR e sem `maisFatias: true`, enquanto faltar `entrega.resultado`. O motivo traz o comando pronto. O `--anotar` da fila avisa o mesmo, sem recusar.
- **O operador vê sem acordar ninguém:**
  - no pane, o cartão do item feito com entrega mostra "Entregue: <resultado>" no lugar do `agora`, e quantos próximos passos há;
  - o resumo do desfecho no `desfechos.log` leva o resultado de cada item que fechou;
  - `painel entregas [--desde <ISO|HH:MM>] [--todos]` lista em JSON os itens fechados desde a hora pedida (padrão: 24 h), com a entrega. A orquestradora o usa quando o operador pergunta o que saiu.
- **Os próximos passos são sugestão, não item:** a orquestradora os lê no `painel entregas` e decide com o operador o que vira item. Nada nasce sozinho.
- **O 0022 fica como está.** Item sem dona continua acordando a orquestradora pela batida (gatilho 3); sem orquestradora viva, o pane mostra o item sem dona.

<a id="alternativas-consideradas"></a>
## Alternativas consideradas
- **Desfazer o 0022 (religar o aviso de fim de turno):** devolve o custo medido (~9 M/h a mais na janela comparada) e o relato só chega ao operador se ele estiver falando com a orquestradora. Descartada.
- **Religar só o aviso do turno final da dona:** o app não separa o turno final; seria um `SendMessage` da dona no fim, um turno da orquestradora por item (~260 mil tokens relidos cada) para repetir o que o item pode guardar. Descartada.
- **Tirar a entrega do corpo do PR:** o PR é livre e cada dona o escreve de um jeito; ler o GitHub na batida custa rede e não tem forma para o pane. Descartada.
- **Seção "Entregue desde a última vez que você olhou" no pane:** exige guardar quando o operador olhou, estado que hoje não existe. Fica no `depois`; o "Feitos hoje" já cobre as 24 h.
- **O próximo passo virar item sozinho:** encheria a fila de itens que ninguém decidiu. Descartada.

<a id="consequencias"></a>
## Consequências
- A dona escreve 1 a 4 linhas a mais no PR final; a trava não deixa esquecer.
- A dona que já estava em `merge` sem entrega quando isto entrar é cobrada no próximo turno que mudar algo, com o comando pronto.
- Item fechado antes deste ADR não tem entrega: o cartão mostra o `agora`, como antes.
