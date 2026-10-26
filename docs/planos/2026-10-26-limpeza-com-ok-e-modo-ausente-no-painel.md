# F48 — a orquestradora só se limpa inteira com o ok do operador; o painel liga e desliga o modo ausente

- **Data:** 2026-10-26 · **Planejadora:** P1 · **Branch de integração da frente:** `claude/f48-limpeza-e-header` (sobre a main em `fea8d50`)
- **Pedido do operador (26/10, palavras dele):** *"está ruim a orquestradora se limpando toda hora, eu estou lendo algo e ela se limpa, vamos deixar ela limpando só contexto, se limpar por inteiro em uma janela maior, e não se limpar por inteiro automaticamente, ela solicitar ou perguntar se pode se limpar, e com a ação humana só se limpar, no modo ausente on, ela pode se limpar, já que teoricamente ninguém está lendo. Vamos colocar botões no header do painel, de ligar e desligar o modo ausente, informar qual modo está ativo, e fica um local para possíveis outros botões."*

## O que foi medido (26/10, nesta árvore)

- `plugins/orquestracao/hooks/contexto-do-papel.mjs` (Stop, 89 linhas) trata a orquestradora como `planejadora`: ≥ 300 mil cobra `clear_session "self"`; ≥ 200 mil cobra limpar ou `Contexto: sigo — …`; ≥ 150 mil com o turno terminando em `?`/`Q<n>` cobra limpar. **É este último que limpa a orquestradora quando o operador vai ler a resposta dela.**
- A skill `orquestradora` (seção `## Orçamento de contexto`, linha ~145) manda a mesma tabela e o "Como limpar" termina em `clear_session "self"` sem pedir nada.
- Nenhuma trava impede a orquestradora de chamar `clear_session "self"` sozinha (`hooks.json`: o `papel-do-pool.mjs` não casa `clear_session`).
- A sessão **não tem como se compactar** por ferramenta: `clear_session` é o `/clear`; o `/compact` só sai do operador ou da compactação automática (`autoCompactWindow`, 300 mil no `~/.claude/settings.json` global, skill `papeis-e-modelos`, seção `contexto`).
- Modo ausente: bandeira `~/.claude/orquestracao/operador-ausente.json` (`{desde, frase, sessionId}`), gravada/apagada só por `operador-ausente.mjs` (UserPromptSubmit, só turno humano, só `/ausente on|off`). Quem lê: `papel-do-pool.mjs` (`bandeiraDeAusencia`, linha ~51: sem `desde` válido = desligado).
- Pane (`plugins/painel-sessoes/hooks/register.tsx`): o motor dá `$.fs.read/write/list/exists/stat`, **não dá apagar**. O pane já grava arquivo (resposta de pergunta, `responder`, linha ~440) e não expõe ferramenta que mexa em estado (`onde_esta_o_painel` só lê). Clique de `Button` só vem de pessoa.
- A resposta pelo painel chega à sessão como `send_message` (origem `peer`) ou `prompt.submit` (origem `plugin`), nunca `human`; o `papel-do-pool.mjs` já recusa arquivar com origem `plugin` (T2). O `painel.mjs` deixa qualquer sessão gravar `estado: respondida` numa pergunta.

## Decisões (todas *assumidas, a confirmar* — reversíveis e baratas)

