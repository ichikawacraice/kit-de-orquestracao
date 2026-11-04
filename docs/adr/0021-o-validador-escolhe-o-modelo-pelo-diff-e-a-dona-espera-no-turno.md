# ADR 0021 — O validador escolhe o modelo pelo diff, e a dona espera o trabalho em segundo plano dentro do turno

- Data: 2026-11-04
- Status: Proposto
- Autor: sessão dona do F373, a partir do pedido do operador (Q913)
- Relacionados: [ADR 0011](0011-uma-sessao-dona-do-item-do-plano-ao-pr.md) (uma dona por item); [ADR 0019](0019-a-fila-de-merge-roda-sem-turno-da-orquestradora.md) (a fila sem turno da orquestradora); plano com as medições em [`docs/planos/2026-11-04-gasto-fixo-validador-e-espera.md`](../planos/2026-11-04-gasto-fixo-validador-e-espera.md)

<a id="contexto"></a>
## Contexto
- De 02 a 04/11 o validador foi 18% do gasto, com 128 de 131 rodadas em Opus. A regra de passar `model: "sonnet"` em item mecânico já estava no protocolo e na skill `papeis-e-modelos`; quase ninguém a seguiu, porque depende de a dona lembrar e classificar o item a cada lançamento.
- Todo subagente roda em segundo plano. A dona que lança o validador (ou deixa o teste rodando) e não tem mais nada a fazer termina o turno, e o app manda à orquestradora o aviso de fim de turno. Foram 87 turnos da orquestradora só para ler "aguardo" (US$ 19, 1,5% do gasto), cada um relendo ~264 mil tokens de contexto.
- O Claude Code dá duas peças para resolver sem depender de memória: o hook PreToolUse pode reescrever o pedido da ferramenta (`updatedInput`), e a entrada do Stop hook traz `background_tasks`, o que ainda roda na sessão.

<a id="decisao"></a>
## Decisão
- **Um agente só, com o modelo escolhido por hook.** O `orquestracao:validador` continua com Opus no frontmatter. O hook `modelo-do-validador.mjs` mede o diff da branch pelo corte da via rápida (`pool/via-rapida.mjs`) e, quando o diff não toca contrato nem trava (ADR, spec, migration, schema, hook, gate, CI, manifesto, protocolo, agentes, removido, binário), põe `model: "sonnet"` no pedido. `model` dado pela dona vale sempre: é por ele que ela pede Opus para o que o diff não mostra (estado gravado, segurança, produção, item que voltou da fila). Erro do hook deixa o padrão (Opus).
- **A dona espera no turno.** O Stop hook `espera-no-turno.mjs` segura uma vez o fim de turno da dona de item vivo que ainda tem shell ou subagente em `background_tasks` e diz como esperar: `esperar-fundo` (volta quando os subagentes da sessão terminam, teto de 540 s) e o teste em primeiro plano. A segunda tentativa passa, e o turno que termina perguntando ao operador também.

<a id="alternativas"></a>
## Alternativas consideradas
- **Dois agentes (`validador` em Opus e `validador-leve` em Sonnet):** a escolha ficaria visível no tipo do agente, mas continuaria na mão da dona, que é o que falhou; e o corpo do agente teria duas cópias para manter iguais.
- **Só reescrever a regra no protocolo:** a regra já existia e foi seguida em 2% das rodadas.
- **Validador em Sonnet por padrão, Opus a pedido:** o esquecimento passaria a baixar a revisão de item de risco. O hook erra para o lado do Opus.
- **Filtrar o aviso na orquestradora:** o aviso é do app; a orquestradora gasta o turno para lê-lo de qualquer jeito. Só a dona deixando de terminar o turno evita o custo.
- **Bloquear sempre o fim de turno com trabalho em segundo plano:** prenderia a dona que precisa parar (espera de horas, pergunta ao operador); por isso segura uma vez só.

<a id="consequencias"></a>
## Consequências
- O validador fica em Sonnet no item de diff comum, ~33% mais barato por rodada (a leitura de cache custa igual nos dois modelos). Neste repositório quase todo item toca hook ou protocolo e segue em Opus.
- A dona ganha uma chamada de `esperar-fundo` por espera, no lugar do fim de turno e da volta pela notificação; a orquestradora deixa de acordar para esses avisos.
- Dois hooks a mais em cada sessão: o PreToolUse só age em `Agent` com o validador; o Stop sai cedo quando nada roda em segundo plano.
- Medir depois: `node scripts/custo-fixo.mjs --desde <data do merge>`.
