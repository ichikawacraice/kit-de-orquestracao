# Plano · cada sessão cuida do próprio item, e a orquestradora só lê

Planejadora: P3 · 2026-10-26. Branch: `claude/f122-cada-sessao-cuida-do-proprio-item` (a partir de `origin/main` f37aeb8). Decisão: ADR 0006 (número a confirmar pela orquestradora). Origem: Q388, respondida pelo operador com "outra".

<a id="medido"></a>
## Medido (26/10, ~20:12)
- **Processos vivos.** `list_sessions` deu 36 sessões não arquivadas; `ps` deu 10 processos `claude --output-format stream-json` (mais os 10 `disclaimer` que os embrulham). As 10 com processo são exatamente as 10 de `lastActivityAt` mais recente (a mais antiga, E3 do kit, 19:13:48); a 11ª (P8 do Izanagi, 19:11:10) já não tinha. Conclusão: o app guarda processo só para as ~10 mais recentes. Sessão sem processo não roda hook nem mod; `send_message` a acorda (um processo de 55 s apareceu logo depois de uma mensagem).
- **O relógio do mod roda sem o pane.** `plugins/painel-sessoes/hooks/register.tsx` `iniciarBarra` (chamado no `session.start`) liga `$.clock.every(1000)` e `$.clock.every(LEITURA_MS = 30_000)`; o relógio do pane (`ligar`, 60 s) é que depende do pane aberto.
- **O que o mod alcança sem modelo** (tipos do motor 2.1.308, `claude-code.d.ts`): `$.tool.call` de qualquer ferramenta (o mod já chama `send_message`, `get_session`, `open_session_in`, `PushNotification`); `$.process.run(argv, {cwd, env, stdin, timeoutMs})` roda um comando do host sem shell (padrão 30 s); `$.fs` lê e grava. O `painel.mjs` fica em `<installPath de orquestracao@kit-de-orquestracao>/skills/orquestradora/scripts/painel.mjs`, com o `installPath` em `~/.claude/plugins/installed_plugins.json` (hoje `…/orquestracao/0.1.39`).
- **Origem do turno.** `send_message` chega como `peer`; `$.prompt.submit` como `plugin` (Izanagi, 23/10, plano `2026-10-26-abrir-sessao-pela-fila.md` item 4). Nenhum dos dois abre sessão (`start_session` recusado pelo app) nem arquiva (T2 do `papel-do-pool`).
- **Itens vencidos agora** (`painel list fila vencidos --projeto izanagi`): F111, F92, F96 (planejamento, dona P8, parada desde 19:11) e F83 (merge, dona P7, desde 15:38). F83 é o caso da Q388: a dona ficou com o item na etapa `merge`, que é da orquestradora.
- **Livres por papel.** `membrosLivres` (lê `claude-code-sessions/`) deu no Izanagi V 3, D 2, E 3, com **D1 contado duas vezes**, e no kit E2 e P1 duas vezes; o `list_sessions` mostra títulos diferentes para P1 e V1 (já não `livre`). O registro em disco guarda cópias velhas: para contar livres, a fonte boa é o `list_sessions`, que o mod tem e o script não.
- **Marcadores de orquestradora:** 15 arquivos em `~/.claude/orquestracao/ativas/`, para 3 orquestradoras não arquivadas.
- **Custo de tarefa agendada com modelo:** piso de ~90 mil tokens por rodada (medido pela orquestradora); a cada 10 min, ~13 milhões por dia.

<a id="decisoes"></a>
## Decisões (ADR 0006)
1. **Quem grava o quê.**

   | O que | Hoje | Passa a |
   |---|---|---|
   | `agora`/`etapa` do item | dona, a cada turno (`fila-do-item`) | igual |
   | soltar para a etapa seguinte + mensagem ao livre do próximo papel | dona (protocolo) | igual; `painel livres <papel>` ajuda a achar o livre |
   | estado mecânico das linhas de `sessoes` (ritual 1) | orquestradora | ninguém: o pane lê `list_sessions` |
   | soltar item parado (ritual 2b) | orquestradora | batida (`painel batida`) |
   | despachar item com membro livre (ritual 3) | orquestradora | batida avisa; o livre roda `painel pegar` |
   | pedir vaga, piso de E | orquestradora | orquestradora, a partir do relatório da batida |
   | arquivar | orquestradora | orquestradora, a partir de `excedentes` da batida |
   | `batch` obrigatório (ritual 4) | orquestradora | sai |
   | merge, release, números | orquestradora | igual; a batida a avisa do `merge` parado |
