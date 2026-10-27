# F155 · O pegar e o com add gravam o id de quem despacha no lugar do membro

Dona: P6 (local_ca099d9c-5732-4c38-81bf-feadb9d60020). Etapa: execução. Repositório: kit-de-orquestracao, base `main`.
Relato original: orquestradora do Izanagi (local_a239424a), 26/10 23:05 SP.

## O caso, medido (26/10 23:10 SP)
- `painel.mjs` **não** troca o id: `comandoPegar` (painel.mjs:753) e `comandoCom` (painel.mjs:655) gravam o `localId` do argumento, sem olhar env nem transcript. Nenhum hook do kit reescreve o comando.
- Quem passou o id errado foram os próprios membros, digitando o id da orquestradora como "seu local_…" (transcripts do Izanagi, Bash literal):
  - E21 (`local_a51c3161…`, 01:06:38 UTC): `painel.mjs pegar F74 local_a239424a-… E21`
  - E18 (`local_0390f90d…`, 01:03:44 UTC): `painel com add F97 local_a239424a-… E18 "ajusta as pendências da spec"`
  - E23 (`local_66d9f60e…`, 01:17:22 UTC): `painel pegar F74 local_a239424a-… E23` — o `pegar` aceitou porque o item esperava E e o `com` tinha só o id "da E21" (que era o da orquestradora, já retirado pela P12 às 01:15). Daí as duas execuções (#1217 e #1223).
- Por que o membro errou: o briefing do despacho dizia `painel pegar F74 <seu local_id> E23` sem dar o id. A sessão aberta por outra não vê o próprio `local_…` no contexto; o único que aparece como "seu" é o da sessão que a abriu (bloco "session started from another session": `SendMessage` `to: local_a239424a…` e a pasta de notas `…/side-session-notes/local_a239424a…`). O id certo está na env `CLAUDE_CODE_HOST_SESSION_ID` (o hook `sessao-inicio.mjs` já a usa), mas nenhum doc do pool diz isso.
- Medida da própria P6: `painel pegar F155 local_ca099d9c… P6` gravou o id certo — mas aqui argumento e env coincidem, então a medida não distingue; o defeito só aparece com o id de outro no argumento.
- Conclusão: o script confia cegamente no argumento. Conserto em duas camadas: o script recusa id que não bate com quem ele diz ser, e o `pegar` deixa de precisar do id.

## Decisões (P6, *assumidas, a confirmar*; todas reversíveis)
- A1. `pegar` é sempre para a própria sessão. Com `CLAUDE_CODE_HOST_SESSION_ID` presente (ou `CLAUDE_CODE_SESSION_ID` resolvido no registro do app), o `<local_…>` do argumento tem de ser o dela; diferente → erro, exit 1, nada gravado.
- A2. `pegar <F> <apelido>` (sem id) passa a valer e usa o id da própria sessão; sem como saber o id → erro pedindo o `<local_…>`.
- A3. `com add` (e `pegar`) conferem o id contra o título no registro do app (`registroDaSessao(id, { fresco: true })`): título de orquestradora (`🎛 orquestradora — …`) → recusa; título de membro com apelido diferente do argumento (`E21 · …` com apelido `E18`) → recusa. Id fora do registro ou título sem apelido (sessão recém-aberta, antes do título) → passa, como a regra atual de "errar para o lado de não travar a escrita".
- A4. Docs: onde se lê "`<seu local_…>`" passa a dizer `painel pegar <F<n>> <seu apelido>` (o id sai sozinho) e que o próprio id está em `$CLAUDE_CODE_HOST_SESSION_ID`; o briefing de despacho da orquestradora e da planejadora leva o `local_…` do membro escrito por extenso, nunca "`<seu local_id>`".
- A5. A mensagem da batida (`batida.mjs:130`) já sai com o id certo (vem do `list_sessions`): fica como está.

## Plano para a executora (E, Sonnet)
Worktree próprio a partir de `origin/main`. Teste antes do código.

Arquivos:
- `plugins/orquestracao/skills/orquestradora/scripts/painel.mjs`
- `plugins/orquestracao/hooks/tests/painel-batida.test.mjs` (testes do `pegar`)
- `plugins/orquestracao/hooks/tests/painel-fila.test.mjs` (testes do `com add`)
- `plugins/orquestracao/pool/protocolo.md` (linha do **Pegar**, âncora `batida` se citar o comando), `plugins/orquestracao/pool/papeis/{planejadora,executora,validadora,design}.md` (linha "Ao receber `F<n> para você`"), `plugins/orquestracao/skills/orquestradora/SKILL.md` (passo 3 e o despacho no turno do operador)
- `docs/planos/2026-10-26-id-do-membro-no-pegar.md` (cópia deste plano, do título até "Fora de escopo")

Passos:
1. **Isolar os testes da env real.** Em `painel-batida.test.mjs`, `ambiente()` passa a pôr `CLAUDE_CODE_HOST_SESSION_ID: ''` (hoje herda o id da sessão que roda o teste, e com A1 todo `pegar` do teste seria recusado). Rode o arquivo: tudo verde antes de seguir.
2. **Testes vermelhos** (`painel-batida.test.mjs`, seção `pegar`), com registro de mentira em `appsess/` (`{sessionId, cliSessionId, title, cwd: repo, isArchived:false}`, como na linha 292):
   - V1 `pegar com o id de outra sessão é recusado e não grava`: registro lid(11) `E1 · livre` e lid(20) `🎛 orquestradora — kit`; item F1 esperando E (`item('F1', semGente)`). Primeiro prove a presença: com `CLAUDE_CODE_HOST_SESSION_ID: lid(11)`, `pegar F1 lid(11) E1` → exit 0 e o `com` tem lid(11) (em item separado, F2, para não sujar F1). Depois `pegar F1 lid(20) E1` com a mesma env → exit 1, stderr cita lid(20) e lid(11), o arquivo de F1 fica byte a byte igual.
   - V2 `pegar sem o id usa o da sessão`: `pegar F1 E1` com `CLAUDE_CODE_HOST_SESSION_ID: lid(11)` → exit 0, `com[0].localId === lid(11)`. Sem a env (`''`) e sem `CLAUDE_CODE_SESSION_ID` → exit 1, mensagem pede o `<local_…>`.
   - V3 `pegar com o id da sessão mas o apelido de outro é recusado` (A3): registro lid(11) `E1 · livre`, `pegar F1 lid(11) E2` sem env de host → exit 1 citando E1.
   Em `painel-fila.test.mjs`, perto dos testes `F30-1` (`comAdd`, linha 748), com `POOL_APP_SESSOES_DIR` apontando para uma pasta temporária de registro:
   - V4 `com add com o id da orquestradora é recusado`: registro lid(20) `🎛 orquestradora — kit` → `com add F1 lid(20) E18 "x"` exit 1, `com` do disco intacto.
   - V5 `com add com o apelido que não é o do título é recusado`: registro lid(11) `E21 · acabamento` → `com add F1 lid(11) E18 "x"` exit 1; o mesmo com `E21` → exit 0 (presença).
   - V6 `com add com id fora do registro ou título sem apelido passa`: lid(30) sem registro → exit 0; lid(31) com título `Nova sessão` → exit 0.
   Rode e cole a saída vermelha: V1–V5 têm de falhar **pela gravação aceita** (exit 0 onde se espera 1), não por erro de fixtura. V6 já passa (é a guarda do fail-open).
3. **Código em `painel.mjs`:**
   - Carregar `pool-comum.mjs` também para `pegar` e `com` (hoje `regras` só vem para `DA_BATIDA`, e `pool` só com `MEU_CLI`). Falha no import → aviso em stderr e sem conferência (a política atual).
   - `idDestaSessao()`: `process.env.CLAUDE_CODE_HOST_SESSION_ID` se casa `LOCAL_ID`; senão `registroDaSessao(MEU_CLI)?.localId`; senão `null`.
   - `conferirMembro(localId, apelido, onde)`: `reg = registroDaSessao(localId, { fresco: true })`; `null` → passa; título que começa com `🎛 orquestradora` → `throw` "`${onde}: ${localId} é a sessão "${titulo}", não um membro do pool; o id do membro sai do start_session (para si: \$CLAUDE_CODE_HOST_SESSION_ID)`"; `membroDoPool(titulo)` com `id !== apelido` → `throw` "`${onde}: ${localId} é a ${m.id} ("${titulo}"), não a ${apelido}`"; resto passa.
   - `comandoPegar`: aceita 2 ou 3 argumentos (`<F> [<local_…>] <apelido>`); sem id usa `idDestaSessao()` (null → erro). Com id e `idDestaSessao()` não nulo e diferente → `throw` citando os dois ids e dizendo "pegar é sempre para a própria sessão: `painel pegar <F> <apelido>`". Depois `conferirMembro(localId, apelido, 'pegar')`. Tudo **antes** de `comTrava` (erro = exit 1 pelo `catch` do fim, nunca `{recusado}`, que significa "outro pegou").
   - `comandoCom` `add`: `conferirMembro(localId, apelido, 'com add')` antes de `comTrava`. `del` fica como está.
   - Cabeçalho (linha 18): `painel.mjs pegar <F> [<local_>] <apelido>` e uma frase do que se confere.
4. **Docs (A4):** troque nas cinco linhas "Ao receber `F<n> para você`" e no **Pegar** do protocolo `painel pegar <F<n>> <seu local_…> <seu apelido>` por `painel pegar <F<n>> <seu apelido>` + "o id sai de `$CLAUDE_CODE_HOST_SESSION_ID`; o script recusa id de outra sessão". Na SKILL da orquestradora (passo 3) e na `planejadora.md` (linha do "plano pronto → E livre"): o briefing do despacho leva o `local_…` do membro por extenso; "`<seu local_id>`" no briefing é o defeito do F155. Rode `batida-doc.test.mjs`: o teste "os papéis citam painel pegar" tem de continuar verde.
5. **Gate:** `npm test` (= `node gate/com-fichas.mjs -- node --test`) verde; `claude plugin validate plugins/orquestracao --strict`.
6. Commits conventional em PT-BR (`test(painel): …` vermelho, `fix(painel): …`, `docs(pool): …`), PR contra `main` com rebase em dia, sem mergear. PR e HEAD de volta à P6.

## Critério de pronto (medível)
- Saída vermelha de V1–V5 colada antes do código, falhando por exit 0 onde se espera 1.
- Depois do código: `node gate/com-fichas.mjs -- node --test plugins/orquestracao/hooks/tests/painel-batida.test.mjs plugins/orquestracao/hooks/tests/painel-fila.test.mjs plugins/orquestracao/hooks/tests/batida-doc.test.mjs; echo "exit=$?"` com `exit=0`, e `npm test; echo "exit=$?"` com `exit=0` (últimas linhas coladas).
- `grep -rn "seu local_" plugins/orquestracao/pool plugins/orquestracao/skills/orquestradora/SKILL.md` não acha mais o `pegar` com `<seu local_…>` (pode sobrar em `com del`, que é a própria sessão e fica fora deste item — ver abaixo).

## Fora de escopo
- `com del <F> <local_…>` (o membro se retira e grava `fez`) continua pedindo o id: conferir o chamador ali é item próprio, se a V achar que precisa. O doc pode citar `$CLAUDE_CODE_HOST_SESSION_ID` para ele também, sem mudar código.
- Mudar a mensagem da batida.
- Mexer nos dados do Izanagi (abaixo, só descrito).
- Versão do plugin e release: da orquestradora.
