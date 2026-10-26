# Fase 3 — processos de documento e de design (plano, P2, 2026-10-25)

Item da fila: **F44**. Decisão: [ADR 0002](../adr/0002-processos-de-documento-e-design-sao-plugins-opcionais.md) (número a confirmar pela orquestradora). Fases anteriores: [fase 2, o pacote](2026-10-24-fase-2-o-pacote.md) (que deixou de fora a "camada c": as skills de UI e a `spec-driven` do Izanagi; é esta fase).

Pedido do operador: *"lá no Izanagi temos skill de spec, de criação de documentos, como agir, como seguir os passos, como e onde criar as docs, temos o impeccable que faz a gestão do design… criar aqui um sistema completo, que em qualquer lugar que eu instalar ele vamos ter os processos corretos de orquestração e desenvolvimento, as boas práticas etc."*

## 1. O que o Izanagi tem (inventário, lido em 2026-10-25, sem gravar nada lá)

| Peça no Izanagi | O que faz | Genérico? | Destino |
|---|---|---|---|
| `.claude/skills/spec-driven` (140 linhas) | Três rituais: abrir/mudar SPEC (status de vocabulário fechado + `Pendências:`), registrar ADR (imutável depois do merge, "Alternativas consideradas" obrigatória), fechar item no roadmap (linha ≤ 400 caracteres, ≤ 2 links) e no diário (por mês, fatia em 150 KB) | **Sim**, menos os caminhos de teste (`packages/shared/test/…`) e os exemplos do produto | plugin `processos` (K11) |
| `docs/adr/README.md`, `docs/specs/README.md`, `docs/roadmap.md`, `docs/diario/` | Modelo de ADR, ciclo de vida da spec, índice com orçamento, narrativa por mês | **Sim** (a forma); o conteúdo é do produto | `modelos/docs/` copiados pelo CLI (K10) |
| `packages/shared/test/{specs-lifecycle,adr-index,roadmap-e-indice,docs-links,diario-cabe-numa-leitura}.test.ts` | O teste que impede a regra de degenerar: status fora do vocabulário, índice × cabeçalho, linha do roadmap longa, âncora que não existe, link relativo quebrado, diário grande | **Sim** (vitest/TS lá; aqui vira Node nativo) | `gate/as-docs-concordam.mjs` (K12) |
| `docs/research/` datado, `docs/planos/` (lá `docs/superpowers/plans/`), `docs/handoff/`, `docs/releases/` | Pesquisa é snapshot que não se edita; plano por data; handoff; notas de release | **Sim** | modelos (K10); releases já é do kit (`notas-de-release`) |
| `.claude/skills/revisao-de-arquitetura-de-ui` + agent `designer` | Antes de qualquer tela: tarefa, inventário (cada dado com a decisão que gera), hierarquia, onde mora cada mensagem, peças do kit, estados, movimento, o que sai; grava em `docs/design/revisoes/`; não escreve código de tela | **Sim** o método; **não** os caminhos (`apps/web/…`, `components/ui`, 1280 px) | plugin `design` (K13), caminhos do `kit.json` |
| `.claude/skills/critica-de-ui` + agent `critico-de-ui` | Seis eixos, nota /30, no máximo 5 problemas com Peso/Onde/Correção, teto de 24/30 e 2 recríticas | **Sim** (o teto já é regra do pool, Q207) | plugin `design` (K13) |
| `scripts/guarda-de-design.mjs` (376 linhas) | Hook: lembra o fluxo no pedido de design; no `Stop`, cobra uma vez a crítica do trabalho visual atual (foto pelo conteúdo do diff desde o `merge-base`); nega Edit/Write do designer em código de tela; confere a forma da crítica | **Sim**, menos os globs de "visual" e a base `develop` | plugin `design`, globs e tronco do `kit.json` (K13) |
| `.claude/skills/auditoria-de-clique` | Segue cada gesto até o estado final (handler → rota → quem move o efeito → releitura) | **Sim** para front com ação que grava; os exemplos (`useAposta`, `decidirGesto`) são do produto | plugin `processos` (K11), exemplos trocados |
| `.claude/skills/revisar-diff` + `.claude/workflows/revisao-do-diff.js` (353 linhas) | Revisores em paralelo por dimensão + cético que derruba bloqueante | **Sim**, menos a dimensão "convenções do Izanagi" (vira "convenções do `CLAUDE.md` do projeto") | plugin `processos` (K11) |
| Impeccable (ADR 0375): declarado no `.claude/settings.json` do projeto, `PRODUCT.md` + `DESIGN.md` na pasta do front, `.impeccable/config.json` com exceções do detector, detector rodado **da pasta do front** | Diretor de design: `shape` antes, `critique`/`audit` depois | **Sim**, é recomendação; **não** vira dependência do kit | CLI liga por opção (K14), `doutor` recomenda (K14) |
| `apps/web/ANATOMIA.md` (o que vai onde) separado de `DESIGN.md` (como parece), ADR 0378 | Lugar e estilo mudam por motivos diferentes | **Sim** (a separação) | modelo `ANATOMIA.md` mínimo (K10) |
| `.claude/skills/ui-ux-pro-max-2` | Catálogo de estilo de terceiros | **Não** entra: o ADR 0375 do Izanagi o recusou por propor outra marca | — |
| Regras de domínio do `CLAUDE.md` (Wake, VTEX, runner, custo, `next dev` × `pnpm build`), `apps/web/CLAUDE.md` (CSS, contraste, fonte), `docs/composicao-do-painel.md`, `docs/03-pendencias-do-time.md`, `/novidades`, `MARCA.md` | Do produto | **Não** | ficam no Izanagi; a inbox P/D/V/X já é coberta pela fila `F<n>` + perguntas `Q<n>` do painel |
| Convenções gerais do `CLAUDE.md` raiz: "spec no presente afirma o que existe", "link para seção cita âncora explícita", "commitado não é mergeado", "pesquisa envelhece", "segredo nunca em arquivo", "texto de UI não cita spec/doc", "ação assíncrona tem estado visível", "o efeito entra na hora e a recusa desfaz" | Boas práticas que nasceram de caso do Izanagi | **Sim** (sem o caso, com uma linha de porquê) | blocos `kit:documentos` e `kit:front` do `CLAUDE.md` (K10) |

