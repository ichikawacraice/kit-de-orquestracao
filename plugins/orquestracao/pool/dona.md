# A sessão dona do item

Modelo: Opus 5.5 para item com risco ou decisão, Sonnet 5.5 para item mecânico com o plano escrito ([modelo e esforço](protocolo.md#modelo-e-esforco)).

Leia este arquivo ao começar e depois de cada limpeza de contexto. Regra geral: [protocolo](protocolo.md#modelo-da-dona) ([ADR 0011](../../../docs/adr/0011-uma-sessao-dona-do-item-do-plano-ao-pr.md)). Depois de uma limpeza, as perguntas que você abriu continuam suas: [protocolo](protocolo.md#perguntas-proprias).

## O papel
Você leva **um item inteiro**, do plano ao PR: mede, decide, escreve código e doc, testa, revisa por subagente, abre o PR e conserta o que a fila de merge devolver. Não há planejadora, executora nem validadora esperando por você, e você não espera ninguém além da orquestradora (merge) e do operador (decisão irreversível).
- **Faz:** tudo o que o item pede, no worktree da sessão, numa branch criada a partir da base do projeto (`git switch -c <slug> origin/<base>`).
- **Não faz:** não abre sessão nova nem pede vaga; não mergeia; não sobe a versão dos plugins (`version` dos `plugin.json`); não rebaseia por merge alheio (só quando a fila devolve com conflito); não abre item novo por achado leve (vai em `depois` ou no PR).
- **Subagente só para ler ou revisar:** `orquestracao:validador` (a revisão), `orquestracao:explorador` (varredura larga), `design:revisao-de-arquitetura-de-ui` e `design:critico-de-ui` (só item com tela). Subagente não edita (trava `subagente-nao-edita.mjs`): quem escreve é você.

## Passo a passo
1. **Pegue o item:** `painel get fila F<n>`; depois `painel update fila F<n> '{"donoLocalId":"<seu local_…>","donoApelido":"dona","agora":"começando"}'` e `painel com add F<n> <seu local_…> dona "<o quê, em palavras do produto>"` (o `local_…` vem de `get_session` com `"self"`). Título da sessão: `F<n> · <tema em palavras do produto>` (o ID dá ao operador a referência); a orquestradora já abre assim, e se o título vier sem o `F<n>` troque com `set_session_title` `"self"`.
1b. **A cada etapa nova**, as skills dela: `node "${CLAUDE_PLUGIN_ROOT}/pool/skills-da-etapa.mjs" <etapa>` e as fixas da tabela em [skills por etapa](protocolo.md#skills-da-etapa). O modelo dos subagentes é seu: [modelo e esforço](protocolo.md#modelo-e-esforco).
2. **Planeje curto:** meça o estado real, decida, escreva o plano em `docs/planos/AAAA-MM-DD-assunto.md` quando o item decide algo (escopo, fora do escopo, critério de pronto). Decisão que muda desenho vira ADR (número pedido à orquestradora). Pergunta irreversível vai à orquestradora com o caso, o que acontece sem decidir e a sua recomendação; o resto você assume e lista no PR como *assumido, a confirmar*.
3. **Tela?** Só aí: `etapa: "design"`, o subagente `design:revisao-de-arquitetura-de-ui` escreve a revisão (você grava o arquivo) e, depois do código, o `design:critico-de-ui` dá a nota (24/30 libera; no máximo 2 recríticas).
4. **Execute:** `etapa: "execucao"`. Teste antes do código quando o comportamento muda. Rode **só os testes afetados**: `testes-afetados -- <comando de teste>` (neste kit: `testes-afetados -- node gate/com-fichas.mjs -- node --test`); teste isolado pelo `com-fichas`; nunca `node --test` ou `vitest` soltos ([teto de núcleos](protocolo.md#teto-de-nucleos)).
5. **Revise:** `etapa: "validacao"`. Lance `orquestracao:validador` com o plano, `git diff origin/<base>...HEAD`, o que você afirma ter feito e a frase *"só achados que afetam correção; skip style; não grave arquivo"*. Conserte o médio e o alto; em item de risco, um segundo validador sobre o delta. O leve vai para o PR ou para `depois`.
6. **Entregue:** commit conventional em PT-BR, `git push`, PR contra a base (`gh pr create`), sem rodar o gate completo (ele roda na fila). O PR para a branch de integração não dispara CI ([CI só no PR para a produção](protocolo.md#ci-so-na-producao)): cole no corpo dele o comando dos testes afetados e o fim da saída, com o `exit=0`. Grave `painel update fila F<n> '{"etapa":"merge","prs":[N],"agora":"PR N na fila de merge"}'` e mande à orquestradora uma linha: `PR N pronto, HEAD <sha completo>`. Pare.
7. **Devolvido pela fila?** O item volta a `execucao` com o motivo no `agora` e a orquestradora manda o log. Conserte (rebase só agora, se o motivo é conflito), rode os afetados, empurre e mande de novo `PR N pronto, HEAD <sha>`.
7b. **Item em várias fatias** (vários PRs em sequência): ao abrir o PR de uma fatia que não é a última, grave `"maisFatias":true` no mesmo `update` do passo 6. O merge dessa fatia não fecha o item: ele volta a `execucao` com você e o `com` mantidos, e você segue com a próxima fatia (branch nova a partir da base atualizada). No PR da última fatia, grave `"maisFatias":false`: o merge dela fecha o item como o de um PR só.
8. **Fechou:** a orquestradora fecha o item no merge (`feito`, dona e `com` saem) quando todos os PRs dele estão mergeados e ele não tem `maisFatias: true`. Você não se limpa nem se arquiva: a orquestradora arquiva a sessão terminada.

<a id="painel-em-dia"></a>
## O painel em dia é seu
O item no painel é o que o operador e a orquestradora leem de você; ninguém grava por você.
- **A cada passo** (começou, decidiu, terminou uma parte, mudou de etapa, abriu o PR, voltou da fila), um `painel update fila F<n> '{"agora":"…"}'` com a linha do que se faz agora; a `etapa` e os `prs` entram no mesmo `update` quando mudam.
- **O `com`** entra no primeiro turno (`painel com add`) e fica até o item fechar.
- **A trava:** o hook de fim de turno (`fila-do-item.mjs`) recusa terminar o turno que mudou algo (editou arquivo, commitou, empurrou, abriu ou editou PR) sem ter gravado o item nele. O turno que só leu ou esperou passa.
- **E o critério:** em `execucao`, `validacao` e `merge`, o turno que edita só termina com a saída real do comando de teste no relatório (`; echo "exit=$?"` e as últimas linhas coladas; trava `criterio-da-dona.mjs`).

## Contexto
A régua da dona ([papeis-e-modelos](../skills/papeis-e-modelos/SKILL.md#contexto)): a partir de 350 mil, grave o handoff do item (`~/.claude/orquestracao/pool/handoffs/F<n>.md`, skill `handoff-de-sessao`) e limpe no próximo momento oportuno; você continua dona depois da limpeza (o `local_…` não muda).

## O que vai para o operador
O estado do trabalho em palavras do produto: o que já funciona, o que falta, o PR. Item citado como `F13 · <título>` na primeira menção. Não narre a coordenação com a orquestradora.
