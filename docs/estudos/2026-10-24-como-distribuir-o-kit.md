# Como distribuir e instalar o kit — estudo (2026-10-24)

Autor: P6 (planejadora do pool). Snapshot datado: os fatos sobre plugins vêm da documentação oficial lida em 24/10 (URLs abaixo); revalide antes de decisão nova.

Pedido do operador (24/10): *"crie um padrão de CLAUDE.md, de skills, script, separe tudo, para que eu possa rodar tudo em outro projeto que eu for começar do 0, ou que mesmo um projeto em andamento eu possa instalar esse pacote e passar a usá-lo… de repente até criar um npx ou algo assim."*

## 1. O que existe hoje (medido)

| Peça | Onde mora | Tamanho | Acoplamento ao Izanagi |
|---|---|---|---|
| 13 hooks do pool e das travas | `~/.claude/hooks/*.mjs`, ligados em `~/.claude/settings.json` | 1.407 linhas + 9 arquivos de teste | baixo; os 6 pontos da fase 1 ([plano](../planos/2026-10-24-fase-1-generalizar-no-lugar.md)) |
| Skills `orquestradora`, `papeis-e-modelos`, `ausente`, `handoff-de-sessao`, `notas-de-release`, `orquestrar-com-subagentes` | `~/.claude/skills/` | — | textos citam o Izanagi (fase 1) |
| Agents `executor`, `explorador`, `planejador`, `validador` | `~/.claude/agents/` | — | genéricos |
| Painel (dados + script) | `~/.claude/orquestracao/painel/`, `skills/orquestradora/scripts/painel.mjs` | 300 linhas | `IZANAGI_PAINEL_DIR` |
| Mod do painel | `~/.claude/mods/painel-sessoes/` (já é um plugin com `hooks.json` → `modules`) | — | `projetoDe` só entende `~/Developer/Projects/` |
| Protocolo e papéis do pool | `~/.claude/orquestracao/pool/` | — | protocolo copia regras do Izanagi |
| Regras globais (Q-ID, papéis, orquestradora) | `~/.claude/CLAUDE.md` | 57 linhas | genéricas |
| Gate com fila e verde por árvore | Izanagi `scripts/a-vez-do-gate.mjs` (420), `o-verde-da-arvore.mjs` (511), `o-typecheck-do-gate.mjs` (68), `o-dist-que-o-gate-le.mjs` (240), `o-script-principal.mjs` (86), `vitest.teto.mjs` (51) | 1.376 linhas, só módulos nativos do Node | **alto**: `PACOTES` fixo (`a-vez-do-gate.mjs:93`), `@izanagi/*`, banco Supabase local (`o-verde-da-arvore.mjs:69`), Tailwind vendorado e tipos do Next na chave, prefixos `IZANAGI_|NEXT_PUBLIC_|SUPABASE_`, `pnpm-workspace.yaml`. Já parametrizável por env: `IZANAGI_GATE_PACOTES`, `_TRAVA`, `_VERDE_DIR`, `_SEM_CACHE`, `IZANAGI_TESTE_WORKERS`, `IZANAGI_BANCO_LOCAL_URL` |
| Guarda de operação | Izanagi `scripts/guarda-de-operacao.mjs` (491) | hook PreToolUse de Bash do projeto | **alto**: `apps/web`, `supabase migration up`, `psql -f`, `origin/develop` |
| Testes do gate | Izanagi `packages/shared/test/{a-vez-do-gate,o-verde-da-arvore,guarda-de-operacao}.test.ts` | vitest | dependem do workspace do Izanagi |
| CLAUDE.md do Izanagi | raiz | — | ~13 seções genéricas (gate, um gate por vez, verde da árvore, laudo só afirma o que mediu, filho síncrono, duas coisas que concordam, guarda com insumo vazio, teste que mede ausência…) misturadas com domínio (Wake, VTEX, Figma, glossário) |

A `a-vez-do-gate.mjs` está mudando agora (E7: vagas + fila do teste de pacote). O pacote parte da versão **depois** desse merge.

## 2. As três camadas