**Lacuna achada no próprio kit:** o pool (`papeis/*.md` e `skills-por-papel.json`) cita `spec-driven`, `revisao-de-arquitetura-de-ui`, `critica-de-ui`, `auditoria-de-clique`, `revisar-diff` e `apps/web/ANATOMIA.md`. Nenhuma delas vem no kit: fora do Izanagi a D1 não tem a skill central do papel. A K15 fecha isso.

## 2. O desenho (resumo do ADR 0002)

- **Dois plugins novos no marketplace**, opcionais por projeto: `processos` (spec-driven, revisar-diff com o workflow, auditoria-de-clique) e `design` (agents `designer` e `critico-de-ui`, skills `revisao-de-arquitetura-de-ui` e `critica-de-ui`, hook `guarda-de-design`). O projeto liga cada um em `enabledPlugins` do seu `.claude/settings.json`; o pool já filtra plugin por worktree.
- **Os caminhos saem do `.claude/kit.json`**, seções `documentos` e `design`; sem a seção, a skill e o hook não agem (o hook sai 0 sem decisão).
- **O CLI copia os modelos de doc só onde não existem**, registra no lock e nunca sobrescreve; ganha `--processos completo|leve|nenhum` e `--design <pasta do front>`.
- **O Impeccable é recomendado, não dependência:** ligado no settings do projeto só com `--design` e a resposta da Q260; o `kit doutor` diz quando o projeto tem design e não tem o Impeccable. As skills do kit funcionam sem ele (o detector é ajuda do crítico, não requisito).

## 3. Decisões

