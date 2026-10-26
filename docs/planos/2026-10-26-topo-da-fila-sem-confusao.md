# F82 · a frase e o "Abrindo…" do topo da Na fila não confundem o operador — plano

Planejadora: P5 (sessão "P5 · a frase e o Abrindo do topo da fila"). Origem: ressalvas P1–P4 da crítica de UI 26/30 do PR #37 (F76), laudo `~/.claude/orquestracao/pool/handoffs/arquivo/F76-laudo-V.md`.

**Base:** `origin/main` em `03dfc6a` ou depois. Linhas citadas são as de `03dfc6a` em `plugins/painel-sessoes/hooks/register.tsx`.

## O que muda (4 pontos)

| # | Peso | Defeito medido | Conserto decidido |
|---|---|---|---|
| A | média (P1) | a frase do topo `N cartão espera / cartões esperam você na conversa da orquestradora de X` (`register.tsx:1557`) conta só a Na fila, mas a conversa da orquestradora tem também os cartões pedidos de Executando: o operador abre a conversa e vê mais cartões do que a frase disse | a frase diz de onde conta: `1 cartão da fila espera você na conversa da orquestradora de X` / `N cartões da fila esperam você…` (texto recomendado pela crítica; *assumida, a confirmar*) |
| B | média (P2) | o átomo `abrindo` (`register.tsx:51`) guarda só o id da sessão; todo botão que abre a mesma sessão vira "Abrindo…" junto (`register.tsx:1457` e `1499`): clicar "Abrir a orquestradora" no topo acende também o do cartão do mesmo projeto, e vice-versa; o mesmo vale para "Abrir P2" em dois cartões do mesmo dono | o átomo guarda `{ localId, botao }`: o rótulo "Abrindo…" acende só no botão pressionado (`botao`); o clique repetido continua ignorado em **qualquer** botão da mesma sessão enquanto ela abre (`localId`) |
| C | baixa (P3) | na Na fila, cada item em "Pedido" aparece duas vezes em âmbar: a frase do topo e a linha `Pedido às hh:mm · inicie o cartão` (`register.tsx:1526`, `cor: 'warning'`) | na Na fila a linha `Pedido às … · inicie o cartão` sai em `dimColor` (o topo já carrega o chamado em âmbar com o botão); no cartão de Executando continua `warning` (lá não há topo); `No prompt às … · aperte Enter` continua `warning` nos dois (*assumida, a confirmar*) |
| D | baixa (P4) | `Sem orquestradora ativa em loja-velha · 1 item` quebra deixando `1 item` sozinho na linha (`register.tsx:1490`) | o trecho ` · N item(ns)` fica inquebrável: espaços trocados por U+00A0 (`\u00a0·\u00a0${n}\u00a0${item}`). Se o pane real não respeitar o U+00A0 (ver passo 6), pare e avise a P5 antes de inventar outro conserto |

## Arquivos

- `plugins/painel-sessoes/hooks/register.tsx` — átomo `abrindo` (51), `abrirSessao` (544–562), `abrir` e `botoesAbrir` (1447–1466), `textoDoAviso` (1484–1490), `botaoOrquestradora` (1491–1501), `acaoDoPedido` (linha do "Pedido às", 1522–1527), `topoDaFila` (frase, 1555–1559).
- `plugins/painel-sessoes/tests/painel.test.tsx` — testes novos (abaixo) e ajuste dos que afirmam os textos antigos (2424, 2557, 2609, 2630, 2632, 2659, 2661).
- `plugins/painel-sessoes/.claude-plugin/plugin.json` — versão `0.6.10` (versão livre reservada pela orquestradora; a `main` está em 0.6.8).
- `docs/planos/2026-10-26-topo-da-fila-sem-confusao.md` — cópia deste plano (primeiro commit).

## Passos

