# F70 · as skills do papel entram na sessão nova do pool

Origem: defeito relatado pelo operador em 26/10 (E2 e V2 abertas sem as skills do papel). Branch: `claude/f70-skills-do-papel`, a partir de `origin/main` (`69850a4`).

## O caso
Ao abrir um membro do pool, a orquestradora roda `node "${CLAUDE_PLUGIN_ROOT}/pool/aplicar-skills-do-papel.mjs" <local_…>`, que grava no `settings.local.json` do worktree as skills do papel. Desde a troca do kit para plugin, o script falha em toda sessão nova e o membro roda com a lista inteira de skills.

## Causa (medida em 26/10, 07:30–07:45)
Duas causas independentes; qualquer uma sozinha já quebra.

- **C1. O script procura `conta-atual.txt` na pasta dele.** `aplicar-skills-do-papel.mjs:21` lê `join(AQUI, 'conta-atual.txt')`, com `AQUI` = pasta do script. Antes da K8 (25/10 14:01) o script morava em `~/.claude/orquestracao/pool/`, ao lado do arquivo. No plugin, `AQUI` é `~/.claude/plugins/cache/kit-de-orquestracao/orquestracao/<versão>/pool/`, que não tem o arquivo e é trocada a cada `claude plugin update`. Resultado: `sem …/0.1.33/pool/conta-atual.txt: não sei qual é a conta atual`, exit 2 (linha 95).
- **C2. A conta do app mudou e o arquivo ficou para trás.** `~/.claude/orquestracao/pool/conta-atual.txt` (gravado em 24/10 12:32) diz `ad15cbb2-…/6b835fe9-…`. O último registro de sessão gravado nessa pasta é de 25/10 20:43; a partir daí o app grava em `2d62741f-…/6b835fe9-…` (88 registros, o último de 26/10 07:37). As sessões citadas no defeito (`local_67abeed7…` P1, `local_6d091720…` E1, a própria orquestradora `local_2ea799d0…`) estão todas em `2d62741f-…`. Por isso, com `POOL_APP_SESSOES_DIR` apontando para a pasta do arquivo, o script responde `sessão local_67abeed7-… não encontrada`: não é demora do app em gravar (o registro desta sessão já existia no disco quando ela rodou o primeiro comando), nem formato do caminho; é a pasta da conta errada.
- **Por que o teste não pegou.** Todo caso de `skills-do-papel.test.mjs` passa `POOL_APP_SESSOES_DIR`, e com essa env o filtro de conta é desligado (linha 20). O caminho que roda de verdade (sem a env) nunca foi exercitado.
- **Fonte certa da conta.** O app passa à sessão, e portanto a todo comando Bash dela, `CLAUDE_CODE_ACCOUNT_UUID` e `CLAUDE_CODE_ORGANIZATION_UUID`. Medido nesta sessão: `2d62741f-…` e `6b835fe9-…`, exatamente a pasta onde estão os registros vivos. Muda sozinha quando o operador troca de conta.

