# F153 · A orquestradora não fica dona de item em validação — plano (P5, 26/10)

Repo `kit-de-orquestracao`, branch nova a partir de `origin/main`. Regras (CLAUDE.md): Node ≥ 20, ESM, só nativos, `process.exitCode`, testes nunca tocam `~/.claude` real, commit conventional PT-BR. Gate `npm test`; teste isolado `node gate/com-fichas.mjs -- node --test <arquivo>`.
**Conflito previsto:** o F150 (outra E, em paralelo) também mexe em `pool/papeis/validadora.md` (linha do "aprovado") e em `pool/protocolo.md` (linha "PR validado vai à orquestradora"). Quem abrir o PR depois rebaseia; não reescreva as linhas do F150.

## Medido (26/10)
- A orquestradora foi dona do F135 (em `validacao`) e o `hooks/fila-do-item.mjs` bloqueou o fim do turno dela 3 vezes (log `~/.claude/orquestracao/fila-hook.log`, 00:25–00:27Z de 27/10) em turnos sem relação com o F135.
- O defeito é geral, não só da orquestradora: das **389** cobranças `bloqueou` do log, cruzadas com o `historico` dos itens, **155** foram em item em `execucao`, **59** em `validacao`, **2** em `merge` (216, 56%), contra 142 em `planejamento` e 10 em `design`. Nas etapas de execução/validação quem trabalha é a E/V do `com`; a dona (planejadora) só espera, e com a afinidade (Q418) uma planejadora é dona de vários itens ao mesmo tempo e é cobrada por todos a cada turno.
- O que cobra: `pendentes` em `fila-do-item.mjs:~178` (todo item com `donoLocalId` = a sessão e `atualizadoEm` anterior ao início do turno). A cobrança de despacho (`semDespacho`, F58) é outra e continua necessária.
- O item parado (ninguém trabalhando) já é da batida (`batida.mjs`, ADR 0007: cutuca a dona após 30 min, solta após mais 20).
- `pool/papeis/validadora.md:20`: o "validado" vai "a quem despachou, que repassa à orquestradora" (um salto a mais).

## Decidido (assumidas, a confirmar)
- D1. **A cobrança "grave o item neste turno" vale só onde a dona trabalha:** `planejamento` e `design` (e o item legado sem `etapa`, pelo critério antigo). Em `execucao`, `validacao` e `merge` a dona não é cobrada a cada turno; a cobrança de despacho/avanço (`semDespacho`) continua igual em todas as etapas, e o item parado continua com a batida.
- D2. **A V aprovada leva o item a `merge` e o solta**, no mesmo gesto do veredito: `painel update fila F<n> '{"etapa":"merge","donoLocalId":null,"donoApelido":null,"agora":"validado, HEAD <sha curto>"}'`, depois `painel com del F<n> <seu local_>`, e manda `PR N validado, HEAD <sha>` **direto à orquestradora, com cópia à dona** do item. A dona não repassa mais. Reprovado/com achados: continua indo só à dona.
- D3. **Orquestradora não é dona de item.** Quando ela mesma conserta (raro), entra no `com` e no `fez` (`com add` / `com del --fez`), nunca em `donoLocalId`. Regra escrita em `pool/papeis/orquestradora.md` e no protocolo; sem trava nova no `painel` (o D1 já tira a cobrança do caso medido, e identificar a orquestradora no `painel` exigiria o registro do app).
- D4. Sem ADR: ajusta a régua de um hook e o caminho do recado; não muda o desenho da fila (ADR 0007 continua valendo).

## Passos (teste antes do código)
1. **Testes vermelhos** em `hooks/tests/fila-do-item.test.mjs` (mesmo molde dos casos que já estão lá: `FILA_DIR`, `FILA_APP_SESSOES_DIR`, `FILA_LOG` temporários e transcript falso):
   - dona de item em `execucao` com um E no `com`, `atualizadoEm` anterior ao turno → **passa** (hoje bloqueia: confirmar vermelho);
   - idem em `validacao` com uma V no `com` → passa;
   - idem em `merge` → passa;
   - dona de item em `planejamento` não gravado no turno → **continua bloqueando** (prova que a presença ainda é detectada);
   - dona de item em `design` → continua bloqueando;
   - item em `validacao` SEM V no `com` e sem despacho no turno → continua bloqueando pela mensagem do `semDespacho` (não pela de "não o atualizou");
   - dona com dois itens, um em `planejamento` não gravado e um em `execucao` → a mensagem cita só o de `planejamento`.
2. **Código** em `hooks/fila-do-item.mjs`: o filtro de `pendentes` passa a exigir etapa em `planejamento`/`design` (ou `etapa === null`, o legado). Atualizar o comentário do cabeçalho (o que é cobrado e por quê, com a medição: 216 de 389). Nada muda em `semDespacho`.
3. **Docs**:
   - `pool/protocolo.md`, bullet "**Enquanto é dono:**": "todo turno grava algo no item" passa a valer em `planejamento`/`design`; nas outras etapas, gravar quando o estado mudar; o parado é da batida. Mesma correção onde o texto diz que o `fila-do-item` confere isso.
   - `pool/papeis/validadora.md`, "Para quem passa → aprovado": o gesto do D2 (update a `merge` soltando o dono, `com del`, mensagem à orquestradora com cópia à dona).
   - `pool/papeis/planejadora.md`, "PR validado → orquestradora": a V já mandou; a planejadora só confere que o item está em `merge` e segue.
   - `pool/papeis/orquestradora.md` e `skills/orquestradora/SKILL.md:38` ("À orquestradora chega só…"): chega da V, direto; e o D3 (não vira dona; conserto próprio vai por `com`/`fez`).
   - Se algum teste compara doc × hook (`esperando-papel-doc.test.mjs` e afins), rodar e ajustar o texto, nunca o teste.
   - Copiar este plano para `docs/planos/2026-10-26-dona-nao-e-cobrada-em-validacao.md`.
4. Gate `npm test` verde; `claude plugin validate plugins/orquestracao --strict`; subir a versão patch do plugin `orquestracao`. PR para `main`.

## Critério de pronto (medível)
- Os casos do passo 1 vistos vermelhos (os de `execucao`/`validacao`/`merge`) antes do código e verdes depois; os de `planejamento`/`design` verdes antes e depois (colar as duas saídas).
- `npm test` verde (colar o resumo com `exit=0`).
- `grep -n "merge" plugins/orquestracao/pool/papeis/validadora.md` mostra o gesto do D2.

## Fora de escopo
- O comando `painel mergear` e a trava do recado da V (são do F150).
- Mudar a batida, o `esperando-papel.mjs` ou o `painel.mjs`.
- Trava no `painel` que recuse a orquestradora como dona.
