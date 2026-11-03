# ADR 0019 — A fila de merge roda sem turno da orquestradora, e o estado dela gira

- Data: 2026-11-02
- Status: Proposto
- Autor: sessão dona do F351, a partir do pedido do operador Q855
- Relacionados: [ADR 0011](0011-uma-sessao-dona-do-item-do-plano-ao-pr.md) (uma dona por item; a orquestradora é a fila de merge); [ADR 0007](0007-cada-sessao-cuida-do-proprio-item-e-a-batida-roda-no-mod.md) (a batida roda no mod); protocolo em [`pool/protocolo.md#fila-sem-turno`](../../plugins/orquestracao/pool/protocolo.md#fila-sem-turno)

<a id="contexto"></a>
## Contexto
- Medido em 02/11 sobre a semana de 26/10: as orquestradoras custaram ~6% do total; 84% dos turnos delas vieram de aviso automático, e cada turno relê ~232 mil tokens.
- Cada PR pedia ao menos dois turnos dela: o recado `PR N pronto, HEAD <sha>` (para rodar `painel fila-de-merge`) e o desfecho (repassar o devolvido à dona, subir a versão). O gate já rodava sozinho; o turno só servia de gatilho e de carteiro.
- O arquivo de estado (`~/.claude/orquestracao/<repo>.md`), lido inteiro a cada limpeza, crescia uma seção "Retomar daqui" por limpeza: 38 KB neste repo e 74 KB no de outro projeto.
- A limpeza inteira com o operador presente é dele (botão `↺ Limpar`, trava T7), e isso não muda.

<a id="decisao"></a>
## Decisão
1. **A dona anota o PR na fila:** `painel fila-de-merge N:<sha> --anotar` confere que a ponta é o sha que ela testou, põe o PR nos pendentes do projeto e grava a pasta do repositório. Não roda gate nem mergeia; por isso a trava T6 o deixa passar. O recado `PR N pronto` fica para quando o `--anotar` não serve.
2. **A batida lança a fila:** a fila com PR anotado e sem processo vivo sobe destacada (`--sem-turno`), com o gate e o preparo que a última rodada da orquestradora gravou em `config`. Só sobe com o sha da dona em todo PR; sem `config`, sem sha, ou com `KIT_FILA_SEM_TURNO=off`, segue no relatório como fila parada. Um lançamento a cada 5 min, até 3 sem a fila se gravar dona.
3. **A batida entrega o desfecho:** a rodada sem turno grava o resultado no estado da fila; a batida seguinte avisa a dona do PR devolvido e da fatia, e manda à orquestradora um resumo só com o que é dela (subir a versão, atualizar os plugins, arquivar, fechar o lote). Sem orquestradora viva, o desfecho espera por ela, e a dona não é avisada duas vezes.
4. **O estado gira:** no início de sessão da orquestradora, o hook leva ao arquivo morto do mês (`arquivo-morto/<repo>/<AAAA-MM>.md`) as seções datadas, menos a mais recente, e as entregas além das 15 últimas. As seções fixas e as sem data ficam. O morto se busca com grep e não se lê inteiro.
5. **O fim de lote é o momento de limpar:** depois do desfecho com merge, a orquestradora põe o estado em dia e gira o arquivo. Com o operador presente, isso basta para o botão limpar sem perda. Com o modo ausente ligado, ela se limpa a partir de 200 mil tokens em vez de 350 mil.

<a id="alternativas"></a>
## Alternativas consideradas
- **A dona lança a fila ela mesma, na hora.** Rejeitada: a sessão da dona passaria a disparar merge, o que a T6 existe para impedir, e o processo destacado ficaria preso ao ciclo de vida da sessão dela. A batida espera no máximo 10 min, menos que um gate.
- **A batida roda o gate dentro dela.** Rejeitada: o mod dá 60 s ao `painel batida`, e o gate leva minutos. O lançamento destacado sai da trava do painel antes de subir, porque a fila também toma a trava.
- **A batida lê o gate do `.claude/kit.json`.** Adiada: nem todo projeto tem o arquivo (este não tem), e o gate que a orquestradora usou por último é o que já passou pela fila.
- **Truncar o arquivo de estado por tamanho.** Rejeitada: cortaria seção viva no meio. O giro por seção datada move só o que já foi substituído por uma seção mais nova.
- **A orquestradora se limpar sozinha no fim de cada lote, com o operador presente.** Rejeitada: contraria a T7. Ele pode estar lendo a resposta dela.

<a id="consequencias"></a>
## Consequências
- O PR entra na fila sem turno da orquestradora, e ela recebe um turno por lote, não dois por PR. O aviso de fim de turno do app, que chega à sessão que abriu a dona, continua abrindo um turno dela; isso é do app e fica fora deste ADR.
- O projeto cuja fila nunca rodou pela orquestradora não tem `config`: o primeiro PR vai pelo recado, como antes.
- O arquivo de estado deste repo cai de 38 KB para ~13 KB no primeiro giro, e o de outro projeto de 74 KB para ~21 KB (medido com `--seco` em 02/11).
