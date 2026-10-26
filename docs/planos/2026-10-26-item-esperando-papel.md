# Item esperando executora, validadora ou design não fica parado em silêncio (F58)

Planejadora: P5 · 2026-10-26. Branch: `claude/f58-esperando-papel` (a partir de `origin/main` f507414).

## O caso
O F52 (barra de status) entrou em `execucao` às 05:04 e ficou ~35 min sem nenhuma E no `com`. A dona era a P3 (planejadora). O ritual da orquestradora só despacha item **sem dono** e só cobra dono ocioso depois de 1 h (`list fila vencidos`, 30 min, e ainda exige cruzamento à mão); a P3 terminou o turno e ninguém despachou.

## Medição (antes do código)
Script: `~/.claude/orquestracao/pool/handoffs/F58-medir.mjs` (saída em `F58-medicao.out`) (lê todo `painel com add F<n> … <apelido>` dos transcripts em `~/.claude/projects` e cruza com o `historico` de cada item da fila). Só conta passagens depois do primeiro `com add` registrado (2026-10-25T20:39Z), quando o `com` passou a existir.

```
trechos medidos: 96  (entradas em design, execucao ou validacao)
> 10 min: 7   > 20 min: 6   > 30 min: 5   > 60 min: 2
F46 izanagi validacao  194 min (nenhuma V até sair da etapa)
F54 kit     validacao  178 min → V1
F46 izanagi execucao    39 min (nenhuma E)
F52 kit     execucao    35 min → E5
F45 kit     validacao   31 min (nenhuma V)
F30 izanagi validacao   22 min (nenhuma V)
F34 izanagi design      19 min (nenhuma D)
```
Limite: V que trabalhou sem `com add` aparece como "nenhuma"; o número é teto, não piso. Mesmo assim, 5 passagens em ~9 h passaram de 30 min.

## Decisões
- **D1 — a regra "esperando X" (uma função, três consumidores).** Item está *esperando o papel X* quando:
  - `etapa` ∈ `design` (X = D) · `execucao` (X = E) · `validacao` (X = V);
  - nenhum `com[].apelido` e nem `donoApelido` começa com a letra X;
  - em `validacao`, uma **E** no `com` também conta como ocupado (é o conserto; a V volta depois) — *assumida, a confirmar*;
  - sem `espera` e sem `trava` (parado de propósito ou já travado);
  - `desde` = o maior entre: o `em` da entrada do `historico` em que a etapa passou a ser a atual (primeira entrada da sequência final com essa etapa) e o último `fez[].em` de quem é do papel X; sem `historico`, `atualizadoEm`;
  - `minutos` = `floor((agora − desde) / 60000)`.
- **D2 — onde mora:** `plugins/orquestracao/hooks/esperando-papel.mjs` (puro, sem I/O). `painel.mjs` e os hooks importam; o pane (outro plugin, TSX) tem a cópia em `plugins/painel-sessoes/hooks/esperando.ts`, **sem import**, e um teste `node:test` compara as duas sobre a mesma tabela (Node ≥ 22.6 tira os tipos sozinho; sem `process.features.typescript` o teste é `skip`, com o motivo).
- **D3 — (b) ritual:** a cobrança vale a partir de **5 min** de espera (`ESPERA_MIN`, padrão 5), para não cobrar o item que a planejadora acabou de passar e está despachando no mesmo gesto. Só itens do projeto da orquestradora (o `cwd` do hook → `projetoDaSessao`).
- **D4 — (c) planejadora: na hora do Stop, não por relógio.** Sessão parada não roda hook; o único momento em que dá para cobrar a dona é o fim do turno dela. Então: a dona de item *esperando X* (qualquer minuto) não termina o turno sem ter, **depois do `desde`**, rodado `painel com add <F>` ou mandado mensagem (`SendMessage` / `send_message`) que cite o `F<n>`. Uma mensagem por espera: a próxima volta só se o `desde` andar. O lado do relógio fica com o ritual (D3), que a mensagem da planejadora acorda. *Assumida, a confirmar* — o pedido falava em "N min", e N min não tem quem meça numa sessão ociosa.
- **D5 — tela:** sem revisão da D (mudança de um chip num cartão que já existe, reversível): chip `esperando E · 35 min` no estilo do chip do gate (`texto: 's'`, `traco: 'ms'`), no cartão (`cartaoSvg`), na linha (`itemSvg`) e no texto do terminal. Item **sem dono** já leva "sem ninguém"/"espera execução": ganha só os minutos no mesmo chip. *Assumida, a confirmar*; se a crítica de UI pedir outro tom, vira item próprio.

