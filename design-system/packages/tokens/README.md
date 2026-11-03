# @wicomm/tokens

Os tokens de design dos apps React da Wicomm — cor, raio, sombra, tipo, movimento e medida — numa fonte só, gerada para o tema do Tailwind v4 e para variáveis CSS puras. As regras que estes valores pagam estão na base ([`plugins/design-system/base/DESIGN.md`](../../plugins/design-system/base/DESIGN.md)); cada token cita o código da regra (`MARCA-01`, `COR-11`).

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
- [`fonte/marca.tokens.json`](fonte/marca.tokens.json) — **o slot da marca**: o único lugar da fonte com a cor da marca. O sistema aponta para ela por alias (`primary`, `ring`, `marca-viva`, `chart-1`…). É cópia das cores do tema padrão ([`temas/wicomm/tema.tokens.json`](../../temas/wicomm/tema.tokens.json)), conferida byte a byte pelo teste: quem edita a marca edita o tema e copia.

## O tema

O que é da marca e não do sistema mora numa pasta de tema, fora do pacote: [`temas/<id>/`](../../temas/) na raiz do repositório, com dois arquivos.

- `tema.tokens.json` — as cores da marca (o slot `marca`, em DTCG).
- `tema.json` — o nome, o logotipo, a fonte do texto (família, a variável que o app declara, o nome da utilitária, se tem o eixo de largura), a razão aceita da tinta sobre a marca e o prefixo do registro. Formato em [`tema.schema.json`](tema.schema.json).

```bash
npm run gerar -w @wicomm/tokens -- --tema <pasta do tema> --saida <pasta>
```

Gera as três saídas com outro tema, em outra pasta; o `dist/` publicado é sempre o do tema Wicomm. O tema é conferido antes de gerar pelas regras que a base já manda — o hover na mesma matiz e a cor igual nos dois temas (MARCA-01), as pontas do gradiente a 2:1 (MARCA-03) — e o que as quebra sai com erro, com a regra. `--marca <arquivo>` continua valendo para trocar só as cores. A guarda de contraste deste pacote ainda fixa `#F30B42` (MARCA-01): o `dist/` de outro tema não passa por ela.

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
