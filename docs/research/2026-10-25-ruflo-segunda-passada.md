# Ruflo, segunda passada: ideias para o nosso sistema

- **Data:** 2026-10-25 (snapshot; não editar — pesquisa envelhece)
- **Autor:** P3 (planejadora, Opus 5.5), item F33, a pedido da orquestradora do Izanagi depois da Q229 (ficamos com o nosso sistema)
- **Irmão de:** [2026-10-25-ruflo.md](2026-10-25-ruflo.md) — mesmo clone, HEAD `264b34647`. Prefixo `r/` = raiz do repositório clonado.
- **Método:** só leitura. Nada do ruflo foi instalado, executado ou conectado. As lacunas da seção 8 do estudo irmão li eu; os 108 agentes, os 168 comandos e os plugins de custo, memória e statusline foram inventariados por três exploradores (Haiku), e as linhas que sustentam cada ideia abaixo eu reabri.
- **Filtro:** ficou de fora o que pede API key (ADR 0017 do Izanagi), subagente que escreve e `npx …@latest`.
- **Decisões abertas:** Q231–Q237 (seção 4).

## 1. Resposta curta

Sete ideias valem, todas pequenas e todas no kit. As três de mais peso são: **um hook que mede o contexto da própria sessão** e aplica a regra de limpeza por papel, que hoje só existe escrita; **a validadora derrubar os próprios achados** antes de devolvê-los; e **conferir se a executora mexeu no teste que a julga**. O resto do que a seção 8 deixou aberto (roteamento de modelo, Agent Booster, `workflow_*`, policy-runtime, init) não serve para nós, pelo motivo na seção 3.

## 2. As lacunas da seção 8, medidas

| Lacuna | O que o código faz | Onde | Serve? |
|---|---|---|---|
| **Roteamento de modelo (3 tiers)** | Nota de complexidade por **palavra-chave do texto do pedido**: "bug", "issue", "error", "maybe", "investigate" sobem a incerteza 0,2 cada; "implement", "multiple files" sobem o escopo. Um bandit Thompson aprende com recompensa que **favorece o barato**: sucesso vale 1,0 no Haiku, 0,7 no Sonnet, 0,4 no Opus | `r/v3/@claude-flow/cli/src/ruvector/model-router.ts:321-325`, `:868-876`, `:957-966`, `:976-984` | Não. Contraria "qualidade antes da economia" e escolhe o modelo pelo vocabulário, não pelo papel. O nosso modelo sai do papel (skill `papeis-e-modelos`) |
| **Agent Booster ("Tier 1", $0)** | Regex sobre o pedido detecta 6 intents (`var-to-const`, `add-types`, `remove-console`…) e aplica um codemod sem LLM | `ruvector/enhanced-model-router.ts:32-40`, `:107-180`, `:385-428`; anúncio em `mcp-tools/hooks-tools.ts:1305` | Não. Só existe como tool MCP do ruflo, e as nossas tasks não são desse tamanho |
| **`plugins/ruflo-workflows`** | Duas superfícies: as 10 tools `workflow_*` (máquina de estado persistida) e scripts nativos `.claude/workflows/*.js` do Claude Code. O hook só recusa segredo na definição e `delete` sem id único | `r/plugins/ruflo-workflows/README.md:116-123`, `hooks/guard.ts:13-39`, `docs/adrs/0002-native-workflow-orchestration.md` | A parte nativa já usamos (`revisao-do-diff.js`). O que vale é a auditoria do GAIA (ideia 3) |
| **`loop-workers`** | Mod em processo, sem rede: recusa despacho de worker com segredo no contexto e põe teto de 100 despachos por sessão (*"a loop that keeps dispatching is probably stuck"*) | `r/plugins/ruflo-loop-workers/hooks/guard.ts:18-27`, `hooks/options.ts:16-19`, `hooks/register.ts:88-104` | A varredura de segredo, sim (ideia 4). O teto, ver seção 3 |
| **`policy-runtime`** | Motor de política com livro de recibos encadeado, trava com dono (pid, host, boot id, nonce) e recuperação de dono morto, e **aprovação humana consumível**: `issuedBy ≠ principal`, `maxUses`, `expiresAt` | `r/v3/@claude-flow/cli/src/services/policy-runtime.ts:197-245`, `:857-921`; `r/v3/@claude-flow/security/src/policy/engine.ts:118-132`, `types.ts:132-134` | A aprovação consumível, sim (ideia 6). O livro de recibos é grande demais para dois operadores |
| **`init` completo** | Grava `allow` para `npx claude-flow*`, `.mcp.json`, CLAUDE.md e statusline (já no irmão). Novo: um **scanner de risco** dos hooks e `allow` que já existiam no `settings.json` (padrões `curl … | sh`, `base64 -d`, `/dev/tcp/`), só consultivo | `r/v3/@claude-flow/cli/src/init/settings-risk-scanner.ts:1-30`, `:92-135`; re-hash de helpers instalados em `init/helper-integrity.ts:1-17` | Baixo. Encosta no `kit doutor`/`adotar` (seção 3) |

