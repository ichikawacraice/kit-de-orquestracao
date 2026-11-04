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
- **Um agente só, com o modelo escolhido por hook, pelo risco declarado do item e pelo diff.** O `orquestracao:validador` continua com Opus no frontmatter. A dona declara o risco do item uma vez no painel (`"risco":true|false`: grava estado, toca segurança, dinheiro ou produção, voltou da fila). O hook `modelo-do-validador.mjs` põe `model: "sonnet"` só quando o item é `risco: false` **e** o diff não toca contrato nem trava pelo corte da via rápida (ADR, spec, migration, schema, hook, gate, CI, manifesto, protocolo, agentes, removido, binário). Item de risco ou diff com risco: fica o Opus. Risco não declarado com diff limpo: o hook recusa o lançamento pedindo a declaração, e o esquecimento custa uma chamada, não uma revisão rebaixada. `model` dado pela dona vale sempre; sessão que não é dona, erro do hook ou base não achada deixam o Opus. O aviso de que rodou em Sonnet chega à dona por `additionalContext` (o motivo de um `allow` só vai ao log de depuração).
- **A dona espera no turno.** O Stop hook `espera-no-turno.mjs` segura uma vez o fim de turno da dona de item vivo que ainda tem subagente, ou shell de teste, tipo ou build (servidor e ensaio ficam de fora), em `background_tasks` e diz como esperar: `esperar-fundo` (volta quando os subagentes da sessão terminam, teto de 540 s) e o teste em primeiro plano. A segunda tentativa passa, e o turno que termina perguntando ao operador também.

<a id="alternativas"></a>
## Alternativas consideradas
- **Dois agentes (`validador` em Opus e `validador-leve` em Sonnet):** a escolha ficaria visível no tipo do agente, mas continuaria na mão da dona, que é o que falhou; e o corpo do agente teria duas cópias para manter iguais.
- **Só reescrever a regra no protocolo:** a regra já existia e foi seguida em 2% das rodadas.
- **Validador em Sonnet por padrão, Opus a pedido (só pelo diff):** foi a primeira versão deste ADR, derrubada na revisão. O risco que o diff não mostra (um `painel.mjs` que grava a fila, uma rota de autenticação, uma função do Supabase) cairia em Sonnet sempre que a dona esquecesse de pedir Opus, e o dado mostra que ela esquece.
- **O modelo da dona como sinal de risco:** a orquestradora já escolhe o modelo da dona pelo risco do item. Medido: 129 das 133 rodadas do validador de 02 a 04/11 vieram de dona Opus (na dúvida, Opus); o ganho seria quase nenhum.
- **Filtrar o aviso na orquestradora:** o aviso é do app; a orquestradora gasta o turno para lê-lo de qualquer jeito. Só a dona deixando de terminar o turno evita o custo.
- **Bloquear sempre o fim de turno com trabalho em segundo plano:** prenderia a dona que precisa parar (espera de horas, pergunta ao operador); por isso segura uma vez só.

<a id="consequencias"></a>
## Consequências
- O validador fica em Sonnet no item declarado sem risco e de diff comum, ~33% mais barato por rodada (a leitura de cache custa igual nos dois modelos). A dona ganha uma declaração por item; o delta de conserto segue o risco declarado (antes, sempre Opus). Neste repositório quase todo item toca hook ou protocolo e segue em Opus.
- A dona ganha uma chamada de `esperar-fundo` por espera, no lugar do fim de turno e da volta pela notificação; a orquestradora deixa de acordar para esses avisos.
- Dois hooks a mais em cada sessão: o PreToolUse só age em `Agent` com o validador; o Stop sai cedo quando nada roda em segundo plano.
- Medir depois: `node scripts/custo-fixo.mjs --desde <data do merge>`.
