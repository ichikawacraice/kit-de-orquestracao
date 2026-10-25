# <nome do projeto>

As seções marcadas `kit:` são do kit de orquestração: o `kit atualizar` troca o conteúdo entre as marcas quando você não o editou à mão. Escreva o resto do arquivo fora delas.

<!-- kit:projeto v1 -->
## O projeto
<!-- preencher: o que é, para quem, stack, pastas principais -->
<!-- /kit:projeto -->

<!-- kit:comandos v1 -->
## Comandos
Lidos de `.claude/kit.json`:
- **Gate completo** (`gate.comandoCompleto`): roda antes de empurrar; só um gate por vez na máquina.
- **Teste parcial** (`gate.comandoPorPacote`): só o pacote que o diff toca.
- **Typecheck** (`gate.typecheck`), se o projeto tiver.
<!-- /kit:comandos -->

<!-- kit:regras-de-operacao v1 -->
## Regras de operação
- Um gate por vez; gate verde sobre a mesma árvore não se repete (o verde é guardado pela árvore exata).
- Rebase em vez de merge commit; PR sempre com o rebase em dia sobre a branch de integração do projeto.
- Migration de banco só sai da branch de integração, quando a regra `migration-fora-do-tronco` da guarda estiver ligada.
- Commit em português, no formato convencional (`feat(escopo): …`).
<!-- /kit:regras-de-operacao -->

<!-- kit:regras-de-trabalho v1 -->
## Regras de trabalho
- Decisão que muda desenho vira ADR em `docs/adr/` (número pedido à orquestradora quando há uma).
- Spec e roadmap são opcionais: use-os se o projeto já os tem.
- Teste antes do código quando o comportamento muda.
<!-- /kit:regras-de-trabalho -->

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
- O estado do pool (painel, fila, contadores) mora em `~/.claude/orquestracao/`, não neste repositório.
<!-- /kit:orquestradora -->
