# F261 · Estudo e plano — o plugin Wicomm de design system

- **Data:** 30/10/2026 · **Dona:** sessão `F261 · Estudo do plugin Wicomm de design system`
- **Pedido (operador, 30/10):** um plugin da Wicomm que leve a todos os projetos o design system e o processo que o Izanagi usa para decidir uma tela, para projeto novo e para padronizar projeto existente. O resultado: o cliente sente que foi a mesma empresa — mesma navegação, hierarquia, anatomia.
- **Este documento é o estudo e o plano.** Nada foi implementado. Decisões do operador no fim, com Q-ID; o resto está marcado *assumida, a confirmar*.

---

## 0. Resumo em uma tela

1. **O Izanagi já tem as duas metades:** o *conteúdo* (um sistema visual medido e escrito: `DESIGN.md`, `ANATOMIA.md`, ~50 peças em `components/ui`, ~26 testes-guarda de design) e o *motor* (o plugin `design` do kit de orquestração: designer → crítico com nota → guarda que cobra a crítica). O motor é **quase genérico**: lê os caminhos do `.claude/kit.json`, mas ainda tem acoplamentos ao kit de orquestração (seção 1.4). O conteúdo é **~70% Wicomm genérico e ~30% Izanagi** (seção 1.5).
2. **Recomendação:** um repositório só — este, `wicomm-design-system` — que é ao mesmo tempo **marketplace de plugins do Claude Code**, **registro shadcn próprio**, **pacote de tokens** e **ateliê** (catálogo vivo). O plugin `wicomm-design` carrega o processo e os documentos-base; o código (tokens e componentes) vai pelo registro shadcn e pelo pacote, não pelo plugin. Seção 2.
3. **O que garante a direção** não é o plugin sozinho: são três travas em camadas — o *processo* (hooks + designer + crítico com nota 24/30), as *guardas em teste* (que rodam no CI, valem até para quem não usa Claude) e a *versão estampada* no projeto (que mostra a deriva). Seção 2.4.
4. **Uma correção de premissa:** "todo projeto com o mesmo design system" não pode valer igual para tudo o que a Wicomm faz. Loja VTEX FastStore e Wake têm a **marca do cliente** e, no FastStore, outro sistema de componentes (`@faststore/ui`, SCSS) — shadcn não entra. A recomendação é separar **sistema** (fixo: anatomia, comportamento, movimento, vozes de estado, escala) de **marca** (trocável: primária, degradê, fonte) e começar pelos **apps React** (painéis, sistemas internos, apps de cliente). Q627 e Q628.
5. **Plano em 11 fatias** (seção 4), a primeira já executável sem decisão: extrair a base Wicomm do Izanagi.

---

## 1. Inventário do que o Izanagi tem hoje

Lido em 30/10/2026, só leitura. Caminhos relativos a `/Users/ichikawacraice/Developer/Projects/Izanagi`.

### 1.1 Stack do front (`apps/web`)

| Peça | Hoje | Observação para o plugin |
|---|---|---|
| Framework | Next ^15.5, React ^19.2 | — |
| Tailwind | **v3.4** com `tailwind.config.ts` (220 linhas) e `tailwindcss-animate` | shadcn atual nasce em **v4** (`@theme` em CSS). O registro Wicomm é v4. O preset v3 cobre só os **tokens**: as **peças** v4 usam classes que não existem em v3 (`shadow-xs`, `outline-hidden`, `bg-(--x)`) e falham caladas. Projeto em v3 migra para v4 antes de receber peças (fatia própria, seção 3.2). |
| shadcn | **Sem `components.json`.** Peças copiadas do `new-york` (v3), adaptadas, nomes em PT | Decisão registrada (ANATOMIA, Q138): não rodar `shadcn init/add` — o `init` reescreveria `globals.css` e `tailwind.config`. Com registro próprio, o `add` passa a trazer a peça **já** adaptada. |
| Radix | `@radix-ui/react-*` separados | — |
| Ícones | `lucide-react` (128 arquivos usam) | Sem wrapper; `IconeDaIa` é a exceção (degradê). Tamanho/traço não estão tokenizados — lacuna. |
| Movimento | tokens de duração/curva no `tailwind.config.ts` (ADR 0374), sem framer-motion | Portável como está. |
| Fonte | Archivo (variável, eixo `wdth`) + mono do sistema | *Assumida, a confirmar:* Archivo vira a fonte-padrão Wicomm. |

### 1.2 Conteúdo do sistema visual

