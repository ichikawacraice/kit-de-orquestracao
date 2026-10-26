# F45 — o painel reabre sozinho depois da limpeza (plano, P3, 2026-10-25)

Pedido do operador: "sempre que a orquestradora se limpa, o painel sobe e tenho que dar o comando novamente; conseguimos fazer abrir novamente sozinho?"

**Resposta curta:** dá, com uma memória do mod. A plataforma não reabre sozinha nem avisa o processo novo de que houve limpeza, mas o mod consegue lembrar "esta sessão do app tinha o painel aberto" e reabri-lo quando o processo novo sobe. Há um ponto que só a medição confirma (o app desktop desenhar um pane aberto sem pedido); por isso o passo 1 é medir antes de codar.

## A causa (medida)

1. **A limpeza do app mata o processo do CLI.** No log do desktop (`~/Library/Logs/Claude/main*.log`), a limpeza da sessão `local_838cdd0e…` em 2026-10-24 17:00:36:
   ```
   [info] Stopping session local_838cdd0e-…
   [info] Clearing session local_838cdd0e-…
   [info] [CCD] clearStaleResumeHandle session=local_838cdd0e-… reason=clearSession dropping cliSessionId=2fe2e07c-…
   [info] Session local_838cdd0e-… query iterator completed
   [info] [CCD] CLI process group 26489: nothing left
   ```
   e na limpeza seguinte (2026-10-25 17:41:55), a próxima mensagem sobe um processo novo:
   ```
   [info] [CCD] sendMessage on uninitialized session local_838cdd0e-…; cold-starting via startSession
   ```
   Ou seja: o `clear_session` do app **não** é o `/clear` dentro do processo (esse mantém o processo); é parar o processo e começar outro, sem retomar a conversa.
2. **O pane mora no processo.** `$.ui.panes()` é "o registro do engine" (tipos do engine 2.1.308, `ui.panes`); morto o processo, o pane vai junto. O processo novo carrega o mod do zero.
3. **O mod só reabre o que já está aberto.** `plugins/painel-sessoes/hooks/register.tsx:606`: no `session.start`, `if ((await $.ui.panes()).some(p => p.id === PANE)) ligar($)` — liga a leitura se o pane já existe, nunca abre. No processo novo a lista vem vazia, então nada acontece.
4. **Nenhum evento diz "houve limpeza" ao processo novo.** O `session.end` com `reason: 'clear'` é do `/clear` em processo (tipos: "the process goes on under a new session id, and no `session.start` fires for it"); aqui o processo velho só morre. O processo novo é uma partida comum.

## O que a plataforma oferece (lido nos tipos e no `reference.md` da skill `plugin-authoring`, engine 2.1.308)

- `$.store` (`get/set/delete/keys`): JSON do plugin em disco, **atravessa sessões e processos**.
- `$.env.get("CLAUDE_CODE_HOST_SESSION_ID")`: o app desktop passa ao processo o id da sessão do app (`local_…`). Nesta sessão: `CLAUDE_CODE_HOST_SESSION_ID=local_5bc7bb60-…`, o mesmo id que o painel registra para a P3 em `fila/F45.com`. O nome sugere que é o id do app, estável na limpeza (o `cliSessionId` é que muda) — **a medir no passo 1**.
- `$.ui.open` sem pedido da pessoa: "Asked (…) it is placed at any width; unasked, from 144 columns, 110 for one once asked. Below that it waits undrawn (`isPlaced` false)". E no `reference.md`: "a plugin opens a pane unasked only where it would be a sidebar". No desktop o pane é `dock` (sidebar), mas se o desktop aplica a regra das colunas a um pane não pedido **não está escrito** — **a medir no passo 1**.
- `ui.close` traz `origin`: `plugin` (o próprio `/painel` fechando), `person` (o X ou a tecla da pessoa), `unload` (descarga do mod). É por ele que se distingue "o operador fechou" de "o processo foi embora".
- Testes: `mock.store(on, entradas)` e `mock.env(on, variaveis)` existem no `claude-code/testing`.

## Alternativas