| Camada | O que é | Muda por… | Onde vive depois |
|---|---|---|---|
| **(a) Núcleo** | hooks do pool e das travas, skills de orquestração, agents de papel, painel + mod, protocolo e papéis, regras globais | versão do kit | **plugin** instalado no escopo do usuário |
| **(b) Por projeto** | `CLAUDE.md` com as seções que o kit lê, `.claude/kit.json` (config), scripts do gate e da guarda, ganchos no `package.json`, `.claude/settings.json` do projeto | projeto | **arquivos copiados para o projeto** pelo CLI, com bloco marcado e lock de hash |
| **(c) Só do Izanagi** | domínio (Wake, VTEX, Figma, custo), skills de UI (`auditoria-de-clique`, `critica-de-ui`, `revisao-de-arquitetura-de-ui`), `spec-driven` com a numeração dele, regras de migration Supabase, etapas Tailwind/Next da chave da árvore | Izanagi | fica no repositório Izanagi; o que for "extra da chave" ou "regra extra da guarda" vira config dele no `kit.json` |

## 3. Fatos da plataforma que decidem (documentação, 24/10)

1. Plugin traz hooks de todos os eventos em `hooks/hooks.json`, com `${CLAUDE_PLUGIN_ROOT}`; traz skills, agents, commands, MCP e `bin/`. ([components](https://code.claude.com/docs/en/plugins/components.md), [manifest](https://code.claude.com/docs/en/plugins/manifest-reference.md))
2. **Hook igual no plugin e no `settings.json` roda DUAS vezes** — a cópia do plugin não é deduplicada. ([hooks](https://code.claude.com/docs/en/hooks.md)) → a migração tem de tirar os hooks do `settings.json` no mesmo passo.
3. Marketplace em **repo GitHub privado** funciona com as credenciais git da máquina (`gh auth setup-git`); versão = `version` do `plugin.json` (push sem subir a versão não chega a ninguém); auto-update desligado por padrão para terceiros; `claude plugin uninstall` / `marketplace remove` desinstalam. ([install](https://code.claude.com/docs/en/plugins/install.md), [host](https://code.claude.com/docs/en/plugins/host-marketplace.md))
4. O projeto pode declarar marketplace e plugin no `.claude/settings.json` (vale depois do *trust*), mas **cada pessoa ainda roda `claude plugin install` uma vez**. ([loading](https://code.claude.com/docs/en/plugins/loading.md))
5. Estado: `${CLAUDE_PLUGIN_DATA}` sobrevive à atualização mas **é apagado ao desinstalar**; o diretório do plugin muda a cada versão. ([manifest](https://code.claude.com/docs/en/plugins/manifest-reference.md))
6. **Plugin não instala arquivo no projeto** e o `CLAUDE.md` do plugin não é carregado como contexto. ([manifest](https://code.claude.com/docs/en/plugins/manifest-reference.md))
7. Skill de plugin ganha prefixo (`orquestracao:orquestradora`), e **`skillOverrides` não filtra skill de plugin**. ([skills](https://code.claude.com/docs/en/skills.md)) Se `tool_input.skill` chega com o prefixo: **não documentado** — medir.
8. Mod = plugin com `"modules"` no `hooks.json`, distribuído por marketplace (Claude Code ≥ 2.1.287). Precedente na máquina: o marketplace `claude-kit` (johnnyvizz) já entrega `savvy-progress` e `session-band` assim. ([mods](https://code.claude.com/docs/en/plugins/mods/create.md))
9. Nome de plugin não pode começar com `claude-`.

## 4. Alternativas

| | A. Só npx (CLI copia tudo, inclusive para `~/.claude`) | B. Só plugin | C. Repo git + `install.sh` | D. skills-manager | **E. Plugin (núcleo) + CLI por npx (projeto)** |
|---|---|---|---|---|---|
| Projeto novo do zero | sim | não cria `CLAUDE.md` nem scripts | sim | não | **sim** |
| Projeto em andamento, sem sobrescrever | sim, se o CLI mesclar | metade (só núcleo) | frágil (shell mesclando JSON) | não | **sim** |
| Atualizar | CLI reescreve hooks no `settings.json` do usuário — mesclagem de JSON a cada versão | **nativo** (versão, `plugin update`) | `git pull` + reinstalar | só skills | **nativo no núcleo; `kit atualizar` no projeto** |
| Desinstalar | CLI tem de achar e tirar cada hook | **nativo** | à mão | só skills | **nativo + `kit remover`** |
| Hooks duplicados | risco a cada update | zero, se o `settings.json` não tiver cópia | risco | — | **zero; `kit doutor` acusa a cópia** |
| Publicação | npm (irreversível, público) **ou** `npx github:…` (privado) | marketplace privado | repo privado | — | **repo privado; npm opcional depois** |
| CI do projeto roda o gate sem rede | sim (copiado) | não | sim | — | **sim (copiado)** |
| Custo de construir | médio | baixo | baixo | baixo | **médio** |

## 5. Recomendação (*assumida, a confirmar*)

**E — plugin para o núcleo, CLI `kit` para o projeto, os dois no mesmo repositório privado**, sem publicar no npm:

- O repositório é ao mesmo tempo **marketplace** (`.claude-plugin/marketplace.json`) com dois plugins — `orquestracao` (hooks, skills, agents, scripts em `bin/`) e `painel-sessoes` (o mod) — e **pacote do CLI** (`package.json` com `bin: { kit }`), rodado por `npx -y github:ichikawacraice/kit-de-orquestracao <comando>`. Nada vai ao npm: o `npx github:` usa a mesma credencial git (*a medir na fatia 1*; se falhar, `npm i -g git+ssh://…`).
- **Estado fora do plugin:** fila, painel, contadores e logs continuam em `~/.claude/orquestracao/` (`BASE`, sobreponível por env). Motivo: `${CLAUDE_PLUGIN_DATA}` some no uninstall, e esse estado é do operador, não da versão. Também mantém o pool vivo apontando para o mesmo lugar durante a migração.
- **Regras globais:** saem do `~/.claude/CLAUDE.md` para (1) a skill `orquestradora`/`papeis-e-modelos` e (2) um hook `SessionStart` do plugin que injeta um resumo curto (Q-ID, papéis, achar a orquestradora). O `CLAUDE.md` global do operador fica só com preferências pessoais.
- **Projeto:** o CLI grava `.claude/kit.json` (tronco, comando do gate completo, do teste parcial, pacotes, regra de merge, numeração de ADR/SPEC, extras da chave da árvore, regras da guarda), copia `scripts/kit/` (gate, verde da árvore, teto, guarda) e insere no `CLAUDE.md` **blocos marcados** `<!-- kit:<secao> v<n> -->…<!-- /kit:<secao> -->`. Um `.claude/kit.lock.json` guarda versão e hash de cada arquivo/bloco: `kit atualizar` troca só o que o hash diz que ninguém mexeu e lista o resto como conflito; nunca sobrescreve.
- **Comandos:** `kit iniciar` (projeto novo), `kit adotar` (em andamento; `--simular` mostra o diff), `kit atualizar`, `kit doutor` (plugin instalado? hook duplicado entre `settings.json` e plugin? `kit.json` válido? gate roda? Node ≥ 20?), `kit remover` (tira blocos e arquivos não modificados).
- **Descartado:** A (manter hooks no `settings.json` do usuário por mesclagem é o que gera hook duplicado e update frágil), B sozinho (não cobre a camada do projeto), C (shell mesclando JSON), D (só skills).

## 6. Riscos e pegadinhas

- **Migração da máquina:** instalar o plugin com os hooks ainda no `settings.json` dobra todas as travas (fato 2) — `deny` duplo é inofensivo, mas Stop que bloqueia duas vezes não. A troca é um passo só, com backup, em momento sem gate rodando, e o `kit doutor` confere depois.
- **Prefixo de skill (fato 7):** `skill-do-papel.mjs` e `skills-por-papel.json` casam por nome; aceitar `orquestracao:<nome>` como apelido. `aplicar-skills-do-papel.mjs` perde o filtro sobre as skills do próprio kit (só o aviso do hook continua).
- **Agents de plugin** ignoram `permissionMode`/`hooks` no frontmatter e ganham prefixo (`orquestracao:executor`) — as travas que leem `subagent_type === 'executor'` têm de aceitar os dois nomes.
- **Gate sem pnpm:** o gate do Izanagi assume `pnpm-workspace.yaml` e vitest. O genérico recebe os comandos do `kit.json`; o que é monorepo pnpm vira um "perfil" (`pnpm-workspace`), e o caso simples é `{ "gate": "npm test" }` só com trava e verde por árvore.
- **Izanagi adotando o pacote** é mudança no repositório dele (PR, gate, orquestradora): item próprio, depois da prova em projeto de rascunho.
