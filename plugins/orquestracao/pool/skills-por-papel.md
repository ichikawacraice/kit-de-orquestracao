# Skills por papel — pool de sessões (2026-10-24, F6)

Pedido do operador (24/10): *"cada sessão só precisa conhecer as próprias skills… se tiver uma skill de boas práticas de React, quem deve ler e quem não? se tivermos uma skill de design, quem deve ler e quem não?"*

**Cada membro lê o arquivo do SEU papel** em [`papeis/`](papeis/): o papel, as skills que usa e quando, e as que não lê. Esta página é o mapa geral. **Fonte única do filtro:** [`skills-por-papel.json`](skills-por-papel.json). Esta página explica o porquê; quem aplica e quem confere leem o JSON. Skill de plugin do kit (`processos:*`, `design:*`) entra no JSON com o nome prefixado; o teste `plugins/orquestracao/hooks/tests/papeis-citam-o-que-existe.test.mjs` reprova papel que cita skill que não existe em `plugins/*/skills/` nem no JSON. Skill nova instalada sem linha no JSON reprova o teste `plugins/orquestracao/hooks/tests/skills-do-papel.test.mjs`.

<a id="como-funciona"></a>
## Como a sessão passa a conhecer só as suas

- **O Claude Code já filtra a lista por pasta.** A chave `skillOverrides` do `settings.local.json` aceita, por skill: `on`, `name-only` (aparece só o nome, sem a descrição), `user-invocable-only` (some para o modelo; o operador ainda usa `/nome`) e `off` (some para os dois). [código, medido no binário em 2026-10-24]
- **Cada membro do pool tem o seu worktree**, e o `settings.local.json` é por worktree (ignorado pelo git). Logo, gravar ali a coluna do papel faz a lista que a sessão recebe ser a do papel. Quem grava é `node "${CLAUDE_PLUGIN_ROOT}/pool/aplicar-skills-do-papel.mjs" <local_…>`; a orquestradora roda ao abrir membro novo (E3, V2, P4…).
- **Skill de plugin não é filtrável uma a uma** (o código devolve `on` para `source === "plugin"`). Plugin inteiro é: a chave `enabledPlugins` do mesmo arquivo liga ou desliga por worktree (tabela "Plugins"). As skills de plugin que ficam ligadas (superpowers, hookify) são vigiadas pelo hook `${CLAUDE_PLUGIN_ROOT}/hooks/skill-do-papel.mjs`: carregar uma marcada `não lê` para o papel gera **aviso** no contexto, não recusa.
- **Só a orquestradora roda no checkout principal**, e ali nada é filtrado; todo membro do pool tem worktree próprio (V1 inclusive). O hook avisa em todos.
- **A lista nova não alcança a sessão já aberta.** [medido pela V2, 2026-10-24] Arquivo aplicado às 12:16; a lista que a V2 recebeu às ~12:23, reentregue depois de compactar, ainda era a antiga. Compactar não recarrega. Não está medido se a limpeza de contexto recarrega, nem se uma sessão nova recebe a lista filtrada [hipótese: recebe, porque lê o `settings.local.json` ao abrir]. Até lá, o arquivo do papel (`papeis/<papel>.md`) e o hook são o que vale para a sessão aberta.
- **Só a conta atual (operador, 24/10).** O `--todos` lê só `claude-code-sessions/<conta-atual.txt>`: sessões da conta antiga ficam no disco, intocadas, e fora da lista (daqui não se manda trabalho a elas). Mudou de conta? Troque `conta-atual.txt` pela pasta onde está o `local_…` da orquestradora nova; sem o arquivo, o script recusa (exit 2).
- **Antes de dar item a membro, `--conferir`.** Sessões `· livre` não arquivadas da conta atual têm worktree próprio e recebem a aplicação; se uma for reaproveitada com outro papel, o arquivo fica com a coluna velha. `node "${CLAUDE_PLUGIN_ROOT}/pool/aplicar-skills-do-papel.mjs" --todos --conferir` mostra `diferente`.

| Valor | No JSON | `skillOverrides` | Quer dizer |
|---|---|---|---|
| **lê** | `le` | `on` | aplica a skill no próprio trabalho |
| **cita** | `cita` | `name-only` | sabe que existe e qual regra dela toca o trabalho; carrega só para citar a regra no briefing ou no laudo |
| **não lê** | `nao` | `user-invocable-only` | não é trabalho do papel; o operador ainda chama com `/nome` |
| **desligada** | `desligada` | `off` | desligada para todos por decisão anterior do operador; não se relitiga aqui |

Papéis: **O** orquestradora · **P** planejadora · **D** design · **E** executora · **V** validadora.

<a id="as-duas-perguntas"></a>
## As duas perguntas do operador

- **Boas práticas de React** (`vercel-react-best-practices`, `vercel-composition-patterns`): **E lê** (escreve o componente), **V lê** (confere o diff contra elas), **P cita** (põe no briefing a regra que toca a tarefa, sem aplicar), **D e O não leem**. Hoje as duas estão desligadas no projeto; ligá-las para E e V é *assumida, a confirmar*.
- **Design** (`design:revisao-de-arquitetura-de-ui`, `design:critica-de-ui`, `frontend-design`, `impeccable`): **só D lê.** **P cita** a revisão de arquitetura (para saber que o item passa pela D antes da E). **E e V não leem**: leem a **revisão aprovada** em `docs/design/revisoes/`, que já traduziu a skill para aquela tela. Ler a skill daria à E licença para redesenhar o que a D decidiu.

