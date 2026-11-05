# Revisão de arquitetura — o estado deduzido no pane (F425)

- **Data:** 2026-11-05 (SP)
- **Autora:** designer do F425
- **Estado:** proposta, antes da crítica.
- **Plano de origem:** [`docs/planos/2026-11-05-pane-estado-deduzido.md`](../../planos/2026-11-05-pane-estado-deduzido.md). O que a batida deduz e grava é do ADR 0027 e de `estado-deduzido.mjs`; esta revisão decide só onde e como o pane o mostra.
- **Fontes lidas:** o plano; o ADR 0027; `estado-deduzido.mjs` (`deduzir`) e `batida.mjs` (`julgar`: como o `parado` é usado); `desenho.ts` (`CSS`, `cartaoSvg`, `filaSvg`, `chipDaEtapa`, `chipDoPr`, `linhaQuem`, `tempoDoItem`, `desde`, `seloDaEspera`, `textoEsperando`); `register.tsx` (`montarTodos`, `contarSecoes`, `secoes`, `situacaoDe`, `cartao`, `linhaDaFila`, `linhaItem` do terminal, a composição das seções). O repositório não tem `design/design-system.json`: valem as revisões anteriores do pane e os comentários de `desenho.ts`. A base do plugin entra só como referência citada (PRIN-04, PESO-02, COR-03, COR-04, MSG-05).

## Tarefa
O operador olha o pane e sabe, de cada item vivo, em que etapa ele está de fato, qual PR está ligado (aberto ou já mergeado) e se está parado há tempo demais. A fila de perguntas de "Esperam você" continua como está.

## Quem e onde
- **Quem:** o operador, sozinho. Lê o pane várias vezes por hora, entre uma conversa e outra.
- **Onde:** a coluna do desktop (W 288 é o pior caso, 360 a referência; o cartão desenha em `Wc = W − 35`, de 253 a 325) e o pane do terminal (`linhaItem`).
- **Densidade:** instrumento. **Arquétipo:** Lista (ARQ-01, "o que pede a minha atenção?"), com as seções que já existem.
- **Ritmo do dado:** o `deduzido.json` muda a cada batida (10 min); a lista de sessões, a cada leitura do pane. Quando os dois divergem, vale o mais fresco.

## Inventário
| O quê | Onde | Decisão que gera | Frequência | Veredito |
|---|---|---|---|---|
| Chip da etapa | linha de chips | "em que pé está: espero ou cobro?" | toda leitura | **fica**, com a etapa deduzida (D4) |
| Etapa declarada que diverge | — | nenhuma: a batida já age pela deduzida | raro | **sob demanda:** só no alt (D4) |
| Chip do PR `#N +M` | chips | abrir o PR; saber se ele espera o merge | toda leitura | **fica**, com os PRs deduzidos; o mergeado ganha a palavra (D3) |
| PR fechado sem merge | chips (hoje, quando declarado) | nenhuma | raro | **sai** |
| Canto `há X` (última gravação) | canto do cartão | "alguém mexeu nisto?" | toda leitura | **fica**; conta a última atividade deduzida e vira `parado há X` (D1) |
| `parada há X` na linha quem | linha quem | a mesma do canto, com outro número | — | **sai** com dedução fresca; vira `ociosa` (D1) |
| `trabalhando agora` + ponto vivo | linha quem | não interromper | toda leitura | **fica**; vence o parado da batida (D1) |
| `sem dona · N min` | chips | pedir uma dona | raro | **fica**; vence o parado (D1) |
| Origem (GitHub, git, declarado) | — | nenhuma no dia a dia; serve para conferir quando algo estranha | raro | **sob demanda:** alt (D2) |
| `minParado`, `donaViva`, `rodando` gravados | — | — | — | **sai**: o pane tem fonte mais fresca (D6) |
| Perguntas, `aguarda você · Q` | Esperam você, chips | responder | várias por hora | **fica**, sem mudança |

