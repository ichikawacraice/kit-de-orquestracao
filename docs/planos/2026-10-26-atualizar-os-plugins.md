# F151 · Atualizar os plugins do kit num comando só — plano (P5, 26/10)

Repo `kit-de-orquestracao`, branch nova a partir de `origin/main`. Regras (CLAUDE.md): Node ≥ 20, ESM, só nativos, `process.exitCode`, testes nunca tocam `~/.claude` real (HOME temporário), processo filho síncrono com `timeout` e `killSignal: 'SIGKILL'`, commit conventional PT-BR. Gate `npm test`; teste isolado `node gate/com-fichas.mjs -- node --test <arquivo>`.

## Medido (26/10, 22:50 SP)
- O clone do marketplace (`~/.claude/plugins/marketplaces/kit-de-orquestracao`) estava em `0aea3a4` com o `origin/main` do GitHub em `12eb0d9` (dois merges atrás); o `origin/main` local do clone também estava velho (o clone não faz fetch sozinho).
- `claude plugin marketplace update kit-de-orquestracao --json` → última linha `{"command":"marketplace-update","outcome":"ok",…,"message":"…Replacing the existing marketplace clone…Successfully updated…"}`, exit 0; depois o clone ficou em `12eb0d9`. O operador viu, outras vezes, só "Refreshing marketplace cache" sem trocar o clone: por isso conferir o commit depois.
- `claude plugin update orquestracao` (nome curto) respondeu "already at the latest version (0.1.44)" com a 0.1.45 publicada; `orquestracao@kit-de-orquestracao` atualizou. `claude plugin update` aceita `--json` (uma linha de resultado no stdout) e `-s user`.
- `claude plugin list --json` dá a lista dos instalados com `id` (`<nome>@kit-de-orquestracao`), `version`, `scope` (`user`/`project`), `enabled`, `projectPath`. Hoje: 4 plugins do kit em `user` (orquestracao 0.1.46, painel-sessoes 0.7.1, processos, design 0.2.3) e cópias `project` antigas do `kit-rascunho-k16`.
- Versão publicada de cada plugin: `plugins/<nome>/.claude-plugin/plugin.json` dentro do clone (orquestracao 0.1.47, painel-sessoes 0.7.1, processos 0.2.1, design 0.2.3). Lista dos plugins do kit: `.claude-plugin/marketplace.json` do clone.
- `claude plugin update` diz "restart required to apply": o plugin novo só vale depois de reiniciar o app.

## Decidido (assumida, a confirmar)
- D1. **Onde mora:** `plugins/orquestracao/bin/atualizar-plugins` (wrapper bash, igual a `bin/painel`) → `plugins/orquestracao/skills/orquestradora/scripts/atualizar-plugins.mjs`. Motivo: é gesto da orquestradora na máquina, e o `bin/` do plugin já está no PATH de toda sessão; o `cli/` é o instalador por projeto (`npx`), lento e de outro escopo.
- D2. **Só o escopo `user`.** Cópias `project` aparecem na saída como "não mexido (projeto <caminho>)".
- D3. **Plugin do kit que não está instalado não é instalado**: aparece como "não instalado".
- D4. Sem ADR.

## Uso
`atualizar-plugins [--seco] [--json]`
- `--seco`: faz o `marketplace update` e a conferência do clone (inofensivos), mostra o que atualizaria, e não roda `plugin update`.
- `--json`: imprime o resultado como JSON (`{clone:{antes,depois,remoto}, plugins:[{id, antes, publicado, depois, acao}], reiniciar}`); sem ele, texto curto.

