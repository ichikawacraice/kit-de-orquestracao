# ADR 0010 — O gate que esperou a devolução começa com pelo menos dois workers por pacote

- Data: 2026-10-27
- Status: Proposto
- Autor: sessão planejadora do kit (item F136), depois da medição da execução e da nota da V1
- Relacionados: substitui só a decisão 6 do [ADR 0008](0008-vaga-do-gate-e-vaga-dos-testes-no-teto-da-maquina.md) no número do limiar (o resto dela e do ADR segue) · plano [`2026-10-26-vaga-do-gate-e-vaga-dos-testes`](../planos/2026-10-26-vaga-do-gate-e-vaga-dos-testes.md), seção "Desvios na execução"
- Pendências: remedir 1 × 2 × 3 workers por pacote com a máquina sem outra carga (as rodadas foram sob carga de outras sessões)

<a id="contexto"></a>
## Contexto
- **O ADR 0008, decisão 6,** diz que o gate que chega com a faixa emprestada espera a devolução até o prazo e, vencido o prazo, começa com o que tem se for ao menos metade do pedido: `ceil(pedido / 2)`, "3 de 6 com teto 10".
- **A nota da V1** na validação do plano: no perfil `pnpm-workspace` com 2 pacotes juntos, 3 fichas dão `floor(3 / 2)` = 1 worker por pacote, e o vitest fixa os workers ao subir.
- **A medição da execução (26/10)**, Izanagi `web` (725 arquivos): 1 worker levou **861 s**, 2 workers **392 s**, contra 160–164 s com 3 no mesmo dia. Sob carga de outras sessões (1 min de 7 a 26), vale como ordem de grandeza: 1 worker ≈ 2,2× o tempo de 2. Com 1 worker, o gate que "começou" termina depois do que se tivesse esperado mais um pouco pela devolução.

<a id="decisao"></a>
## Decisão
1. **No perfil `pnpm-workspace`, o mínimo para o gate começar depois do prazo é `min(pedido, max(ceil(pedido / 2), 2 × pacotesJuntos))`**, nunca mais que o pedido: 4 de 6 com 2 pacotes juntos e teto 10 (2 workers por pacote). Abaixo disso, ele segue esperando e diz por quem, como o ADR 0008 já previa.
2. **No perfil `comando`, segue `ceil(pedido / 2)`** (não há pacotes para dividir).
3. O cálculo mora em `minimoParaComecar` (`gate/a-vez-do-gate.mjs`), único lugar que decide o número.

<a id="alternativas"></a>
## Alternativas consideradas
- **Manter "3 de 6" e só anotar no plano.** Recusada: o ADR é o registro da decisão, e quem lê só o 0008 levaria o número que a medição derrubou.
- **Exigir o pedido inteiro (6 de 6).** Recusada pelo mesmo motivo do 0008: um teste em modo watch segura ficha para sempre e o gate nunca começaria.
- **Três workers por pacote (6 de 6 com 2 pacotes).** Recusada: é o pedido inteiro; 2 workers já cortam o tempo de 1 pela metade.

<a id="consequencias"></a>
## Consequências
- **Melhor:** o gate nunca roda a suíte de um pacote com 1 worker por ter começado cedo.
- **Pior:** o gate pode esperar mais depois do prazo, quando a devolução para em 3 fichas.
- **Passamos a ter que:** citar este ADR, não a decisão 6 do 0008, quando se falar do limiar do gate.
