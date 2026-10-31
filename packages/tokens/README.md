# @wicomm/tokens

Os tokens de design dos apps React da Wicomm — cor, raio, sombra, tipo, movimento e medida — numa fonte só, gerada para o tema do Tailwind v4 e para variáveis CSS puras. As regras que estes valores pagam estão na base ([`plugins/wicomm/base/DESIGN.md`](../../plugins/wicomm/base/DESIGN.md)); cada token cita o código da regra (`MARCA-01`, `COR-11`).

> **Privado, no GitHub Packages da org `wicomm-projects`.** Como instalar (o `.npmrc` e o token): [`docs/instalar-pacotes.md`](../../docs/instalar-pacotes.md).

## Uso

**Tailwind v4** (projeto novo e registro shadcn):

```css
@import "tailwindcss";
@import "@wicomm/tokens/tailwind-v4.css";
```

**A ordem importa:** `tailwindcss` primeiro. Invertido, o preflight do Tailwind vence a borda padrão do pacote e toda `border` volta à cor do texto, sem erro.

Traz as variáveis dos dois temas (`:root` claro, `.dark` escuro), o `@theme inline` que dá classe a elas, o `dark:` pela classe `.dark`, a base (borda padrão em `border`, `body` no chão e na tinta do tema), as utilitárias (`superficie`, `superficie-alta`, `superficie-flutuante`, `anel-de-controle`, `bg-primary-gradient`, `duration-*`, `delay-*`, `h-ctrl`, `size-ctrl`, `font-archivo`, `shadow-linha-ativa`) e as vozes (`t-display`, `t-titulo`, `t-denso`, `t-rotulo`, `t-coluna`, `t-campo`, `t-medida`, `painel`) na camada `components`.

**Só Tailwind v4** (Q640): projeto em v3 migra para v4 antes de receber os tokens (fatia de padronização).

**Sem Tailwind:** `@wicomm/tokens/tokens.css` (só as variáveis) e `@wicomm/tokens/tokens.json` (tudo resolvido, por tema).

A fonte da família (`TIPO-01`, Archivo) é carregada pelo app, que declara `--font-archivo` no `<html>`; o pacote só a usa.

## A fonte

- [`fonte/sistema.tokens.json`](fonte/sistema.tokens.json) — os tokens de sistema, em DTCG (`$value`, `$type`, `$description`, aliases `{grupo.token}`). Nos grupos `cor`, `composto`, `sombra` e `raio`, a chave é o nome da variável CSS. O valor do tema escuro, quando difere, vai em `$extensions["com.wicomm"].escuro`.
- [`fonte/marca.tokens.json`](fonte/marca.tokens.json) — **o slot da marca**: o único lugar com a cor da marca. O sistema aponta para ela por alias (`primary`, `ring`, `marca-viva`, `chart-1`…). Trocar a marca é trocar este arquivo. A marca dos apps é sempre a Wicomm (Q628) e o teste de contraste fixa `#F30B42` (MARCA-01): `npm run gerar -- --marca <arquivo>` gera com outra marca para experimentar, mas o gate reprova esse `dist/` — mudar a marca de verdade é mudar o arquivo, o valor fixado no teste e a base, juntos.

Os valores ficam em string CSS (hex, `220ms`, `14px`); os objetos compostos do DTCG 2025 (cor em `components`, dimensão em `{value, unit}`) entram quando houver quem os consuma (a fatia do Figma).

## Gerar e conferir

```bash
npm run gerar -w @wicomm/tokens
npm test -w @wicomm/tokens
```

`dist/` vai no git e é gerado: o teste começa com `gerar --conferir`, que reprova `dist/` velho.

Os testes:

| arquivo | o que prova |
|---|---|
| `paridade.test.mjs` | Todo token tem o mesmo valor do produto de origem (cópia íntegra em `test/fixtures/izanagi`), e todo token da origem vem ou está excluído com motivo; o frontmatter da base concorda com o pacote. |
| `os-tokens-pagam-o-piso.test.mjs` | Os pares de contraste nos dois temas (COR-12, COR-11, MARCA-01/02/03/05, COR-06/07, COR-15, CTRL-09). |
| `marca.test.mjs` | Trocar o arquivo de marca muda os tokens da marca e só eles, em todas as saídas. |
| `tailwind.test.mjs` | A saída compila no Tailwind v4 real, e cada token gera a sua classe. |

## O que ficou de fora da origem

Os tokens de domínio do produto de origem (etapas do percurso, plataformas, selo de origem, camada de desenho, o tema de campanha), a identidade de pessoa (`pessoa-*`, a decidir com o monograma no registro), `--spacing`/`--font-size`, que eram inertes no v3 da origem e no v4 alargariam todo o espaçamento, e as chaves só do v3 (`archivo`, `animationScale`). O motivo de cada um está no teste de paridade (`EXCLUIDOS` e o comentário do config).
