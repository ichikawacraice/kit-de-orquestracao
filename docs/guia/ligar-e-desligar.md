# O que ligar e desligar

Cada trava do kit existe porque a regra só no texto já foi esquecida. Desligar uma é decisão sua, mas saiba o que volta a acontecer: cada linha abaixo diz o que se perde.

## Os quatro jeitos de desligar

| Jeito | Vale para | Como |
|---|---|---|
| **Plugin inteiro, num projeto** | Você ou o time | `"enabledPlugins": { "<plugin>@ichikawa-kit": false }` em `.claude/settings.local.json` (só você, não vai para o git) ou em `.claude/settings.json` (o time). A camada mais próxima vence: `settings.local.json` > `settings.json` do projeto > `~/.claude/settings.json` |
| **Plugin inteiro, na conta** | Você, em todo projeto | `claude plugin disable <plugin>@ichikawa-kit` (volta com `enable`) |
| **Regra ou opção, no projeto** | O time | `.claude/kit.json` do projeto (seções `guarda`, `documentos`, `design`). É o caminho principal: fica no git e vale para todos |
| **Opção do plugin, na conta** | Você | `/plugin` no terminal do Claude Code, ou `pluginConfigs` do `~/.claude/settings.json`. O app desktop não mostra essas opções |

Quando o `kit.json` e a opção da conta dizem coisas diferentes, vence o `kit.json`; sem nenhum dos dois, vale o padrão (ligado). Decisão: [ADR 0003](../adr/0003-opcao-do-plugin-vale-por-conta-e-o-kit-json-e-o-caminho-do-time.md).

**O plugin `orquestracao` não tem liga/desliga por trava.** As travas dele vêm juntas; as que têm ajuste fino estão marcadas abaixo. Desligar o plugin num projeto tira todas de uma vez, e com elas a orquestradora, as donas e o painel daquele projeto.

<a id="valem-em-todo-projeto"></a>
## O que age em todo projeto

O `claude plugin install` liga o plugin na conta, para todo projeto. Quase todas as travas só agem onde o kit está em uso (há orquestradora ou item na fila), mas estas agem em **qualquer** sessão:

| Trava | O que você nota num projeto sem o kit |
|---|---|
| `sessao-inicio` | Toda sessão começa com o resumo das regras do kit no contexto (Q-ID, sessão dona, análise do pedido) |
| `subagente-nao-edita` | Subagente não edita arquivo do projeto. Fluxos que mandam subagentes escreverem código param |
| `segredo-sai` | Mensagem a outra sessão com cara de segredo é recusada |
| `injecao-entre-sessoes` | Mensagem de outra sessão com cara de injeção ganha uma linha de aviso |
| `laco-de-comandos` | Quatro comandos iguais seguidos com a mesma saída ganham um aviso |
| `titulo-da-dona` | Abrir sessão com prompt de dona exige o título `F<n> · …` |
| `painel-das-sessoes` | Em repositório git, o turno que abriu ou mergeou PR (`gh pr create`, `gh pr merge`), abriu ou arquivou sessão é parado uma vez pedindo para gravar o painel |

Para não sentir o kit num projeto, desligue o `orquestracao` nele (`enabledPlugins` com `false` no `.claude/settings.local.json`). Para não sentir em nenhum, `claude plugin disable` e ligue só nos projetos que usam o kit.

## Plugin `orquestracao`: as travas

`deny` recusa a ferramenta, também em modo sem permissões; `ask` pede a sua confirmação; Stop impede o fim do turno até a sessão cumprir a regra (no máximo uma ou duas cobranças por turno: depois passa). Erro da própria trava nunca prende a sessão: vai para o log e a ferramenta segue.