**Ao operador (Q-ID, no painel):**
- **Q259 — o nível de processo de um projeto novo.** Ver a pergunta no painel. Recomendação: `iniciar` nasce `completo` (spec com ciclo de vida, roadmap e diário, conferidos pelo gate); `adotar` nasce `leve` (ADR, planos, pesquisa datada) para não impor estrutura a quem já tem a sua; `--processos` troca nos dois.
- **Q260 — o Impeccable declarado no projeto.** Ver a pergunta no painel. Recomendação: com `--design`, o CLI declara o marketplace e o plugin no `.claude/settings.json` do projeto (como o ADR 0375 do Izanagi), com as envs de corte de telemetria escritas no bloco `kit:design`; sem `--design`, nada.

**Assumidas, a confirmar** (reversíveis, seguem com a recomendação):
- **A1.** Dois plugins (`processos`, `design`) em vez de engordar o `orquestracao`: é o que deixa cada um opcional por projeto e filtrável por worktree no pool.
- **A2.** Os nomes das pastas seguem o Izanagi (`docs/adr`, `docs/specs`, `docs/roadmap.md`, `docs/diario`, `docs/design/revisoes`, `docs/research`, `docs/planos`), sobreponíveis no `kit.json`.
- **A3.** O plano do kit mora em `docs/planos/` (não `docs/superpowers/plans/`), como já é neste repo; a skill `superpowers:writing-plans` é avisada pelo bloco `kit:documentos` de que o lugar é este.
- **A4.** O UI/UX Pro Max e catálogos de estilo de terceiros não entram (o Izanagi já os recusou por medida).
- **A5.** O Izanagi continua com as cópias dele até um item próprio (fora desta fase): os nomes do plugin têm prefixo (`design:critica-de-ui`), então as duas não colidem.
- **A6.** O plugin `design` fica ligado para D **e** E no pool (o `Stop` que cobra a crítica tem de rodar em quem edita a tela); a skill de design na E continua vigiada pelo `skill-do-papel` (aviso, não recusa).

## 4. Regras para toda fatia
- As do [`CLAUDE.md`](../../CLAUDE.md) deste repo: Node ≥ 20, ESM, só módulos nativos; `node:test`; `process.exitCode`; testes com `HOME` e pastas em diretório temporário; commits conventional em PT-BR sem ADR no título.
- **Nada no repositório Izanagi.** Ler é livre; gravar, não.
- Teste antes do código quando o comportamento muda (`superpowers:test-driven-development`); todo subprocesso de teste com `timeout` + `killSignal: 'SIGKILL'`.
- Skill nova ou mudada segue `superpowers:writing-skills` / `skill-creator`: descrição que dispara, sem exemplo do Izanagi no texto (o caso vira uma linha genérica de porquê).
- Mudança em plugin sobe o `version` do `plugin.json` dele (sem isso o cache não renova, ADR 0001).
- Cada fatia: uma E (Sonnet), uma V em contexto novo (Opus).

## 5. Fatias