2. **Despacho por puxar:** `painel pegar F<n>` atômico; aviso por `send_message` (quem soltou, ou a batida).
3. **Batida:** no mod, com vez em arquivo, a cada 10 min; o julgamento é do script `painel batida`.
4. **Teto:** dois livres por papel por projeto fora do modo ausente (E conta o piso de um). *Assumida, a confirmar* (Q394).

Assumidas gravadas como pergunta `estado:"assumida"`: **Q392** (a batida roda no mod, não em tarefa agendada), **Q393** (cutuca uma vez e solta 20 min depois), **Q394** (teto de dois livres por papel).

<a id="partes"></a>
## Partes
Ordem: A → B → C → D. A e B podem sair no mesmo PR; C e D dependem de A.

### A · `painel batida`, `painel pegar`, `painel livres` (script, `plugins/orquestracao/skills/orquestradora/scripts/painel.mjs`)
Teste antes do código, em `plugins/orquestracao/hooks/tests/painel-batida.test.mjs` (novo), no molde de `painel-fila.test.mjs` (HOME, `PAINEL_DIR`, `HOOKS_CREWAI_BASE`/`BASE` e `POOL_APP_SESSOES_DIR` em temporário; processo filho síncrono, `timeout`, `killSignal:'SIGKILL'`).

1. **`painel livres <P|D|E|V> --sessoes <arquivo> [--projeto <nome>]`** → `[{localId, apelido}]`: linhas do `list_sessions` (o arquivo, JSON) com título `^<papel>\d+ · livre$`, `isArchived` falso, `isRunning` falso, do projeto (projeto pelo `cwd` da linha, mesmo cálculo de `projetoDaSessao`), fora de todo `com` e de todo dono de item vivo; mais antigo parado primeiro. Sem `--sessoes`, cai para `membrosLivres` e deduplica por `localId`.
2. **`painel pegar <F> <local_…> <apelido>`** (sob a trava do painel, como `com add`): recusa (exit 1, JSON `{recusado, motivo}`) se o item não existe, está em etapa final ou em `merge`, ou não está esperando o papel do apelido (`esperandoPapel`; na `validacao` também recusa se `entregue`). Senão: na `planejamento` e na `design` grava `donoLocalId`/`donoApelido` (se o item não tem dono) e põe a sessão no `com`; na `execucao` e na `validacao` só `com add`. Grava `agora: "<apelido> começou"`. Devolve `{pegou, item, titulo, etapa, handoff}`.
3. **`painel batida --sessoes <arquivo> [--seco] [--agora <ISO>]`** (sob a trava do painel). Lê fila, `perguntas`, a bandeira do modo ausente e o próprio estado `BASE/batida/estado.json` (`{cutucadas: {F: {em, localId}}, avisos: {F: {em, localId}}, ultima}`). Para cada item vivo do projeto de cada linha:
   - **Vencido** = sem `espera`/`trava`, `atualizadoEm` há `PAINEL_PRAZO_MIN` (30) min ou mais, etapa fora de `merge`, e nenhuma sessão do dono+`com` com `isRunning`.
     - dono+`com` todos ausentes da lista ou arquivados → `soltar` (motivo: *"a sessão do item foi arquivada ou sumiu"*).
     - sem cutucada, ou cutucada mais velha que o último `atualizadoEm` → **cutucar** o dono (sem dono, o primeiro do `com`): mensagem *"<F> · <título> está parado há N min e é seu: siga, grave o `agora` ou solte com `painel soltar <F> \"<motivo>\"`."*; grava a cutucada.
     - cutucada há `BATIDA_SOLTA_MIN` (20) min ou mais, sem gravação depois dela → `soltar` (motivo: *"ninguém gravou há N min e a dona não respondeu ao aviso"*).
   - **Em `merge`** parado há 30 min → entra em `merge` do relatório do projeto.
   - **Esperando papel** (`esperandoPapel`, ≥ `ESPERA_MIN` = 5 min): `entregue` → cutuca a dona para avançar a etapa (uma vez por entrega); senão, papel V e máquina cheia (mesma função do ritual, ADR 0005) → grava `espera {motivo:"gate", texto:"máquina cheia"}` e não avisa; senão, com livre do papel (item 1, sem repetir membro na mesma batida, sem reavisar o mesmo par em 30 min) → **avisar o livre**: *"<F> · <título> para você: rode `painel pegar <F> <seu local_…> <seu apelido>`, troque o título (`<ID> · <o quê>`) e leia o handoff do item."*; sem livre → entra em `vagas`.
   - **Piso de E** (ADR 0004, fora do modo ausente): sem E livre no projeto → `vagas` recebe `{papel:"E", piso:true}`.
   - **Excedentes** (fora do modo ausente): livres além de 2 por papel (Q394) → `excedentes`, mais antigos primeiro; nunca a última E livre.
   - **Marcadores:** apaga `BASE/ativas/<id>` cujo `registroDaSessao` está arquivado ou ausente, ou cujo transcript tem mtime de 7 dias ou mais; nunca o de sessão com `isRunning`.
   - Saída (stdout, JSON): `{mensagens:[{para, texto, item, tipo}], soltos:[F], projetos:{<nome>:{orquestradora, merge:[F], vagas:[…], excedentes:[…]}}, marcadoresApagados:[…]}`. Para cada projeto com orquestradora viva (título `🎛 orquestradora — <projeto>` na lista, não arquivada) e algo em `merge`/`vagas`/`excedentes` diferente do último relatório, uma mensagem a ela: *"Batida HH:MM: merge parado: …; vaga: …; livres além do teto: …. Relatório: <caminho>."*. Grava `BASE/batida/<projeto>.json` com o mesmo conteúdo e `em`. `--seco` não grava nada e não solta.
