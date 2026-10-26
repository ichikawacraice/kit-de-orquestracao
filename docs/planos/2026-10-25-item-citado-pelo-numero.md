# Plano — o painel diz o que é cada item citado pelo número (F43)

- **Data:** 2026-10-25 · **Autora:** P1 (planejadora do pool)
- **Estado:** decisão de tela tomada; vai à D1 (desenho) e, a parte de texto, direto à execução
- **Pedido do operador:** *"estou sentindo falta de uma lista das F. A orquestradora lá do Izanagi fala de F13, mas eu não sei qual é a F13; 'iniciar depois da F13' — o painel não me informa quem é F13. Veja a melhor forma de informar isso, ou informar cada fatia da tarefa como um todo, mostrar junto ou mostrar separado"*.

## Medido (2026-10-25)

- **O pane não mostra o número de item nenhum.** `cartaoSvg` (`plugins/painel-sessoes/hooks/desenho.ts:557`), `filaSvg` (`:656`) e `itemSvg` (`:332`) desenham tema, título, chips, quem, agora e depois; nenhum usa `item.id`. O `id` só entra como `key` do React (`register.tsx:804`, `:819`, `:929`). Já o protocolo afirma o contrário: *"o pane já mostra o número e os PRs"* (`plugins/orquestracao/pool/protocolo.md:26`) — e a mensagem de recusa do título repete isso (`skills/orquestradora/scripts/painel.mjs:235`). **É a raiz:** a regra que proíbe `F<n>` no título partiu de um número que o pane nunca desenhou.
- **A fila tem 43 itens:** 41 do Izanagi, 2 do kit. Vivos: F13 (execução), F42, F43, F44 (planejamento); os outros 39 estão `feito`. O rodapé "Feitos hoje" só mostra as últimas 24 h (`FEITOS_MS`, `register.tsx:148`), então um número antigo citado numa mensagem não tem onde ser achado no pane.
- **Perguntas:** 23 de 223 citam `F<n>` no texto; as recentes citam solto — Q252 (*"Não disputa arquivo com o F13"*), Q257 (*"executora do F13"*), Q246 (*"Só o F41 segue vivo"*). O campo `item` da pergunta existe e é usado (Q238, Q239 → F34), mas o texto cita outros itens sem dizer o que são.
- **"Fatias" não são itens.** Nenhum item aponta para uma tarefa-mãe. A fatia mora **dentro do título** de um item (F1 *"fatias 1 a 8 do editor"*, F13 *"SPEC-155 fatia 2 … e fatia 5"*) ou no `depois` em texto (F13: *"fatia 7: produção …"*). `depois[].item` aparece só 2 vezes em 43 (F21→F22, F7→F3). O agrupamento que existe e é preenchido em todo item é o **tema** (`editor` tem 11 itens, `orquestracao` 15, `gate` 5).
- **Linha da sessão** (`sessoes/*.etapa`) também cita solto: `"F13: mede o estado e replaneja"`. Ela não aparece no pane (F27), mas aparece no relatório da orquestradora.

## Decisão

### (a) O que o pane mostra

1. **Todo item mostra o próprio número**, colado ao tema, no cartão de Executando e de Travados, no cartão compacto de Esperam você, na linha de Na fila e nos feitos: `F13 · EDITOR`. É a ponte entre a mensagem ("F13") e o cartão. Algarismos tabulares, mesmo tom do tema (`m`), sem cor nova.
2. **Número citado dentro do pane vem resolvido.**
   - `depois[].item` preenchido → a linha "depois" mostra `F22 · <título do F22>`.
   - Texto livre que cita `F<n>` solto (`agora`, `trava.texto`, `espera.texto`, `depois[].texto`, e o `titulo`/`caso`/`recomendacao` da pergunta) → uma linha **"Citados:"** sob o bloco, com `F13 · <título>` de cada número achado (até 2, depois `+N`), resolvida pela fila que o pane já leu. Número que não está na fila → `F99 · fora da fila`. *Recomendação da P1:* legenda em vez de expandir no meio do texto, porque expandir dobra a linha a 300 px e o `agora` já é cortado em 2 linhas. **A forma é da D1.**
