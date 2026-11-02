# @wicomm/registro

O registro shadcn da Wicomm: o **estilo** (os tokens de [`@wicomm/tokens`](../tokens/README.md) no `globals.css` do projeto, mais o `cn`) e as **peças básicas** dos apps React, já adaptadas à base ([`plugins/wicomm/base/`](../../plugins/wicomm/base/)). O código entra no projeto pelo `shadcn add` e fica editável lá.

> **Ainda não publicado.** O ateliê ([`apps/atelie`](../../apps/atelie/README.md)) serve o registro em `/r/v{versao}/` (local, `npm run dev -w @wicomm/atelie`); a publicação é outra fatia. `npm run num-next-vazio` também serve o build localmente.

**Só Tailwind v4 e React 19** (Q640). Projeto em v3 migra antes de receber peças. As peças recebem `ref` como prop (sem `forwardRef`): em React 18 o `ref` não chega ao elemento, sem erro de compilação — e o `register` de formulário quebra calado.

**A fonte é do app:** a família (TIPO-01, Archivo com o eixo de largura) é carregada pelo app, que declara `--font-archivo` no `<html>` (no Next, `next/font` com `variable: "--font-archivo"`). Sem ela o texto cai na fonte do sistema e as vozes que estreitam a letra (`t-rotulo`) não estreitam.

## Num projeto

1. **O estilo, pelo `init`** — num projeto Next/Vite com Tailwind v4:

   ```bash
   npx shadcn@latest init https://<host>/r/v0.1.0/estilo.json
   ```

   O `init` reescreve o `globals.css` com os tokens dos dois temas, as utilitárias (`superficie`, `anel-de-controle`, `h-ctrl`, `duration-*`…), as vozes (`t-titulo`, `t-rotulo`…) e instala o `cn` da Wicomm em `lib/utils.ts`. O estilo tem `extends: "none"`: não traz o estilo base do shadcn.

2. **O registro no `components.json`**, com a versão no caminho:

   ```json
   "registries": { "@wicomm": "https://<host>/r/v0.1.0/{name}.json" }
   ```

3. **As peças:**

   ```bash
   npx shadcn@latest add @wicomm/button @wicomm/dialog
   ```

   Toda peça depende de `@wicomm/estilo`: num projeto que pulou o passo 1, o `add` traz o tema junto. Mas faça o `init`: o `add` não sobrescreve variável que o projeto já declara (o `--background` do template do Next fica), e o `init` sim.

A versão vai **no caminho da URL** (o item do shadcn não tem campo de versão): trocar de versão é trocar a URL no `components.json`.

## As peças