| | Como | Prós | Contras |
|---|---|---|---|
| **A (recomendada)** | O mod grava em `$.store` "a sessão do app `local_X` está com o painel aberto" ao abrir, apaga quando o operador fecha; no `session.start`, se a sessão do app está marcada e o pane não está aberto, abre. | Só o mod muda; vale para qualquer sessão onde o operador usa o painel, não só a orquestradora; também devolve o painel depois de reiniciar o app. | Depende das duas medições abaixo; o pane volta quando o processo novo sobe (na primeira mensagem depois da limpeza), não no instante da limpeza. |
| B | A skill `orquestradora` manda, no primeiro turno depois da limpeza, chamar a tool `onde_esta_o_painel` (que abre o pane). | Não mexe no mod. | Gasta um passo da orquestradora a cada limpeza; só serve à orquestradora; a tool também é um open "não pedido pela pessoa" e cai na mesma regra de colunas. |
| C | Pedir ao app desktop que guarde os panes de mod na limpeza. | O certo a longo prazo. | Fora do nosso alcance; não resolve agora. |

**Recomendação: A**, com B como contorno só se a medição 1b der `isPlaced: false`.

## Plano para a executora (A)

### Arquivos
- `plugins/painel-sessoes/hooks/register.tsx` — a memória e a reabertura.
- `plugins/painel-sessoes/tests/painel.test.tsx` — os testes novos.
- `plugins/painel-sessoes/.claude-plugin/plugin.json` — versão `0.3.0` → `0.4.0` (o cache do plugin renova).
- `.claude-plugin/marketplace.json` — a versão do `painel-sessoes`, se ela aparece lá (conferir; manter as duas iguais).

### Passos

1. **Medir antes de codar** (sem commit; registre a saída real no PR):
   - **1a. O id do app sobrevive à limpeza?** Numa sessão de teste aberta pela própria E (`start_session`, sem worktree, só para isso): `echo $CLAUDE_CODE_HOST_SESSION_ID` antes; `clear_session` nela; mande uma mensagem; `echo` de novo. Pronto se o valor for igual nas duas e igual ao `local_…` da sessão. Se mudar: **pare** e devolva à P3 (a chave da memória teria de ser outra).
   - **1b. O desktop desenha um pane aberto sem pedido?** Mod de sonda em `~/.claude/dev-mods/<sessão>/sonda-pane/` (skill `plugin-authoring`): no `session.start`, `const r = await $.ui.open({ id: 'sonda', title: 'Sonda', columns: 60 })` e grava `r` com `$.store.set('r', r)`; desenha um `Text` qualquer. Ligue os mods, mande uma mensagem para o processo recarregar, e leia o `isPlaced`/`reason` (a sonda pode também `$.ui.toast(JSON.stringify(r))`). Pronto se `isPlaced: true` com o pane visível na janela. Se `false`: **pare** e devolva à P3 com o `reason` real (vira a alternativa B). Apague a sonda depois.
2. **Testes vermelhos primeiro** em `painel.test.tsx` (com `mock.env(on, { CLAUDE_CODE_HOST_SESSION_ID: 'local_a' })` e `mock.store(on, …)`):
   - (t1) `/painel` abrindo grava a marca da sessão `local_a` no store; o teste afirma antes que o store estava sem ela.
   - (t2) `session.start` com o store marcando `local_a` e nenhum pane aberto → o pane `painel-sessoes` passa a constar em `$.ui.panes()` e a leitura liga (a contagem de leituras sobe depois de avançar o relógio — mesma técnica do teste "sem o pane aberto a sessão não lê nada").
   - (t3) `session.start` com o store marcando **outra** sessão (`local_b`) → nenhum pane, nenhuma leitura. Prova antes, no mesmo teste ou no t2, que a marca de `local_a` abriria (teste de ausência prova a presença).
   - (t4) `/painel` fechando apaga a marca; `ui.close` com `origin: 'person'` apaga a marca; `ui.close` com `origin: 'unload'` **não** apaga.
   - (t5) Sem `CLAUDE_CODE_HOST_SESSION_ID` (CLI no terminal): `/painel` funciona como hoje e o store não ganha nada.
   - (t6) Marca com mais de 7 dias é ignorada e removida no `session.start` (o relógio do teste decide a idade).
   - Rode `claude plugin test plugins/painel-sessoes` e cole a falha de cada um pelo motivo certo (falta a marca, falta o pane — não erro de import).