### K10 — ADR, modelos de doc e blocos do `CLAUDE.md` · Simples
- **Arquivos:** `docs/adr/0002-…md` (já escrito por este plano; a E só o ajusta se a V pedir), `docs/adr/README.md` (índice), `modelos/docs/{adr/README.md, specs/README.md, roadmap.md, diario/README.md, design/revisoes/README.md, research/README.md, planos/README.md}`, `modelos/front/{PRODUCT.md, DESIGN.md, ANATOMIA.md}` (esqueletos com os cabeçalhos que o Impeccable lê, `<!-- impeccable:product-schema 1 -->` incluso, e o texto em PT-BR), `modelos/CLAUDE.md` (blocos novos `kit:documentos v1` e `kit:design v1`; `kit:regras-de-trabalho` sobe para v3 apontando para o bloco de documentos).
- **Passos:** 1. teste em `test/modelos.test.mjs` que lê cada modelo e afirma: existe, não é vazio, não cita `Izanagi`, `Wake`, `VTEX`, `apps/web`; o modelo de spec traz o vocabulário fechado `Rascunho · Em revisão · Aprovada · Implementada · Substituída`; o modelo de ADR traz a seção `Alternativas consideradas`. 2. escrever os modelos a partir dos do Izanagi, sem caso do produto. 3. bloco `kit:documentos`: onde mora cada doc, numeração (ADR 4 dígitos, SPEC 3, número pedido à orquestradora), status, ADR imutável depois do merge, roadmap ≤ 400/≤ 2 links, diário por mês, pesquisa datada não se edita, spec no presente só afirma o que existe, âncora explícita, commitado ≠ mergeado. 4. bloco `kit:design`: o fluxo designer → crítico → E, o teto 24/30, "texto de UI não cita doc", ação assíncrona com estado visível, efeito na hora e recusa desfaz, e as envs do Impeccable (`IMPECCABLE_NO_TELEMETRY`, `IMPECCABLE_NO_UPDATE_CHECK`, `config.local.json` em vez de `hooks off`).
- **Pronto:** `npm test` verde com o teste novo; o teste fica vermelho ao pôr a palavra `Izanagi` num modelo (cópia mutada, saída colada).
- **Fora de escopo:** o CLI copiar os modelos (K14).

### K11 — plugin `processos`: spec-driven, revisar-diff, auditoria-de-clique · Média
- **Medir antes** (não documentado; colar a saída): (a) se plugin entrega workflow (`plugins/<p>/workflows/*.js` resolvido por `Workflow({name})`); se não, a skill chama por `scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/revisao-do-diff.js"`; (b) se `${CLAUDE_PLUGIN_ROOT}` chega expandido no texto da skill.
- **Arquivos:** `plugins/processos/.claude-plugin/plugin.json` (0.1.0), `plugins/processos/skills/{spec-driven,revisar-diff,auditoria-de-clique}/SKILL.md`, `plugins/processos/workflows/revisao-do-diff.js`, `.claude-plugin/marketplace.json`.
- **Passos:** 1. teste que lê as três skills e afirma o frontmatter (`name`, `description` não vazia), a ausência de `Izanagi|Wake|VTEX|apps/web|packages/shared`, e que a `spec-driven` manda ler os caminhos do `.claude/kit.json` (`documentos.*`) com os padrões da A2. 2. portar a `spec-driven`: os três rituais, o vocabulário, o "o que merece ADR", e a frase "o teste que confere é `scripts/kit/as-docs-concordam.mjs`" no lugar do `specs-lifecycle.test.ts`. 3. portar `revisar-diff` e o workflow: base padrão = `guarda.tronco` do `kit.json`, dimensão "convenções do Izanagi" → "convenções do `CLAUDE.md` do projeto". 4. portar `auditoria-de-clique` com exemplos genéricos. 5. `claude plugin validate plugins/processos --strict`.
- **Pronto:** `npm test` verde; `claude plugin validate .` e `--strict` do plugin sem erro (saída colada); a medição (a)/(b) registrada no relatório.
- **Fora de escopo:** mexer em `orquestracao` ou no pool (K15).

### K12 — conferência das docs no gate · **Robusta**
- **Arquivos:** `gate/as-docs-concordam.mjs`, `gate/test/as-docs-concordam.test.mjs`, `gate/config.mjs` (seção `documentos` com padrões e `conferir: [...]`), `gate/a-vez-do-gate.mjs` (roda a conferência antes do `comandoCompleto` quando `documentos.conferir` não é vazio), `gate/README.md`.
- **Regras** (cada uma ligável à parte; nomes fixos): `status-da-spec` (vocabulário fechado + índice do README concorda com o cabeçalho), `indice-de-adr` (todo arquivo no índice e vice-versa; célula ≤ 200), `linha-do-roadmap` (≤ 400 caracteres, ≤ 2 links, âncora existe no destino), `links-relativos` (todo link relativo em `docs/` resolve, e o `#slug` existe como `<a id>` ou título), `tamanho-do-diario` (parte ≤ 150 KB).
- **Passos:** 1. teste antes, por regra: um caso bom que passa e um ruim que reprova **na linha certa**, e um caso vazio (pasta sem specs) que diz "nada a conferir" em vez de verde calado. 2. o script: `node scripts/kit/as-docs-concordam.mjs [--regra x]`, saída `arquivo:linha — motivo`, `process.exitCode = 1` no achado. 3. ligar ao gate. 4. README.
- **Pronto:** `node --test "gate/test/*.test.mjs"` verde; cada regra com uma cópia mutada vermelha na linha certa (saídas coladas); rodado contra uma cópia de `docs/` do Izanagi em pasta temporária (só leitura da fonte), com o número de achados colado e comparado com o que os testes de lá dizem (esperado: zero).
- **Fora de escopo:** reescrever as regras do Izanagi; o CLI copiar o script (K14 — ele já copia `gate/*`, conferir).

