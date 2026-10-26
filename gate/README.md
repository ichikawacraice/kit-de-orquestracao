# gate — o gate genérico e a guarda de operação (K5)

Um gate por vez na máquina, com verde guardado pela árvore exata e teto de workers.
Portado do Izanagi (`188f37fb8`) e parametrizado por `.claude/kit.json` do projeto.

| Script | Faz |
|---|---|
| `a-vez-do-gate.mjs [pacote] [args]` | toma a vez (trava no diretório comum do git), roda o comando da suíte, guarda o verde |
| `o-typecheck-do-gate.mjs` | o mesmo para `gate.typecheck`, etapa `typecheck` do verde |
| `o-verde-da-arvore.mjs` | imprime a chave e o que a árvore atual já passou |
| `o-dist-que-o-gate-le.mjs` | só no perfil `pnpm-workspace`: confere o `pnpm-lock.yaml` e constrói os pacotes consumidos compilados |
| `as-docs-concordam.mjs [--regra x]…` | confere as docs (spec, ADR, roadmap, links, diário) e sai 1 com `arquivo:linha — motivo`; o gate roda antes da suíte |
| `o-teto-de-workers.mjs` | `tetoDeWorkers()` para o `vitest.config.*` importar |
| `guarda-de-operacao.mjs` | hook `PreToolUse` (Bash): pede confirmação antes de comando que já custou caro; só avisa em bypass |

## `.claude/kit.json`

Mínimo, projeto `npm` de um pacote: `{ "gate": { "comandoCompleto": "npm test" } }`.
Sem `gate.comandoCompleto` o gate recusa alto — não adivinha o comando.

```jsonc
{
  "gate": {
    "perfil": "comando",                 // ou "pnpm-workspace"
    "comandoCompleto": "npm test",       // partido por espaço, sem shell
    "comandoPorPacote": "npm test --workspace {pacote}",
    "pacotes": ["a", "b"],               // ou "auto" (pnpm-workspace: lê o pnpm-workspace.yaml)
    "filtroDePacote": "@escopo/{pacote}",
    "typecheck": "npm run typecheck",
    "trava": "kit-gate.trava", "travaConserto": "kit-conserto.trava", "verdeDir": "kit-gate-verde",
    "pacotesJuntos": 2, "workersConserto": 2,
    "prazos": { "vezMin": 60, "verdeHoras": 24, "retencaoDias": 7, "typecheckMin": 15, "buildMin": 10, "ilegivelSeg": 30 }
  },
  "arvore": {
    "prefixosEnv": ["KIT_"], "avulsas": ["CI", "TZ", "NODE_OPTIONS"], "foraDaChave": ["GATE_SEM_CACHE", "GATE_TRAVA", "GATE_VERDE_DIR"],
    "extras": [                          // o que mais decide o verde
      { "nome": "banco", "tipo": "banco-postgres", "urlEnv": "X_BANCO_URL", "urlPadrao": "postgresql://…@127.0.0.1:54322/postgres" },
      { "nome": "tailwind", "tipo": "diretorio-executavel", "dirEnv": "X_TAILWIND_DIR", "dirPadrao": "x-tailwind", "binario": "node_modules/.bin/tailwindcss" },
      { "nome": "tiposDoNext", "tipo": "arquivos-gerados", "base": "apps/web", "padraoDir": "^\\.next[^/]*$", "sub": "types" }
    ]
  },
  "guarda": {
    "regras": ["build-com-dev-no-ar", "psql-f", "migration-fora-do-tronco", "merge-commit", "stash-sem-u", "staging-amplo", "kill-por-nome", "destrutivos"],
    "tronco": "origin/main", "frontend": "apps/web", "migrations": "supabase/migrations",
    "buildFiltrado": "pnpm --filter @escopo/a --filter @escopo/b build",
    "descartaveis": ["dist", ".next", "node_modules", "coverage", ".turbo", ".vitest"]
  }
}
```

`guarda.regras` lista só as regras LIGADAS (padrão: as oito); tirar uma da lista a desliga. Nome que não é regra, ou
valor que não é lista, é erro (`carregarConfig`), e `arvore.extras` exige `nome` único e fora de `arvore`, `runtime`, `env`,
`envNomes` e `dotenv`. `kit.json` ilegível ou inválido não trava o hook: cai nas regras padrão e avisa no stderr. Registro no `settings.json`:
`{ "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "node <caminho>/gate/guarda-de-operacao.mjs" }] }] } }`.