- **D1 · "Limpar só contexto" = a compactação automática** que já existe (300 mil, global), mais o "ler pouco" da skill. Motivo: é a única limpeza leve que a sessão tem e ela não esvazia a conversa que o operador está lendo. Nada novo a construir.
- **D2 · A janela maior da limpeza inteira é 250 mil** (hoje 150/200). Abaixo disso, a orquestradora com o operador presente não é cobrada de nada. Motivo: fica acima dos 200 de hoje e abaixo dos 300 da compactação, que segue como rede.
- **D3 · A partir de 250 mil ela PEDE**: abre a pergunta `limpar · orquestradora` (Q-ID, no painel, com `sessaoId`) e segue trabalhando. Limpa só com ação humana: o operador escreve no chat dela (turno `human`) ou responde **Sim** no painel. O "sim" do painel vale por 30 min. Pergunta respondida "não"/"adiar" segura a cobrança por 2 h (não fica pedindo a cada turno).
- **D4 · Modo ausente ligado: valem as regras de hoje** (150-espera, 200, 300) e ela limpa sozinha.
- **D5 · Trava nova (T7) no `papel-do-pool.mjs`**: `clear_session` da orquestradora sobre ela mesma é recusado sem o ok. Só a orquestradora; membros e a orquestradora limpando membro não mudam.
- **D6 · O "sim" do painel se prova pelo campo `respondidaPor: "painel"`**, que só o pane grava; o `painel.mjs` passa a recusar esse campo. Limite conhecido: Bash pode gravar o arquivo à mão; o risco aceito é o mesmo de hoje (sessões cooperativas).
- **D7 · O botão do painel desliga gravando `{ligado:false, desligadoEm, por:"painel"}`**, porque o pane não apaga arquivo. Contrato único de leitura (abaixo). O `/ausente off` continua apagando.
- **D8 · O topo do painel passa pela D1 antes da E** (regra do projeto: revisão de design antes de tela).

## Contratos que os dois blocos compartilham

**Bandeira do modo ausente** — `~/.claude/orquestracao/operador-ausente.json` (base `HOOKS_CREWAI_BASE` nos hooks; `$HOME/.claude/orquestracao` no pane):
- **Ligado** ⇔ o arquivo existe, é JSON válido, `desde` é data válida **e** `ligado !== false`. Qualquer outra coisa = desligado.
- Ligar (comando): `{desde, frase:"/ausente on", sessionId, por:"comando"}`. Ligar (painel): `{desde, frase:"botão do painel", sessionId: <id do app ou null>, por:"painel"}`.
- Desligar (comando): apaga o arquivo. Desligar (painel): `{ligado:false, desligadoEm, por:"painel"}`.

**Pergunta de limpeza** — documento em `<painel>/perguntas/Q<n>.json` (pasta: `PAINEL_DIR` || `IZANAGI_PAINEL_DIR` || `$HOME/.claude/orquestracao/painel`):
- `data.titulo` começa com `limpar · ` (ex.: `limpar · orquestradora`); `data.sessaoId` = o `local_…` da orquestradora (o hook acha pelo `registroDaSessao(session_id).localId`).
- **Ok do painel** = `estado:"respondida"`, `respondidaPor:"painel"`, `resposta` que começa com `sim` (sem caixa), `atualizadoEm` há ≤ 30 min.

---

## Bloco A — limpeza da orquestradora (hooks, skills, `painel.mjs`)

Executora: E (Sonnet, médio). Faixa: só `plugins/orquestracao/**`. Pode rodar em paralelo com o Bloco B.

### Arquivos