## Hierarquia e peso
- A ordem do cartão não muda: sobre e canto, título, chips, trava, espera, quem, agora, depois. A primária continua o botão de abrir a sessão; nada novo disputa com ela (PESO-01).
- **Nenhuma linha nova.** O parado ocupa o canto que já existe. O cartão só cresce quando `#N mergeado` não cabe na linha de chips (Wc 253: +26 px no pior caso).
- O canto `parado há 45 min` ocupa ~105 px, contra ~55 px de `há 45 min`. O "projeto · tema" à esquerda passa a cortar com reticências mais cedo (já corta hoje); o título e os chips não mudam.
- Peso pela gravidade (PESO-02): o parado em `t` 600, acima do `m` do canto comum e abaixo da trava (`er` no bloco `et`) e do âmbar (espera o operador).

## Mensagens
| Mensagem | Lugar | Duração | Tom | Quem vê |
|---|---|---|---|---|
| `parado há 45 min` (formato do `desde`: `há N min`, `há N h`, `há N d`) | canto do cartão em Executando; no terminal, na linha de info, logo após a etapa | enquanto vale; some na leitura que vê atividade depois da batida | neutro forte: `t`, peso 600 | operador |
| `há 12 min` | canto | sempre | `m`, como hoje | operador |
| `dona · ociosa` | linha quem | enquanto a sessão não roda | `s`, como hoje | operador |
| `#164` | chip do PR | enquanto aberto | `an` com traço `ans`, como hoje | operador |
| `#160 mergeado` | chip do PR | até o item fechar | `ok` com traço `oks` | operador |
| origem e etapa declarada | alt do cartão | — | — | leitor de tela; quem confere |

O alt ganha, depois dos chips: `etapa pelo GitHub` · `etapa pelo git` · `etapa declarada`; `PRs pelo GitHub` · `PRs declarados`. Na divergência entra `declarada: validação`; sem dedução, `estado declarado`. Nenhum texto cita ADR, arquivo ou "batida" (MSG-05).

## Regiões e componentes
- **Cartão (Executando, Travados, Esperam você):** `cartaoSvg` com `chipDaEtapa` (etapa deduzida), `chipDoPr` (o aberto primeiro; sem aberto, o último mergeado com a palavra), `tempoDoItem` (ganha o ramo do parado) e `linhaQuem` (recebe `ociosa`).
- **Na fila:** `filaSvg`. O `espera <etapa>` e o `chipDoPr` passam a usar os dados deduzidos; o canto continua `parado há X`, contado do `paradoDesde`.
- **Terminal:** `linhaItem`, com a etapa, `#N` / `#N mergeado` e `parado há X` na mesma linha de info.
- **A mistura dos dados:** fica numa função pura antes do desenho, que devolve o `LinhaItem` já com etapa, PRs, mergeados, última atividade, parado e origem. O `desenho.ts` continua lendo só o `LinhaItem`.
- **Lacuna:** nenhuma. Nenhuma classe nova no CSS.

## Estados
- **Dedução fresca (`em` de até 25 min):** etapa e PRs deduzidos; o parado segue a regra da D1.
- **Ausente, ilegível, velha (> 25 min) ou com `em` mais de 1 min no futuro:** vale o declarado, como hoje, sem aviso; o alt diz `estado declarado`.
- **Item que não está em `itens`** (nasceu depois da batida): só ele fica no declarado.
- **Fonte parcial** (`fontes.prs: 'item'`, o `gh` caiu): mostra o que veio, sem marca; o alt diz `PRs declarados`.
- **Etapa deduzida `feito` num item ainda vivo** (a batida não conseguiu fechá-lo): o chip da etapa fica `merge` e o PR aparece como `#N mergeado`. O item vai para Feitos quando a batida o fechar; nada fecha no pane.
- **Sem lista de sessões** (`sem leitura da sessão`): o parado deduzido vale sozinho e a linha quem diz o que diz hoje.
- Carregando, vazio e erro da leitura: sem mudança.

## Movimento
Nenhum. O ponto que pulsa (`.vivo`) continua só no `trabalhando agora`. O parado não pisca: piscar daria a ele o mesmo sinal de quem está trabalhando. Nada novo para `prefers-reduced-motion`.

## O que sai
- `parada há X` na linha quem, quando há dedução fresca (vira `ociosa`).
- A última gravação como única régua do canto (passa a valer a última atividade: gravação, sessão, commit ou PR).
- O PR fechado sem merge no chip.
- A etapa declarada à vista quando diverge (vai para o alt).
- O `minParado`, o `donaViva` e o `rodando` gravados, porque o pane tem fonte mais fresca.

