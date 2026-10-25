# F23 — kit de orquestração servindo a qualquer projeto (plano, P6, 24/10)

Tudo em `~/.claude/` (sem repositório, sem PR). **Nada no repositório Izanagi.** Nível de validação: **Robusta** (mexe nas travas de todas as sessões).

## O que foi medido (24/10, ~23h)

Linha de base da suíte de hooks (`for f in ~/.claude/hooks/tests/*.test.mjs; do node $f; done`): 7 verdes, **1 vermelho já antes**: `skills-do-papel.test.mjs` caso 8 — *"skills fora do mapa: ausente"* (a skill `/ausente` nasceu hoje e não entrou no `skills-por-papel.json`).

| # | Ponto levantado | Medido | Gravidade |
|---|---|---|---|
| 1 | IDs `E1 · …` sem projeto | `membroDoPool()` decide sempre pelo título da PRÓPRIA sessão, então T1/T1c/T3b/livre-se-limpa/executor-criterio/skill-do-papel **não colidem** entre projetos. Colisão real em 4 lugares: **(a)** T2 de `papel-do-pool.mjs` — a orquestradora de um projeto pode arquivar membro `· livre` de OUTRO projeto (a exceção não compara projeto); **(b)** a coleção `fila` não tem `projeto` (F9/F23 sem o campo) e `painel.mjs list fila` mistura projetos — a orquestradora de B despacharia item de A; **(c)** `sessoes.projeto` é escrito à mão (`"izanagi"`), sem validação, e é por ele que a orquestradora acha "E livre"; **(d)** o mod agrupa por `projetoDe(cwd)` = regex `/Projects/([^/]+)` — projeto fora de `~/Developer/Projects/` (ex.: `~/Developer/Wake/sumire/.claude/worktrees/x`) vira o grupo `x`. | alta (a, b), média (c, d) |
| 2 | `protocolo.md` "Izanagi" | Título "— Izanagi" e seção "Regras do repositório" copia develop/gate/migration; `git switch -c <slug> origin/develop` fixo. | média |
| 3 | `livre-se-limpa.mjs` e `pnpm` | `trabalhoBash` = commit/push/`gh pr create|ready`/`pnpm test|typecheck`. Em projeto sem pnpm, quem só roda teste com título `livre` não é cobrado. Edit/commit/push já cobrem o grosso. | baixa |
| 4 | `trava-edicao-repos.txt` só Izanagi | Log `hooks-crewai.log` (desde 23/10 04:12, 1.124 linhas): **0 eventos** de `orquestradora-nao-edita` — nem pergunta, nem erro. Em outro repositório a trava não vale. | decisão do dia 30/10 |
| 5 | Textos citando Izanagi | `ausente/SKILL.md` (2× `izanagi.md`), `papeis/orquestradora.md` (título "— izanagi", "mergeia na `develop`"), `papeis-e-modelos/SKILL.md` ("No pool do Izanagi"), `skills-por-papel.md` (título), `papeis/validadora.md` (`revisar-diff` "do Izanagi" — é skill do projeto, fica com a qualificação). O estado da orquestradora já é por projeto na prática (`battlewand.md` e `izanagi.md` coexistem). | baixa |
| 6 | `IZANAGI_PAINEL_DIR` | `painel.mjs` (+ 4 `IZANAGI_PAINEL_PAUSA_*`), `painel-das-sessoes.mjs`, 5 arquivos de teste. | baixa |
| 7 | **novo:** teste vermelho | `ausente` fora do mapa (acima). | baixa, mas bloqueia o critério |
| 8 | **novo:** bandeira do modo ausente é global | `operador-ausente.json` vale para a máquina. | nenhuma — ver decisão D3 |

## Decisões (todas reversíveis — *assumidas, a confirmar*)