4. Casos de teste mínimos (cada um prova a presença antes da ausência): vencido sem cutucada → uma mensagem e estado gravado; segunda batida em 5 min → nenhuma mensagem; 20 min depois sem gravação → solto; dona gravou depois da cutucada → nada; alguém do `com` com `isRunning` → nada; dono arquivado → solto direto; item em `merge` → nada à dona e entra em `merge`; esperando E com dois livres → um aviso ao mais antigo; esperando V com máquina cheia → `espera` gravada, nenhum aviso; sem livre → `vagas`; `entregue` → cutuca a dona; 4 E livres → 2 em `excedentes`; modo ausente → `excedentes` e piso vazios; marcador de sessão arquivada → apagado, de sessão viva → mantido; `--seco` → nenhum arquivo muda (compare mtime/version); duas batidas simultâneas (molde `painel-trava-concorrencia.mjs`) → mensagens não se repetem; `pegar` corrida com dois livres → um pega, o outro recebe `recusado`.

### B · o relógio da batida no mod (`plugins/painel-sessoes/hooks/register.tsx`, novo `hooks/batida.ts`)
Teste antes do código em `plugins/painel-sessoes/tests/batida.test.tsx` (rodado por `claude plugin test plugins/painel-sessoes`), com o motor falso que os testes do mod já usam.

