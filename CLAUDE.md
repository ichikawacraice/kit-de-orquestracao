# kit-de-orquestracao (Ichikawa's Kit)

As seções marcadas `kit:` são do kit de orquestração: o `kit atualizar` troca o conteúdo entre as marcas quando você não o editou à mão. Escreva o resto do arquivo fora delas.

<!-- kit:projeto v1 -->
## O projeto
Kit de orquestração de sessões do Claude Code (uma sessão dona por item, travas por hook, painel, fila de merge, teto de testes), instalável em qualquer projeto. Marketplace `ichikawa-kit` (nome de exibição "Ichikawa's Kit"; até o F344, `kit-de-orquestracao`: o código lê os dois nomes e grava só o novo) no repositório `kit-de-orquestracao`. Dois plugins em `plugins/` (`orquestracao`, `painel-sessoes`) e um CLI em `cli/` (`npx -y github:ichikawacraice/kit-de-orquestracao`). Decisão: `docs/adr/0001-*`; planos em `docs/planos/`.

Regras do código (valem para toda fatia):
- Node ≥ 20, ESM, só módulos nativos: o kit não traz dependência npm. Testes em `node:test` (`node --test`), nunca vitest. A exceção é a pasta `design-system/` (ADR 0020): lá valem o `package.json`, o `CLAUDE.md` e o gate dela (`cd design-system && npm ci && node ../gate/com-fichas.mjs --quero 4 -- npm test`), e quem a muda cola a saída no PR.
- Script termina por `process.exitCode`, nunca `process.exit()`.
- Testes nunca tocam `~/.claude` real: `HOME` e as envs de pasta apontam para diretório temporário.
- Commits conventional em PT-BR, sem citar ADR no título. `main` com push direto enquanto não houver outro colaborador.
- Nada neste repo grava em `~/.claude/` antes da fatia K7/K8; nada em repositório de outro projeto.
- O PR não mexe na versão dos plugins; a versão sobe num commit só depois de cada lote de merges (`subir-versao`): na fila sem turno, a própria rodada; na rodada que a orquestradora chama, ela.
<!-- /kit:projeto -->

Teste isolado neste repo: `node gate/com-fichas.mjs -- <comando>` (teto de núcleos da máquina, somando todas as sessões); `vitest` e `node --test` soltos a guarda recusa.

<!-- kit:comandos v1 -->
## Comandos
Lidos de `.claude/kit.json`:
- **Gate:** `npm test` (= `node gate/com-fichas.mjs -- node --test` nas pastas do kit, sem `design-system/`, pelo teto de núcleos da máquina).
- Sem typecheck neste repo.
- Validar manifestos: `claude plugin validate .` (e `claude plugin validate plugins/<nome> --strict`)
- Testes do mod: `claude plugin test plugins/painel-sessoes` (o `node --test` da raiz não os pega: são `.tsx`).
- **Testes afetados** (durante o trabalho, ADR 0011): `testes-afetados --padrao '^(?!design-system/)(?:.*/)?(?:[^/]*\.test\.(?:mjs|cjs|js)|test/.*\.(?:mjs|cjs|js))$' -- node gate/com-fichas.mjs -- node --test` (sem `--`, só lista). O `--padrao` deixa `design-system/` de fora, também quando a seleção cai em "todos" (ADR 0020).
<!-- /kit:comandos -->

<!-- kit:regras-de-operacao v1 -->
## Regras de operação
- **Uma sessão dona por item, do plano ao PR** (ADR 0011): ela planeja, escreve, testa e abre o PR; manual em `plugins/orquestracao/pool/dona.md`.
- **Revisão por subagente** `orquestracao:validador` de contexto limpo antes do PR: só achados que afetam correção; o leve vai ao PR ou ao `depois` do item, nunca vira item. Item pequeno dentro do corte do `via-rapida.mjs` se autorrevisa pelo roteiro, com o laudo no PR (`protocolo.md#via-rapida-da-revisao`).
- **Durante o trabalho, só os testes afetados**; o gate completo (`npm test`) roda uma vez, na fila de merge da orquestradora (`painel fila-de-merge <N>:<sha>…`), sobre a combinação dos PRs. Um gate por vez; gate verde sobre a mesma árvore não se repete.
- **Ninguém rebaseia por merge alheio:** a fila devolve à dona só o conflito real ou o gate vermelho. Rebase em vez de merge commit quando rebasear; a exceção é o `sync_with_base_branch` do app na devolução por conflito (o merge commit fica só na branch: a fila mergeia por squash).
- **No máximo 4 donas trabalhando ao mesmo tempo** (3 com a máquina cheia); a orquestradora abre a dona quando o item nasce ou outra termina.
- Migration de banco só sai da branch de integração, quando a regra `migration-fora-do-tronco` da guarda estiver ligada.
- **CI só no PR para a produção** (`protocolo.md#ci-so-na-producao`): o CI dispara só no `pull_request` contra a `main`; o PR para a integração roda só os testes afetados, com a saída colada no PR. Este repo não tem CI nem branch de integração: o gate é o local. O único workflow é o `publicar-pacotes`, que publica os pacotes de `design-system/packages/` no npm depois do merge ([guia](docs/guia/pacotes-npm.md)).
- Commit em português, no formato convencional (`feat(escopo): …`).
- A paridade plugin × `~/.claude` deixou de ser exigida: a K8 rodou em 2026-10-25T14:01 (backup `~/.claude/orquestracao/backups/K8-2026-10-25T14-01-55-715Z`), o `~/.claude/settings.json` não registra mais nenhum hook e o plugin é a cópia viva — conserto entra só nele. `scripts/paridade.mjs` e `scripts/k8/sincronizar.mjs` ficam para a migração de outra máquina.
<!-- /kit:regras-de-operacao -->

