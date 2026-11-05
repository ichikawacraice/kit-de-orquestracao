# ADR 0028 — O `--anotar` da dona lança a fila livre na hora; a batida vira rede

- Data: 2026-11-05
- Status: Proposto
- Autor: sessão dona do F427, a partir do pedido do operador em 05/11 ("o tempo entre as batidas está correto? Não deveria ter intervalos menores?")
- Substitui: o item 2 da Decisão do [ADR 0019](0019-a-fila-de-merge-roda-sem-turno-da-orquestradora.md) e a alternativa que ele rejeitou ("A dona lança a fila ela mesma, na hora"); o resto do 0019 fica
- Relacionados: [ADR 0023](0023-o-pos-merge-roda-sem-turno-da-orquestradora.md) (o pós-merge na rodada sem turno); protocolo em [`pool/protocolo.md#fila-sem-turno`](../../plugins/orquestracao/pool/protocolo.md#fila-sem-turno); referência em [`pool/referencia.md#anotar-lanca`](../../plugins/orquestracao/pool/referencia.md#anotar-lanca)

<a id="contexto"></a>
## Contexto
- Pelo 0019, o PR anotado espera a próxima batida para o gate subir: até `BATIDA_MIN` minutos (10 por padrão) parado, com a fila livre e o gate gravado. O operador baixou a batida para 2 min para encurtar a espera, o que faz o mod rodar o `painel batida` cinco vezes mais, só para lançar o que já se sabia lançável no `--anotar`.
- O 0019 rejeitou a dona lançar a fila por dois motivos: (a) a sessão da dona passaria a disparar merge, o que a trava T6 impede; (b) o processo ficaria preso ao ciclo de vida da sessão dela.
- Sobre (b): o lançamento da batida já é `spawn` com `detached` + `unref`, sem a id da sessão no ambiente. Medido no F427: o filho lançado pelo `--anotar` sobrevive ao fim do Bash que o lançou (o pai vira o pid 1). Não medido: se sobrevive ao arquivamento da sessão da dona.
- Sobre (a): o que a T6 impede é a dona rodar o gate e mergear com o critério dela. O lançamento sem turno roda a mesma rodada da batida (`fila-de-merge … --sem-turno`), com o gate e o preparo gravados pela orquestradora e o sha que a dona testou; a dona não escolhe nada disso.

<a id="decisao"></a>
## Decisão
1. **O `--anotar` lança a fila livre:** depois de anotar o PR, dentro da mesma trava, se nenhum gate do projeto está vivo (`filaOrfa`), o `--anotar` aplica o mesmo julgamento da batida (`julgarLancamento`: `KIT_FILA_SEM_TURNO`, sha em todo PR, `config` com gate e pasta, nenhum lançamento nos últimos `RELANCE_MIN`, menos de `LANCAMENTOS` tentativas), grava a marca `lancada` e, fora da trava, sobe a rodada sem turno com o mesmo lançador. A saída diz `lancou` com o `pid` e o `log`, ou `naoLancou` com o motivo.
2. **Com gate rodando, só anota:** a rodada viva leva o PR no lote seguinte, como antes.
3. **Com aviso pendente, só anota:** `avisoSemCodigo` (PR só de doc que fecharia o item) e `avisoSemEntrega` (item sem a entrega) pedem conserto antes do merge; o `--anotar` não lança, e o próximo, depois do conserto, lança. Os avisos se calculam depois de o item se ligar ao PR (pela `prs` ou pela branch), para verem o item ligado só pela branch.
4. **O `agora` do item se acerta antes do lançamento:** a rodada pode devolver o PR em segundos, e a ligação depois dela apagaria a devolução.
5. **A batida fica como rede:** lança a fila que o `--anotar` não lançou (aviso, lançamento que falhou, processo que morreu antes de se gravar dono). A T6 continua recusando à dona o `fila-de-merge` sem `--anotar` e o `mergear`.

<a id="alternativas"></a>
## Alternativas consideradas
- **Manter o 0019 e só baixar a batida.** Rejeitada como solução: 2 min ainda são 2 min parados por PR, e cada batida roda o painel inteiro (avisos, relatório, desfechos) para um lançamento que o `--anotar` sabe fazer na hora.
- **A dona mandar o recado e a orquestradora rodar a fila.** Rejeitada: é o que o 0019 tirou, um turno da orquestradora por PR.
- **O `--anotar` rodar o gate em primeiro plano.** Rejeitada: prenderia o Bash da dona por minutos e o processo à sessão dela, o motivo (b) do 0019.
- **Não lançar com aviso só na batida também.** Adiada: hoje a batida lança mesmo com aviso pendente (era assim antes deste ADR); o conserto é a batida ler os mesmos avisos, item próprio.

<a id="consequencias"></a>
## Consequências
- O PR anotado com a fila livre entra no gate em segundos, sem esperar a batida; o intervalo da batida deixa de ser o tempo de espera do PR e volta a ser só o da rede e da entrega de desfechos.
- Dois `--anotar` seguidos não lançam duas filas: a marca `lancada` gravada na trava segura o segundo por `RELANCE_MIN`, e a rodada lançada leva o PR do segundo.
- Se o processo morre antes de se gravar dono, a fila fica órfã até a marca vencer (5 min) e a batida relançar.
- O log da rodada sem turno (`<projeto>.sem-turno.log`) passa a ser aberto em modo de acréscimo, para o lançamento novo não truncar o de uma rodada que ainda escreve nele.
- Não medido: o filho sobreviver ao arquivamento da sessão da dona. Se não sobreviver, a batida relança depois de `RELANCE_MIN`.