- **`apps/web/DESIGN.md` (503 linhas, formato Impeccable):** frontmatter com tokens (cores, tipografia em 7 papéis, raios, espaçamentos, componentes) e o porquê medido de cada regra. Regras nomeadas: *Cor Declarada* (`#F30B42`, não cede a contraste), *Vermelho que Não Escreve*, *Alfa por color-mix*, *Dois Degraus*, *Medida em Mono*, *Corpo Denso*, *Controle Sem Sombra*, *Anel só para Foco*, *Separação pelo Ar*, *Tracejada = ausência*, *Degrau de Tinta*. Três alturas (chão, peça, flutuante), cinco vozes de estado (*o que isto pede de você?*), três canais (tinta/forma/marca), tabela de movimento.
- **`apps/web/ANATOMIA.md` (140 linhas):** seis princípios; **quatro arquétipos de tela** (Lista, Mesa, Editor, Entrada) com regiões; matriz *onde mora cada mensagem* (10 lugares, duração, peça); tabela *a peça de cada função* (30 funções → peça do kit, e o que não usar); peso e hierarquia; os 7 estados de toda região; o que se move.
- **`apps/web/PRODUCT.md` (143 linhas):** usuários e cenas de uso — **é por projeto**, não vai para a base.
- **`MARCA.md`:** nome e símbolo Izanagi (ensō); a cor é da Wicomm desde o ADR 0124.
- **`apps/web/src/app/globals.css` (608 linhas):** tokens claro/escuro em hex, raios `--raio-*`, sombras `--superficie-sombra-*`; linhas 152–171 são cores de etapa de job e plataforma (Izanagi).
- **`apps/web/CLAUDE.md`:** ~25 convenções de front com o porquê (cor com alfa, contorno 3:1, conteúdo em superfície, carimbo declara tom, erro de submissão alcança os olhos, nenhum botão com reticências, troca de vista com uma forma, escala do kit 26/30/36…).
- **ADRs de design:** 0124 (marca Wicomm), 0125 (superfície opaca), 0126 (contorno 3:1), 0129 (protótipo é contrato), 0146 (cor declarada), 0344 (escala do kit), 0374 (movimento), 0375 (Impeccable é o diretor), 0378 (quem desenha × quem julga), 0401 (builder com cara de site). SPECs 062 (composição de tela), 078, 081.

### 1.3 Componentes e guardas

- **`apps/web/src/components/ui/`:** ~50 peças. Primitivas shadcn adaptadas (`button`, `input`, `select`, `dialog`, `popover`, `tooltip`, `tabs`, `table`, `toast`, `skeleton`, `checkbox`, `scroll-area`, `separator`, `progress`, `label`, `textarea`, `card`, `badge`) e **peças próprias** (`painel`, `bloco`, `bloco-de-tinta`, `secao`, `dobra`, `painel-dobravel`, `chip-de-estado`, `chip-que-abre`, `carimbo`, `estado`, `ficha`, `medidor`, `com-motivo`, `dica-de-ajuda`, `confirm-dialog`, `dialog-que-bloqueia`, `menu`, `botao-dividido`, `seletor-de-vista`, `escolha-visual`, `passos`, `linha-de-andamento`, `rotulo-do-campo`, `seletor-de-cor`, `imagem`) + peças do editor (`barra-do-editor`, `colunas-do-editor`, `faixa-do-editor`). Muitas com teste `*.dom.test.tsx`.
- **`apps/web/src/components/layout/`:** `AppSidebar`, `AppHeader`, `Logo`, `MenuDoTema`, `EnsoSpinner`, chips de conexão.
- **Ateliê (`/atelie`, `src/app/atelie/`):** catálogo das peças reais com dados reais, nos dois temas, `data-vitrine` para medir no console.
- **Guardas em teste (`src/app/*.test.ts`): 41 arquivos, ~26 de design** (os outros são de domínio ou de servidor — `robots`, `quem-enfileira-comando-religa`, `servidor-nao-importa-valor-de-cliente`…). As de design: `a-marca-nao-carrega-texto`, `nada-de-vidro`, `o-movimento-tem-escape`, `os-tokens-pagam-o-piso` (calcula contraste do `globals.css`), `as-paletas-publicas-pagam-o-piso`, `a-tinta-clara-nao-vai-em-texto-pequeno`, `o-titulo-da-pagina-e-um-so`, `um-menu-so`, `o-carimbo-tem-forma`, `conteudo-mora-em-superficie`, `composicao-tem-grau`, `o-irreversivel-pede-confirmacao`, `nenhum-botao-tem-reticencias`, `a-troca-de-vista-tem-uma-forma`, `o-rotulo-tem-duas-vozes`, `a-espera-nao-e-texto-solto`, `toda-tela-de-detalhe-tem-trilha`, `componente-que-ninguem-monta`, `o-erro-de-submissao-alcanca-os-olhos`… Sem ESLint/Stylelint, sem Playwright, sem Storybook.
- **`.design-lab/`:** laboratório (ignorado pelo git) com estudos, receituário e scripts de calibragem e contraste de tokens (`tokens-contraste.mjs`, `sonda-de-contraste.js`).

### 1.4 O processo que decide a tela

| Peça | Onde | O que faz |
|---|---|---|
| Agente `designer` (Opus) | plugin `design` 0.2.4 do kit + cópia local em `.claude/agents/` | Revisão de arquitetura: tarefa → inventário (cada dado com a decisão que gera) → hierarquia → onde mora cada mensagem → componentes **do kit** → estados → movimento → o que sai. Grava em `docs/design/revisoes/`. Não edita tela (hook nega). |
| Agente `critico-de-ui` (Opus) | idem | Seis eixos × 0–5 = /30; no máximo 5 problemas, cada um com *Onde* e *Correção*; **24/30 sem ressalva alta libera**; até 2 recríticas. |
| Skills `revisao-de-arquitetura-de-ui`, `critica-de-ui` | plugin `design` | O formato fixo das duas entregas. |
| Hook `guarda-de-design.mjs` (454 linhas) | plugin `design` + cópia em `scripts/` | Lembra o designer no pedido de design; nega edição de tela ao designer; tira "foto" do trabalho visual e **recusa o fim do turno uma vez** se o visual mudou sem crítica; devolve crítica sem forma. Configurável por `.claude/kit.json` (`design.pasta`, `fontes`, `kit`, `revisoes`, `visual`, `largura`). |
| Impeccable (plugin de terceiros) | ADR 0375 | "Diretor de design": `/impeccable shape` antes, `critique`/`audit` depois; detector de anti-padrões rodado de `apps/web`. **Atenção:** consulta rede e manda telemetria no `shape` (o próprio ADR registra). |
| Revisões gravadas | `docs/design/revisoes/` (26 arquivos, 23–27/10) | Exemplo: `2026-10-25-builder-fatia-8.md` com 25/30 (hierarquia 4 · densidade 5 · consistência 3 · ruído 4 · ação 5 · aderência 4). |
| Estado de composição por tela | `docs/composicao-do-painel.md` | `não olhada → escaneada → planejada → atuada → conferida`. |

