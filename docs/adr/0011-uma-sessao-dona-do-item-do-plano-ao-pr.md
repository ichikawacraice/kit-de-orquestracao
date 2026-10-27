# ADR 0011 — Uma sessão dona do item do plano ao PR, revisão por subagente e fila de merge na orquestradora

- Data: 2026-10-27
- Status: Aceito (Q469 respondida pelo operador em 2026-10-27: "faça tudo e só teste depois, para subirmos LOGO isso")
- Autor: sessão dona do F177, a pedido da orquestradora do kit
- Relacionados: substitui o pool de papéis (protocolo do pool de 24/10), o ADR [0004](0004-via-rapida-escopo-trancado-e-piso-de-uma-executora.md) (piso de uma E livre; a via rápida perde o objeto), a parte de despacho do [0007](0007-cada-sessao-cuida-do-proprio-item-e-a-batida-roda-no-mod.md) (a batida fica como rede de segurança) e o [0009](0009-afinidade-no-despacho.md) (afinidade entre membros); mantém o [0005](0005-os-testes-da-maquina-dividem-um-teto-de-nucleos.md) e o [0008](0008-vaga-do-gate-e-vaga-dos-testes-no-teto-da-maquina.md) (teto de núcleos)

<a id="contexto"></a>
## Contexto
- O operador achou o sistema lento demais. A orquestradora mediu os 20 itens desde 26/10 18h: validação 38% do tempo, execução 29%, design 12%, merge 11%, planejamento 10%. O trabalho real foi de 20–40 min por item, mas o item ficou de 5 a 10 h aberto, parado em esperas: máquina cheia, validadora livre, rebase em cascata depois de cada merge, mensagens cruzadas entre P, E e V, duas executoras no mesmo item. Dos 20 itens, 15 eram consertos do próprio kit, a maior parte em regras de passagem entre papéis.
- A máquina de 15 núcleos saturou com carga acima de 40 quando o pool passou de 10 sessões vivas.
- A pesquisa de 27/10 (Anthropic: *Building effective agents*, *How we built our multi-agent research system*, docs de subagentes e *best practices*; Cognition: *Don't build multi-agents* e *Multi-agents: what's actually working*; claude-squad, Conductor, ccmanager; GitHub merge queue) aponta o mesmo desenho: uma sessão leva o item inteiro com o contexto inteiro; subagentes só leem e devolvem achado; revisor de contexto limpo; testes do que mudou durante o trabalho; gate completo só na fila de merge, sobre a combinação.
- Já entraram no mesmo dia: a versão dos plugins sobe só no lote (`subir-versao`, Q459/F173), ressalva leve não vira item (Q457), pool encolhido (Q458).

