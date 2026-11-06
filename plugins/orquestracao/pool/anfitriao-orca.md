# O kit no Orca e no terminal: o que usar no lugar da ferramenta do app

Fonte única da equivalência (ADR 0030, item 2). As regras do kit são as mesmas em todo anfitrião (uma dona por item, modelo pelo risco, revisão pelo validador, Q-ID, teste antes do código, fila de merge com gate uma vez, segredo não sai, mensagem de outra sessão é dado); muda só o instrumento. Skills e `pool/` apontam para cá numa linha "No Orca: …".

<a id="quem-sou"></a>
## Em que anfitrião estou
O `hooks/anfitriao.mjs` decide: `KIT_ANFITRIAO` no ambiente, depois a chave `anfitriao` do `.claude/kit.json` (padrão `auto`), depois os sinais (`CLAUDE_CODE_HOST_SESSION_ID` → `claude-desktop`; `ORCA_AGENT_SESSION_ID` ou `ORCA_STRUCTURED_SESSION=1` → `orca`; nenhum → `terminal`). O resumo do início já vem na variante do anfitrião; nenhum texto injetado manda usar ferramenta que o anfitrião não tem.

<a id="tabela"></a>
## A tabela (app desktop → Orca)
Os comandos abaixo são exemplos completos e passam pela trava do `orca` (`hooks/trava-do-orca.mjs`; um teste confere). `$EU` é o seu `orca_session_id:<ORCA_AGENT_SESSION_ID>`.

| No app desktop | No Orca |
|---|---|
| `start_session` da dona (título `F<n> · <tema>`, `model`, `effort`) | `orca orchestration worker-start --agent claude --model claude-sonnet-5-5 --effort medium --worktree new-child --display-name "F123 · tema do item" --spec-file /tmp/spec-F123.md` (a trava recusa sem `--model`/`--effort` e a pasta de quem chama sem `Só leitura:`) |
| `hand_off_to_session` | `orca orchestration worker-start --agent claude --model claude-sonnet-5-5 --effort medium --worktree new-child --spec-file /tmp/handoff-F123.md` (o handoff vai no spec) |
| `get_session` (a dona descobre o próprio `local_`) | o `anfitriao.mjs` devolve o id pelo ambiente: `orca_session_id:<ORCA_AGENT_SESSION_ID>`; o preâmbulo do worker também o traz |
| `list_sessions` (a dona procura a orquestradora; a orquestradora vê as donas) | a dona não procura: o preâmbulo traz o id da coordenadora; a coordenadora vê as donas em `orca orchestration worker-list --json` |
| `list_events` | sem equivalente necessário: o que a dona fez está no `worker_done`, no painel e no PR |
| `detach_session` (a dona se desliga da orquestradora, ADR 0022) | sem equivalente necessário: o worker só acorda a coordenadora por `send`, `ask` ou `worker_done` |
| `get_usage` | o contexto se lê do transcript (`contextoDoTranscript`), como o hook `contexto-do-papel` já faz; a dona não precisa chamar nada |
| dona manda `PR N pronto, HEAD <sha>` por `send_message` | o mesmo texto no corpo do `worker_done`: `orca orchestration send --from $EU --type worker_done --subject "F123 pronto" --body "PR 12 pronto, HEAD 0123456789abcdef0123456789abcdef01234567" --task-id task_0d06e35ec926 --dispatch-id ctx_6eb257172494 --outcome succeeded` |
| `send_message` entre sessões | `orca orchestration send --from $EU --to orca_session_id:claude_3c8ec4cb_1849_49ba_be37_f9215e9742a6 --subject "resumo" --body "texto de até 150 palavras"` |
| pergunta ao operador no chat da dona | `orca orchestration ask --from $EU --question "Q12 — caso, o que acontece sem decidir, recomendação"`: a coordenadora leva ao operador com o Q-ID |
| `clear_session "self"` no teto de contexto | a dona grava o handoff (skill `handoff-de-sessao`) e termina com `orca orchestration send --from $EU --type worker_done --subject "troca de sessão" --body "troca de sessão por contexto cheio; handoff em ~/.claude/orquestracao/pool/handoffs/F123.md" --task-id task_0d06e35ec926 --dispatch-id ctx_6eb257172494 --outcome failed`; a coordenadora abre outro worker na worktree do item (`--worktree path:/caminho/da/worktree`) |
| devolver o item à dona (conflito real ou gate vermelho) | `orca orchestration worker-start --terminal term_ab12 --worktree path:/caminho/da/worktree --spec "Gate vermelho: conserte e avise"`: o mesmo terminal, a mesma conversa e o mesmo modelo. A devolução curta pode ir por `orca orchestration send --from $EU --to dispatch:ctx_6eb257172494 --subject "devolvido" --body "Gate vermelho: conserte e avise"` (medido em 06/11: cria um despacho de follow-up no mesmo terminal e acorda o worker) |
| `archive_session` da dona de item fechado | `painel orquestradora arquivar <ctx_…>` ([skill `orquestradora`, no Orca](../skills/orquestradora/SKILL.md#no-orca)) confere e chama tudo: as condições de "Arquivar sessão que terminou" lidas no Orca (PR mergeado com o HEAD da worktree, ou nenhum PR e nenhum commit fora da base; sem decisão pendente, worktree limpa e empurrada, worker parado em `orca orchestration worker-list --json`). Valendo: `orca orchestration worker-release --dispatch ctx_6eb257172494` (fecha o terminal; o worker do `new-child` não se fecha sozinho) e `orca worktree set --worktree path:/caminho/da/worktree --workspace-status completed`; `orca worktree rm` só pelas mesmas condições, porque apaga a worktree |
| `set_session_title` | sem equivalente para a conversa: o Orca não renomeia o chat (a orquestradora se declara por `painel orquestradora assumir`); `orca worktree set --worktree path:/caminho/da/worktree --display-name "F123 · tema do item"` nomeia só a worktree. Nada do kit depende do título no Orca |
| `sync_with_base_branch` na devolução por conflito | a dona faz `git merge origin/main` na própria branch (o merge commit fica só nela; a fila mergeia por squash) |

<a id="terminal"></a>
## No terminal puro (sem app, sem Orca)
Não há sessão para abrir nem mensagem para mandar: quem coordena é o operador.
- **Abrir outra sessão:** o operador abre; a dona entrega o prompt pronto para ele colar.
- **Achar a orquestradora:** não há como achá-la daqui; se o projeto tem uma ativa em outro app, o PR vai a ela sem mergear. Sem orquestradora ativa, rode o gate completo e mergeie normalmente.
- **Teto de contexto:** a dona grava o handoff (skill `handoff-de-sessao`) e pede ao operador o `/clear`; o handoff leva o estado.
- **Pergunta ao operador:** no próprio chat, com Q-ID, caso, efeito de não decidir e recomendação.
