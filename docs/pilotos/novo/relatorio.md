# Piloto de projeto novo: o `/wicomm:novo` num app Next vazio

F281 · fatia F261.8 do estudo ([seções 3.1 e 4](../../estudo/F261-plugin-design-system.md)). Primeiro uso real do fluxo de projeto novo, em 30/10/2026, das 22:48 às 23:20 (SP). Plugin `wicomm` 0.1.0 e base 0.4.0, tirados da `main` em `744765f`.

**O segundo piloto** (F319, 01/11), com o comando rodado de verdade e o plugin carregado, está em [relatorio-F319.md](relatorio-F319.md).

**O app do piloto** fica fora deste repositório, em `/Users/ichikawacraice/Developer/Projects/wicomm-piloto-novo`, com git local e sem remoto (*assumido, a confirmar*). É um app interno fictício, **Solicitações**: operações pede e acompanha compras de equipamento, o financeiro aprova.

## Resultado

| Critério de pronto (3.1, item 7) | Situação | Como foi conferido |
|---|---|---|
| O app sobe | ✓ | `next build` verde; `next dev` servindo `/solicitacoes`, `/solicitacoes/[numero]` e `/atelie` |
| `/atelie` mostra as peças nos dois temas | ✓ com ressalva | 36 peças vivas, um palco por tema lado a lado, `data-vitrine` em cada uma. O registro não tem o item do ateliê: as demonstrações foram copiadas do ateliê do sistema (atrito 7) |
| Guardas verdes com base zero | ✓ | `npx wicomm-guardas`: 24 guardas verdes, 0 violações, 3 desligadas com motivo (atritos 4 e 5) |
| Primeira tela pelo processo, ≥ 24/30 nos dois temas | ✓ **25/30** | revisão: designer → crítico (23/30, volta) → designer → crítico (24/30, aprovada). Código: crítico (23/30, volta) → correção → crítico (**25/30**, aprovada), olhando as capturas a 1280 nos dois temas. As quatro críticas estão gravadas na revisão, e o `estado.mjs` lê a nota |
| Tempo do bootstrap medido | ✓ | **8 min** de pasta vazia a app com base, estilo, peças, guardas e ateliê (tabela abaixo) |

## Passo a passo e tempo

| Hora (SP) | Passo | Duração |
|---|---|---|
| 22:48:02 | Pasta vazia + `git init`; `claude plugin marketplace add wicomm-projects/wicomm-design-system --scope project` e `claude plugin install wicomm@wicomm --scope project` (clone do GitHub) | 5 s |
| 22:48:24 | `/wicomm:novo` em sessão sem interação (`claude -p`): **parou na hora** — limite semanal de uso da conta do CLI (HTTP 429). Daí em diante, a sessão dona seguiu a skill instalada (`~/.claude/plugins/cache/wicomm/wicomm/0.1.0`) passo a passo, como o Claude do dev seguiria | 8 s |
| 22:48:51 | Passo 1: `medir-deriva.mjs` (pasta vazia) e `create-next-app@16.4.3` | 30 s |
| 22:49:20 | Passos 2 e 3: `design/PRODUCT.md` (entrevista respondida no pedido), `base-do-projeto.mjs estampar --densidade instrumento`, `design/wicomm.json`, bloco no `CLAUDE.md` | 5 s |
| 22:49:24 | `.npmrc` sem token e `npm install` dos dois pacotes pelo alias, do GitHub Packages | 6 s |
| 22:49:30 | `shadcn@4.21.5 init <registro>/estilo.json` | 9 s |
| 22:49:39 | `shadcn add` de 36 peças + `casco` + `lista`, o layout raiz, as guardas no `npm test`, o workflow de CI, o `/atelie` | 5 min 20 s (≈ 3 min foram um tropeço meu no laço do zsh, atrito 2) |
| 22:54:56 | Primeiro `next build` verde | 1 min |
| **22:56:03** | **Bootstrap pronto** | **8 min** |
| 22:57 – 23:20 | A primeira tela pelo processo (duas revisões, quatro críticas, o código da Lista e da Mesa de leitura) | 23 min |

Sem o tropeço do zsh e com a skill corrigida neste PR, o bootstrap cabe em **5 min**.

**O registro** ainda não está publicado (a F261.12 publica). O piloto o serviu do build da `main` (`packages/registro/public/r/v0.1.0`) num servidor HTTP local, `http://127.0.0.1:4870/r/v0.1.0/{name}.json`: o `shadcn` falou com uma URL, como falará com a da Vercel. Plugin e pacotes vieram do lugar real (marketplace no GitHub, GitHub Packages), sem caminho de pasta nem workspace.

