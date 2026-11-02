# F323 · Subagente não se libera gravando a configuração das travas

## Premissa conferida
- `subagente-nao-edita.mjs` deixa livre toda a `~/.claude/` (LIVRES), e nela moram `~/.claude/orquestracao/subagente-pode-escrever.txt`, a lista que o próprio hook lê. Um subagente grava `*` ali pelo `Write` e libera todo tipo, em todo lugar. Confirmado.
- A brecha é maior que a lista: a mesma pasta livre guarda o resto da configuração das travas.

## Arquivos do mesmo tipo (o que afrouxa uma trava se um subagente grava)
| Arquivo | Trava que afrouxa |
|---|---|
| `orquestracao/subagente-pode-escrever.txt` | `subagente-nao-edita` (libera o tipo) |
| `orquestracao/trava-edicao-repos.txt` | `orquestradora-nao-edita` (tira o repo da trava) |
| `orquestracao/ativas/<sid>` | `orquestradora-nao-edita` (repo do marcador) e T6 da `travas-da-sessao` (criar o marcador faz a sessão "orquestradora" e o `gh pr merge` passa) |
| `orquestracao/operador-ausente.json` | T3 (desligado: abre sessão sem o operador) e T7 (ligado: a orquestradora se limpa sozinha) |
| `orquestracao/hooks-crewai-estado.json` | `criterio-da-dona` (contadores de cobrança: "esgotado" deixa passar) |
| `~/.claude/settings.json`, `settings.local.json` | todas (desliga o plugin ou troca hooks) |
| `~/.claude/plugins/` | todas (o código destes hooks mora no cache) |
| `orquestracao/pool-registro-cache.json` | T6 (cache forjado com título de orquestradora e `em` no futuro faz o `gh pr merge` passar sem pergunta) |
| `orquestracao/batida/` | T6 indireta (a batida nomeia a orquestradora e o início de sessão recria o marcador de `ativas/`) |
| `.claude/settings.json` e `settings.local.json` de qualquer pasta (o do projeto também) | todas (desliga plugin ou hook) |
| `~/.claude/projects/**/*.jsonl` (transcripts) | T3 e T7 (decidem pelo turno do operador gravado ali) |
| `orquestracao/painel/`, `orquestracao/limpeza/` | T7 (o arquivo de `limpeza/` é o clique do operador) e as respostas do painel. A T5 da `travas-da-sessao` os fecha só na grafia exata; aqui entram com caixa, symlink e dev:ino |
| exceção: `~/.claude/plugins/data/` | dados de plugin entre sessões (`CLAUDE_PLUGIN_DATA`): segue livre |

## Caminhos comparados
- **Recusar ao subagente esses arquivos (escolhido).** Uma lista curta no próprio hook, antes da lista de tipos: nem o tipo liberado a grava. Sem migração, sem mudar onde nada mora. Compara na forma que o disco do macOS iguala (caixa e compatibilidade Unicode: `ſ` vale `s`), pelo caminho lido e pelo real, e pelo próprio arquivo (`dev:ino`: link físico).
- **Mover a liberação para fora da pasta livre.** Para onde? Toda a `~/.claude/` é livre (os plugins também); levar a lista ao repo a torna por projeto e não fecha os outros arquivos. Mover só desloca o problema: o que protege é a recusa.

## Bash
O hook não olha Bash de propósito (parsear shell deu alertas falsos). Fechamento estreito: o subagente cujo comando cita pelo nome um arquivo da configuração das travas **e** grava (redireção, `tee`, `sed -i`, `cp`, `mv`, `rm`, `writeFile`…) é recusado. O matcher do hook ganha `Bash`.
Fica descoberto (cerca contra deslize, não cofre): nome montado por variável ou codificado, `cd` para a pasta e nome relativo sem o trecho do caminho (`cd ~/.claude/orquestracao && echo '*' > subagente-pode-escrever.txt` é pego; `cd … && echo > "$(ls | head -1)"` não), `claude plugin install/disable`, o processo filho que grava sem o nome no comando, e os transcripts (incluí-los recusaria a análise que lê um transcript e grava no scratchpad). Leitura que redireciona para outro arquivo (`cat ~/.claude/settings.json > /tmp/s.json`) ou procura por `writeFileSync`/`rm` no código do plugin é recusada à toa; o motivo manda usar o Read ou o Grep.

## Fora do escopo
- A sessão (sem `agent_id`) grava tudo isso: é ela quem decide.
- `volta-da-limpeza/`: só acorda a sessão, não afrouxa trava.
- `nucleos-de-teste/teto.json`: o teto de núcleos é coordenação de carga, não trava.

## Pronto quando
- Testes F323.1–8 em `hooks/tests/hooks-crewai.test.mjs` verdes, vistos vermelhos antes do código.
- `hooks.json` e `hooks-json.test` com o matcher novo; `papeis-e-modelos` descreve a trava.