## 3. Agentes, comandos e plugins

**Agentes (108 + 9 do plugin `ruflo-agent`).** A maior parte é frontmatter de duas linhas (`name`, `description`), sem `model` e sem lista de ferramentas proibidas; há duplicatas por caminho e números sem medição (`r/.claude/agents/v3/v3-integration-architect.md:90`, *"150x-12,500x faster"*). Três padrões têm forma útil, todos no plugin:
- **Achar e depois derrubar, um filho por achado, em contexto novo** (`r/plugins/ruflo-agent/agents/nested-reviewer.md:15-31`): o filho recebe só o achado e o arquivo, e *"Default to refuted=true if uncertain"* (`:25`). Variante com lentes diferentes e voto (`:43-59`). → ideia 2.
- **Retorno fixo da folha** (`nested-leaf.md:18-31`): `status: success | partial | failed`, `evidence: file:line or command:output`, 150–300 tokens, *"not a transcript"*. → ideia 7.
- **Folha sem a ferramenta de lançar agente** (`nested-leaf.md:12`, `:33-39`). Já temos: `explorador` e `validador` declaram `tools:` sem `Agent` (`plugins/orquestracao/agents/explorador.md:7`, `validador.md:7`). Duplica; descartado.

**Comandos (168 + 11 dos plugins).** São embrulhos de `npx claude-flow@alpha` (126 arquivos com `npx`, 33 com `@alpha`, 7 com `@latest`), e quatro documentam subcomandos que o CLI não tem: `verify rollback|dashboard|check` (`r/.claude/commands/verify/start.md:20-26` contra `cli/src/commands/verify.ts`), `sparc` e `truth` sem `sparc.ts`/`truth.ts`, `pair` declarado legado (`cli/src/commands/pair.ts:5`). Os gates de fase do SPARC (`r/plugins/ruflo-sparc/commands/ruflo-sparc.md:32-36`) são conferidos pelo próprio modelo. A única ideia de fora do GAIA que sobra é a auditoria de *reward hacking* (`gaia-validate.md:77`, `gaia-submit.md:46`). → ideia 3.

**Custo (`ruflo-cost-tracker`).** O leitor não precisa do ruflo: lê os JSONL de `~/.claude/projects`, deduplica por `message.id + requestId` (`r/plugins/ruflo-cost-tracker/scripts/_ledger.mjs:11-12`, `:18-25`) e separa a escrita de cache de 5 min da de 1 h. O que vale é o **conselheiro** (`scripts/advise.mjs:20-71`): cache lido abaixo de 80% (`:33`), escrita de 1 h que não se paga com duas leituras (`:38-43`), subagente em modelo de topo com o *what-if* um nível abaixo (`:46-57`), sessão de 30+ turnos que relê mais de 400 mil tokens por turno (`:64-68`). A persistência é por `npx @claude-flow/cli@latest memory store` (`scripts/track.mjs:92-119`) e fica de fora. → ideia 5.

**Memória (`ruflo-agentdb`, `ruflo-rag-memory`).** A recuperação injeta no prompt no máximo 5 itens, 400 caracteres cada, 1.500 no total, com nota mínima **medida** de 0,25 (`r/plugins/ruflo-agentdb/hooks/recall.ts:18-26`), e trata o que volta como não confiável: item com segredo ou frase de injeção é descartado e contado (`recall.ts:100-104`). Não há deduplicação nem validade (grep por `dedup|expir|ttl` vazio nos `hooks/*.ts`). Não serve para nós como memória vetorial; a **varredura do que é lido de volta** entra na ideia 4.

**Statusline.** Lê do stdin do Claude Code `context_window.used_percentage`, `cost.total_cost_usd` e `model.display_name` (`r/.claude/helpers/statusline.cjs:865-883`). Não medi se o app desktop mostra statusline (o nosso `settings.json` não tem `statusLine`). O dado que importa, o tamanho do contexto, um hook de Stop lê do transcript. → ideia 1.