| Arquivo | O que muda |
|---|---|
| `plugins/orquestracao/hooks/hooks-crewai-comum.mjs` | `export function modoAusente()`: lê `BASE/operador-ausente.json` pelo contrato acima; devolve `{...b, desdeMs}` ou `null`. |
| `plugins/orquestracao/hooks/pool-comum.mjs` | `export function perguntasDeLimpeza(localId)`: lista `data` das perguntas cujo `titulo` começa com `limpar · ` e `sessaoId === localId` (pasta pelo contrato). Erro de leitura = `[]`. |
| `plugins/orquestracao/hooks/papel-do-pool.mjs` | `bandeiraDeAusencia()` passa a usar `modoAusente()`. Nova trava **T7** (abaixo). Comentário do topo ganha a linha do T7. |
| `plugins/orquestracao/hooks/hooks.json` | matcher do `papel-do-pool.mjs` ganha `mcp__ccd_session_mgmt__clear_session`. |
| `plugins/orquestracao/hooks/contexto-do-papel.mjs` | papel `orquestradora` separado (regra abaixo); constante `PEDIR` = 250 000 com override `CONTEXTO_LIMITE_PEDIR`; comentário do topo atualizado. |
| `plugins/orquestracao/hooks/operador-ausente.mjs` | grava `por:"comando"` no `on`; comentário cita o botão do painel como segunda via humana. |
| `plugins/orquestracao/skills/orquestradora/scripts/painel.mjs` | recusa `respondidaPor` vindo da linha de comando (`set`, `update`, `batch`) na coleção `perguntas`: *"respondidaPor só o pane grava (é a prova do clique do operador)"*. |
| `plugins/orquestracao/skills/orquestradora/SKILL.md` | seção `## Orçamento de contexto`: reescrever o "Gatilho de limpeza" e o "Como limpar" (texto abaixo). Linha 13 continua citando a seção. |
| `plugins/orquestracao/skills/papeis-e-modelos/SKILL.md` | tabela "Por papel", linha Planejador/orquestrador: *"A orquestradora com o operador presente não limpa sozinha: a partir de 250 mil pede o ok (skill `orquestradora`, "Orçamento de contexto")"*; parágrafo **A trava**: a exceção da orquestradora e o T7. |
| `plugins/orquestracao/skills/ausente/SKILL.md` | o botão do topo do painel é a segunda via humana (liga/desliga, mesma bandeira); com o modo ligado a orquestradora pode se limpar inteira sozinha; "sem argumento" lê pelo contrato (`ligado:false` = desligado). |
| `plugins/orquestracao/pool/protocolo.md` | linha 9 e linha 74: a bandeira liga/desliga também pelo botão do painel (o desligar do painel grava `ligado:false`); mensagem de outra sessão continua sem poder. |
| `plugins/orquestracao/.claude-plugin/plugin.json` | versão `0.1.21`. |

### Regras exatas

**T7 (`papel-do-pool.mjs`, PreToolUse `mcp__ccd_session_mgmt__clear_session`):**
1. Alvo é a própria sessão quando `session_id` é `"self"`, o `session_id` do evento ou o `localId` do registro dela. Outro alvo → não faz nada (sai).
2. Quem chama não é orquestradora (`ehOrquestradora`) → sai.
3. Passa (registra `liberou-limpeza` com o motivo) se: `modoAusente()` não é null; **ou** `origemDoTurno(transcript) === 'human'`; **ou** existe em `perguntasDeLimpeza(localId)` uma com o ok do painel (contrato).
4. Senão nega (`T7`), motivo: *"Limpeza inteira só com o ok do operador (F48): ele pode estar lendo. Escreva o estado, abra a pergunta `limpar · orquestradora` (Q-ID, sessaoId, recomendação: limpar) e siga; limpe quando ele disser sim no chat ou no painel. Com o modo ausente ligado, pode."*

**Orquestradora no `contexto-do-papel.mjs`:**
- `papelDe` devolve `'orquestradora'` para `ehOrquestradora`. Com `modoAusente()` ligado, ela segue exatamente o caminho de `'planejadora'` de hoje (os testes 1–N atuais da orquestradora continuam passando com a bandeira ligada).
- Com o modo desligado: `t < PEDIR` → sai sem cobrar e sem registrar. `t ≥ PEDIR` → satisfaz (sem bloquear) se: limpou no turno (`limpou`); ou há pergunta de limpeza dela com `estado: "aberta"`, ou com `atualizadoEm` há ≤ 2 h em qualquer estado (`satisfeito-pediu`). `stop_hook_active` → `deixou-passar`. Senão bloqueia (`cobrou-pedir`), motivo: *"Contexto em N mil. Não limpe sozinha (o operador pode estar lendo): escreva o estado, abra a pergunta `limpar · orquestradora` no painel (Q-ID de proxima-pergunta, sessaoId, recomendação: limpar) e siga; limpe só com o sim dele. Com o modo ausente ligado, pode limpar sozinha."*
- Planejadora, design, executora e validadora: sem mudança.

