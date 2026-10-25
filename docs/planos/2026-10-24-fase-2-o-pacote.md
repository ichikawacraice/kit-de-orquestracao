# Fase 2 — o pacote (plano, P6, 2026-10-24)

Decisão: [ADR 0001](../adr/0001-plugin-para-o-nucleo-cli-para-o-projeto.md). Estudo: [como distribuir](../estudos/2026-10-24-como-distribuir-o-kit.md). Fase 1 (generalizar no lugar, em `~/.claude/`): [plano](2026-10-24-fase-1-generalizar-no-lugar.md).

**Pré-requisitos:** fase 1 validada (o núcleo já é genérico em `~/.claude/`); o PR da E7 (`a-vez-do-gate.mjs` com vagas e fila do teste de pacote) mergeado na `develop` do Izanagi. As fatias K1, K5 e K6 não dependem da fase 1 e podem começar antes; K2–K4 partem do `~/.claude/` já generalizado; K5 parte da `develop` do Izanagi depois da E7.

**Onde:** tudo neste repositório (`~/Developer/Projects/kit-de-orquestracao`, `main`, push direto liberado enquanto não houver outro colaborador — *assumido, a confirmar*). **Nada no repositório Izanagi** e **nada em `~/.claude/`** até a K7. Cada fatia = uma E (Sonnet), uma V em contexto novo; nível de validação ao lado.

**Regras para toda fatia** (até o `CLAUDE.md` deste repo existir, na K1):
- Node ≥ 20, ESM, só módulos nativos (o kit não traz dependência npm); testes em `node:test` (`node --test`), nunca vitest.
- Teste antes do código; todo `execFileSync`/`spawn` de teste com `timeout` + `killSignal: 'SIGKILL'`; script termina por `process.exitCode`, nunca `process.exit()`.
- Teste que inspeciona valor afirma antes que ele existe e não é vazio.
- Commits conventional em PT-BR (`feat(cli): …`), sem citar ADR no título.
- Testes nunca tocam `~/.claude` real: `HOME` e as envs de pasta apontam para diretório temporário.

## Fatias

### K1 — esqueleto e o próprio repo como primeiro usuário · Simples
- `package.json` (`"type":"module"`, `"bin":{"kit":"cli/kit.mjs"}`, `"engines":{"node":">=20"}`, `"scripts":{"test":"node --test"}`), `cli/kit.mjs` que só responde `--version` e `ajuda`.
- `.claude-plugin/marketplace.json` com os dois plugins (`plugins/orquestracao`, `plugins/painel-sessoes`), cada um com `.claude-plugin/plugin.json` vazio de componentes, `version` `0.1.0`.
- `CLAUDE.md` do repo **escrito a partir do modelo** `modelos/CLAUDE.md` (que nasce aqui, com as seções que o kit lê — ver K6), já com os blocos marcados.
- `docs/adr/README.md` (template e índice) e `docs/README.md`.
- **Medir:** `npx -y github:ichikawacraice/kit-de-orquestracao --version` de uma pasta qualquer funciona com o repo privado; se não, registrar a saída real e o fallback `npm i -g git+ssh://git@github.com/ichikawacraice/kit-de-orquestracao.git`.
- **Pronto:** `node --test` verde; `claude plugin validate .` (ou o equivalente da versão instalada) sem erro, saída colada; a medição do npx com a saída real.

### K2 — plugin `orquestracao`: hooks e travas · **Robusta**
- Copiar de `~/.claude/` (pós-fase 1) para `plugins/orquestracao/`: `hooks/*.mjs` + `hooks/tests/`, `hooks/hooks.json` com cada evento/matcher de hoje (os do `~/.claude/settings.json`: Stop ×5, PreToolUse ×4, SubagentStop, PostToolUse(Failure), UserPromptSubmit) apontando para `"${CLAUDE_PLUGIN_ROOT}/hooks/x.mjs"`.
- `BASE` default continua `~/.claude/orquestracao` (env sobrepõe).
- Travas que casam por nome aceitam o prefixo do plugin: `subagent_type` `executor` **ou** `orquestracao:executor` (idem `validador`), skill `x` **ou** `orquestracao:x`. Caso de teste para cada.
- Hook `SessionStart` novo: injeta (`additionalContext`) o resumo das regras globais que hoje moram no `~/.claude/CLAUDE.md` (Q-ID, papéis e modelos, achar a orquestradora) — texto curto, fonte única num `.md` do plugin.
- **Pronto:** a suíte dos hooks roda de dentro do repo (`node --test "plugins/orquestracao/**/*.test.mjs"` — o Node 24 não aceita diretório em `node --test`) e passa; diff entre os `.mjs` do plugin e os de `~/.claude/hooks/` = só os prefixos e o `SessionStart`; validate sem erro.

