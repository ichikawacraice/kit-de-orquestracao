# F76 · os botões de pedir sessão da fila ficam no lugar certo e contam só a Na fila — plano

Planejadora: P2 (`local_126b841c-7c77-4125-8de0-ce221296487b`). Origem: crítica de UI 24/30 e achado da V1 no PR #33 (F69 parte A), laudo `~/Library/Application Support/Claude/side-session-notes/local_2ea799d0-2667-4ac6-9325-e86bee5508a9/F69-A-laudo-V1.md`. Revisão de design de origem: `docs/design/revisoes/2026-10-26-pedir-sessao-pela-fila.md` (branch `claude/f69-design-revisao`, 47f15ca).

**Base:** `origin/main` em `ee58748` ou depois (o #33 já entrou). O código abaixo (`pedindo`, `podarPedidos`, `topoDaFila`, `acaoDoPedido`) só existe nele. Linhas citadas são as de `1d846ab`; o rebase pode deslocá-las.

## O que muda (6 pontos)

| # | Peso | Defeito medido | Conserto decidido |
|---|---|---|---|
| A | média (crítica P1) | `emPedido` (topo da Na fila) é montado sobre `lidaAgora.itens`, todos os itens; um cartão em Executando no estado "Pedido" gera botão "Abrir a orquestradora" e frase no topo da Na fila, e o botão aparece duas vezes | `emPedido` sai de `sec.fila` (os itens da Na fila), calculado dentro de `topoDaFila(naFila)` |
| B | média (crítica P2) | no cartão, "Abrir a orquestradora de kit-de-orquestracao" mede 287 px num cartão de 262 px | **todo** botão da orquestradora (cartão e topo, com 1 ou 2+ projetos) diz só "Abrir a orquestradora"; no topo, o projeto vem na frase colada acima do botão (adendo §Decisões 1, Q318 assumida) |
| C | média (crítica P3) | com dois projetos em "Pedido", os botões ficam numa fileira e as frases depois, longe do botão de cada uma | botão e frase agrupados por projeto — **o desenho exato vem do adendo da D1** (seção "Layout" abaixo) |
| D | baixa (crítica P4) | lote que falha pelo caminho do prompt avisa só "Não pus o pedido na caixa do prompt (…)", sem dizer quais itens ficaram de fora (`register.tsx:~707`) | o aviso do prompt cita os itens, como o da mensagem já faz |
| E | baixa (crítica P5) | frases e avisos do topo da Na fila começam sem o recuo do mock (`.aviso-proj { padding-left: 13px }`) | recuo decidido no adendo da D1 |
| F | baixa (achado V1) | `EstadoPedido` não guarda o papel; item em "Pedido" para P que passa à execução esperando E em menos de 30 min continua "Pedido às … · inicie o cartão" e esconde "Pedir executora" | o estado `prompt`/`pedido` guarda `papel`; `podarPedidos` poda quando `papelQueFalta(item)` difere do papel guardado |

## Arquivos

- `plugins/painel-sessoes/types/index.d.ts` — `EstadoPedido`: `{ estado: 'enviando' } | { estado: 'prompt'; em: number; papel: 'P'|'D'|'E'|'V' } | { estado: 'pedido'; em: number; papel: 'P'|'D'|'E'|'V' }`.
- `plugins/painel-sessoes/hooks/register.tsx` — `podarPedidos`, `enviarPedidos` (marcar com papel; aviso do prompt), `botaoOrquestradora`, `emPedido`/`topoDaFila`, os dois lugares que desenham o topo (desktop e terminal).
- `plugins/painel-sessoes/tests/painel.test.tsx` — testes novos (abaixo) e ajuste dos que montam `EstadoPedido` à mão.
- `plugins/painel-sessoes/.claude-plugin/plugin.json` — versão `0.6.8` (a `main` está em 0.6.7).
- `docs/planos/2026-10-26-botoes-de-pedir-no-lugar-certo.md` — cópia deste plano (primeiro commit).

## Passos

1. Branch nova a partir da `main` com o #33 já mergeado. Traga o adendo da D1: `git cherry-pick b8b66c6 1708ac0` (branch `origin/claude/f76-design-adendo`; só arquivos novos em `docs/design/revisoes/`). Copie este plano para `docs/planos/2026-10-26-botoes-de-pedir-no-lugar-certo.md` e commite (`docs(planos): …`).
2. **Testes vermelhos primeiro** (`claude plugin test plugins/painel-sessoes`), um por ponto, com o prefixo `F76`:
   - **F76 A:** um item da Na fila sem pedido e um cartão em Executando (sem dono, `esperando` V não entregue, como em `F69 A (xi)`) do mesmo projeto em estado `pedido` (pressione `pedir:<id do cartão>` com o pane em outra sessão). Afirme que `orq:<id do cartão>` existe (presença) e que `orq:izanagi` **não** existe e nenhum `Text` diz "cartão espera você"/"cartões esperam você". Depois peça o item da fila e afirme `orq:izanagi` uma vez e a frase "1 cartão espera você…" (só o da fila conta, não 2).
   - **F76 B:** com dois projetos em "Pedido" (Na fila de izanagi e de kit) **e** um cartão em Executando em "Pedido", o botão `orq:<id do cartão>` **e** os do topo (`orq:izanagi`, `orq:kit`) têm o texto exato `Abrir a orquestradora` (antes do conserto, os do topo dizem `… de <projeto>`: o teste falha por isso).
   - **F76 C/E:** o teste da seção "Para a E" do adendo (6 asserções: presença, ordem frase→botão, ancestral comum, recuo, rótulo, 1 projeto).
   - **F76 D:** lote com 2 itens de izanagi com o pane na orquestradora de izanagi e `fill` recusado (como `F69 A (vii-c)`): o aviso contém `F68 · ` e `F63 · ` e o número 2; com 1 item, contém o `F<n> · <título curto>` dele.
   - **F76 F:** `podarPedidos({F1:{estado:'pedido', em: AGORA-60_000, papel:'P'}}, [F1 em execução esperando E], AGORA)` devolve `{}`; com `papel:'E'` fica. E no pane: item em planejamento pedido por mensagem, releitura com o item em execução sem dono → `pedir:F…` volta com o texto `Pedir executora` e "Pedido às" some.
   Rode e cole a saída vermelha (cada um falha pelo motivo do ponto, não por erro de compilação).
3. **F:** tipo + `marcar(g.alvos-com-papel)` grava `papel` de cada alvo (o `marcar` hoje recebe um estado só para todos: passe a grava `{ ...estado, papel: a.papel }` por alvo). Em `podarPedidos`, fica só se `papelQueFalta(item) === e.papel` quando `e.estado !== 'enviando'`. Ajuste o teste `F69 A: podarPedidos` (estados montados à mão ganham `papel`).
4. **A:** remova o `emPedido` global; `topoDaFila(naFila)` calcula o seu a partir de `naFila`. `acaoDoPedido` do cartão não depende mais dele.
5. **B:** `botaoOrquestradora` passa a rotular sempre `Abrir a orquestradora` (ou `Abrindo…`); some a dependência do tamanho do mapa.
6. **C e E:** aplique o adendo da D1 nos dois desenhos do topo (desktop ~1853 e terminal ~2046), sem redesenhar além dele.
7. **D:** em `enviarPedidos`, o aviso do caminho do prompt: 1 item → `Não pus o pedido do ${titulos[0]} na caixa do prompt (${erro}): escreva à orquestradora.`; n ≥ 2 → `Não pus ${n} pedidos na caixa do prompt (${erro}): ${titulos.join(', ')}; escreva à orquestradora.` Ajuste o `F69 A (vii-c)` se ele afirma o texto antigo.
8. Versão do `painel-sessoes` para `0.6.8`. Testes do pacote verdes; `claude plugin validate plugins/painel-sessoes --strict`; gate completo (`npm test`) uma vez antes do push.
9. Push, PR para `main` (título `fix(painel): botões de pedir sessão no lugar certo e contam só a Na fila`, corpo em PT-BR com os 6 pontos e a saída dos testes), `painel com del F76 <seu local_> --fez`, avise a P2.

## Critério de pronto (medível)

- `claude plugin test plugins/painel-sessoes; echo "exit=$?"` → `exit=0`, com os testes `F76 A`, `F76 B`, `F76 C…`, `F76 D`, `F76 F` presentes e passando; e a saída deles **vermelha antes** do conserto colada no relatório.
- `npm test; echo "exit=$?"` → `exit=0`.
- `claude plugin validate plugins/painel-sessoes --strict` → `✔ Validation passed`.
- `grep -n "emPedido.size > 1" plugins/painel-sessoes/hooks/register.tsx` → nenhuma linha (o rótulo não depende mais do mapa global).

## Fora do escopo

- Mudar a cor da frase "N cartões esperam você…" (decisão do operador; fica `warning`, *assumida, a confirmar*).
- O "Nada na fila." e qualquer outro texto do pane fora do topo da Na fila e do cartão.
- O protocolo, a skill `orquestradora`, `esperando-papel.mjs`, `barra.tsx`.
- Pedir de novo no estado "No prompt" (revisão §5 aceita o dobro).

## Regras do projeto que tocam

- `CLAUDE.md` da raiz: Node ≥ 20, ESM, sem dependência npm; testes do mod são `.tsx` e rodam com `claude plugin test plugins/painel-sessoes` (o `npm test` não os pega); commits conventional em PT-BR; teste antes do código; teste que mede ausência prova antes a presença; `F<n>` seguido de ` · ` em todo texto do pane.
- Com orquestradora ativa: abra PR, **não mergeie**.
- Texto de UI não cita spec, ADR nem doc.

<a id="layout"></a>
## Layout (adendo da D1)

`docs/design/revisoes/2026-10-26-pedir-sessao-pela-fila-adendo-f76.md` (commits b8b66c6, 1708ac0; crítica 25/30). Resumo: "Pedir n sessões" sozinho no alto; por projeto em "Pedido", um `Box column` sem gap com a frase (`warning`) em cima e o botão embaixo, num `Box row`; avisos depois. O topo inteiro num `Box column gap={1} paddingLeft={3} paddingBottom={1}` no desktop e `paddingLeft={2}` no terminal (Q319 assumida). A E segue o adendo sem redesenhar; o que ele não disser, pergunte à P2.
