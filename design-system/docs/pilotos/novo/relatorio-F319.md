# O `/wicomm:novo` rodado de verdade, com o plugin carregado

F319 · segundo piloto do fluxo de projeto novo, em 01/11/2026, das 21:31 às 21:58 (SP). Fecha o atrito 1 e o item 5 da lista do [primeiro piloto](relatorio.md) (F281): lá o comando parou por limite de uso e a sessão seguiu a skill à mão, então os hooks e os agentes do plugin nunca rodaram dentro de uma sessão com o plugin carregado. Plugin `wicomm` 0.1.4, base 0.9.1, `@wicomm-projects/tokens` 0.1.1 e `@wicomm-projects/guardas` 0.1.2.

**O app** é descartável, fora deste repositório e sem remoto: `~/Developer/Projects/wicomm-novo-descartavel`. É um app de exemplo neutro, **Anotações**: a equipe cria, relê e arquiva anotações curtas. Densidade `instrumento`, largura 1280. A sessão abriu nessa pasta, vazia, com o plugin instalado no escopo do projeto. As skills `wicomm:*`, os três agentes e o MCP `plugin:wicomm:shadcn` estavam listados.

## Resultado

| Critério | Situação | Como foi conferido |
|---|---|---|
| O comando roda de ponta a ponta numa sessão com o plugin carregado | ✓ | `/wicomm:novo` invocado pelo Skill tool, que carregou `novo-projeto` 0.1.4. A sessão seguiu os seis passos da skill sem parar. A entrevista foi respondida pela própria sessão, com o app de exemplo |
| O app sobe | ✓ | `next build` verde (rotas `/`, `/anotacoes`, `/anotacoes/[id]`, `/anotacoes/nova`, `/atelie`, `/atelie/claro`, `/atelie/escuro`); `next dev` e `next start` respondem 200 nas rotas |
| `/atelie` mostra as peças nos dois temas | ✓ com ressalva | Um iframe por tema; **36** `data-vitrine` em cada um. O kit tem 46 peças de tela: as 13 que entraram no registro depois do F281 (`badge`, `checkbox`, `faixa`, `medidor`, `pessoa`, `prazo`, `progress` e outras) não estão no ateliê, que ainda é cópia do piloto anterior (atrito 6) |
| Guardas verdes com base zero | ✓ | `npm test` no app: `✓ 26 guardas, 2240 itens examinados, 0 violações contadas`, 2 desligadas com motivo (sem Entrada, sem formulário) |
| Primeira tela pelo processo, ≥ 24/30 | ✓ **25/30** | `wicomm:designer` → `wicomm:critico-de-ui` sobre a revisão (**25/30**, aprovada) → código → `wicomm:critico-de-ui` sobre o código (**25/30**, aprovada, nos dois temas a 1280). As duas críticas estão gravadas no fim da revisão, e o `estado.mjs` lê a nota: "83.3% (teto 80%) — no teto ou acima" |
| Tempo do bootstrap medido | ✓ | **3 min** de pasta vazia a build verde com base, pacotes, estilo, 51 peças, layout raiz, guardas e ateliê (tabela abaixo). A primeira tela levou mais 23 min |
| O hook `valor-solto` dispara numa edição de tela | ✓ | Saída abaixo |
| O hook `guarda-de-design` dispara | ✓ | Três eventos provados (`UserPromptSubmit`, `PostToolUse` do `Agent`, `Stop`). Saídas abaixo |
| Os agentes do plugin rodam dentro da sessão | ✓ | `wicomm:designer` (9 min 15 s, 32 chamadas) e `wicomm:critico-de-ui` duas vezes (4 min 25 s e 5 min 37 s), lançados como `subagent_type` do plugin |

## Os hooks, com a saída

**`valor-solto`** (`PreToolUse` de `Write`), numa página escrita de propósito com valor solto (`app/(casco)/prova-do-hook/page.tsx`, apagada em seguida):