**Texto novo da skill `orquestradora`, "Orçamento de contexto"** (substitui o bloco "Gatilho de limpeza" até o fim de "Como limpar"; mantém o parágrafo de custo antes e o "Ler pouco" depois). Conteúdo, em prosa do projeto:
- Decisão do operador (26/10) citada entre aspas, curta.
- **Limpeza leve, sozinha:** a compactação automática (300 mil) e o "Ler pouco". Nada a fazer.
- **Limpeza inteira com o operador presente:** a partir de **250 mil** (`get_usage` `"self"`, depois de cada merge e antes de um lote de notificações) ela **pede**: grava o estado, abre a pergunta `limpar · orquestradora` com Q-ID, `sessaoId` e recomendação, e segue. Limpa só quando ele disser sim no chat ou no botão do painel (o do painel vale 30 min). Não limpa ao terminar o turno esperando por ele.
- **Modo ausente ligado:** valem 150 (turno terminando esperando) / 200 (momento oportuno) / 300 (não pega trabalho novo), e ela limpa sozinha.
- **Como limpar** (quando pode): estado salvo → uma linha ao operador → `clear_session "self"`. A trava: T7 em `papel-do-pool.mjs` e a cobrança em `contexto-do-papel.mjs`.

### Passos (teste antes do código)

1. `git fetch && git checkout -b <sua-branch> origin/claude/f48-limpeza-e-header`.
2. Escreva os testes novos (lista abaixo) e rode-os: têm de **falhar** pelo motivo certo (a regra não existe). Cole a saída vermelha no relatório.
3. `hooks-crewai-comum.mjs` (`modoAusente`) e `pool-comum.mjs` (`perguntasDeLimpeza`).
4. `papel-do-pool.mjs` (troca de `bandeiraDeAusencia` + T7) e `hooks.json`.
5. `contexto-do-papel.mjs`.
6. `operador-ausente.mjs` e `painel.mjs`.
7. Skills, protocolo e versão do plugin.
8. Testes do pacote verdes; depois o gate completo uma vez (`npm test`), `claude plugin validate .` e `claude plugin validate plugins/orquestracao --strict`. Cole as saídas com `; echo "exit=$?"`.
9. Commit(s) conventional em PT-BR (ex.: `feat(orquestracao): a orquestradora pede o ok antes de se limpar inteira`), push da sua branch, e me mande o HEAD.

### Testes novos (todos com `HOME`, `HOOKS_CREWAI_BASE`, `PAINEL_DIR`, `POOL_APP_SESSOES_DIR` em pasta temporária)

`hooks/tests/contexto-do-papel.test.mjs` (o `novo()` já cria `local_ORQ`; perguntas em `<base>/painel/perguntas/`):
- ORQ 260 mil, sem bandeira, sem pergunta → `block`, motivo casa `/limpar · orquestradora/`, log `cobrou-pedir`.
- ORQ 260 mil + pergunta `limpar · orquestradora` `aberta` com `sessaoId: local_ORQ` → `null`, log `satisfeito-pediu`.
- ORQ 260 mil + a mesma pergunta com `sessaoId` de outra sessão → `block`.
- ORQ 260 mil + pergunta `respondida` "não" há 1 h → `null`; há 3 h → `block`.
- ORQ 260 mil com `clear_session "self"` no turno → `null`, log `limpou`.
- ORQ 160 mil terminando em `?`: sem bandeira → `null`; **com** bandeira ligada → `block` `cobrou-150-espera` (prova de que a ausência mede algo).
- ORQ 210 mil: sem bandeira → `null`; com bandeira → `block` `cobrou-200`.
- Bandeira `{ligado:false, desligadoEm, por:"painel"}` → ORQ 210 mil → `null` (desligado).
- Os testes atuais da orquestradora que esperam a regra da planejadora passam a escrever a bandeira ligada antes (não mude o que eles afirmam).

`hooks/tests/papel-do-pool.test.mjs`:
- T7: ORQ `clear_session "self"` em turno `peer`, sem bandeira, sem pergunta → nega com `T7`.
- T7: o mesmo em turno `human` → passa.
- T7: turno `peer` com bandeira ligada → passa; com bandeira `ligado:false` → nega.
- T7: pergunta de limpeza dela `respondida`, `respondidaPor:"painel"`, `resposta:"sim (segue a recomendação)"`, há 10 min → passa; sem `respondidaPor` → nega; há 40 min → nega; `resposta:"não"` → nega; `sessaoId` de outra → nega.
- T7: ORQ `clear_session` de um membro (`local_E1`) em turno `peer` → passa (sem mudança).
- T7: P1 `clear_session "self"` em turno `peer` → passa.
- T3a: bandeira `ligado:false` → `start_session` em turno `peer` passa (desligado).