<a id="decisao"></a>
## Decisão
1. **Uma sessão dona por item, do plano ao PR.** A orquestradora abre uma sessão por item (`start_session`), que planeja, decide, escreve código e doc, testa, abre o PR e conserta o que a revisão ou a fila devolverem. Modelo pelo risco: Opus para item com decisão, contrato ou risco; Sonnet para item mecânico com plano pronto. Item com tela ganha o designer (`design:revisao-de-arquitetura-de-ui` e `design:critico-de-ui`) **como subagente da dona**, não como sessão. Acabam o handoff entre papéis, as mensagens P→E→V, o `painel pegar` e a afinidade. O item é marcado `via: "dona"`; a dona é o `donoLocalId` do começo ao fim e fica no `com`.
2. **Revisão por subagente de contexto limpo.** Antes do PR, a dona lança `orquestracao:validador` (só leitura) com o plano e o diff. Ele devolve só achados que afetam correção (o resultado errado, a regra do projeto quebrada, o teste que não mede); estilo fica de fora ("skip style"). Achado leve vira nota no PR ou no `depois` do item, nunca item novo (Q457). Item com contrato, estado gravado, segurança ou produção ganha uma segunda revisão do mesmo tipo depois do conserto, sobre o delta.
3. **Testes afetados durante o trabalho, gate completo uma vez.** Enquanto trabalha, a dona roda só os testes do que tocou (`testes-afetados -- <comando de teste>`). O gate completo (`npm test` ou o do `CLAUDE.md` do projeto) roda **uma vez, na fila de merge**, sobre a combinação dos PRs.
4. **A orquestradora vira fila de merge local.** `painel fila-de-merge <PR…>` pega os PRs na ordem dada, monta a combinação sobre a branch de integração num worktree temporário, roda o gate uma vez nela, mergeia na ordem o que passou e devolve à dona o que falhou (conflito ou gate vermelho). Com a combinação vermelha, testa um PR por vez sobre a parte já verde para achar quem quebrou. Ninguém rebaseia por merge alheio: o conflito real volta à dona como devolução, não como pedido de rebase preventivo. A versão sobe depois do lote (`subir-versao`).
5. **No máximo 4 donas trabalhando ao mesmo tempo** (padrão 4, `KIT_TETO_DE_DONAS`; 3 quando a máquina está cheia). Item além do teto espera na fila sem pedir sessão. Item em `merge` não conta: a dona só espera.
6. **Despacho por evento.** A orquestradora abre a dona quando o item nasce ou quando uma dona termina (o fim de turno dela e a mensagem `PR N pronto, HEAD …` são os eventos). A batida de 10 min fica como rede de segurança: cutuca o item parado e relata o `merge` parado; não avisa livre, não pede vaga e não conta excedente.
7. **Desligar por regra, não apagar.** O modelo vale por padrão. `KIT_MODELO=papeis` (ou `~/.claude/orquestracao/modelo.json` com `{"modelo":"papeis"}`) devolve as travas do pool para os itens antigos que ainda terminam nele. Com o modelo da dona: a trava T1/T1c/T8 e o piso de E do `papel-do-pool` não valem, o ritual da orquestradora não cobra piso nem excedentes, e o item `via: "dona"` com dona ou com alguém no `com` não está "esperando papel".

<a id="alternativas"></a>
## Alternativas consideradas
- **Manter o pool de papéis e só afinar as regras.** Rejeitada: cada conserto do pool criou outra regra de passagem (15 dos 20 itens medidos), e as esperas vêm da passagem em si — o item espera o papel seguinte ficar livre, a V espera a máquina, a E espera o laudo. Afinar não tira a espera, só a encurta.
- **Enxame (muitas sessões em paralelo, cada uma com um pedaço do item).** Rejeitada: a máquina saturou com 10 sessões, e a pesquisa (Cognition, *Don't build multi-agents*) mostra que pedaços do mesmo item em contextos diferentes tomam decisões incompatíveis; o custo de juntar é maior que o ganho do paralelismo.
- **Uma sessão dona, mas com validação em sessão própria.** Rejeitada: a validadora em sessão era o maior tempo (38%) e o motivo dela, o contexto limpo, o subagente já dá; ela só acrescentava espera por vaga e por máquina.
- **Gate completo em todo PR antes da fila.** Rejeitada: o gate de cada PR fica velho no primeiro merge alheio e gerava o rebase em cascata; na fila ele roda uma vez sobre o que vai de fato para a branch.
- **Merge queue do GitHub.** Rejeitada por ora: o gate deste kit divide o teto de núcleos da máquina local (ADR 0005) e não roda no CI; a fila local dá o mesmo efeito sem CI.
- **Apagar o código do pool.** Rejeitada agora: itens vivos ainda terminam no modelo antigo, e desligar por regra deixa voltar atrás sem reverter PR. Apagar fica para depois que a fila esvaziar.

<a id="consequencias"></a>
## Consequências
- O item anda sem esperar papel livre: o tempo de espera entre etapas some, e o que sobra é o trabalho, a revisão do subagente e a fila de merge.
- A dona acumula mais contexto que uma executora; o teto do papel planejador (350 mil para limpar no momento oportuno) passa a valer para ela, e o handoff do item continua sendo o lugar do estado.
- O conflito aparece mais tarde (na fila), mas só quando é real; o rebase preventivo deixa de existir.
- O gate vermelho na fila custa mais de um gate (um por PR até achar o culpado); com lotes pequenos (até 4 PRs) o pior caso é 5 gates.
- Os textos do pool (protocolo, papéis, skills) ganham a seção do modelo novo no topo e mantêm o resto como legado até a fila antiga esvaziar; tirar o legado é um item próprio.
