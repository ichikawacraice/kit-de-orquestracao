# F152 · Dizer quando o app pode ser reiniciado — plano (P5, 26/10)

Repo `kit-de-orquestracao`, branch nova a partir de `origin/main`. Regras (CLAUDE.md): Node ≥ 20, ESM, só nativos, `process.exitCode`, testes nunca tocam `~/.claude` real, processo filho síncrono com `timeout`/`SIGKILL`, commit conventional PT-BR. Gate `npm test`; testes do mod `claude plugin test plugins/painel-sessoes`. Tela: o fluxo de design do CLAUDE.md (revisão da D1 em `docs/design/revisoes/` antes do código; crítica depois, ≥ 24/30).

O item tem duas partes: **A** (o comando, sem tela, já decidido aqui) e **B** (onde e como a tela mostra, decidido pela revisão da D1). A E executa as duas depois da revisão aprovada, num PR só.

## Medido (26/10, 22:50 SP)
- Reiniciar o app derruba **todas** as sessões da máquina (de todos os projetos): o que importa é qualquer sessão com turno rodando, qualquer teste rodando e qualquer merge no meio.
- Sessões: `list_sessions` dá `isRunning`; a batida grava a lista em `~/.claude/orquestracao/batida/sessoes.json` a cada 10 min (pode ter até 10 min). A barra de status (`plugins/painel-sessoes/hooks/barra.tsx`) só lê arquivos, a cada 30 s; o `list_sessions` fica para o pane aberto (`register.tsx:829`) e para a batida (`register.tsx:1375`).
- Testes: fichas em `~/.claude/orquestracao/nucleos-de-teste/<n>` (`{"pid","worktree","projeto","desde"}`), hoje 4 tomadas por 2 pids do Izanagi; `gate/o-teto-da-maquina.mjs` exporta `estadoDoTeto`, `pastaDoTeto`, `processoVivo`. Teste fora das fichas (um vitest solto, o caso do Izanagi em `apps/web`) só aparece em `ps`.
- Merge: hoje a orquestradora olha à mão; o sinal real é um processo `gh pr merge` / `git rebase` / `git merge` vivo, ou a orquestradora com turno rodando (que já cai em "sessões").
- Mandar mensagem a uma sessão para perguntar abre turno nela e fecha a janela: **o comando não manda mensagem a ninguém**.
- Quem pergunta está, ele mesmo, com turno rodando: o comando se exclui (registro do app pelo `CLAUDE_CODE_SESSION_ID`, como o `painel.mjs` já faz com `pool-comum.mjs`).

## Parte A — `painel pode-reiniciar` (decidido)
`painel pode-reiniciar [--sessoes <arquivo do list_sessions>] [--json]`
- **Sessões:** do `--sessoes` (lista fresca); sem ele, de `batida/sessoes.json`, dizendo a idade ("lista de há 7 min"). Conta toda linha com `isRunning: true` e `isArchived: false`, menos a própria sessão. Motivo: `"<título> trabalhando"` (título como está na lista).
- **Testes:** fichas com pid vivo (`estadoDoTeto` / `processoVivo`, importados de `gate/o-teto-da-maquina.mjs` do mesmo repo do plugin; se o caminho não existir no plugin instalado, copiar a leitura mínima para um módulo do plugin e um teste que compara as duas) → `"teste de <projeto> em <worktree curto> (N fichas)"`; e processos de `ps -axo pid=,command=` que casam `vitest|jest|node(\s+\S+)*\s+--test` e não são pid de ficha → `"teste fora do teto: <comando curto>"`.
- **Merge:** processos `gh pr merge`, `git rebase`, `git merge`, `git cherry-pick` vivos (pelo mesmo `ps`) → `"merge/rebase no meio: <comando curto>"`.
- **Saída:** `{pode: boolean, motivos: [{tipo: "sessao"|"teste"|"merge", texto, localId?}], sessoesDe: "lista"|"batida", idadeMin?, em}`; texto: `Pode reiniciar.` ou `Não reinicie agora:` + um motivo por linha. Exit 0 nos dois casos (é resposta, não erro); exit 1 só em erro de leitura.
- **Grava** o resultado em `~/.claude/orquestracao/batida/pode-reiniciar.json` (mesma pasta da batida, com `em`), para a barra ler sem `list_sessions` (contrato da parte B).
- **A batida** chama o mesmo julgamento a cada volta, com a lista que já tem, e grava o mesmo arquivo (em `comandoBatida`, sem mensagem nova).
- `ps` injetável por env (`PODE_REINICIAR_PS` aponta um arquivo com a saída, para teste); `KIT_NUCLEOS_DIR` já troca a pasta das fichas.

