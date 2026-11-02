# O piso da sessão: de onde vem o contexto que toda chamada relê

Data: 2026-11-02 (F347). Snapshot: não se edita; para medir de novo, `node scripts/piso-da-sessao.mjs --desde AAAA-MM-DD`.

## Resposta curta

- O piso mediano de uma sessão principal no app desktop é **105,5 mil tokens**; o de um subagente, **32,7 mil**. O piso responde por **46% da releitura das sessões principais** e 32% da dos subagentes (o resto é a conversa que cresce).
- **58% do piso é do próprio app** (system prompt e esquema das ferramentas: ~61 mil). O kit não alcança essa parte.
- **As hipóteses do pedido quase não se confirmaram.** As regras do kit repetidas custam ~1,5 mil; desligar plugin sem uso tira só os agentes dele (~1,8 mil com 11 plugins), porque **a lista de skills tem teto fixo (~10–11 mil) e não encolhe** quando sai plugin: o espaço volta a ser ocupado pelas descrições das que ficam.
- **O que pesa e se alcança:** o `CLAUDE.md` e o índice de memória do projeto de produto (**18,6 mil** em cada sessão principal, **~22 mil dos 33 mil** de cada subagente) e a janela de compactação (600→400 mil: **−6,5%** do custo de contexto, estimado).

## Como foi medido

Os transcripts do Claude Code (`~/.claude/projects/**/*.jsonl`) gravam a forma da 1ª requisição (`api-request-shape`: system prompt e esquema de cada ferramenta) e as mensagens dela (`api-request-blob`). O medidor (`scripts/piso-da-sessao.mjs`) separa esse texto por fonte (marcadores como `Contents of …CLAUDE.md`, `The following skills are available…`) e dá a cada fonte a parte dos tokens que a 1ª chamada pagou na proporção do tamanho dela: a soma bate com o piso medido no `usage`, e a fração de cada fonte é estimativa por tamanho (o tokenizador não é linear entre português, JSON e inglês). 223 de 227 transcripts principais desde 30/10 têm a forma gravada.

Três números não saem do medidor e vieram de scripts avulsos, descritos onde aparecem: a parte do piso na releitura, a tabela por projeto e a simulação da janela. A parte do piso na releitura: em cada chamada, o mínimo entre o piso da sessão e o que ela releu, somado e dividido pela releitura total (sessões desde 26/10):

```
main chamadas 68082 releitura 14.81 bi tokens; parte do piso 46%
sub chamadas 29111 releitura 2.69 bi tokens; parte do piso 32%
```

Para o antes/depois, sessões de teste do CLI (`claude -p "/context"`) numa pasta vazia com `.claude/settings.json` diferente em cada uma; o `/context` do CLI não traz as ferramentas do app desktop, então o total dele (~36 mil) é menor que o do app.

## Composição do piso (sessões desde 30/10)

```
$ node scripts/piso-da-sessao.mjs --desde 2026-10-30
subagente: piso 32.7 mil (mediana de 479 sessões)
  claude-md-projeto                         13.7 mil
  memoria                                    7.9 mil
  claude-md-global                           3.5 mil
  outros                                     3.3 mil
  ferramentas:nativas                        2.7 mil
  system-prompt                              1.7 mil
principal: piso 105.5 mil (mediana de 216 sessões)
  ferramentas:nativas                       16.1 mil
  system-prompt                             13.8 mil
  ferramentas:Artifact                      13.6 mil
  claude-md-projeto                         11.7 mil
  skills                                    11.3 mil
  ferramentas:mcp:Claude_Browser             8.2 mil
  memoria                                    6.8 mil
  agentes                                    3.7 mil
  outros                                     3.6 mil
  claude-md-global                           3.0 mil
  ferramentas:mcp:ccd_turn                   2.9 mil
  ferramentas:mcp:Claude_Code_iOS_Simulator   2.5 mil
  nomes-de-ferramentas-adiadas               1.8 mil
  ferramentas:mcp:visualize                  1.5 mil
  ferramentas:mcp:ccd_session                1.3 mil
  hook-superpowers                           1.3 mil
  hook-kit                                   1.0 mil
  ferramentas:mcp:<conector de docs>         0.6 mil
  mcp-instrucoes                             0.5 mil
  ferramentas:mcp:terminal                   0.4 mil
```