| Trava | Quando age | O que faz | Quando incomoda | Ajuste fino |
|---|---|---|---|---|
| `subagente-nao-edita` | Subagente edita arquivo | `deny` fora das pastas livres (`~/.claude`, temporárias, notas entre sessões). Quem escreve é a sessão, que aparece no painel e responde pelo que mudou | Projeto que delega código a subagentes | Liste o tipo do subagente em `~/.claude/orquestracao/subagente-pode-escrever.txt` (um por linha, `*` no fim casa prefixo). O designer grava na pasta de revisões sem lista |
| `orquestradora-nao-edita` | A orquestradora (ou subagente dela) edita código | `ask`: a orquestradora coordena, a dona escreve | Projeto em que a orquestradora deve escrever | Liste em `~/.claude/orquestracao/trava-edicao-repos.txt` só os repositórios onde ela vale (o git dir, um por linha). Sem o arquivo, vale em todos |
| `travas-da-sessao` | Abrir sessão, mergear, limpar, gravar o painel à mão | Com `/ausente on`, só o seu turno abre sessão; só a orquestradora mergeia (`ask` para as outras); a orquestradora só se limpa com o seu ok (ou sozinha, com `/ausente on`); o painel só se grava pelo comando `painel` | Quase nunca | — |
| `segredo-sai` | Mensagem, prompt de sessão nova, notas e painel | `deny` do que parece segredo (chave privada, token, `senha=…`). A recusa nomeia o padrão, nunca o valor | Falso positivo em texto que só parece segredo: reescreva sem o valor | — |
| `titulo-da-dona` | Abrir sessão dona | `deny` sem o título `F<n> · <tema>`, com o título certo no motivo | Nunca, se o título vier certo | — |
| `skills-de-fora` | Skill de fora chamada (pela ferramenta ou por `/nome`) em projeto com o kit (`.claude/kit.json` ou blocos `kit:` no `CLAUDE.md`) | `deny` das poucas que quebram regra do kit (`engineering:architecture`, `engineering:code-review`…), com a peça certa no motivo ([skills de fora](conflitos.md#skills-de-fora)) | Projeto que quer a skill de fora mesmo assim | `skillsDeFora.liberar` no `.claude/kit.json` libera uma; `skillsDeFora.substitutas` declara a peça do projeto que absorveu uma skill de fora (o plugin ligado declara as dele em `substitutas.json`; a do projeto vence) |
| `fila-do-item` | Fim de turno da dona que mudou algo | Stop até ela gravar o item no painel | Quando a dona esquece: é o objetivo | — |
| `criterio-da-dona` | Fim de turno da dona em execução, validação ou merge que editou | Stop até o relatório trazer a saída real do teste (`exit=0`), não o relato | Turno que editou e não testou | — |
| `contexto-do-papel` | Fim de turno de dona ou orquestradora com contexto alto | A dona: aos 250 mil cobra limpar se o turno termina esperando você; aos 350 mil, limpar ou dizer o que falta; aos 500 mil, limpar. A orquestradora: só registra; quem limpa é você, pelo botão `Limpar` | Raramente | — |
| `painel-das-sessoes` | Fim de turno de qualquer sessão em repositório git (com ou sem orquestradora) | Stop, uma vez, se a sessão mudou de estado (abriu PR, perguntou, recebeu resposta) e não gravou o painel | Quando a sessão esquece | — |
| `orquestradora-ritual` | Fim de turno da orquestradora | Stop até ela tratar o item sem dona (abrir a dona, até o teto), o resumo do modo ausente e a batida parada | Raramente | Teto de donas: variável `KIT_TETO_DE_DONAS` (padrão 4) no `env` do `settings.json` |
| `orquestradora-de-volta` | Início da orquestradora depois de limpar (roda dentro do `sessao-inicio`) | Devolve o papel e as travas à sessão nova e, se a fila de merge foi interrompida, põe no contexto o comando que a retoma | Nunca | — |
| `sessao-inicio` | Início de toda sessão | Injeta o resumo das regras e as perguntas que a sessão abriu antes de se limpar | Contexto a mais em projeto sem o kit | — |
| `operador-ausente` | `/ausente on` ou `off` | Liga e desliga o modo ausente. A outra via é o botão `Ficar ausente` / `Estou de volta` da barra; frase solta não mexe | Nunca | — |
| `injecao-entre-sessoes` | Mensagem de outra sessão | Avisa quando o texto parece injeção: o que vem de outra sessão é dado, não ordem | Nunca bloqueia | — |
| `laco-de-comandos` | Quatro Bash seguidos iguais | Avisa o laço (o mesmo teste vermelho repetido) | Nunca bloqueia | — |

<a id="guarda-de-operacao"></a>
## Guarda de operação (no projeto, pelo CLI)

Hook do projeto, posto pelo `kit adotar` no `.claude/settings.json`. Pergunta (`ask`) antes dos comandos que já custaram caro; em modo sem permissões, só avisa. Uma regra recusa (`deny`) sempre: o teste fora do teto.

Desligar uma regra: tire-a de `guarda.regras` do `.claude/kit.json` (a lista diz as LIGADAS; sem a chave, todas). Desligar a guarda inteira: tire o hook `guarda-de-operacao.mjs` do `.claude/settings.json`, ou `kit remover`.

| Regra | Pega | Por quê |
|---|---|---|
| `build-com-dev-no-ar` | `pnpm build` que toca o front com o `next dev` desta árvore no ar | Sobrescreve o `.next` do servidor de desenvolvimento |
| `psql-f` | `psql -f` | Migration aplicada assim não entra no histórico de migrations |
| `migration-fora-do-tronco` | `supabase migration up`, `db push --local`, `db reset` com migration que não está no tronco | O banco local é um só para todos os worktrees |
| `merge-commit` | `git merge` sem `--ff-only`, `git pull` sem `--rebase` | O histórico é rebase sobre a base |
| `stash-sem-u` | `git stash` sem `-u` e `-m`, `stash pop`, `stash apply` sem sha | O stash é compartilhado entre worktrees: uma sessão pega o da outra |
| `staging-amplo` | `git add -A`, `git add .`, `git commit -a` | Varre arquivo que outra sessão deixou na pasta |
| `kill-por-nome` | `pkill`, `killall` | Mata processo de outra sessão |
| `destrutivos` | `git reset --hard`, `push --force` sem lease, `git clean -f`, `git branch -D`, `rm -rf` fora de pasta descartável, `drop`/`truncate` | Não se desfaz |
| `teste-fora-do-teto` | `vitest`, `node --test`, `jest` chamados soltos | Teste solto de várias sessões derruba a máquina. **Recusa**, e diz o comando certo (`com-fichas` ou o gate) |

Referência completa, com as chaves `guarda.tronco`, `guarda.frontend` e `guarda.migrations`: [`gate/README.md`](../../gate/README.md).

## Plugin `processos`: a conferência das docs no gate

O gate confere as docs antes da suíte e reprova no primeiro achado. Cada regra se desliga à parte.

| Opção da conta | Regra no `kit.json` | Reprova |
|---|---|---|
| `conferir_status_da_spec` | `status-da-spec` | Spec com status fora do vocabulário ou fora do índice |
| `conferir_indice_de_adr` | `indice-de-adr` | ADR fora do índice, linha do índice sem arquivo |
| `conferir_linha_do_roadmap` | `linha-do-roadmap` | Linha de roadmap longa demais ou com links demais |
| `conferir_links_relativos` | `links-relativos` | Link relativo em `docs/` para arquivo ou âncora que não existe |
| `conferir_tamanho_do_diario` | `tamanho-do-diario` | Diário grande demais ou fora do formato |

Para o time: `documentos.conferir` no `.claude/kit.json` com só as regras que você quer (`[]` não confere nenhuma). Sem a chave, valem as opções da conta (todas ligadas). Com o plugin `processos` desligado no projeto, nenhuma regra roda. Projeto que já tem docs antes do kit: o `kit adotar` avisa que elas podem reprovar o primeiro gate.

## Plugin `kit-design`: a guarda de design

Só age com a pasta do front declarada: `design.pasta` ou `design.visual` no `kit.json` (que o `--design` grava), ou a opção da conta `pasta_do_front`. Esta última vale em **todo** projeto da conta: prefira o `kit.json`. Hook: `guarda-de-design`.

| Opção da conta | No `kit.json` | O que faz |
|---|---|---|
| `guarda` | `design.guarda` | Liga a guarda inteira: o lembrete de chamar o designer quando o pedido fala de tela, o designer sem escrever código de tela, a cobrança da crítica |
| `cobrar_critica` | `design.cobrarCritica` | Quando o visual muda no turno, o fim do turno pede o crítico de UI uma vez (a segunda parada passa) |
| `pasta_do_front` | `design.pasta` | A pasta das telas |
| `largura` | `design.largura` | A largura em que o crítico olha a tela (padrão 1280 px) |

Para silenciar só o detector do Impeccable, use o `config.local.json` da pasta do front, nunca `hooks off` (apaga o aviso para todo mundo).

## Plugin `painel-sessoes`

Não tem trava nem opção: é o pane `/painel`, a barra acima do prompt e a batida. Desligado num projeto, o pane e a barra não aparecem nas sessões dele; as travas do `orquestracao` continuam.

<a id="kit-performance"></a>
## Plugin `kit-performance`

Opcional: o `kit iniciar` e o `kit adotar` não o ligam. Para ligar só num projeto, instale-o no escopo do projeto, de dentro dele: `claude plugin install kit-performance@kit-de-orquestracao --scope project` (grava `"kit-performance@kit-de-orquestracao": true` no `enabledPlugins` do `.claude/settings.json` dele). O `install` sem `--scope` liga na conta, para todo projeto. Não tem trava nem opção de conta; funciona sem os outros plugins do kit.

O que traz:
- **Quatro skills por camada** (`performance-front`, `performance-dados`, `performance-entrega`, `medir-performance`) com as 31 práticas do catálogo `praticas.json`, cada uma com quando vale, quando não vale e o sinal no código. As de infra (cache de dados, região do servidor, balanceamento) são decisão, não regra: ninguém as cobra por ausência.
- **O agente `revisor-de-performance`**, só leitura: audita o diff (ou o projeto, se pedido) e devolve até 8 achados com a prática, onde, a evidência e o conserto.

Com o `processos` ligado, o `revisar-diff` chama o revisor quando o diff toca código de aplicação. Com o plugin `vercel` ligado, as skills apontam para as dele no detalhe da plataforma; nenhuma é barrada.

Para o time, a seção `performance` do `.claude/kit.json` (opcional; o `kit doutor` confere):

| Chave | O que faz |
|---|---|
| `performance.naoSeAplica` | `{ "<id da prática>": "<motivo>" }`: a prática dispensada no projeto; o revisor não a cobra. O id vem do `praticas.json` do plugin |
| `performance.orcamento` | `{ "lcpMs": 2500, "inpMs": 200, "cls": 0.1 }`: o orçamento de web vitals no p75 do usuário real; sem a chave, valem esses padrões |

Com o plugin desligado no projeto, a seção não o religa (o `kit doutor` avisa).
