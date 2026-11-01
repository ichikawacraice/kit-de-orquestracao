# F294 · O registro ganha o que o piloto WiControl pediu

Origem: a proposta do F293 (piloto WiControl), aprovada pelo operador em Q710 (31/10/2026).

## Escopo
1. **Confirmação assíncrona.** O `useConfirm` ganha `onConfirmar: () => Promise<void>`. Com ele, a ação roda com o diálogo aberto: o botão fica "rodando" com `rotuloRodando` (sem reticências, CTRL-07); Esc, clique fora, X, Cancelar e a alternativa ficam travados; a falha aparece no próprio diálogo em `role="alert"` (MSG-04), e o diálogo segue aberto para tentar de novo. É a mesma peça (PECA-01: uma função, uma peça), não um segundo diálogo.
2. **Conserto do `link-do-app`.** Ele passa no eslint do template Vite: `componente` tipado sem `any`; a exceção do `react-hooks/static-components` vai comentada na peça.
3. **As lacunas sem peça**, julgadas contra a base:

| pedido (shadcn) | veredito | por quê (base) |
|---|---|---|
| checkbox | **entra** `checkbox` | marcar itens numa lista (EST-03) e o sim/não de formulário não têm peça; parte do `checkbox` do shadcn (PECA-02) |
| progress | **entra** `progress` | PECA-01 nomeia `Progress` (progresso de etapa); o indicador leva o gradiente (MARCA-03) |
| medidor | **entra** `medidor` | PECA-01 nomeia `Medidor` (número contra teto, ARQ-02); "não use barra de progresso para cota" |
| badge | **entra** `badge` | PECA-01 e CTRL-05 nomeiam `Badge` (valor rotulado, neutro ou `marca`), com o casco do carimbo |
| loading-overlay | **entra** `carregando-por-cima` | PECA-01 e MSG-01 nomeiam `CarregandoPorCima` (troca de contexto, a partir de 120ms) |
| status-alert | **entra** `faixa` | MSG-01, MSG-02 e MSG-06 descrevem a faixa (uma por tela, a saída nela); PECA-02 a faz partir do `Alert` |
| sheet | nota: `DialogLateral` | PECA-01 "coluna lateral sob demanda" |
| tabs | nota: `seletor-de-vista` (`BarraDeModos densidade="abas"`) | CTRL-06, PECA-01 "troca de vista" |
| hover-card | nota: `Popover` (detalhe) ou `DicaDeAjuda` (ajuda) | PECA-01; hover como pista só na barra recolhida (CTRL-08) |
| scroll-area | nota: `RolagemDoPainel` | LAY-01, LAY-06 |
| command | nota: `Select` por enquanto; o combobox com busca é fatia nova | a base não tem a função "escolher numa lista longa com busca"; pede regra antes da peça e uma dependência nova (`cmdk`) |

As notas entram na tabela do README do registro (pelo nome do shadcn) e na coluna "Não use" da PECA-01.

## Base
PECA-01 ganha as linhas do `Checkbox` e da `Faixa` (que deixa de ser só do Editor) e o nome do shadcn na coluna "Não use" das linhas com equivalente; MSG-01 cita a `Faixa`. A base sobe a **0.5.0** (MINOR: peça nova), com entrada no `CHANGELOG.md` e a linha de rastreio da PECA-01.

## Fora do escopo (fatia nova, se o operador quiser)
- O que a proposta trouxe da fatia 3 do WiControl: o `casco` instalar o exemplo do Next, o `tema={false}` da `BarraLateral`, o bloco `CascoPublico`, o `PaginaDoApp largura="leitura"`, o slot de estado do `CabecalhoDoApp`, os `import * as React` sem uso e o aviso do `menu.tsx`.
- `LinhaDeAndamento`, `Medidas` e `PontoDaEtapa`, que a PECA-01 nomeia e o registro ainda não tem.
- O combobox com busca.

## Critério de pronto
- Cada peça nova no `lib/itens.mjs`, com teste dom e demonstração no ateliê; o `registry.json` regenerado.
- O `useConfirm` com `onConfirmar` coberto em teste: rodando, Esc e clique fora travados, erro no diálogo, nova tentativa e sucesso que fecha.
- O `link-do-app` sem aviso no eslint do template Vite (conferido com a configuração do template).
- Revisão de arquitetura gravada em `docs/design/revisoes/`; crítica com nota de pelo menos 24/30.
- `npm test` verde.
