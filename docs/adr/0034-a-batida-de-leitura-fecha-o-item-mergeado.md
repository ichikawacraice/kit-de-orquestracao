# ADR 0034 — A batida de leitura fecha o item mergeado, e o feito não volta a merge sem PR novo

- Data: 2026-11-06
- Status: Proposto
- Autor: sessão dona do F472 (worker do Orca), a partir do caso F455 do izanagi
- Substitui: no item 2 da Decisão do [ADR 0032](0032-no-orca-a-aba-do-kit-roda-a-batida-de-leitura.md), só o "não fecha pelo merge". A leitura segue sem cutucar, soltar, mandar mensagem ou lançar fila.
- Refina: no [ADR 0027](0027-o-estado-do-item-e-deduzido-e-fecha-pelo-merge.md), a regra "o item reaberto não refecha pelo merge que já o fechou", para a reabertura direto em `merge`.

<a id="contexto"></a>
## Contexto
- **O caso F455 do izanagi**, medido no transcript da orquestradora e no painel em 06/11:
  - 12:08 (SP): a fila mergeou o PR 1721 e fechou o item (`feito`).
  - 12:15: a orquestradora repetiu um `painel update fila F455 '{"etapa":"merge"}'` que já tinha rodado às 12:00. O item voltou a `merge` com a dona antiga (o `lembrarDona` do F370), sem PR novo.
  - 15:42: ela tentou `"etapa":"feito"` (recusado, o 0027 não deixa declarar) e anotou "fecha pela batida".
  - Nenhuma batida o fechou. No Orca não roda a batida completa, e a de leitura não fecha (0032, item 2). Mesmo com a completa, o 0027 descarta o PR mergeado antes da última reabertura: o item reaberto às 12:15 nunca refecharia pelo merge das 12:08.
- **O 0032 já previa a volta:** "fechar pelo merge é a candidata mais forte a voltar, se se medir item mergeado à mão que ficou aberto no Orca". O F455 é essa medição.
- **Quem leva um item `feito` a `merge` hoje.** Medido no código: a fila (`ligarPrsAosItens`) só põe em merge itens vivos (`itensVivos()`). O `mergear` devolve à `execucao`. A reabertura legítima do F370 (o PR só de doc que fechou o item por engano) é em `execucao`. Nenhum caminho legítimo vai de `feito` direto a `merge` sem PR novo.

<a id="decisao"></a>
## Decisão
1. **A batida de leitura fecha o item cujos PRs ligados mergearam,** com a mesma regra e a mesma gravação da batida completa:
   - a regra é `batida.mjs#fechaPeloMerge` (item vivo, de projeto com nome, `mergeado` no deduzido). O `julgar` e a leitura (`aFechar`) a usam;
   - a gravação é `painel.mjs#fecharPeloMerge`: relê o item dentro da trava; pula o que já fechou, ganhou `maisFatias`, ganhou PR em `prs` ou trocou de etapa desde a coleta (a coleta roda fora da trava, com até 25 s de `gh`); e grava `dadosDoFechamento` pelo `VIA_COM`, com o custo medido fora da trava. A conferência com a coleta vale também para a batida completa;
   - continua sem fechar: a fatia (`maisFatias`), o item com PR **ligado** aberto, o item com PR que o gh não leu. "Ligado" é o PR de `prs`, o da branch que a batida vê (a do item, a do worktree da dona) e o aberto cuja branch traz o id do item (F446);
   - o PR aberto numa branch que a batida não vê não segura o fechamento. Na dona do Orca, a branch do worktree só se lê com ela viva e registrada: com a dona arquivada, o PR novo aberto numa branch sem o id do item fica de fora. A batida completa tem o mesmo ponto cego para ela; as branches do Orca levam o id (`<usuário>/f472-…`), que o F446 liga;
   - fica de fora o item da dona `local_` (a do app desktop). Sem a lista do app, a leitura não vê a branch do worktree dela, e o PR aberto nela não seguraria o fechamento. Esse item segue com a batida completa;
   - é idempotente: o item fechado sai de `itensVivos()`. A leitura só grava o fechamento: não cutuca, não solta, não abre sessão.
2. **O item `feito` não volta a `merge` sem PR novo.** O `update` ou `set` que leva um item `feito` a `merge` é recusado, salvo se trouxer em `prs`, no mesmo update, um número que o item ainda não tinha. A mensagem manda usar `"etapa":"execucao"` para retomar o trabalho. A reabertura em `execucao` segue livre (F370), e o `VIA_COM` (a fila) não passa pela guarda.
3. **A reabertura direto em `merge`, sem PR ligado depois dela, não conta como reabertura** (`estado-deduzido.mjs#prsDoItem`):
   - vale só enquanto o item não saiu de `merge` desde a reabertura;
   - com PR novo ligado depois dela (aberto, mergeado ou fechado sem merge), a reabertura conta como antes, e o PR velho não fecha o item.

   Isso fecha o item que o item 2 não pegou: os que já foram reabertos assim antes desta versão, como o F455.

<a id="alternativas"></a>
## Alternativas consideradas
- **Só a guarda do item 2, sem a leitura fechar:** impede o próximo F455, mas deixa no Orca, aberto até alguém fechar à mão, todo item mergeado fora da fila (o merge pelo GitHub, a fila que caiu antes do `mergear`). Descartada.
- **A leitura não fechar o item da dona do Orca quando o git dela não foi lido** (arquivada, sem registro): tiraria o ponto cego do PR aberto em branch sem o id, mas deixaria aberto justamente o caso medido, o F455, cuja dona foi arquivada depois do merge. Descartada; o ponto cego fica escrito na Decisão.
- **A leitura fechar também o item da dona `local_`:** a branch dela não se vê sem a lista do app. Um PR novo aberto na branch, ainda fora de `prs`, não seguraria o fechamento, e o item fecharia com trabalho pendente. Descartada. O item dela fecha pela batida do app desktop ou pelo `mergear` da fila.
- **Recusar também `feito → execucao`:** quebraria a reabertura do F370, o único caminho legítimo para retomar um item fechado por engano. Descartada.
- **Exigir o PR novo só no deduzido, sem a guarda:** o item ficaria em `merge` à espera de um PR que ninguém vai abrir, sem aviso a quem o reabriu. A recusa na hora diz o que fazer. Descartada.
- **Ignorar toda reabertura sem PR novo, também em `execucao`:** fecharia o item que a dona retomou e ainda não abriu PR, pelo merge que já o tinha fechado, que é o que o 0027 quis evitar. Descartada.

<a id="consequencias"></a>
## Consequências
- No Orca, o item mergeado fecha em até 10 min, sem turno da orquestradora. A leitura devolve `fechados` quando fecha.
- Só vale depois de subir a versão do plugin `orquestracao` e reiniciar o Orca: a aba roda o `painel.mjs` da cópia instalada.
- O F455 real fecha pela primeira leitura depois da versão nova: os PRs dele estão todos mergeados, ele está em `merge` desde a reabertura e é da dona do Orca.
- A orquestradora que repetir um `update` velho de `merge` sobre um item fechado recebe a recusa, com o caminho certo.
- Teste de paridade (`painel-batida.test.mjs`, "F472 paridade"): a leitura e a completa fecham os mesmos itens, com os mesmos dados.