## Plano para a executora
Regras do repo: Node ≥ 20, ESM, sem dependência; testes em `node:test`; `process.exitCode`; teste nunca toca `~/.claude` real (HOME e envs em pasta temporária); processo filho síncrono com `timeout` e `killSignal: 'SIGKILL'`; commit conventional em PT-BR. **Teste antes do código** em cada passo (o teste falha pelo motivo certo, depois passa).

1. **Função pura.** Teste `plugins/orquestracao/hooks/tests/esperando-papel.test.mjs` com uma tabela (exporte-a de `tests/esperando-papel.casos.mjs` para o passo 6 reusar): execucao sem E → `{papel:'E', desde, minutos}`; com E no `com` → `null`; dono E → `null`; validacao com E no `com` → `null`; validacao só com P no `com` → V; com `espera` → `null`; com `trava` → `null`; `planejamento`, `merge`, `feito` → `null`; item sem `etapa` → `null`; `desde` = entrada na etapa (historico com etapa repetida e dono trocando no meio: vale a primeira da sequência final); `desde` = `fez[].em` do papel quando mais novo; `fez` de outro papel não move o `desde`; sem historico → `atualizadoEm`. Depois `hooks/esperando-papel.mjs`: `export function esperandoPapel(data, agoraMs)` e `export const PAPEL_DA_ETAPA`.
2. **`painel list fila`.** Teste em `tests/painel-fila.test.mjs`: todo documento da `list fila` sai com `esperando` calculado **fora** de `data` (`{id, version, data, esperando}`; `null` quando não espera) e nada disso é gravado no arquivo; `painel list fila esperando` filtra só os que esperam; `esperando` aceito na lista de filtros válidos. Atualize o cabeçalho de uso do `painel.mjs`.
3. **Ritual (b).** Novo `tests/orquestradora-ritual.test.mjs` (HOME temporário com `ativas/<sid>`; repo git temporário como `cwd`; registro do app em `POOL_APP_SESSOES_DIR`; fila em `PAINEL_DIR/fila`). Casos: (i) item esperando E há 10 min + `E1 · livre` do mesmo projeto, turno com `list_sessions` e `painel batch` → **bloqueia** citando `F<n>`, `esperando E há 10 min` e `E1`; (ii) o mesmo turno com `painel com add F<n> … E1` → passa; (iii) sem E livre, ausente desligado, sem `start_session` no turno → bloqueia pedindo a vaga; (iv) idem com `start_session` no turno → passa; (v) sem E livre e modo ausente ligado → não bloqueia por isso; (vi) espera de 2 min → não bloqueia; (vii) item de outro projeto → não bloqueia; (viii) membro `E1 · livre` arquivado ou de outro projeto não conta como livre; (ix) o bloqueio antigo do ritual (sem `list_sessions`) continua igual e as duas faltas saem na mesma razão; (x) `stop_hook_active` → passa. Código: `pool-comum.mjs` ganha `export function membrosLivres(repo)` (varre o registro do app uma vez: não arquivados, título `^[PDEV]\d+ · livre$`, `projetoDaSessao(reg).repo === repo` → `[{apelido, papel, localId}]`), só chamada quando há item esperando. `orquestradora-ritual.mjs` lê a fila, filtra pelo projeto do `cwd`, aplica `esperandoPapel` com `ESPERA_MIN`, e acrescenta à razão do bloqueio: `F52 esperando E há 35 min — livres: E1, E2: despache (título + painel com add + mensagem)` ou `— sem E livre: peça a vaga (start_session; fora do turno do operador, cartão)`. Use `modoAusente()` de `hooks-crewai-comum.mjs`.
4. **Planejadora (c).** Em `tests/fila-do-item.test.mjs`: dona de item esperando E (com P no `com`), turno que gravou o item mas não despachou → **bloqueia** dizendo `F<n> está em execução sem nenhuma E no item` e as duas saídas; com `SendMessage` (ou `mcp__ccd_session_mgmt__send_message`) citando o `F<n>` depois do `desde` → passa; mensagem citando antes do `desde` → bloqueia; com `painel com add F<n>` no turno → passa; `stop_hook_active` → passa; dona que se declarou livre (`vaiSoltar`) → passa como hoje. Código em `fila-do-item.mjs`: depois da conferência atual (se ela bloqueia, as duas faltas saem na mesma razão), para os itens da dona que esperam, procure no transcript **inteiro** (não só no turno) `tool_use` posterior ao `desde`.
5. **Pane.** `plugins/painel-sessoes/hooks/esperando.ts` (cópia da função, sem import); `register.tsx` guarda `esperando` na `LinhaItem` (tipo em `types/index.d.ts`); `desenho.ts` desenha o chip `esperando <X> · <N> min` (D5) em `cartaoSvg` e `itemSvg`, e a linha do terminal (`register.tsx` ~1241) leva o mesmo texto. Testes em `tests/painel.test.tsx`: cartão de item andando sem E mostra o chip e o `alt` o leva; item com E no `com` não mostra.
6. **Concordância.** `plugins/orquestracao/hooks/tests/esperando-concorda.test.mjs`: importa a função `.mjs` e a `.ts` e afirma o mesmo resultado em todos os casos de `esperando-papel.casos.mjs` (afirme antes que a tabela não está vazia).
7. **Docs.** `pool/protocolo.md` (fila do pool: um parágrafo com âncora `<a id="esperando-papel"></a>` — a regra, onde aparece e as duas travas); `skills/orquestradora/SKILL.md` passo 3 do ritual (a trava nova); `pool/papeis/planejadora.md` "Para quem passa" (plano pronto → despacho no mesmo turno, ou linha à orquestradora; a trava cobra). Um teste de doc × código: o texto do protocolo cita `ESPERA_MIN` com o mesmo padrão do código.
8. **Gate:** `npm test` e `claude plugin test plugins/painel-sessoes`, verdes; `claude plugin validate .`. Suba a versão do plugin `orquestracao` e `painel-sessoes` como os PRs anteriores fizeram (veja `git log -p -- plugins/*/.claude-plugin/plugin.json`).
9. Commit(s), `git push -u origin claude/f58-esperando-papel`, PR para `main` com a medição no corpo. Não mergeie.

## Critério de pronto
- `npm test` verde, com os casos novos dos passos 1–4 e 6 (saída colada no PR).
- `claude plugin test plugins/painel-sessoes` verde com os casos do passo 5.
- Rodando contra a fila real, só leitura: `PAINEL_DIR=~/.claude/orquestracao/painel node plugins/orquestracao/skills/orquestradora/scripts/painel.mjs list fila esperando --todos` lista o que estiver esperando no momento (colar a saída; vazia é resultado válido se for o caso, dito assim).

## Fora de escopo
- Despachar sozinho (o hook só cobra; quem despacha é a orquestradora ou a dona).
- Mudar `list fila vencidos`, `soltar` ou o prazo de 30 min.
- Gravar `em` no `com` (o `desde` sai do `historico` e do `fez`).
- Redesenho do pane além do chip.