3. **Código** em `register.tsx`:
   - Uma chave só no store, `'abertos'`: objeto `{ [localId]: isoDaAbertura }`. Funções puras exportadas para teste se ajudar (`marcar`, `desmarcar`, `vencidas`), no estilo das outras (`lerOpcoes`, `secoes`).
   - `hostId = await $.env.get('CLAUDE_CODE_HOST_SESSION_ID')` (string literal: o validate exige). Sem valor → o mod não grava nem reabre.
   - `command.run` abrindo: depois do `$.ui.open`, marca. Fechando: desmarca.
   - `ui.close`: se `e.id === PANE` e `e.origin !== 'unload'`, desmarca (o `plugin` já foi desmarcado pelo comando; repetir é inofensivo). Mantém o `parar()` de hoje e o `return next(e)`.
   - `session.start`: depois do registro do comando e da tool, se o pane já está aberto → `ligar($)` (como hoje); senão, se `hostId` está marcado e a marca tem até 7 dias → `const r = await $.ui.open({ id: PANE, title: TITULO, columns: 60 })`, `ligar($)`, e se `!r.isPlaced` registre com `$.ui.log` o `reason`. Remova as marcas vencidas no mesmo gesto.
   - Falha do store (`get`/`set` rejeitando) nunca derruba o `session.start` nem o `/painel`: `try/catch` com `$.ui.log`.
   - Comentário curto no topo da função dizendo por quê (a limpeza do app mata o processo; F45).
4. `claude plugin test plugins/painel-sessoes` verde (todos, não só os novos); `claude plugin validate plugins/painel-sessoes --strict` sem erro; `claude plugin validate .`; `npm test` da raiz verde.
5. Versão para `0.4.0` no `plugin.json` (e no `marketplace.json`, se listado).
6. **Conferir no app** (é o critério do operador): com o plugin atualizado na sessão de teste do passo 1 — `/painel`, `clear_session`, uma mensagem → o pane volta sem comando. Depois `/painel` (fecha), `clear_session`, uma mensagem → o pane **não** volta. Registre os dois resultados no PR (print ou a saída de `onde_esta_o_painel` não serve para o segundo, porque ela abre o pane: use `$.ui.panes()` por uma sonda ou o print).
7. Commit `feat(painel): o painel volta sozinho depois que a sessão se limpa`, PR com a medição do passo 1 e do passo 6 coladas; número do PR à orquestradora. Não mergeie.

### Critério de pronto (medível)
- Passo 1: os dois valores do `CLAUDE_CODE_HOST_SESSION_ID` iguais e `isPlaced: true` da sonda, colados no PR.
- `claude plugin test plugins/painel-sessoes`: t1–t6 verdes e os testes antigos verdes; a falha vermelha de cada teste novo colada no PR.
- `claude plugin validate plugins/painel-sessoes --strict` e `npm test` sem erro, saída colada.
- Passo 6: o pane volta depois da limpeza com o painel aberto, e não volta depois da limpeza com o painel fechado.

### Fora de escopo
- O pane voltar **no instante** da limpeza: o processo novo só sobe na mensagem seguinte; isso é do app.
- Reabrir panes de outros mods; mudar o desenho do pane (nada de D1: a tela não muda).
- Mexer na skill `orquestradora` ou nos hooks do plugin `orquestracao` (alternativa B só se o passo 1b falhar, e aí volta para a P3 replanejar).
- Pedir mudança ao app desktop (alternativa C): registrar como feedback é do operador.

### Regras do projeto que tocam esta fatia
- Node ≥ 20, ESM, sem dependência npm; os testes do mod são `.tsx` e rodam por `claude plugin test`, não pelo `node --test` da raiz.
- Teste antes do código; teste de ausência prova a presença (t3); teste que lê valor afirma que ele existe (t1).
- Testes nunca tocam `~/.claude` real: o store e o env são os `mock` do kit.
- O plugin é a cópia viva (paridade com `~/.claude` não é mais exigida): conserto só no plugin.
- Commit conventional em PT-BR; com orquestradora ativa, PR e número para ela, sem merge.
- React do mod: hooks e componentes como já estão; não há componente novo (regras de `vercel-react-best-practices` não se aplicam ao que muda).

## Decisões assumidas, a confirmar
- **A1 — vale para toda sessão em que o operador abre o painel, não só a orquestradora.** Se o operador abriu o painel numa sessão de execução e ela se limpa, o painel volta nela também. Motivo: é a mesma vontade ("deixei aberto, quero aberto"), e restringir à orquestradora exigiria o mod saber o título da sessão. Fechar com `/painel` desliga.
- **A2 — a marca vence em 7 dias.** Sessão do app que ficou uma semana sem abrir não reabre o painel sozinha.
- **A3 — também reabre depois de reiniciar o app** (o processo novo é igual ao da limpeza). Se o operador não quiser isso, o mod teria de distinguir limpeza de reinício, o que hoje não tem sinal.
