# ADR 0002 — Os processos de documento e de design são plugins próprios, ligados por padrão

- Data: 2026-10-25
- Status: Aceito, substituído em parte pelo [ADR 0003](0003-opcao-do-plugin-vale-por-conta-e-o-kit-json-e-o-caminho-do-time.md) (Q259 e Q260 respondidas pelo operador em 2026-10-25)
- Autor: P2 (planejadora do pool)
- Relacionados: [plano da fase 3](../planos/2026-10-25-fase-3-processos-de-documento-e-design.md) · [ADR 0001](0001-plugin-para-o-nucleo-cli-para-o-projeto.md)

## Contexto
- O operador quer que todo projeto que instala o kit já tenha os processos de desenvolvimento que hoje só existem no Izanagi: spec com ciclo de vida, ADR, roadmap e diário, revisão de arquitetura de tela antes do código, crítica em contexto separado, e o Impeccable como ferramenta de design.
- O pool do kit já cita essas peças (`spec-driven`, `revisao-de-arquitetura-de-ui`, `critica-de-ui`, `auditoria-de-clique`, `revisar-diff`, `apps/web/ANATOMIA.md` em `pool/papeis/*.md`), mas nenhuma vem no kit. Fora do Izanagi, a D1 não tem a skill central do papel.
- No Izanagi as regras só se mantiveram porque ganharam teste (status de spec, índice de ADR, linha do roadmap) e trava (guarda de design); a regra só escrita degenerou antes de ter teste.
- Nem todo projeto tem front, e nem todo projeto quer spec obrigatória. O Claude Code liga e desliga plugin por projeto (`enabledPlugins` no `.claude/settings.json`) e por worktree, mas não filtra skill de plugin uma a uma.
- O operador decidiu (Q259) que o kit nasce com tudo ativo, em projeto novo e no que já existe, e que quem não quer uma parte a desliga no próprio plugin; e (Q260) que tudo o que der para configurar na aba de plugins do app fica configurável por lá também.

## Decisão
1. **Dois plugins novos no marketplace do kit, ligados por padrão:** `processos` (skills `spec-driven`, `revisar-diff` com o workflow de revisão, `auditoria-de-clique`) e `design` (agents `designer` e `critico-de-ui`, skills `revisao-de-arquitetura-de-ui` e `critica-de-ui`, hook `guarda-de-design`). O `orquestracao` não cresce.
2. **Os caminhos e as opções saem do `.claude/kit.json`** do projeto, seções `documentos` (pastas, regras de conferência) e `design` (pasta do front, globs do que é visual, fontes, largura de referência). Sem a seção, a skill não supõe caminho e o hook sai sem decisão.
3. **As regras de doc ganham conferência no gate** (`as-docs-concordam.mjs`), regra por regra, ligadas pelo `kit.json`.
4. **O CLI liga tudo, em `iniciar` e em `adotar` (Q259):** os dois plugins em `enabledPlugins` do projeto, as cinco regras de conferência e os modelos de doc copiados só onde não existem (nunca sobrescreve o que o projeto já tem), tudo registrado no lock (ADR 0001, decisão 3). `--design <pasta>` diz onde mora o front; sem ela, a guarda de design fica inerte e o `kit doutor` avisa. Não há nível `leve`/`nenhum` no CLI: desligar é escolha feita depois, no plugin.
5. **Desligar e ajustar mora no plugin (Q259, Q260):** cada parte que dá para desligar (cada regra de conferência, a guarda de design, a cobrança da crítica) e cada opção simples (pasta do front, largura de referência) vira opção do plugin, editável na aba de plugins do app. A opção do plugin é o padrão; o `kit.json` do projeto vence quando diz algo diferente (o projeto manda, decisão do operador em 2026-10-25, antes de qualquer fatia implementada). Exceção: plugin desligado inteiro não roda, e o `kit.json` não o religa. Por isso o CLI só escreve no `kit.json` o que o projeto precisa fixar.
6. **O Impeccable é recomendação, não dependência:** as skills do kit funcionam sem ele; com `--design`, o CLI declara o marketplace e o plugin dele no `.claude/settings.json` do projeto, com as envs de corte de telemetria no bloco `kit:design` (Q260); sem `--design`, nada. O `kit doutor` avisa quando o projeto tem design sem ele. Catálogos de estilo de terceiros não entram.

## Alternativas consideradas
- **Tudo dentro do plugin `orquestracao`.** Rejeitada: o projeto sem front receberia o hook de design e as skills de tela; skill de plugin não se filtra uma a uma.
- **Copiar skills e agents para o `.claude/` do projeto pelo CLI** (como o Izanagi tem hoje). Rejeitada: cada projeto ficaria com uma cópia que não atualiza; o ADR 0001 já escolheu plugin para o que é núcleo e CLI só para o que é do projeto.
- **Um plugin só, `processos`, com design dentro.** Rejeitada: o pool liga plugin por papel (design só para D e E), e o projeto sem front não quer o `Stop` de design.
- **Impeccable como dependência obrigatória.** Rejeitada: ele tem hooks ligados por padrão, consulta de versão e telemetria; projeto sem front não precisa dele.
- **Nível escolhido no CLI (`--processos completo|leve|nenhum`, `adotar` nascendo `leve`).** Era a recomendação da Q259; rejeitada pelo operador: a escolha fica no plugin, depois de instalado, e o projeto nasce com tudo.

## Consequências
- Projeto novo e projeto adotado nascem com os processos sem copiar skill nenhuma; atualizar é subir a versão do plugin.
- Projeto que já tem docs fora do formato recebe as regras de conferência ligadas: o primeiro gate pode reprovar até alguém desligar a regra (na aba do plugin, para si, ou no `kit.json`, para o time) ou ajustar as docs. O `adotar` diz isso na saída.
- Toda opção nova de plugin precisa existir nos dois lugares que a leem (opção do plugin e `kit.json`), com teste que compara os dois.
- O pool passa a citar só o que o kit entrega, com um teste que reprova citação inexistente.
- Os nomes ganham prefixo (`processos:spec-driven`, `design:critica-de-ui`); as travas que casam por nome aceitam os dois (como no ADR 0001).
- O Izanagi segue com as cópias dele até um item próprio; os prefixos evitam colisão.
- Mais dois plugins para versionar: esquecer de subir a versão não entrega nada.