1. Em `iniciarBarra`, mais um `$.clock.every(60_000, () => void batida($))`, cancelado como os outros. `BATIDA=off` (env) desliga; `BATIDA_MIN` (padrão 10) troca o intervalo.
2. `batida($)`: lê `~/.claude/orquestracao/batida/vez.json` (`{localId, em}`). Se `em` é mais novo que `BATIDA_MIN`, sai. Senão grava `{localId: <get_session self>, em: agora}`, espera 2 s (`$.clock.sleep`), relê; se a vez não é mais dela, sai. Sem processo concorrente nenhum, a primeira sessão a rodar depois de uma noite parada faz a batida na hora.
3. `list_sessions` (`limit: 200`) + `get_session self` (o `list_sessions` exclui a própria) → arquivo temporário em `~/.claude/orquestracao/batida/sessoes.json`.
4. Caminho do script: `installed_plugins.json` → a entrada `orquestracao@…` de escopo `user` → `installPath`; ausente → `$.ui.log` "batida sem o plugin orquestracao" e sai. `$.process.run(['node', <painel.mjs>, 'batida', '--sessoes', <arquivo>], {timeoutMs: 60_000})`.
5. Para cada mensagem: `$.tool.call({tool:'mcp__ccd_session_mgmt__send_message', session_id: para, message: texto})`; a falha (`deny`, `isError`, exceção) vai a `$.ui.log` e a `batida/falhas.jsonl` (`{em, para, item, motivo}`), sem desfazer o que o script gravou. O script grava o aviso ao devolvê-lo; o que não chegou volta a sair quando vencer o prazo de reaviso (30 min). Sem laço de confirmação de entrega (*assumida, a confirmar*, junto da Q392).
6. Nada de toast nem de turno: a batida não chama `$.prompt.submit` e não mexe no estado do pane.
7. Testes: vez nova → roda e grava a vez; vez de 3 min de outra sessão → não roda; duas instâncias que gravam ao mesmo tempo → só a que relê a si mesma roda; script devolve 2 mensagens → 2 `send_message` com `session_id` certo; `send_message` com erro → linha em `falhas.jsonl` e nenhuma exceção; plugin ausente → nada roda, log; `BATIDA=off` → nenhum `list_sessions` (prove antes que com ele ligado há chamada).

### C · o ritual encolhe (`skills/orquestradora/SKILL.md`, `hooks/orquestradora-ritual.mjs`, `pool/papeis/orquestradora.md`, `pool/protocolo.md`)
1. **SKILL.md, "Ritual de cada turno":** reescrever os passos como:
   1. ler `~/.claude/orquestracao/batida/<projeto>.json` (e, quando precisar decidir arquivar ou mergear, `list_sessions`);
   2. `merge`: os PRs validados que chegaram e os itens que a batida diz parados em `merge`;
   3. `vagas`: pedir a vaga (turno do operador: abrir; fora dele: cartão; modo ausente: nada); o piso de E (ADR 0004) e a máquina cheia (ADR 0005) seguem;
   4. `excedentes` e membro sem item vivo: arquivar (cinco condições, T2).
   Sair do texto: estado mecânico das linhas e `set` da sessão sem linha (passo 1), o 2b inteiro (vira "a batida solta"), o despacho com livre do passo 3 (vira "a batida avisa o livre; o livre pega"), o passo 4 (`batch`). A limpeza de membro livre com conversa (passo 3) **fica** com ela: só quem abriu limpa. "Item com dono ocioso há mais de 1 h → mensagem" (seção Fila do pool) sai: é a cutucada da batida.
2. **`orquestradora-ritual.mjs`:** tirar a exigência de `list_sessions` e de gravação no painel; a `cobrancaDeEspera` deixa de cobrar despacho quando há livre do papel (a batida avisa) e continua cobrando a vaga quando não há; acrescentar: se `batida/<projeto>.json` não existe ou tem `em` de mais de 30 min, a orquestradora ganha uma linha *"a batida não roda há N min: confira se o mod painel-sessoes está ligado"* (bloqueia uma vez, `stop_hook_active`). Ajustar `orquestradora-ritual.test.mjs`: os casos que provavam a cobrança de `list_sessions`/gravação viram casos que provam que ela **não** existe mais (com a presença provada antes: a versão anterior bloqueava), e os de espera com livre deixam de bloquear.
3. **`painel-das-sessoes.mjs`:** trocar `projetoTemOrquestradora(...) !== true → return` por valer sempre que a sessão tem repositório git; a mensagem continua mandando gravar no item que é dela. Teste novo: sessão de projeto sem orquestradora que abriu PR e não gravou → bloqueia (antes não bloqueava).
4. **protocolo.md:** âncora nova `batida` (o que ela faz, os prazos, a vez, o relatório); em `fila-do-pool` o "Prazo e soltar (F32)" passa a dizer que quem solta o vencido é a batida; em "Pegar", o livre usa `painel pegar`; em `esperando-papel`, a trava (1) muda de "despachar" para "pedir vaga". `papeis/orquestradora.md`: o que faz e o que não faz, no mesmo sentido. `papeis/{planejadora,design,executora,validadora}.md`, seção "Para quem passa": receber `F<n> para você` → `painel pegar`.
5. Testes de doc que já comparam texto e código (`esperando-papel-doc`, `papeis-citam-o-que-existe`, `teto-de-nucleos-doc`) continuam verdes; acrescentar `batida-doc.test.mjs`: a âncora `batida` do protocolo cita `BATIDA_MIN`, `PAINEL_PRAZO_MIN`, `BATIDA_SOLTA_MIN` com os mesmos padrões do código.

