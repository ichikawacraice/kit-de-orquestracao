# gate — o gate genérico (K5a)

Um gate por vez na máquina, com verde guardado pela árvore exata e teto de workers.
Portado do Izanagi (`188f37fb8`) e parametrizado por `.claude/kit.json` do projeto.

| Script | Faz |
|---|---|
| `a-vez-do-gate.mjs [pacote] [args]` | toma a vez (trava no diretório comum do git), roda o comando da suíte, guarda o verde |
| `o-typecheck-do-gate.mjs` | o mesmo para `gate.typecheck`, etapa `typecheck` do verde |
| `o-verde-da-arvore.mjs` | imprime a chave e o que a árvore atual já passou |
| `o-dist-que-o-gate-le.mjs` | só no perfil `pnpm-workspace`: confere o `pnpm-lock.yaml` e constrói os pacotes consumidos compilados |
| `o-teto-de-workers.mjs` | `tetoDeWorkers()` para o `vitest.config.*` importar |

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
  }
}
```

O perfil `pnpm-workspace` com `pacotes: "auto"` reproduz o gate do Izanagi (`pnpm -r --workspace-concurrency=2 test`,
`pnpm --filter <pacote> test`, `pnpm -r typecheck`).

## Variáveis de ambiente

`KIT_GATE_TRAVA`, `KIT_CONSERTO_TRAVA`, `KIT_GATE_VAGAS`, `KIT_CONSERTO_VAGAS`, `KIT_GATE_PACOTES`,
`KIT_GATE_SEM_CACHE=1`, `KIT_GATE_VERDE_DIR`, `KIT_TESTE_WORKERS`, `KIT_CONSERTO_WORKERS`.
Os nomes `IZANAGI_*` equivalentes valem como reserva (`KIT_*` vence). No CI (`CI` definido) não há fila, teto nem verde.

## Testes

```bash
node --test "gate/test/*.test.mjs"
```

(`node --test gate` não funciona no Node 24: o argumento vira arquivo, não diretório.)
Faltam a **K5b** (guarda de operação) e o registro dos hooks no plugin.
