# O painel pede a sessão de cada item que espera na fila (F69)

Planejadora: P3 · 2026-10-26. Branch: `claude/f69-abrir-sessao-pela-fila` (a partir de `origin/main` 69850a4).

## O caso
Pedido do operador (26/10): *"tem um monte de coisa na fila, e a orquestradora não está pedindo pra abrir sessão, coloque um botão em cada de solicitar abertura de sessão, e um de abrir todas"*. A print mostrava a seção "Na fila" do pane com itens do Izanagi em "espera planejamento" e "espera execução".

## Medição (antes do plano)

**Quanto tempo item fica sem dona** (`historico` da fila, trechos com `dono: null` fora de `feito`/`merge`, desde 25/10):
```
trechos 28   > 10 min: 9   > 30 min: 5
F11 izanagi execucao      416 min    F17/F18 izanagi planejamento 416 min
F13 izanagi execucao      198 min    F45 kit execucao              44 min
F48 kit planejamento       15 min    F63/F64 izanagi planejamento  13 min (hoje, 10:23 → 10:36)
```

**Por que a orquestradora não pediu a vaga** (quatro causas, medidas no código e nos transcripts):
1. **Planejamento não conta como "esperando".** `PAPEL_DA_ETAPA` (`plugins/orquestracao/hooks/esperando-papel.mjs:5` e a cópia `plugins/painel-sessoes/hooks/esperando.ts`) só tem `design`, `execucao` e `validacao`. Item em `planejamento` sem planejadora nunca entra na cobrança do F58 — é o caso do F63, F64, F17 e F18.
2. **A cobrança só roda quando a orquestradora termina um turno** (hook `Stop` do `orquestradora-ritual.mjs`). Orquestradora parada não tem turno: a do Izanagi estava `parada` ("pool cheio…") e ninguém a acordou.
3. **Fora do turno do operador, o máximo é um cartão — e ele fica na conversa da orquestradora**, que o operador não está olhando. O pane não mostra cartões.
4. **Turno aberto pelo próprio painel não vale como turno do operador para o app.** Transcript do Izanagi (`6a6d90b1…jsonl`, 23/10 16:58): turno aberto por `$.prompt.submit` do painel (`origin: {kind: "plugin", name: "painel-sessoes"}`, a resposta da Q98) → `start_session` `user_asked` **recusado**: *"Start sessions only on the user's own words to you here; this turn runs an automated event, another session's message…"*. O `own_initiative` (cartão) passou logo depois. Mensagem de outra sessão (`peer`) é recusada igual (regra do app). O papel-do-pool também só aceita `human` (`pool-comum.mjs` `origemDoTurno`).

**O que o mod consegue** (tipos em `plugins/painel-sessoes/.claude-plugin/types/claude-code/index.d.ts` e código atual):
- `$.tool.call({tool: 'mcp__ccd_session_mgmt__send_message', …})` e `mcp__ccd_window__open_session_in` — já usados pelo pane (`responder`, `abrirSessao`, `pedirResumo`).
- `$.prompt.submit` — abre turno `plugin` (medido acima: **não** abre sessão).
- `$.prompt.fill({text, mode})` — põe o texto no campo de digitação **da sessão onde o pane está**; quem aperta Enter é o operador, e aí o turno é `human`.
- `$.tool.call` de `mcp__ccd_session__start_session` direto do clique: **não medido** (só ao vivo, depois do release). Mesmo funcionando, abrir membro exige o prompt do papel, o número livre (E5, V4…), a pasta do projeto e o `aplicar-skills-do-papel.mjs` (que o F70 está consertando): isso é da orquestradora, não do pane.

## Decisões
- **D1 — o botão leva o pedido à orquestradora do projeto do item; quem abre é ela.** Recomendada porque (a) é o único caminho medido em que a abertura acontece num turno `human`, (b) a regra de abrir membro (número, prompt, skills, despacho) fica num lugar só, a skill da orquestradora. Alternativa descartada: o pane chamar `start_session` sozinho (não medido; duplicaria a abertura de membro e bate no F70).
- **D2 — dois caminhos, pela sessão onde o pane está:**
  - **Pane aberto na própria orquestradora do projeto do item** → `$.prompt.fill` com o pedido (sem enviar). O toast diz *"Pedido no campo de texto: aperte Enter para abrir as sessões"*. Com Enter, o turno é do operador e ela abre todas de uma vez. Campo com rascunho: `mode: 'append'` numa linha nova (não apaga o que o operador digitava); vazio: `replace`.
  - **Pane em outra sessão** → `send_message` à orquestradora do projeto. Ela responde, no turno `peer`, com **um cartão por vaga** (`own_initiative`, título `<ID> · livre`), que o operador inicia com um clique. Depois do envio, o pane tenta pôr a orquestradora em foco (`open_session_in`, como o "Abrir P2" de hoje); recusado, copia o endereço. Toast: *"Pedido enviado à orquestradora do izanagi: os cartões aparecem na conversa dela"*.
  - *assumida, a confirmar:* "um clique" vira clique + Enter (mesma sessão) ou clique + clique no cartão (outra sessão). O limite é do app (causa 4), não do kit.
