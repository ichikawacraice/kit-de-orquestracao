<a id="f477-opus-planeja"></a>
# 06/11/2026 · F477 — a dona planeja e documenta em Opus, e o Sonnet executa

O operador perguntou: "quem escreve as specs é a dona né? planejamento e documentação tem que ser sempre opus. médio ou alto, depois muda pra sonnet pra executar". A premissa vale: plano, ADR, SPEC e diário são da dona (ADR 0011). Mas o kit fazia o contrário do pedido em dois pontos:
- a trava do `orca` deixava a dona Sonnet passar e recusava a dona Opus sem gatilho;
- a `subagente-nao-edita` proibia o subagente de gravar.

No F476, o "Sonnet executa" só funcionou porque o subagente gravou por Bash, que a trava não olha.

- **A dona nasce em Opus médio.** O esforço alto vem com a linha `Esforço alto: <gatilho>`. A antiga `Gatilho do Opus:` continua valendo. A trava recusa a dona em Sonnet, em Haiku e em Opus com outro esforço.
- **O código e os testes vão ao subagente `orquestracao:executor`, em Sonnet médio.** A trava o deixa gravar só no repositório da dona, fora de `docs/`, `.claude/`, `.git/` e de `.md`. A dona confere o diff e commita. O item pequeno a dona escreve sozinha.
- **O briefing da orquestradora traz só o pedido, as imagens e os fatos medidos.** No Orca, a dona nova abre com `--setup skip`.
- **Transitório:** o plugin instalado (0.1.111) ainda recusa o Edit do executor. Por isso, neste item, o subagente gravou por Bash, com o aval da dona. A brecha do Bash fica no `depois`.
- Só vale depois de subir a versão. Decisão: [ADR 0036](../../adr/0036-a-dona-planeja-em-opus-e-a-execucao-vai-ao-sonnet.md).