3. **Lista de todos os itens:** terceiro botão do rodapé, `▸ Todos os itens · 43`, ao lado de "Feitos hoje" e "Perguntas respondidas". Abre uma lista compacta, **agrupada por tema** (ordem de `temas.json`; rótulo `Tema · projeto` quando dois projetos repetem o rótulo, como `porTema` já faz), uma linha por item: `F13 · título · etapa`. Dentro do tema, os vivos primeiro e depois os fechados (feito em tom apagado, descartado no fim), cada bloco do número maior para o menor. Responde "quem é F13" para qualquer número, inclusive feito há uma semana.
4. **"Fatias da tarefa" = tema.** A lista do item 3 é a visão "junto": tudo do mesmo assunto em um bloco. Não se cria campo `parteDe`/tarefa-mãe agora (*assumida, a confirmar*): a medição mostra que ninguém preenche vínculo entre itens (2 de 43), e um campo novo sem quem o grave vira coluna vazia. Se o operador quiser a SPEC com as fatias numeradas, é item próprio.
5. **Terminal:** o desenho em texto ganha o mesmo número no começo da linha do item, a mesma linha "Citados:" e o mesmo terceiro botão.

### (b) A regra de texto

1. **Ao citar um item a quem lê de fora (operador, painel, relatório), a primeira menção é `F13 · <título>`** — o título do item, tirado de `painel get fila F13`, podendo ser encurtado sem trocar o sentido. As menções seguintes na mesma mensagem podem ser só `F13`. Vale para mensagem de fim de turno, relatório da orquestradora, pergunta (Q-ID), `agora`, `depois[].texto`, `trava`/`espera`, `sessoes.etapa`. Mensagem **entre sessões** fica livre (as duas têm o painel).
2. **O `painel` recusa pergunta com `F<n>` solto** nos campos `titulo`, `caso`, `seNaoDecidir` e `recomendacao`: todo `\bF\d+\b` precisa vir seguido de ` · `. Motivo: a pergunta é o texto que o operador lê para decidir, e é onde o defeito apareceu (Q252, Q257). Mesmo limite conhecido do título: a tecla F5 se descreve por extenso. Os campos da fila não ganham trava (*assumida, a confirmar*): o pane resolve o número pela linha "Citados:".
3. **Corrigir a afirmação falsa** do protocolo (`protocolo.md:26`) e da recusa do título (`painel.mjs:235`): passam a dizer "o pane mostra o número ao lado do tema" (verdade depois do item a.1).

## Fatias da execução

| Parte | Quem | Depende de | Arquivos |
|---|---|---|---|
| **A — pane** | D1 desenha (revisão de arquitetura + mock nos estados), depois uma E | — | `plugins/painel-sessoes/hooks/desenho.ts`, `register.tsx`, `tests/painel.test.tsx`, `tests/fixtura-fila.ts`; doc da D1 em `docs/design/` |
| **B — regra de texto e validação** | uma E, já | nada (não toca tela) | `plugins/orquestracao/skills/orquestradora/scripts/painel.mjs`, `hooks/tests/painel-validacao.test.mjs`, `pool/protocolo.md` (§26 e §80), `skills/orquestradora/SKILL.md` (seção do relatório e das perguntas) |

As duas não tocam os mesmos arquivos e podem correr ao mesmo tempo.

### Critério de pronto

- **A:** com a fixtura de 43 itens, todo cartão, linha de fila e feito traz `F<n>` (teste que acha o número de cada item no `alt`, e que antes confirma que a fixtura não está vazia); `depois` com `item` mostra o título do citado; texto com `F13` solto gera "Citados: F13 · <título>"; número fora da fila gera "fora da fila"; o botão "Todos os itens · N" abre os 43 agrupados por tema, vivos antes dos fechados; nota da crítica ≥ 24/30 sem ressalva alta (teto Q207); `claude plugin test plugins/painel-sessoes` verde.
- **B:** teste vermelho antes (pergunta com "executora do F13" é aceita hoje), verde depois; aceita "F13 · SPEC-155 fatia 2"; a recusa diz o campo e o número; `npm test` verde; protocolo e skill citam a regra em uma frase cada e um teste compara a regex da recusa com o exemplo do protocolo (regra "duas coisas que devem concordar").

### Fora de escopo

- Campo de tarefa-mãe / SPEC com fatias (item próprio, se o operador pedir).
- Trava em mensagem de fim de turno (texto do assistente; não há onde validar sem hook de Stop caro).
- Reescrever as perguntas e itens antigos que citam número solto.
- O `CLAUDE.md` global do operador (fora do repositório; nada aqui grava em `~/.claude/`).

## Decisões assumidas, a confirmar

- **D-a2:** legenda "Citados:" em vez de expandir o número no meio do texto — se o operador preferir dentro do texto, a D1 troca o desenho; custo baixo.
- **D-a4:** sem campo de tarefa-mãe; o tema agrupa. Se não decidir: fica o tema. Recomendação: assim, porque ninguém preenche vínculo hoje.
- **D-b2:** só a pergunta ganha trava de escrita; a fila não. Se não decidir: fica assim. Recomendação: assim, porque o pane já resolve o número da fila e a trava extra quebraria gravações de hooks que citam itens no `agora`.
