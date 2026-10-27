# F144 + F147 — "Sessões para abrir" no painel e o botão de limpar fixo na barra

Dois itens, uma revisão de design (mesma barra, mesmo pane) e **um PR de execução por item**, um depois do outro (os dois
mexem em `plugins/painel-sessoes/hooks/register.tsx`). Ordem: F147, depois F144 (o F147 tira o pedido de limpeza do topo
do pane, e o F144 põe a seção nova no lugar que sobra).

Decisões do operador: Q419 (F144, 27/10) e o pedido no chat da orquestradora (F147, 27/10). Tudo o que está abaixo como
*assumida, a confirmar* é reversível e barato.

<a id="medido"></a>
## O que foi medido (27/10, `origin/main` e6565a0)

- **Barra** (`plugins/painel-sessoes/hooks/barra.tsx`): `pecasDaBarra` monta a direita como pedido/limpar → selo das
  perguntas → modo → painel. O botão de limpar só existe com a pergunta `limpar · orquestradora` aberta
  (`limpar-pedido`) ou, sem ela, como `Limpar antes de vencer` (`limpar-antes`, só a orquestradora, cache ≤ 10 min e
  contexto ≥ 150 mil), que só põe um rascunho no prompt. Rótulos em texto puro; `Button` com `variant`
  `primary`/`secondary` e `dimColor`. Nenhum ícone próprio por botão (o `☾` só no "Estou de volta").
- **Trava T7** (`plugins/orquestracao/hooks/papel-do-pool.mjs`, ramo `clear_session`): a orquestradora só se limpa com
  modo ausente, turno de origem `human`, "sim" do painel na pergunta `limpar · orquestradora` (≤ 30 min,
  `respondidaPor: "painel"`) ou "sim" da janela (AskUserQuestion, ≤ 30 min).
- **Cobrança** (`plugins/orquestracao/hooks/contexto-do-papel.mjs`): a partir de 150 mil, com o operador presente, o Stop
  bloqueia até a orquestradora abrir a pergunta `limpar · orquestradora`, e também a janela quando o turno termina
  esperando o operador.
- **O mod já tem os dois caminhos de envio:** `$.prompt.submit` (manda um prompt à própria sessão; usado pelo modo
  ausente e pela batida) e `$.prompt.fill` (só põe texto na caixa; usado quando o envio precisa ser um turno do operador,
  porque o app só aceita `start_session` nele).
- **Cartão de sessão hoje:** a orquestradora propõe `start_session` `own_initiative` com título `<ID> · livre`, uma por
  vaga (skill `orquestradora`, âncora `vaga-pelo-painel`); a skill manda abrir pergunta com Q-ID para o clique
  ("Cartão para o operador clicar é pergunta", seção do `aguarda-voce`). O pane só guarda o "Pedido às HH:MM · inicie o
  cartão" na memória da tela (átomo `pedindo`), que some ao fechar o pane e não diz qual cartão espera.
- **Coleções do `painel.mjs`:** `COLECOES = sessoes, perguntas, fila`; qualquer outra é recusada.

<a id="f147"></a>
## F147 — o botão de limpar fixo na barra, sem pergunta

### Decisões
- **D1 · O botão aparece sempre na barra da própria orquestradora** (título `🎛 orquestradora`), à esquerda do botão do
  modo, inclusive com o modo ausente ligado. Em outra sessão não aparece. *Assumida, a confirmar* (o pedido diz "fixo").
- **D2 · O destaque segue a régua da orquestradora:** abaixo de 150 mil, discreto; a partir de 150 mil (a palavra
  `· limpar` da barra), em destaque. O `Limpar antes de vencer` some: o mesmo botão, destacado quando o cache vence em
  ≤ 10 min com ≥ 150 mil, cobre o caso. *Assumida, a confirmar.*
- **D3 · O clique limpa sem pergunta e sem janela.** Ele: (a) grava `~/.claude/orquestracao/limpeza/<local_…>.json`
  `{ "em": "<ISO>", "por": "barra" }` (pasta por `PAINEL_DIR/../limpeza`, como os handoffs); (b) manda à própria sessão,
  por `$.prompt.submit`, o texto `O operador mandou limpar pelo botão da barra: grave o estado (handoff do que estiver
  aberto) e limpe-se com clear_session "self".` Estado visível no botão: `Limpando…` até o envio voltar; falha volta o
  rótulo e vira toast.
- **D4 · A T7 aceita o arquivo do botão** com `em` de até 30 min e nunca no futuro (mesma janela dos outros oks).
  **Antes de escrever o ramo, meça:** com o mod mandando um prompt por `$.prompt.submit`, qual é a origem que o
  `origemDoTurno` lê no transcript. Se for `human`, a T7 já passa e o arquivo é só registro (o ramo novo entra igual:
  custa pouco e não depende do app). Risco aceito: a orquestradora pode gravar o arquivo pelo Bash, o mesmo risco já
  aceito no F48 (D6, sessões cooperativas).