1. Branch nova a partir da `origin/main` (`03dfc6a` ou depois). Copie este plano para `docs/planos/2026-10-26-topo-da-fila-sem-confusao.md` e commite (`docs(planos): …`).
2. **Testes vermelhos primeiro** (`claude plugin test plugins/painel-sessoes`), prefixo `F82`, montados como os `F76` (helpers `pedir`, `abrirDe`, `FILA_DOIS`, `ORQ_IZ`, `vivasPedir`):
   - **F82 A:** um item da Na fila em "Pedido" de izanagi **e** um cartão em Executando em "Pedido" do mesmo projeto (como no `F76 A`). Afirme que existe um `Text` com o texto exato `1 cartão da fila espera você na conversa da orquestradora de izanagi` e nenhum com `1 cartão espera você`. Com dois itens da fila em "Pedido": `2 cartões da fila esperam você na conversa da orquestradora de izanagi`. (Vermelho: o texto atual não tem "da fila".)
   - **F82 B:** com o pane em outra sessão, um item da fila e um cartão em Executando de izanagi, os dois em "Pedido" (botões `orq:izanagi` e `orq:<id do cartão>` presentes — afirme a presença antes). Segure o `open_session_in` (como o `F34-3`, opção `segurar`), pressione `orq:izanagi`, `relogio.settle()`: `orq:izanagi` diz `Abrindo…` **e** `orq:<id do cartão>` diz `Abrir a orquestradora`. Pressione `orq:<id do cartão>` ainda segurando: nenhuma segunda chamada de `open_session_in` (`abertas.length === 1`). Solte: os dois voltam a `Abrir a orquestradora`. Segunda parte, mesmo teste ou `F82 B2`: um dono (P7) de dois cartões; pressionar o `Abrir P7` de um cartão deixa o do outro cartão com `Abrir P7` — se os dois botões tiverem a mesma `key` (`abrir:${localId}`), ache-os pela árvore (`findAll` + ancestral do cartão), não mude a `key` (os testes `abrir:` e `F34-3` usam ela). Se não houver fixture com o mesmo dono em dois cartões, monte uma; se isso não couber, faça só a parte da orquestradora e diga no relatório.
   - **F82 C:** um item da Na fila em "Pedido": o `Text` `Pedido às hh:mm · inicie o cartão` tem `dimColor === true` e `color` diferente de `'warning'`; o do cartão em Executando (`… inicie o cartão na conversa da orquestradora`) tem `color === 'warning'` (presença antes); `No prompt às … · aperte Enter` continua `warning`. Rode nas duas superfícies (desktop e terminal), como o `F76 C/E`.
   - **F82 D:** o texto do aviso (`F69 A (v)`, kit sem orquestradora) é exatamente `Sem orquestradora ativa em kit\u00a0·\u00a01\u00a0item` e, com 2 itens, `…\u00a0·\u00a02\u00a0itens`; afirme também que o texto **não** contém ` · ` com espaço comum. Ajuste o regex do `F69 A (v)` (`painel.test.tsx:2424`) para aceitar o U+00A0.
   Rode e cole a saída vermelha (cada um falha pelo motivo do ponto, não por erro de compilação).
3. **A:** em `topoDaFila`, a frase vira `` `${o.n} ${o.n === 1 ? 'cartão da fila espera' : 'cartões da fila esperam'} você na conversa da orquestradora de ${projeto}` ``. Ajuste os testes `F69`/`F76` que afirmam o texto antigo (2557, 2609, 2630, 2632, 2659, 2661) **trocando só o texto esperado**, sem afrouxar o que eles medem.
4. **B:**
   - átomo: `atom({ plugin: 'painel-sessoes', key: 'abrindo' }, null as { localId: string; botao: string } | null)`; ao ler, valor de versão anterior (string) vale `null`: `const abrindoAgora = normalizar(await read($, abrindo))` com `typeof v === 'object' ? v : null`.
   - `abrirSessao($, dono, surface, botao: string)`: grava `{ localId: dono.localId, botao }`; no `finally` limpa só se `atual?.botao === botao`.
   - rótulo: `abrindoAgora?.botao === <chave do botão> ? 'Abrindo…' : …`; guarda do clique: `if (abrindoAgora?.localId !== <id>)`.
   - chave do botão (valor do átomo, não a `key` do React): orquestradora = a própria `key` (`orq:${projeto}` ou `orq:${i.id}`); "Abrir <apelido>" = `` `abrir:${i.id}:${localId}` `` (o `abrir` passa a receber o id do item; `botoesAbrir(i)` já o tem).
   - O `F34-3` tem que seguir verde sem mudança.