### K3 — plugin `orquestracao`: skills, agents, scripts · Média
- `skills/` (`orquestradora`, `papeis-e-modelos`, `ausente`, `handoff-de-sessao`, `notas-de-release`, `orquestrar-com-subagentes`), `agents/` (`executor`, `explorador`, `planejador`, `validador`), `bin/` com `painel`, `proxima-pergunta`, `proximo-item` (wrappers dos scripts), e `pool/` (protocolo, papéis, `skills-por-papel.json` com apelidos prefixados).
- Textos passam a citar `painel` (comando do `bin/`) e `${CLAUDE_PLUGIN_ROOT}`, não `~/.claude/skills/…/painel.mjs`; manter o caminho antigo como alias até a K7.
- **Medido na fase 1 (E8):** `~/.claude/skills/orquestradora` é symlink para `~/.skills-manager/…` (skills-manager) e por isso o `painel.mjs` importa o `pool-comum` por `~/.claude/hooks` (`KIT_HOOKS_DIR` sobrepõe), não por caminho relativo. No plugin, o import volta a ser relativo a `${CLAUDE_PLUGIN_ROOT}`; na K8, tirar as skills do kit do skills-manager também (senão ficam duas cópias: a do plugin, com prefixo, e a da biblioteca).
- **Medir antes** (fato não documentado): com um hook de teste que grave o payload, se `tool_input.skill` chega com o prefixo `orquestracao:`. Ajustar `skill-do-papel` ao medido.
  - **Medido (E8, c3, pelo transcript; `claude -p` estava com login expirado):** o `tool_use` `Skill` de skill de plugin traz o nome prefixado, literal `{"skill": "superpowers:brainstorming", "args": "…"}` (61 ocorrências em `~/.claude/projects/**/*.jsonl`; 2026-09-11 a mais recente conferida). O `tool_input` do hook é o mesmo objeto; `skill-do-papel` segue aceitando as duas formas.
- **Pronto:** testes do painel (`painel-*.test.mjs`) verdes dentro do repo; `painel list fila` funciona pelo `bin/` com `PAINEL_DIR` temporário.

### K4 — plugin `painel-sessoes` (mod) · Simples
- Mover `~/.claude/mods/painel-sessoes/` para `plugins/painel-sessoes/` (já tem `hooks.json` com `modules`), com o `projetoDe` da fase 1.
- **Pronto:** a suíte do mod roda como roda hoje (registrar o comando real); validate sem erro.

### K5 — gate genérico · **Robusta** (duas Es se passar de ~600 linhas de diff: K5a gate+verde+teto, K5b guarda)
- `gate/` com `a-vez-do-gate.mjs`, `o-verde-da-arvore.mjs`, `o-typecheck-do-gate.mjs`, `o-dist-que-o-gate-le.mjs`, `o-script-principal.mjs`, `o-teto-de-workers.mjs`, `guarda-de-operacao.mjs`, a partir do commit `188f37fb8` da `develop` do Izanagi (PR da E7 mergeado; `git show 188f37fb8:scripts/…`).
- Tudo que é fixo vira `.claude/kit.json` do projeto, com o default de hoje do Izanagi como **perfil `pnpm-workspace`**:
  - `gate.pacotes` (hoje `PACOTES`, `a-vez-do-gate.mjs:93`) ou `"auto"` (lido do `pnpm-workspace.yaml`); `gate.comandoPorPacote`, `gate.comandoCompleto`; `gate.typecheck`;
  - `gate.trava` (nome), `gate.vagas`, prazos (24 h, 7 dias, 1 h, 15 min);
  - `arvore.prefixosEnv` (hoje `IZANAGI_|NEXT_PUBLIC_|SUPABASE_`), `arvore.extras`: lista de etapas opcionais (`banco-postgres` com URL, `diretorio` com caminho — cobre Tailwind vendorado e tipos do Next sem nomeá-los);
  - `teto.workersPorNucleo`;
  - `guarda.regras`: liga/desliga cada regra (`build-com-dev-no-ar`, `migration-fora-do-tronco`, `psql-f`, `merge-commit`, `stash-sem-u`, `staging-amplo`, `kill-por-nome`, `destrutivos`), com os caminhos (`apps/web`, `supabase/migrations`) e o tronco (`develop`) vindos do `kit.json`.