<!-- kit:regras-de-trabalho v1 -->
## Regras de trabalho
- **O pedido é ponto de partida, não ordem** (`plugins/orquestracao/pool/protocolo.md#analise-do-pedido`): confira a premissa, aponte o errado, faça contraproposta e recomende o melhor formato, na medida do risco; discorde uma vez e siga com o reversível.
- Decisão que muda desenho vira ADR em `docs/adr/` (número pedido à orquestradora quando há uma).
- Spec e roadmap são opcionais: use-os se o projeto já os tem.
- Teste antes do código quando o comportamento muda.
<!-- /kit:regras-de-trabalho -->

<!-- kit:documentos v2 -->
## Documentos: onde moram e como se escrevem
As pastas são as de `.claude/kit.json` (seção `documentos`); sem a seção valem estes padrões.
- **ADR** em `docs/adr/NNNN-título.md`, 4 dígitos, com a seção `Alternativas consideradas`. Imutável depois do merge: reverter é escrever outro que o substitui. Índice em `docs/adr/README.md`, célula de decisão com até 200 caracteres.
- **Spec** em `docs/specs/SPEC-NNN-título.md`, 3 dígitos. Status é UMA palavra de Rascunho · Em revisão · Aprovada · Implementada · Substituída; a nuance vai em `Pendências:`. A spec no presente só afirma o que existe.
- **Número de documento** (ADR, SPEC) é pedido à orquestradora antes de escrever o arquivo, quando há uma; sem ela, o próximo da sequência.
- **Roadmap** em `docs/roadmap.md`: uma linha por item, até 400 caracteres e no máximo 2 links. A narrativa vai para o **diário**, uma entrada por arquivo em `docs/diario/AAAA-MM/DD-<ancora>.md` com `<a id="<ancora>">`; dois PRs nunca escrevem no mesmo arquivo. Os `AAAA-MM.md` antigos ficam como estão.
- **Pesquisa** em `docs/research/AAAA-MM-DD-assunto.md` é snapshot datada e não se edita; pesquisa envelhece, confira a data antes de confiar.
- **Plano** em `docs/planos/AAAA-MM-DD-assunto.md`, inclusive quando a ferramenta que o escreve sugere outra pasta.
- **Link para seção cita âncora explícita** (`<a id="…"></a>`): título renomeado quebra link que aponta para o slug dele.
- **Commitado não é mergeado.** Documento só vale como regra do projeto depois do merge; antes disso é proposta.
- **Segredo nunca entra em arquivo,** nem como exemplo.
<!-- /kit:documentos -->

<!-- kit:design v1 -->
## Design de interface
Vale para o projeto que tem front. As pastas e os globs de tela vêm de `.claude/kit.json` (seção `design`).
- **O fluxo:** o designer escreve a revisão em `docs/design/revisoes/` antes de qualquer tela; a dona do item cumpre a revisão sem redesenhar; o crítico de UI julga depois. Nota abaixo de 24/30 volta para correção, com no máximo 2 recríticas. Item simples (reaproveita componente que já existe e não muda decisão registrada) pode ir pela via rápida: sem revisão, com uma crítica só depois do código.
- **`ANATOMIA.md` e `DESIGN.md` não se repetem:** o primeiro diz o que vai onde, o segundo como parece.
- **Texto de UI não cita spec, ADR nem doc:** quem usa a tela não conhece o repositório.
- **Ação assíncrona tem estado visível** (carregando, feito, falhou) no lugar onde a pessoa agiu.
- **O efeito entra na hora e a recusa desfaz:** a tela mostra o resultado esperado de imediato e volta atrás, dizendo o motivo, se o servidor recusar.
- **Impeccable, quando o projeto o declara:** corte a telemetria e a checagem de atualização com `IMPECCABLE_NO_TELEMETRY=1` e `IMPECCABLE_NO_UPDATE_CHECK=1`. Para silenciar o detector use `config.local.json` da pasta do front, nunca `hooks off`, que apaga o aviso para todo mundo.
<!-- /kit:design -->

<!-- kit:convencoes-de-teste v1 -->
## Convenções de teste
- Teste que inspeciona um valor afirma antes que ele existe e não é vazio (insumo vazio faz o teste passar sem medir nada).
- Teste que mede ausência prova antes que a presença seria detectada.
- Processo filho de teste é síncrono, com `timeout` e `killSignal: 'SIGKILL'`.
- Duas coisas que devem concordar (mapa × arquivo, doc × código) ganham um teste que as compara.
- Laudo só afirma o que mediu, com a saída real colada.
- O defeito não pode falhar como o que ele é: o teste vermelho falha pelo motivo certo.
<!-- /kit:convencoes-de-teste -->

<!-- kit:orquestradora v1 -->
## Orquestradora
- Com uma sessão `🎛 orquestradora — <projeto>` ativa, só ela mergeia, faz release e reserva números de documento; as demais sessões abrem PR e mandam o número a ela.
- Sem orquestradora ativa, mergeie normalmente.
- O estado das sessões (painel, fila, contadores) mora em `~/.claude/orquestracao/`, não neste repositório.
<!-- /kit:orquestradora -->
