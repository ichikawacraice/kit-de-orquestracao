# F371 · A dona parada volta sozinha (limpeza e limite de uso)

Casos 2 e 3 da nota `~/.claude/orquestracao/notas/2026-11-03-izanagi-donas-paradas.md` (os casos 1, 4 e 5 são do F370).

## O que foi medido
- **Limpeza:** a T7 (`hooks/travas-da-sessao.mjs`) só grava a marca `volta-da-limpeza/<local_…>.json` para a orquestradora; o `clear_session "self"` da dona passa sem marca. O `contexto-do-papel.mjs` cobra a dona a se limpar, então o caminho que o kit manda seguir é o que a deixa parada. O mod (`register.tsx#acordarQuemVoltou`) roda em toda sessão viva, mas manda só o `PROMPT_DA_VOLTA` da orquestradora.
- **Limite de uso:** a recusa vira, no transcript da sessão, uma linha `assistant` sintética com `isApiErrorMessage: true`, `error: "rate_limit"`, o texto `You've hit your session limit · resets 8pm (America/Sao_Paulo)` e, desde o CLI de outubro, `quotaLimits.resetsAt` (epoch em segundos; também em `apiErrorParams.rate_limit_info.resetsAt`). Contagem em `~/.claude/projects` (03/11): 265 linhas do fio principal com `quotaLimits.resetsAt`; 11 sem (julho, CLI 2.1.202), só com o texto.
- **Efeito colateral de hoje:** a dona no limite tem o item parado: a batida a cutuca (a cutucada bate de novo no limite) e, 20 min depois, **solta o item**.

## Decisão
- **Caso 2:** a T7 grava a marca também no `clear_session "self"` da sessão que é dona de item vivo, com `papel: "dona"` e `itens: [{ id, handoff }]` (o handoff só quando o arquivo existe). Não é trava: a limpeza da dona segue liberada como antes. O mod escolhe a mensagem pela marca: a da dona manda reler `pool/dona.md` e retomar pelo handoff do item. O processo novo da dona apaga a marca e não abre o painel.
- **Caso 3:** a batida (I/O em `painel.mjs`) lê o fim do transcript atual de cada dona de item vivo; se a última linha do fio principal é a recusa de limite, guarda `resetsAt` (do `quotaLimits`, senão do texto `resets 8pm (<fuso>)` contado a partir da hora da linha). No `julgar`: antes do reset, o item não é cutucado nem solto; passado o reset, com a dona parada, manda uma vez `retome pelo handoff` (estado `limites[<local_…>] = resetsAt`, para não repetir).

## Fora do escopo
- Orquestradora no limite de uso (ela não é dona de item); fica como `depois`.
- Limite semanal com data (`resets Nov 1 at 1am`) sem `resetsAt`: o texto não é lido; sem a hora, a batida segue como hoje.

## Pronto quando
- Testes: T7 grava a marca da dona (e não grava para sessão sem item); o mod manda à dona a mensagem com o handoff; `julgar` não cutuca/solta antes do reset e manda a retomada uma vez depois; a leitura do transcript acha `resetsAt` nos dois formatos.