| peça | equivale a (shadcn) | o que é |
|---|---|---|
| `estilo` | style/theme | os tokens, as utilitárias, as vozes e o `cn` |
| `idioma-de-cor` | — | as cinco vozes (`ok`, `espera`, `ruim`, `neutro`, `alheio`) e as classes de cada uma (COR-03, COR-05) |
| `button` | button | escala `sm`/`default`/`lg`/`xl`/`icon`; variantes de forma; destrutivo em contorno |
| `input` | input | o campo; `tamanho="xl"` da tela de Entrada; `classeDoCampo()` para o nativo |
| `label` | label | as vozes `rotulo` e `campo` |
| `select` | select | gatilho com a forma do campo, lista flutuante |
| `card` | card | a peça opaca, sem contorno |
| `secao` | — | o assunto separado por ar e rótulo (30/12); `TopoDoPainel` |
| `painel` | — | o painel que rola por conta própria; `PainelDeSecao` |
| `bloco` | — | o nome solto e o cartão com o conteúdo; recolhível |
| `bloco-de-tinta` | callout | o degrau de tinta da voz; `GrupoDeTinta` |
| `dialog` | dialog | o curto, o `DialogLongo` (com `bloqueia`) e o `DialogLateral` |
| `confirm-dialog` | alert-dialog | `useConfirm()` no lugar do `window.confirm`; com `onConfirmar`, a ação roda com o diálogo aberto |
| `tooltip` | tooltip | a dica; `Ajuda` (um gatilho, um texto) |
| `dica-de-ajuda` | — | o ⓘ ao lado do controle (hover, foco e toque) |
| `com-motivo` | — | o gesto desabilitado diz por quê |
| `toast` | sonner/toast | o aviso do desfecho; o de erro fica até ser fechado |
| `skeleton` | skeleton | a espera; `EsperaDaLista` |
| `menu` | dropdown-menu | grupos por ar, linha bloqueada com motivo, confirmação pela peça, escolha, submenu |
| `antes-do-desenho` | — | o script que aplica o tema e a barra recolhida no `<html>` antes do primeiro desenho (layout raiz) |
| `link-do-app` | — | o link das peças: `<a>` por padrão, o do framework pelo `ProvedorDeLink` |
| `chip-de-estado` | — | o estado em uma palavra (`ChipDeEstado`, `ChipQueAbre`), com a forma única do carimbo |
| `badge` | badge | o valor que classifica (não o estado), no mesmo casco do carimbo; neutro ou `marca` |
| `estado` | — | o ponto de 6px e a palavra |
| `medalhao-do-icone` | — | o disco com o ícone do assunto |
| `trilha` | breadcrumb | a trilha de volta da tela de detalhe |
| `vazio` | empty | a região sem itens diz a causa |
| `tela-de-erro` | — | a rota ou o bloco que não deu para mostrar |
| `topo-da-pagina` | — | `PaginaDoApp` e `TopoDaPagina`: o `h1` único, o estado, o primário, o ⋯, a linha dos valores (CASCO-04), o desfecho, os filtros |
| `seletor-de-vista` | tabs/toggle-group | `BarraDeModos`: abas e modos, a pílula que desliza |
| `table` | table | a tabela com o filete-guia e a régua do cabeçalho, a linha inteira que abre |
| `linha-do-grupo` | table/collapsible | o grupo de linhas: o `tbody` com a linha do grupo no degrau de tinta, a contagem e as células alinhadas |
| `prazo` | — | a data em medida e a legenda relativa; a voz só com o `tom` de quem chama |
| `escolha-na-celula` | dropdown-menu/popover | trocar o valor na célula: a leitura e o chevron, o menu ou o popover com Salvar |
| `ficha` | — | pares rótulo/valor |
| `trilho-do-percurso` | stepper | o percurso de um objeto na Mesa |
| `logotipo` | — | a marca Wicomm (provisória até o desenho oficial) |
| `menu-do-tema` | — | claro, escuro ou do sistema; `useTema`, `ScriptDoTema` |
| `menu-da-conta` | — | o monograma, a conta e Sair |
| `monograma` | avatar | o círculo das iniciais, em tinta neutra; o tracejado da pessoa que não há |
| `pessoa` | avatar group | `Pessoa` (monograma, nome, papel; ausente, sem nome) e `PilhaDePessoas` (+N, a frase na dica) |
| `checkbox` | checkbox | a caixa de marcar e a `OpcaoDeMarcar` (a caixa com o texto) |
| `progress` | progress | o progresso de uma etapa conhecida, com o valor escrito |
| `medidor` | — | o número contra o teto (`meter`), a barra neutra |
| `carregando-por-cima` | — | a troca de contexto: o véu sobre a região, a partir de 120ms |
| `faixa` | alert | o aviso de quando a tela inteira mente: uma por tela, uma linha por assunto, com a saída |

**Procurou pelo nome do shadcn e não achou?** Algumas funções já têm peça com outro nome (ANATOMIA, PECA-01):

| no shadcn | na Wicomm |
|---|---|
| `sheet` | `DialogLateral` (`dialog`), para consultar ao lado do trabalho; o formulário que pede janela é o `DialogLongo` |
| `tabs`, `toggle-group` | `BarraDeModos` (`seletor-de-vista`): `densidade="abas"` troca o painel, `"modos"` troca o desenho |
| `hover-card` | `Popover` (detalhe sob demanda, no clique) ou `DicaDeAjuda` (ajuda que não gera decisão); hover como pista só na barra recolhida |
| `scroll-area` | `RolagemDoPainel` (`painel`): a rolagem nativa, com o respiro nas três densidades |
| `command`, `combobox` | `Select`, por enquanto: a escolha com busca ainda não tem regra |

Nomes: as primitivas do shadcn mantêm o nome do shadcn (`button`, `dialog`); as peças próprias são em português. As props seguem a mesma regra: as do shadcn com o nome do shadcn (`variant`, `size`), as acrescentadas em português (`tamanho`, `voz`, `tom`).

## Os blocos de tela

Os blocos (`registry:block`) são as telas inteiras montadas com as peças: o **casco** e os arquétipos da ANATOMIA (ARQ-01). Cada um traz o componente (puro: recebe a carga por props), os dados de exemplo e uma **página de exemplo no App Router**, que escolhe o estado por `?estado=`. O projeto apaga os dados de exemplo e liga a própria consulta à mesma carga.

| bloco | o que instala | página de exemplo |
|---|---|---|
| `casco` | `CascoDoApp` (barra lateral, cabeçalho opcional, região que rola), `BarraLateral`, `CabecalhoDoApp`, a cola do Next (`casco-no-next`) e a navegação de exemplo (`lib/navegacao.ts`) | `app/(casco)/layout.tsx` |
| `lista` | `ListaDePedidos` e `lib/dados-da-lista.ts` | `app/(casco)/pedidos/page.tsx` |
| `mesa` | `MesaDoPedido` e `lib/dados-da-mesa.ts` | `app/(casco)/pedidos/[id]/page.tsx` |
| `entrada` | `TelaDeEntrada` | `app/(tela-inteira)/entrar/page.tsx` |