- **D3 — onde aparece o botão.** Em todo item vivo que espera um papel: (a) na seção **Na fila** (sem dona), o papel sai da etapa — `planejamento` → P, `design` → D, `execucao` → E, `validacao` → V; `merge` e `homologacao` não têm botão (são da orquestradora); (b) em **Executando**, o item com `esperando` e `entregue: false` (o chip do F58), papel = `esperando.papel`. Item com `espera` (operador/gate) ou `trava` não tem botão. Um botão "pedir para todos" no título da seção **Na fila** (conta os itens com botão nela, de todos os projetos) — *assumida, a confirmar:* só a Na fila, porque é o que o operador pediu e o Executando já tem a cobrança do F58.
- **D4 — "todos" agrupa por projeto:** um pedido por orquestradora, listando todos os itens dela (uma mensagem ou um preenchimento só). Projeto sem orquestradora ativa não recebe pedido; o pane diz quais ficaram de fora.
- **D5 — achar a orquestradora:** documento em `sessoes` com `papel: "orquestradora"`, `estado` ≠ `concluida`, `projeto` igual ao do item (comparação em minúsculas: a fila tem `izanagi`, o título pode ter `Izanagi`), **e** presente nas vivas do app (não arquivada) — o mesmo filtro do `pedirResumo`. Duas ou mais: não envia; aviso *"Há N orquestradoras ativas de <projeto>; peça na conversa da certa"* (CLAUDE.md: título repetido não identifica). Nenhuma: o botão do item não aparece e no lugar fica o texto "sem orquestradora ativa" (D decide o lugar).
- **D6 — estado visível do pedido** (regra do repo: ação assíncrona tem estado no lugar onde se agiu). Em memória do mod, por item: `enviando` → `pedido às HH:MM` (enviado ou no campo) → some quando o item ganha alguém do papel (dono, `com` ou `esperando` nulo) ou depois de 30 min, quando o botão volta. Falha: o botão volta e o motivo vai para os avisos do pane (como `responder`). *assumida, a confirmar:* não se grava nada na fila (sem mudar esquema nem disputar versão com a dona).
- **D7 — o texto do pedido** (uma função pura, `textoDoPedidoDeVaga(projeto, itens, agora)`): *"Pedido do operador pelo painel (HH:MM): abra ou despache a sessão de cada item que espera papel em <projeto> — F68 · <título> (espera E); F63 · <título> (espera P). Num turno do operador, abra o membro do papel (ou despache a um livre); fora dele, proponha um cartão `<ID> · livre` por vaga. Skill orquestradora, âncora vaga-pelo-painel."* Cada `F<n>` seguido de ` · ` (regra de texto do painel).
- **D8 — o botão complementa a cobrança do F58, não a substitui.** A cobrança continua para quando o operador não olha o pane; o botão é o gatilho quando ele olha. E a causa 1 se conserta aqui: **planejamento passa a esperar P** (Parte B).

## Parte A — o pane (plugin `painel-sessoes`)
Tela: passa pela **D** antes da E. Briefing da D: revisão em `docs/design/revisoes/` cobrindo o botão por item (rótulo, onde fica na linha da fila e no cartão do Executando, os três estados de D6), o "pedir para todos" no título da Na fila, o "sem orquestradora ativa" e o toast. Rótulos sugeridos (a D decide): `Pedir sessão` · `Pedindo…` · `Pedido às 10:42`; `Pedir para todos (5)`. Texto de UI não cita F58, protocolo nem skill.

Arquivos: `plugins/painel-sessoes/hooks/register.tsx` (botões, handler, estado), `plugins/painel-sessoes/hooks/desenho.ts` (só se a D mexer no SVG da linha), `plugins/painel-sessoes/tests/painel.test.tsx`, `plugins/painel-sessoes/.claude-plugin/plugin.json` (versão 0.6.6). **Não mexer em `hooks/barra.tsx`** (F65 está nele).

