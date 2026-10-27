# F150 · Mergear o PR validado num comando só — plano (P5, 26/10)

Repo: `kit-de-orquestracao`, branch nova a partir de `origin/main` (12eb0d9). Regras do repo (CLAUDE.md): Node ≥ 20, ESM, só módulos nativos, `process.exitCode`, testes nunca tocam `~/.claude` real, commit conventional em PT-BR. Gate: `npm test`. Teste isolado: `node gate/com-fichas.mjs -- node --test <arquivo>`.

## Medido (26/10)
- A orquestradora fez à mão, 4 vezes: `gh pr view headRefOid` → comparar com o HEAD do recado → `git merge-tree --write-tree origin/main <sha>` → `gh pr merge --squash --match-head-commit <sha>` → `painel com del` de cada sessão → `painel update fila … etapa feito`.
- `gh pr merge --match-head-commit 320d113` falhou: "Could not coerce value 320d113 to GitObjectID" (gh exige os 40 hex).
- `painel com del <F> <local_>` só aceita `local_<uuid>` (`painel.mjs:659`, `LOCAL_ID` em `:143`); o apelido é recusado.
- A regra do merge-tree está em `skills/orquestradora/SKILL.md:75` (status 0 mergeia; 1 com CONFLICT devolve; outro, ler a saída).
- O recado da V já tem formato escrito (`pool/papeis/validadora.md:20`: `PR N validado, HEAD Y`), mas nada o confere; uma V mandou "aprovado" sem sha.
- A trava T6 (`hooks/papel-do-pool.mjs:98`) só reconhece `gh pr merge`; o matcher do `papel-do-pool` em `hooks/hooks.json` não inclui SendMessage/send_message (o do `segredo-sai.mjs` inclui).

## Decidido
- D1. Comando novo `painel mergear <PR> <sha> [--seco]`, num módulo próprio `skills/orquestradora/scripts/mergear.mjs` (como `batida.mjs`/`handoffs.mjs`), chamado do `switch` de `painel.mjs`. Fala com `gh` e `git` por `execFileSync` (com `timeout` e `killSignal: 'SIGKILL'`). `GH_BIN`/`GIT_BIN` (env) trocam os executáveis, para teste.
- D2. A fila só se grava dentro de `comTrava` e por `planejar/efetivar` com `VIA_COM` (é o único caminho que mexe no `com`). O merge do GitHub roda FORA da trava (é lento); a escrita no painel roda depois, dentro dela.
- D3. O item fecha só quando TODOS os `prs` dele estão MERGED (o merge atual conta). Faltando outro: fica em `merge`, `agora` = "um PR entrou; falta outro", sem citar número (`CITA_NUMERO` recusa `#n`/`F<n>` em alguns campos; use texto).
- D4. Recado da V vira trava T9 no `papel-do-pool.mjs` (*assumida, a confirmar*): mensagem de um membro V (SendMessage ou `mcp__ccd_session_mgmt__send_message`) cujo texto tem `validado` ou `aprovado` (palavra inteira, sem acento-sensível) e NÃO tem a linha `PR <n> validado, HEAD <7–40 hex>` → `deny` com o formato no motivo. Só para V; outros papéis passam.
- D5. `com del` aceita o apelido: se o 2º argumento não casa `LOCAL_ID` mas casa `^[PDEV]\d+$`, procura no `com` do item pelo apelido; zero → erro "não está em com"; dois ou mais → erro "apelido ambíguo, use o local_".
- D6. Sem ADR: é ferramenta sobre uma regra já escrita (SKILL.md:75), não muda desenho.

