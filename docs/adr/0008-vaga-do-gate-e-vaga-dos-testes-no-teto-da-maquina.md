# ADR 0008 — O teto da máquina tem uma vaga do gate e uma vaga dos testes normais, as duas pela fração dos núcleos

- Data: 2026-10-26
- Status: Proposto
- Autor: sessão planejadora do kit (item F136), a pedido do operador (Q407, pela orquestradora do Izanagi)
- Relacionados: substitui as decisões 2, 3 e 5 do [ADR 0005](0005-os-testes-da-maquina-dividem-um-teto-de-nucleos.md) (o resto dele segue) · plano [`2026-10-26-vaga-do-gate-e-vaga-dos-testes`](../planos/2026-10-26-vaga-do-gate-e-vaga-dos-testes.md) · ADRs 0328, 0388 e 0400 do Izanagi
- Pendências: o Izanagi adotar as faixas e a vez da máquina por PR próprio; remedir com o gate inteiro em 1 × 7 contra 2 × 3; medir dois testes de 3 juntos (a decisão 5 se apoia numa estimativa)

<a id="contexto"></a>
## Contexto
- **O que o ADR 0005 deixou.** Um teto único de fichas na máquina (padrão metade dos núcleos; o operador gravou 10 à mão em 15). Quem chega primeiro leva o que houver, sem distinguir o gate (a suíte inteira) do teste de um pacote ou de um arquivo.
- **O que se mediu em 26/10.** O gate de um `pnpm-workspace` pede 2 pacotes × floor(15/4) = 6 fichas: sozinho, deixa 4 das 10 paradas. Com três testes de pacote rodando, o gate que chega leva 1 ficha e roda a suíte inteira com 1 worker. Dois gates de projetos diferentes (o kit e o Izanagi) rodam juntos, porque a vez do gate é por repositório.
- **Um pacote com 3 e com 7 workers:** com 7 workers um pacote ficou 1,4 a 1,6× mais rápido que com 3 (runner 223 → 136–157 s; web 163 → 109 s), com 2,3× os núcleos; o mais longo, 4 min sob carga 20 (tabela no [plano](../planos/2026-10-26-vaga-do-gate-e-vaga-dos-testes.md#medido)).
- **O pedido do operador:** teto como fração dos núcleos; uma vaga do gate (~70% do teto), um gate por vez; uma vaga dos testes normais (~30%), sempre livre; sem gate, a vaga dele se empresta; tudo derivado de `availableParallelism()`, com override por env.

<a id="decisao"></a>
## Decisão
1. **O teto é uma fração dos núcleos, padrão 2/3** (10 em 15, o que o operador já usava). Ordem: `KIT_NUCLEOS_DE_TESTE` / `IZANAGI_NUCLEOS_DE_TESTE` (absoluto, para teste e ajuste pontual); `KIT_FRACAO_DE_TESTE`; `teto.json` com `nucleos` (absoluto, o contrato do Izanagi) ou `fracao`; senão 2/3. `floor`, mínimo 1. CI sem teto.
2. **O teto se parte em duas faixas no mesmo diretório.** Faixa do gate: fichas `1..G`, G = floor(T × 0,7) (`KIT_FRACAO_DO_GATE`); faixa normal: `G+1..T`. Com T = 10: 7 e 3. A faixa normal tem sempre ao menos 1 ficha. O arquivo da ficha não muda (`<pasta>/<k>`, PID dono), então o Izanagi continua lendo as mesmas fichas.
3. **Um gate por vez na máquina.** O gate completo, depois da vez do repositório e do verde reconferido, toma `<pasta>/gate` (`wx`, PID dono, retomado quando o PID morre). O segundo gate, de qualquer projeto, espera e diz por quem. O conserto (um pacote), o typecheck e o `com-fichas` são testes normais e não pegam essa vez.
4. **O gate toma só da faixa dele**, de 1 para cima: `pacotesJuntos × floor(G / pacotesJuntos)` no perfil `pnpm-workspace` (6 de 7 com 2 pacotes; a sobra fica emprestável), `min(gate.nucleos, G)` no perfil `comando`.
5. **O teste normal começa pela faixa normal**, de T para baixo. Só quando não há gate (sem `<pasta>/gate` vivo) passa à faixa do gate, como **empréstimo**, marcado na ficha (`"emprestada": true`). **O empréstimo não aumenta o pedido**: o teste segue pedindo o dele (3 no vitest de pacote, `--quero N` no `com-fichas`), e a faixa emprestada faz caber mais testes juntos, não um teste maior. **Estimado, não medido junto** (as rodadas foram em fila): dois testes de 3 juntos terminariam em ~3,7 min, o tempo do mais longo sozinho (runner com 3, 223 s), se a carga somada não os atrasar; os mesmos dois de 7 em fila, em ~4,3 min (runner 147 s + web 109 s).
6. **O gate que chega com a faixa emprestada** grava `<pasta>/gate` na hora (nenhum empréstimo novo começa), leva o livre e espera a devolução até o prazo (padrão 5 min: o teste de pacote mais longo medido levou 4 min sob carga 20; `gate.prazos.devolucaoSeg`). Vencido o prazo, começa com o que tem se for ao menos metade do pedido (`ceil(pedido / 2)`: 3 de 6 com teto 10); senão segue esperando e diz por quem a cada minuto.
7. **A máquina cheia da orquestradora** (ADR 0005, decisão 5) passa a olhar a faixa normal: cheia = nenhuma ficha normal livre e nenhuma emprestável, ou carga de 1 min ≥ núcleos. Um gate sozinho não segura a V. A V que roda o `npm test` com outro gate na máquina espera a vez dele como qualquer gate, e isso é o desejado: a espera é de um gate (minutos), a fila diz por quem, a V lê o diff enquanto isso, e a árvore já verde não roda o gate de novo. Segurar a V pela vez do gate a deixaria parada também quando ela não precisa do gate.

<a id="alternativas"></a>
## Alternativas consideradas
- **Manter um teto só, primeiro a chegar leva.** Recusada: é o que deixa o gate com 1 worker atrás de três testes de pacote e dois gates de projetos diferentes juntos.
- **Dois diretórios (`gate/` e `normal/`) em vez de faixas de `k`.** Recusada: muda o contrato da ficha que o Izanagi lê, e o teto somado deixaria de ser a contagem de `<pasta>/<k>` que a orquestradora já faz.
- **Teste normal levar a vaga emprestada inteira (até 7).** Recusada pela medição: 2,3× os núcleos para 1,4 a 1,6× a velocidade; pela conta (decisão 5, a medir juntos), os mesmos núcleos em testes de 3 rendem mais.
- **Gate esperar sempre a devolução inteira.** Recusada: um vitest em modo watch segura ficha emprestada para sempre e o gate nunca começaria.
- **Só emprestar a quem termina rápido.** Recusada como regra: o `com-fichas` roda qualquer comando e não há como saber a duração antes. O prazo da devolução e o limite do empréstimo cobrem o mesmo risco medindo o que acontece.
- **Gate começar logo com o que houver.** Recusada: o vitest fixa os workers ao subir, e o gate que começa com 1 ficha roda a suíte inteira com 1 worker mesmo depois de as outras voltarem.
- **Fatias fixas (7 e 3) em vez de frações.** Recusada pelo pedido: outra máquina, outro número; as frações dão 7/3 aqui e acompanham a máquina.
- **Vez da máquina por fila (a fila do gate de cada repositório votando).** Recusada: o arquivo único com PID dono já é o padrão do kit (a trava do gate, as fichas) e não pede coordenação nova.

<a id="consequencias"></a>
## Consequências
- **Melhor:** o gate tem uma vaga garantida e roda sem disputar com os testes de pacote; o teste normal nunca espera o gate; sem gate, a máquina usa o teto inteiro.
- **Pior:** o gate pode esperar até o prazo pela devolução; dois gates de projetos diferentes passam a esperar um pelo outro (antes rodavam juntos e travavam a máquina).
- **Transição:** até o Izanagi adotar, as fichas dele tomam de 1 para cima (caem na faixa do gate) e o gate dele não pega a vez da máquina. O gate do kit trata essas fichas como emprestadas de dono desconhecido: espera pelo prazo e segue.
- **Passamos a ter que:** manter iguais a leitura das frações no gate e no plugin (o teste de concordância compara); remedir a carga depois do merge.