**Achados do inventário que o plugin precisa resolver:**
- **Duplicação motor × projeto, e já com deriva.** O Izanagi tem cópias locais do `designer`, do `critico-de-ui`, das skills `critica-de-ui` e `revisao-de-arquitetura-de-ui` (`.claude/skills/`) e da guarda (`scripts/guarda-de-design.mjs`, 376 linhas, contra 454 no plugin — já divergiu). Num plugin da empresa o projeto deve só **configurar**, nunca copiar o motor.
- **O motor ainda depende do kit de orquestração.** `design/0.2.4/hooks/opcoes-do-plugin.mjs:15` fixa o marketplace `kit-de-orquestracao`, e a guarda se desliga quando `design@kit-de-orquestracao` está desligado (`guarda-de-design.mjs:111`, `:122`); `guarda.tronco` vem da config do kit; a skill de crítica fala em "dona do item". Migrar o motor exige desacoplar essas três coisas (F261.7).
- **A escala da nota varia por tela:** 6 das 26 revisões usam /35 com um 7º eixo ("cara de site") — inclusive duas telas do painel (`barra-lateral-abre-no-passar`, `seguir-o-tema-do-computador`) —, com o teto de 28/35 (80%) já em uso. O plugin fixa: seis eixos sempre + eixo extra declarado **pela densidade da tela** (`site`), com teto de 80%.
- **Não há `.claude/kit.json` no Izanagi:** o hook local é registrado direto no `.claude/settings.json`, e o do plugin sai sem agir por falta de pasta. O plugin precisa de um contrato único de configuração (ver 2.3).

### 1.5 O que é Wicomm genérico e o que é Izanagi

| Vai para a base Wicomm | Fica no Izanagi |
|---|---|
| A cor da marca, o degradê, neutros frios, as regras "a marca não escreve" e "destrutivo é contorno" | O ensō, o `EnsoSpinner`, o símbolo e a mitologia (`MARCA.md`) |
| As cinco vozes e a pergunta única (*o que isto pede de você?*), os três canais | Os mapas de estado de job, de plataforma, de solicitação (`job-states`, `percurso-do-quadro`) |
| Três alturas, separação pelo ar, degrau de tinta, tracejada = ausência | Régua de Faixas, Fileira de Veredito, Matriz de Itens, Comparador (as "assinaturas") |
| Escala de controle 26/30/36/44, raios, tipografia em 7 papéis, mono para medida | Exceções de largura (formulário de job, entrega pública) |
| Tokens de movimento e o escape `motion-reduce` | A exceção de 48 px do *Editar com IA* |
| Os seis princípios, os quatro arquétipos, a matriz de mensagens, a peça de cada função, os 7 estados | As regiões do editor da loja (builder), a exceção de mensagens da Wake (Q204) |
| As duas densidades: **instrumento** (quem opera o dia todo) e **site** (quem usa de vez em quando, ex. o cliente) | — a ideia é genérica; o "builder" é só o caso Izanagi |
| ~25 das ~26 guardas de design (as que não citam job/loja) | Guardas de domínio (`quem-cria-job-*`, `so-o-publicar-escreve-na-loja`, `nenhuma-leitura-de-jobs-*`) |
| ~35 das ~50 peças do kit | `barra-do-editor`, `colunas-do-editor`, `faixa-do-editor`, `marca-de-plataforma`, `pilula-do-quadro`, `icone-da-ia` (este talvez vá: decidir na fatia) |
| O motor inteiro (designer, crítico, guarda) | `PRODUCT.md` (cada projeto escreve o seu) |
| Convenções de front do `apps/web/CLAUDE.md` que não citam domínio (~20 de ~25) | — |

---

## 2. Arquitetura recomendada

### 2.1 Onde mora cada coisa — plugin × código

O ponto de decisão: **o que precisa estar no repositório do cliente para funcionar sem Claude** (build, CI, um dev humano) vai como **código**; o que é **processo e julgamento** vai no **plugin**.