<a id="desde-quando"></a>
## Desde quando falha
Varredura dos registros de sessão de membro (`E/V/P/D<n> · …`) criados desde 24/10 e do `settings.local.json` de cada worktree; horas em BRT (-03), detalhe em [Medição](#medicao).
- **Funcionou depois da K8**, mas só com a pasta da conta passada à mão: P1, P2 e E1 abertos em 25/10 ~20:50 receberam a lista (35, 35 e 31 overrides, gravados um a três minutos depois de abertos), e D1/P3 abertos em 26/10 02:00 também (34 e 35, às 02:01; há backups `settings-local-*-20261026-0201.json` em `~/.claude/orquestracao/backups/`). Pelo caminho padrão do script do plugin (sem env), não há sinal de aplicação desde a K8: ele recusa sempre por C1.
- **Desde 26/10 07:28, nenhum membro novo do kit recebeu a lista:** P1, P2, D1, E1, E2, P3 e P4 (esta sessão), abertos entre 07:28 e 07:37, estão sem `settings.local.json`.
- Os membros do Izanagi abertos no mesmo intervalo (E2, V2, E3, P4) têm um `skillOverrides` de 8 entradas, que não é coluna do mapa do kit (E=31, V=21, P=35, D=34): vem de outro lugar, fora desta frente.

## Decisões (assumidas, a confirmar; reversíveis)
- **D1. Com `<local_…>`, sem filtro de conta.** O `local_…` é único entre contas; o script procura o registro em toda `claude-code-sessions/` (como `pool-comum.mjs` já faz em `varrerRegistro`). Motivo: o uso de todo dia (abrir membro novo) deixa de depender de saber a conta.
- **D2. Com `--todos`, a conta vem do ambiente do app.** Pasta = `<CLAUDE_CODE_ACCOUNT_UUID>/<CLAUDE_CODE_ORGANIZATION_UUID>`. Sem as duas envs (script rodado fora do app), vale `conta-atual.txt` em `<BASE>/pool/`, com `BASE` = `HOOKS_CREWAI_BASE` ou `~/.claude/orquestracao` (o estado mora em `~/.claude/orquestracao`, nunca no cache do plugin). Sem nenhum dos dois, recusa (exit 2) e a mensagem cita as duas fontes. Motivo: o arquivo à mão envelheceu em um dia (C2); o ambiente não envelhece.
- **D3. O filtro de conta vale também sob `POOL_APP_SESSOES_DIR`.** A env só troca a raiz; o filtro não desliga mais. Motivo: é exatamente o desligamento no teste que escondeu C1 e C2.
- **D4. Conta das envs diferente do `conta-atual.txt`:** vale a env, e o script escreve um aviso em stderr (`conta-atual.txt aponta <x>, o app está em <y>`), sem mudar o exit. Não regrava o arquivo (gravar estado em `~/.claude` fica para quem o operador mandar).
- Fora: a cópia velha `~/.claude/orquestracao/pool/aplicar-skills-do-papel.mjs` (de antes da K8) fica onde está; desde a K8 o plugin é a cópia viva.

## Arquivos
- `plugins/orquestracao/pool/aplicar-skills-do-papel.mjs` — `CONTA` vira função `contaAtual()` (D2, D4); `main` usa a raiz inteira com `<local_…>` (D1) e `join(SESSOES, conta)` com `--todos` (D3); comentário do topo e das linhas 17–19 dizem a regra nova.
- `plugins/orquestracao/hooks/tests/skills-do-papel.test.mjs` — casos F70 (abaixo); `env()` passa a apagar `CLAUDE_CODE_ACCOUNT_UUID` e `CLAUDE_CODE_ORGANIZATION_UUID` herdadas (o teste roda dentro de uma sessão do app, que as tem com a conta real) e a montar os registros em `app/<conta>/<org>/`.
- `plugins/orquestracao/pool/skills-por-papel.md:15` — o item "Só a conta atual" passa a dizer: conta vem do app (envs), `conta-atual.txt` em `~/.claude/orquestracao/pool/` só fora do app; `<local_…>` não depende de conta.
- `plugins/orquestracao/.claude-plugin/plugin.json` — `version` `0.1.33` → `0.1.34` (o cache só se renova quando a versão muda). Se outro PR subir antes, use a seguinte à de `origin/main` no rebase.
- `test/cli.test.mjs:50` — `'0.1.33'` → a mesma versão do `plugin.json`.

## Passos (teste antes do código; o vermelho falha pelo motivo certo)

### Commit 1 — `fix(orquestracao): as skills do papel acham a sessão nova em qualquer conta`
1. Em `skills-do-papel.test.mjs`, troque o layout: registros em `app/ACC/ORG/` (constantes `ACC = 'acc-atual'`, `ORG = 'org-x'`), e `env()` com `CLAUDE_CODE_ACCOUNT_UUID: ACC`, `CLAUDE_CODE_ORGANIZATION_UUID: ORG` por padrão. O caso 7a (linha 135) grava o registro na mesma pasta nova. Rode o arquivo e confirme que os casos existentes seguem verdes (o layout novo não muda o comportamento antigo, que desliga o filtro).
2. Escreva os casos F70. Em todos, monte também uma **conta velha** `app/acc-velha/ORG/` com um membro `local_VELHO` (título `E9 · livre`, worktree próprio):
   - **F70.1 `<local_…>` acha a sessão sem conta nenhuma, no caminho de produção:** rode **sem `POOL_APP_SESSOES_DIR`** (o caminho que roda de verdade), com `HOME` temporário e os registros em `<HOME>/Library/Application Support/Claude/claude-code-sessions/ACC/ORG/`; sem as duas envs do app e sem `conta-atual.txt` em lugar nenhum → `local_E3` sai `aplicado`, exit 0. Hoje: exit 2 com `não sei qual é a conta atual` (C1).
   - **F70.2 `<local_…>` de outra conta também acha:** `aplicar('local_VELHO')` com as envs em `ACC` → `aplicado` (D1).
   - **F70.3 `--todos` lê só a conta das envs:** saída tem `E3` e não tem `E9` (D2, D3). Precondição no mesmo caso: com as envs em `acc-velha`, a saída tem `E9` e não tem `E3` (prova que a conta velha seria lida se fosse a atual).
   - **F70.4 `--todos` fora do app usa `<BASE>/pool/conta-atual.txt`:** sem as envs, arquivo com `acc-velha/ORG` → só `E9`. Com o arquivo **na pasta do script** e não em `<BASE>/pool/`, recusa (prova que o lugar velho não vale mais) — use uma cópia do script num diretório temporário para não sujar o repo.
   - **F70.5 sem envs e sem arquivo, `--todos` recusa:** exit 2, stderr cita `CLAUDE_CODE_ACCOUNT_UUID` e `conta-atual.txt`.
   - **F70.6 env e arquivo discordam:** envs em `ACC`, arquivo em `acc-velha/ORG` → lê `ACC` (só `E3`), stderr tem o aviso, exit 0.
   - Para rodar com exit diferente de 0 e ler stderr, use `spawnSync` (síncrono, `timeout`, `killSignal: 'SIGKILL'`), não `execFileSync`.
3. Rode `node --test plugins/orquestracao/hooks/tests/skills-do-papel.test.mjs` e **cole a saída vermelha**. F70.1 tem de falhar pela mensagem `não sei qual é a conta atual` (C1); F70.3 tem de falhar por listar `E9` (o filtro desligado sob `POOL_APP_SESSOES_DIR`, D3). Falha de import ou de precondição: conserte o teste antes.
4. Conserto no script, conforme D1–D4. `BASE` vem de `../hooks/hooks-crewai-comum.mjs` (já exporta `BASE`, respeitando `HOOKS_CREWAI_BASE`).
5. Rode o arquivo de novo: todos os casos (antigos e F70) verdes. Commit.

### Commit 2 — `docs(orquestracao): a conta do pool vem do app`
6. `skills-por-papel.md:15` com a regra nova (D1, D2). Rode o caso 10 do teste (nomes do JSON × `.md`), que lê esse arquivo.
7. Versão do plugin e `test/cli.test.mjs`. Commit.

### Fechamento
8. Gate: `npm test`. Cole a contagem final.
9. **Medição ao vivo (só leitura):** do worktree, rode o script do repo com `--dry-run` para uma sessão viva da conta atual, sem env de teste:
   `node plugins/orquestracao/pool/aplicar-skills-do-papel.mjs <local_… de um membro vivo> --dry-run`
   Esperado: linha `aplicaria` ou `igual`, nunca "não encontrada" nem "não sei qual é a conta". E `--todos --conferir` lista os membros da conta `2d62741f-…`. Cole as duas saídas. Não rode sem `--dry-run`/`--conferir`: aplicar de verdade em worktree alheio fica para a orquestradora depois do merge.
10. Push, PR para `main` com o rebase em dia. Não mergeie.

## Critério de pronto
- F70.1–F70.6 verdes, e o vermelho de F70.1 e F70.3 colado com o motivo certo.
- `npm test` verde.
- Saída real do passo 9 colada no PR: uma sessão viva achada e `--todos --conferir` na conta atual.
- `grep -n "join(AQUI, 'conta-atual.txt')" plugins/` sem resultado.

## Fora de escopo
- Aplicar as skills de verdade nos membros que abriram sem elas (E2, V2, P1…): é da orquestradora, depois do merge e do `claude plugin update`, com `--todos`.
- Mexer em `~/.claude/` (inclusive apagar ou corrigir `conta-atual.txt` e a cópia velha do script).
- Saber se a sessão já aberta recarrega o `settings.local.json` (questão aberta em `skills-por-papel.md`, outra frente).

## Regras do projeto (CLAUDE.md)
- Node ≥ 20, ESM, só módulos nativos; testes em `node:test`/scripts de teste do próprio arquivo, nunca vitest.
- Script termina por `process.exitCode`, nunca `process.exit()`.
- Testes nunca tocam `~/.claude` real: `HOME`, `HOOKS_CREWAI_BASE`, `POOL_APP_SESSOES_DIR` em diretório temporário, e as envs `CLAUDE_CODE_ACCOUNT_UUID`/`CLAUDE_CODE_ORGANIZATION_UUID` sempre sobrescritas ou apagadas.
- Processo filho de teste síncrono, com `timeout` e `killSignal: 'SIGKILL'`.
- Teste que mede ausência prova antes que a presença seria detectada (precondições de F70.3 e F70.4).
- Commits conventional em PT-BR, sem citar ADR no título.

<a id="medicao"></a>
## Medição
- `cat ~/.claude/orquestracao/pool/conta-atual.txt` → `ad15cbb2-049d-4c7f-86b9-336a2602905f/6b835fe9-9608-47d2-acfd-7097252618a2` (arquivo de 24/10 12:32).
- Último registro gravado por pasta de conta (`claude-code-sessions/<conta>/<org>/local_*.json`): `ad15cbb2-…` 25/10 20:43 (24 registros); `2d62741f-…` 26/10 07:37 (88 registros).
- `find … -name 'local_67abeed7*'`, `'local_6d091720*'`, `'local_2ea799d0*'` → os três em `2d62741f-…/6b835fe9-…/`.
- Envs da sessão (Bash desta P4): `CLAUDE_CODE_ACCOUNT_UUID=2d62741f-7f6e-4cca-94ad-b69b20c17852`, `CLAUDE_CODE_ORGANIZATION_UUID=6b835fe9-9608-47d2-acfd-7097252618a2`.
- `ls ~/.claude/plugins/cache/kit-de-orquestracao/orquestracao/0.1.33/pool/` → sem `conta-atual.txt`.
- Contagem de overrides do mapa por papel (`configDoPapel` sobre `skills-por-papel.json` do repo): E 31, V 21, P 35, D 34.
