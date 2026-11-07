# ADR 0036 — A dona planeja e documenta em Opus, e a execução vai a um subagente Sonnet

- Data: 2026-11-06
- Status: Proposto
- Autor: sessão dona do F477, a partir do pedido do operador de 06/11 ("quem escreve as specs é a dona né? planejamento e documentação tem que ser sempre opus. médio ou alto, depois muda pra sonnet pra executar e outras coisas que quiser usar o sonnet")
- Relacionados: [ADR 0011](0011-uma-sessao-dona-do-item-do-plano-ao-pr.md) (uma dona por item); [ADR 0021](0021-o-validador-escolhe-o-modelo-pelo-diff-e-a-dona-espera-no-turno.md) (o modelo do validador, que este ADR não muda); [ADR 0030](0030-o-kit-reconhece-o-anfitriao-e-no-orca-so-da-as-regras.md) (a trava do `orca`); [plano do F477](../planos/2026-11-06-opus-planeja-sonnet-executa.md)
- Substitui: a parte de modelos do [ADR 0025](0025-a-dona-nasce-em-sonnet-e-o-opus-pede-gatilho.md) (o padrão Sonnet da dona, o Opus só por gatilho, a escalada por devolução). Ficam do 0025: `model` e `effort` explícitos, a recusa do `fork`, a lista fechada de gatilhos e o log de cada abertura.

<a id="contexto"></a>
## Contexto
- **Quem escreve plano, ADR, SPEC, diário e roteiro é a dona** (ADR 0011). O briefing da orquestradora traz o pedido, as imagens e os fatos medidos; o desenho é da dona. Pelo 0025, a dona sem gatilho nascia em Sonnet: o documento que decide saía do modelo mais barato, e o operador pediu o contrário.
- **A sessão não troca o próprio modelo** (ADR 0025): "depois muda pra Sonnet" só cabe em outra sessão ou num subagente.
- **O subagente que escreve estava proibido.** A trava `subagente-nao-edita.mjs` recusa Edit/Write de subagente no projeto ("quem escreve é sessão"; o executor antigo saiu em 24/10). No F476 a dona "delegou ao Sonnet" e o subagente gravou **por Bash** (`python3` com heredoc), que a trava deixa de fora por desenho: foi uma brecha, não um caminho.
- **A trava do `orca` forçava o contrário do pedido:** a dona Sonnet passava, e a dona Opus sem a linha `Gatilho do Opus:` era recusada (no `hooks-crewai.log` de 06/11, o F476 foi recusado uma vez antes de abrir em Opus médio com `gatilho=decisao`).
- **Preço** (ADR 0025, skill `claude-api` de 04/11): a leitura de cache custa o mesmo nos dois modelos; o Sonnet custa metade na escrita de cache, na entrada e na saída. Com o mesmo contexto e o mesmo número de chamadas, a sessão em Sonnet custa ~23% menos que em Opus. O piso de uma sessão nova é ~105 mil tokens; o de um subagente, ~33 mil.

<a id="decisao"></a>
## Decisão
1. **A dona nasce em Opus 5.5, esforço médio.** Ela planeja, escreve os documentos (plano, ADR, SPEC, diário, roteiro), confere o diff do executor, commita e abre o PR. Uma dona por item, do plano ao PR, como no 0011.
2. **Esforço alto só por gatilho nomeado.** O prompt da dona leva a linha `Esforço alto: <gatilho> — <motivo em uma frase>`, com um gatilho da lista fechada do 0025 (`decisao`, `contrato`, `estado`, `seguranca`, `producao`, `devolvido`). A antiga `Gatilho do Opus: <gatilho>` vale como sinônimo. "Na dúvida sobre um gatilho, alto."
3. **A execução vai ao subagente `orquestracao:executor`** (Sonnet 5.5, esforço médio): o código e os testes do plano que a dona fechou, rodando só os testes afetados. Ele não planeja, não grava documentação, não commita; a decisão que o plano não tomou volta à dona no relatório. **O item pequeno** (poucas edições, dentro do corte da via rápida) a dona escreve sozinha: o piso do subagente custaria mais que o trabalho.
4. **A trava cerca o executor.** A `subagente-nao-edita.mjs` libera Edit/Write do tipo `executor` só dentro da raiz do repositório da sessão (a pasta com `.git` mais próxima do `cwd`, pelo caminho real), fora de `docs/`, `.claude/` e `.git/`, e nunca em `.md`/`.mdx`. A configuração das travas continua fechada. Cada gravação vai ao log (`liberado-executor`, `recusou-executor`). Os outros subagentes seguem sem gravar.
5. **A trava confere o modelo da dona** (`titulo-da-dona.mjs` no app e `trava-do-orca.mjs` no Orca):
   - dona em Opus médio passa; Opus alto só com a linha do gatilho; outro esforço é recusado;
   - dona em Sonnet, Haiku ou modelo desconhecido é recusada, com a sugestão `opus`/`medium`;
   - no Orca, a sessão que não é dona (worker) passa em Sonnet ou Haiku, e em Opus médio; Opus em outro esforço pede a linha;
   - sem o texto do pedido legível, Opus médio passa e outro esforço é recusado (não há como ver a linha).