O perfil `pnpm-workspace` com `pacotes: "auto"` reproduz o gate do Izanagi (`pnpm -r --workspace-concurrency=2 test`,
`pnpm --filter <pacote> test`, `pnpm -r typecheck`).

## As docs concordam (`documentos`)

Seção opcional do `kit.json`. O gate confere ANTES da suíte (no CI também), sai 1 no primeiro achado e nem toma a vez nem guarda verde.
Quais regras rodam (A7): `documentos.conferir` no `kit.json` vence — a lista é a que roda e `[]` explícito não confere nada, para o time inteiro;
sem a chave, valem as opções `conferir_*` do plugin `processos` (todas ligadas por padrão), que cada pessoa liga ou desliga na própria conta;
o plugin `processos` desligado em `enabledPlugins` não roda regra nenhuma. A opção do plugin vale só para a sua conta (o app grava em
`~/.claude/settings.json`; o gate lê de lá): para valer para o time, escreva `documentos.conferir` no `kit.json`. Se o app não mostrar a opção, o caminho é `/plugin` no terminal.
Cada regra se liga à parte:

| Regra | Reprova |
|---|---|
| `status-da-spec` | `**Status:**` fora de `documentos.estados`; spec fora do índice da pasta de specs; índice que diz outro status que o cabeçalho |
| `indice-de-adr` | ADR fora do índice, linha do índice para arquivo ausente, rótulo com número que não é o do arquivo, célula Decisão acima de `orcamentos.decisaoDoAdr` (200) |
| `linha-do-roadmap` | linha de item acima de `orcamentos.linhaDoRoadmap` (400), mais de `orcamentos.linksDoRoadmap` (2) links para spec/ADR, âncora que o destino não declara (spec, ADR e diário exigem `<a id>`; outro doc aceita o slug do título) |
| `links-relativos` | link relativo em `documentos.docs` para arquivo ou âncora inexistente (código e crases não contam) |
| `tamanho-do-diario` | parte do diário acima de `orcamentos.diarioEmBytes` (150000) |

```jsonc
{ "documentos": {
    "conferir": ["status-da-spec", "indice-de-adr", "linha-do-roadmap", "links-relativos", "tamanho-do-diario"],
    "adr": "docs/adr", "specs": "docs/specs", "roadmap": "docs/roadmap.md", "diario": "docs/diario", "docs": "docs",
    "estados": ["Rascunho", "Em revisão", "Aprovada", "Implementada", "Substituída"],
    "orcamentos": { "decisaoDoAdr": 200, "linhaDoRoadmap": 400, "linksDoRoadmap": 2, "diarioEmBytes": 150000 }
} }
```

Pasta ausente ou sem documento escreve `[regra] nada a conferir: …` — nunca um verde calado. Rodando o script à mão
(`node scripts/kit/as-docs-concordam.mjs` no projeto instalado) sem `--regra`, valem as regras que o gate rodaria (a precedência acima); `--regra <nome>` confere uma à mão.
`documentos.conferir` com nome que não é regra é erro (`carregarConfig`).

## A raiz do projeto

Os scripts do gate medem o toplevel do git do **diretório de onde rodam** (o `cwd`), não a pasta do script: rodados de
fora do repositório, medem o `cwd`. Chamados pelo `package.json` da raiz (`scripts/kit/…`), não são afetados.
A trava e o verde ficam no `git-common-dir`, então valem entre worktrees do mesmo repositório.

## Variáveis de ambiente

`KIT_GATE_TRAVA`, `KIT_CONSERTO_TRAVA`, `KIT_GATE_VAGAS`, `KIT_CONSERTO_VAGAS`, `KIT_GATE_PACOTES`,
`KIT_GATE_SEM_CACHE=1`, `KIT_GATE_VERDE_DIR`, `KIT_TESTE_WORKERS`, `KIT_CONSERTO_WORKERS`.
Os nomes `IZANAGI_*` equivalentes valem como reserva (`KIT_*` vence). No CI (`CI` definido) não há fila, teto nem verde.

## Testes

```bash
node --test "gate/test/*.test.mjs"
```

(`node --test gate` não funciona no Node 24: o argumento vira arquivo, não diretório.)
O registro da guarda no plugin `orquestracao` fica para a K2.
