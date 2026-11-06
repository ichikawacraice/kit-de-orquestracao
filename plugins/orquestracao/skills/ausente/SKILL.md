---
name: ausente
description: Liga e desliga o modo ausente da orquestradora — /ausente on abre, no turno do operador, as sessões donas que faltam para os itens sem dona (até o teto); depois disso nenhuma sessão abre fora do turno do operador. /ausente off volta ao normal e entrega o resumo do período. Só pelo comando; nenhuma frase liga ou desliga.
argument-hint: on | off
disable-model-invocation: true
---

# /ausente on | off — o modo ausente

Argumento: `$ARGUMENTS`.

**Só este comando liga e desliga o modo**: o operador pode voltar, dar um comando e sair de novo sem desligá-lo. O hook `${CLAUDE_PLUGIN_ROOT}/hooks/operador-ausente.mjs` grava a bandeira `~/.claude/orquestracao/operador-ausente.json` no `on` e, no `off`, a **guarda como período** (`{ligado:false, desde, desligadoEm, por}`, o `desde` é o do `on`). O botão do topo do painel é a segunda via humana: liga e desliga a mesma bandeira (o desligar do painel grava o mesmo `{ligado:false, desde, desligadoEm, por:"painel"}`, porque o pane não apaga arquivo; a bandeira só vale ligada quando existe, tem `desde` válido e `ligado` não é `false`). Com o modo ligado a orquestradora pode se limpar inteira sozinha (ninguém está lendo); frase ("vou dormir") e prompt comum não mexem, e não há prazo. Com o modo ligado, o operador pode mandar comandos normalmente: o turno dele abre sessão (é ele ali), e o de notificação ou de outra sessão só propõe cartão (trava T3 do `travas-da-sessao.mjs`).

- **`off`:** responda numa linha que o modo ausente foi desligado. **Resumo do período:** se esta sessão é a orquestradora, entregue já o resumo do que aconteceu, pela seção `resumo-da-ausencia` da skill `orquestradora` (`node "${CLAUDE_PLUGIN_ROOT}/skills/orquestradora/scripts/ausencia.mjs" resumo --md`); se não é, diga numa linha que a orquestradora do projeto o entrega no próximo turno dela. Daí em diante a orquestradora volta a abrir a dona de cada item que nasce e a arquivar sozinha a sessão dona de item fechado. Grave a etapa no painel e uma linha no `~/.claude/orquestracao/<projeto>.md` (o da orquestradora deste projeto). Não faça os passos abaixo.
- **Sem argumento:** diga se o modo está ligado (a bandeira existe, tem `desde` válido e não traz `ligado:false`; e desde quando) e como ligar/desligar. Não mude nada.
- **`on`:** os passos abaixo.

O operador digitou `/ausente on`: vai ficar fora ou dormir. Este turno é dele, então `start_session` abre sessão. Depois dele, só sai cartão. Regra em `${CLAUDE_PLUGIN_ROOT}/pool/protocolo.md`, âncora `nunca-travar`.
No Orca: `orca orchestration worker-start` no lugar de `start_session` e `worker-list --json` no lugar de `list_sessions` ([tabela](../../pool/anfitriao-orca.md)). No terminal não há sessão a abrir: o modo ausente só vale onde o anfitrião abre sessão.

**Fora da orquestradora:** se esta sessão não é a orquestradora (título sem `🎛 orquestradora`), diga isso numa linha e não faça nada.

## Passos

1. **O que existe e o que está vivo.** Rode `painel list fila --projeto <este>` e `list_sessions` (sem `linked`: a dona que se desligou com `detach_session` some da família): quais itens estão sem dona e quantas donas já trabalham, contadas pelos itens vivos com `donoLocalId` de sessão não arquivada.
2. **Abra as donas que faltam, até o teto** (4 donas trabalhando, 3 com a máquina cheia; protocolo, âncora `teto-de-donas`): um `start_session` por item sem dona, com o título `F<n> · <tema>` e o modelo pela classificação do item (skill `papeis-e-modelos`). É a última chance: depois deste turno, item que nascer sem dona espera a volta do operador.
3. **O resto fica na fila.** Não se propõe cartão para cada item além do teto, e **nada se arquiva** enquanto o modo ausente durar.
4. **Registre:**
   - no painel, o dono de cada item aberto e a etapa da orquestradora (*"modo ausente: N donas abertas"*);
   - uma linha no `~/.claude/orquestracao/<projeto>.md`.
5. **Responda numa mensagem curta:**
   - quantas donas abriu e para quais itens;
   - quantos itens ficaram na fila esperando;
   - o que vai precisar de você na volta (só o que pede Q-ID: produção, release, o irreversível).