**Observabilidade (`ruflo-observability`).** Não mede nada sozinho: *"does not write spans or metric records there automatically"* (`r/plugins/ruflo-observability/README.md:51`). Descartado.

## 4. As ideias, priorizadas

Custo em **itens de E** (1 item ≈ um bloco de executora com teste e PR no kit).

| # | Q | Ideia | De onde | Defeito ou custo nosso que ataca | Onde entra | Custo | Duplica? |
|---|---|---|---|---|---|---|---|
| 1 | **Q231** | **Hook que mede o contexto da sessão por papel.** No `Stop`, lê o `usage` da última resposta no `transcript_path` (input + cache lido + cache escrito) e aplica a tabela "Por papel" da `papeis-e-modelos`: planejadora/orquestradora ≥ 200 mil → aviso "limpe no próximo momento oportuno"; ≥ 300 mil → recusa pegar item novo; executora ≥ 150 mil → recusa o fim do turno sem "commitei até X, parei em Y". Registra no `hooks-crewai.log` | `statusline.cjs:868-872` (o dado), `advise.mjs:64-68` (o limiar de "contexto inchado") | Cota semanal em 82%; E2 imprestável por contexto longo. Hoje a regra existe só em texto: nenhum hook do kit lê `usage` (grep por `usage`/`tokens` em `~/.claude/hooks/*.mjs` vazio) | hook `contexto-do-papel.mjs` no kit + linha na skill | 1 | Não. O `livre-se-limpa` limpa quem **ficou livre**; este cobre quem está trabalhando. Encosta no F32 (mesmo `Stop`): combinar a ordem dos hooks com a E2 |
| 2 | **Q232** | **A validadora derruba os próprios achados médios e altos antes de devolver.** Um subagente `orquestracao:validador` (só lê) por achado, com só o achado e o arquivo; o que ele refuta com evidência sai, o que fica incerto volta marcado "não confirmado" e não abre rodada sozinho | `nested-reviewer.md:15-31` | Rodadas de conserto por achado que não se sustentava: a fatia 6 do F1 teve 7 consertos e 5 laudos (notas `F1-fatia-6-*`) | `agents/validador.md` + `pool/protocolo.md` (texto) | 0,5 | Em parte: o `revisao-do-diff.js:272-286` do Izanagi já põe um cético nos bloqueantes, mas só no workflow de revisão, não na sessão V. Reusar o prompt dele, que exige evidência para refutar (o oposto do *default* do ruflo; manter o nosso) |
| 3 | **Q233** | **Conferir se a executora mexeu no juiz.** O validador confere, antes de tudo, se o diff altera o teste ou o arquivo citado no critério de pronto, se afrouxou asserção (`skip`, `.only`, número trocado) e se o relatório traz texto dirigido a quem valida. O `executor-criterio` passa a anotar no log quando o turno editou arquivo de teste | `r/plugins/ruflo-workflows/scripts/gaia-audit.mjs:13-47` (AUD-4 *grader isolation*, AUD-10 *judge injection*); `gaia-validate.md:77` | Limite declarado da trava: *"um `exit=0` de qualquer comando do turno vale como status"* (skill `papeis-e-modelos`, "A trava do executor"). Hoje nada olha se o critério foi mudado para passar | `agents/validador.md` (lista) + `hooks/executor-criterio.mjs` (anotação) | 0,5–1 | Não |
| 4 | **Q234** | **Varredura de segredo no que sai para outra sessão** (SendMessage, notas compartilhadas, handoff, `painel set/update`) e **de frase de injeção no que volta** (o que o `sessao-inicio`/`fila-do-item` injetam do painel e das notas). Recusa dizendo o NOME do padrão, nunca o valor | `loop-workers/hooks/guard.ts:18-27`; regras em `hooks/screen.ts:10-39` (15 formas de segredo, 6 de injeção, caracteres invisíveis em `:41-53`, entropia em `:55-80`) | Regra 7 do Izanagi ("segredos jamais em arquivos") sem trava nenhuma: grep por `ghp_`, `PRIVATE KEY`, `AKIA`, `sk-ant` nos hooks e no kit vazio. Texto de outra sessão é dado, mas entra sem filtro | hook `PreToolUse` no kit + função em `pool-comum.mjs` | 1 | Não. Portar as regex (MIT) com teste, nunca depender do pacote |
| 5 | **Q235** | **Conselheiro de cota no medidor de uso.** Acrescentar ao `medir_tokens.py` as quatro regras do `advise`: cache lido < 80%, escrita de 1 h que não se paga, subagente em Opus com o *what-if* em Sonnet, sessão com > 400 mil lidos por turno — por papel (título `exec ·`, `valida ·`, P/E/V/D) | `advise.mjs:20-71`; dedupe em `_ledger.mjs:18-25` | Cota em 82% decidida por palpite: hoje o medidor dá totais, não diz qual alavanca mexer | `~/.claude/uso-do-claude/scripts/medir_tokens.py` (ou o `kit doutor`) | 0,5–1 | Em parte: o `medir_tokens.py` já lê os mesmos JSONL e deduplica por `message.id` (`:24`, `:45-46`); faltam as regras |
| 6 | **Q236** | **Aprovação do operador consumível.** Ação que exige o operador (release, migration em produção, job que gasta cota) só passa com um Q-ID respondido **pelo operador** no painel e ainda não usado; a resposta grava `usadoEm`. Quem pede não pode aprovar (`issuedBy ≠ principal`) | `security/src/policy/engine.ts:118-132`, `types.ts:132-134` | "O ok da orquestradora não vale como o meu" (CLAUDE.md global) é só texto; a memória `orquestracao-de-sessoes-quem-mergeia` registra o caso | guarda de operação + coleção `perguntas` do painel | 2 | Não |
| 7 | **Q237** | **Retorno fixo do explorador:** `status: achado | parcial | nada`, `evidência: arquivo:linha`, teto de 300 tokens, sem transcrição | `nested-leaf.md:18-31` | Contexto da planejadora: relatório de explorador volta em prosa longa (os desta passada vieram com 900–1.000 palavras, porque o teto do briefing pedia) | `agents/explorador.md` | 0,2 | Em parte: a skill já manda o briefing trazer o teto da resposta |

