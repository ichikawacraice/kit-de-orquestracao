# Design system Wicomm

O design system dos apps React próprios da Wicomm: a norma de design, os tokens, as peças, as guardas e o plugin do Claude Code que leva tudo isso a cada projeto.

**Para:** apps React da Wicomm (Next ou Vite, Tailwind v4), sempre com a marca Wicomm.
**Fora:** lojas FastStore e Wake (marca do cliente, outro kit) e projeto sem React.

## Por onde começar

| Você quer… | Leia |
|---|---|
| Usar o sistema num app: instalar, os comandos, como uma tela nasce, o que ligar e desligar | **[Começar](docs/comecar.md)** |
| Ver as cores, as peças vivas, as telas e as regras | O [ateliê](https://wicomm-atelie.vercel.app) (com senha: [como pedir](docs/publicar-atelie.md#como-entrar)) |
| Entender o que o plugin traz e configurar um projeto | [README do plugin](plugins/design-system/README.md) |
| Instalar os pacotes num projeto ou no CI | [Instalar os pacotes](docs/instalar-pacotes.md) |
| Ler a norma | [A base](plugins/design-system/base/): `DESIGN.md`, `ANATOMIA.md`, `CONVENCOES.md` |
| Saber o que mudou em cada versão | [CHANGELOG](CHANGELOG.md) |

## O que tem aqui

| Pasta | O que é |
|---|---|
| [`plugins/design-system/`](plugins/design-system/) | O plugin `design-system` do Claude Code: a base (a norma), o designer, o crítico com nota, as guardas e os comandos `/design-system:*`. O `plugins/wicomm/` é o nome antigo, congelado até os projetos migrarem. |
| [`packages/tokens/`](packages/tokens/) | `@wicomm/tokens`: o tema em CSS para o Tailwind v4. |
| [`packages/guardas/`](packages/guardas/) | `@wicomm/guardas`: as guardas que rodam no `npm test` do projeto e reprovam o que foge da norma. |
| [`packages/registro/`](packages/registro/) | O registro shadcn `@wicomm`: as peças, os blocos de tela e o estilo. |
| [`apps/atelie/`](apps/atelie/) | O ateliê: a vitrine viva e o registro publicado. |
| [`docs/`](docs/) | Guias, o estudo e os planos. |

## Para quem mexe neste repositório

- Regras do repositório (idioma, commits, a base como norma, o gate): [`CLAUDE.md`](CLAUDE.md).
- O gate: `npm test` na raiz.
- O estudo que deu origem ao sistema: [`docs/estudo/F261-plugin-design-system.md`](docs/estudo/F261-plugin-design-system.md).
