# ADR 0031 — O item guarda os nomes das fatias; as feitas se deduzem

- Data: 2026-11-06
- Status: Proposto
- Autor: sessão dona do F452 (worker do Orca), a partir do pedido do operador de 06/11
- Relacionados: [ADR 0027](0027-o-estado-do-item-e-deduzido-e-fecha-pelo-merge.md) (o estado do item é deduzido); [plano](../planos/2026-11-06-aba-sessoes.md)

<a id="contexto"></a>
## Contexto
- O operador pediu uma seção "Sessões" na aba do kit no Orca. Para cada sessão, ela deve dizer em que ponto está (por exemplo, "fazendo a fatia 2") e mostrar em bolinhas o que já foi entregue e o que falta.
- O item da fila sabe hoje se há mais fatias, mas não quantas são nem como se chamam. O `maisFatias` é booleano: `true` enquanto o PR em merge não é o último, `false` no último. A batida já deduz os PRs mergeados do item (`deduzido.json` → `prsMergeados`), então "quantas já entraram" está medido; "quantas são e quais" não está em lugar nenhum.
- Os campos desconhecidos passam no `painel` sem validação. Um campo novo sem regra vira texto livre, cada dona grava num formato, e a aba teria que adivinhar.

<a id="decisao"></a>
## Decisão
1. **Campo opcional `fatias` no item da fila:**
   - lista de 1 a 12 nomes curtos (até 60 caracteres cada), na ordem em que as fatias entram;
   - texto não vazio, sem citar item nem PR (mesma regra do `titulo`);
   - o `painel` valida na escrita e recusa o resto;
   - `null` apaga o campo.
2. **A dona grava o campo ao planejar** um item em várias fatias (`pool/dona.md`, passo 7b). Pode reescrever a lista se o plano mudar. Item de um PR só não grava nada.
3. **As feitas não se gravam:** a aba deduz quantas entraram pelos PRs mergeados do item (`feitas = min(PRs mergeados, fatias.length)`). A fatia de agora é a seguinte. Isso segue o ADR 0027: o que o git e o gh já dizem não se declara.
4. **Sem o campo,** a aba mostra "fatia k" sem total quando o `maisFatias` está ligado (k = PRs mergeados + 1). As bolinhas, nesse caso, seguem as etapas do item.

<a id="alternativas-consideradas"></a>
## Alternativas consideradas
- **Total numérico (`totalDeFatias: 3`):** dá "fatia 2 de 3", mas não o nome do que falta, e o pedido é ver as próximas etapas. Rejeitada: os nomes custam o mesmo para a dona e respondem às duas perguntas.
- **Lista com estado por fatia (`[{nome, estado}]`, como o campo velho `passos` do F246):** a dona teria que marcar cada fatia como feita, e o painel envelheceria quando ela esquecesse. Rejeitada: o merge já é o fato, e a batida já o mede.
- **Deduzir as fatias do texto do plano (`docs/planos/…`):** o formato do plano é livre, e a aba teria que ler arquivo de outro repositório. Rejeitada.
- **Não gravar nada (só "fatia k"):** é o que a aba faz sem o campo. Fica como recuo, não como regra, porque não mostra o que falta.

<a id="consequencias"></a>
## Consequências
- A aba mostra "fatia k de m" com o nome de cada fatia quando a dona gravou o plano, e "fatia k" quando não gravou.
- Se a dona abrir um PR fora do plano (um conserto no meio), as feitas contam esse PR. A conta pode adiantar uma fatia até a dona reescrever a lista. É o preço de não marcar à mão, e o recuo é reescrever `fatias`.
- Os itens antigos não mudam: o campo é opcional, e o `passos` legado segue sem leitura.
