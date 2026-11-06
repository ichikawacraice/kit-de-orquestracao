<a id="f472-fecha-item-mergeado"></a>
# 06/11/2026 · F472 — no Orca, o item mergeado fecha sozinho, e o feito não volta a merge

O F455 do izanagi ficou em `merge` com o PR 1721 mergeado. A fila o fechou às 12:08 (SP). Às 12:15, um `painel update fila F455 '{"etapa":"merge"}'` repetido da orquestradora o reabriu com a dona antiga. Nada o fechou depois, por dois motivos. A batida de leitura do Orca não fecha (ADR 0032). E a regra do "item reaberto não refecha pelo merge que já o fechou" (ADR 0027) descartava o 1721 até para a batida completa.

- **A leitura fecha:** a batida de leitura fecha o item cujos PRs ligados mergearam, pela mesma regra (`batida.mjs#fechaPeloMerge`) e a mesma gravação (`painel.mjs#fecharPeloMerge`) da batida completa. Um teste de paridade compara as duas. O item da dona `local_` fica de fora: sem a lista do app, a leitura não vê a branch dela.
- **O feito não volta a merge:** o `update` ou `set` de `feito` para `merge` sem PR novo em `prs` é recusado, e a mensagem manda reabrir em `execucao` (a reabertura do F370 segue livre).
- **A reabertura direto em merge sem PR novo não conta:** fecha os itens que já foram reabertos assim, como o F455. Medido sobre o F455 real, só lendo: com o código de antes, `mergeado: false` e o 1721 descartado; com o novo, `mergeado: true`.
- Só vale depois de subir a versão e reiniciar o Orca. Decisão: [ADR 0034](../../adr/0034-a-batida-de-leitura-fecha-o-item-mergeado.md).
