# F373 · O kit gasta menos com o validador e com a orquestradora acordada à toa

- Data: 2026-11-04 (pedido do operador, Q913)
- Dona: sessão `F373 · O kit gasta menos com validador e orquestradora`
- Decisão: [ADR 0021](../adr/0021-o-validador-escolhe-o-modelo-pelo-diff-e-a-dona-espera-no-turno.md)

<a id="premissas"></a>
## Premissas conferidas
Medido com `node scripts/custo-fixo.mjs --desde 2026-11-02 --ate 2026-11-05` (transcripts de `~/.claude/projects`, US$ pela tabela de preço de cada modelo; o tipo do subagente vem do `agent-*.meta.json`):

| Medida (02 a 04/11) | Valor |
|---|---|
| Gasto total | US$ 1.305 em 18,6 mil chamadas |
| Validador | 131 rodadas, US$ 234 (**18,0%** do total), US$ 1,79 por rodada |
| Validador em Opus | **128 de 131** rodadas (US$ 1,83 cada); Sonnet: 3 (US$ 0,19 cada) |
| Orquestradoras | US$ 197 (15,1% do total), contexto médio 264 mil por chamada |
| Turnos da orquestradora vindos do aviso de fim de turno | 300 de 517 (58%), US$ 67,6 (34% da orquestradora) |
| Desses, aviso só de dona esperando (teste, validador, crítico) | **87 turnos, US$ 19,2** (9,7% da orquestradora, **1,5% do total**) |

O que a medição muda no pedido:
- **A regra do validador em Sonnet já existia** (`protocolo.md#modelo-e-esforco` e a skill `papeis-e-modelos`: "`model: \"sonnet\"` para item mecânico"). Ela não é seguida: 98% das rodadas foram Opus. Mais texto não resolve; a escolha precisa sair da mão da dona.
- **O Sonnet economiza menos do que o preço de tabela sugere.** Sonnet 5.5 custa metade do Opus 5.5 na entrada, na saída e na escrita de cache, mas o mesmo na leitura de cache (US$ 0,20 por MTok), e a leitura é 35% do custo do validador. O mesmo uso em Sonnet custaria **33% menos** (US$ 157,7 contra US$ 233,9 nas 128 rodadas Opus).
- **O aviso de fim de turno não vem a cada turno da dona.** O app só acorda a orquestradora quando nenhuma sessão aberta por ela está trabalhando; com outra dona ativa, o aviso espera. Os 87 turnos são os que de fato custaram.
- **Todo subagente roda em segundo plano** (os 400 `meta.json` mais recentes têm `requestShape: "background"`): a dona que lança o validador e não tem mais nada a fazer termina o turno, e é esse fim que vira o aviso "o validador ainda roda".
- **Dá para esperar sem terminar o turno.** Medido nesta sessão: um Bash em primeiro plano com `until … sleep 3` sobre o `meta.json` do subagente segurou o turno 39 s e voltou quando o subagente terminou (o `"finished":true` aparece no fim). E a entrada do Stop hook traz `background_tasks` (doc dos hooks do Claude Code), que diz o que ainda roda.

<a id="escopo"></a>
## Escopo
1. `pool/via-rapida.mjs` devolve também `validador: sonnet|opus` pelo mesmo corte: contrato, trava, removido ou binário no diff → Opus; o resto → Sonnet; diff vazio → Opus.
2. A dona declara o risco do item uma vez (`"risco":true|false` no painel). Hook PreToolUse `modelo-do-validador.mjs` (matcher `Agent`): o `orquestracao:validador` lançado sem `model` ganha `model: "sonnet"` (`updatedInput`, aviso por `additionalContext`) só com `risco: false` e o corte dizendo Sonnet; item de risco ou diff com risco fica Opus; risco não declarado com diff limpo é recusado pedindo a declaração. `model` dado pela dona vale sempre; sessão sem item, erro ou base não achada não mexe. (A primeira versão decidia só pelo diff; a revisão mostrou que o risco fora dos globs cairia em Sonnet. O modelo da dona não serve de sinal: 129 de 133 rodadas vieram de dona Opus.)
3. Hook Stop `espera-no-turno.mjs`: a dona de item vivo com teste ou subagente em `background_tasks` é segurada **uma vez**, com o caminho para esperar no turno; a segunda tentativa passa; turno que pergunta ao operador passa.
4. `bin/esperar-fundo` (`pool/esperar-fundo.mjs`): segura o Bash até os subagentes da sessão terminarem (ou `--arquivo` existir), teto de 540 s, sai 3 se o teto passou.
5. `scripts/custo-fixo.mjs`: o medidor deste plano, para medir depois.
6. Regras: `protocolo.md` (`modelo-e-esforco`, `revisao`, seção nova `espera-no-turno`), `dona.md` (passos 4 e 5), skill `papeis-e-modelos`.

Fora do escopo: o esforço do validador (fica alto), a orquestradora ignorar o aviso de espera (o app manda o aviso; o kit não o filtra), a quota da compactação (Q912).

<a id="criterio"></a>
## Critério de pronto
- Testes afetados verdes: `via-rapida`, `modelo-do-validador`, `espera-no-turno`, `esperar-fundo`, `hooks-json`, `bin`, `custo-fixo`.
- O PR traz a medição de antes (a tabela acima) e o comando de depois.

<a id="efeito-esperado"></a>
## Efeito esperado e como medir depois
- **Validador:** cada rodada que o hook põe em Sonnet custa ~33% menos. Quantas vão depende de quantos itens as donas declaram sem risco. Neste repositório quase todo item toca hook, protocolo ou agente e fica em Opus; o ganho vem dos projetos com diff de código comum. Se metade das rodadas for a Sonnet, o validador cai ~16% (~3% do total).
- **Orquestradora:** o teto do ganho é o custo medido dos avisos de espera, 1,5% do total (US$ 19 em 3 dias). A dona não gasta mais: a chamada de `esperar-fundo` substitui o fim de turno e a volta pela notificação.
- **Medir depois** (uma semana de uso depois do merge e da atualização dos plugins, com a data de corte do merge):

```bash
node scripts/custo-fixo.mjs --desde <data do merge>
```

Comparar com a tabela acima: a linha `sonnet:` do validador (rodadas e custo por rodada) e `eventos só de dona esperando` (turnos e % da orquestradora). O log dos hooks diz quantas vezes cada um agiu: `grep -c 'modelo-do-validador\tsonnet' ~/.claude/orquestracao/hooks-crewai.log` e `grep -c 'espera-no-turno\tsegurou' ~/.claude/orquestracao/hooks-crewai.log`.
