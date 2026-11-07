# Comandos

Três lugares: o **CLI `kit`**, que você roda na raiz do projeto para pôr, conferir e tirar o kit; os **comandos do plugin**, que as sessões usam no terminal delas (e você também, se quiser); e os **comandos de barra**, que você digita no chat.

## O CLI `kit`

Roda sem instalar nada, na raiz do projeto:

```bash
npx -y github:ichikawacraice/kit-de-orquestracao <subcomando>
```

Abaixo, `kit` abrevia essa linha.

| Comando | O que faz |
|---|---|
| `kit contexto` | Mostra o manual e o catálogo; aceita um caminho para ler a instrução original |
| `kit executar` | Executa um comando do plugin com os argumentos seguintes, sem depender do PATH do Claude |
| `kit ajuda` | Mostra a lista de subcomandos e flags |
| `kit --version` | Mostra a versão do CLI |
| `kit iniciar` | Prepara um projeto **sem** `CLAUDE.md`: cria o `CLAUDE.md`, o gate, a guarda, o `.claude/kit.json` e o lock, e troca o `npm test` pelo gate. Recusa se já há `CLAUDE.md` |
| `kit adotar` | Põe o kit num projeto **em andamento** sem sobrescrever nada. Recusa se não há `CLAUDE.md` |
| `kit doutor` | Confere o plugin instalado e ligado no projeto, hooks duplicados, o `kit.json`, as versões do Node, do git e do lock, e os arquivos do kit contra o lock. Não grava nada |
| `kit atualizar`<a id="kit-atualizar"></a> | Troca pela versão nova o que você não editou; o que você editou vira conflito para você decidir |
| `kit remover` | Tira o que o kit pôs: blocos do `CLAUDE.md`, chaves dos JSON e arquivos cujo hash ainda bate com o lock. O que você editou fica |
| `kit migrar-marketplace`<a id="kit-migrar-marketplace"></a> | Para quem instalou o kit antes de ele se chamar `ichikawa-kit`: troca as instalações do marketplace `kit-de-orquestracao` na conta e nos projetos, guardando o liga/desliga, as opções e os dados dos plugins. Roda de qualquer pasta. Sem `--aplicar` só mostra; com `--aplicar` faz backup antes, e falha no meio desfaz sozinha. Depois, reinicie o app ([Problemas comuns](problemas-comuns.md#nome-antigo)) |

As flags:

| Flag | Em | Efeito |
|---|---|---|
| `--simular` | `adotar`, `atualizar`, `remover` | Mostra o que faria, sem gravar. Use sempre antes da primeira vez |
| `--perfil simples\|pnpm-workspace` | `iniciar`, `adotar` | O formato do gate: `simples` (um pacote: o gate roda a suíte do projeto) ou `pnpm-workspace` (monorepo pnpm, pacotes lidos do `pnpm-workspace.yaml`) |
| `--design <pasta do front>` | `iniciar`, `adotar` | Projeto com tela: modelos de design na pasta e o plugin Impeccable recomendado no `settings.json`, com a telemetria dele cortada |
| `--trocar-test` | `adotar`, `atualizar` | O `npm test` passa a ser o gate; a sua suíte vai para `test:projeto`. Sem ela, o `test` continua o seu e o `doutor` lembra a pendência |
| `--parcial` | `adotar` | Com conflito, grava o resto (sem ela, conflito não grava nada) |
| `--aplicar` | `migrar-marketplace` | Grava a troca (sem ela, só mostra) |
| `--projeto <pasta>` | `migrar-marketplace` | Inclui um projeto que ele não acharia sozinho (ele já olha os projetos que o Claude Code conhece). Repete-se |
| `--desfazer <pasta do backup>` | `migrar-marketplace` | Volta ao estado de antes da troca; a pasta sai no fim do `--aplicar` |

Flag desconhecida, em qualquer subcomando, sai com código 2 e a lista das válidas, sem gravar nada.

### O que surpreende no CLI

- **Bloco renomeado aparece duas vezes.** Quando uma versão nova renomeia um bloco do `CLAUDE.md`, o `kit atualizar` não apaga o antigo (pode ter texto seu): avisa `o bloco X saiu do kit; deixei como está` e acrescenta o novo no fim. Apague o antigo à mão.
- **Instalação interrompida.** Se o `iniciar` ou o `adotar` morrer no meio, rode o `kit adotar` de novo: ele reconhece a instalação pela metade, conclui e grava o lock.
- **`gate.comandoCompleto` não pode chamar `npm test`** (nem `pnpm test`/`yarn test`): o `test` é o gate, e o gate chamando o `test` esperaria a própria vez para sempre. Aponte para o script da suíte (ex.: `npm run test:suite`). O gate recusa esse laço com código 2 e o `kit doutor` avisa.

## Os comandos do plugin

O plugin `orquestracao` põe estes comandos no `PATH` das sessões. Fora de uma sessão, chame pelo caminho do plugin instalado (`claude plugin list` mostra onde está).

| Comando | O que faz | Quem usa |
|---|---|---|
| `painel` | Lê e grava o painel: `get`, `list`, `update`, `com`, `soltar`, `pode-reiniciar`, `fila-de-merge` e outros (a lista completa está no cabeçalho de `skills/orquestradora/scripts/painel.mjs`). O painel só se grava por ele | Todas as sessões |
| `painel pode-reiniciar` | Diz se dá para reiniciar o app agora e por quê | Você, antes de reiniciar |
| `painel fila-de-merge <PR:sha>…` | Monta os PRs sobre a base, roda o gate uma vez e mergeia o que passou | A orquestradora |
| `proximo-item` | O próximo ID de item (`F13`), único em toda a máquina | A orquestradora |
| `proxima-pergunta` | Só reserva o próximo ID de pergunta (`Q42`), único em toda a máquina; para perguntar, `painel perguntas nova '<json>'`, que reserva, grava e imprime o ID | Quem precisa só do número |
| `testes-afetados` | Lista os testes afetados pelo diff da branch; com `-- <comando>`, roda só eles | A dona, durante o trabalho |
| `esperar-fundo [--arquivo <marcador>] [--max <s>]` | Segura o turno até os subagentes da sessão terminarem (ou o marcador existir), até 9 min; sai 3 se o tempo passou | A dona, esperando o validador sem terminar o turno |
| `subir-versao` | Sobe a versão dos plugins mudados num commit só, depois de um lote de merges. Recusa com a árvore suja | Quem mantém o kit |
| `atualizar-plugins [--seco] [--json]` | Atualiza o marketplace e os plugins do kit instalados na conta. Depois, reinicie o app | Você, ou o botão `Atualizar` do painel |
| `limpar-disco [--aplicar] [--passos worktrees,builds,logs]` | Libera disco em todo repositório que o app conhece: remove a worktree parada que passa em todos os critérios, apaga o `node_modules`/`.next`/`dist` da worktree parada há mais de 7 dias (a worktree fica) e corta os logs do kit acima de 1 MB. Sem `--aplicar` só relata; `--plist` imprime o agendamento do launchd | Você, ou o launchd que você instalar |

O gate tem os seus, em `scripts/kit/` do projeto: `npm test` é o gate completo (com `--trocar-test`) e `node scripts/kit/com-fichas.mjs -- <comando>` roda um comando de teste pelo teto de núcleos da máquina. Referência: [`gate/README.md`](../../gate/README.md).

## Os comandos de barra

| Comando | O que faz |
|---|---|
| `/painel` | Abre o pane do painel ao lado do chat |
| `/ausente on` | Na orquestradora: abre as donas que faltam e liga o modo ausente ([O dia a dia](dia-a-dia.md#ausente)) |
| `/ausente off` | Desliga o modo ausente; a orquestradora entrega o resumo do período |
| `/ausente` | Só diz se o modo está ligado |

As skills do kit também se chamam por barra quando você quiser forçar uma: `/orquestracao:handoff-de-sessao` (passar o trabalho a outra sessão ou retomar), `/orquestracao:notas-de-release`, `/processos:spec-driven`, `/processos:revisar-diff`, `/processos:auditoria-de-clique` e, com o plugin opcional de performance, `/kit-performance:performance-front`, `/kit-performance:performance-dados`, `/kit-performance:performance-entrega` e `/kit-performance:medir-performance`. No uso normal as sessões as carregam sozinhas.

## Frases que as sessões reconhecem

- *"você é a orquestradora"* — a sessão assume a orquestração do projeto.
- *"Q12 sim"*, *"Q12 não, faz X"*, *"Q12 adiar"* — resposta a uma pergunta.
- *"handoff"*, *"salva onde parei"* — grava o estado num arquivo para outra sessão (ou a mesma, depois de limpar) continuar.

## Entrada para Codex

`kit contexto [caminho]` mostra o manual e lê skills/agentes do catálogo.
`kit executar <comando> [argumentos]` chama os comandos do plugin pelo CLI,
inclusive no Codex sem o PATH do Claude. A entrada `AGENTS.md` é criada na
instalação/atualização, preservando arquivos do projeto. Veja [Claude e
Codex na ORCA](claude-e-codex.md) para modelos, identidade e limites dos hooks.