Passos (teste antes do código, `superpowers:test-driven-development`):
1. Funções puras exportadas e testadas: `papelQueFalta(item)` (D3; tabela com as 6 etapas, `espera`, `trava`, `entregue`), `orquestradoraDoProjeto(projeto, sessoesDocs, vivas)` → `{id} | {nenhuma} | {varias: n}` (D5; caso `Izanagi` × `izanagi`), `textoDoPedidoDeVaga` (D7; afirma cada `F<n> · `).
2. Testes do gesto (no estilo dos F59 B14–B16, `abrirDe` com `host`): (i) pane na orquestradora do projeto → `$.prompt.fill` uma vez, nenhum `send_message`, nenhum `prompt.submit`; (ii) campo com rascunho → `mode: 'append'`; (iii) pane em outra sessão → um `send_message` com o `session_id` da orquestradora e depois `open_session_in` com foco; (iv) "todos" com itens de dois projetos → um pedido por orquestradora; (v) projeto sem orquestradora → sem botão e o texto no lugar; (vi) duas orquestradoras → nada enviado, aviso; (vii) `send_message` com erro → botão volta, aviso com o motivo; (viii) segundo clique durante o envio é ignorado; (ix) item que ganha o papel na releitura perde o "Pedido às"; (x) item em `merge` não tem botão. Teste que mede ausência prova antes que a presença seria detectada (convenção do repo).
3. Código em `register.tsx`, reusando `abrirSessao` (foco/cópia) e o padrão de `pedirResumo` (achar orquestradora, `send_message` vs. prompt da própria). `vercel-react-best-practices`: estado do pedido num `state` do mod como `enviando`/`abrindo`, sem recriar handler por item a cada render além do que o pane já faz.
4. `claude plugin test plugins/painel-sessoes` verde; `claude plugin validate plugins/painel-sessoes --strict`.
5. `processos:auditoria-de-clique` nos dois botões (clique → `fill`/`send_message` → estado → releitura).

## Parte B — planejamento espera P (plugin `orquestracao`)
Arquivos: `plugins/orquestracao/hooks/esperando-papel.mjs`, `plugins/painel-sessoes/hooks/esperando.ts` (a cópia), `plugins/orquestracao/hooks/tests/esperando-papel.casos.mjs` (+ os testes que a leem), `plugins/orquestracao/pool/protocolo.md` (âncora `esperando-papel`), `plugins/orquestracao/hooks/orquestradora-ritual.mjs` só se o texto da cobrança precisar do P.
1. Casos novos primeiro: item em `planejamento` sem dono e sem P no `com` → `{papel: 'P'}`; com P dona ou P no `com` → `null`; com `espera`/`trava` → `null`. O `esperando-concorda.test.mjs` tem de pegar as duas cópias.
2. `PAPEL_DA_ETAPA` ganha `planejamento: 'P'` nas duas cópias; o tipo `Esperando['papel']` ganha `'P'`.
3. Ritual: item esperando P sem P livre → pede a vaga (mesma frase do F58). Conferir que `membrosLivres` já aceita `P\d+ · livre` (o regex do F58 é `^[PDEV]\d+ · livre$`).
4. `fila-do-item.mjs`: confirmar com teste que item em planejamento sem dona não cobra ninguém (não há dona) e que a dona P não é cobrada por si mesma.
5. Protocolo: a lista de etapas da âncora `esperando-papel` passa a incluir planejamento (P); o teste `esperando-papel-doc.test.mjs` acompanha.
6. `npm test` verde; `claude plugin validate plugins/orquestracao --strict`; versão 0.1.34.

## Parte C — a orquestradora atende o pedido (doc)
`plugins/orquestracao/skills/orquestradora/SKILL.md` e `plugins/orquestracao/pool/protocolo.md`: nova âncora `<a id="vaga-pelo-painel"></a>`: ao receber "Pedido do operador pelo painel…": turno `human` (o operador apertou Enter) → abre o membro de cada papel sem livre (ou despacha a um livre), com o ritual de membro novo de sempre (`aplicar-skills-do-papel.mjs`, título, `painel com add`); turno `peer`/`plugin` → um cartão `own_initiative` por vaga, título `<ID> · livre`, e retira com `dismiss_task` o que um membro livre resolver antes. Modo ausente ligado: não pede vaga (regra existente) e responde ao pane por mensagem curta dizendo isso. Uma linha no protocolo, âncora `fila-do-pool`, apontando para ela.

## Critério de pronto
- Gate `npm test` verde e `claude plugin test plugins/painel-sessoes` verde, com os testes da Parte A (2.i–x) e da Parte B escritos antes e vistos falhar pelo motivo certo.
- Ao vivo, depois do release (a V roteiriza, o operador clica): (1) pane na orquestradora do kit com um item do kit na fila → clique → o pedido aparece no campo; Enter → a sessão do papel abre; (2) item do Izanagi → clique → a orquestradora do Izanagi recebe e propõe o cartão; (3) "pedir para todos" com os dois projetos → um pedido por orquestradora.
- **Medição extra no ao vivo (não bloqueia):** a V registra se um `$.tool.call` de `start_session` disparado do clique é aceito pelo app (uma sonda num build de teste, sessão descartável arquivada em seguida). Aceito → vira item novo "um clique abre direto", que depende do F70.

## Fora de escopo
- O pane abrir sessão sozinho (D1).
- Mostrar no pane os cartões propostos pela orquestradora.
- Acordar orquestradora parada sem clique (causa 2): fica para item próprio se o botão não bastar.
- `hooks/barra.tsx` (F65) e o script de skills do papel (F70).

## Regras do projeto para quem executa
Node ≥ 20, ESM, sem dependência npm; testes do pane em `.tsx` com `claude plugin test`; `process.exitCode`, nunca `process.exit()`; testes nunca tocam `~/.claude` real; commits conventional em PT-BR sem ADR no título; não mergear (orquestradora ativa).
