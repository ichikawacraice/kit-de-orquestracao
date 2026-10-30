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
| `confirm-dialog` | alert-dialog | `useConfirm()` no lugar do `window.confirm` |
| `tooltip` | tooltip | a dica; `Ajuda` (um gatilho, um texto) |
| `dica-de-ajuda` | — | o ⓘ ao lado do controle (hover, foco e toque) |
| `com-motivo` | — | o gesto desabilitado diz por quê |
| `toast` | sonner/toast | o aviso do desfecho; o de erro fica até ser fechado |
| `skeleton` | skeleton | a espera; `EsperaDaLista` |
| `menu` | dropdown-menu | grupos por ar, linha bloqueada com motivo, confirmação pela peça, escolha, submenu |

Nomes: as primitivas do shadcn mantêm o nome do shadcn (`button`, `dialog`); as peças próprias são em português. As props seguem a mesma regra: as do shadcn com o nome do shadcn (`variant`, `size`), as acrescentadas em português (`tamanho`, `voz`, `tom`).

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
| `test/cn.test.ts` | O `cn` conhece os nomes do tema (`text-legenda`, `rounded-ctrl`, `h-ctrl`, `duration-*`, superfícies e vozes). |
| `tsc --noEmit` | As peças compilam em modo estrito. |
| `scripts/num-next-vazio.mjs` | (fora do gate) `init` + `add` de cada peça, uma a uma, num Next vazio, e o `next build` de uma página que usa todas. |