```
PreToolUse:Write hook additional context: Valor solto na tela que está sendo escrita (page.tsx):
`#ff3366` (cor literal, CONV-04); `p-[13px]` (valor arbitrário, PRIN-06); `text-[15px]` (valor arbitrário, PRIN-06);
`text-red-500` (paleta direto, COR-05). A base Wicomm pede token: […] Isto é aviso: a guarda do CI é quem reprova.
```

Ele disparou também no código real, sem que eu pedisse: em `components/lista-de-notas.tsx`, sobre `w-[85%]` e `w-[15%]` (atrito 3).

**`guarda-de-design`:**
- `UserPromptSubmit`: injetou o lembrete a cada turno aberto por pedido que fala de design ("Demanda de design no front: antes de desenhar, o agente `designer` faz a revisão de arquitetura […]") e gravou a foto do começo do turno em `.git/wicomm-design/<sessão>.json` (criado às 21:44).
- `PostToolUse` (`Agent`): ao lançar o `critico-de-ui`, gravou a foto daquele momento no campo `criticada` (21:51).
- `Stop`: depois da crítica do código mudei o visual (a correção P3 da crítica) e encerrei o turno. O hook recusou o fim do turno uma vez:

```
Stop hook blocking error from command: "node "${CLAUDE_PLUGIN_ROOT}/hooks/guarda-de-design.mjs"":
O visual do front mudou neste turno e o crítico não rodou. Antes de encerrar, chame o subagente `critico-de-ui`
sobre o que mudou (ou diga em uma linha por que esta mudança não pede crítica — ex.: só renomeou um identificador).
Esta cobrança vem uma vez por turno.
```

O `PreToolUse` que nega tela ao `designer` e o `SubagentStop` que confere a forma da crítica rodaram, mas não decidiram nada. O designer só tentou gravar a revisão, que não é tela, e as duas críticas vieram na forma combinada.

## Passo a passo e tempo

| Hora (SP) | Passo | Duração |
|---|---|---|
| 21:31:36 | `/wicomm:novo` → skill `novo-projeto`; `medir-deriva.mjs` na pasta vazia | 6 s |
| 21:31:42 | `create-next-app@16.4.3` (a pasta já tinha `.claude/`; o `git init` e o primeiro commit vêm dele) | 12 s |
| 21:31:54 | Entrevista respondida → `design/PRODUCT.md`; `base-do-projeto.mjs estampar --densidade instrumento`; `wicomm.json`, `.claude/settings.json` com o marketplace, `CLAUDE.md`, `docs/deploy.md` | 1 min |
| 21:32:56 | `.npmrc` sem token e os dois pacotes pelo alias (`NODE_AUTH_TOKEN` do `gh`) | 2 s |
| 21:32:58 | `shadcn@4.21.5 init` do estilo | 9 s |
| 21:33:07 | `shadcn add` de 51 itens num comando (46 de tela, 3 `lib`, `casco`, `lista`) | 4 s |
| 21:33:11 | Layout raiz, `app/page.tsx` trocado, guardas configuradas, CI, ateliê, anotação das 51 peças por script | 1 min 20 s |
| **21:34:43** | **Primeiro `next build` verde: bootstrap pronto** | **3 min** |
| 21:34:57 | `wicomm:designer`: revisão de arquitetura da Lista | 9 min 15 s |
| 21:44:36 | `wicomm:critico-de-ui` sobre a revisão: 25/30 | 4 min 25 s |
| 21:49:16 | Código da Lista, da leitura mínima e do esboço do formulário; guardas e build verdes | 2 min |
| 21:51:21 | `wicomm:critico-de-ui` sobre o código: 25/30 | 5 min 37 s |
| 21:57:26 | Correção P3, cobrança do `Stop` | — |

Ficaram de fora da tabela 5 min de leitura do código dos hooks e o desvio do registro (atrito 1). O piloto anterior levou 8 min de bootstrap, 3 deles num tropeço de shell. A skill corrigida no F281 tirou esse tropeço: a ordem que ela dá funcionou de primeira.

**O registro** respondeu 401 na URL publicada (atrito 1). Como no F281, ele foi servido do build da `main` (`packages/registro`, `npm run build`) num servidor HTTP local, `http://127.0.0.1:4871/r/v0.1.0/{name}.json`. Plugin e pacotes vieram do lugar real.