```bash
npx shadcn@latest add @wicomm/casco @wicomm/lista @wicomm/mesa @wicomm/entrada
```

- **O script antes do desenho vai no layout raiz.** `<ScriptsAntesDoDesenho />` (`@wicomm/antes-do-desenho`) no `<head>` do `app/layout.tsx` — no Vite, `CODIGO_ANTES_DO_DESENHO` num `<script>` do `index.html` — aplica o tema guardado e a barra recolhida no `<html>` antes do primeiro desenho, sem clarão nem pulo. Nunca dentro de componente que o cliente desenha: lá o React não executa `<script>`. O `<html>` leva `suppressHydrationWarning`.
- **Só a cola é do Next.** As peças e os componentes dos blocos não importam `next/*`: o caminho atual entra por prop (ou pelo gancho do roteador, `useCaminhoAtual`) e o link pelo `ProvedorDeLink`. Num app Vite, refaça a cola (`casco-no-next`) com o roteador dele e use os componentes como estão.
- **As rotas de exemplo** usam nomes reais (`/pedidos`, `/entrar`) para as guardas lerem a topologia certa (a Mesa é tela de detalhe e tem trilha). Num projeto que já tem essas rotas, o `add` pergunta antes de sobrescrever.
- **O Editor** vem na fatia seguinte.

## Desenvolver

```bash
npm run gerar -w @wicomm/registro        # reescreve o registry.json (estilo e lista de peças)
npm test -w @wicomm/registro             # o gate do pacote
npm run build -w @wicomm/registro        # shadcn build em public/r/v{versao}/
npm run num-next-vazio -w @wicomm/registro  # o critério de pronto inteiro num Next vazio (rede, minutos)
```

- **A fonte:** `registry/wicomm/ui/*.tsx` e `registry/wicomm/lib/*.ts` (importações entre peças por `@/registry/wicomm/…`, que o `add` reescreve para os aliases do projeto). A lista das peças, o que cada uma pede do npm e de quem depende está em [`lib/itens.mjs`](lib/itens.mjs).
- **O estilo é gerado** de `@wicomm/tokens/tailwind-v4.css` ([`lib/css.mjs`](lib/css.mjs)): cor e `--radius` vão ao `cssVars`; sombra, degradê e raio nomeado vão ao `css` no mesmo seletor (o CLI daria a cada variável de `cssVars` um `--x: var(--x)` no `@theme`). O tema ganha os raios `xl`–`4xl` do próprio Tailwind, porque o CLI, ao ver `--radius`, injetaria uma escala em que `rounded-xl` vira 14px e `rounded-2xl` 18px (FORMA-01 pede 12 e 16).
- **`registry.json` vai no git e é gerado:** o teste começa com `gerar --conferir`. `public/` não vai: é saída do build.

Os testes:

| arquivo | o que prova |
|---|---|
| `test/registro.test.mjs` | O estilo carrega todo token do pacote com o mesmo valor; cada arquivo está em uma peça; toda importação está declarada (npm e registro); as versões do npm são as que os testes rodaram; toda peça tem teste dom; nada do produto de origem no que se instala; o `shadcn build` sai na pasta da versão. |
| `test/*.dom.test.tsx` | O comportamento de cada peça em jsdom: escala e variantes, superfícies, diálogos, dica, aviso, confirmação, ⓘ e menu. |
| `test/marcar-medir-e-avisar.dom.test.tsx` | A caixa de marcar, o progresso, o medidor, o valor rotulado, o véu da troca de contexto (os 120ms) e a faixa (a ordem dos assuntos). |
| `test/cn.test.ts` | O `cn` conhece os nomes do tema (`text-legenda`, `rounded-ctrl`, `h-ctrl`, `duration-*`, superfícies e vozes). |
| `test/as-pecas-dos-blocos.dom.test.tsx`, `test/os-blocos.dom.test.tsx` | As peças que os blocos pedem, e cada bloco nos estados da revisão de arquitetura. |
| `test/guardas-nos-blocos.test.mjs` | As guardas de `@wicomm/guardas` sobre o que o registro instala, no lugar em que o `add` o põe, com base zero; e a prova de que a varredura morde. |
| `tsc --noEmit` | As peças e os blocos compilam em modo estrito (a cola do Next fica com o `next build`). |
| `scripts/num-next-vazio.mjs` | (fora do gate) `init` + `add` de cada peça e cada bloco, um a um, num Next vazio, o `next build`, e cada página de exemplo servida com o título dela. |
