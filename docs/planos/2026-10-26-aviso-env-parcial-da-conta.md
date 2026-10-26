# F79 · as skills do papel avisam quando só uma das duas variáveis da conta está definida

Origem: achado baixo da V1 no PR #30 (laudo `F70-laudo-V1.md`, bordas 1 e 2). Branch: `claude/f79-env-parcial-da-conta`, a partir de `origin/main` (`aa8fda6`).

## O caso
`plugins/orquestracao/pool/aplicar-skills-do-papel.mjs`, com `--todos`, tira a conta de `CLAUDE_CODE_ACCOUNT_UUID` + `CLAUDE_CODE_ORGANIZATION_UUID` e, sem as duas, de `<BASE>/pool/conta-atual.txt` (`contaAtual()`, linhas 23–34). Medido no código de `origin/main`:
- **Só uma env, com arquivo:** `if (acc && org)` falha, o script usa o arquivo e não diz nada. Quem rodou acha que está na conta do app e está na do arquivo.
- **Só uma env, sem arquivo:** exit 2 com `faltam CLAUDE_CODE_ACCOUNT_UUID/CLAUDE_CODE_ORGANIZATION_UUID` (linha 110), embora uma delas esteja definida.

## Decisões (assumidas, a confirmar; reversíveis)
- **D1. Env parcial não vale como conta: o script avisa e segue para o arquivo.** Aviso em stderr, sem mudar o exit: `só CLAUDE_CODE_ACCOUNT_UUID está definida, falta CLAUDE_CODE_ORGANIZATION_UUID: a conta sai de <arq>` (o nome de cada uma conforme o caso). Alternativa recusada: exit 2 com env parcial. Motivo: segue o padrão da D4 do F70 (discordância vira aviso, não recusa) e não quebra quem roda fora do app com o arquivo certo.
- **D2. A recusa (sem conta nenhuma) diz o que falta de fato.** Com uma env presente: `não sei qual é a conta atual: falta CLAUDE_CODE_ORGANIZATION_UUID (CLAUDE_CODE_ACCOUNT_UUID está definida) e não há <arq>`. Sem nenhuma: a mensagem de hoje, intacta (o F70.5 a cobre).
- **D3. Com as duas envs, nada muda:** nem aviso novo, nem leitura diferente.

## Arquivos
- `plugins/orquestracao/pool/aplicar-skills-do-papel.mjs` — `contaAtual()` e a mensagem do exit 2 em `main` (D1, D2). Sugestão: `contaAtual()` devolve `{ conta, falta }` (ou escreve o aviso ela mesma) para `main` montar a mensagem; o desenho interno é da E.
- `plugins/orquestracao/hooks/tests/skills-do-papel.test.mjs` — casos F79 depois do F70.6, reaproveitando `rodar`, `contaVelha`, `gravarContaAtual`, `VELHA`, `ACC`, `ORG`.
- `plugins/orquestracao/.claude-plugin/plugin.json` — `0.1.35` → `0.1.36`. Se outro PR subir antes, a seguinte à de `origin/main` no rebase.
- `test/cli.test.mjs:50` — `'0.1.35'` → a mesma do `plugin.json`.

## Passos (teste antes do código; o vermelho falha pelo motivo certo)
1. Escreva os casos:
   - **F79.1 só `ACCOUNT`, com arquivo:** `semEnv: ['CLAUDE_CODE_ORGANIZATION_UUID']`, `contaVelha()`, arquivo `${VELHA}/${ORG}` → exit 0, saída com `E9` e sem `E3`, stderr cita `CLAUDE_CODE_ORGANIZATION_UUID` e `conta-atual.txt`.
   - **F79.2 só `ORGANIZATION`, com arquivo:** o espelho do F79.1 (stderr cita `CLAUDE_CODE_ACCOUNT_UUID`).
   - **F79.3 só `ACCOUNT`, sem arquivo:** exit 2; stderr cita `CLAUDE_CODE_ORGANIZATION_UUID` como a que falta e **não** contém `faltam CLAUDE_CODE_ACCOUNT_UUID/`.
   - **F79.4 as duas envs, sem arquivo:** exit 0 e stderr sem a palavra `falta` (D3). Ausência medida só depois de o F79.1 provar que o aviso, quando existe, é detectado pela mesma regex.
2. Rode `node --test plugins/orquestracao/hooks/tests/skills-do-papel.test.mjs` e **cole a saída vermelha**: F79.1–F79.3 falham pelo stderr (sem aviso / mensagem "faltam" das duas), não por exit nem por precondição. F79.4 já passa (é guarda de regressão).
3. Conserto no script (D1, D2). Comentário do topo de `contaAtual()` ganha uma linha com a regra da env parcial.
4. Arquivo de teste inteiro verde (casos antigos, F70 e F79). Commit `fix(orquestracao): as skills do papel avisam quando só uma env da conta vem do app`.
5. Versão do plugin e `test/cli.test.mjs`; commit `chore(orquestracao): 0.1.36 para o cache pegar o aviso da conta`.
6. Gate: `npm test`; cole a contagem final.
7. **Medição ao vivo, só leitura:** do worktree, `env -u CLAUDE_CODE_ORGANIZATION_UUID node plugins/orquestracao/pool/aplicar-skills-do-papel.mjs --todos --dry-run` e cole stderr e exit. Esperado: o aviso da D1 e a conta de `~/.claude/orquestracao/pool/conta-atual.txt` (ou exit 2 com a mensagem da D2, se o arquivo tiver sido apagado).

## Critério de pronto
- F79.1–F79.4 verdes, e a saída vermelha do passo 2 colada no relatório.
- `npm test` verde sobre a árvore final.
- PR aberto contra `main`, rebase em dia, com a medição do passo 7 colada.

## Fora de escopo
- Regravar ou apagar `conta-atual.txt` (estado em `~/.claude` é da orquestradora).
- O ramo `<local_…>` (não depende de conta) e o aviso de discordância do F70.6.
- `skills-por-papel.md`: a regra do F70 continua certa; env parcial é detalhe do script.

## Regras do projeto (CLAUDE.md)
- Node ≥ 20, ESM, só módulos nativos; processo filho de teste síncrono, com `timeout` e `killSignal: 'SIGKILL'`.
- Testes nunca tocam `~/.claude` real: `HOME` e `HOOKS_CREWAI_BASE` em pasta temporária (o `env()` do arquivo já faz).
- Script termina por `process.exitCode`.
- Commits conventional em PT-BR; não mergeie: PR e número à planejadora.