<a id="tabela"></a>
## Tabela

| Skill | O | P | D | E | V | Por quê |
|---|---|---|---|---|---|---|
| handoff-de-sessao | lê | lê | lê | lê | lê | todo item passa de mão com handoff |
| orquestradora | lê | cita | cita | cita | cita | só a O opera; os outros consultam a seção de perguntas e painel |
| ausente | lê | não | não | não | não | liga e desliga o modo ausente; só a O opera (`/ausente on|off`) |
| papeis-e-modelos | lê | lê | cita | cita | cita | quem despacha precisa; quem recebe só consulta |
| orquestrar-com-subagentes | cita | não | não | não | não | no pool cada papel é sessão; o modo não se aplica |
| notas-de-release, manage-skills | lê | não | não | não | não | release e biblioteca de skills são da O |
| skill-creator | não | lê | não | não | não | skill nova é doc, e doc é da planejadora |
| processos:spec-driven | cita | lê | cita | lê | lê | P escreve spec/ADR; E fecha roadmap e diário; V confere doc |
| superpowers:brainstorming, writing-plans, writing-skills | não | lê | brainstorming: lê | não | não | desenho e plano |
| superpowers:executing-plans, finishing-a-development-branch | não | não | não | lê | não | cumprir plano e fechar branch |
| superpowers:test-driven-development | não | cita | não | lê | cita | E escreve teste primeiro; P e V cobram |
| superpowers:systematic-debugging | não | lê | não | lê | lê | P investiga causa; E e V depuram o que tocam |
| superpowers:verification-before-completion | lê | não | não | lê | lê | ninguém diz "pronto" sem medir |
| superpowers:receiving-code-review | não | lê | lê | lê | não | quem recebe achado da V |
| superpowers:dispatching-parallel-agents | não | não | não | não | lê | só a V divide em subagentes de leitura |
| superpowers:requesting-code-review, subagent-driven-development, using-git-worktrees | não | não | não | não | não | no pool a revisão é da V, a execução é sessão, o worktree é fixo |
| superpowers:using-superpowers, diagnosing-superpowers | lê | lê | lê | lê | lê | meta |
| design:revisao-de-arquitetura-de-ui | não | cita | lê | não | não | ver "As duas perguntas" |
| design:critica-de-ui, frontend-design, impeccable | não | não | lê | não | não | idem; a crítica roda no subagente da D |
| processos:auditoria-de-clique | não | cita | cita | lê | lê | E audita o gesto que mexeu; V confere; P e D preveem no plano |
| vercel-react-best-practices, vercel-composition-patterns | não | cita | não | lê | lê | ver "As duas perguntas" |
| supabase | não | cita | não | lê | lê | E escreve migration e RLS; V confere |
| owasp-security | não | cita | não | lê | lê | E aplica ao escrever auth e entrada; V confere |
| processos:revisar-diff | cita | não | não | não | lê | a revisão do diff é da V; a O sabe que existe antes do merge |
| security-audit, audit-context-building, differential-review, sharp-edges, variant-analysis, supply-chain-risk-auditor, claude-security | não | cita | não | não | lê | auditoria é validação; P só a planeja |
| fp-check, semgrep, static-analysis | não | não | não | não | lê | ferramentas da auditoria |
| agent-browser | não | não | lê | lê | lê | ver a tela: D olha, E testa, V confere o artefato |
| hookify:writing-rules | não | cita | não | lê | não | E escreve a regra que a P desenhou |
| web-artifacts-builder-2 | não | não | não | não | não | fora do trabalho do pool |
| find-skills, grill-me, web-artifacts-builder, supabase-postgres-best-practices, shadcn, tailwind-design-system, ui-ux-pro-max, web-design-guidelines, webapp-testing, github-actions-docs | desl. | desl. | desl. | desl. | desl. | já desligadas pelo operador (global ou no projeto) |

<a id="plugins"></a>
## Plugins (liga e desliga por worktree)

| Plugin | O | P | D | E | V | Por quê |
|---|---|---|---|---|---|---|
| processos | sim | sim | sim | sim | sim | spec-driven, revisar-diff e auditoria-de-clique: cada papel os consulta conforme a tabela acima |
| design | não | não | sim | sim | não | a D escreve a revisão e roda o crítico; a E fica ligada porque o `Stop` que cobra a crítica da tela roda em quem edita a tela (a skill de design na E segue vigiada pelo hook: aviso, não recusa) |
| impeccable | sim | não | sim | não | não | design é da D |
| document-skills | sim | não | não | não | não | docx/pptx/xlsx e cópias de frontend-design e webapp-testing; nada disso é trabalho do pool |
| claude-security, insecure-defaults | sim | sim | não | não | sim | auditoria: V executa, P planeja |

A coluna O vale só quando a orquestradora tiver worktree próprio; hoje o checkout principal não é filtrado.

<a id="fora"></a>
## Fora deste mapa

- Skills embutidas do Claude Code (`code-review`, `simplify`, `run`, `claude-api`, `schedule`, `loop`…) e as da conta claude.ai (`anthropic-skills:*`) ficam ligadas; o hook só registra `fora-do-mapa` quando são carregadas.
- As descrições das skills de terceiros não se editam (o `skills-manager` sobrescreve na atualização). As nossas (`orquestradora`, `papeis-e-modelos`, `handoff-de-sessao`, `notas-de-release`, `orquestrar-com-subagentes`) não foram reescritas: com a lista filtrada por worktree, a descrição deixa de ser o que decide quem carrega.
