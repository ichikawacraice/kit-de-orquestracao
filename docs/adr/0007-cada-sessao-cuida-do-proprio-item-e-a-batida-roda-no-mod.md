# ADR 0007 — Cada sessão cuida do próprio item, a batida de 10 min roda no mod sem modelo, e a orquestradora só lê

- Data: 2026-10-26
- Status: Proposto
- Autor: P3 do kit (F122), a pedido do operador (resposta à Q388)
- Relacionados: muda o ritual da orquestradora (`skills/orquestradora/SKILL.md`, passos 1 a 4) e o protocolo do pool (âncoras `fila-do-pool`, `esperando-papel`, `sob-demanda`); respeita o ADR 0004 (piso de uma E livre) e o ADR 0005 (máquina cheia não recebe V). Plano: `docs/planos/2026-10-26-cada-sessao-cuida-do-proprio-item.md`

<a id="contexto"></a>
## Contexto
- No Izanagi (26/10) havia 83 itens na fila e cerca de 24 membros no pool. A cada turno a orquestradora repassava todas as sessões (`list_sessions`, estado mecânico de cada linha, arquivar, soltar o parado, despachar, um `batch`) e não chegava a manter o painel em dia.
- A P7 ficou parada desde 17:10 e continuou dona de três itens, um deles esperando merge desde 15:38. Só a orquestradora soltava item parado (ritual 2b), porque o script `painel` não enxerga o `list_sessions`.
- Medido em 26/10 (detalhe no plano):
  - o app mantém processo vivo só para as **10 sessões de atividade mais recente** (36 sessões abertas, 10 processos `claude`; a 11ª mais recente, parada desde 19:11, já não tinha processo). Sessão sem processo não roda hook nem mod; `send_message` a acorda;
  - o mod `painel-sessoes` liga um relógio de 30 s no `session.start` de **toda** sessão com processo, com o pane aberto ou não, e o motor dá a ele `$.tool.call` (inclusive `list_sessions` e `send_message`) e `$.process.run`, sem passar pelo modelo;
  - turno aberto por mensagem de outra sessão chega com origem `peer`, e por `$.prompt.submit` com origem `plugin`: nenhum dos dois abre sessão nem arquiva (medido em 23/10 e travado pelo `papel-do-pool`);
  - tarefa agendada com modelo custa um piso de ~90 mil tokens por rodada; a batida a cada 10 min daria ~13 milhões de tokens por dia só para olhar a fila.
- O operador pediu (26/10): *"deixarmos as sessões independentes atualizando as próprias coisas, e a orquestradora só ler o banco de dados do painel… se uma sessão terminar e precisar de algo na fila, ela própria alimenta a tabela e se encerra, e essa batida de 10m passa vendo se tem alguém parado; se tiver, pede pra ela mesma fazer algo."*

<a id="decisao"></a>
## Decisão
1. **Cada sessão grava o que é seu.** A dona grava o item a cada turno (já cobrado pelo `fila-do-item`). Quem entrega solta o item na etapa seguinte e manda a mensagem ao membro livre do papel seguinte (já no protocolo). A trava `painel-das-sessoes.mjs` passa a valer em todo projeto, com ou sem orquestradora ativa. A coleção `sessoes` deixa de ter estado mecânico mantido pela orquestradora: o pane lê o `list_sessions` direto.
2. **Despacho por puxar.** Quem leva o item ao membro livre é a própria fila: o membro livre que recebe `F<n> para você` roda `painel pegar F<n>` (atômico: confere que o item ainda espera o papel dele, põe-no no `com`, ou como dono na etapa `planejamento`, e devolve recusa se outro pegou antes). O aviso a uma sessão ociosa chega por `send_message`, mandado por quem soltou o item ou pela batida.
3. **A batida de 10 min roda no mod, sem modelo.** A cada minuto o relógio do mod, em qualquer sessão com processo vivo, disputa a vez num arquivo de posse (`~/.claude/orquestracao/batida/vez.json`); quem tem a vez e passou 10 min desde a última batida faz o `list_sessions`, passa a lista ao `painel batida` (script, que decide sob a trava do painel e guarda o que já cutucou) e entrega as mensagens que o script devolve. A batida:
   - **cutuca** a dona do item vivo parado há 30 min (sem gravação, sem `espera`/`trava`, ninguém do item com `isRunning`), uma vez: *siga, grave o `agora`, ou solte*;
   - **solta** (`painel soltar`) o item cuja dona foi cutucada há 20 min ou mais e continua sem gravar e sem rodar, e o item cuja dona e cujo `com` sumiram da lista (arquivados ou apagados);
   - **avisa o membro livre** do papel quando um item espera esse papel há 5 min ou mais, um item por membro por batida (V só com a máquina livre, ADR 0005);
   - **cobra a dona** do item `entregue` (o papel já está em `fez`) a avançar a etapa;
   - **avisa a orquestradora** do projeto, numa mensagem só, dos itens em `merge` parados há 30 min, das vagas que faltam (item esperando papel sem membro livre, e o piso do ADR 0004) e dos membros livres além do teto;
   - **apaga** o marcador de orquestradora (`ativas/<id>`) cuja sessão foi arquivada ou cujo transcript não muda há 7 dias.