5. **C:** em `acaoDoPedido`, a linha do estado `pedido` com `naFila` sai com `cor: undefined` (os três lugares que desenham a linha, 1775/1796/1956, já fazem `dimColor={a.linha.cor === undefined}`); o ramo do cartão continua `'warning'`. O tipo do campo `cor` já admite `undefined`.
6. **D:** em `textoDoAviso`, o sufixo vira `` `\u00a0·\u00a0${n}\u00a0${n === 1 ? 'item' : 'itens'}` ``. **Conferir no pane real** (o teste não mede quebra de linha): abra o pane no desktop com a largura mínima e um projeto sem orquestradora ativa (pode ser forjando no diretório de teste ou lendo o `ui.render` com `bodyColumns` pequeno, se houver jeito), e tire a captura. Se o U+00A0 aparecer como espaço que quebra ou como glifo estranho, **pare e avise a P5** com a captura.
7. Versão do `painel-sessoes` para `0.6.10`. Testes do pacote verdes; `claude plugin validate plugins/painel-sessoes --strict`; gate completo (`npm test`) uma vez antes do push.
8. Push, PR para `main` (título `fix(painel): a frase e o Abrindo do topo da fila não confundem`, corpo em PT-BR com os 4 pontos, a saída vermelha e a verde, e a captura do passo 6), `painel com del F82 <seu local_> --fez`. **Não mergeie** (há orquestradora).

## Critério de pronto (medível)

- `claude plugin test plugins/painel-sessoes; echo "exit=$?"` → `exit=0`, com `F82 A`, `F82 B`, `F82 C`, `F82 D` presentes e passando; saída deles **vermelha antes** do conserto colada no relatório; `F34-3` e todos os `F69`/`F76` verdes.
- `npm test; echo "exit=$?"` → `exit=0`.
- `claude plugin validate plugins/painel-sessoes --strict` → `✔ Validation passed`.
- `grep -n "abrindoAgora === " plugins/painel-sessoes/hooks/register.tsx` → nenhuma linha (o rótulo não compara mais só o id).
- `grep -c "cartões esperam você\|cartão espera você" plugins/painel-sessoes/hooks/register.tsx` → `0`.
- Captura do aviso do passo 6 no relatório.

## Fora do escopo

- Mudar a cor da frase do topo (segue `warning`) ou o desenho do topo (adendo do F76 fica como está).
- Contar na frase os cartões de Executando (decidido: a frase diz "da fila"; ver Alternativas).
- Outros textos do pane, a barra (`barra.tsx`), o protocolo, a skill `orquestradora`.
- O teste que falta do lote (V1 do laudo F76) — não é deste item.

## Alternativas consideradas (registro da P5)

- **A — contar todos os cartões da conversa (fila + Executando):** a frase ficaria fiel à conversa, mas o topo mora na seção Na fila e o F76 decidiu contar só ela (o cartão em Executando tem o próprio botão); juntar os dois faria a frase da Na fila falar de itens que o operador não vê ali. Recusada.
- **B — chavear o "Abrindo…" pela `key` do React em vez de criar a chave do átomo:** as `key` `abrir:${localId}` se repetem entre cartões do mesmo dono e os testes dependem delas; mudar a `key` quebraria `abrir:*` e `F34-3`. Recusada.
- **C — esconder a linha "Pedido às" na Na fila:** perderia a hora do pedido, que só a linha mostra. Recusada a favor do `dimColor`.
- **D — reordenar o aviso (`1 item sem orquestradora ativa em kit`):** resolve sem depender do U+00A0, mas descasa do formato dos outros avisos (`N orquestradoras ativas em X · …`). Fica como plano B se o passo 6 reprovar o U+00A0.

## Regras do projeto que tocam

- `CLAUDE.md` da raiz: Node ≥ 20, ESM, sem dependência npm; testes do mod são `.tsx` e rodam com `claude plugin test plugins/painel-sessoes` (o `npm test` não os pega); commits conventional em PT-BR; teste antes do código; teste que mede ausência prova antes a presença; texto de UI não cita spec, ADR nem doc.
- `vercel-react-best-practices`: o estado novo do átomo é derivado no render, sem efeito; nada de `useEffect` para limpar o "Abrindo…" (o `finally` de `abrirSessao` já faz).
- `processos:auditoria-de-clique`: o gesto "Abrir a orquestradora"/"Abrir <apelido>" muda — audite o clique até o estado final (átomo → rótulo → `finally`), inclusive dois cliques em botões diferentes da mesma sessão.
- Com orquestradora ativa: abra PR, **não mergeie**.

## Sem designer

As quatro correções vêm prontas da crítica (texto, cor e quebra já especificados); nenhuma muda o desenho do topo. Por isso não passa pela D1 (*assumida, a confirmar*). O crítico de UI julga a tela depois da execução.
