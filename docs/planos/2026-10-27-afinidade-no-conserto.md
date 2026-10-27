# F170 · Afinidade não se perde quando o item volta para conserto — plano (P6, 27/10)

Copie este arquivo para `docs/planos/2026-10-27-afinidade-no-conserto.md` no PR. Branch nova a partir da `main` atual (5f1c2f1 ou mais nova).

## O que acontece hoje (medido lendo a main 5f1c2f1)
O conserto é o item voltar de `validacao` para `execucao` (visto no `historico` de F117, F140, F143, F32, F34, F36, F37). A afinidade do ADR 0009 se perde nos dois caminhos que a usam:
1. **`painel seguinte`** (`skills/orquestradora/scripts/painel.mjs`, `comandoSeguinte`, perto da linha 879): pula **todo** item cujo `passaram` tem esta sessão (`continue`, com o comentário "já passou por ele: a V sai sem `--fez`…"). A E que fez o item e volta a ele para o conserto nunca o recebe pelo `seguinte`, e a V que fez a 1ª rodada nunca recebe a revalidação, que é justamente onde a conversa dela vale mais.
2. **`afimDe`** (`skills/orquestradora/scripts/batida.mjs`, linha ~57): começa o laço com `if (d === item …) continue`. Só os **outros** itens do tema contam. Quem passou pelo **próprio** item não é afim dele. No conserto, a batida avisa o livre mais antigo ou um afim de outro item, e não a E que tem a conversa. Isso contraria o protocolo ("o conserto vai ao primeiro do `fez` daquela parte que está livre").

O que o pulo do `seguinte` quer evitar continua valendo: a V que saiu sem `--fez` não deve repegar o item **na mesma rodada**, porque o item segue em `validacao` esperando outra V.

## Decisão (assumida, a confirmar)
- **"Já passou" passa a valer por rodada.** O `seguinte` só pula o item se a passagem desta sessão é **da etapa atual**: `passaram.em` ≥ a entrada do item na etapa em que ele está. Passagem de antes da entrada (outra rodada) não pula.
- **O próprio item conta na afinidade e vem primeiro.** No `afimDe`, quem passou pelo próprio item com o papel pedido, com sessão viva e o mesmo apelido no título, ganha de quem passou por outro item do tema. Entre os do próprio item, vence o mais recente. Sem nenhum, segue a regra de hoje.
- Sem ADR novo: é o que o ADR 0009 já decide ("o membro afim chega ao item com o contexto"). O conserto só não estava coberto. Registre no plano copiado para `docs/planos/`.

## Passos
1. **Testes primeiro** em `plugins/orquestracao/hooks/tests/painel-batida.test.mjs`, perto dos de F143, com o mesmo molde dos testes existentes de `seguinte` e `afimDe`:
   a. `seguinte` no conserto: item F1, tema X, `historico` planejamento→execucao→validacao→**execucao** (a última entrada depois do `passaram` da E3), `passaram` com E3 antes dessa entrada → `painel seguinte <lid3> E3 --tokens 100000` devolve `pegou:true, item:'F1'`. Hoje dá `pegou:false`: confira que falha por isso.
   b. `seguinte` na mesma rodada: item em `validacao`, `passaram` com V3 **depois** da entrada em validacao, V3 fora do `com` → `pegou:false` (o comportamento que o pulo protege continua). Prove antes que o item está esperando V (`esperandoPapel` não nulo), para o teste não passar por outro motivo.
   c. `seguinte` na revalidação: o mesmo item depois de voltar a `validacao` (nova entrada depois da passagem da V3) → V3 pega.
   d. `afimDe` do próprio item: F1 em execucao (conserto) com E3 no `passaram` de F1, e E5 com passagem **mais recente** em F2 do mesmo tema; as duas sessões vivas e livres → `afimDe(F1,'E',…)` é E3. Hoje dá E5 ou null.
   e. `afimDe` sem ninguém do próprio item: segue escolhendo o mais recente dos outros itens (os testes antigos de F143 continuam verdes sem mudança).
   f. A batida no conserto: com E3 livre no `fez`/`passaram` de F1 e outra E livre mais antiga, a mensagem `avisar-livre` de F1 vai para E3.
