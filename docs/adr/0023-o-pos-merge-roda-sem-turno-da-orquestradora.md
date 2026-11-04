# ADR 0023 — O pós-merge roda sem turno da orquestradora

- Data: 2026-11-04
- Status: Proposto
- Autor: sessão dona do F373 (fatia 3), a partir do pedido do operador repassado pela orquestradora em 04/11
- Relacionados: [ADR 0022](0022-a-orquestradora-so-acorda-quando-precisa.md) (a orquestradora só acorda quando precisa; este ADR leva a ele o pós-merge que lá ficou para depois); [ADR 0019](0019-a-fila-de-merge-roda-sem-turno-da-orquestradora.md) (a fila sem turno); plano em [`docs/planos/2026-11-04-pos-merge-sem-turno.md`](../planos/2026-11-04-pos-merge-sem-turno.md)

<a id="contexto"></a>
## Contexto
- Depois do ADR 0022, o desfecho com merge da fila sem turno ainda acordava a orquestradora a cada lote. Ela fazia quatro coisas mecânicas: subir a versão dos plugins (`subir-versao --empurrar`), atualizar os plugins instalados (`atualizar-plugins`), arquivar a dona do item fechado e girar o próprio arquivo de estado. Cada turno relê ~260 mil tokens.
- A rodada sem turno já roda num processo destacado, no repositório, com o git e a trava da fila. Ela pode fazer o mecânico, desde que não mexa no checkout principal: ele pode estar em outra branch, e a base não cabe em dois worktrees.
- O app tem o interruptor `auto_archive_on_close` do monitor do PR: "archive this session once the PR merges or closes". Ligado pela dona no PR que fecha o item, ele arquiva a sessão sem turno de ninguém.

<a id="decisao"></a>
## Decisão
- **A rodada sem turno faz o pós-merge** (`scripts/pos-merge.mjs`) quando mergeou algo:
  - com `.claude-plugin/marketplace.json` em `origin/<base>`, `subir-versao --empurrar --destacado` num worktree temporário destacado em `origin/<base>`. O `--destacado` aceita o HEAD destacado em dia com a base;
  - no marketplace do kit e só quando a versão subiu, `atualizar-plugins`;
  - o giro do arquivo de estado da orquestradora (`<nome-do-repo>.md`), se ele existe.

  O resultado vai ao desfecho (`posMerge`, com `erros` por etapa). `KIT_POS_MERGE=off` devolve o pós-merge à orquestradora.
- **O desfecho acorda a orquestradora só com o que é dela:**
  - erro da fila;
  - pós-merge que falhou, e ela faz à mão só a etapa que falhou;
  - suspeita de teste instável;
  - merge sem pós-merge (fila antiga ou desligada).

  Merge em ordem e devolução, que a dona já recebeu, vão a `~/.claude/orquestracao/batida/<projeto>.desfechos.log`.
- **A dona do PR que fecha o item liga o arquivamento no merge** (`set_monitor` com `auto_archive_on_close: true`), salvo com o modo ausente ligado, em que nada se arquiva. A orquestradora segue arquivando no ritual a dona que o app não arquivou.

<a id="alternativas"></a>
## Alternativas consideradas
- **O mod painel-sessoes chamar `archive_session` depois do merge:** o app pede aprovação a cada chamada fora do bypass, e o cartão apareceria na sessão que rodou a batida, que pode ser de outro projeto. A descrição da ferramenta também pede o acordo explícito do operador para cada sessão. O interruptor do PR é uma decisão por PR, tomada pela própria dona.
- **A batida fazer o pós-merge:** ela roda a cada 10 min dentro do mod, com prazo curto. O `atualizar-plugins` leva até minutos. A rodada da fila já é um processo destacado, com o lote na mão e a trava dela.
- **Subir a versão no checkout principal:** ele pode estar em outra branch ou com mudança em curso da orquestradora. O `subir-versao` recusa nesses casos, e mexer na branch dela sem turno seria pior.
- **Deixar o desfecho com merge acordar a orquestradora só para registrar a entrega:** é o turno que este ADR tira. O registro em arquivo basta, e ela o lê ao assumir.

<a id="consequencias"></a>
## Consequências
- O lote sem turno se fecha sozinho: versão empurrada, plugins atualizados e estado girado, sem turno da orquestradora. Ela acorda só pelos gatilhos do ADR 0022 mais o pós-merge que falhou e a suspeita de instável.
- A dona ganha uma chamada (`set_monitor`) no PR que fecha o item. O PR fechado sem merge também arquiva a sessão (é o que o app faz); o item volta à fila e ganha dona nova.
- A rodada sem turno empurra na base (o commit da versão). Era o que a orquestradora já fazia sozinha depois de cada lote; o empurrão recusado (base andou) vira erro do pós-merge e a acorda.
- Medir depois: `node scripts/custo-fixo.mjs --desde <data do merge>`, nas linhas `notificação` e `batida` da orquestradora.