- Variáveis `IZANAGI_GATE_*`/`IZANAGI_TESTE_WORKERS` → `KIT_GATE_*`/`KIT_TESTE_WORKERS`, lendo o nome antigo como fallback.
- Portar os três testes (`packages/shared/test/{a-vez-do-gate,o-verde-da-arvore,guarda-de-operacao}.test.ts`) para `node:test`, mais: (a) projeto `npm` simples de um pacote, `kit.json` mínimo `{ "gate": { "comandoCompleto": "npm test" } }` — trava, verde por árvore e pulo funcionam; (b) perfil `pnpm-workspace` reproduz a lista de pacotes do Izanagi; (c) a guarda com uma regra desligada não pergunta.
- **Pronto:** `node --test "gate/test/*.test.mjs"` verde (glob: diretório não funciona no Node 24); um caso mutado por regra (cópia, nunca `git checkout`) fica vermelho na linha certa.

### K6 — CLI: `iniciar` e os modelos · Média
- `modelos/CLAUDE.md` com blocos marcados `<!-- kit:<secao> v1 -->…<!-- /kit:<secao> -->`: `projeto` (o que é, a preencher), `comandos` (gate, teste parcial — lidos do `kit.json`), `regras-de-operacao` (um gate por vez, verde da árvore, rebase, tronco, migration só se `guarda` tiver), `regras-de-trabalho` (spec-driven opcional, ADR, roadmap opcional), `convencoes-de-teste` (as genéricas do Izanagi: insumo vazio, teste que mede ausência, filho síncrono, duas coisas que concordam, laudo só afirma o que mediu, o defeito não falha como o que é), `orquestradora` (o que o pool lê: quem mergeia, numeração).
- `modelos/kit.json` com perfis `simples` e `pnpm-workspace`.
- `kit iniciar [--perfil simples|pnpm-workspace]`: em pasta vazia ou repo sem `CLAUDE.md`, grava `CLAUDE.md`, `.claude/kit.json`, `scripts/kit/` (cópia do `gate/`), `package.json` (`test`/`typecheck` → gate) e `.claude/settings.json` (o hook da guarda do projeto + `extraKnownMarketplaces`/`enabledPlugins` do kit), e o `.claude/kit.lock.json` (versão + sha256 de cada arquivo e bloco).
- **Pronto:** teste em pasta temporária com `git init`: depois do `iniciar`, `npm test` passa pelo gate e `kit doutor` (stub) lê o lock.

- **Herdado da validação da K5 (R1):** um caso que roda o `main` de `gate/a-vez-do-gate.mjs` com `gate.prazos.ilegivelSeg: 1` e uma trava ilegível de 2 s, e afirma que ela é retomada — hoje tirar a ligação da linha 478 não deixa teste vermelho.
- **Herdado da K3:** as skills e os agents do plugin ainda citam o Izanagi como exemplo na prosa; generalizar esses textos aqui, junto com os modelos.

