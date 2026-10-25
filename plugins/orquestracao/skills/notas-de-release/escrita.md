# Como escrever as notas

Quem lê é quem **usa** o produto, não quem o programa. A pergunta de cada item é sempre: *o que mudou para mim?*

## Regras

1. **Uma linha por mudança**, com o verbo no presente: *"O botão X passa a…"*, *"A tela Y mostra…"*.
2. **Escreva o efeito, nunca o mecanismo.** Nada de arquivo, função, tabela, coluna, rota, flag ou nome de variável. *"O plano do job deixa de ser gravado no repositório da loja"*, e não *"`plan.json` sai do `.izanagi/`"*.
3. **Nunca invente.** Use o título do PR e o caso (`caso` no JSON do `coletar.mjs`). Se o caso não diz o que muda para quem usa, o item vai para *Bastidores* com o título reescrito em português comum. Nunca escreva uma novidade imaginada.
4. **Junte o que entrega a mesma coisa:** PRs que são o mesmo trabalho (a feature e o conserto do teste dela) viram **um** item, `(#a, #b)`.
5. **Classifique pelo efeito, não pelo prefixo.** O prefixo sugere: `feat` → Novidades, `fix` → Correções, `docs`/`chore`/`test`/`ci`/`refactor`/`perf` → Bastidores. Mas quem decide é a tela: um `fix` que ninguém vê é Bastidores, e um `feat` de infra também.
6. **O `resumo`** nomeia as **duas** mudanças que mais importam para quem usa, numa linha de até 140 caracteres. Sem "várias melhorias", sem "e outras correções".
7. **Glossário do adaptador:** use as palavras que a tela usa (o adaptador lista as de cada produto).
8. **O que o adaptador proíbe não entra**, nem disfarçado: quando o caso cita uma loja, escreva *"numa loja"* ou *"numa loja Wake"*.
9. **Sem citação de documento interno** (`SPEC-`, `ADR`, `§`) e sem emoji.
10. **Português de quem está de fora:** termo técnico só quando a tela usa (job, deploy); senão, traduza.

## Pares ruim → bom

| Ruim | Bom |
|---|---|
| feat(runner,adapters): a foto de produto da Wake pede 1,5x o exibido em 1920 | A foto de produto das lojas Wake passa a ser pedida no tamanho em que aparece numa tela grande, e a conferência mede o resultado. |
| fix(web): o aprovar diz "assim mesmo" só quando há algo contra | O botão de aprovar só diz "assim mesmo" quando há de fato algo contra a aprovação. |
| feat(runner,web): o plano e as convenções do job saem do repositório do cliente | O plano e as anotações de cada job deixam de ser gravados no repositório da loja e ficam guardados no painel. |
| fix(runner): o teste do plano guardado no banco local mede o booleano de verdade | (vai junto do item acima, como `(#773, #774)`, porque é o conserto do teste dele) |

## Antes de gravar

- [ ] O adaptador foi lido inteiro, e nada do que ele proíbe aparece no texto.
- [ ] Cada PR do JSON está em exatamente um item.
- [ ] Nenhum item fala de arquivo, função ou tabela.
- [ ] `node scripts/validar.mjs <pasta>` está verde.