### K13 — plugin `design`: designer, crítico, guarda · **Robusta**
- **Medir antes** (colar a saída): se agent de plugin aceita `hooks` no frontmatter. [hipótese: não aceita — a doc de plugins diz que agent de plugin ignora `hooks`, `mcpServers` e `permissionMode`.] Se não aceita, as duas entradas `--papel` saem do frontmatter e vão para o `hooks.json` do plugin, decidindo pelo `agent_type` do payload (medir que o campo chega no `PreToolUse` de subagente e no `SubagentStop`).
- **Arquivos:** `plugins/design/.claude-plugin/plugin.json` (0.1.0), `plugins/design/agents/{designer,critico-de-ui}.md`, `plugins/design/skills/{revisao-de-arquitetura-de-ui,critica-de-ui}/SKILL.md`, `plugins/design/hooks/{hooks.json,guarda-de-design.mjs}`, `plugins/design/hooks/tests/guarda-de-design.test.mjs`, `.claude-plugin/marketplace.json`.
- **Passos:** 1. portar os testes da guarda do Izanagi para `node:test` (os casos do ADR 0378 de lá: rebase não cobra, `--amend` cobra, edição de subagente cobra, crítico em background conta, crítico antes do código não cobre o código depois, outro worktree não cobra, erro nunca prende), com `KIT_DESIGN_ESTADO` apontando para pasta temporária. 2. a guarda lê do `kit.json`: `design.visual` (globs), `design.negadoAoDesigner` (globs), `guarda.tronco` (base do `merge-base`); sem `design`, sai 0 sem decisão. 3. skills e agents: fontes lidas de `design.fontes` (padrão `<front>/PRODUCT.md`, `<front>/ANATOMIA.md`, `<front>/DESIGN.md`), largura de referência `design.largura` (padrão 1280), peças de `design.kit` (pasta dos componentes); o Impeccable citado como "quando instalado" e o detector rodado da pasta do front. 4. `claude plugin validate plugins/design --strict`.
- **Pronto:** testes da guarda verdes; um teste mutado por caso fica vermelho na linha certa; um projeto de rascunho em pasta temporária com `design` no `kit.json` e um `.tsx` editado tem o `Stop` recusado uma vez e o segundo liberado (saída do hook colada).
- **Fora de escopo:** desenhar qualquer tela; o `shadcn add` da decisão 5 do ADR 0378 do Izanagi (é do stack de lá; entra no bloco `kit:design` só como "peça nova parte do registro oficial do kit de componentes que o projeto usa").

