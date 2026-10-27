# F167 · Atualizar plugins confere depois que a versão instalada é a publicada — plano (P6, 27/10)

Copie este arquivo para `docs/planos/2026-10-27-atualizar-plugins-confere-a-versao.md` no PR.

## Base
O `atualizar-plugins` nasce no F151, PR #62 (branch `feat-atualizar-plugins`, ainda aberto e em conflito com a main na linha de versão; E2 rebaseia). **Comece só depois do merge do #62**, com branch nova a partir da `main` (`fix-atualizar-plugins-confere`). Se o #62 ainda não estiver na main quando você pegar o item, avise a P6 e não ramifique da branch dele.

## O defeito (medido lendo `plugins/orquestracao/skills/orquestradora/scripts/atualizar-plugins.mjs` do #62, HEAD d285d29)
- No laço de `main()`: quando `claude plugin update <id> --json -s user` sai 0, o script já marca `acao: 'atualizado'` e `atualizou = true` — **antes** de reler a versão.
- A releitura (`instalados()` depois do laço) só copia a versão para `p.depois`; se o plugin sumiu da lista, `depois` cai de volta em `antes`. Nada compara `depois` com `publicado`.
- O texto mostra `${p.antes} → ${p.publicado}`, não `→ ${p.depois}`: a linha diz que chegou na publicada mesmo quando não chegou.
- Resultado: `plugin update` que sai 0 sem trocar a versão (cache velho, nome que não casa, escopo errado) aparece como atualizado, pede reinício e sai com exit 0.

## Passos
1. **Teste primeiro** (`plugins/orquestracao/hooks/tests/atualizar-plugins.test.mjs`): no `CLAUDE_FALSO`, ramo `update`, se `process.env.FAKE_NAO_PEGA === id` responde `{"outcome":"ok"}` com exit 0 **sem** mudar a versão no estado. Novo teste: publicada 0.1.2, instalada 0.1.1, `FAKE_NAO_PEGA=orquestracao@kit-de-orquestracao` → exit 1; `acao === 'não pegou'`; `depois === '0.1.1'`; `reiniciar === false`; texto contém `0.1.1 (não pegou: instalada ficou em 0.1.1, publicada 0.1.2)` e **não** contém `Reinicie o app`. Rode e veja falhar porque hoje sai `atualizado`/exit 0 (não por erro de sintaxe).
2. Segundo teste novo: o `update` falso sai 0 e **remove** o plugin da lista → `acao 'não pegou'`, `depois === null`, mensagem `instalada sumiu da lista`, exit 1.
3. No script, troque a ordem: o `update` com exit 0 marca `acao: 'conferir'` (interno). Depois do laço, se algum está em `conferir`, relê `instalados()` uma vez e decide cada um: `depois === publicado` → `atualizado` (e só aí `atualizou = true`); senão → `não pegou`, `falhou = true`, `mensagem` como nos testes. Nenhum `conferir` sai no resultado.
4. Texto: `atualizado` mostra `${p.antes} → ${p.depois}`; `atualizaria` continua `${p.antes} → ${p.publicado} (atualizaria)`; `não pegou` mostra `${p.antes} (não pegou: …)`. `reiniciar` = existe algum `atualizado`. Atualize o cabeçalho do script: a sequência passa a terminar em "relê e confere que a instalada é a publicada".
5. Se a releitura em si falhar (`claude plugin list` com erro), deixa o erro subir como hoje (exit 1, mensagem no stderr) — não declare nada atualizado.
6. Suba `version` do `plugins/orquestracao/.claude-plugin/plugin.json` em um patch sobre o que estiver na main.
7. Gate: `npm test`; `claude plugin validate plugins/orquestracao --strict`.

## Pronto quando
- Os dois testes novos falharam antes do passo 3 (cole a saída vermelha no PR) e passam depois; os testes antigos do arquivo seguem verdes (o de `antes → depois` com 0.1.1 → 0.1.2 continua valendo, agora lido de `depois`).
- `grep -n "acao: 'atualizado'" atualizar-plugins.mjs` só aparece no trecho depois da releitura.
- Gate verde; PR para `main` com o plano em `docs/planos/`.

## Fora de escopo
- Instalar plugin que falta, mexer em cópia `project`, tentar o `update` de novo quando não pegou, mudar o `--seco`.
- README/SKILL da orquestradora: só se já citarem que "atualizado" é o que o update respondeu (hoje não citam; não mexa).

## Regras do projeto
Node ≥ 20, ESM, só módulos nativos; `node:test`; `process.exitCode`, nunca `process.exit()` no script (o `claude` falso do teste pode); teste nunca toca `~/.claude` real; filho de teste síncrono com `timeout` e `killSignal: 'SIGKILL'`; commit conventional em PT-BR (`fix(pool): …`), sem citar ADR. Sem ADR (não muda desenho).
