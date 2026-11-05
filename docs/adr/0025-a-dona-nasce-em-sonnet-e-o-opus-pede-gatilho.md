# ADR 0025 — A dona nasce em Sonnet, e o Opus pede gatilho nomeado

- Data: 2026-11-05
- Status: Proposto
- Autor: sessão dona do F419, a partir das fases 0 e 1 do diagnóstico aprovadas pelo operador em 05/11
- Relacionados: [ADR 0011](0011-uma-sessao-dona-do-item-do-plano-ao-pr.md) (uma dona por item); [ADR 0021](0021-o-validador-escolhe-o-modelo-pelo-diff-e-a-dona-espera-no-turno.md) (o modelo do validador, que este ADR não muda); [diagnóstico da orquestração](../research/2026-11-05-diagnostico-orquestracao.md#plano)

<a id="contexto"></a>
## Contexto
- Na semana de 29/10 a 05/11, nos três projetos, **99% das chamadas das donas rodaram em Opus** (35.684 contra 340 em Sonnet), embora a regra mandasse Sonnet para o item mecânico com plano escrito. As donas são 84% do custo das sessões principais ([diagnóstico](../research/2026-11-05-diagnostico-orquestracao.md#resposta-curta)).
- A causa está escrita no próprio kit: a skill `papeis-e-modelos` mandava abrir a dona de risco **sem `model`** ("herda Opus"), e nada conferia o `start_session`. Sem `model`, a dona herda o modelo de quem a abre, e a orquestradora roda em Opus. A regra dizia "na dúvida, Opus", e a dúvida nunca tinha critério para acabar.
- **Quanto a troca economiza, em dólar** (medido nesta sessão sobre os mesmos transcripts, preço da skill `claude-api` de 04/11): Opus 5.5 e Sonnet 5.5 cobram a **mesma leitura de cache** (US$ 0,20/MTok); o Sonnet custa metade só na escrita de cache, na entrada e na saída. Na dona, a leitura é 53% do custo em dólar, a escrita 30% e a saída 17%. Com o mesmo número de chamadas e o mesmo contexto, a dona em Sonnet custa **~23% menos** que em Opus. Se metade das donas cair em Sonnet, ~12% do custo das donas; o diagnóstico estimava 10–20%.
- **O risco do Sonnet é fazer mais chamadas.** Como a leitura não barateia, um Sonnet que precise de 30% mais chamadas que o Opus para o mesmo item empata o custo. Só a medida da semana (F418) diz se ganhou.
- O Model Routing Playbook citado no diagnóstico pede: fixar o esforço junto com o modelo, escalar uma vez, nunca trocar de modelo no meio da sessão (perde o cache) e medir o custo por item resolvido.

<a id="decisao"></a>
## Decisão
- **O padrão da dona é Sonnet 5.5, esforço médio.** Vale para todo item com o plano escrito ([as cinco coisas](../../plugins/orquestracao/skills/papeis-e-modelos/SKILL.md#plano-pronto)) em que nenhum gatilho do Opus vale.
- **O Opus 5.5 (esforço alto) só por gatilho de uma lista fechada**, conferível antes de abrir a dona:
  - `decisao`: o plano não tem as cinco coisas;
  - `contrato`: o item cria ou muda spec, ADR, schema, API, migration ou formato que outro programa lê;
  - `estado`: o item grava estado;
  - `seguranca`: o item toca segredo, permissão ou autenticação;
  - `producao`: o item toca deploy, release, dados de produção ou dinheiro;
  - `devolvido`: o item voltou da fila ou de uma dona Sonnet.

  A definição de cada gatilho mora na skill `papeis-e-modelos` (âncora `gatilhos-do-opus`). "Na dúvida, Opus" passa a valer só para a dúvida sobre um gatilho, não para a falta de classificação.
- **Quem abre a dona passa `model` e `effort` explícitos e abre `fresh`.** Na dona em Opus, o prompt leva a linha `Gatilho do Opus: <gatilho> — <motivo em uma frase>`.
- **A trava confere.** O hook `titulo-da-dona.mjs`, que já lê o `start_session` de toda dona, também recusa:
  - a dona sem `model` ou sem `effort`;
  - a aberta por `fork`, que herda o modelo e a conversa inteira de quem abre;
  - a dona em Haiku ou em modelo desconhecido;
  - a dona em Opus sem a linha do gatilho, ou com um gatilho fora da lista.

  A recusa traz o padrão e a lista. Passam sem conferência o `proposal_id` sozinho (o cartão já foi conferido ao nascer) e a sessão na nuvem, onde `model` e `effort` não se aplicam. Cada dona que passa vai ao log (`abriu-sonnet`, `abriu-opus` com o gatilho, `abriu-nuvem`): é a contagem do roteamento para a medida da semana.
- **Escala uma vez, nunca no meio.** A dona Sonnet que encontra uma decisão fora do plano devolve o item à orquestradora, que abre uma dona Opus com o handoff e o gatilho `devolvido`. Nenhuma sessão troca o próprio modelo.
- **O validador fica como está** (ADR 0021). Ampliar os casos em que o hook do validador escolhe Sonnet espera o dado da medida da semana (F418); fica anotado no `depois` do item.

<a id="alternativas-consideradas"></a>
## Alternativas consideradas
- **Só reescrever a regra, sem trava:** é o que existia, e deu 99% de Opus. A regra só no texto já falhou no título da dona (F140, F172, F174) e aqui de novo. Descartada.
- **Aviso em vez de recusa:** o aviso chega depois que a sessão nasceu, e a sessão não troca o próprio modelo; para corrigir, seria preciso arquivar e abrir de novo. A recusa custa uma chamada da orquestradora e acontece antes de a dona existir. Descartada.
- **A trava decidir o modelo pelo risco gravado no painel** (`risco` do item): o `risco` é declarado pela dona no planejamento, depois de a sessão nascer, e escolhe o modelo do validador, não o da dona. Ligar a trava ao painel acopla a abertura da sessão a um estado que ainda não existe. Descartada.
- **Sonnet sempre, sem exceção:** o item de contrato, estado, segurança ou produção é onde o erro custa mais que o modelo, e a qualidade vem antes da economia (regra do operador). Descartada.
- **Haiku para a dona mecânica:** a dona escreve, testa e abre PR; o Haiku fica para quem só lê. Descartada.
- **Trocar o modelo da dona no meio da sessão** (começa em Opus para planejar, cai para Sonnet para executar): o app não deixa a sessão trocar o próprio modelo, e a troca perderia o cache, que é 53% do custo. Descartada.

<a id="consequencias"></a>
## Consequências
- A orquestradora gasta uma linha a mais no prompt da dona em Opus, e uma chamada a mais quando esquece o `model`.
- A dona em Sonnet que topa com uma decisão volta à orquestradora: um item pode ter duas donas. Se as devoluções passarem de ~1 em 5 itens Sonnet, o corte do plano está frouxo, e a medida da semana mostra isso.
- A meta (−40% no custo por item fechado em 3 semanas) não sai só daqui: a estimativa é ~10–15% do custo das donas. O resto vem das travas de Stop (F420) e do protocolo enxuto (F421).
- O log `hooks-crewai.log` passa a contar quantas donas nasceram em cada modelo, e por qual gatilho.