### K14 — CLI: `--processos`, `--design`, `doutor` · **Robusta**
- **Depende de:** Q259 e Q260 respondidas (os padrões); K10–K13 mergeadas.
- **Arquivos:** `cli/pacote.mjs`, `cli/iniciar.mjs`, `cli/adotar.mjs`, `cli/doutor.mjs`, `cli/remover.mjs`, `cli/atualizar.mjs`, `modelos/kit.json` (seções `documentos` e `design` por nível), `test/processos.test.mjs`.
- **Passos:** 1. testes antes, em pasta temporária com `git init`: `iniciar --processos completo` cria os modelos de doc ausentes, liga `processos@kit-de-orquestracao` em `enabledPlugins` do projeto e põe `documentos.conferir` com as cinco regras; `leve` cria só `adr`, `planos`, `research` e nenhuma regra além de `indice-de-adr` e `links-relativos`; `nenhum` não cria doc; `--design apps/web` cria os modelos de front **só onde não existem**, liga `design@…` e (pela Q260) o Impeccable; `adotar` com `docs/adr/` já existente não toca nenhum byte dele (comparar hash). 2. lock registra cada arquivo criado; `remover` apaga só o que o hash diz intacto; `atualizar` troca bloco `kit:documentos`/`kit:design` como os outros. 3. `doutor`: acusa `design` no `kit.json` sem `PRODUCT.md`/`DESIGN.md`, Impeccable recomendado e não ligado, plugin ligado sem a seção do `kit.json` e vice-versa.
- **Pronto:** `npm test` verde; os três níveis e o `--design` cobertos, cada um com um caso mutado vermelho; a saída real de `kit iniciar --processos completo --design web` numa pasta temporária colada.
- **Fora de escopo:** perguntar interativamente (o CLI segue sem prompt; flags e padrões).

### K15 — pool: os papéis citam o que o kit entrega · Média
- **Arquivos:** `plugins/orquestracao/pool/papeis/{design,planejadora,executora,validadora,orquestradora}.md`, `plugins/orquestracao/pool/skills-por-papel.{json,md}`, `plugins/orquestracao/hooks/skill-do-papel.mjs` (se o nome com prefixo pedir apelido), testes do mapa.
- **Passos:** 1. teste que cruza toda skill citada nos `papeis/*.md` com o que existe em `plugins/*/skills/` ou na lista "de terceiros" do JSON, e reprova a citação que não existe em nenhum dos dois (é a lacuna da seção 1). 2. trocar `apps/web/ANATOMIA.md`/`DESIGN.md` por "as fontes de `design.fontes` do `kit.json`". 3. linhas novas no mapa com os nomes prefixados (`processos:spec-driven`, `design:critica-de-ui`…) e a tabela de plugins com `processos` (todos) e `design` (D, E — A6).
- **Pronto:** testes verdes; o teste novo fica vermelho ao citar uma skill inventada num `papeis/*.md`.
- **Fora de escopo:** reescrever o protocolo do pool.

### K16 — prova num projeto do zero · Média (junto com a K9 da fase 2, se ela ainda não rodou)
- **Passos:** projeto vazio em `~/Developer/Projects/<rascunho>` (o operador escolhe o nome; nada no Izanagi), `kit iniciar --processos completo --design web`, abrir uma sessão nele e pedir: uma SPEC nova, um ADR, uma tela trivial. Medir: a skill `processos:spec-driven` carrega; o gate reprova uma spec com status inventado; o `Stop` cobra a crítica da tela; com o Impeccable ligado, `/impeccable critique` roda.
- **Pronto:** relatório com as saídas reais de cada medição.
- **Fora de escopo:** migrar o Izanagi para os plugins (item próprio, PR no Izanagi, com a orquestradora de lá).

## 6. Ordem e paralelismo
K10 → (K11 ∥ K12 ∥ K13) → K15 → K14 → K16. K11, K12 e K13 não tocam os mesmos arquivos (só o `marketplace.json`, que K11 e K13 editam em linhas diferentes; quem mergeia por último rebaseia). K14 espera Q259 e Q260. Teto de E do pool: no máximo duas ao mesmo tempo.

## 7. Fora de escopo da fase
- Gravar qualquer coisa no Izanagi, inclusive trocar as cópias de lá pelas do plugin (A5).
- Catálogos de estilo de terceiros (A4) e componentes de vitrine (React Bits e afins).
- As regras de domínio e de stack do Izanagi (Wake, VTEX, runner, CSS do `apps/web`).
- A inbox P/D/V/X (a fila e as perguntas do painel já a cobrem).
- Publicar o marketplace ou o pacote fora do GitHub privado.
