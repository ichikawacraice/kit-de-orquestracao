# ADR 0029 — Limpador de disco no plugin, para todo repositório

- Data: 2026-11-05
- Status: Proposto
- Autor: sessão dona do F428, a partir do pedido do operador em 05/11 ("estamos fazendo limpeza de arquivos e logs antigos para não pesar no HD?" → "ok pode abrir a F428")
- Relacionados: [plano](../planos/2026-11-05-limpeza-de-disco.md)

<a id="contexto"></a>
## Contexto
- As worktrees das sessões donas ocupam o disco: Izanagi com 64 GB (105 pastas, 47 com `node_modules`), battlewand com 13 GB, kit com 3,6 GB, design-system com 2,4 GB e WiControl com 2,3 GB.
- O limpador que existia (`~/.claude/orquestracao/limpador-de-worktrees/`, launchd a cada 6 h) não estava em nenhum repositório e cobria só o Izanagi. Ele removeu 0 worktrees nas últimas cinco rodadas.
- O critério 9 ("parado há mais de 2 h") lia o mtime do `logs/HEAD`. O `git gc --auto` roda `reflog expire --all`, que regrava o reflog de todas as worktrees sem acrescentar entrada. Isso foi medido em 05/11 às 18:03: 57 worktrees tiveram o mtime mudado no mesmo segundo do `gc`. Toda rodada depois de um `gc` via atividade recente em todas as worktrees.
- O critério 9 não é o que mais segura worktree. Dos 58 mantidos numa rodada, só 9 ficaram apenas por ele. As outras ficam por trabalho ignorado, operação pausada, commit sem push ou sessão viva. O ganho grande está nos `node_modules` das worktrees que precisam ficar.
- Os logs do kit crescem sem teto: `hooks-crewai.log` com 1,5 MB, `fila-hook.log`, `testes-afetados-acerto.jsonl` e o `launchd.log` do limpador.

<a id="decisao"></a>
## Decisão
- **O limpador mora no plugin `orquestracao`:** `limpeza/limpador.mjs`, chamado pelo wrapper `bin/limpar-disco`. Roda em modo relatório por padrão e só apaga com `--aplicar`. Com `--se-ligado`, só apaga se existir o arquivo `aplicar-ligado` na pasta de saída (`~/.claude/orquestracao/limpador/`).
- **Todo repositório:** sem `--repo`, os repositórios vêm do `baseRepo` do registro de worktrees do app e das pastas de todas as sessões, arquivadas inclusive, deduplicados pelo diretório git comum.
  - Uma medição global que falha (sessões, `lsof`, registro do app, `protegidos.txt` ilegível, trava) derruba a rodada inteira.
  - A falha de um repositório (`git worktree list`, origin ilegível, `gh`) tira só aquele repositório do passo worktrees. Nos dois casos a saída é 2.
  - O repositório sem origin ou com a origin fora do GitHub (Wake no `git.fbits.net`, Bitbucket) também fica fora do passo worktrees, mas como aviso, sem saída 2: é o estado dele, não uma medição que falhou. O critério 4 (PR mergeado) não se mede ali, então nenhuma worktree dele sai; o passo builds segue nele. Na máquina, em 05/11, eram 15 dos 28 repositórios.
- **Critério 9:** a atividade é a maior entre:
  - a hora do último commit;
  - a hora da **última entrada** do reflog, lida do conteúdo e não do mtime;
  - o mtime do `index`;
  - o transcript do subagente dono da worktree;
  - o transcript da sessão cujo cwd é a worktree.

  O relatório diz qual dessas fontes decidiu.
- **`protegidos.txt`:** vale a união da lista da pasta nova com a do limpador antigo (`limpador-de-worktrees/protegidos.txt`), com um aviso que pede a cópia. Assim a proteção não cai na troca de pasta. As duas ausentes valem lista vazia, porque numa máquina nova ninguém escreveu a lista ainda. Se uma lista existe e não abre, segue sendo falha fechada.
- **Passo builds:** a worktree parada há mais de 7 dias (`--dias-builds`) perde as pastas regeneráveis ignoradas (`node_modules`, `.next`, `.next-<n>`, `dist`, `.turbo`). A prova é a mesma do critério 6: o nome está na lista, a pasta-mãe tem `package.json` rastreado e uma sonda no mesmo lugar não é ignorada.
  - O passo não toca a principal, worktree travada, protegida, reservada pelo app, com sessão viva ou com processo dentro.
  - Elos simbólicos e pastas cujo caminho real sai da worktree também ficam.
  - O `lsof` é reconferido logo antes de apagar. A worktree em si fica.
- **Passo logs:** os `*.log` e `*.jsonl` da pasta do kit acima do teto (`--teto-log-mb`, padrão 1 MB) ficam com no máximo metade do teto: os bytes mais novos, cortados em começo de linha.
  - O corte grava num arquivo temporário com o mesmo modo e troca por `rename`, preservando o `0600`.
  - Ficam de fora `backups/`, `arquivo-morto/` e `node_modules/`.
- **Agendamento:** `limpar-disco --plist` imprime um plist do launchd que, a cada 6 h, roda o `limpar-disco` da versão mais nova do plugin no cache com `--aplicar --se-ligado --resumo`. Instalar o plist é do operador; o plugin não grava em `~/Library/LaunchAgents`.

<a id="alternativas-consideradas"></a>
## Alternativas consideradas
- **Manter o limpador em `~/.claude/orquestracao/` e só consertar o critério 9.** Rejeitada: segue fora do controle de versão e sem teste no gate, cobre um repositório só e não libera os `node_modules`, que são o grosso do disco.
- **Critério 9 só pelo commit e pelo índice, sem reflog.** Rejeitada: `checkout`, `reset` e `rebase` são atividade que não gera commit novo. A entrada do reflog tem a hora do gesto; só o mtime do arquivo é que mente.
- **Apagar os `node_modules` de toda worktree mantida, sem esperar dias.** Rejeitada: a dona que volta amanhã reinstala tudo. Sete dias parada é o sinal de abandono que não custa a quem está trabalhando.
- **Usar `git clean -X` no passo builds.** Rejeitada: ele apaga todo ignorado, inclusive `.env` e pastas de trabalho como `.estudos/`. A lista explícita, com a mesma prova do critério 6, só tira o que se regenera.
- **Rotacionar os logs (`.1`, `.2`) em vez de cortar.** Rejeitada: os logs do kit são lidos pelo fim (diagnóstico do dia). A rotação dobra o espaço ocupado e quem lê teria de juntar os arquivos.
- **O plugin instalar o launchd sozinho.** Rejeitada: é configuração persistente fora do plugin, que a regra do repositório reserva ao operador.

<a id="consequencias"></a>
## Consequências
- Um `gc` não segura mais todas as worktrees por 2 h. As 9 que ficavam só pelo critério 9 voltam a ser candidatas.
- O disco das worktrees que ficam é liberado aos poucos, sem mexer no trabalho.
- O job antigo segue rodando até o operador trocá-lo. A pasta de saída nova é outra. O `aplicar-ligado` precisa ser copiado na troca de propósito: sem ele, o job novo só relata. O `protegidos.txt` antigo segue lido até ser copiado.
- **Limite conhecido:** o transcript da sessão é achado pelo nome codificado do cwd. A sessão cujo cwd é uma subpasta da worktree não conta por esse caminho; conta pelos outros critérios (sessão viva, processo dentro).