| Camada | Vai em | Por quê |
|---|---|---|
| Tokens (cor, tipo, raio, sombra, movimento, escala) | **pacote `@wicomm/tokens`** gerado de uma fonte única (JSON no formato DTCG) → CSS de tema para Tailwind v4 (`@theme`), preset para Tailwind v3, variáveis CSS puras, SCSS para FastStore (fase 2), variáveis do Figma (fase 3) | Uma fonte, vários alvos: o mesmo valor não é escrito duas vezes. O projeto atualiza com `pnpm up`. |
| Componentes (primitivas + peças próprias) e blocos de tela (casco, arquétipos) | **registro shadcn próprio** (`registry.json` + `shadcn build`), consumido com `npx shadcn add @wicomm/<peça>` | É o modelo que o shadcn já resolve: o código entra no projeto (editável), o registro dá as dependências. O `add` traz a peça **já** adaptada à Wicomm — some a cópia manual que o Izanagi faz hoje. **O item do registro shadcn não tem campo de versão**, e o `add` não fixa uma: a versão vai **no caminho da URL** (`/r/v{versao}/{name}.json`), e cada peça instalada fica anotada com versão e hash em `design/wicomm.json` — é isso que permite ver a peça editada no projeto e fazer o diff no `atualizar`. |
| Guardas em teste | **pacote `@wicomm/guardas`** (vitest, lê os arquivos do disco, caminhos configuráveis, com *catraca* — ver 2.4) | Precisa rodar no CI do cliente, com ou sem Claude. |
| Documentos-base (DESIGN, ANATOMIA, princípios, convenções) | **no plugin** (fonte) e **copiados com versão estampada** para `design/` do projeto no bootstrap | O motor lê arquivos do projeto; copiar com carimbo de versão deixa o projeto autossuficiente e a deriva mensurável. |
| Processo: designer, crítico, guarda de turno, skills de bootstrap/auditoria/padronização | **plugin `wicomm-design`** | É o que muda o comportamento do Claude. |
| MCP | **no plugin**, `.mcp.json` com o **MCP oficial do shadcn** apontado para o registro Wicomm; Figma MCP opcional | Nenhum MCP próprio na v1: os arquivos + skills cobrem; MCP próprio só se surgir consulta que arquivo não resolve (*assumida, a confirmar*). |
| Ateliê (catálogo vivo + docs) | **app Next neste repositório**, que também serve os JSON do registro | Uma URL onde designer, dev e cliente veem cada peça nos dois temas. |

**Forma do repositório (recomendada):**

```
wicomm-design-system/
├── .claude-plugin/marketplace.json   ← este repo É o marketplace da empresa
├── plugins/wicomm/            ← o plugin (motor + skills + docs-base + .mcp.json)
├── packages/tokens/                  ← @wicomm/tokens (fonte DTCG → saídas)
├── packages/guardas/                 ← @wicomm/guardas (testes-guarda com catraca)
├── registry/                         ← fonte das peças e blocos (shadcn registry)
├── apps/atelie/                      ← catálogo + docs + /r/*.json do registro
└── docs/ (estudo, adr, specs)
```

### 2.2 As alternativas que pesei

| Alternativa | A favor | Contra | Veredito |
|---|---|---|---|
| **A. Tudo no plugin** (componentes como arquivos que a skill copia) | Um só artefato | Sem versão por peça, sem dependências, sem `shadcn add`; o CI do cliente não tem nada; projeto sem Claude fica órfão | Não |
| **B. Pacote npm de componentes compilados** (`@wicomm/ui`) | Atualização por `pnpm up` | Briga com o modelo shadcn (código no projeto, editável); customizar vira fork; peso em storefront | Não, salvo para tokens e guardas |
| **C. Registro shadcn + pacote de tokens + plugin de processo** (recomendada) | Cada camada no veículo certo; casa com o que o shadcn e o Claude já fazem; funciona sem Claude | Três artefatos para versionar | **Sim** — mitigado com uma versão única do sistema (2.5) |
| **D. Template de repositório (`create-wicomm-app`)** | Projeto novo nasce pronto | Não serve ao projeto existente; envelhece no dia seguinte | Como **bloco** do registro e skill de bootstrap, não como repo-template |

### 2.3 O plugin `wicomm-design` por dentro

- **Nome:** o plugin se chama **`wicomm`**, porque todo comando e skill sai com o nome do plugin na frente (`/wicomm:novo`); com `wicomm-design` seria `/wicomm:novo`. Neste documento, "plugin `wicomm-design`" quer dizer esse plugin.
- **Agentes:** `designer`, `critico-de-ui` (o motor atual do plugin `design`, migrado e desacoplado do kit de orquestração — Q631), e `auditor-de-padrao` (novo, só leitura: mede um projeto existente contra a base).
- **Skills:**
  - `revisao-de-arquitetura-de-ui`, `critica-de-ui` — as atuais, sem mudança de forma; a crítica ganha os eixos extras declarados pelo projeto.
  - `novo-projeto` — bootstrap (seção 3.1).
  - `auditar-projeto` — auditoria de projeto existente (3.2).
  - `plano-de-padronizacao` — da auditoria às fatias.
  - `peca-do-kit` — "preciso de uma peça": procura no registro (MCP shadcn), instala com `shadcn add`, e só propõe peça nova **para o registro**, nunca arranjo na tela.
  - `atualizar-sistema` — sobe a versão estampada: tokens, peças instaladas (diff contra o registro), docs-base (merge de 3 vias com o que o projeto acrescentou).
- **Comandos:** `/wicomm:novo`, `/wicomm:auditar`, `/wicomm:padronizar`, `/wicomm:atualizar`, `/wicomm:estado` (versão do sistema, deriva, nota média das últimas críticas).
- **Hooks:** a guarda atual (lembra o designer, nega edição de tela ao designer, cobra a crítica) + uma guarda nova de `PreToolUse` em `Edit|Write` nos caminhos de tela que **avisa** (não nega) quando o texto novo traz valor solto (`#hex`, `text-[15px]`, `h-[34px]`, `duration-200`) ou importa ícone de outra biblioteca — o aviso barato no momento da escrita; o teste no CI é quem reprova.
- **Configuração no projeto:** `.claude/kit.json`, seção `design` (já é o contrato do motor) + `design/wicomm.json` com `versao` do sistema, `densidade` (`instrumento`|`site`), `marca` (`wicomm`|`cliente:<slug>`), `eixosExtras`, e a catraca das guardas.
- **Impeccable:** fica como **ferramenta auxiliar** (detector no eixo de consistência), não como diretor. Motivo: ele consulta rede e manda telemetria no `shape` (ADR 0375 registra); num plugin da empresa, que roda em repositório de cliente, isso precisa de ok explícito. *Assumida, a confirmar:* o plugin roda só o detector local; `shape` fica opcional por projeto.