- **D1 — O projeto NÃO entra no título** (*assumida, a confirmar*). O título segue `E1 · …` (compatível com as 16 sessões vivas; o operador já pediu título curto). O projeto é **derivado** do registro do app: `originCwd` (cai para `cwd`) → `git rev-parse --git-common-dir` → chave = o common dir absoluto (comparação nas travas) e nome = basename do diretório que contém o `.git`, minúsculo (painel/mod). Alternativa descartada: `izanagi·E1 · …` — quebra a regex das travas e todos os títulos vivos, e polui o que o operador lê.
- **D2 — Regras do repositório saem do protocolo e viram "leia o `CLAUDE.md` do projeto"** (*assumida, a confirmar*). O Izanagi fica como exemplo entre parênteses. Sem arquivo novo por projeto: o `CLAUDE.md` já é a fonte.
- **D3 — Modo ausente continua global** (*assumida, a confirmar*): o operador é um só; ausente num projeto é ausente em todos.
- **D4 — Teste "de trabalho" do `livre-se-limpa`** vira uma lista de executores comuns (*assumida, a confirmar*): `(pnpm|npm|yarn|bun)( run)? (test|typecheck|check|lint)`, `npx (vitest|jest|tsc)`, `pytest`, `go test`, `cargo test`, `make (test|check)`. Sem arquivo de configuração por projeto (YAGNI).
- **D5 — `trava-edicao-repos.txt` não muda agora.** No dia 30/10 (fim do piloto), item próprio: se o log seguir sem pergunta falsa no Izanagi, inverter para "vale em todo repositório com orquestradora, exceto os listados em `trava-edicao-excecoes.txt`" (battlewand). **Fora deste plano.** Proposta: a orquestradora abre o item no ritual de 30/10.
- **D6 — `IZANAGI_PAINEL_DIR` → `PAINEL_DIR`**, lendo o nome antigo como fallback (o mod/sessões que exportam o antigo continuam funcionando). Idem `PAINEL_PAUSA_*`.
- **D7 — Item da fila e linha de sessão ganham `projeto`.** `painel.mjs` preenche `projeto` quando falta, a partir do `process.cwd()` (git common dir → nome); `list fila|sessoes` aceita `--projeto <nome>` e `--todos`; **sem flag, lista tudo** (compatível com a orquestradora de hoje, que já lê tudo) e mostra a coluna `projeto`. Itens antigos sem o campo: backfill único `projeto: "izanagi"` (todos os F1–F23 são do Izanagi — conferir antes com `list fila`).

## Arquivos

| Arquivo | Mudança |
|---|---|
| `~/.claude/hooks/pool-comum.mjs` | `registroDaSessao` devolve também `cwd` e `originCwd`; nova `projetoDaSessao(reg)` → `{ repo, nome }` (cache junto do registro). |
| `~/.claude/hooks/papel-do-pool.mjs` | T2: a exceção "orquestradora arquiva livre" exige `projetoDaSessao(alvo).repo === projetoDaSessao(quemChama).repo`; projeto diferente → `deny` com motivo próprio. Repo indeterminado de um dos lados → `deny` (erra para o lado de não arquivar). |
| `~/.claude/hooks/livre-se-limpa.mjs` | `trabalhoBash` com a lista da D4. |
| `~/.claude/skills/orquestradora/scripts/painel.mjs` | D6 (env), D7 (`projeto` automático em `sessoes` e `fila`, `--projeto`/`--todos` no `list`). |
| `~/.claude/hooks/painel-das-sessoes.mjs` | D6 (env). |
| `~/.claude/mods/painel-sessoes/hooks/register.tsx` | `projetoDe(cwd)`: corta `/.claude/worktrees/<x>` e qualquer `/worktrees/<x>` final, depois basename; mantém o atalho `/Projects/<nome>`. Fila agrupada/filtrada por `projeto` se o mod mostra fila. |
| `~/.claude/hooks/tests/*.test.mjs` | env renomeada (D6) em `painel-das-sessoes`, `painel-validacao`, `painel-trava-concorrencia`, `painel-fila`; casos novos (abaixo). |
| `~/.claude/orquestracao/pool/skills-por-papel.json` (+ `.md` regerado, se houver gerador) | entrada `ausente` (O: `lê`; demais: `nao`). Título do `.md` sem "Izanagi". |
| `~/.claude/orquestracao/pool/protocolo.md` | D2: título genérico; seção "Regras do repositório" → "as do `CLAUDE.md` do projeto (no Izanagi: …)"; base da branch = "a branch de integração do projeto"; fila/sessões: "filtre por `--projeto`"; seção nova curta "Mais de um projeto" (D1, D3, D7). |
| `~/.claude/orquestracao/pool/papeis/orquestradora.md` | título `🎛 orquestradora — <projeto>`; "mergeia na branch de integração do projeto (Izanagi: `develop`)"; despacha só membro do mesmo projeto. |
| `~/.claude/skills/ausente/SKILL.md` | `izanagi.md` → `~/.claude/orquestracao/<projeto>.md`; passo 1 com `--projeto`. |
| `~/.claude/skills/papeis-e-modelos/SKILL.md` | "No pool do Izanagi" → "No pool de sessões". |
| `~/.claude/skills/orquestradora/SKILL.md` | onde fala de achar membro livre e de `list fila`: `--projeto <este>`. |

