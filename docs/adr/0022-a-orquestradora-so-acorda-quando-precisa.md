# ADR 0022 — A orquestradora só acorda quando precisa

- Data: 2026-11-04
- Status: Proposto
- Autor: sessão dona do F373 (fatia 2), a partir do pedido do operador repassado pela orquestradora em 04/11
- Relacionados: [ADR 0021](0021-o-validador-escolhe-o-modelo-pelo-diff-e-a-dona-espera-no-turno.md) (a dona espera no turno); [ADR 0019](0019-a-fila-de-merge-roda-sem-turno-da-orquestradora.md) (a fila sem turno); plano em [`docs/planos/2026-11-04-orquestradora-so-acorda-quando-precisa.md`](../planos/2026-11-04-orquestradora-so-acorda-quando-precisa.md)

<a id="contexto"></a>
## Contexto
- De 02 a 04/11 a orquestradora custou 15% do gasto, com ~260 mil tokens relidos por chamada. 306 dos 535 turnos dela (57%, US$ 68,6, um terço do custo dela) vieram do aviso de fim de turno que o app manda a quem abriu uma sessão: a cada turno de dona, inclusive "testes rodando, aguardo" e "PR N pronto, anotado na fila", que não pedem nada dela.
- O ADR 0021 tirou o aviso de espera (a dona espera no turno). Sobrava o aviso de entrega, que a fila sem turno e o `--anotar` já cobrem.
- A ferramenta `detach_session` do app tira a sessão de baixo de quem a abriu e, pela descrição dela, "that session is no longer told when its turns end". A própria sessão pode se desligar (`"self"`) quando foi aberta pelo Claude de outra sessão. O app recusa a aberta por cartão do operador, a que divide worktree e a sessão sem operador.

<a id="decisao"></a>
## Decisão
- **A dona se desliga da orquestradora no primeiro turno** (`detach_session` com `"self"`, `pool/dona.md` passo 1). O aviso de fim de turno deixa de existir para ela.
- **A orquestradora acorda só por quatro gatilhos** (skill `orquestradora`, âncora `quando-acorda`): instrução do operador; pedido de número de documento (e a mensagem `PR N pronto` quando o `--anotar` não serviu); item sem dona com vaga aberta; erro da fila de merge (e, até a fatia 3 do F373, o desfecho com merge, cujo pós-merge ainda é dela).
- **O PR pronto fora da fila a batida cobra da dona**, não da orquestradora: o item em `merge` parado com PR em `prs` e dona viva recebe `anotar`, uma vez por parada e no máximo duas vezes pelos mesmos PRs (a rodada da fila que dá erro tira o PR da fila e deixa o item em merge: sem o teto, anotar e errar viraria laço); a dona no meio de um turno não é cobrada. Só o item sem dona viva, sem PR, cuja dona não respondeu em 20 min ou já cobrado duas vezes vai ao relatório da orquestradora.
- **O aviso que ainda chegar abre um turno sem leitura**: sem batida, fila, `list_sessions` ou gravação; a exceção é a pergunta ao operador que não está no painel.

<a id="alternativas"></a>
## Alternativas consideradas
- **A orquestradora desliga a dona logo depois do `start_session`:** funciona igual, mas gasta um passo dela em cada abertura e depende dela lembrar; a dona se desliga no turno em que já se grava no item.
- **Filtrar o aviso no turno da orquestradora (um hook que encerra o turno):** o turno já foi aberto e o contexto já foi relido; o custo está em abrir o turno, não no que ele faz.
- **Só o turno barato, sem desligar:** corta o trabalho do turno, não a releitura de ~260 mil tokens que cada turno paga.
- **Levar já o pós-merge à batida:** é o mesmo pedido, mas mexe no mod `painel-sessoes`, no `subir-versao` e no arquivamento; vai na fatia 3 do F373, para este PR ficar revisável.

<a id="consequencias"></a>
## Consequências
- A orquestradora deixa de acordar pelos turnos das donas desligadas; o teto do ganho medido é o custo dos turnos de aviso, ~US$ 69 em 3 dias (~5% do gasto total).
- A dona desligada não aparece mais aninhada sob a orquestradora na barra lateral, não é arquivada junto com ela e some do `list_sessions {"linked": true}`: a orquestradora a acha pelo `donoLocalId` do item. O desligamento não se desfaz.
- Pergunta da dona ao operador chega pelo painel (`perguntas`), como já chegava; a orquestradora não a vê mais pelo aviso.
- Medir depois: `node scripts/custo-fixo.mjs --desde <data do merge>`, linha `turnos de evento`.