### 2.4 Como garantir que toda tela siga a direção — as três travas

| Trava | Quando age | O que pega | Furo que fecha |
|---|---|---|---|
| **1. Processo (plugin)** | no turno do Claude | Tela sem revisão de arquitetura; tela sem crítica; crítica sem forma; designer escrevendo código | O "fiz rápido e ficou bonito" |
| **2. Guardas em teste (`@wicomm/guardas`, CI)** | em todo PR, com ou sem Claude | Cor literal, valor fora da escala, marca escrevendo texto, destrutivo preenchido, animação sem escape, dois títulos de página, dois menus, irreversível sem confirmação, conteúdo fora de superfície, reticências em botão, contraste dos tokens abaixo do piso | O dev humano e o Claude sem o plugin |
| **3. Versão estampada (`design/wicomm.json`)** | no `/wicomm:estado` e num check de CI | Projeto parado em versão velha; peça do registro editada no projeto sem voltar ao registro | A deriva lenta entre projetos — o que faz "parecer outra empresa" com o tempo |

**A catraca (para projeto existente).** As guardas leem um arquivo de linha de base versionado (`design/guardas.base.json`) com a contagem atual de cada violação por arquivo. O teste reprova **violação nova**, **contagem que sobe** e também **contagem que desce sem a base regravada**: quem consertou roda `pnpm guardas --atualizar`, que reescreve a base, e o arquivo entra no mesmo PR (modelo do *betterer*). O teste nunca reescreve a base sozinho — no CI o arquivo reescrito se perderia com a máquina, e o PR seguinte poderia voltar a violar até o número antigo. Assim a guarda liga no dia 1 de um projeto legado sem quebrar o CI, e a padronização só anda para a frente.

**A nota como porta.** Crítica ≥ 24/30 sem ressalva alta é a condição para abrir o PR de tela — igual ao Izanagi. O plugin grava a nota na revisão; `/wicomm:estado` mostra a média das últimas 10 por projeto, o que dá ao operador um número para comparar projetos.

### 2.5 Versão e distribuição

- **Uma versão do sistema** (semver, ex. `1.3.0`) amarra plugin, `@wicomm/tokens`, `@wicomm/guardas` e o registro: o mesmo número sai nos três no release. `MAJOR` = muda token ou anatomia de forma que quebra tela; `MINOR` = peça nova, regra nova com catraca; `PATCH` = conserto. Cada release tem nota de migração que o `/wicomm:atualizar` lê.
- **Marketplace da empresa:** o próprio repositório (`.claude-plugin/marketplace.json`). Cada projeto declara em `.claude/settings.json` o `extraKnownMarketplaces` e o `enabledPlugins` — quem abre o projeto no Claude Code recebe o convite para instalar, sem passo manual. O registro shadcn vai no `components.json` do projeto (`"registries": {"@wicomm": "https://<host>/r/{name}.json"}`), com cabeçalho de token se for privado.
- **Onde hospedar** o repositório, o pacote e o registro publica algo para fora: Q629 e Q630.

---

## 3. Os dois fluxos

### 3.1 Projeto NOVO — bootstrap (`/wicomm:novo`)

1. **Detectar o tipo** (lê `package.json`): app React (Next/Vite) → fluxo completo; FastStore ou Wake → só a camada de comportamento (Q627); outro → para e diz por quê.
2. **Entrevista curta** (vira `design/PRODUCT.md`): quem usa, em que tela e largura, com que frequência → define a **densidade** (`instrumento` ou `site`) e a **marca** (`wicomm` ou do cliente, Q628).
3. **Instalar a base:** `shadcn init` com o estilo Wicomm do registro (tema + tokens), `@wicomm/tokens`, as ~15 primitivas, o **casco** (barra lateral 224/64, cabeçalho, trilha, título de página) e o arquétipo da primeira tela.
4. **Escrever a configuração:** `.claude/kit.json` (seção `design`), `design/wicomm.json` (versão), `design/DESIGN.md` e `design/ANATOMIA.md` copiados da base com carimbo, o bloco Wicomm no `CLAUDE.md`, `.claude/settings.json` com o marketplace, `components.json` com o registro.
5. **Ligar as travas:** `@wicomm/guardas` no `vitest` com base zerada; workflow de CI que roda as guardas; rota `/atelie`.
6. **Primeira tela pelo processo:** designer → crítico → código → crítico.
7. **Pronto quando:** o app sobe; `/atelie` mostra as peças nos dois temas; guardas verdes com base zero; crítica da primeira tela ≥ 24/30.

### 3.2 Projeto EXISTENTE — auditoria → padronização em fatias