## Passos (TDD: teste vermelho antes do código em cada passo)

0. **Linha de base:** rodar a suíte inteira e anotar (esperado: 7 verdes + `skills-do-papel` caso 8 vermelho). Copiar `~/.claude/hooks/`, `painel.mjs`, `register.tsx`, `protocolo.md`, `papeis/`, as 3 skills para `~/.claude/orquestracao/backups/F23-<hora>/` (restauração por cópia, nunca `git checkout`).
1. **Mapa:** entrada `ausente` no `skills-por-papel.json` → `skills-do-papel.test.mjs` verde.
2. **`pool-comum.mjs`:** teste novo `pool-comum.test.mjs` — registro sintético com `originCwd` em dois repositórios git temporários (`git init` em pasta temporária, `timeout` + `killSignal: 'SIGKILL'` no `execFileSync`) → `projetoDaSessao` devolve repos diferentes; worktree (`git worktree add`) do mesmo repo → mesmo repo; sem `originCwd` cai para `cwd`; pasta que não é git → `null`.
3. **T2 entre projetos** em `papel-do-pool.test.mjs`, casos novos:
   - orquestradora do projeto A arquiva `E1 · livre` do projeto A → passa (o caso de hoje, continua verde);
   - orquestradora de A arquiva `E1 · livre` de B (mesmo título!) → `deny` T2 com motivo "outro projeto";
   - orquestradora de A arquiva membro cujo repo não resolve → `deny`;
   - os casos atuais do T2 sem `originCwd` no registro sintético: dar `originCwd` do mesmo repo a todos (atualizar a fixture), para não mudar o desfecho deles.
   Depois o código.
4. **`livre-se-limpa`:** casos novos — título `E2 · livre`, turno só com `npm test` / `pytest -q` / `go test ./...` → cobra título; `ls`/`git status` → não cobra; `pnpm test` → continua cobrando.
5. **`painel.mjs`:** D6 + D7. Casos novos em `painel-fila.test.mjs`: (a) `set fila F1` sem `projeto` rodado de dentro de repo temporário A → grava `projeto: "<nome de A>"`; (b) `projeto` explícito não é sobrescrito; (c) `list fila --projeto a` só traz os de A, `list fila` traz os dois; (d) `PAINEL_DIR` e `IZANAGI_PAINEL_DIR` ambos funcionam (o novo vence se os dois existirem). Renomear a env nos 4 testes de painel para `PAINEL_DIR` e manter UM caso com o nome antigo.
6. **`painel-das-sessoes.mjs`:** env D6; caso com `PAINEL_DIR`.
7. **Mod:** em `tests/painel.test.tsx`, casos de `projetoDe`: `/Users/x/Developer/Projects/Izanagi/.claude/worktrees/ab-12` → `izanagi`; `/Users/x/Developer/Wake/sumire/.claude/worktrees/q` → `sumire`; `/Users/x/code/foo` → `foo`. Rodar a suíte do mod do jeito que ela já roda (conferir no `package`/skill `plugin-authoring` como; se não houver runner, registrar isso no relatório em vez de inventar).
8. **Backfill:** `painel.mjs list fila` → conferir que todos são do Izanagi → um `batch` de `update` `{"projeto":"izanagi"}` nos itens sem o campo. Mesmo para `sessoes` sem `projeto`. Antes: cópia de `~/.claude/orquestracao/painel/` para o backup do passo 0.
9. **Textos** (pontos 2 e 5): protocolo, papéis, 3 skills, conforme a tabela. Conferência: `grep -rn -i "izanagi" ~/.claude/orquestracao/pool ~/.claude/skills/{orquestradora,ausente,papeis-e-modelos}` — cada ocorrência que sobrar é exemplo entre parênteses ou skill que só existe no Izanagi (`revisar-diff`, `spec-driven`), listada no relatório.
10. **Suíte inteira** de novo + `node --check` em cada hook mexido + um hook real sobre entrada sintética desta máquina (ex.: `echo '{"session_id":"<cli de uma E viva>","tool_name":"mcp__ccd_session_mgmt__archive_session","tool_input":{"session_id":"x"}}' | node papel-do-pool.mjs`) para provar que nada lança com os registros reais (o erro do hook vai calado para o log — conferir `tail hooks-crewai.log` sem `erro`).

