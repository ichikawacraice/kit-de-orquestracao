# F428 · Limpeza de disco: worktrees, builds e logs (05/11)

## O caso
O disco enche de worktrees de sessões donas: Izanagi 64 GB (105 pastas, 47 com `node_modules`), battlewand 13 GB, kit 3,6 GB, design-system 2,4 GB, WiControl 2,3 GB. O limpador que existia (`~/.claude/orquestracao/limpador-de-worktrees/limpador.mjs`, launchd a cada 6 h) não está em repositório nenhum, cobre só o Izanagi e removeu 0 nas últimas cinco rodadas.

## Premissa conferida
- **"Algo toca o gitdir de todas as worktrees": medido, é o `git gc --auto`.** Às 18:03:07 o `packed-refs` do Izanagi foi regravado, o `gc.pid` é de 18:03 e às 18:03:10–13 o `logs/HEAD` das 57 worktrees mudou de mtime **sem entrada nova**: o `gc` roda `reflog expire --all`, que reescreve o reflog de cada worktree. Commit e transcript não explicam (o reflog de 41 delas tem a última entrada há 4 a 14 dias). O `index` não sofre isso (mtimes espalhados).
- **O critério 9 não é o que mais segura:** dos 58 mantidos na rodada de 15:41, 50 têm o critério 9, mas só 9 seguram **só** por ele; os outros também têm `.env`/pasta de trabalho ignorada (23), operação pausada (12), commit sem push (10), sessão viva (10). Corrigir o 9 libera poucas worktrees; o ganho grande de disco está nos `node_modules` das que ficam.
- **Retenção dos transcripts:** a `cleanupPeriodDays` (padrão 30) não vale para as sessões do app; quem limita os transcripts do Desktop é a `desktopSessionCleanupPeriodDays` (v2.1.248+), ausente do `settings.json`. Há 3.689 arquivos com mais de 30 dias (1.213 transcripts e 2.476 de subagentes), o mais velho de 05/06. Mudar o settings é do operador: vai como pergunta.

## Desenho ([ADR 0029](../adr/0029-limpador-de-disco-no-plugin.md))
Um script do plugin, `limpar-disco` (`plugins/orquestracao/limpeza/limpador.mjs`), relatório por padrão, três passos:
1. **worktrees:** o limpador F15 portado inteiro, com os mesmos 10 critérios e a mesma falha fechada, mais:
   - cobre **todo repositório** que o app conhece (o `baseRepo` do registro de worktrees do app e o `originCwd` de cada sessão, deduplicados pelo diretório git comum), ou os `--repo` dados;
   - falha de um repositório (`gh` recusou, origin ilegível) pula só ele no passo worktrees (o passo builds segue nele), com o motivo no relatório e saída 2; repositório sem origin ou fora do GitHub também pula, como aviso e sem saída 2; falha de medição global (sessões, `lsof`, registro do app) segue derrubando a rodada;
   - **critério 9 novo:** a atividade é a maior entre a hora do último commit, a **data da última entrada do reflog** (o conteúdo, não o mtime), o mtime do `index`, o transcript do subagente e o transcript da sessão cujo cwd é aquela worktree;
   - `protegidos.txt` ausente vale lista vazia (máquina nova); ilegível segue sendo falha fechada.
2. **builds:** worktree parada há mais de N dias (padrão 7) que não é a principal, não está travada nem protegida, sem sessão viva nem processo dentro, perde as pastas regeneráveis ignoradas (`node_modules`, `.next`, `.next-<n>`, `dist`, `.turbo`) com a mesma prova do critério 6 (nome na lista, `package.json` rastreado na pasta-mãe, sonda não ignorada). A worktree fica; o relatório diz quanto liberou.
3. **logs:** os `*.log` e `*.jsonl` da pasta do kit acima do teto (padrão 1 MB) ficam com no máximo metade do teto (os bytes mais novos), cortados em começo de linha, preservando o modo do arquivo.

O agendamento: `limpar-disco --plist` imprime o plist do launchd; instalá-lo é do operador.

## Fora do escopo
- Apagar transcripts de `~/.claude/projects` (é a chave `desktopSessionCleanupPeriodDays` do Claude Code; pergunta ao operador).
- Instalar o launchd, aposentar o limpador antigo e a primeira passada `--aplicar` na máquina real (perguntas ao operador).
- Pastas soltas (`.claude/worktrees/` que o git não lista): seguem só no relatório.

## Pronto quando
- Testes do limpador portados e verdes, mais os novos (reflog regravado pelo `gc` não conta como atividade; transcript da sessão conta; dois repositórios numa rodada; repo sem GitHub pula só ele; builds liberados só em worktree parada e só o regenerável; log acima do teto fica com o fim; modo preservado).
- Laudo do modo relatório na máquina real colado no PR, sem nada apagado.