`hooks/tests/hooks-json.test.mjs`: o matcher do `papel-do-pool.mjs` contém `mcp__ccd_session_mgmt__clear_session`.

`hooks/tests/painel-validacao.test.mjs` (ou o arquivo de teste do `painel.mjs` que já cobre `perguntas`): `update perguntas Q1 '{"respondidaPor":"painel"}'` sai com `exit≠0` e a mensagem cita `respondidaPor`; `update perguntas Q1 '{"estado":"respondida","resposta":"sim"}'` continua passando.

### Critério de pronto (Bloco A)

- `node --test plugins/orquestracao/hooks/tests/contexto-do-papel.test.mjs plugins/orquestracao/hooks/tests/papel-do-pool.test.mjs plugins/orquestracao/hooks/tests/hooks-json.test.mjs plugins/orquestracao/hooks/tests/painel-validacao.test.mjs; echo "exit=$?"` → `exit=0`, e os testes novos listados acima aparecem e falhavam antes do código (saída vermelha do passo 2 colada).
- `npm test; echo "exit=$?"` → `exit=0`.
- `claude plugin validate . ; echo "exit=$?"` e `claude plugin validate plugins/orquestracao --strict; echo "exit=$?"` → `exit=0`.
- `grep -n "250 mil" plugins/orquestracao/skills/orquestradora/SKILL.md plugins/orquestracao/skills/papeis-e-modelos/SKILL.md` acha as duas skills.

---

## Bloco B — o topo do painel (plugin `painel-sessoes`)

**Antes da E: revisão da D1** em `docs/design/2026-10-26-topo-do-painel.md` (+ mock), com crítica ≥ 24/30 sem ressalva alta. A E cumpre a revisão; onde a revisão e este plano divergirem no visual, vale a revisão; no comportamento, vale este plano.

Executora: E (Sonnet, médio). Faixa: só `plugins/painel-sessoes/**`.

### O que a D1 decide (e o que já está decidido)

- **Já decidido (comportamento):** uma faixa no topo do pane, acima das seções, que diz o modo ativo (presente / ausente, e desde quando) e tem o botão que liga ou desliga; a faixa é o lugar dos botões futuros (hoje só este). Vale no desktop e no terminal.
- **Estados do botão:** parado; gravando (rótulo "Ligando…"/"Desligando…", clique ignorado); feito (toast); falhou (volta ao estado anterior e o aviso entra em `avisos`, com o motivo).
- **O efeito entra na hora e a recusa desfaz** (regra do projeto, `CLAUDE.md`, "Design de interface").
- **A D1 decide:** o texto exato do modo e do botão, a posição e o peso visual da faixa, como o "ausente" se distingue do "presente" (sem depender só de cor), e o desenho em 300 px e no terminal. Texto de UI não cita spec, ADR nem F<n>.

### Arquivos

| Arquivo | O que muda |
|---|---|
| `plugins/painel-sessoes/types/index.d.ts` | `Leitura.ausente?: { ligado: boolean; desde?: string; por?: string } \| null` (`null` = não deu para ler; ausente no estado antigo). `PluginState` ganha `trocandoModo: boolean`. |
| `plugins/painel-sessoes/hooks/register.tsx` | lê a bandeira em cada `atualizar` (contrato acima; arquivo ausente = presente; JSON inválido = `null` e o erro em `erros`); desenha a faixa do topo pela revisão; `alternarModo($)`: otimista, grava pelo contrato, desfaz e avisa na falha, toast no feito, relê; **não** registra ferramenta nem comando novo para isso. Em `responder`, o `data` gravado ganha `respondidaPor: 'painel'`. |
| `plugins/painel-sessoes/hooks/desenho.ts` | o que a revisão pedir para o SVG da faixa (se ela for SVG). |
| `plugins/painel-sessoes/tests/painel.test.tsx` | testes abaixo. |
| `plugins/painel-sessoes/.claude-plugin/plugin.json` | versão `0.6.0`. |