## Decisões ao operador
Todas *assumidas, a confirmar*; cada uma se desfaz trocando uma regra do desenho.

- **D1 · Onde mora o parado.**
  - *O caso:* o cartão já tem três relógios: o canto (`há X`, desde a última gravação no item), a linha quem (`parada há X`, só a sessão) e o chip `sem dona · N min`. O parado deduzido conta também commit e PR; um quarto relógio daria dois números para a mesma pergunta.
  - *Se não decidir:* o canto vira `parado há 45 min` (`t`, 600) quando o item está parado e mostra `há X` da última atividade nos outros casos. A linha quem troca `parada há X` por `ociosa`. Sem dedução fresca, tudo fica como hoje.
  - *Recomendação:* essa. `parado há X` já é o texto do canto na Na fila, então a palavra e o lugar já são conhecidos. O tom é neutro forte, e não âmbar, porque quem age primeiro é a batida: ela cobra a dona e só chega a "Esperam você" quando a dona não responde (COR-03). Estas situações vencem o parado e o escondem: `trabalhando agora` na lista ao vivo; qualquer atividade (sessão ou gravação) depois do `em` da dedução; `sem dona` (a causa vence o sintoma, como a trava vence a espera); a espera; a trava. Os minutos saem de `ultimaAtividade` na hora do desenho, e não de `minParado`, que fica congelado na batida.
- **D2 · A origem do dado.**
  - *O caso:* cada fato vem do GitHub, do git ou do que a dona declarou.
  - *Se não decidir:* a origem fica só no alt.
  - *Recomendação:* só no alt, como você propôs. A origem não muda o que o operador faz (PRIN-04); quem estranha uma etapa confere no alt.
- **D3 · PR aberto e PR mergeado.**
  - *O caso:* depois de uma fatia mergeada, o item volta a `execução`, e um `#160` azul ao lado de `execução` parece um PR esperando merge.
  - *Se não decidir:* o PR aberto aparece como hoje. Sem aberto, o último mergeado vira `#160 mergeado` em verde (`ok`/`oks`, a cor que a etapa `merge` já usa); o `+M` conta os outros que valem, e o fechado sem merge some.
  - *Recomendação:* essa. A palavra vai junto da cor para não depender só da cor, e o desfecho tem cor (COR-04).
- **D4 · A etapa deduzida diverge da declarada.**
  - *O caso:* a dona gravou `validação`, mas o GitHub mostra o PR aberto (`merge`).
  - *Se não decidir:* aparece só a deduzida; a declarada vai para o alt.
  - *Recomendação:* só a deduzida. A batida já age por ela; mostrar as duas pediria ao operador uma arbitragem que ninguém pediu e que se resolve sozinha.
- **D5 · Na fila, Travados e Esperam você.**
  - *O caso:* as três seções também desenham etapa e PR.
  - *Se não decidir:* etapa e PR deduzidos nas três; o parado não aparece em nenhuma.
  - *Recomendação:* essa. Na fila, ficar parado é o estado de quem não começou, e o canto já o diz. Em Travados, a trava diz o que prende o item. Em Esperam você, o item espera o operador e a dedução já o exclui do parado. As seções e o contador do resumo não mudam, porque a seção vem da dona e da trava, não da etapa.
- **D6 · Dedução ausente ou velha.**
  - *O caso:* sem o arquivo, com ele ilegível ou com mais de 25 min.
  - *Se não decidir:* vale o declarado, sem alarme.
  - *Recomendação:* confirmo, com três acréscimos: `em` no futuro conta como ilegível; o item que não está em `itens` cai no declarado sozinho; e a dedução fresca perde para a lista ao vivo em `rodando` e na atividade da sessão.
- **D7 · O parado no item em merge.**
  - *O caso:* em `merge`, a sessão ociosa já aparece como "esperando o gate" (F221). A batida, porém, conta o parado no merge para cobrar o `--anotar` quando o PR está fora da fila, e o pane não sabe se o PR está na fila.
  - *Se não decidir:* o item em `merge` não mostra parado; o canto mostra `há X`.
  - *Recomendação:* sem parado em `merge`. Num item que espera o gate de propósito, "parado" é alarme falso. O PR esquecido chega ao operador pela cobrança da batida e, sem resposta, como pergunta.