2. **Entrada na etapa num lugar só.** Em `plugins/orquestracao/hooks/esperando-papel.mjs`, extraia o cálculo que já existe ("a primeira entrada da sequência final do `historico` com essa etapa", com o recuo para `atualizadoEm` sem histórico) para `export function entradaNaEtapa(data)` → ms ou null. `esperandoPapel` passa a usá-lo sem mudar o resultado. `esperando-concorda.test.mjs` compara só `esperandoPapel` com a cópia do pane (`plugins/painel-sessoes/hooks/esperando.ts`). Como o resultado não muda, a cópia não precisa mudar; rode o teste para confirmar.
3. **`comandoSeguinte`:** troque o pulo por `passaram` desta sessão com `Date.parse(p.em) >= entradaNaEtapa(d)` (se a entrada for null, pula como hoje). Reescreva o comentário dizendo "na mesma rodada". `painel.mjs` já importa de `hooks/` (veja como `esperandoPapel` é carregado, linha ~87): siga o mesmo caminho e só nos comandos que já o carregam (`DA_BATIDA`).
4. **`afimDe`:** antes do laço dos outros itens, procure no `passaram` do próprio item (item antigo sem `passaram`: `fez`, como já é feito para os outros) a entrada do papel pedido mais recente cuja sessão está viva e com o mesmo apelido. Achou: devolva. Senão, siga o laço atual, que continua pulando `d === item`. Atualize o comentário acima da função.
5. Cabeçalho do `painel.mjs` (linha do `seguinte`): acrescente "pula o item só se a sessão já passou por ele nesta etapa".
6. `docs/adr/0009-*`: **não edite** (ADR mergeado é imutável). Se o índice ou a skill `papeis-e-modelos`/`orquestradora` descreverem o `seguinte` como "nunca repega item por onde passou", ajuste essa frase. Procure com `grep -rn "seguinte" plugins/orquestracao/skills`.
7. Suba `version` em `plugins/orquestracao/.claude-plugin/plugin.json` em um patch sobre a main. Se `test/cli.test.mjs` fixar a versão, ajuste-o também (o F167 precisou).
8. Gate: `npm test`; `claude plugin validate plugins/orquestracao --strict`.

## Pronto quando
- Os testes a, c, d e f falharam antes dos passos 3 e 4 pelo motivo certo (cole a saída vermelha no PR) e passam depois; b e e passam antes e depois.
- `esperando-concorda.test.mjs` verde sem mexer no `.ts` do pane.
- Gate verde; PR para `main` com o plano em `docs/planos/`.

## Fora de escopo
- Mudar a regra dos 20 min (`BATIDA_AFINIDADE_MIN`), o teto de contexto do `seguinte` e o que conta como "mesmo tema".
- Fazer o `painel` despachar o conserto sozinho: a dona continua mandando o conserto (protocolo). Aqui só a batida e o `seguinte` deixam de errar o afim.
- Gravar `passaram` em outros comandos.

## Regras do projeto
Node ≥ 20, ESM, só módulos nativos; `node:test` pelo gate (`node gate/com-fichas.mjs -- …` para rodar isolado); `process.exitCode`, nunca `process.exit()`; teste nunca toca `~/.claude` real (`PAINEL_DIR` e `HOME` temporários, como os testes vizinhos); filho de teste síncrono com `timeout` e `killSignal: 'SIGKILL'`; teste que mede ausência prova antes que a presença seria detectada (caso b); commit conventional em PT-BR (`fix(pool): …`), sem citar ADR no título.

## Resultado da execução (E3)
- Testes a, c, d falharam antes do conserto (a e c por `pegou:false`, d por `afimDe` pular o próprio item); b e e passam antes e depois.
- **Desvio do plano em f:** a batida de produção já escolhia a E que fez o item, porque `todos` vem de `itensDaFila()` (objetos diferentes de `itens`) e o `d === item` nunca batia. Só a chamada pura de `afimDe` com o mesmo objeto errava. O teste f fica como regressão (verde antes e depois); o conserto de `afimDe` torna o resultado independente dessa identidade de objeto.
- `entradaNaEtapa` extraída em `hooks/esperando-papel.mjs`; `esperando-concorda.test.mjs` verde sem tocar o `.ts` do pane.
