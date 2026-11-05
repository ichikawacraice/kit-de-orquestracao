# ADR 0027 — O estado do item é deduzido e o item fecha pelo merge

- Data: 2026-11-05
- Status: Proposto
- Autor: sessão dona do F423, a partir das fases 2 e 3 do diagnóstico, aprovadas pelo operador na Q1027 ("sim, segue a recomendação")
- Relacionados: [diagnóstico da orquestração](../research/2026-11-05-diagnostico-orquestracao.md) (a medição que motiva); [ADR 0019](0019-a-fila-de-merge-roda-sem-turno-da-orquestradora.md) (a fila sem turno, que fecha o item que ela mergeia); [ADR 0022](0022-a-orquestradora-so-acorda-quando-precisa.md) (a batida cobra da dona o PR fora da fila)

<a id="contexto"></a>
## Contexto
- A batida julgava cada item pelo que a dona declarou: a `etapa`, os `prs` e o `atualizadoEm`. O "parado" era só o tempo desde a última gravação no painel. A dona que trabalhava sem gravar o `agora` era cutucada, e a que gravava sem trabalhar parecia viva.
- O item só fechava quando a fila da orquestradora mergeava o PR (`painel mergear`) ou quando alguém declarava `etapa: "feito"`. O PR mergeado pelo app, ou à mão no GitHub, deixava o item em `merge` para sempre. Já o `feito` declarado fechava o item sem que nada tivesse entrado na `main`.
- Os fatos já existem fora do painel: os commits do worktree da dona (git), os PRs do repositório (`gh`) e a atividade da sessão (lista de sessões do app).

<a id="decisao"></a>
## Decisão
- **A batida deduz o estado** (`estado-deduzido.mjs`) a cada rodada, fora da trava:
  - **PRs do item:** os de `prs` e os da branch da dona (a `branch` do item ou a do worktree dela, lida pelo `git rev-parse`; a da lista do app é a branch com que o app criou a sessão e só vale sem o git).
    - O PR da branch só conta se foi criado depois do item nascer: o worktree reaproveitado não herda o PR do item anterior.
    - O PR que a branch liga a mais de um item vivo, ou que outro item já lista em `prs`, não liga pela branch.
    - O PR mergeado antes do item nascer não conta, nem o de `prs`: o número que é de outro repositório e colide com um PR antigo deste não fecha o item.
    - O PR mergeado antes da última reabertura do item não conta: o item reaberto não refecha pelo merge que já o fechou.
    - A branch de base (`main`, `master`, `develop`) não liga PR.
  - **Etapa:**
    - todos os PRs válidos mergeados → `feito`;
    - PR aberto → `merge`;
    - fatia mergeada (`maisFatias`) → `execucao`;
    - `merge` sem PR aberto, com todos os PRs ligados lidos → `execucao`;
    - commit à frente da base ou mudança sem commit → `execucao` (`design`, `validacao` e `merge` declarados ficam: o git não rebaixa o item em merge quando o `gh` caiu ou não achou o PR).
  - **Dona viva:** sessão não arquivada na lista do app.
  - **Parado:** a dona não está num turno, o item não está em espera nem travado, e a última atividade passou do prazo. Conta como atividade a gravação no item, a atividade da sessão viva, o último commit ou a atualização de um PR ligado.
  - O PR fechado sem merge não conta. O PR que o `gh` não leu segura o fechamento e conta como aberto, para a cobrança do `--anotar`.
- **O item fecha pelo merge:** a batida que vê todos os PRs ligados mergeados (sem `maisFatias`) fecha o item com os mesmos dados do `painel mergear`. Ela tira a dona e o `com` e mantém as sessões, o custo e o `agora` com os PRs.
- **`feito` não se declara.** O `update` que leva um item existente a `feito` é recusado, e a mensagem manda fechar pelo merge. O item que não entrega PR sai por `descartado`, com o motivo no `agora`. Criar um item já fechado (importação) continua permitido. `KIT_FECHAR_DECLARADO=1` é a escotilha dos testes que exercitam o fechamento.
- **O item guarda o que o modelo decide:** título, plano, risco, entrega e perguntas. A etapa e os PRs gravados continuam valendo como o declarado quando falta o dado: `gh` fora do ar, worktree apagado, projeto sem sessão viva ou item antigo.
- A projeção deduzida fica em `batida/deduzido.json` (`{em, itens}`), para o pane ler.
- `KIT_ESTADO_DEDUZIDO=off` volta a batida ao declarado.

<a id="alternativas-consideradas"></a>
## Alternativas consideradas
- **Manter o declarado e cobrar mais da dona** (mais travas de `agora`): é o que gerava turno extra e cutucada errada. O diagnóstico mediu o custo dessa abordagem.
- **Deduzir no pane, não na batida:** o pane não pode chamar o `gh` a cada desenho, e o fechamento precisa de quem grave no painel com a trava. A batida já roda periodicamente e grava.
- **Fechar só pelo `painel mergear` da fila:** deixa preso o item cujo PR mergeou fora da fila (app, GitHub). A batida fechar também cobre esse caminho, sem alterar a fila.
- **Gravar a etapa deduzida de volta no item:** dois escritores da mesma etapa brigariam. A dedução é uma projeção, e só o fechamento grava.
- **Ligar PR só pela branch, sem a data:** o worktree reaproveitado ligaria ao item novo o PR mergeado do anterior e o fecharia na hora.
- **Limpar `prs` na reabertura:** apagaria o registro do que já entrou; descontar o PR mergeado antes da reabertura dá o mesmo efeito sem perder o histórico.

<a id="consequencias"></a>
## Consequências
- A batida chama o `gh` uma vez por projeto com item vivo (`gh pr list --state all --limit 200`), mais um `gh pr view` por PR do item que a lista não trouxe, e o `git` uma vez por dona viva. O repositório do projeto é o de uma sessão viva do próprio projeto. Cada chamada tem o limite `KIT_GH_TIMEOUT_MS` (10 s) e a coleta inteira o orçamento `KIT_DEDUCAO_ORCAMENTO_MS` (25 s), abaixo dos 60 s que o mod dá à batida. A falha ou o orçamento estourado cai no declarado e não derruba a batida.
- O operador e a orquestradora não fecham mais item por `update`. O item entregue em outro repositório, sem sessão viva no projeto, fecha pelo `painel mergear` ou sai por `descartado`.
- Tirar o `agora` obrigatório e as travas `fila-do-item` e `painel-das-sessoes` fica para o F424. O pane ler `deduzido.json` fica para o F425.
