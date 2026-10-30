# Ateliê Wicomm (`apps/atelie`)

O catálogo vivo do design system: toda peça do registro ([`@wicomm/registro`](../../packages/registro/README.md)) montada de verdade, nos dois temas lado a lado, e o próprio registro servido em `/r/v{versao}/*.json` — a URL que o `components.json` dos projetos aponta.

> **Ainda não publicado.** Roda local (`npm run dev`) e gera um site estático (`npm run build` → `out/`). A publicação com acesso protegido é outra fatia.

## Rodar

```bash
npm run dev -w @wicomm/atelie     # monta o registro em public/r/ e abre o Next em modo dev
npm run build -w @wicomm/atelie   # registro + next build (export estático em out/) + conferência da saída
npm test -w @wicomm/atelie        # o gate do app (abaixo)
```

## Como está montado

- **Next (App Router) com `output: "export"`**: site estático, uma página por item. As rotas:
  - `/` — o início: como instalar e a lista por seção;
  - `/catalogo/{nome}/` — a página de cada item do registro: o que é, o equivalente no shadcn, o comando de instalação, os arquivos, o que traz junto, e os **dois palcos**;
  - `/palco/{claro|escuro}/{nome}/` — só a demonstração, num tema. A página do item a embute em dois `iframe`: assim o que a peça abre por portal (diálogo, menu, dica, aviso) nasce no tema certo;
  - `/r/v{versao}/{nome}.json` e `/r/v{versao}/registry.json` — o registro, saído do `shadcn build` de `packages/registro` (`scripts/registro.mjs`).
- **O kit é o registro, sem cópia**: `src/components/ui/*.ts` e `src/lib/*.ts` reexportam a fonte (`@/registry/wicomm/…` → `packages/registro/registry/`). As demonstrações importam `@/components/ui/<peça>`, como um projeto depois do `shadcn add`. O Tailwind lê as classes da fonte do registro pelo `@source` do `globals.css`.
- **A lista vem do `registry.json`** ([`src/catalogo/registro.ts`](src/catalogo/registro.ts)): o tipo do item decide a seção da navegação — Fundamentos (`registry:style`, `registry:lib`), Peças (`registry:ui`), Blocos de tela (`registry:block`, `registry:page`). A seção sem item diz que está vazia.
- **A demonstração de cada item** mora em [`src/catalogo/demos/{nome}.tsx`](src/catalogo/demos/) e entra no mapa [`src/catalogo/demos.ts`](src/catalogo/demos.ts).

### Item novo no registro

Peça ou bloco novo no `registry.json` aparece sozinho na navegação, mas **o gate reprova até ele ter demonstração**: escreva `src/catalogo/demos/{nome}.tsx` (export default, sem props) e registre no mapa de `demos.ts`.

### Espaço para a vitrine

A vitrine completa (cores com contraste, tipografia, movimento, ícones, regras, changelog) entra como páginas novas em `src/app/(casco)/` e uma seção a mais em `SECOES` — o casco e a navegação já são por seção.

## O gate (`npm test`)

| passo | o que prova |
|---|---|
| `vitest run` (`test/catalogo.test.tsx`) | O `registry.json` lido é o que o registro gera; **todo item do registro tem demonstração e toda demonstração é de um item**; todo item cai numa seção; cada demonstração monta em jsdom sem erro. |
| `tsc --noEmit` | O app e as peças compilam em modo estrito. |
| `wicomm-guardas` | As guardas de design no próprio ateliê, com a configuração de [`design/wicomm.json`](design/wicomm.json) (as desligadas dizem por quê). |
| `npm run build` | O export estático, e `scripts/conferir-saida.mjs`: cada item tem o JSON em `out/r/v{versao}/`, a página do catálogo e os dois palcos. |

A fonte é a Archivo com o eixo de largura (`@fontsource-variable/archivo`, servida pelo próprio app): o build não depende de rede.
