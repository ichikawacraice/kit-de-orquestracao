# F476 · Uso das contas em uma linha por conta, fixa no rodapé da aba

O F475 entregou a faixa com cabeçalho de colunas, duas linhas e duas barras por conta, e textos de explicação quebrando linha; o operador a reprovou. O desenho certo é o da barra de status do Orca: `● ▬▬ 70% 2h 37m · 18% 6d 6h`, uma linha só.

## Premissa conferida (o que a API do Orca deixa e não deixa)
Lido do catálogo de componentes do Orca 1.4.248 (`out/shared/plugins/declarative/*.js`):
- **Tooltip só existe em `Button` e `IconButton`.** `Text`, `Box` e `Row` não têm. A dica da linha mora num botão: o ponto (`●`/`○`) vira um `Button` `ghost` `xs` com `tooltip` e sem `onPress`.
- **`Progress` não tem `tone`** (só `label`, `labelHidden`, `value`). O ponto 6 pede cor na barra: a barra passa a ser desenhada com duas `Box` (trilha `background="muted"` de largura fixa, enchimento com `background` = tom e `width` = pct × largura). A porcentagem ao lado diz o número; a barra é decorativa.
- **Não há `opacity`.** "Linha apagada" = todos os `Text` da linha com `muted` e sem `tone`, e o enchimento da barra em `neutral`.
- **`Box` tem `height` (px ou %), `scroll: 'y'`, `grow`, `minHeight`.** O rodapé fixo é uma coluna de altura `100%`: área rolável `grow` + `scroll="y"` em cima, faixa embaixo. Risco: se o painel do Orca não der altura ao primeiro `Box`, o `100%` não prende; o shot com `--height` prova (ver "Prova").
- **`statusBarItems`** (ponto 1, a conferir): o item da barra de status é um texto e um tooltip; sete contas não cabem legíveis ali. Fica no painel; o PR diz o que se viu.

## O desenho da linha
`[●] e-mail ············ ▬▬▬ 70%  2h 37m · 18%  6d 6h`
- Linha = um `Row` `align="center"` `gap="xs"` com chave `c-<id>`, sem filhos que empilhem.
- `●` cheio + e-mail `semibold` só na ativa; `○` nas outras.
- E-mail num `Box grow minWidth={0}` com `Text truncate`, já cortado no meio por `emailCurto(email, MAX)` (núcleo); o inteiro vai no tooltip. `MAX` é decidido pelo shot a 310 px.
- Células de largura fixa (px) para as barras e os números alinharem entre as linhas: barra 28, % 5 h, contagem 5 h, `·`, % semana, contagem semana.
- Sem dado (`semDado`): `—` nas duas porcentagens, contagens vazias ou `—`, barra vazia, linha apagada; tooltip: "o Orca ainda não mediu o uso desta conta".
- Número velho (`antigo`): números normais, linha apagada; tooltip "último número lido há 3 h".
- Janela de 5 h que já reiniciou: `—` no número, barra vazia, sem tom.
- Tooltip da linha, numa frase: `<e-mail inteiro>` + ` · Codex` (só Codex) + ` · conta ativa` (só ativa) + ` · <explicação>` (só sem dado/velho).
- Tom: `warning` ≥ 80%, `danger` ≥ 95%; na 5 h vai ao número e ao enchimento da barra; na semana só ao número. Abaixo de 80% o enchimento é `accent`.

## A faixa e o rodapé
- Título único "Uso das contas" (`xs`, `muted`), sem "há 39 s", sem cabeçalho de colunas. Estados de falha e leitura (texto `warning` + botão de reler) ficam como no F475.
- `Painel`: com a seção Sessões e a faixa visível, a raiz vira coluna de altura `100%`: em cima a linha atual (trilho + conteúdo) num `Box grow minHeight={0} scroll="y"`; embaixo, a faixa num `Box` com chave `rodape-de-contas`, largura cheia (também sob o trilho, para dar ~50 px a mais ao e-mail), borda em cima e `padding="sm"`. Nas outras seções, nada muda.

## O que muda em cada arquivo
- `orca/painel-do-kit/src/nucleo/contas.mjs`: ordem fixa do operador e `emailCurto` (já escritos pela dona anterior, ficam). Nada mais.
- `orca/painel-do-kit/test/contas.test.mjs`: testes da ordem e do `emailCurto` (já escritos, ficam).
- `orca/painel-do-kit/src/panel.tsx`: `JanelaDeUso`/`LinhaDaConta`/`UsoDasContas` refeitos; `Painel` com o rodapé fixo.
- `orca/painel-do-kit/src/sessoes.test.tsx`: os testes da faixa (já reescritos pela dona anterior) ajustados à barra de `Box` em vez de `Progress`.
- `orca/painel-do-kit/src/panel.check.ts`: cenário com os dados do F475 (6 Claude + 1 Codex, uma `status: error` com número velho, uma com 100%, uma sem leitura) e lista de sessões longa o bastante para rolar.

## Prova (shot) de cada ponto
`orca plugin shot orca/painel-do-kit --scenario '<contas>' --width 310 --height 700` e a 480 px:
1. a faixa aparece no pé do PNG com sessões cortadas acima dela (lista mais alta que a janela);
2. nenhum "5 horas"/"Semana", só "Uso das contas";
3. sete linhas, uma por conta, uma barra cada, e-mail inteiro ou cortado no meio, barras alinhadas;
4. a conta sem leitura com `—` e apagada, nenhuma frase de explicação na tela;
5. ordem claude, agents, gabriel.craice, acesso, dev, izanagi, depois g.craice (Codex), sem a palavra "Codex";
6. 100% vermelho no número e na barra; 96% só no número.

## Fora do escopo
Item na barra de status do Orca; mudar o worker ou a frequência de leitura.

## Critério de pronto
Testes da aba e afetados verdes; shot conferido ponto a ponto contra o modelo; validador e crítico de UI sem achado médio/alto.
