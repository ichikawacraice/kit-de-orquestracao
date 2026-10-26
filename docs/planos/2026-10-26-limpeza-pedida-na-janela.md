# F53 — o pedido de limpar a orquestradora abre uma janela, e o sim dado nela vale como ok

- **Data:** 2026-10-26 · **Planejadora:** P1 · **Branch:** `claude/f53-limpeza-na-janela` (sobre a main em `f5df9f4`, com a F48 já mergeada em `7147b10`)
- **Pedido do operador (26/10):** o pedido de ok para a orquestradora se limpar não pode ficar só no chat, onde se perde. Ele aparece numa janela (a mesma de responder perguntas, `AskUserQuestion`) e como pergunta no painel, com destaque; a trava aceita o sim dado na janela.

## O que foi medido (26/10, nesta árvore e nos transcripts do projeto)

- **A F48 está na main.** A orquestradora com o operador presente pede o ok a partir de 250 mil (`plugins/orquestracao/hooks/contexto-do-papel.mjs`, função `orquestradora`, linhas ~51-63): satisfaz com a pergunta `limpar · orquestradora` aberta no painel, ou respondida há ≤ 2 h; senão cobra (`cobrou-pedir`). Hoje ela **não** sabe se o turno termina esperando o operador: isso só existe no ramo da planejadora (o `ultimoParagrafo` com `?` ou `Q<n>`, linhas ~96-98).
- **O T7** (`plugins/orquestracao/hooks/papel-do-pool.mjs`, linhas ~159-174) libera `clear_session "self"` da orquestradora com: modo ausente ligado; `origemDoTurno === 'human'`; ou o sim do painel (`respondidaPor: "painel"`, `respondidaEm` ≤ 30 min). **Não lê a janela**: num turno aberto por mensagem de outra sessão (`peer`), o "sim" dado na janela é recusado.
- **A janela já foi usada pela orquestradora para isso** (Q287 e Q290, 26/10, transcripts `c127266f…` e `d13827a4…` deste projeto). Formato medido no transcript:
  - o pedido é uma entrada `assistant` com `tool_use` `name: "AskUserQuestion"`, `input.questions[]` (`question`, `header`, `options[].label`);
  - a resposta é a entrada `user` seguinte, com `message.content[]` de `tool_result` (`tool_use_id` do pedido; `content`: `Your questions have been answered: "<pergunta>"="<rótulo>". …`), `toolUseResult: { questions, answers }`, onde `answers` é `{ "<texto da pergunta>": "<rótulo escolhido ou o texto que ele digitou>" }`, `sourceToolAssistantUUID` e `timestamp` (a hora da resposta);
  - janela fechada sem resposta: `tool_result` com `is_error: true` e `toolUseResult: "User rejected tool use"`;
  - essas entradas não têm `origin`: o `origemDoTurno` as pula (é `tool_result`) e a origem do turno continua sendo a da mensagem que o abriu.
- **Quem escreve o `tool_result` é o app**, não a sessão: a sessão só escreve o `tool_use`. Forjar exige gravar o `.jsonl` à mão pelo Bash, o mesmo risco aceito na F48 (sessões cooperativas).
- **A janela prende a sessão** até a resposta: enquanto está aberta, a orquestradora não recebe notificação nem mensagem de outra sessão. Por isso ela só abre quando ia parar esperando o operador de qualquer jeito.
- **O destaque no painel é da F52** (P3, plano `docs/planos/2026-10-26-barra-de-status-do-kit.md` na branch `f52-barra-de-status`, decisão D10): linha `A orquestradora pede para se limpar` com o botão no topo do pane, enquanto a pergunta `limpar · orquestradora` estiver aberta. A pergunta já existe no painel desde a F48.

## Decisões (todas *assumidas, a confirmar* — reversíveis e baratas)