1. **`/wicomm:auditar` (só lê, agente `auditor-de-padrao`).** Mede e grava `docs/design/auditoria-AAAA-MM-DD.md`:
   - **Números de deriva:** cores literais (hex/rgb) fora de tokens; valores arbitrários do Tailwind (`[..px]`); tamanhos de fonte distintos; raios distintos; alturas de controle distintas; variantes de botão; bibliotecas de ícone; animações sem escape; pares de contraste abaixo do piso.
   - **Anatomia:** cada rota classificada num dos quatro arquétipos (ou "nenhum"); casco (tem barra lateral? onde fica o primário?); onde mora cada tipo de mensagem.
   - **Peças:** cada componente do projeto mapeado para a peça do registro (igual · equivalente · sem par).
   - **Uma nota por eixo** (os seis da crítica) por tela, amostrando as 5 telas mais usadas.
2. **`/wicomm:padronizar` gera o plano em fatias, nesta ordem** (cada uma é um PR, e nenhuma muda a lógica do produto):
   1. **Tokens com ponte:** instala `@wicomm/tokens` e mapeia as variáveis antigas para as novas por *alias* (nada quebra), liga as guardas **com catraca**. Em projeto Tailwind v3, usa o preset v3.
   1b. **Tailwind v4 (só se o projeto está em v3):** migração com o codemod oficial (`npx @tailwindcss/upgrade`) e captura antes/depois das telas mais usadas. Sem ela, a fatia 2 quebra: as peças do registro usam classes de v4.
   2. **Primitivas:** troca botão, campo, select, diálogo, menu, toast pelas do registro (codemod onde a API bate; à mão onde não bate).
   3. **Casco e navegação:** barra lateral, cabeçalho, título e trilha — é aqui que o cliente "sente o mesmo projeto".
   4. **Tela a tela por arquétipo**, as mais usadas primeiro, cada uma com designer → crítico.
   5. **Remover a ponte:** apaga os aliases e zera o que restou na catraca.
3. **Pronto quando:** catraca zerada (ou com o resto justificado no `depois`), todas as telas com crítica ≥ 24/30, `design/wicomm.json` na versão corrente.

### 3.3 O que muda para o operador no dia a dia

Nada novo para lembrar: com o plugin ligado, "faz a tela de X" já cai no designer (o hook lembra), a peça vem do registro (a skill `peca-do-kit`), o fim do turno cobra a crítica, e o CI reprova o valor solto. O que aparece de novo é o `/wicomm:estado` para comparar projetos.

---

## 4. Plano de execução em fatias

Os números `F261.n` são provisórios: a orquestradora dá o `F` de cada fatia ao abri-la. Modelo pela regra do kit: Opus quando a fatia decide algo; Sonnet quando é mecânica com o plano pronto.

| # | Fatia | Modelo | Depende de | Critério de pronto (medível) |
|---|---|---|---|---|
| F261.1 | **Base Wicomm extraída:** `plugins/wicomm/base/DESIGN.md`, `ANATOMIA.md`, `CONVENCOES.md` a partir dos do Izanagi, sem domínio | Opus | — | `grep -v 'exemplo-izanagi' <arquivos> \| grep -ciE '\b(job|jobs|loja|lojas|wake|vtex|ensō|enso|builder|izanagi)\b'` = 0 (o exemplo que cita o Izanagi leva o marcador `<!-- exemplo-izanagi -->` na linha; `\b` evita casar "denso"); cada regra cita o ADR do Izanagi de onde veio (rastro); crítico de contexto limpo não acha regra perdida numa amostra de 20 regras |
| F261.2 | **`@wicomm/tokens`:** fonte DTCG + gerador → CSS v4 (`@theme`), preset v3, vars puras; teste de contraste portado de `os-tokens-pagam-o-piso` | Opus | F261.1 | Os valores gerados batem 1:1 com o `globals.css` do Izanagi nos tokens de sistema (teste que compara); teste de contraste verde nos dois temas; slot `marca` trocável por um arquivo só |
| F261.3 | **Registro shadcn — estilo + 15 primitivas** em Tailwind v4 (button, input, select, label, card/painel, bloco, bloco-de-tinta, secao, dialog, confirm, menu, tooltip/ajuda, com-motivo, toast, skeleton) | Opus nas 3 primeiras (fixam a API), Sonnet no resto | F261.2 | `shadcn build` sem erro; num Next vazio com `components.json` que declara `registries: {"@wicomm": …}`, `npx shadcn add @wicomm/<peça>` instala e compila cada peça; a URL carrega a versão (`/r/v{versao}/`); cada peça tem teste dom portado; nome em PT (*assumida, a confirmar*) |
| F261.4 | **Blocos de tela:** casco (barra lateral, cabeçalho, trilha, título) e os 4 arquétipos (Lista, Mesa, Editor, Entrada) como `registry:block` | Opus | F261.3 | Cada bloco instala num Next vazio e renderiza; crítico ≥ 24/30 em cada um a 1280 px nos dois temas |
| F261.5 | **Ateliê** (`apps/atelie`): catálogo de todas as peças e blocos, dois temas lado a lado, serve `/r/*.json` | Sonnet | F261.3 | Toda peça do `registry.json` aparece no ateliê (teste que cruza as duas listas); build verde |
| F261.6 | **`@wicomm/guardas`:** ~25 guardas genéricas portadas, caminhos configuráveis, catraca com base | Opus | F261.2 | Rodadas no Izanagi (base zero), não acusam nada que os testes do Izanagi aprovam (0 falso positivo); num fixture com uma violação de cada, acusam todas (0 falso negativo); catraca reprova violação nova, reprova descida sem base regravada, e `--atualizar` grava a descida (três testes) |
| F261.7 | **Plugin `wicomm`:** motor migrado do `design` e desacoplado do kit (sem o marketplace fixo em `opcoes-do-plugin.mjs`, sem `guarda.tronco` do kit, sem "dona do item" nas skills), skills novas (`novo-projeto`, `auditar-projeto`, `plano-de-padronizacao`, `peca-do-kit`, `atualizar-sistema`), comandos, hook de aviso de valor solto, `.mcp.json` com o shadcn, `marketplace.json` | Opus | F261.1; Q631 | `claude plugin validate` limpo; casos de eval em `evals/` (≥ 10 positivos e ≥ 10 negativos por skill) e `claude plugin eval --no-publish --runs 3` com ≥ 90% de disparo nos positivos e ≤ 10% nos negativos (sem `--no-publish` o relatório vai para o claude.ai; cada rodada é uma sessão inteira, com custo); com `design@kit-de-orquestracao` desligado, a guarda do `wicomm` continua agindo (teste); testes do hook portados verdes |
| F261.8 | **Piloto projeto novo:** `/wicomm:novo` num Next vazio | Sonnet executa, crítico Opus | F261.4–F261.7 | Os 4 critérios de 3.1 cumpridos; tempo do bootstrap medido e anotado |
| F261.9 | **Piloto projeto existente:** `/wicomm:auditar` + primeira fatia (tokens com ponte) num projeto real | Opus | F261.6, F261.7; Q632 | Auditoria gravada com os números de deriva; PR da fatia de tokens com catraca ligada e CI verde; zero mudança visual não pretendida (captura antes/depois das 5 telas mais usadas) |
| F261.10 | **Distribuição e adoção:** repositório na org, publicação do registro e dos pacotes, guia de entrada do time, template de CI | Sonnet | Q629, Q630 | Um dev que não é o operador instala o plugin a partir do `settings.json` de um projeto e roda `/wicomm:estado` sem ajuda |
| F261.11 | **Figma:** biblioteca gerada dos tokens (variáveis) + Code Connect das peças do registro | Opus | F261.3; fase 3 | Variáveis do Figma batem com `@wicomm/tokens` (teste); cada peça do registro tem mapa no Code Connect |