## Passos (teste antes do código)
1. **Testes vermelhos** em `plugins/orquestracao/hooks/tests/atualizar-plugins.test.mjs` (o `npm test` da raiz pega `**/*.test.mjs`). Montagem por caso: HOME temporário; um repo bare temporário fazendo de GitHub, com `.claude-plugin/marketplace.json` e `plugins/<nome>/.claude-plugin/plugin.json`; o clone dele em `$HOME/.claude/plugins/marketplaces/kit-de-orquestracao`; um `claude` falso (script Node em pasta temporária, apontado por `CLAUDE_BIN`) que:
   - em `plugin list --json` devolve um JSON de estado (arquivo na pasta do teste);
   - em `plugin marketplace update <nome> --json` roda `git -C <clone> pull` (ou, num caso, não faz nada, simulando o "só refresh") e imprime a linha `outcome`;
   - em `plugin update <id> --json -s user` muda a versão no JSON de estado e anota a chamada num arquivo.
   Casos:
   - plugin com versão instalada < publicada → chama `plugin update <nome>@kit-de-orquestracao --json -s user` (com o id completo; confere no arquivo de chamadas) e a saída diz `antes → depois` e `reiniciar: true`;
   - todos em dia → nenhum `plugin update`, `reiniciar: false`, exit 0;
   - clone não andou depois do `marketplace update` (o `claude` falso não puxa) → tenta mais uma vez; continuando atrás do remoto, sai com erro "o clone do marketplace ficou em <sha>, o GitHub está em <sha>", exit 1, nenhum `plugin update`;
   - `--seco` → nenhum `plugin update`, a saída lista quem atualizaria;
   - cópia `scope: project` → "não mexido", nenhum `plugin update` para ela;
   - plugin do marketplace sem instalação → "não instalado";
   - `plugin update` que sai ≠ 0 → o plugin sai com `acao: "falhou"` e a mensagem; os outros seguem; exit 1 no fim.
2. **Implementar `atualizar-plugins.mjs`** até o verde. Sequência: `claude plugin list --json` (antes) → `claude plugin marketplace update kit-de-orquestracao --json` → `git -C <clone> rev-parse HEAD` contra `git ls-remote <url do origin do clone> refs/heads/main` (uma nova tentativa se diferirem; persistindo, erro) → para cada plugin do `marketplace.json` do clone: versão publicada × instalada `user` → `claude plugin update <nome>@kit-de-orquestracao --json -s user` quando diferem → `claude plugin list --json` (depois) → saída. Pasta do marketplace: `$HOME/.claude/plugins/marketplaces/kit-de-orquestracao` (`KIT_MARKETPLACE_DIR` sobrepõe, para teste). Todo `execFileSync` com `timeout` (marketplace e update: 180 s) e `killSignal: 'SIGKILL'`. Saída de texto: uma linha por plugin (`orquestracao  0.1.46 → 0.1.47`), e no fim `Reinicie o app para valer.` ou `Nada a atualizar.`
3. **Wrapper** `plugins/orquestracao/bin/atualizar-plugins` (executável, `chmod +x`), no molde de `bin/painel`.
4. **Docs:** na skill `plugins/orquestracao/skills/orquestradora/SKILL.md`, onde o merge fala em instalar a versão nova (procure "instal"), trocar a receita manual por `atualizar-plugins`; uma linha no `README.md` da raiz (seção de instalação/atualização, se houver). Copiar este plano para `docs/planos/2026-10-26-atualizar-os-plugins.md`.
5. Gate `npm test` verde; `claude plugin validate plugins/orquestracao --strict`; versão patch do plugin `orquestracao`. PR para `main`.

## Critério de pronto (medível)
- Os casos do passo 1 vistos vermelhos (script inexistente) e depois verdes (colar as duas saídas).
- `npm test` verde (colar o resumo com `exit=0`).
- `plugins/orquestracao/bin/atualizar-plugins --seco` rodado de verdade na máquina, sem atualizar nada, mostra as versões instaladas × publicadas (colar a saída). **Não** rodar sem `--seco` na máquina: instalar é da orquestradora, depois do merge.

## Fora de escopo
- Reiniciar o app, ou dizer quando dá para reiniciar (é o F152).
- Instalar plugin que falta, mexer em cópia `project`, outros marketplaces.
- Mudar o `cli/` (`kit atualizar`).