## O que funcionou de primeira
- O plugin carregado no escopo do projeto: skills, agentes, hooks e o MCP do shadcn, sem nenhum passo à mão.
- Os três consertos de skill do F281 (versões fixadas, `add` num comando com `@wicomm/`, layout raiz) e os dois das guardas 0.1.1 (app sem `src/`, componente em kebab-case): nenhum dos atritos 2 a 5 e 10 a 11 do piloto anterior voltou.
- O `estampar` e o `estado.mjs` ("igual à base", nota lida da revisão, e a deriva do bloco `lista` adaptado apontada).
- O processo pegou de verdade nas duas críticas:
  - a da revisão derrubou quatro peças novas propostas para um gesto semanal, e a primeira fatia saiu só com o kit;
  - a do código achou um defeito real do bloco Lista com `cacheComponents` (atrito 5).

## Os atritos

| # | O que aconteceu | Onde | Tratamento |
|---|---|---|---|
| 1 | O registro publicado (`wicomm-atelie.vercel.app/r/…`) responde **401** sem o cabeçalho de bypass da Vercel. A skill dizia só `<url do registro>`, sem a URL, o cabeçalho nem o segredo `WICOMM_REGISTRO_BYPASS`, que só estão em `docs/publicar-atelie.md`. E o `shadcn init <url>/estilo.json` que a skill manda não manda cabeçalho nenhum: só item com namespace recebe o do `registries` | skill `novo-projeto` | **Corrigido:** a skill dá a URL e troca o `init` por `components.json` escrito antes, com o `registries` e o cabeçalho pela variável, mais `shadcn add @wicomm/estilo`. Conferido contra um servidor local que exige o cabeçalho: o `init` pela URL leva 401 (`bypass=-`); o `add @wicomm/estilo` e o `add @wicomm/button` chegam com o cabeçalho, e o `globals.css` sai com as mesmas variáveis do `init`. Não conferido contra a Vercel (o segredo não estava no ambiente) |
| 2 | O `app/page.tsx` do `create-next-app` sozinho reprova quatro guardas (valor solto, paleta direto, vidro, título) | skill `novo-projeto` | **Corrigido:** a skill manda trocar por um `redirect` para a primeira tela |
| 3 | O hook `valor-solto` avisa `w-[85%]`, e a guarda `nenhum-valor-solto` aceita (ela só olha texto, altura, raio, cor, duração e camada). O próprio bloco Lista usa `w-[32%]`: todo projeto que adapta o bloco recebe o aviso | hook `valor-solto` × `@wicomm/guardas` | **Lista:** alinhar o hook à guarda ou a guarda ao hook. Muda a leitura da PRIN-06 |
| 4 | O `guarda-de-design` não cobra crítica no turno do próprio `/wicomm:novo`: quando o turno começa, o `design/wicomm.json` ainda não existe, então o `UserPromptSubmit` não grava foto e o `Stop` não tem com o que comparar. Duas causas: a pasta ainda nem é repositório git (o `git init` vem com o `create-next-app`, e o hook devolve configuração nula fora de repositório, mesmo com `pasta_do_front`), e o `design/wicomm.json` ainda não existe. A primeira tela, feita no mesmo turno, passa sem a trava. Aqui só funcionou porque os subagentes em segundo plano reabriram turnos | hook `guarda-de-design` | **Lista:** decisão de desenho. Recomendação: o `Stop` trata "sem estado do turno, configuração presente agora" como foto vazia no começo, o que cobre as duas causas (gravar a foto no `PostToolUse` do `estampar` não roda: esse `PostToolUse` só casa `Agent\|Task`, e o `estampar` é Bash) |
| 5 | O bloco Lista põe fila e busca em `useState(inicial)` e conta com a `key` do servidor para refazer a lista no clique da barra. Com `cacheComponents: true` (padrão do Next 16) a tela anterior volta do cache com o estado dentro: depois de voltar pela trilha ou clicar no destino, a tela mostra um filtro e o endereço diz outro. Também segue o `replaceState(window.history.state, …)` (atrito 12 do F281, ainda aberto) | bloco `lista` | **Lista:** o bloco lê do `useSearchParams()` e grava por `replaceState(null, …)`; a crítica 2 deixou isso no `depois` do app |
| 6 | O ateliê ainda é montado à mão: copiei as 36 demonstrações do app do F281, e as 13 peças que o registro ganhou depois ficaram fora | registro | **Lista** (já é o item 1 do F281) |
| 7 | O `casco` instala o cabeçalho e a troca de contexto, montados no `casco-no-next.tsx`. O app sem nada a pôr ali tira o `cabecalho` do casco e os dois arquivos ficam órfãos: a `componente-que-ninguem-monta` reprova | skill `novo-projeto` | **Corrigido:** a skill diz a ordem: tirar o `cabecalho` do `casco-no-next.tsx` e só então apagar os dois (apagar antes quebra o build pelo import) |
| 8 | O `wicomm:designer` não conseguiu gravar a revisão em `docs/design/revisoes/`: a trava `subagente-nao-edita` do kit de orquestração (instalado no usuário, fora deste plugin) nega gravação a qualquer subagente. Ele devolveu o texto e a sessão gravou. Na máquina de um dev sem o kit isso não acontece | kit de orquestração × agente `designer` | **Lista**, para quem cuida do kit: liberar `docs/design/revisoes/` ao `wicomm:designer`, ou o agente já nascer devolvendo o texto |
| 9 | O designer propôs quatro peças novas (`MenuDaLinha`, `DesfechoDaLinha`, `Button size="icon-xs"`, `TopoDoMenu`) e a regra de que entrassem pelo registro antes da tela. A crítica cortou para duas lacunas reais (`MenuDaLinha` com a recusa dentro, `TopoDoMenu`, que a PECA-01 nomeia e o `menu.tsx` não exporta) | registro | **Lista:** as duas peças |
| 10 | Anotar as 51 peças no `pecas` continua à mão; fiz com um script de 10 linhas lendo o `registry.json` | `peca-do-kit` | **Lista** (já é o item 3 do F281) |
| 11 | O `/wicomm:novo` lê o argumento como a pasta do front (`argument-hint`). Passei a descrição do app e o comando a repassou como "Pasta do front indicada: …". Sem dano, mas a descrição do app não tem lugar | comando `novo` | Anotado (leve) |
| 12 | `/anotacoes/xx` mostra "Anotação não encontrada" com HTTP 200; o certo é `notFound()` | app do piloto | Anotado no app |