- **D1 · A janela abre quando a orquestradora ia parar esperando o operador**, com ≥ 250 mil e o modo ausente desligado: o último parágrafo do turno tem `?` ou `Q<n>` (a mesma regra da planejadora). Antes de parar, ela abre a janela. Motivo: a janela prende a sessão; abrir no meio do trabalho travaria merges e notificações enquanto ele não olha.
- **D2 · Contrato da pergunta na janela** — uma pergunta de `input.questions` cujo `question` contém `limpar · orquestradora` como termo inteiro: sem caixa, espaços em volta do `·` à vontade, e seguido de `:`, `?`, `.`, `,`, espaço ou fim (`limpar · orquestradora-velha` não casa). Formato que a skill manda: `question` = `Qnn · limpar · orquestradora: estou com N mil de contexto e o estado está salvo. Posso me limpar?`, `header` = `Qnn limpar`, opções `Sim, pode limpar` (primeira, com `(Recommended)`) e `Não, agora não`. O Q-ID é o mesmo da pergunta do painel.
- **D3 · O sim da janela** = a resposta (`toolUseResult.answers[<question>]`) começa com `sim` (sem caixa, depois de tirar espaços), na entrada que não é de subagente (`isSidechain !== true`), com `timestamp` há ≤ 30 min e não no futuro (> agora + 1 min). Texto digitado em "Other" que começa com "sim" vale: foi ele quem digitou. Mesma janela de 30 min do sim do painel.
- **D4 · Trégua** — resposta da janela que não é sim, há ≤ 2 h, segura a cobrança como o "não" do painel. Janela aberta no turno, respondida ou fechada sem resposta, satisfaz a cobrança daquele turno (não fica reabrindo).
- **D5 · Depois da janela, a orquestradora atualiza a pergunta do painel**: sim → `estado: "respondida"`, `resposta: "sim (pela janela)"`, e limpa; não → `respondida`, `resposta: "não (pela janela)"`. Assim o botão da F52 some e o pedido não fica em dois lugares. O `painel.mjs` já aceita isso da linha de comando (só `respondidaPor`/`respondidaEm` são recusados, e não são precisos aqui: a prova é o transcript).
- **D6 · O destaque no painel fica com a F52 (D10 dela)**, já desenhado pela D2 da F52. A F53 não mexe em `plugins/painel-sessoes/**`. A pergunta continua aparecendo em "Esperam você" como hoje.
- **D7 · Versão `0.1.29`** do plugin `orquestracao` (main em 0.1.28 depois do #19 e do #20). Quem mergear depois acerta no rebase.

## Bloco único — executora (Sonnet, médio)

Faixa: só `plugins/orquestracao/**`. Sem tela, sem D.

### Arquivos

| Arquivo | O que muda |
|---|---|
| `plugins/orquestracao/hooks/pool-comum.mjs` | `export function janelasDeLimpeza(transcriptPath)`: lê o `.jsonl`; para cada `tool_use` `AskUserQuestion` de entrada sem `isSidechain === true` com alguma pergunta que casa D2, devolve `{ abertaEm, respondidaEm, resposta, recusada }` (`abertaEm` = `Date.parse` do `timestamp` do `tool_use`; `respondidaEm`/`resposta` vindos da entrada com o `tool_result` daquele `tool_use_id`: `timestamp` e `toolUseResult.answers[question]`; `recusada` = `is_error === true` ou sem `answers`). Sem resposta ainda: `respondidaEm: null`. Exporte também `ehPerguntaDeLimpeza(texto)` (a regra de D2) e `SIM_DA_JANELA_MS = 30 * 60_000`. Erro de leitura → `[]`. |
| `plugins/orquestracao/hooks/papel-do-pool.mjs` | No T7, depois do sim do painel: passa (`liberou-limpeza` com motivo `sim da janela`) se `janelasDeLimpeza(e.transcript_path)` tem uma com `resposta` que casa `/^\s*sim\b/i`, `!recusada` e `respondidaEm` dentro de 30 min e não no futuro. Linha 13 do comentário: `(turno humano, modo ausente, o sim do painel ou o da janela, F48/F53)`. Motivo do `nega` termina em `…limpe quando ele disser sim no chat, na janela ou no painel. Com o modo ausente ligado, pode.` |
| `plugins/orquestracao/hooks/contexto-do-papel.mjs` | Função `orquestradora` (regra abaixo). Comentário do topo ganha a janela. Extraia a detecção do "termina esperando" (`ultimoParagrafo` + a regex) para uma função `terminaEsperando(texto)` usada pelos dois ramos, sem mudar o ramo da planejadora. |
| `plugins/orquestracao/skills/orquestradora/SKILL.md` | Seção `## Orçamento de contexto`, parágrafo "Limpeza inteira com o operador presente" e o da trava (texto abaixo). |
| `plugins/orquestracao/.claude-plugin/plugin.json` | versão `0.1.29`. |

### Regra nova da orquestradora no `contexto-do-papel.mjs` (modo ausente desligado, `t ≥ PEDIR`)

1. `limpou` no turno → `limpou` (sem mudança).
2. `pediu` (pergunta do painel aberta, ou respondida há ≤ 2 h, como hoje) é falso → `cobrou-pedir` (sem mudança no desfecho). Se o turno termina esperando, o motivo acrescenta: *"e, como o turno termina esperando por ele, abra também a janela (AskUserQuestion) com a mesma pergunta antes de parar."*
3. `pediu` verdadeiro, o turno termina esperando (`terminaEsperando`), a pergunta do painel está `aberta` (nenhuma em trégua de 2 h) e **não** há em `janelasDeLimpeza` uma aberta neste turno (`abertaEm ≥ inicioDoTurno`) nem uma respondida há ≤ 2 h → `stop_hook_active` dá `deixou-passar`; senão bloqueia com `cobrou-janela`, motivo: *"Contexto em N mil e o turno termina esperando por ele: antes de parar, abra a janela (AskUserQuestion) com a pergunta `Qnn · limpar · orquestradora` (o Q-ID da pergunta do painel; opções `Sim, pode limpar` (Recommended) e `Não, agora não`). Sim → marque a pergunta do painel respondida e limpe. Não → marque respondida e siga."*
4. O resto → `satisfeito-pediu` (sem mudança), ou `satisfeito-janela` quando foi a janela que satisfez.

Planejadora, design, executora, validadora e a orquestradora com o modo ausente ligado: sem mudança.

### Texto novo da skill `orquestradora` ("Orçamento de contexto")

No parágrafo "Limpeza inteira com o operador presente", troque *"Limpa só quando ele disser sim no chat dela ou no botão do painel (…)"* e *"Não limpa ao terminar o turno esperando por ele."* por, em prosa do projeto:
- Limpa só com o sim dele: no chat, na janela ou no botão do painel (os dois últimos valem 30 min; um "não" ou "adiar" segura a cobrança por 2 h).
- **Quando o turno vai terminar esperando por ele** (pergunta, Q-ID), antes de parar ela abre a janela (`AskUserQuestion`) com a pergunta no formato de D2 (`Qnn · limpar · orquestradora: …`, cabeçalho `Qnn limpar`, opções `Sim, pode limpar` (Recommended) e `Não, agora não`). A janela prende a sessão até a resposta; por isso só se abre quando ela ia parar de qualquer jeito, nunca no meio de merge, release ou com subagente dela rodando.
- Depois da resposta, atualiza a pergunta do painel (D5) e, se foi sim, segue o "Como limpar".
- Parágrafo da trava: *"o T7 … recusa `clear_session "self"` da orquestradora sem o ok (turno do operador, modo ausente, sim do painel ou sim da janela); a cobrança … pede a pergunta a partir de 250 mil e, se o turno termina esperando por ele, a janela."*

### Passos (teste antes do código)

1. `git fetch && git switch -c claude/f53-exec origin/claude/f53-limpeza-na-janela` (a branch traz este plano).
2. Escreva os testes novos (abaixo) e rode-os: têm de **falhar** pelo motivo certo (a janela não é lida). Cole a saída vermelha no relatório.
3. `pool-comum.mjs` (`janelasDeLimpeza`, `ehPerguntaDeLimpeza`, `SIM_DA_JANELA_MS`).
4. `papel-do-pool.mjs` (T7).
5. `contexto-do-papel.mjs` (`terminaEsperando` e a regra nova).
6. Skill e versão.
7. Testes do pacote verdes; depois `npm test` uma vez, `claude plugin validate .` e `claude plugin validate plugins/orquestracao --strict`. Cole as saídas com `; echo "exit=$?"`.
8. Commit(s) conventional em PT-BR (ex.: `feat(orquestracao): o pedido de limpar a orquestradora abre a janela e o sim dela vale como ok`), push de `claude/f53-exec`, HEAD à P1.

### Testes novos

Fixture de janela: copie a forma medida (entrada `assistant` com `tool_use` `AskUserQuestion` + entrada `user` com `tool_result` do mesmo `tool_use_id`, `toolUseResult: { questions, answers }` e `timestamp`), com a pergunta `Q9 · limpar · orquestradora: … Posso me limpar?`.

`hooks/tests/papel-do-pool.test.mjs` (bloco T7, turno `peer`, sem bandeira, sem pergunta no painel):
- janela respondida `Sim, pode limpar (Recommended)` há 5 min → passa, log `liberou-limpeza` com `sim da janela`;
- **contraste:** o mesmo transcript sem a resposta (só o `tool_use`) → nega `T7` (prova que é a resposta que libera);
- resposta `Não, agora não` → nega; resposta digitada `sim, pode` → passa;
- respondida há 40 min → nega; `timestamp` no futuro → nega;
- `is_error: true` / `toolUseResult: "User rejected tool use"` → nega;
- janela com outra pergunta (`Q9 · merge do PR 7?`) respondida `Sim` → nega;
- a mesma janela de limpeza em entrada com `isSidechain: true` → nega;
- janela com duas perguntas, a de limpeza respondida `Não` e a outra `Sim` → nega.

`hooks/tests/contexto-do-papel.test.mjs` (ORQ, sem bandeira; o `transcript()` ganha um jeito de pôr a janela em `ferramentas`/`extra`):
- 260 mil, pergunta do painel aberta, texto final `Q9: posso seguir?` sem janela → `block`, log `cobrou-janela`, motivo casa `/AskUserQuestion/`;
- o mesmo com a janela aberta neste turno (sem resposta) → `null`, `satisfeito-janela`;
- o mesmo com a janela respondida `Não, agora não` há 1 h num turno anterior → `null`; há 3 h → `block` `cobrou-janela`;
- 260 mil, pergunta aberta, texto final `feito.` (não espera) → `null`, `satisfeito-pediu` (sem mudança);
- 260 mil, sem pergunta no painel, texto final com `?` → `block` `cobrou-pedir`, motivo casa `/janela/`; texto sem `?` → `cobrou-pedir`, motivo **não** casa `/janela/`;
- `stop_hook_active` no caso do `cobrou-janela` → `null`, `deixou-passar`;
- com a bandeira ligada, 260 mil e `?` → `cobrou-150-espera` (sem mudança: a janela não entra no modo ausente);
- os testes atuais do ramo da planejadora continuam passando (a extração de `terminaEsperando` não muda nada).

`hooks/tests/pool-comum.test.mjs`: `ehPerguntaDeLimpeza` casa `Q9 · limpar · orquestradora: …`, `q9 · LIMPAR  ·  orquestradora` e não casa `limpar · worktrees órfãos` nem `limpar · orquestradora-velha`; `janelasDeLimpeza` devolve `[]` para arquivo que não existe e afirma antes que o transcript da fixture tem 1 janela (não vazio).

Doc × código (`hooks/tests/perguntas-proprias-doc.test.mjs` ou um teste novo no mesmo estilo): a seção "Orçamento de contexto" da skill contém `limpar · orquestradora`, `Sim, pode limpar` e `AskUserQuestion`, e `ehPerguntaDeLimpeza` casa a pergunta de exemplo escrita na skill.

### Critério de pronto

- `node --test plugins/orquestracao/hooks/tests/contexto-do-papel.test.mjs plugins/orquestracao/hooks/tests/pool-comum.test.mjs; node plugins/orquestracao/hooks/tests/papel-do-pool.test.mjs; echo "exit=$?"` → `exit=0`, com os testes novos listados e a saída vermelha do passo 2 colada.
- `npm test; echo "exit=$?"` → `exit=0`.
- `claude plugin validate . ; echo "exit=$?"` e `claude plugin validate plugins/orquestracao --strict; echo "exit=$?"` → `exit=0`.
- `grep -n "Sim, pode limpar" plugins/orquestracao/skills/orquestradora/SKILL.md plugins/orquestracao/hooks/contexto-do-papel.mjs` acha os dois.

### Fora de escopo

- `plugins/painel-sessoes/**` (o destaque e o botão são da F52).
- Mudar o sim do painel, a trégua de 2 h, os 250 mil ou o modo ausente.
- Abrir a janela fora do "termina esperando" (no meio do trabalho).

## Validação (V, Opus, contexto novo)

- Diff × este plano; tentar forjar o ok: `tool_use` sem `tool_result`, `tool_result` de outra ferramenta com o mesmo texto, subagente, resposta velha, pergunta parecida (`limpar · orquestradora-velha`?).
- Ponta a ponta com o hook de verdade sobre uma cópia de um transcript real com janela (Q290, `d13827a4…`), trocando só a pergunta para o formato D2 e o `timestamp` para agora.
- Na tela (auditoria de clique), numa sessão de teste com título `🎛 orquestradora — teste` e o plugin da branch, **nunca** na orquestradora real: abrir a janela, responder Sim e conferir que `clear_session "self"` passa; responder Não e conferir que é recusado. Assumida, a confirmar: se não der para montar a sessão de teste, o passo fica para o operador depois do merge.