- **D5 · Sai o pedido:** a orquestradora não abre mais a pergunta `limpar · orquestradora` nem a janela. Sai do mod o
  pedido na barra (`pedido`, `limpar-pedido`, `FRASE_*`, `OK_ENVIADO`) e o `desenharPedidoNoPane`. A T7 **continua**
  aceitando o "sim" do painel e da janela (pergunta antiga ainda aberta não quebra; remover fica para depois).
- **D6 · A cobrança dos 150 mil vira lembrete, não bloqueio:** `contexto-do-papel.mjs`, orquestradora presente, ≥ 150 mil:
  em vez do `block`, uma linha de contexto (`additionalContext`) dizendo que o botão de limpar da barra está destacado e
  que o estado deve estar escrito; nenhuma pergunta, nenhuma janela. *Assumida, a confirmar.*
- **D7 · Ícone e cor de cada botão da barra:** limpar, modo (ausente/de volta), painel e selo das perguntas. Exemplo do
  operador: ausente em azul. **A D decide** os glifos e as cores na revisão, com contraste nos dois temas e o que o
  `Button` do motor aceita (medir: cor no `Button` ou num `Text` filho).

### Arquivos
| Arquivo | O quê |
|---|---|
| `plugins/painel-sessoes/hooks/barra.tsx` | peça `limpar` sempre na orquestradora (antes de `modo`), destaque por D2; sai o pedido (D5); ícones e cores da revisão; `larguraDaFaixa` conta o glifo |
| `plugins/painel-sessoes/hooks/register.tsx` | ação `limpar` (D3) com estado `Limpando…`; sai `darOkDeLimpar`, `rascunhoDeLimpar` e o pedido do topo do pane; a leitura da barra deixa de procurar a pergunta |
| `plugins/orquestracao/hooks/papel-do-pool.mjs` | ramo da T7 que aceita `limpeza/<local_…>.json` (D4) |
| `plugins/orquestracao/hooks/pool-comum.mjs` | `okDoBotaoDeLimpar(localId)`: lê o arquivo, valida `em` (≤ 30 min, não futuro); erro = `null` |
| `plugins/orquestracao/hooks/contexto-do-papel.mjs` | D6 |
| `plugins/orquestracao/skills/orquestradora/SKILL.md` | seção "Orçamento de contexto": sem pergunta e sem janela; o botão da barra; o que fazer ao receber o prompt do botão |
| `plugins/orquestracao/pool/protocolo.md` | onde fala do ok de limpar a orquestradora: o botão da barra |

### Passos (teste antes do código)
1. Meça a origem do prompt de `$.prompt.submit` (D4) e anote no PR, com a linha do transcript colada.
2. Testes vermelhos: `barra.test.tsx` (peça `limpar` na orquestradora em toda faixa, antes de `modo`; ausente em outra
   sessão; destaque a partir de 150 mil; nenhum `pedido` nem `limpar-antes`); `papel-do-pool.test.mjs` (arquivo de 5 min
   libera; de 31 min nega; `em` no futuro nega; arquivo de outra sessão nega); `contexto-do-papel.test.mjs` (≥ 150 mil
   presente não bloqueia e devolve o lembrete).
3. Código até verde; `npm test` e `claude plugin test plugins/painel-sessoes`.
4. Skill e versão dos dois plugins.
5. Audite o gesto (skill `auditoria-de-clique`): clique → arquivo → prompt → `clear_session` → T7 libera.

### Critério de pronto
- Na barra da orquestradora, o botão de limpar aparece em toda faixa, à esquerda do modo; em outra sessão, não.
- Um clique leva a orquestradora a se limpar sem nenhuma pergunta nem janela (conferido numa sessão de verdade ou, sem
  ela, pelo teste ponta a ponta da T7 com o arquivo real).
- O `contexto-do-papel` não bloqueia mais o turno da orquestradora presente por contexto.
- Gate verde e os testes do mod verdes.

<a id="f144"></a>
## F144 — "Sessões para abrir": o cartão de sessão sai das perguntas

### Decisões
- **D8 · Coleção nova `cartoes`** no `painel.mjs` (entra em `COLECOES`). Documento por cartão, id = o `task_id` que o
  `start_session` devolve: `{ projeto, apelido, papel, itens: ["F<n>"…], orquestradoraId, propostoEm }`.
  `apelido` é o `<ID>` do título `<ID> · livre`; `itens` são os itens que esperam aquele papel quando o cartão sai
  (pode ser vazio: o piso de E). O `painel` valida: `apelido` `^[PDEV]\d+$`, `papel` igual à letra do apelido, `itens`
  com `F<n>`.
