# Linha de base da orquestração: semana de 29/10 a 05/11/2026

Snapshot (não se edita), saída de `node scripts/medir-semana.mjs --desde 2026-10-29 --ate 2026-11-05 --projeto izanagi=Izanagi --projeto wicontrol=WiControl` em 05/11/2026 (SP). É a base das fases 1 a 3 de [o diagnóstico](2026-11-05-diagnostico-orquestracao.md#plano). Para medir de novo, rode o mesmo comando com outra janela e compare.

Limites: "item fechado" é o item com PR mergeado na janela, mesmo que ele continue em outra fatia; o custo do item soma todas as chamadas da sessão dona e dos subagentes dela (não só as da janela); PR sem `F<n>` no título ou na branch fica fora do custo por item.

Janela: 2026-10-29T03:00:00.000Z a 2026-11-06T03:00:00.000Z (fim exclusivo). Total: 67890 chamadas, US$ 4726.00, 11483.2 M de tokens.

## Por papel

| papel | sessões | chamadas | cache lido | cache escrito | entrada+saída | US$ | fatia |
|---|---|---|---|---|---|---|---|
| orquestradora | 28 | 6112 | 1280.3 M | 20.0 M | 2.5 M | US$ 465.55 | 9.9% |
| ↳ opus |  | 6112 | 1280.3 M | 20.0 M | 2.5 M | US$ 465.55 | 100.0% do papel |
| dona | 265 | 36607 | 7526.7 M | 109.2 M | 22.9 M | US$ 2827.93 | 59.8% |
| ↳ opus |  | 36199 | 7475.4 M | 107.8 M | 22.7 M | US$ 2810.12 | 99.4% do papel |
| ↳ sonnet |  | 408 | 51.2 M | 1.4 M | 0.2 M | US$ 17.81 | 0.6% do papel |
| avulsa | 8 | 497 | 66.6 M | 1.7 M | 0.3 M | US$ 31.89 | 0.7% |
| ↳ opus |  | 496 | 66.5 M | 1.7 M | 0.3 M | US$ 31.88 | 100.0% do papel |
| ↳ haiku |  | 1 | 0.0 M | 0.0 M | 0.0 M | US$ 0.01 | 0.0% do papel |
| subagente | – | 24674 | 2322.7 M | 109.3 M | 21.1 M | US$ 1400.63 | 29.6% |
| ↳ opus |  | 23817 | 2265.8 M | 103.9 M | 20.4 M | US$ 1379.53 | 98.5% do papel |
| ↳ haiku |  | 254 | 15.1 M | 2.3 M | 0.3 M | US$ 0.57 | 0.0% do papel |
| ↳ sonnet |  | 603 | 41.8 M | 3.1 M | 0.4 M | US$ 20.53 | 1.5% do papel |

Subagentes por tipo:

| tipo | rodadas | chamadas | US$ |
|---|---|---|---|
| orquestracao:validador | 442 | 15246 | US$ 769.25 |
| critico-de-ui | 187 | 3485 | US$ 216.77 |
| general-purpose | 28 | 1221 | US$ 116.83 |
| designer | 43 | 1521 | US$ 115.21 |
| design:designer | 10 | 465 | US$ 44.65 |
| design:critico-de-ui | 32 | 765 | US$ 42.98 |
| design-system:critico-de-ui | 30 | 683 | US$ 34.59 |
| design-system:designer | 12 | 426 | US$ 30.42 |
| Explore | 12 | 490 | US$ 22.78 |
| claude | 2 | 63 | US$ 4.07 |
| orquestracao:explorador | 24 | 256 | US$ 1.66 |
| kit-performance:revisor-de-performance | 2 | 17 | US$ 1.26 |
| claude-code-guide | 6 | 36 | US$ 0.15 |

## Custo por item fechado

142 itens fechados (PR mergeado na janela); 51 PRs sem item no título ou na branch; 3 itens sem sessão achada. Custo do item = dona + os subagentes dela, em todas as chamadas da sessão.

- mediana: US$ 11.10
- p90: US$ 73.85
- total dos itens: US$ 4222.26 (139 com custo)

Os 15 itens mais caros (a lista inteira está no `--json`):

| projeto | item | PRs | US$ | aberto→1º PR | 1º PR→último merge |
|---|---|---|---|---|---|
| izanagi | F358 | 22 | US$ 288.25 | 73 min | 50.1 h |
| izanagi | F364 | 18 | US$ 254.45 | 13 min | 25.1 h |
| izanagi | F317 | 13 | US$ 246.72 | 25 min | 18.6 h |
| izanagi | F248 | 18 | US$ 237.74 | 15 min | 53.2 h |
| izanagi | F245 | 16 | US$ 230.93 | 32 min | 19.6 h |
| wicontrol | F293 | 15 | US$ 223.49 | 7 min | 21.0 h |
| izanagi | F359 | 23 | US$ 182.79 | 22 min | 31.1 h |
| izanagi | F233 | 15 | US$ 157.20 | 44 min | 11.0 h |
| izanagi | F247 | 8 | US$ 151.06 | 16 min | 20.9 h |
| izanagi | F230 | 10 | US$ 133.23 | 41 min | 7.5 h |
| izanagi | F366 | 13 | US$ 127.00 | 27 min | 15.3 h |
| izanagi | F285 | 10 | US$ 101.89 | 30 min | 33.6 h |
| izanagi | F361 | 9 | US$ 90.17 | 15 min | 26.8 h |
| izanagi | F223 | 7 | US$ 73.85 | 109 min | 7.6 h |
| izanagi | F312 | 7 | US$ 71.90 | 43 min | 13.8 h |

## Turnos extras de trava

1315 turnos abertos por `Stop hook feedback`, US$ 231.09.

| hook | turnos | US$ |
|---|---|---|
| criterio-da-dona | 568 | US$ 100.77 |
| contexto-do-papel | 232 | US$ 48.60 |
| critico-de-ui | 184 | US$ 7.47 |
| fila-do-item | 115 | US$ 21.38 |
| espera-no-turno | 94 | US$ 36.42 |
| painel-das-sessoes | 88 | US$ 11.08 |
| perguntas-da-sessao | 14 | US$ 1.12 |
| sem-dona | 10 | US$ 2.07 |
| batida | 6 | US$ 1.51 |
| operador-ausente | 4 | US$ 0.68 |

Por papel: dona 1279, orquestradora 31, avulsa 5.

## Tempo até o merge

| etapa | itens | mediana | p90 |
|---|---|---|---|
| cada PR: aberto → merge | 444 | 9 min | 49 min |
| item: aberto → 1º PR | 138 | 29 min | 109 min |
| item: 1º PR → último merge | 142 | 14 min | 10.6 h |
| item: aberto → último merge | 139 | 67 min | 14.6 h |

Cada PR por projeto: kit 4 min (p90 30 min, 53 PRs); izanagi 11 min (p90 63 min, 333 PRs); wicontrol 1 min (p90 10 min, 58 PRs).

## Piso da sessão (1ª chamada)

- subagente: mediana 32.4 mil tokens em 832 sessões; maiores fontes: claude-md-projeto 9.4 mil, memoria 5.3 mil, claude-md-global 3.4 mil
- principal: mediana 104.7 mil tokens em 321 sessões; maiores fontes: ferramentas:nativas 16.1 mil, system-prompt 13.8 mil, ferramentas:Artifact 13.6 mil