## Critério de pronto (medível)

- `for f in ~/.claude/hooks/tests/*.test.mjs; do node "$f" || echo "FALHOU $f"; done` → nenhum `FALHOU`, saída real colada no relatório (inclusive `skills-do-papel`, hoje vermelho).
- Casos novos com **dois projetos** presentes e verdes: T2 entre projetos (3), `projetoDaSessao` (4), `painel.mjs --projeto` + `projeto` automático (4), `livre-se-limpa` com outros executores (4), `projetoDe` do mod (3).
- **Prova de que cada caso novo mede:** reverter a linha do conserto do T2 (por cópia) → o caso "outro projeto" fica vermelho na linha certa; restaurar da cópia e comparar com `diff`.
- `grep -c "erro" ` nas linhas novas do `hooks-crewai.log` durante o passo 10 = 0.
- `painel.mjs list fila` mostra `projeto` em todos os itens.

## Fora de escopo

- Mudar o formato do título ou renomear sessões vivas.
- Inverter a `trava-edicao-repos.txt` (D5, item próprio em 30/10).
- Instalador/empacotamento do kit. O repositório `~/Developer/Projects/kit-de-orquestracao` (criado 24/10 23:11, só README) é o passo SEGUINTE: **D8 (*assumida, a confirmar*) — generalizar primeiro no lugar, em `~/.claude/`, onde as 16 sessões vivas provam que nada quebrou; o repositório importa a versão já genérica depois**, num item próprio (estrutura, script de instalação que liga os hooks no `settings.json`, testes rodando de dentro do repo). Fazer na ordem inversa duplica o código em dois lugares durante a transição.
- Mover regras do Izanagi para dentro do repositório Izanagi (proibido aqui).
- Bandeira de ausência por projeto (D3).
- Comentários históricos que citam o Izanagi (`hooks-crewai-comum.mjs`, `orquestradora-nao-edita.mjs`): são rastro, não comportamento.

## Cuidados para a E

- **16 sessões vivas usam estes hooks agora.** Edite hook por `Write` de arquivo completo (uma troca atômica), nunca em várias edições que deixem o arquivo meio-escrito entre elas; `node --check` antes de salvar a versão final (escreva primeiro em `/tmp`, cheque, depois copie).
- Erro do hook deixa passar calado: um bug no T2 vira "arquivou o que não devia". Por isso o passo 10 roda o hook real.
- Cache do registro (2 min, `pool-registro-cache.json`): o formato muda (ganha `cwd`/`originCwd`); entrada antiga sem os campos tem de ser tratada como cache vazio, não como "sem projeto".
- `execFileSync` de `git` nos testes e no hook: `timeout` + `killSignal: 'SIGKILL'`.
- Não rodar a suíte em paralelo com o gate do Izanagi de outra sessão sem necessidade: são scripts leves, mas o `painel-trava-concorrencia` gera processos.
