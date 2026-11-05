# F425 · O pane mostra o estado deduzido do item

- Data: 2026-11-05 (SP)
- Dona: sessão F425
- Origem: fase 2 do [diagnóstico](../research/2026-11-05-diagnostico-orquestracao.md#plano) (Q1027), [ADR 0027](../adr/0027-o-estado-do-item-e-deduzido-e-fecha-pelo-merge.md) e o PR #162 (F423).

<a id="premissa"></a>
## A premissa conferida
- **"O pane mostra a fila de perguntas"** já é verdade: a seção "Esperam você" lista as perguntas abertas pela ordem do Q-ID, com botões de resposta, e as assumidas no rodapé. Este item não refaz essa fila; só confere que o item com pergunta aberta continua indo para ela quando o estado vem deduzido.
- **"Os quatro estados"** são os quatro fatos que a batida deduz (ADR 0027 §Decisão): a **etapa**, os **PRs ligados**, a **dona viva** e o **parado**. O pane já lê a dona viva da lista de sessões ao vivo (mais fresca que a batida de 10 min): continua assim. Faltam no pane a etapa e os PRs deduzidos e o "parado" que conta commit e PR.
- Hoje o `batida/deduzido.json` não existe na máquina: a batida instalada (0.1.105) já o grava a partir da próxima rodada com item vivo. O pane sem o arquivo desenha o declarado, como hoje.

<a id="escopo"></a>
## Escopo
- O mod lê `~/.claude/orquestracao/batida/deduzido.json` (`{em, itens}`) a cada leitura, e só o usa se `em` tiver até 25 min (duas batidas e meia); velho ou ilegível, vale o declarado, sem alarme.
- No item vivo com dedução: a **etapa** e os **PRs** do cartão são os deduzidos; a etapa `feito` deduzida não fecha nada no pane (quem fecha é a batida, que grava o item na mesma rodada).
- O **parado** deduzido aparece no cartão do item em Executando, no lugar onde o operador hoje lê "parada há X" (o desenho é da revisão do designer).
- A origem do dado (git, GitHub, sessões, declarado) fica no texto alternativo, para quem precisa conferir.

## Fora do escopo
- Hooks de `plugins/orquestracao/hooks` (o F424 mexe neles) e a própria dedução (`estado-deduzido.mjs`).
- Tirar o `agora` do cartão: ele continua enquanto as donas o gravam (o F424 decide a obrigação).

## Critério de pronto
- Teste do mod: com `deduzido.json` fresco, o cartão mostra a etapa e o PR deduzidos e o parado; com o arquivo velho ou ausente, o declarado.
- `claude plugin test plugins/painel-sessoes` verde; revisão do designer antes, crítico de UI depois (≥ 24/30); validador sem achado de correção aberto.