(Medianas por fonte; não somam exatamente o piso mediano. Linhas abaixo de 0,1 mil cortadas.)

Agrupado:

| Fonte | Tokens (principal) | Quem controla |
|---|---|---|
| App desktop: system prompt + ferramentas nativas + Artifact + navegador + simulador iOS + painéis | ~61 mil | o app; o navegador desliga em Configurações → Claude Code → Browser |
| Lista de skills | 11,3 mil | teto fixo do Claude Code (ver abaixo) |
| `CLAUDE.md` do projeto + índice de memória | 3,2 mil (kit) a 18,6 mil (produto) | o projeto |
| Agentes de plugin | 3,7 mil | plugins ligados |
| `CLAUDE.md` global | 3,0 mil | a conta |
| Hooks de início (superpowers + kit) | 2,3 mil | plugins ligados |
| Nomes de ferramentas adiadas, MCP | ~2,8 mil | plugins e conectores |

Por projeto (mediana da sessão principal; o projeto de produto anonimizado; `pisoDoTranscript` do medidor agrupado pela pasta do transcript):

```
projeto                 sessões  piso  projeto memoria global skills
<produto>                    30  105.6   11.8    6.8    3.1   11.3
<produto, worktree>          19  107     11.8    7.1    3.1   11.3
<outro, worktree>            17   83.2    0.9    0      2.9   10.8
kit-de-orquestracao           9   86.6    2.9    0.3    2.9   10.8
<design system>               7   82.9    0.9    0      2.9   10.8
```

E dos subagentes: no projeto de produto o piso é ~33,6 mil, dos quais 13,7 mil de `CLAUDE.md` e 7,9 mil de memória; no kit, ~14,4 mil.

## As hipóteses do pedido, medidas

**1. "As regras do kit entram três vezes."** Entram, mas pesam pouco: hook do kit 1,0 mil, `CLAUDE.md` global 3,0 mil (dos quais ~1,6 mil repetem o resumo do kit: seções "Sessão orquestradora", "Papéis e modelos", "Não parar à toa" e o parágrafo do Q-ID), blocos `kit:` do `CLAUDE.md` do projeto ~1,5 mil. O `using-superpowers` inteiro, 1,3 mil no app; no CLI, desligar o superpowers zerou as mensagens de início (2,8 mil → 10), e o `/context` não separa um hook do outro. Repetição total ≈ 1,5–2 mil (1,5–2% do piso).

**2. "Plugins sem uso põem descrição de skill, agente e MCP em todo contexto."** Medido no CLI:

```
                         Skills  Custom agents  Messages  Total
base                      10k        2k          2.8k     36k
11 plugins desligados     10k        221         2.8k     34.2k
superpowers desligado     10k        1.7k        10       33k
SLASH_COMMAND_TOOL_CHAR_BUDGET=4000
                          3.3k  (System tools 12.4k → 19k)  36k
```

A lista de skills não encolheu com 11 plugins a menos (111 → 86 skills listadas, e as com descrição foram de 60 para 62): o Claude Code preenche um orçamento fixo de texto e corta as descrições que não cabem. Encolher o orçamento só move o texto para o esquema da ferramenta `Skill` (total igual). Os MCP de plugin (figma, 45 ferramentas) já entram adiados, só pelo nome. **O que desligar plugin tira de fato: os agentes (−1,8 mil com os 11) e o hook de início (superpowers, −1,3 a −2,8 mil).**

Achado lateral: **negar ferramentas pode aumentar o piso.** Com `permissions.deny: ["mcp__figma", …]` o total foi de 36 mil para 45,2 mil: sem o figma, as ferramentas MCP ficaram abaixo do limiar da busca de ferramentas e as ferramentas adiadas do sistema passaram a entrar inteiras (System tools 12,4 → 31,6 mil). Por isso o perfil do kit desliga plugin (`enabledPlugins`) e nunca nega ferramenta.

**3. "Compactar em 600 mil deixa as chamadas >300 mil pesarem."** Confirmado como alavanca. Simulação sobre as sessões principais desde 26/10 (68 mil chamadas, 14,8 bilhões de tokens relidos): ao passar da janela − 33 mil, compacta; o contexto volta a piso + 20 mil de resumo e cresce como cresceu de verdade; custo = 0,1 × releitura + 1,25 × escrita de cache.

