# F479 · Retomada de dona no Orca: a orquestradora passa o item para a sessão nova

Plano da dona, 06/11/2026.

## O caso
No Orca, a dona que bate o limite de 5 h (ou que troca de sessão por contexto cheio) termina com o despacho `stopped/failed`. A orquestradora abre outra sessão na mesma worktree (`worker-start --worktree path:<pasta>`), mas o item continua apontando para a sessão antiga: o `donoLocalId`, a entrada dela no `com` e o `sessaoId` das perguntas abertas. Efeitos medidos em 06/11 (F476, F464):
- a aba Kit pinta "Sessão falhou", porque olha os despachos do terminal do `donoLocalId` (`orca/painel-do-kit/src/nucleo/sessoes.mjs`, `workersDoItem`);
- a resposta dada na aba a uma pergunta aberta vai ao endereço da sessão morta (`endereco.orca` deriva do `sessaoId`);
- o `com` acumula as sessões mortas (o F476 tinha quatro).

## Premissas conferidas
- "A nova não se regravou dona (o briefing mandava)": confere; a correção não pode depender de a sessão nova seguir o briefing.
- "`worker-release` do despacho antigo não resolveu": confere, e o motivo é outro: os despachos antigos já estavam `released` (worker-list de 06/11); a aba não olha a worktree, olha o terminal do `donoLocalId`. Soltar o antigo é limpeza, não conserto.
- "A aba deixar de pintar falhou quando há despacho vivo na mesma worktree": **não recomendo**. Com o item apontando para a sessão morta, "falhou" é verdade útil: diz que a passagem não foi feita, e a pergunta aberta continua indo para o lugar errado. Esconder o sintoma deixaria a causa (a resposta perdida) sem aviso.
- O briefing pede código por subagente Sonnet: a trava `subagente-nao-edita.mjs` e o `pool/dona.md` proíbem subagente de editar. A dona escreve.

## O que entra
1. **Comando** `painel orquestradora retomar F<n> --dispatch <ctx novo> [--esperar <s>] [--seco]`:
   - lê o `worker-list`; o despacho novo tem de estar vivo e com terminal;
   - acha a sessão nova em `orca-sessoes/` pelo terminal do despacho, com o `cwd` dentro da worktree; espera até `--esperar` segundos (padrão 60) o hook de início gravar o registro;
   - confere que o item é dessa worktree (a dona antiga, alguém do `com` ou a `branch` do item apontam para ela); recusa se não for;
   - recusa se uma sessão antiga da mesma worktree ainda estiver viva (duas donas escrevendo na mesma pasta);
   - grava numa trava só: `donoLocalId` = sessão nova (`donoApelido` "dona"), o `com` sem as sessões mortas da worktree e com a nova (o `oQue` herdado), a nova em `sessoes` (custo do item), e o `sessaoId` das perguntas abertas ou assumidas das sessões antigas (o endereço de entrega se rederiva);
   - solta (`worker-release`) os despachos antigos da worktree que pararam mas não foram soltos;
   - lê de volta o item e as perguntas e diz o que conferiu. `--seco` só mostra o que faria.
2. **Regra escrita** na skill `orquestradora`, seção "No Orca" (um item "Retomar a dona"), apontada pela linha do `clear_session` da tabela em `pool/anfitriao-orca.md` e pela nota do Orca em `pool/dona.md` (Contexto). Sem duplicar o texto.

## Fora do escopo
- A batida passar o item sozinha (auto-retomada): fica no `depois`; hoje a orquestradora abre a sessão nova e passa no mesmo turno.
- Mudar a aba.

## Critério de pronto
- Testes do `retomar` em `plugins/orquestracao/hooks/tests/painel-orquestradora-retomar.test.mjs`, escritos antes do código: passa o item, as perguntas e o `com`; recusa despacho morto, item de outra worktree, sessão antiga viva e registro que não aparece; `--seco` não grava nem chama o `orca`.
- Testes afetados verdes; `orquestracao:validador` sem achado médio ou alto aberto.