**Ordem e paralelismo.** F261.1 → F261.2 → (F261.3 ∥ F261.6) → (F261.4 ∥ F261.5 ∥ F261.7) → (F261.8 ∥ F261.9) → F261.10. F261.11 fica para depois do primeiro piloto.

**Fora do escopo deste plano (vão para `depois`):** o Izanagi passar a consumir `@wicomm/tokens` e o registro (ele é a origem; migrar é item próprio, depois de F261.9); camada de comportamento para FastStore/Wake (depende de Q627); MCP próprio.

---

## 5. Riscos e pegadinhas

- **Copiar o Izanagi inteiro "porque funciona".** Metade das regras do DESIGN nasceu de medição num produto de *instrumento* (corpo `text-xs`). Um app de cliente de uso eventual quebra com essa densidade — por isso a densidade é escolha do projeto (`instrumento`|`site`), e a "cara de site" do builder vira a segunda densidade oficial.
- **Tailwind v3 × v4.** O Izanagi está em v3 com a regra do alfa por `color-mix`; em v4 o problema muda de forma (`@theme inline`, oklch). O teste que pegava o defeito em v3 precisa de um equivalente em v4 — não basta portar. E peça v4 em projeto v3 falha calada (classe que não existe não gera regra): o `peca-do-kit` recusa instalar peça em projeto v3 e aponta a fatia de migração.
- **A cor da marca mede 4,25 com branco** (aceito no ADR 0146). Num projeto com marca de cliente, a regra "a marca não cede a contraste" não pode ser herdada às cegas: o teste de contraste do slot `marca` deve reprovar preenchimento < 3:1 e avisar < 4,5.
- **Nome de peça em português** é coerente com o Izanagi, mas o dev novo procura "Button" no shadcn. O registro deve aceitar os dois nomes na busca (descrição com o nome shadcn) — *assumida, a confirmar*.
- **Impeccable em repositório de cliente** consulta rede e manda telemetria no `shape`; sem ok, só o detector local.
- **Duas fontes para o mesmo motor** (plugin `design` do kit e `wicomm-design`) derivam em semanas. Q631 resolve.
- **Guarda que lê arquivo prova que achou arquivo** (convenção do Izanagi): toda guarda do pacote afirma que a lista de arquivos não é vazia antes de inspecionar — senão um caminho errado no `kit.json` deixa tudo verde.

---

## 6. Assumidas, a confirmar

| Decisão | O que assumi | Por quê |
|---|---|---|
| Nomes das peças | Português, como no Izanagi, com o nome shadcn na descrição | Coerência com o motor e as revisões já escritas |
| Tailwind | Registro em v4; preset v3 para quem está em v3 | O shadcn atual é v4; projeto novo não deve nascer em v3 |
| Fonte | Archivo como padrão Wicomm, trocável no slot `marca` | É a do Izanagi e já tem as medições |
| Ícones | `lucide-react`, sem wrapper, com tamanhos tokenizados (14/16/18) e traço padrão | É o que 128 arquivos já usam; tokenizar fecha a lacuna |
| Temas | Claro e escuro obrigatórios | O Izanagi mede tudo nos dois |
| MCP | Só o oficial do shadcn (com o registro Wicomm) e o Figma opcional; nenhum próprio na v1 | Arquivo + skill resolvem; MCP próprio é custo sem pergunta que o justifique |
| Impeccable | Só o detector local | Rede e telemetria em repo de cliente |
| Docs-base no projeto | Cópia com carimbo de versão + merge de 3 vias no `atualizar` | Projeto autossuficiente e deriva visível |
| Catraca | Liga em todo projeto existente desde a auditoria | Guarda que quebra o CI no dia 1 é desligada no dia 2 |