## Parte B — a tela (pergunta à D1)
A D1 decide, numa revisão em `docs/design/revisoes/2026-10-26-pode-reiniciar.md` (com mock, claro e escuro, larguras da barra como a revisão da barra de status):
1. Onde aparece "pode reiniciar": na barra de status, no topo do pane, ou nos dois; e se aparece **só quando pode** (silêncio quando não pode) ou sempre.
2. Como mostra o "não pode" com os motivos (quantos cabem, o que corta) e a idade do dado (`pode-reiniciar.json` de há X min: a partir de quanto tempo o dado deixa de valer e a tela diz que não sabe).
3. O "me avise" (pedido do operador: *"me avise quando eu puder reiniciar o app"*): um botão que liga um aviso único quando passa a poder (notificação do app ou destaque na barra), e como ele se desliga.
Restrições para a revisão: a barra não chama `list_sessions` (só lê arquivo, a cada 30 s); o pane aberto pode rodar `painel pode-reiniciar --sessoes` com a lista dele a cada leitura; texto de UI sem citar item, ADR ou doc; ação assíncrona com estado visível.

## Passos da E (depois da revisão aprovada)
1. Testes vermelhos da parte A em `plugins/orquestracao/hooks/tests/painel-pode-reiniciar.test.mjs` (`PAINEL_DIR`/`HOME`/`KIT_NUCLEOS_DIR` temporários, `PODE_REINICIAR_PS` com saídas falsas): nada rodando → `pode: true`; uma sessão `isRunning` → `pode: false` com o título; a própria sessão (`CLAUDE_CODE_SESSION_ID` + registro falso) rodando → não conta; ficha com pid vivo → motivo de teste; ficha com pid morto → não conta; vitest no `ps` sem ficha → "fora do teto"; `gh pr merge` no `ps` → merge; sem `--sessoes` usa `batida/sessoes.json` e diz a idade; o arquivo `pode-reiniciar.json` é gravado; a batida grava o mesmo arquivo.
2. Código da parte A: módulo `plugins/orquestracao/skills/orquestradora/scripts/pode-reiniciar.mjs` (função pura `julgarReinicio({sessoes, eu, fichas, ps, agora})` + leitura), subcomando no `switch` do `painel.mjs` e linha de uso no cabeçalho; chamada na batida.
3. Parte B conforme a revisão, em `plugins/painel-sessoes/hooks/` (barra e/ou pane), com testes `.tsx` em `plugins/painel-sessoes/tests/`. Crítica de UI depois do código (≥ 24/30, até 2 recríticas).
4. Docs: `pool/protocolo.md` (seção da batida: ela grava `pode-reiniciar.json`), skill `orquestradora` (o comando no lugar da conferência à mão). Plano copiado para `docs/planos/2026-10-26-pode-reiniciar.md`.
5. Gate `npm test` e `claude plugin test plugins/painel-sessoes` verdes; `claude plugin validate` dos dois plugins; versão patch dos dois. PR para `main`.

## Critério de pronto (medível)
- Casos do passo 1 vermelhos antes e verdes depois (colar as saídas); testes do mod verdes (colar).
- `painel pode-reiniciar` rodado de verdade na máquina responde `Não reinicie agora:` listando pelo menos a própria orquestradora/sessões ativas que o `list_sessions` mostra como `isRunning` (colar), e o arquivo `pode-reiniciar.json` aparece com `em` recente.
- Crítica da tela ≥ 24/30 sem ressalva alta (colar a nota).

## Fora de escopo
- Reiniciar o app sozinho, ou pedir a sessões que parem.
- Atualizar plugins (F151).
- Esperar fichas de outra máquina ou o CI.

## Adendo depois do design (P5, 27/10)
- A revisão da D1 está mergeada (PR 72, crítica 25/30): `docs/design/revisoes/2026-10-26-pode-reiniciar.md` + `-mock.html`. **Ela manda na parte B** e substitui a "Parte B — a tela" acima; cumpra-a sem redesenhar (estados, idade do dado, vigia, mensagens, gestos para a auditoria de clique).
- Aceitos pela P5 os ajustes ao contrato da parte A (revisão, âncora `pendencias`): **C1** o `pode-reiniciar.json` grava todos os motivos, a sessão que rodou incluída, cada motivo de sessão com `localId`; só a saída em texto e `--json` exclui quem pergunta. **C2** campo `listaEm` (ISO, o instante da lista de sessões) ao lado de `em`. **C3** `batida/aviso-de-reinicio.json` (`ligadoEm`, `vigia`, `avisadoEm?`, `naoPodeSeguidos`) e a vigia de 60 s com `list_sessions` só com o aviso ligado, no mod de uma sessão.
- Aceito o **rearme** do aviso (revisão, §Decisões ao operador) no lugar do "aviso único".
- Os testes do passo 1 ganham: arquivo com o motivo da própria sessão e `localId` (C1); `listaEm` presente e igual ao instante da lista (C2). A parte B ganha testes `.tsx` dos estados da tabela "O me avise" e da régua de idade (2 min / 15 min / não sei), e a auditoria de clique dos gestos listados na revisão.
