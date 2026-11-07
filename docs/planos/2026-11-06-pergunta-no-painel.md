# F478 · Toda pergunta ao operador chega ao painel

Data: 06/11/2026 (SP). Dona: sessão `orca_session_id:d63a809d-…` (Opus, esforço alto).

## O que foi medido
- `proxima-pergunta` só reserva o Q-ID; gravar é outro passo (`painel set perguntas`). Nada liga os dois.
- `painel set` **já** termina com exit 1 e a mensagem no stderr quando recusa (ex.: `F<n>` solto). O que escondeu o erro em Q1160/Q1167 foi o `| tail`: o código de saída do pipe é o do `tail` (0).
- A trava `painel-das-sessoes.mjs` conta "gravou" pelo **texto** do comando (`painel … perguntas`), não pelo arquivo: o `painel set perguntas` recusado conta como gravado.
- A mesma trava sai logo no começo para a orquestradora (`ativas/<session_id>`), e o `orquestradora-ritual.mjs` não olha Q-ID nenhum: a orquestradora não tem cobrança de pergunta.
- O painel aceita qualquer `estado` em `perguntas`. No painel real: 2 `aguardando`, 2 `pendente`, 9 `entregue`, 1 `adiada`, 1 `aplicada`, 1 `descartada`, 1 `substituida`. A aba do kit no Orca e o pane só mostram `aberta` e `assumida`: essas perguntas não aparecem a ninguém.
- No Orca, a dona pergunta por `orca orchestration ask --question "Q12 — …"`; o Q-ID fica no comando, não na mensagem final, e a trava não o lê.

## Premissas do briefing conferidas
- (a) comando único: **sim**, com um ajuste: valida **antes** de reservar o número (recusa não gasta Q-ID) e imprime só o ID no stdout.
- (b) cobrar da orquestradora o Q-ID citado que não está como `aberta`/`assumida`: **ajustado**. Ela cita o tempo todo pergunta já respondida ("Q1096 decidido…"); exigir `aberta`/`assumida` travaria relato legítimo. A regra que já vale para as outras sessões (o Q-ID recente citado tem arquivo no painel, em qualquer estado) é a que pega o defeito: o Q-ID anunciado e não gravado não tem arquivo.
- A trava não segura a mensagem antes de ela sair: o Stop roda depois do texto aparecer. O que ela garante é que o turno não termina sem o registro (segundos de diferença). Segurar antes só existiria com a pergunta saindo por um comando, que é o (a).

## Decisão
1. **`painel perguntas nova '<json>'`**: valida o documento (as mesmas regras do `set`), reserva o Q-ID pelo `proxima-pergunta.sh` (a mesma trava do contador), grava, relê o arquivo e confere estado e `sessaoId`, e imprime `Q<n>`. Recusa → exit 1 e a mensagem, sem gastar número; falha depois de reservar → exit 1 dizendo qual Q-ID ficou reservado sem gravar. `sessaoId` padrão = a sessão que chama (`quemSou`); `estado` padrão `aberta`, só `aberta` ou `assumida`; `titulo`, `caso` e `recomendacao` obrigatórios, e `seNaoDecidir` na `aberta`. JSON com `id` recusa.
2. **`estado` de pergunta no contrato**: o painel recusa gravar estado fora de `aberta · assumida · respondida · cancelada` (quando a op traz `estado` ou cria o documento com ele; sem `estado` é rascunho e segue aceito, uso que o `painel-endereco` já testa). O documento antigo com outro estado segue aceitando `update` dos demais campos.
3. **Trava `painel-das-sessoes.mjs`:**
   - "tirou ID" passa a conferir o **efeito**: os Q-IDs que a saída do `proxima-pergunta` devolveu no turno têm de existir no painel no fim do turno. Sem Q-ID legível na saída, vale o teste de texto de antes.
   - A orquestradora deixa de sair no começo: para ela valem as duas cobranças de Q-ID (o reservado e não gravado; o citado na mensagem final sem arquivo). A da decisão *assumida, a confirmar* e a da resposta recebida continuam só das outras sessões (ela relata decisões alheias).
   - O texto de `orca orchestration ask|send` do turno entra na busca de Q-ID sem arquivo, como a mensagem final.
   - Mesma marca por turno de antes (`qid`): cobra uma vez, sem laço.
4. **Regra escrita onde mora**, sem duplicar: o resumo injetado (`regras-globais.md`) e o protocolo passam a mandar `painel perguntas nova`; a skill da orquestradora, a referência das travas, `dona.md` e `anfitriao-orca.md` apontam para eles. `proxima-pergunta` continua (CLI e compatibilidade).

Sem ADR (*assumida, a confirmar*): o item reforça regras que já existem (toda pergunta no painel; os quatro estados que a tela mostra) e estende uma trava a mais uma sessão; não muda desenho.

## Fora do escopo
- Migrar as 18 perguntas com estado fora do contrato (decisão do operador sobre cada uma; vai no `depois`).
- Segurar a mensagem antes de ela sair (não há gancho para isso).

## Critério de pronto
- Teste vermelho antes do código, pelo motivo certo: orquestradora citando Q-ID sem arquivo passa hoje; `proxima-pergunta` + `painel set` recusado passa hoje; `estado:"aguardando"` grava hoje; `perguntas nova` não existe.
- Cada teste de ausência prova antes que a presença seria detectada (o mesmo caso com o arquivo no painel passa).
- Testes afetados verdes; validador `orquestracao:validador` sem achado médio ou alto aberto.
