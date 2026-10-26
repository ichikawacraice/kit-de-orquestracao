# F71 — a barra cabe em todos os estados e a revisão perde o texto antigo

- **Data:** 2026-10-26 · **Planejadora:** P1 · **Base:** main em `aa8fda6` (F65 mergeado, PR #32)
- **Origem:** as ressalvas médias P2, P3 e P4 da recrítica do delta F65 (crítico de UI, rodada 2, 24/30; texto em `~/.claude/orquestracao/pool/handoffs/F65-D1-handoff.md`, "Depois do reinício"); P1 e P5 entraram no F65. Mais as ressalvas baixas R2 e R3 do laudo da V2 do PR #32 (pasta de notas da orquestradora, `F65-laudo-V.md`).

## O que foi medido (main `aa8fda6`)

- **P2:** `pecasDaBarra` (`plugins/painel-sessoes/hooks/barra.tsx` ≈ l. 264) escolhe a frase só pela faixa: `FRASE_NA_BARRA` (`◆ orquestradora pede limpeza`) na 0, `FRASE_CURTA_NA_BARRA` (`◆ pede limpeza`) na 1 e na 2. O pedido já sabe se é da própria sessão (`PerguntaAberta.propria`, ≈ l. 156), mas `EstadoBarra` não leva isso. Efeito: na barra de uma E ou P, `◆ pede limpeza` não diz quem pede.
- **P3:** a revisão `docs/design/revisoes/2026-10-26-barra-de-status.md` ainda descreve o pedido como "linha acima" em lugares que a parte C do F65 tornou falsos (Tarefa, Inventário, §Delta F65, nota do quadro 2b do mock `2026-10-26-barra-de-status-mock.html`, frase truncada do teste 4). Só doc.
- **P4:** o grupo da direita (`Box` ≈ l. 436) não tem `flexWrap`; só a linha de fora tem. A 40 colunas, com pedido aberto, os botões da direita não quebram entre si. A revisão (§Quem e onde) ainda dá o teto de altura antigo.
- **R2:** `test/reguas-de-contexto.test.mjs` l. 44-49 procura a string literal `regua.teto`/`regua.aviso`; `regua?.teto` passa (medido pela V2).
- **R3:** `minutosQueFaltam` (`barra.tsx` l. 317) sem uso desde que a frase do "limpar antes" saiu.

## Decisões

- **D1 · P2:** fora da orquestradora que pediu, a frase é sempre a longa (`◆ orquestradora pede limpeza`), em toda faixa; a curta só na própria barra dela, onde o "quem" é óbvio. Somas que o crítico mediu: E2 a 142 mil → 133/106/85, uma linha a 114 e a 94. É decisão de design: a D registra como **D1-F65-7** na revisão. *Assumida, a confirmar* (recomendação do crítico).
- **D2 · P3 e P4 no texto da revisão são da D**, não da E: a revisão é dela. A E só toca código e testes.
- **D3 · R2 e R3 vão com a E** (mesmo arquivo, mecânico).
- **D4 · Sem nova crítica:** são correções de texto e uma frase; a D decide se a P2 pede recrítica (teto Q207).
- **D5 · Versão:** patch do `plugins/painel-sessoes/.claude-plugin/plugin.json` sobre a main na hora do PR.

## Para a D (em paralelo com a E: só `docs/design/`)

Delta curto na revisão e no mock, na branch deste plano:
1. **D1-F65-7** (P2), com as somas 133/106/85 e o quadro da barra de uma E com pedido aberto a 114 e a 94.
2. **P3:** tirar "linha acima" da Tarefa (≈ l. 80), do Inventário (≈ l. 99-100), da §Delta F65 (≈ l. 37, "que tem linha própria"), da nota do quadro 2b no mock e completar a frase truncada do teste 4 ("o `Button` `modo`, com o operador presente, não aparece já na faixa 1").
3. **P4:** §5 item 1 diz `flexWrap="wrap"` no grupo da direita; §Quem e onde: "3 linhas com 79 ou mais (81 com moldura; 100 e 102 no ausente com pedido)", pior caso 6 linhas; teste novo a 40 colunas afirmando o wrap.
4. Conferir que os números citados batem com a `faixaDaBarra` da main (os do F65 já com P1 e P5).

## Para a E (em paralelo com a D: só código e testes)

Regras: Node ≥ 20, ESM, sem dependência; teste antes do código; `claude plugin test plugins/painel-sessoes` e `npm test`; commit conventional em PT-BR; não mergear. Partir de `3882f92` (branch `f71-barra-cabe`); a D mexe só em `docs/design/`, então não há arquivo em comum: quem chegar depois rebaseia. A D1-F65-7 está decidida neste plano (D1, recomendação do crítico), a E não espera a D para escrever.

1. **Teste vermelho (mod):** `pecasDaBarra` com pedido aberto e `propria: false` → `FRASE_NA_BARRA` nas faixas 0, 1 e 2; com `propria: true` → longa na 0 e curta na 1 e 2 (como hoje). `faixaDaBarra` para a E2 a 142 mil com pedido → 133/106/85 (a 133 → 0, a 132 → 1; a 106 → 1, a 105 → 2). Teste montado a 40 colunas: o `Box` do grupo da direita tem `flexWrap: 'wrap'`.
2. **Código:** `EstadoBarra` ganha `pedidoProprio: boolean` (de `b.limpeza.propria` em `desenharBarra`); `pecasDaBarra` usa a longa quando `!pedidoProprio`; `flexWrap="wrap"` no `Box` da direita; apagar `minutosQueFaltam`.
3. **R2:** em `test/reguas-de-contexto.test.mjs`, trocar os `includes` por `/regua\??\.(teto|aviso)/`; prove que a regex pega `regua?.teto` (um caso que roda a regex sobre a string `mil(regua?.teto ?? janela)` e espera achar).
4. Versão (D5); gates verdes; `claude plugin validate plugins/painel-sessoes --strict`.

5. **P1 do F65, que não entrou na main** (medido pela D1 em 453e26f e conferido no código: `larguraDaFaixa` soma o texto real, então aberto 142/101/79, enviando 137/96/74, enviado 107/80/58, e a barra se rearruma debaixo do clique). Com pedido, a soma da faixa usa sempre a largura do repouso (frase + `[ Pode se limpar ]`), também no `Enviando…` e no `✓ ok enviado`. Teste vermelho: a 114 e a 140 a faixa é a mesma nos três estados; `larguraDaFaixa` igual nos três. *Assumida, a confirmar* (entra aqui porque é o mesmo arquivo e a E está nele).

## Critério de pronto

- Os testes do passo 1 e o da regex verdes; os do F65 verdes sem edição além dos que a revisão mudar.
- `grep -n "linha acima" docs/design/revisoes/2026-10-26-barra-de-status.md` só acha a menção histórica (decisão D2-x / §Crítica), nenhuma descrição atual.
- `grep -n minutosQueFaltam plugins/painel-sessoes/hooks/barra.tsx` vazio.

## Fora de escopo

- A barra real no desktop (R1 do F65): está com o operador.
- A falha pré-existente de `plugins/orquestracao/hooks/tests/ausencia.test.mjs:47`: item próprio.
- Mudar o pane (`desenharPedidoNoPane`): já usa a frase longa.

## Para a V

Diff contra este plano e o delta da D: a frase por `propria` nas três faixas, as somas 133/106/85, o wrap a 40 colunas, a regex pegando `regua?.teto`, a revisão sem "linha acima" atual, nada fora de `plugins/painel-sessoes`, `test/reguas-de-contexto.test.mjs` e `docs/`.