## O que este PR muda
- **Plugin, skill `novo-projeto`** (atritos 1, 2 e 7): o registro publicado com a URL e o cabeçalho de bypass pela variável, e o estilo pelo `add @wicomm/estilo` com o `components.json` escrito antes (o `init` pela URL não manda o cabeçalho); a troca do `app/page.tsx` do `create-next-app`; o que fazer com o cabeçalho e a troca de contexto do `casco` quando o app não os monta. Sem subir a versão do plugin.
- **Este relatório.**

## A lista para virar item
1. **O `guarda-de-design` no turno do bootstrap** (atrito 4): a trava não vale justamente no turno em que a primeira tela nasce, por duas causas (sem git e sem configuração no começo do turno).
2. **O bloco Lista com `cacheComponents`** (atrito 5): estado de vista lido do endereço, `replaceState(null, …)`, e um caso a mais na guarda `estado-de-vista-nao-vai-ao-servidor` para `replaceState` cujo primeiro argumento não é `null`.
3. **Hook `valor-solto` e guarda `nenhum-valor-solto` na mesma régua** (atrito 3).
4. **`MenuDaLinha` e `TopoDoMenu` no registro** (atrito 9).
5. **O designer e a trava de subagente do kit** (atrito 8), para quem cuida do kit de orquestração.
6. Já na lista do F281 e ainda abertos: o item do ateliê (atrito 6), anotar peças por script (atrito 10), o `replaceState` do bloco Lista (atrito 5).

## Onde está cada coisa no app do piloto
- `design/`: PRODUCT (com o glossário), DESIGN, ANATOMIA, CONVENCOES e `wicomm.json` (51 peças anotadas, guardas configuradas).
- `docs/design/revisoes/2026-11-01-lista-de-anotacoes.md`: a revisão e as duas críticas.
- `components/lista-de-notas.tsx`, `lib/notas/consulta.ts`, `lib/endereco.ts`, `app/(casco)/anotacoes/`: a primeira tela, a leitura mínima e o esboço do formulário.
- O app tem três commits locais e nenhum remoto; não é publicado em lugar nenhum.