## O que funcionou de primeira
- O marketplace no GitHub e a instalação do plugin no escopo do projeto: escrevem o mesmo `.claude/settings.json` que a skill pede.
- Os pacotes privados pelo alias e o `.npmrc` com `${NODE_AUTH_TOKEN}`: nenhum token em arquivo.
- O `estampar` e o `estado.mjs`: versão 0.4.0, "igual à base", 39 peças anotadas, e a nota da última crítica lida do arquivo da revisão.
- O `shadcn init` do estilo e o `add` das 38 peças num comando só; o build compila tudo de primeira.
- O processo pegou de verdade: a crítica 1 derrubou a revisão (23/30) por um defeito real — sem formulário e sem Mesa, a Lista não abria nada.

## Os atritos

| # | O que aconteceu | Onde | Tratamento |
|---|---|---|---|
| 1 | O `/wicomm:novo` sem interação não roda: a skill entrevista no meio. E aqui nem começou (limite de uso). Por isso os hooks e os agentes do plugin **não foram exercidos dentro de uma sessão com o plugin carregado**: o designer e o crítico rodaram como subagentes que leem as definições instaladas | — | Lista: o próximo piloto roda o `/wicomm:novo` interativo, com o plugin carregado, para provar os hooks `guarda-de-design` e `valor-solto` |
| 2 | Meu laço no zsh (`for i in $LISTA` não divide palavras) mandou os nomes sem `@wicomm/`, e o `toast` sem prefixo é o do shadcn, que o CLI recusa ("only available for Base UI"). Não é defeito do sistema, mas a mensagem engana | skill `novo-projeto` | **Corrigido:** a skill dá o comando do `add` e avisa do prefixo |
| 3 | A skill dizia `create-next-app@<versão fixada>` e `shadcn` sem versão; o dev não sabe qual | skill `novo-projeto` | **Corrigido:** `create-next-app@16.4.3` (a que o `num-next-vazio` prova) com as opções, e `shadcn@4.21.5` |
| 4 | As guardas assumem `src/`, e o `create-next-app --yes` cria sem `src/`: 27 guardas em erro, "não achou nada a examinar". O `o-carimbo-tem-forma` acusou 42 vezes o `lib/idioma-de-cor.ts` do próprio registro (o padrão era `src/lib/…`) | `@wicomm/guardas` | **Corrigido na 0.1.1:** sem `src/` e com `app/` na raiz, o padrão segue a raiz; o idioma de cor sai do alias `@/`. No piloto (0.1.0 publicada), configurado à mão |
| 5 | `componente-que-ninguem-monta` só olha arquivo com inicial maiúscula; o registro instala em kebab-case (`lista-de-pedidos.tsx`). Num app feito pelo registro ela nunca acha nada e fica em erro para sempre | `@wicomm/guardas` | **Corrigido na 0.1.1:** olha todo `.tsx` da pasta de componentes fora do kit. No piloto, desligada com o motivo até a 0.1.1 |
| 6 | App novo sem formulário e sem tela de Entrada deixa duas guardas em erro (CONV-14), e o `o-vocabulario-da-tela` exige glossário. O `/atelie` é lido como tela do produto (vocabulário, superfície, trilha) | skill `novo-projeto` | **Corrigido:** a skill manda o glossário, o `ignorar` do ateliê e o desligamento com motivo do que o app ainda não tem |
| 7 | O registro não tem o item do ateliê: a CONV-23 pede `/atelie` em todo app, e o dev monta à mão. O piloto copiou as 36 demonstrações de `apps/atelie` (1.500 linhas); o tema escuro do sistema vaza num contêiner `.dark`, então foi preciso um iframe por tema. E a "guarda ateliê × kit" que a CONV-23 cita não existe no `@wicomm/guardas` | registro, guardas | **Lista** (item novo) |
| 8 | O pacote `@wicomm/tokens` fica instalado **sem uso**: o `init` do estilo copia os tokens para o `globals.css`, e nada importa o pacote. São dois caminhos para o mesmo valor (atualizar por `npm` não muda nada; só um novo `init` muda) | registro, tokens, skill | **Lista** (decisão de desenho) |
| 9 | A anotação das peças (`pecas` no `design/wicomm.json`) é à mão, peça por peça, com `shasum`; com 38 itens, só por script. E o formato guarda **um** arquivo por item: o bloco `casco` instala seis | `peca-do-kit`, `estado.mjs` | **Lista** |
| 10 | O layout raiz (Archivo com o eixo de largura, o script antes do desenho, `lang="pt-BR"`, `suppressHydrationWarning`) não estava na skill; só no README do registro | skill `novo-projeto` | **Corrigido** |
| 11 | O workflow de CI das guardas (estudo 3.1, passo 5) não estava na skill | skill `novo-projeto` | **Corrigido** |
| 12 | O bloco Lista: grava o modo no endereço com o estado atual da navegação (a CONV-06 pede `null`); a tela sem permissão sai para `/`, que vira laço quando a entrada do app é a Lista; o vazio diz "Ver com outros"; a releitura pode reordenar a linha sob o ponteiro | bloco `lista` | **Lista** (o piloto corrigiu na adaptação) |
| 13 | O bloco Mesa declara `@wicomm/lista` como dependência: instalar a Mesa reinstala o exemplo `/pedidos` | bloco `mesa` | **Lista** |
| 14 | O `TrilhoDoPercurso` não aceitava a voz `alheio` na estação atual (COR-03: "está com outra pessoa") | peça `trilho-do-percurso` | **Corrigido** no registro, com teste; reinstalado no piloto pelo `add` |
| 15 | O registro não tem versão de release: a peça corrigida saiu na mesma `v0.1.0` | registro | **Lista** (vai com a publicação, F261.12) |
| 16 | Next 16 com Cache Components: o fallback da Mesa que lê o número da rota precisa de um `Suspense` aninhado (`useParams` fora de `Suspense` quebra o build) | bloco `mesa` | Anotado; o bloco de exemplo não cai nisso porque o fallback não mostra o número |
| 17 | `npm install` dos pacotes põe `@wicomm/guardas` em `dependencies`; o lugar é `devDependencies` | `docs/instalar-pacotes.md`, skill | **Lista** (leve) |
| 18 | `claude plugin install` avisa "4 userConfig options not yet set"; todas têm padrão | README do plugin | **Corrigido:** o README diz que pode ficar |