4. **A orquestradora só lê**, mais o que só ela pode: mergear, fazer o release, reservar número, pedir vaga (o `start_session` exige o turno do operador; fora dele, cartão) e arquivar. O ritual de cada turno passa a ser ler o relatório da batida (`batida/<projeto>.json`) e agir só sobre `merge`, `vagas` e `excedentes`. Saem dela: o estado mecânico das linhas, o `batch` obrigatório, o soltar (2b) e o despacho com membro livre (3). A trava do ritual cobra só o que ficou com ela.
5. **Teto de dois membros livres por papel por projeto** fora do modo ausente (a E conta o piso de um). O excedente vai na lista `excedentes` da batida, do mais antigo parado para o mais novo, e a orquestradora o arquiva (a trava T2 continua a dela). No modo ausente vale o pool padrão e nada se arquiva.

<a id="alternativas"></a>
## Alternativas consideradas
- **Tarefa agendada com modelo a cada 10 min.** Rejeitada: piso de ~90 mil tokens por rodada para, na maioria das vezes, não achar nada; o mesmo julgamento cabe num script.
- **Script sem modelo com vencimento pelo mtime do transcript, rodado por hook de Stop.** Rejeitada como única via: hook de Stop só roda quando alguma sessão termina turno, e a noite sem turno nenhum é justamente quando o item fica preso; e o script sozinho não manda mensagem. O cálculo do vencimento fica no script, mas quem o chama e entrega as mensagens é o mod.
- **O mod só com o pane aberto (como hoje).** Rejeitada: o pane fica fechado a maior parte do tempo. O relógio do `session.start` já roda sem o pane.
- **Cada sessão se cutucar com `$.prompt.submit` no próprio mod.** Rejeitada: a sessão parada há mais tempo é a que já não tem processo (fora das 10 mais recentes), e aí o mod dela não roda. `send_message` de uma sessão viva alcança qualquer uma.
- **Segunda orquestradora só para o pool** (opção da Q388). Rejeitada pelo operador.
- **A batida arquivar o excedente.** Rejeitada por ora: arquivar apaga o worktree e a trava T2 só confia na orquestradora; a batida só aponta.

<a id="consequencias"></a>
## Consequências
- O turno da orquestradora encolhe para merge, release, vagas e arquivar; o painel deixa de depender de ela ter fôlego.
- Item preso por sessão parada volta à fila em no máximo ~60 min (30 de prazo, uma batida para cutucar, 20 de espera, a batida seguinte), sem gastar modelo, e quem gasta é a sessão cutucada, no trabalho que já era dela.
- Enquanto nenhuma sessão tiver processo vivo, não há batida; a primeira que voltar a rodar faz uma na hora (a posse vencida). Com o operador ausente e tudo parado, nada anda de qualquer jeito.
- Mensagem da batida chega como `peer`: sessão em outro modo de permissão pode segurá-la para aprovação. O pool roda num modo só; a batida registra a entrega que falhou e tenta de novo na próxima.
- Duas sessões podem ganhar a vez ao mesmo tempo; o `painel batida` decide sob a trava do painel e guarda o que já mandou, então a segunda não repete a mensagem.
- O mod passa a rodar `node` (via `$.process.run`) e a resolver o caminho do plugin `orquestracao` pelo `installed_plugins.json`; sem o plugin instalado, a batida não roda e diz isso no log do mod.