### K7 — CLI: `adotar`, `atualizar`, `doutor`, `remover` · **Robusta**
- `adotar [--simular]`: projeto com `CLAUDE.md`, `settings.json` e `package.json` próprios. **Nunca sobrescreve:** `CLAUDE.md` ganha só os blocos que faltam (no fim, ou onde já houver o marcador); JSON é mesclado (chave existente com valor diferente = conflito listado, não trocado); script `test` existente vira `test:projeto` só com `--trocar-test`. `--simular` imprime o diff e não grava.
- `atualizar`: para cada item do lock, hash atual = hash gravado → troca pela versão nova; diferente → conflito listado com o diff. Bloco de `CLAUDE.md` idem. Bloco do modelo que o projeto nunca recebeu entra no fim (`novo: <bloco>`); **bloco renomeado aparece duas vezes** (o antigo, com o aviso "saiu do kit", e o novo no fim) até o usuário apagar o antigo. `--trocar-test` faz depois a troca do `test` que a adoção deixou pendente.
- `doutor`: plugin `orquestracao` instalado e habilitado; **nenhum hook do kit também em `~/.claude/settings.json`** (procura os nomes dos `.mjs`); `kit.json` válido; versão do lock × versão do CLI; Node ≥ 20; `git` presente. Sai ≠ 0 com a lista.
- `remover`: tira blocos e arquivos cujo hash bate; lista o que foi mexido e deixa.
- **Pronto:** testes com projeto de rascunho em andamento (fixture com `CLAUDE.md` e `settings.json` próprios): `adotar` não altera nenhum byte fora dos blocos/chaves novas (comparar com `diff`); `atualizar` com um bloco editado à mão lista o conflito e não o troca; `remover` devolve a árvore ao estado anterior (menos o que foi mexido).

### K8 — migração desta máquina · **Robusta**, só com o operador avisado (mexe nas travas das sessões vivas)
- Backup de `~/.claude/settings.json`, `~/.claude/hooks/`, `~/.claude/skills/{orquestradora,papeis-e-modelos,ausente,…}`, `~/.claude/mods/painel-sessoes`, `~/.claude/agents/` em `~/.claude/orquestracao/backups/K8-<hora>/`.
- Num passo só: `claude plugin marketplace add ichikawacraice/kit-de-orquestracao` + `claude plugin install orquestracao@… painel-sessoes@…` **e** tirar do `~/.claude/settings.json` os hooks do kit (os outros ficam); mover skills/agents/mod antigos para o backup (não apagar); tirar do `~/.claude/CLAUDE.md` as seções que o `SessionStart` passou a injetar.
- Momento: sem gate rodando e com a orquestradora de acordo (ela escolhe; *assumida, a confirmar*).
- **Pronto:** `kit doutor` sem achado; uma sessão nova recebe o contexto do `SessionStart`; `tail ~/.claude/orquestracao/hooks-crewai.log` mostra cada trava disparando **uma** vez num teste sintético; restauração ensaiada (copiar o backup de volta) documentada no relatório.

### K9 — prova em projeto do zero · Média
- `kit iniciar` num repositório novo de rascunho (`~/Developer/Projects/kit-prova-zero`, privado ou só local — *assumida: só local*), abrir uma orquestradora e um pool mínimo (P, E, V) e levar um item trivial até o merge.
- `kit adotar --simular` no Izanagi **só imprimindo o diff** (nenhuma escrita lá) — o diff vira o insumo do item seguinte.
- **Pronto:** o item trivial mergeado com as travas, o painel mostrando o projeto novo separado do Izanagi, e o diff do Izanagi anexado ao relatório.

## Fora de escopo
- O Izanagi adotar o pacote (trocar `scripts/` pelos do kit, blocos no `CLAUDE.md`): item próprio, PR no Izanagi, depois da K9.
- Publicar no npm ou tornar o repositório público (irreversível — pergunta ao operador quando houver motivo).
- Inverter a `trava-edicao-repos.txt` (decisão de 30/10, fase 1 D5).
- Instalar em outra máquina além desta (o caminho é o mesmo do `adotar`, mas não será medido agora).
- Skills de UI e `spec-driven` do Izanagi (camada c).

## Ordem e paralelismo
K1 → (K2 ∥ K4 ∥ K5) → K3 → K6 → K7 → K8 → K9. K5 espera o merge da E7; K2/K3/K4 esperam a fase 1. Com o teto de E do pool, no máximo duas destas ao mesmo tempo.
