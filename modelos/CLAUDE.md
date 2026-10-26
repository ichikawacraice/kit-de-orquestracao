# <nome do projeto>

As seções marcadas `kit:` são do kit de orquestração: o `kit atualizar` troca o conteúdo entre as marcas quando você não o editou à mão. Escreva o resto do arquivo fora delas.

<!-- kit:projeto v1 -->
## O projeto
<!-- preencher: o que é, para quem, stack, pastas principais, idioma e formato dos commits (ex.: convencional) -->
<!-- /kit:projeto -->

<!-- kit:comandos v2 -->
## Comandos
Lidos de `.claude/kit.json`:
- **Gate completo** (`gate.comandoCompleto`): roda antes de empurrar; só um gate por vez na máquina.
- **Teste parcial** (`gate.comandoPorPacote`): só o pacote que o diff toca.
- **Typecheck** (`gate.typecheck`), se o projeto tiver.
- **Teste isolado:** `node scripts/kit/com-fichas.mjs -- <comando>` (teto de núcleos da máquina, somando todas as sessões).
<!-- /kit:comandos -->

<!-- kit:regras-de-operacao v1 -->
## Regras de operação
- Um gate por vez; gate verde sobre a mesma árvore não se repete (o verde é guardado pela árvore exata).
- Rebase em vez de merge commit; PR sempre com o rebase em dia sobre a branch de integração do projeto.
- Migration de banco só sai da branch de integração, quando a regra `migration-fora-do-tronco` da guarda estiver ligada.
<!-- /kit:regras-de-operacao -->

<!-- kit:regras-de-trabalho v3 -->
## Regras de trabalho
- Decisão que muda desenho vira ADR em `docs/adr/` (número pedido à orquestradora quando há uma). Onde mora cada documento e as regras de cada um: bloco `kit:documentos`, abaixo.
- Se o projeto exige spec ou roadmap antes do código, ele declara isso nas regras dele (acima ou abaixo deste bloco); o kit não exige nem dispensa.
- Teste antes do código quando o comportamento muda.
<!-- /kit:regras-de-trabalho -->

<!-- kit:documentos v1 -->
## Documentos: onde moram e como se escrevem
As pastas são as de `.claude/kit.json` (seção `documentos`); sem a seção valem estes padrões.
- **ADR** em `docs/adr/NNNN-título.md`, 4 dígitos, com a seção `Alternativas consideradas`. Imutável depois do merge: reverter é escrever outro que o substitui. Índice em `docs/adr/README.md`, célula de decisão com até 200 caracteres.
- **Spec** em `docs/specs/SPEC-NNN-título.md`, 3 dígitos. Status é UMA palavra de Rascunho · Em revisão · Aprovada · Implementada · Substituída; a nuance vai em `Pendências:`. A spec no presente só afirma o que existe.
- **Número de documento** (ADR, SPEC) é pedido à orquestradora antes de escrever o arquivo, quando há uma; sem ela, o próximo da sequência.
- **Roadmap** em `docs/roadmap.md`: uma linha por item, até 400 caracteres e no máximo 2 links. A narrativa vai para o **diário** em `docs/diario/AAAA-MM.md`, um arquivo por mês, partido em `-parte-N` quando passa de 150 KB.
- **Pesquisa** em `docs/research/AAAA-MM-DD-assunto.md` é snapshot datada e não se edita; pesquisa envelhece, confira a data antes de confiar.
- **Plano** em `docs/planos/AAAA-MM-DD-assunto.md`, inclusive quando a ferramenta que o escreve sugere outra pasta.
- **Link para seção cita âncora explícita** (`<a id="…"></a>`): título renomeado quebra link que aponta para o slug dele.
- **Commitado não é mergeado.** Documento só vale como regra do projeto depois do merge; antes disso é proposta.
- **Segredo nunca entra em arquivo,** nem como exemplo.
<!-- /kit:documentos -->

<!-- kit:design v1 -->
## Design de interface
Vale para o projeto que tem front. As pastas e os globs de tela vêm de `.claude/kit.json` (seção `design`).
- **O fluxo:** o designer escreve a revisão em `docs/design/revisoes/` antes de qualquer tela; a executora cumpre a revisão sem redesenhar; o crítico de UI julga depois. Nota abaixo de 24/30 volta para correção, com no máximo 2 recríticas. Item simples (reaproveita componente que já existe e não muda decisão registrada) pode ir pela via rápida: sem revisão, com uma crítica só depois do código.
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
- Teste que dispara subprocesso não sai por `process.exit()` (termina por `process.exitCode`) e todo subprocesso tem prazo: `timeout` e `killSignal: 'SIGKILL'`.
- Duas coisas que devem concordar (mapa × arquivo, doc × código) ganham um teste que as compara.
- Laudo só afirma o que mediu, com a saída real colada.
- O defeito não pode falhar como o que ele é: o teste vermelho falha pelo motivo certo.
<!-- /kit:convencoes-de-teste -->

<!-- kit:orquestradora v1 -->
## Orquestradora
- Com uma sessão `🎛 orquestradora — <projeto>` ativa, só ela mergeia, faz release e reserva números de documento; as demais sessões abrem PR e mandam o número a ela.
- Sem orquestradora ativa, mergeie normalmente.
- O estado do pool (painel, fila, contadores) mora em `~/.claude/orquestracao/`, não neste repositório.
<!-- /kit:orquestradora -->
