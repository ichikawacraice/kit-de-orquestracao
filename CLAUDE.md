# CLAUDE.md — wicomm-design-system

O design system dos apps React da Wicomm: a base de regras, os tokens, o registro shadcn, as guardas, o plugin do Claude Code e o ateliê. O estudo e o plano estão em [`docs/estudo/F261-plugin-design-system.md`](docs/estudo/F261-plugin-design-system.md).

## Idioma e forma
- Tudo em **português (PT-BR)**: docs, regras, mensagens de commit, título e corpo de PR. Código e identificadores seguem a convenção de cada pacote.
- Horários no horário de São Paulo.
- Commit em *conventional commits* (`docs(base): …`, `feat(tokens): …`), com o ID do item quando houver (`F262 · …`).

## A base é norma
- [`plugins/wicomm/base/`](plugins/wicomm/base/) tem a direção de design (`DESIGN.md`), a anatomia (`ANATOMIA.md`) e as convenções (`CONVENCOES.md`). É a fonte de verdade das outras camadas: tokens, peças, guardas e o plugin citam as regras pelo **código** (`COR-03`, `ARQ-01`).
- Toda regra tem **Regra · Por quê · Confere**. Regra sem como conferir é opinião. A origem de cada regra fica fora da base, em [`docs/rastreio/origens-da-base.md`](docs/rastreio/origens-da-base.md): regra sem linha de rastreio é palpite.
- Código de regra **não se renumera** nem se reaproveita: regra que sai fica com o código marcado *revogada* e o motivo.
- A base fala só da Wicomm: não cita domínio de produto nenhum nem o produto de origem, e não traz exemplo tirado dele.
- Mudar regra que já existe muda a versão no frontmatter dos três arquivos (semver do sistema, estudo §2.5).

## Gate
- `npm test` — as guardas da base (`scripts/base.test.mjs`): domínio de origem fora da base, os três campos de cada regra, uma linha de rastreio por regra, rastreio sem regra que a base não tem, toda origem e guarda citada conferida em `scripts/origens-conhecidas.json`, nenhuma origem na base, índice igual às regras, código único, referência cruzada que existe; mais os testes dos hooks e scripts do plugin e a concordância dos evals.
- Todo PR roda o gate antes de pedir merge e cola a saída no PR.

## PR
- Contra `main`. Corpo em PT-BR com: o que muda, o critério de pronto do item e como foi conferido, o que ficou *assumido, a confirmar*.
- Com orquestradora ativa no projeto, quem mergeia é ela.