```
janela 600 mil: custo relativo 100.0% compactações 0
janela 500 mil: custo relativo 98.8% compactações 22
janela 400 mil: custo relativo 93.5% compactações 121
janela 300 mil: custo relativo 84.8% compactações 367
```

Releitura e escrita são ~87% do custo; 400 mil ≈ **−5,7% do custo total**, com ~121 compactações a mais na semana (cada uma perde detalhe da conversa). É estimativa: supõe resumo de 20 mil e que a conversa depois da compactação cresce igual.

## O que o kit muda (F347)

- **Resumo do início sem o que o `CLAUDE.md` já traz.** A regra do resumo coberta por um bloco `kit:` sai quando o `CLAUDE.md` do projeto tem o bloco na versão que a traz (ou depois): 3.474 → 2.008 caracteres no projeto com os blocos do modelo atual (≈ −0,4 mil tokens por sessão principal); inteiro onde o kit não foi adotado ou onde o bloco é de versão velha (o próprio repositório do kit tem os blocos em v1: o ganho chega aqui depois de pôr os blocos em dia). Fica no `CLAUDE.md`, e não no hook, porque o `CLAUDE.md` chega também aos subagentes e o hook não.
- **Perfil de plugins no `.claude/kit.json`** (`plugins.desligar`), aplicado pelo `kit adotar`/`kit atualizar` no `.claude/settings.json` do projeto: cada projeto desliga o que não usa sem mexer na conta ([guia](../guia/ligar-e-desligar.md#perfil-de-plugins)).
- **O medidor** (`scripts/piso-da-sessao.mjs`), para medir de novo depois das mudanças na conta.

Antes/depois do hook, medido rodando as duas versões com o mesmo `cwd`:

```
projeto com os blocos do modelo antes: 3474 chars
projeto com os blocos do modelo depois: 2008 chars
este repo (blocos v1) antes: 3474 chars
este repo (blocos v1) depois: 3474 chars
<projeto sem o kit> antes: 3474 chars
<projeto sem o kit> depois: 3474 chars
```

## O que fica para a conta (proposta, não aplicada)

| Mudança | Efeito medido ou estimado | Risco |
|---|---|---|
| `autoCompactWindow` 600 → 400 mil | −6,5% do custo de contexto (≈ −5,7% do total), estimado | resumo perde detalhe em sessão longa |
| Tirar do `~/.claude/CLAUDE.md` o que o resumo do kit já diz (seções "Sessão orquestradora", "Papéis e modelos", "Não parar à toa", parágrafo do Q-ID) | ≈ −1,6 mil em toda sessão e todo subagente | o resumo não chega aos subagentes (eles não abrem sessão nem perguntam ao operador) |
| Desligar na conta os plugins sem uso diário: `claude-security` (9 agentes), `hookify`, `playground`, `project-artifact`, `insecure-defaults`, `document-skills` (repete `anthropic-skills`), `skill-creator` (está também como skill solta e em `anthropic-skills`); ligar por projeto onde servem | −1,8 mil (agentes) | perder a skill onde ela era usada sem lembrar |
| Superpowers: desligar nos projetos do kit (o kit já tem plano, revisão e TDD pelos próprios processos) | −1,3 a −2,8 mil | perde `brainstorming` e afins nesses projetos |
| Skills soltas repetidas em `~/.claude/skills`: `semgrep` e `static-analysis` (mesmo texto), `skill-creator`, `web-artifacts-builder` e `-2` | não encolhe o piso (teto), mas devolve descrição a skill útil | nenhum |
| Plugins sincronizados do claude.ai sem uso (figma, engineering com 8 conectores sem login, e os de plataformas de cliente fora dos projetos delas) | ~0,3–0,8 mil (nomes e instruções MCP) | — |
| No projeto de produto: índice de memória com linha curta (hoje 103 linhas × ~190 caracteres = 6,8 mil) e o contexto de domínio do `CLAUDE.md` (11,8 mil) em doc lida sob demanda | até ~10 mil por sessão e ~10 mil por subagente (≈ 30% do piso do subagente) | item do repositório de produto, não do kit |

Não medido: o `prompt_suggestions` do app ("cada sugestão é mais uma requisição ao modelo") não aparece nos transcripts.