6. **O briefing da orquestradora é só o pedido, as imagens e os fatos medidos.** Plano, escolha de desenho e documento são da dona.
7. **No Orca, a dona nova abre com `--setup skip`** no `worker-start` (a dona prepara a worktree se o item pedir). `--setup`, `--name` e `--display-name` só valem com `--worktree new-child`/`new-top-level`: com `--worktree path:` o `orca` os recusa.

<a id="alternativas-consideradas"></a>
## Alternativas consideradas
- **A. A dona em Opus faz tudo; subagente só lê** (o de antes do 0025). Sem piso extra, mas cada chamada de execução e cada saída de teste rodam em Opus e engordam o contexto da dona. Não atende o "Sonnet pra executar". Descartada.
- **B. Uma sessão Opus planeja e outra sessão Sonnet executa na mesma worktree.** Custa ~105 mil tokens de piso por item, mais o handoff, e a orquestradora coordena duas sessões. Quebra "uma dona do plano ao PR" (0011): a decisão que aparece na execução volta à orquestradora e vira terceira sessão. Descartada.
- **C. A dona em Opus planeja, documenta, revisa e commita; o código e os testes vão ao subagente executor em Sonnet** (escolhida). Custa ~33 mil de piso por delegação. A execução, que é a maior parte das chamadas, roda em Sonnet com contexto curto, e a dona não carrega as saídas de teste. O custo é que o subagente grava: precisa da cerca na trava e da conferência do diff pela dona.
- **Manter o 0025 (dona Sonnet, Opus por gatilho).** O documento que decide sai do Sonnet, contra o pedido do operador; a qualidade vem antes da economia. Descartada.
- **Dona em Opus alto sempre.** O alto gasta mais pensamento em todo turno, inclusive nos mecânicos; o operador pediu "médio ou alto", e o gatilho já diz quando o alto vale. Descartada.
- **Liberar o executor por Bash, sem mexer na trava.** É o que aconteceu no F476: funciona, mas sem cerca nenhuma (grava doc, `.claude/`, fora do repositório) e sem log. Descartada; a brecha do Bash fica anotada para fechar à parte.

<a id="consequencias"></a>
## Consequências
- **A dona fica mais cara por chamada** que a dona Sonnet do 0025 (~30% a mais com o mesmo contexto), e a execução fica mais barata por ir ao Sonnet com contexto curto. O saldo por item não foi medido: o `hooks-crewai.log` passa a contar `abriu-opus` com o esforço e `liberado-executor`, e a medida do custo por item fechado diz se compensa.
- **A dona confere o diff do executor antes de commitar.** O executor erra no mesmo registro confiante em que acerta; o validador de contexto limpo (0021) continua antes do PR.
- **O turno que lança o executor conta como turno que editou** na trava `criterio-da-dona.mjs`: o relato do executor não é saída real (a trava tira das saídas o `<result>` da notificação de qualquer subagente em segundo plano), e a dona cola a saída do teste (o `tail` do `.log` que ele grava no rascunho, ou os afetados rodados de novo). O `modelos/CLAUDE.md` que o `kit atualizar` leva aos projetos diz o mesmo modelo da trava, e um teste os compara.
- **Ponto de atenção no app:** o `start_session` não abre sessão num modelo acima do de quem chama. Com a orquestradora em Sonnet (teste Q1096, até 13/11), o app não consegue abrir a dona em Opus. No Orca o `worker-start` abre. A decisão sobre o modelo da orquestradora precisa levar isso em conta.
- **A escalada "dona Sonnet devolve e nasce uma dona Opus" acaba:** a dona já é Opus. O gatilho `devolvido` passa a pedir o esforço alto da dona nova.
- **A brecha do Bash continua:** subagente que grava por shell passa por fora das duas travas. Fica no `depois` do item.