- **D9 · Quem grava e quem tira:** a orquestradora grava logo depois do `start_session` `own_initiative`
  (`painel set cartoes <task_id> '{…}'`) e apaga quando retira o cartão (`dismiss_task`). A **batida** (`painel batida`,
  que já lê o `list_sessions`) apaga o cartão cujo apelido aparece vivo no projeto (título começando com `<apelido> · `,
  criado depois de `propostoEm`) e o que passou de 12 h (o mesmo prazo da Q379). O pane esconde na hora a linha cujo
  apelido já aparece na lista que ele leu, sem esperar a batida.
- **D10 · A seção "Sessões para abrir"** fica logo abaixo de "Esperam você" e só existe quando há cartão. Uma linha por
  cartão: apelido e papel por extenso, para quê (os itens, pelo título, ou "manter uma executora livre" sem item), de qual
  orquestradora e há quanto tempo; botão "Abrir a orquestradora" (o cartão está na conversa dela). Ela conta no resumo
  do topo? **A D decide.**
- **D11 · Cartão não é mais pergunta:** sai da skill a frase "Cartão para o operador clicar é pergunta" e o `Q · clicar
  no cartão`; a orquestradora com cartão pendente fica `parada` (a trava do `aguarda-voce` não muda). O "Pedido às HH:MM
  · inicie o cartão" do item na Na fila continua (diz que o pedido saiu); a linha da seção nova é que diz qual cartão
  clicar.

### Arquivos
| Arquivo | O quê |
|---|---|
| `plugins/orquestracao/skills/orquestradora/scripts/painel.mjs` | `cartoes` em `COLECOES`, validação de D8; `batida` apaga por D9 |
| `plugins/orquestracao/skills/orquestradora/scripts/batida.mjs` | função pura `cartoesResolvidos({ cartoes, linhas, agoraMs })` → ids a apagar |
| `plugins/painel-sessoes/hooks/register.tsx` | lê `cartoes`; seção D10 no lugar da revisão; esconde o já aberto |
| `plugins/painel-sessoes/hooks/desenho.ts` | o desenho da linha, se a revisão pedir SVG como os cartões de item |
| `plugins/orquestracao/skills/orquestradora/SKILL.md` | D11; âncora `vaga-pelo-painel` grava e apaga o documento |
| `plugins/orquestracao/pool/protocolo.md` (cópia do plugin) | "O que o painel mostra" ganha a seção |

### Passos (teste antes do código)
1. Testes vermelhos: `painel` aceita `cartoes` válido e recusa apelido/papel/itens inválidos; `cartoesResolvidos` (apelido
   vivo depois de `propostoEm` → apaga; vivo de antes → fica; 12 h → apaga; sem lista → nada); `painel.test.tsx` (seção
   ausente sem cartão; linha com os itens; linha escondida quando o apelido já está na lista).
2. Código até verde; `npm test` e `claude plugin test plugins/painel-sessoes`.
3. Skill, protocolo e versão.
4. Audite o gesto "Abrir a orquestradora" da linha (skill `auditoria-de-clique`).

### Critério de pronto
- Cartão proposto aparece na seção em até uma leitura do pane; some sozinho quando a sessão do apelido aparece viva.
- Nenhuma pergunta nova com Q-ID para clicar em cartão (a skill não pede mais).
- Gate verde e os testes do mod verdes.

<a id="design"></a>
## O que vai à designer (uma revisão para os dois)
Em `docs/design/revisoes/2026-10-27-barra-e-sessoes-para-abrir.md`: os ícones e as cores de cada botão da barra (D7),
com contraste nos dois temas e o que o `Button` aceita; o lugar e o destaque do botão de limpar (D1, D2), e o
`Limpando…`; a linha de "Sessões para abrir" (D10), se conta no resumo do topo e como fica estreita. A revisão não muda
as decisões acima sem voltar à planejadora.

<a id="fora"></a>
## Fora de escopo
- Remover o ramo do "sim" do painel e da janela da T7 (fica para quando não houver pergunta antiga).
- Botão de limpar em outra sessão que não a orquestradora, ou para membros do pool.
- Abrir a sessão pelo cartão direto do pane (o app só abre no turno do operador, na conversa da orquestradora).

## Regras do projeto que valem aqui
Node ≥ 20, ESM, sem dependência; `node:test` na raiz e `claude plugin test` para o mod; `process.exitCode`; testes nunca
tocam `~/.claude` real; commit convencional em PT-BR; texto de UI não cita F<n>, ADR nem doc; ação assíncrona com estado
visível onde a pessoa agiu.
