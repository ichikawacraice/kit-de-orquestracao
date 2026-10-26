# ADR 0002 — Os processos de documento e de design são plugins opcionais por projeto

- Data: 2026-10-25
- Status: Proposto (número reservado pela orquestradora; Q259 e Q260 abertas)
- Autor: P2 (planejadora do pool)
- Relacionados: [plano da fase 3](../planos/2026-10-25-fase-3-processos-de-documento-e-design.md) · [ADR 0001](0001-plugin-para-o-nucleo-cli-para-o-projeto.md)

## Contexto
- O operador quer que todo projeto que instala o kit já tenha os processos de desenvolvimento que hoje só existem no Izanagi: spec com ciclo de vida, ADR, roadmap e diário, revisão de arquitetura de tela antes do código, crítica em contexto separado, e o Impeccable como ferramenta de design.
- O pool do kit já cita essas peças (`spec-driven`, `revisao-de-arquitetura-de-ui`, `critica-de-ui`, `auditoria-de-clique`, `revisar-diff`, `apps/web/ANATOMIA.md` em `pool/papeis/*.md`), mas nenhuma vem no kit. Fora do Izanagi, a D1 não tem a skill central do papel.
- No Izanagi as regras só se mantiveram porque ganharam teste (status de spec, índice de ADR, linha do roadmap) e trava (guarda de design); a regra só escrita degenerou antes de ter teste.
- Nem todo projeto tem front, e nem todo projeto quer spec obrigatória. O Claude Code liga e desliga plugin por projeto (`enabledPlugins` no `.claude/settings.json`) e por worktree, mas não filtra skill de plugin uma a uma.

## Decisão
1. **Dois plugins novos no marketplace do kit:** `processos` (skills `spec-driven`, `revisar-diff` com o workflow de revisão, `auditoria-de-clique`) e `design` (agents `designer` e `critico-de-ui`, skills `revisao-de-arquitetura-de-ui` e `critica-de-ui`, hook `guarda-de-design`). O `orquestracao` não cresce.
2. **Os caminhos e as opções saem do `.claude/kit.json`** do projeto, seções `documentos` (pastas, regras de conferência) e `design` (pasta do front, globs do que é visual, fontes, largura de referência). Sem a seção, a skill não supõe caminho e o hook sai sem decisão.
3. **As regras de doc ganham conferência no gate** (`as-docs-concordam.mjs`), regra por regra, ligadas pelo `kit.json`.
4. **O CLI escolhe o nível por projeto** (`--processos completo|leve|nenhum`, `--design <pasta>`), copia os modelos de doc só onde não existem, liga os plugins no settings do projeto e registra tudo no lock (ADR 0001, decisão 3).
5. **O Impeccable é recomendação, não dependência:** as skills do kit funcionam sem ele; o CLI o declara no projeto só com `--design` (Q260), e o `kit doutor` avisa quando o projeto tem design sem ele. Catálogos de estilo de terceiros não entram.

## Alternativas consideradas
- **Tudo dentro do plugin `orquestracao`.** Rejeitada: o projeto sem front receberia o hook de design e as skills de tela; skill de plugin não se filtra uma a uma.
- **Copiar skills e agents para o `.claude/` do projeto pelo CLI** (como o Izanagi tem hoje). Rejeitada: cada projeto ficaria com uma cópia que não atualiza; o ADR 0001 já escolheu plugin para o que é núcleo e CLI só para o que é do projeto.
- **Um plugin só, `processos`, com design dentro.** Rejeitada: o pool liga plugin por papel (design só para D e E), e o projeto sem front não quer o `Stop` de design.
- **Impeccable como dependência obrigatória.** Rejeitada: ele tem hooks ligados por padrão, consulta de versão e telemetria; projeto sem front não precisa dele.

## Consequências
- Projeto novo nasce com os processos sem copiar skill nenhuma; atualizar é subir a versão do plugin.
- O pool passa a citar só o que o kit entrega, com um teste que reprova citação inexistente.
- Os nomes ganham prefixo (`processos:spec-driven`, `design:critica-de-ui`); as travas que casam por nome aceitam os dois (como no ADR 0001).
- O Izanagi segue com as cópias dele até um item próprio; os prefixos evitam colisão.
- Mais dois plugins para versionar: esquecer de subir a versão não entrega nada.