### Passos

1. Branch a partir de `origin/claude/f48-limpeza-e-header` **depois** que a revisão da D1 estiver nela (eu aviso).
2. Testes novos primeiro (vermelhos, saída colada).
3. Tipos → leitura da bandeira → faixa → `alternarModo` → `respondidaPor`.
4. `claude plugin test plugins/painel-sessoes; echo "exit=$?"`, `claude plugin validate plugins/painel-sessoes --strict; echo "exit=$?"`, `npm test; echo "exit=$?"`.
5. Abrir o pane de verdade (`/painel` numa sessão com o plugin da branch) e clicar ligar e desligar; conferir o arquivo `~/.claude/orquestracao/operador-ausente.json` antes e depois (**volte ao estado em que estava**). Print das duas faixas no relatório.
6. Commit conventional em PT-BR, push, HEAD para mim.

### Testes novos (`painel.test.tsx`)

- Sem arquivo da bandeira → a faixa diz o modo presente e o botão de ligar.
- Bandeira ligada (`desde` válido) → a faixa diz o modo ausente com a hora e o botão de desligar.
- Bandeira `{ligado:false,…}` → presente. JSON inválido → a faixa diz que não deu para ler o modo, e há um erro em `erros`.
- Clique em ligar → o arquivo gravado tem `desde` ISO, `por:"painel"`, sem `ligado:false`; a faixa troca antes de a gravação terminar (otimista).
- Clique em desligar → o arquivo gravado é `{ligado:false, desligadoEm, por:"painel"}`.
- Gravação que falha → a faixa volta ao modo anterior e `avisos` ganha a linha com o motivo.
- Segundo clique durante a gravação → uma gravação só.
- Responder uma pergunta pelo pane → o documento gravado tem `respondidaPor:"painel"`.
- O mod não registra ferramenta nova (a lista de `tool.register` continua só com `onde_esta_o_painel`).

### Critério de pronto (Bloco B)

- `claude plugin test plugins/painel-sessoes; echo "exit=$?"` → `exit=0`, com os testes novos listados (vermelhos antes, saída colada).
- `claude plugin validate plugins/painel-sessoes --strict; echo "exit=$?"` → `exit=0`; `npm test; echo "exit=$?"` → `exit=0`.
- Print do pane real com a faixa nos dois modos, e o conteúdo da bandeira depois de cada clique colado.

---

## Fora de escopo

- Fazer a orquestradora se compactar por comando (não há ferramenta) ou mudar o `autoCompactWindow`.
- Regras de contexto de planejadora, design, executora e validadora.
- Outros botões na faixa (só o lugar deles).
- O pane apagar arquivo; `/ausente` mudar de formato além do `por`.
- Notificar o operador fora do painel quando a pergunta de limpeza abrir.

## Regras do projeto que tocam o trabalho

- `CLAUDE.md` do repo: Node ≥ 20, ESM, sem dependência; `node:test`; `process.exitCode`; testes nunca tocam `~/.claude` real; commits conventional em PT-BR sem citar ADR no título; teste antes do código; gate `npm test`, um por vez; validar manifestos com `claude plugin validate`; testes do mod com `claude plugin test plugins/painel-sessoes`.
- "Design de interface" do `CLAUDE.md`: revisão da D1 antes da tela; ação assíncrona com estado visível; efeito na hora e recusa que desfaz; texto de UI sem citar spec/ADR/doc.
- O plugin é a cópia viva (K8 rodou): conserto entra só no plugin, nada em `~/.claude/` à mão.
- Pool: E não mergeia; PR validado vai à orquestradora pela planejadora.

## Validação

**Robusta** (grava estado, trava nova, dois pacotes): sessão V em contexto novo, Opus, esforço alto, sobre o PR inteiro, com prova no artefato real (pane clicado; hook rodado com transcript de verdade).
