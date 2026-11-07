# F484 · Dona no limite da conta: acordar no mesmo despacho e, se não andar, recriar na mesma Task

Plano da dona, 07/11/2026.

## O caso
Em 07/11, cinco donas (F441, F442, F481, F482, F483) receberam do Orca a `escalation` *"Claude hit its session limit · resets 11am"*. O operador trocou a conta selecionada no Orca e a orquestradora mandou `send --to dispatch:<ctx>` a cada uma: 4 de 5 retomaram no mesmo chat, já na conta nova. O operador pediu que o procedimento vire regra do kit, para toda orquestradora: acordar mudando de conta; se não der, encerrar e recriar com handoff.

## Premissas conferidas
- **A escalation** (medida na caixa do Orca, `orca orchestration inbox --json --full`): `type: "escalation"`, corpo com o título da tarefa (`while running task "Você é a dona do F441 · …"`), `payload` JSON com `failureKind: "usageLimitReached"`, `dispatchId`, `handle` e `detail` (a hora do reset).
- **O despacho depois do limite** depende do `--keep-open`. Com ele, o despacho fica `ready` e o terminal `active` ("The task is still assigned to this chat"). Sem ele, o worker é temporário e fecha 2 min depois: `stopped`, outcome `failed`, terminal `released`. As duas formas foram medidas em 07/11.
- **Ordem do passo 4 do pedido** ("solte o antigo só depois de a nova andar"): não confere. O retry do Orca pede o antigo encerrado. O `painel orquestradora retomar` do F479 recusa enquanto a sessão antiga está viva, e o `worker-release` só solta worker já assentado. A ordem certa:
  1. handoff;
  2. `worker-stop` do antigo;
  3. `worker-start --task <id> --retry-of <ctx antigo> --worktree path:<pasta> --keep-open`;
  4. `send` ao novo;
  5. `retomar`, que solta o que sobrar.
- **Recriar por `--spec-file`** (versão 1 do pedido) abre outra Task e perde a cadeia de tentativas. O guia do Orca manda fazer o retry na mesma Task (versão 2 do pedido, da orquestradora).
- **A trava do `orca` recusava o retry da dona em Opus alto.** Com `--task`, não há texto legível para ver a linha `Esforço alto:`. Sem mudança, o comando da regra não rodaria.
- **O `arquivar` recusava a dona morta no limite** (`worker não está parado: <ctx> em stopped`, F476), porque só olhava `estadoFinal`. O `retomar` já tratava `stopped` como parado.
- **`--display-name` com `--worktree path:`:** o `orca` o recusa (F477). Não entra no retry.

## O que entra
1. **Trava do ritual** (`hooks/orquestradora-ritual.mjs` + `hooks/dona-no-limite.mjs`): no Orca, o item sem dona cuja dona tem escalation de limite nas últimas 24 h e despacho vivo e não parado no terminal dela não é cobrado.
   - A caixa só é lida quando sobra item a cobrar.
   - A leitura falha fechada: sem orca, ou com caixa ou lista ilegível, segue cobrando.
2. **Trava do `orca`** (`hooks/trava-do-orca.mjs`): `worker-start --task … --retry-of …` aceita Opus alto sem texto legível. A pasta, o modelo, o esforço da dona (medium ou high) e o `--model`/`--effort` explícitos seguem conferidos.
3. **`arquivar`** (`painel.mjs`) aceita como parado o despacho `stopped` com terminal `released` (`despachoEncerrado`, em `orca-workers.mjs`):
   - não chama `worker-release` no terminal já solto;
   - o `--concluidas` também o acha.
4. **Regra escrita:**
   - âncora `dona-no-limite` na skill `orquestradora` (No Orca);
   - linha na tabela de `pool/anfitriao-orca.md`;
   - ponte em `protocolo.md#limite-de-uso` e em `referencia.md#trava-do-ritual`;
   - `--keep-open` em toda abertura de dona (skill e tabela).
5. **Teste doc × trava:** o marcador `/caminho/da/worktree` dos exemplos vira uma worktree real, para o retry com `path:` ser conferido de verdade.

## O que a revisão (`orquestracao:validador`) mudou
- O `arquivar` solta um despacho por terminal ainda retido da pasta ou do terminal, o pedido primeiro. Antes soltava só o despacho pedido: depois do retry, arquivar pelo despacho velho (já solto) deixaria aberto o terminal do novo. Testes `arquivar-10` e `concluidas-1c`.
- As leituras do Orca no ritual têm um orçamento de 6 s (`ORCAMENTO_MS`), abaixo dos 10 s de teto do hook. Sem isso, o Orca lento mataria o hook e o turno não cobraria nada.
- O passo 4 da skill roda o `retomar` antes do `send`. Para ligar o item à worktree, grava a `branch` no item, e não a dona antiga pelo registro da sessão, que o limpador apaga quando o terminal está solto.
- A Q1202 diz que o retry libera Opus alto para qualquer Task, não só para a dona.

## Decisões assumidas (a confirmar)
- **Q1201:** o passo 4 (recriar) é automático depois de um reenvio sem efeito, sem ok do operador.
- **Q1202:** a trava aceita Opus alto no retry da mesma Task sem reler o texto, de qualquer Task (ela não sabe com que modelo saiu o primeiro despacho).

## Fora do escopo (vai ao `depois`)
- O pane, o `painel list` e a batida seguem pintando "sem dona" para o item da dona no limite que não se gravou. Só a trava do ritual mudou.
- (o comentário do F479 no `retomar` ganhou a ressalva do `--keep-open`.)

## Critério de pronto
- Testes escritos antes do código, todos vermelhos pelo motivo certo:
  - `dona-no-limite.test.mjs`;
  - os `(limite-*)` do ritual;
  - `arquivar-7/8/9` e `concluidas-1b`;
  - o retry da trava;
  - o doc × trava com o marcador.
- Testes afetados verdes; `orquestracao:validador` sem achado médio ou alto aberto.