## O que este PR muda
- **`@wicomm/guardas` 0.1.1** (o merge publica): o padrão sem `src/`, o idioma de cor pelo alias, o componente em kebab-case; leva também a opção da trilha que a F272 acrescentou sem subir versão. Testes novos em `insumo.test.mjs` e `violacoes.test.mjs`.
- **Registro:** `trilho-do-percurso` com a voz `alheio`, e o teste.
- **Plugin:** a skill `novo-projeto` com a ordem que o piloto provou (versões, `add` num comando, layout raiz, guardas, CI, ateliê); o README com a instalação pelo terminal.

## A lista para virar item
1. **O item do ateliê no registro** (`@wicomm/atelie`: a rota `/atelie` com as demonstrações e o palco por tema) e a **guarda ateliê × kit** da CONV-23 (atrito 7).
2. **Uma fonte para os tokens no projeto:** ou o estilo passa a `@import "@wicomm/tokens/tailwind-v4.css"` (atualiza por `npm`), ou o projeto não instala o pacote e atualiza pelo `init` (atrito 8). Recomendação: o `@import`, porque deixa o `/wicomm:atualizar` igual para tokens e guardas.
3. **Anotar peças por script** (`base-do-projeto.mjs anotar`, lendo o `components.json` e os arquivos de cada item) e `pecas` com todos os arquivos do item (atrito 9).
4. **Os blocos Lista e Mesa** (atritos 12 e 13): `replaceState(null, …)`, a saída da tela sem permissão dada por quem monta, a reordenação adiada, e a Mesa sem depender da Lista.
5. **O `/wicomm:novo` interativo com o plugin carregado**, para provar os hooks (atrito 1).
6. **O idioma de cor padrão no aviso `valor-solto` e no `medir-deriva`:** os dois só leem a chave `idioma` explícita, e a guarda agora tem padrão pelo alias `@/`. Projeto que confie no padrão recebe aviso a cada edição do próprio idioma de cor.
7. **Religar a `componente-que-ninguem-monta` no `apps/atelie`** (`design/wicomm.json`), desligada pelo defeito que a 0.1.1 corrige; fica para depois da F282, que trabalha no ateliê.

## Pendências da primeira tela (ressalvas da crítica 4, no app do piloto)
- `sair` (`lib/conta.ts`) tem o corpo vazio até a autenticação existir: o critério desse item é "Sair encerra a sessão e leva à Entrada".
- A `ParDaFicha` não tem variante para o motivo da ausência ("não se aplica", "definido na compra"): a tela escreve a tinta à mão. Peça para o registro.
- Na espera da Mesa, a volta da trilha ainda não leva a fila de origem.
- O teste da Lista (a linha que muda de fila com o ponteiro sobre a tabela) não existe: o app ainda não tem executor de teste de componente.

## Decisões do produto do piloto (*assumidas, a confirmar*)
O designer reservou Q667 a Q674 para o produto fictício (o percurso de uma solicitação, "esperam você" por papel, Encerradas sem contagem, sem formulário, o exemplo `/pedidos` fora, os defeitos dos blocos, o trilho sem `alheio`, aprovar ainda fora da tela). Todas seguiram a recomendação dele. As que falam do sistema viraram os atritos 12 a 14; as outras são do produto fictício e não esperam o operador.

## Onde está cada coisa no app do piloto
- `design/` — PRODUCT, DESIGN, ANATOMIA, CONVENCOES e `wicomm.json`.
- `docs/design/revisoes/2026-10-30-lista-de-solicitacoes.md` — a revisão 2 e as quatro críticas.
- `components/lista-de-solicitacoes.tsx`, `components/mesa-da-solicitacao.tsx`, `lib/solicitacoes.ts` — a primeira tela (dados de demonstração na forma da consulta real).
- `app/atelie/` — o ateliê.