**Ficaram abaixo da linha, sem pergunta:**
- **Teto de abertura de sessão por turno** (`loop-workers/hooks/guard.ts:24-26`): o pool já recusa `start_session` de membro (`papel-do-pool.mjs` T3a/T3b); só a orquestradora abre, e sem caso medido de laço.
- **Scanner de risco no `adotar`/`doutor` do kit** (`settings-risk-scanner.ts:92-135`): o kit é instalado por nós em projetos nossos; volta à pauta se o kit for usado por terceiros.
- **Trava com dono e recuperação de dono morto** (`policy-runtime.ts:197-245`): o painel já recusa escrita concorrente por versão (`set --se-versao`); não medi a trava do gate do Izanagi (ADR 0328) contra dono morto.
- **Dieta do contexto fixo** (o `advise.mjs:68` recomenda tirar texto de fluxo do CLAUDE.md para skills): medido hoje, CLAUDE.md global 7,3 KB + Izanagi 31,3 KB + `MEMORY.md` 16,1 KB = 54,8 KB relidos em toda sessão. É texto que o operador cura; fica como dado para a Q235.

## 5. Descartado, e por quê

- **Roteamento por palavra-chave e bandit que premia o barato** (`model-router.ts:321-325`, `:957-966`): contraria "qualidade antes da economia".
- **Agent Booster / codemod** (`enhanced-model-router.ts:32-40`): tool MCP do ruflo, para edições triviais de JS.
- **`workflow_*` persistido e aprovação dentro dele**: o estado com dono já é o painel; e a superfície nativa (`Workflow`) já usamos.
- **Livro de recibos do policy-runtime** (`policy-runtime.ts:56-66`): resolve auditoria entre máquinas, não os nossos defeitos.
- **Comandos `.md`**: embrulhos de `npx claude-flow@alpha|@latest`; quatro prometem subcomandos que não existem (seção 3).
- **Persistência do cost-tracker** (`track.mjs:92-119`): `npx @claude-flow/cli@latest`.
- **Memória vetorial e statusline do ruflo**: já descartados no irmão; aqui só o filtro de leitura (ideia 4) e o dado de contexto (ideia 1) sobrevivem.
- **Agentes com `model:` fixo de folha em Haiku** (`nested-leaf.md:4`): o nosso papel já define o modelo.

## 6. Lacunas declaradas

- Não li `REFERENCE.md`, `bench/` e os scripts `anomaly`/`burn`/`projection` do cost-tracker, nem `tools.ts`/`expand.ts`/`fold.ts` do agentdb.
- A classificação "só imprime × executa" dos 179 comandos foi por amostra; as contagens de `npx` são de grep.
- Não medi se o app desktop mostra statusline, nem se o Claude Code honra `{"permission":"allow"}` de PreToolUse (lacuna herdada do irmão).
- O custo em itens de E é estimativa de planejadora, sem plano escrito; cada Q aprovada vira plano antes de ir à E.
