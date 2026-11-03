# ADR 0020 — O design system mora numa pasta com dependências e gate próprios

- Data: 2026-11-02
- Status: Proposto
- Autor: sessão dona do F357, a partir das decisões do operador Q861, Q867 e Q868
- Relacionados: [ADR 0018](0018-o-design-system-sucede-o-kit-design.md) (o `design-system` sucede o `kit-design`); [ADR 0005](0005-os-testes-da-maquina-dividem-um-teto-de-nucleos.md) (o teto da máquina); plano em [`docs/planos/2026-11-02-F357-design-system-com-historico.md`](../planos/2026-11-02-F357-design-system-com-historico.md); varredura em [`docs/research/2026-11-02-varredura-do-design-system.md`](../research/2026-11-02-varredura-do-design-system.md)

<a id="contexto"></a>
## Contexto
- O operador decidiu trazer o repositório do design system da empresa inteiro para o kit, com o histórico (Q861): os plugins `design-system`, `tema-wicomm` e o congelado `wicomm`, os pacotes `@wicomm/tokens`, `@wicomm/guardas` e `@wicomm/registro`, o ateliê (Next.js, na Vercel, que serve o registro shadcn em `/r/v0.1.0`), as guardas da base e os docs.
- O kit tem uma regra: Node ≥ 20, só módulos nativos, nenhuma dependência npm, testes em `node:test`. O ateliê, o registro e os tokens precisam de `npm install` (React, Next.js, Tailwind, vitest, TypeScript) e de Node ≥ 22.
- O `npm test` da raiz rodava `node --test` sem argumento, que procura teste na árvore inteira (`.ts` inclusive, no Node 24): com a pasta nova, ele pegaria 46 arquivos que pedem as dependências.
- A fila de merge monta e mergeia por squash, o que apagaria os commits trazidos.

<a id="decisao"></a>
## Decisão
1. **O repositório entra inteiro em `design-system/`, por subárvore** (`git merge -s ours` + `git read-tree --prefix`), no commit `e8b0b17`. Os 50 commits ficam no histórico do kit com o mesmo `sha`. A pasta mantém o layout de lá: `package.json` com workspaces, `package-lock.json`, `apps/`, `packages/`, `plugins/`, `scripts/`, `temas/`, `docs/`, o `CLAUDE.md` dela.
2. **A regra sem dependência vale para o kit fora de `design-system/`.** Plugins, CLI, gate, scripts e testes da raiz seguem só com módulos nativos e Node ≥ 20; o `package.json` da raiz não ganha `dependencies` nem `workspaces`. Dentro de `design-system/` valem as regras dela: Node ≥ 22, npm workspaces, vitest e TypeScript onde já estão. Os plugins de lá (`design-system`, `tema-wicomm`) continuam sem dependência: instalar o plugin não pede `npm install`.
3. **Dois gates.** O da raiz (`npm test`) roda só as pastas do kit, por globs explícitos; um teste compara a seleção com a descoberta padrão do `node --test` menos `design-system/`, para teste novo do kit não ficar de fora. O da pasta é `npm ci && npm test` dentro de `design-system/`, pelo teto da máquina (`node ../gate/com-fichas.mjs --quero 4 -- npm test`); quem muda algo nela roda esse gate e cola a saída no PR. A fila de merge segue rodando só o da raiz.
4. **O marketplace aponta as pastas locais** `./design-system/plugins/design-system` e `./design-system/plugins/tema-wicomm`. O tema segue desligado por padrão (ADR 0018, decisão 5). O `wicomm` congelado não entra no marketplace do kit. O `subir-versao` e o `atualizar-plugins` leem a pasta da entrada, não `plugins/<nome>`.
5. **O PR que traz a subárvore sai por merge commit,** não por squash. Um teste exige que `e8b0b17` seja ancestral do HEAD: a combinação por squash da fila fica vermelha em vez de apagar o histórico em silêncio.
6. **Licença:** o código de `design-system/` fica sob o MIT do kit, e a marca da empresa fica fora dele pelo `NOTICE` (Q867).

<a id="alternativas"></a>
## Alternativas consideradas
- **Espalhar a pasta pela raiz** (plugins em `plugins/`, `apps/` e `packages/` na raiz, com `workspaces` no `package.json` do kit). Rejeitada: pede reescrever o histórico (`git filter-repo`, `sha` novos) ou dezenas de caminhos do ateliê, das guardas e dos testes de lá; e põe `workspaces` no pacote que o `npx github:` instala, que hoje não tem nada para instalar.
- **Mover só os plugins para `plugins/` depois da subárvore.** Rejeitada por ora: o ateliê lê a base em `plugins/design-system/base` no build e os testes de lá citam os caminhos; mover custa um item próprio sem ganho para quem instala.
- **Fixar o código por cópia, sem histórico.** Rejeitada pelo operador (Q861).
- **Deixar o `node --test` da raiz achar tudo e instalar as dependências no gate.** Rejeitada: o gate do kit passaria a exigir `npm install` e Node 22, contra a regra que o mantém instalável sem rede de pacotes.
- **Excluir a pasta por padrão de exclusão.** Rejeitada: o `node --test` não aceita padrão negativo (medido no Node 24.3: `'!b/**'` não exclui nada).