### D · versão, índice e ADR
1. `plugins/orquestracao/.claude-plugin/plugin.json` e `plugins/painel-sessoes/.claude-plugin/plugin.json`: subir a versão de patch.
2. `docs/adr/README.md`: linha do 0006 (já neste PR); status muda para Aceito só quando o operador confirmar Q392–Q394.

<a id="pronto"></a>
## Critério de pronto (medível)
- `npm test` verde (gate) e `claude plugin test plugins/painel-sessoes` verde, com a saída colada no PR.
- `claude plugin validate .` e `claude plugin validate plugins/painel-sessoes --strict` sem erro.
- Ensaio com fixtura (sem tocar `~/.claude` real): `PAINEL_DIR=<tmp> painel batida --sessoes <fixtura com a P8 parada e três itens dela>` → 3 mensagens à P8; a mesma chamada com `--agora` 21 min depois → 3 itens soltos.
- Ensaio real, só leitura: `painel batida --seco --sessoes <list_sessions de agora>` no Izanagi, colado no PR, mostra F83 em `merge` e F111/F92/F96 como cutucada à P8 (ou o que for o estado do dia, explicado).
- No app, depois de instalar a versão: em até 11 min aparece `~/.claude/orquestracao/batida/vez.json` e `batida/izanagi.json` com `em` recente (a V confere; laudo com `ls -l` e o conteúdo).

<a id="fora-de-escopo"></a>
## Fora de escopo
- Arquivar pela batida, limpar sessão alheia pela batida, abrir sessão pela batida.
- Mudar o contrato dos campos da fila (o estado da batida mora em `batida/`, não no item).
- O pane mostrar o relatório da batida (item próprio, se o operador quiser: vai em `depois`).
- Reaproveitar `scripts/paridade.mjs` ou mexer em `~/.claude/settings.json`.
- Qualquer coisa no repositório Izanagi.

<a id="regras"></a>
## Regras do projeto (para a E)
- Node ≥ 20, ESM, só módulos nativos; `node --test` pelo gate (`npm test`) ou `node gate/com-fichas.mjs -- <comando>` (ADR 0005: `node --test` direto é recusado); fim por `process.exitCode`.
- Testes nunca tocam `~/.claude` real: `HOME`, `PAINEL_DIR`, `POOL_APP_SESSOES_DIR`, `HOOKS_CREWAI_BASE` em temporário. Processo filho síncrono com `timeout` e `killSignal:'SIGKILL'`. Teste que mede ausência prova antes a presença; insumo vazio não passa.
- Commits conventional em PT-BR, sem citar ADR no título (ex.: `feat(painel): a batida solta o item parado e avisa o membro livre`). PR com rebase em dia sobre `origin/main`; não mergeie: o número vai à orquestradora.
- Skills: `superpowers:test-driven-development` (teste antes), `plugin-authoring` para a parte B (tipos em `claude-code.d.ts`).

<a id="pegadinhas"></a>
## Pegadinhas
- `membrosLivres` conta cópias velhas do registro (D1 e E2 duas vezes): não use para o teto; use a lista do mod.
- A sessão que roda a batida não aparece no próprio `list_sessions`: some a ela pelo `get_session self`, senão a batida a acha "sumida" e solta o item dela.
- Mensagem `peer` pode ser segurada por sessão em outro modo de permissão; o `falhas.jsonl` mostra.
- O relógio do mod recomeça a cada recarga do plugin; a vez em arquivo é que segura o intervalo.
- `$.process.run` tem 30 s por padrão; o `painel batida` com 80+ itens precisa do `timeoutMs` maior (60 s) e deve ler a fila uma vez só.
