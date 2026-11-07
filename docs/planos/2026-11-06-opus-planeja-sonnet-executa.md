# Plano — F477 · Papéis e modelos: planejamento e documentação em Opus, execução em Sonnet

- Data: 2026-11-06
- Dona: sessão Opus (esforço alto), gatilho `decisao` (muda regra e trava)
- Decisão registrada em: [ADR 0036](../adr/0036-a-dona-planeja-em-opus-e-a-execucao-vai-ao-sonnet.md)

## O pedido (palavras do operador)
"quem escreve as specs é a dona né? planejamento e documentação tem que ser sempre opus. médio ou alto, depois muda pra sonnet pra executar e outras coisas que quiser usar o sonnet"

## Premissa conferida
- **Sim, quem escreve plano, ADR, SPEC, diário e roteiro é a dona** (ADR 0011). O briefing da orquestradora é só o pedido, as imagens e os fatos medidos; o desenho é da dona.
- **"Depois muda pra Sonnet" não pode ser a mesma sessão:** a sessão não troca o próprio modelo (ADR 0025). Sobram dois jeitos: outra sessão em Sonnet, ou um subagente Sonnet dentro da dona.
- **O subagente que escreve está proibido hoje.** A trava `subagente-nao-edita.mjs` recusa Edit/Write de subagente no projeto (regra "quem escreve é sessão", Q154; o executor saiu em 24/10, Q197). O F476 "delegou ao Sonnet" porque o subagente gravou **por Bash** (`python3 - <<EOF … open(p).write`), que a trava deixa de fora por desenho. Ou seja: a regra que o operador pede não cabe no kit sem mudar essa trava, e o que funcionou no F476 foi uma brecha, não um caminho.
- **A trava do `orca` hoje força o contrário do pedido:** dona em Sonnet passa; dona em Opus sem a linha `Gatilho do Opus:` é recusada (log: o F476 foi recusado uma vez antes de abrir em Opus médio com `gatilho=decisao`).

## Alternativas e recomendação
| Desenho | Custo | Risco |
|---|---|---|
| A. Dona Opus faz tudo; subagente só lê (o de antes do ADR 0025) | sem piso extra; toda chamada de execução em Opus e o contexto da dona cresce com cada saída de teste | não atende o "Sonnet pra executar" |
| B. Sessão Opus planeja; outra sessão Sonnet executa na mesma worktree | ~105 mil tokens de piso por item, mais o handoff; a orquestradora coordena duas sessões | quebra "uma dona do plano ao PR" (ADR 0011); a decisão que aparece na execução volta à orquestradora e vira terceira sessão |
| **C. Dona Opus planeja, documenta, revisa e commita; o código e os testes vão ao subagente `orquestracao:executor` (Sonnet, médio)** | ~33 mil de piso por delegação; a execução (a maior parte das chamadas) roda em Sonnet com contexto curto; a dona não carrega as saídas de teste | o subagente grava: precisa de cerca na trava (só a worktree da dona, nunca `docs/` nem `.md`), e a dona confere o diff antes do commit |

**Recomendo C.** Mantém uma dona por item, põe o Sonnet onde estão as chamadas (execução e testes) e o Opus onde está a decisão (plano, documentos, revisão do diff). Item pequeno (poucas edições, dentro do corte da via rápida) a dona escreve sozinha: o piso do subagente custaria mais que o trabalho.

## Escopo
1. **Trava do modelo da dona** (`hooks/titulo-da-dona.mjs`, usada também pela `hooks/trava-do-orca.mjs`):
   - dona: Opus, esforço `medium` passa sem linha; Opus `high` pede a linha `Esforço alto: <gatilho> — <motivo>` (a antiga `Gatilho do Opus:` vale como sinônimo); outro esforço é recusado; Sonnet, Haiku e modelo desconhecido são recusados com a sugestão `opus`/`medium`;
   - worker que não é dona (só no Orca): Sonnet e Haiku passam; Opus `medium` passa; Opus em outro esforço pede a linha;
   - sem texto legível do pedido: Opus `medium` passa (`passou-sem-ler-spec`); Opus em outro esforço é recusado (não há como ver a linha);
   - sugestão de comando corrigido: dona → `--model opus --effort medium`; worker → `sonnet`/`medium`.
2. **Exceção do executor** (`hooks/subagente-nao-edita.mjs`): o subagente `orquestracao:executor` (ou `executor`) grava Edit/Write só dentro da raiz do repositório da sessão (a pasta com `.git` mais próxima do `cwd`, pelo caminho real), fora de `docs/`, fora de `.claude/` e `.git/` e nunca em `.md`/`.mdx`; o resto é recusado com motivo próprio (`recusou-executor`); o liberado vai ao log (`liberado-executor`). A configuração das travas continua fechada para ele.
3. **O agente** `plugins/orquestracao/agents/executor.md`: Sonnet, esforço médio; cumpre o plano que a dona passou, teste antes do código, só os testes afetados pelo `com-fichas`, não commita, não empurra, não abre PR, não grava documentação; decisão fora do plano para e volta no relatório.
4. **A regra escrita:** skill `papeis-e-modelos`, `pool/dona.md`, `pool/protocolo.md#modelo-e-esforco`, `pool/anfitriao-orca.md`, skill `orquestradora`, `hooks/regras-globais.md` (o resumo do início), `docs/guia/ligar-e-desligar.md`. Inclui o briefing da orquestradora (só pedido, imagens, fatos medidos) e o `--setup skip` no `worker-start` de dona nova, com a nota de que `--setup`, `--name` e `--display-name` são recusados com `--worktree path:` (só valem com `new-child`/`new-top-level`; conferido no `--help` do `orca` em 06/11).
5. **ADR 0036** com `Alternativas consideradas`, substituindo a parte de modelos do ADR 0025; índice do README; diário.

## Fora do escopo
- O modelo do validador (ADR 0021) e o hook `modelo-do-validador.mjs`.
- O modelo da orquestradora (teste Q1096 em Sonnet até 13/11; decide-se depois, com ADR).
- Fechar a brecha do Bash na `subagente-nao-edita` (a trava não parseia shell por desenho; anotado no `depois`).
- Codex (sem política de modelos Claude).

## Critério de pronto
- Testes afetados verdes: `testes-afetados --padrao '…' -- node gate/com-fichas.mjs -- node --test` com `exit=0`, incluindo os novos casos de `titulo-da-dona`, `trava-do-orca`, `hooks-crewai` (executor) e os doc × trava da tabela.
- Teste vermelho antes do código para: dona Sonnet recusada; dona Opus médio sem linha passa; Opus alto sem linha recusado; executor grava `src/a.mjs` na própria worktree e é recusado em `docs/x.md`, em `a.md` e fora da worktree.
- Validador `orquestracao:validador` sem achado médio ou alto aberto.

## Regras que tocam o trabalho
- Node ≥ 20, ESM, sem dependência; testes em `node:test` pelo `com-fichas`, `HOME` temporário; `process.exitCode`.
- Commit conventional em PT-BR; PR sem subir versão; o gate completo é da fila.
- ADR imutável depois do merge: o 0025 não se edita, o índice marca a parte substituída.
