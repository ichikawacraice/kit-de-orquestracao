# F208 · A orquestradora volta ao papel depois de limpar

## O caso medido (27/10, ~23:02 SP)
A orquestradora do kit (`local_78c5bdc6…`) limpou o contexto; o `session_id` passou de `3e69766f…` para `16a35400…`.
- A limpeza chegou ao hook de início como `SessionStart:startup`, não `clear`.
- O primeiro turno começou com um pedido do operador e durou 4 min editando código como dona; a skill `orquestracao:orquestradora` só foi carregada no fim (23:06), quando a própria sessão criou o marcador à mão.
- Por que o `painel-das-sessoes.mjs` não recriou o marcador: ele é hook de **fim de turno** (Stop). O título `🎛 orquestradora` estava no transcript desde a linha 17, então ele teria recriado o marcador — mas só ao fim do primeiro turno, depois das edições. Não houve erro (o `painel-hook.log` nem existe).
- `ativas/` tinha 33 marcadores: 3 de id atual de orquestradora viva e 30 de ids que as próprias orquestradoras deixaram para trás ao limpar (`priorCliSessionIds` do registro do app). Nenhum de sessão arquivada ou fora do registro: a batida já apaga esses.

## Decisão
O conserto é no início de sessão, não no `painel-das-sessoes.mjs`: só o SessionStart roda antes do primeiro pedido.
- `hooks/orquestradora-de-volta.mjs`, chamado pelo `sessao-inicio.mjs` em toda fonte (o matcher do SessionStart já é vazio): reconhece a orquestradora pelo registro do app (título `🎛 orquestradora`, achado pelo nome do arquivo `local_….json`) ou pela batida (`batida/<projeto>.json` com `orquestradora: <local_…>`); sessão arquivada não conta.
- Recria `ativas/<session_id>` com o git common dir e apaga os marcadores das ids que o registro já marca como anteriores (`priorCliSessionIds`). O da id atual do registro (`cliSessionId`) fica: "o app ainda não gravou a id nova" e "um `claude` lançado do Bash da orquestradora" (que herda o `CLAUDE_CODE_HOST_SESSION_ID`) chegam iguais ao hook, e no segundo apagar a atual derrubaria as travas da orquestradora viva.
- Limite conhecido: esse `claude` filho também ganha marcador e a ordem. A batida apaga o marcador dele (fora do registro) depois de 10 min.
- Injeta, antes do resumo das regras, a ordem de carregar `orquestracao:orquestradora` antes de qualquer coisa, inclusive do pedido que abriu o turno.
- Limpeza dos órfãos: a batida passa a apagar o marcador de id que está em `priorCliSessionIds` de alguma sessão (só id explicitamente deixada para trás). Marcador de id fora do registro só sai com mais de 10 min (pelo `mtime`): antes disso pode ser a id nova que o hook de início acabou de criar e o app ainda não gravou.
- O `painel-das-sessoes.mjs` fica como rede de segurança no fim do turno.

## Fora do escopo
- Trava que recuse a primeira ferramenta da orquestradora antes de carregar a skill (a ordem no contexto e o marcador já ligam as travas existentes).

## Critério de pronto
`tests/orquestradora-de-volta.test.mjs` (fontes `clear`, `startup`, `compact`; batida; registro atrasado; outra orquestradora; dona comum; arquivada; sem id do app; id com barra) e o caso novo de `painel-batida.test.mjs` verdes.
