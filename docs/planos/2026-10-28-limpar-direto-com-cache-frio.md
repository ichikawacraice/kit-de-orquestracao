# F213 · Botão Limpar limpa direto com o cache frio

**Pedido do operador:** com o cache expirado (1 h sem turno), o `↺ Limpar` da barra não deve pedir à sessão que se limpe: o turno que grava o handoff reescreve a conversa inteira sem cache (~280 mil tokens a preço dobrado na orquestradora).

## Decisão
- **Quente** (relógio da barra > 0 ou desconhecido): como antes — grava o ok `limpeza/<local_…>.json` e manda o `PROMPT_DE_LIMPAR`.
- **Frio** (relógio vencido e nenhum turno rodando, `cacheFrio`): rótulo `↺ Limpar já`; grava o mesmo ok e chama `mcp__ccd_session_mgmt__clear_session` `"self"` pelo mod (`$.tool.call`), sem prompt.
- **Queda:** clear recusado (`deny` de hook ou `isError` do app), exceção, ou a sessão ainda viva 20 s depois (a limpeza mata o processo do CLI, F45) → toast e aviso `A limpeza direta não pegou (…); pedi à sessão que se limpe.`, regrava o ok (a T7 o gasta ao liberar) e manda o prompt de sempre.
- **Turno rodando nunca é limpo direto** (`isWorking` do render ou `turn.start` sem `turn.complete`).

## O que vale depois
- **T7:** o `$.tool.call` do mod passa pelos hooks como a chamada do modelo; o ok do botão é gravado antes, então a T7 libera e o gasta.
- **O papel volta** pelo `sessao-inicio.mjs` / `orquestradora-de-volta.mjs` em todo início de sessão, qualquer que seja a origem da limpeza.
- **O que se perde:** o handoff do turno da limpeza. O estado da orquestradora mora em `~/.claude/orquestracao/<repo>.md`; a skill passa a exigir o arquivo em dia ao fim de todo turno que muda algo. O botão só existe na orquestradora.

## Assumido, a confirmar
- `session_id: "self"` vindo do mod resolve para a própria sessão (o mod já usa `get_session "self"`). Não medido no app: a limpeza direta só se mede clicando numa orquestradora de cache frio; se o app recusar, a queda leva ao comportamento antigo.
- Rótulo `↺ Limpar já` (mesma largura de `↺ Limpando…`, as somas da revisão de design da barra não mudam).

## Critério de pronto
Testes do mod cobrindo quente, frio, frio com turno rodando, recusa do app, negação de hook e prazo sem recomeçar; teste doc × código da skill; afetados verdes.