---

## 7. Decisões do operador

**Q627 · F261 · Escopo da v1: apps React primeiro, lojas depois?**
- **O caso:** a Wicomm faz dois tipos de coisa com tela. (a) **Apps React** — painéis, sistemas internos, apps para o cliente (Supabase, Next). Ali o shadcn e o Tailwind cabem e dá para ter literalmente os mesmos componentes. (b) **Lojas** VTEX FastStore e Wake — a vitrine que o consumidor final vê, com a marca e o layout do cliente; o FastStore usa outro kit de componentes (`@faststore/ui`, SCSS) e o shadcn não entra.
- **Se não decidir:** sigo com a v1 só para apps React (fatias 1–10), e as lojas ficam fora do plano.
- **Recomendação:** **v1 só para apps React**; para lojas, uma fase 2 que leva só a *camada de comportamento* (movimento, estados, mensagens, acessibilidade, anatomia de checkout/conta) e os tokens de sistema em SCSS — nunca a marca Wicomm na vitrine do cliente. Motivo: é onde o "mesmo projeto" é possível de verdade; na loja, o que o cliente reconhece é o comportamento, não a cor.

**Q628 · F261 · Em app feito para um cliente, a marca é da Wicomm ou do cliente?**
- **O caso:** um painel que a Wicomm entrega a um cliente pode ter o vermelho da Wicomm (cliente reconhece "a Wicomm fez") ou a cor do cliente (o painel é dele). O plano separa **sistema** (fixo em todo projeto: anatomia, navegação, escala, movimento, as cinco vozes de estado, neutros) de **marca** (trocável: cor primária, degradê, fonte).
- **Se não decidir:** todo app nasce com a marca Wicomm, e trocar fica possível por um arquivo.
- **Recomendação:** **sistema sempre Wicomm; marca Wicomm por padrão e do cliente quando o app é dele** (`design/wicomm.json` → `marca: cliente:<slug>`), com o mesmo teste de contraste. Motivo: o que faz o cliente "sentir o mesmo projeto" é navegação, hierarquia e comportamento — e esses não mudam; a cor do cliente no app dele evita a objeção comercial.

**Q629 · F261 · Criar o repositório na organização da Wicomm no GitHub (privado)?**
- **O caso:** este repositório precisa de um endereço para virar o marketplace da empresa — cada projeto aponta para ele no `settings.json`. Hoje ele só existe no seu Mac, sem remoto. O kit de orquestração mora na sua conta pessoal (`ichikawacraice/kit-de-orquestracao`).
- **Se não decidir:** sigo com tudo local até a F261.9 (pilotos funcionam apontando para a pasta); a F261.10 (o time instalar) fica parada.
- **Recomendação:** **criar `wicomm/wicomm-design-system`, privado, na org da empresa** (diga o nome exato da org). Motivo: é da empresa, não pessoal; quem sair do time não leva o marketplace junto; o acesso do time se controla pela org.

**Q630 · F261 · Onde publicar o registro shadcn e os pacotes `@wicomm/tokens` e `@wicomm/guardas`?**
- **O caso:** o `shadcn add` busca as peças numa URL, e os pacotes precisam de um registro npm. Público expõe o código do design system; privado exige token em cada projeto e no CI.
- **Se não decidir:** nada se publica; os pilotos usam o registro servido localmente e os pacotes por caminho de pasta.
- **Recomendação:** **registro servido pelo ateliê na Vercel da Wicomm, com proteção por token (cabeçalho no `components.json`), e pacotes no GitHub Packages da org (privado)**. Motivo: a Wicomm já usa Vercel; GitHub Packages usa o mesmo acesso da org do Q629, sem conta nova.

**Q631 · F261 · O motor de design sai do seu kit pessoal e passa a morar no plugin da Wicomm?**
- **O caso:** o designer, o crítico e a guarda de turno são hoje o plugin `design` do seu `kit-de-orquestracao`. O plugin da Wicomm precisa do mesmo motor. Manter duas cópias faz elas divergirem.
- **Se não decidir:** o `wicomm-design` nasce com uma cópia do motor e o `design` do kit segue como está — duas fontes.
- **Recomendação:** **mover o motor para o plugin `wicomm`**, desacoplado do kit (hoje a guarda se desliga quando `design@kit-de-orquestracao` está desligado — isso sai na migração), e deixar o `design` do kit como um apontador (a entrada do marketplace do kit passa a buscar o plugin no repositório da Wicomm). No Izanagi, desligar o `design` só depois de ligar o `wicomm` e conferir que a guarda age. Motivo: uma fonte só; o time da Wicomm não precisa instalar o seu kit de orquestração (Q-IDs, painel) para ter o processo de design.

**Q632 · F261 · Qual projeto existente é o piloto da padronização?**
- **O caso:** a F261.9 precisa de um projeto real da Wicomm para auditar e aplicar a primeira fatia. Não sei quais apps React a Wicomm mantém hoje.
- **Se não decidir:** a F261.9 fica parada; o resto segue.
- **Recomendação:** **um app React pequeno e ativo (painel interno ou app de cliente com Supabase), não uma loja e não o Izanagi**. Motivo: dá a medição de deriva num caso típico sem o risco de mexer na vitrine de um cliente ou na origem do próprio sistema. Diga o nome e o caminho.