## Passos (teste antes do código em cada um)
1. **Teste vermelho do `mergear`** em `hooks/tests/painel-mergear.test.mjs` (mesmo molde de `painel-fila.test.mjs`: `PAINEL_DIR`/`HOME` temporários, `spawnSync` com `timeout`/`SIGKILL`). Montagem: um repo bare temporário como `origin` com `main` e um commit de PR em `refs/pull/<N>/head` (git real); um clone dele como cwd; um `gh` falso (script Node em pasta temporária, apontado por `GH_BIN`) que lê um JSON de estado (`state`, `headRefOid`, `baseRefName`, `headRefName`, e o estado dos outros PRs) e anota cada chamada num arquivo. Casos:
   - sha curto (7) que é prefixo do `headRefOid` → chama `gh pr merge <N> --squash --match-head-commit <40 hex>` (confere o argumento gravado pelo gh falso) e sai 0;
   - sha que não é prefixo → recusa "a ponta mudou: validado <x>, agora <y>", exit 1, nenhum `gh pr merge`;
   - sha com menos de 7 hex ou não hex → erro de uso;
   - PR não OPEN (MERGED/CLOSED) → recusa, sem merge;
   - merge-tree com conflito (montar commit que conflita com `main`) → recusa com `conflito: true` e a lista de arquivos de `CONFLICT`, sem merge;
   - painel: item `F1` com `prs:[N]`, etapa `merge`, dono e duas sessões no `com` → depois: `etapa:"feito"`, dono null, `com` vazio, `fez` intacto, `agora` com o sha curto; item de outro projeto com o mesmo número de PR não muda;
   - item com `prs:[N, M]` e M ainda OPEN → fica em `merge`, `com` vazio, `agora` "um PR entrou; falta outro";
   - `--seco` → faz toda a conferência, imprime o que faria, não chama `gh pr merge` nem grava o painel;
   - nenhum item com o PR → mergeia e diz `itens: []` (não é erro).
2. **Implementar `mergear.mjs`** até o verde. Sequência: validar args → `gh pr view <N> --json number,state,headRefOid,baseRefName,headRefName` → conferir OPEN e prefixo → `git fetch origin <base> refs/pull/<N>/head` → `git merge-tree --write-tree origin/<base> <sha40>` (status 0 segue; 1 com `CONFLICT` recusa listando os arquivos; outro: erro com a saída) → `gh pr merge <N> --squash --match-head-commit <sha40>` → dentro de `comTrava`, para cada item vivo do projeto (`projetoDoCwd`) com o PR em `prs`: decidir fechar (D3, `gh pr view <M> --json state` dos outros) e gravar. Saída JSON `{mergeado, pr, sha, base, itens:[{item, fechado, agora}]}`; recusa = `{recusado:true, motivo, …}` e exit 1 (ajustar o `return` de `main` como já é para `pegar`). Linha de uso no cabeçalho de `painel.mjs` e na mensagem de `default`.
3. **`com del` pelo apelido** (D5): teste em `painel-fila.test.mjs` (apelido acha; apelido ausente erra; apelido repetido erra; `--fez` funciona pelo apelido) e depois o código em `comandoCom`.
4. **T9 do recado da V** (D4): testes em `hooks/tests/papel-do-pool.test.mjs` (V com "aprovado" sem sha → deny; V com `PR 12 validado, HEAD 320d113` → passa; V com "reprovado" → passa; E com "validado" → passa; `send_message` do MCP igual ao SendMessage). Código no `papel-do-pool.mjs` + comentário de cabeçalho; matcher em `hooks/hooks.json` acrescenta `SendMessage|mcp__ccd_session_mgmt__send_message`. Estender o T6 para também reconhecer `painel mergear` (e `painel.mjs mergear`) de quem não é a orquestradora (→ `ask`, mesmo motivo).
5. **Docs:** `skills/orquestradora/SKILL.md:75` troca a receita manual por `painel mergear <n> <Y>` (mantendo o que cada status quer dizer); `pool/papeis/orquestradora.md` idem na linha do merge; `pool/papeis/validadora.md:20` diz que a T9 recusa o recado sem sha; `pool/protocolo.md` (linha "PR validado vai à orquestradora") cita o `painel mergear`. Copiar este plano para `docs/planos/2026-10-26-mergear-o-pr-validado.md`.
6. Gate `npm test` verde; `claude plugin validate plugins/orquestracao --strict`. Subir a versão do plugin `orquestracao` (patch) no manifesto, como os PRs anteriores fizeram. PR para `main`.

## Critério de pronto (medível)
- `npm test` verde com os casos novos dos passos 1, 3 e 4, cada um visto vermelho antes do código (colar no relatório a saída vermelha e a verde).
- `painel mergear 999 abc1234 --seco` num repo sem o PR sai com erro legível, exit ≠ 0 (colar).
- `grep -n "mergear" plugins/orquestracao/skills/orquestradora/SKILL.md plugins/orquestracao/pool/papeis/orquestradora.md` mostra a receita nova.

## Fora de escopo
- F153 (dona de item em validação), F151 (atualizar plugins), F152 (pode reiniciar): itens próprios.
- Apagar a branch do PR depois do merge, rodar o gate do lote, release.
- Mudar o formato do recado para outros papéis.
