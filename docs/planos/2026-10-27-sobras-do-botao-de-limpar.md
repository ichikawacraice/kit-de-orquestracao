# Plano · sobras do botão de limpar e da cobrança da dona (F166)

Base: `main` em `5623d09`. Versões: `orquestracao` 0.1.52 → **0.1.53**; `painel-sessoes` 0.8.0 → **0.8.1**.
Origem: o que sobrou das validações do F147 (PR 63, o botão `↺ Limpar` fixo na barra) e do PR 64 (a dona só é cobrada em planejamento e design). Tudo baixo; nenhuma decisão de desenho nova.

## Medido (5623d09)
- `plugins/orquestracao/pool/protocolo.md:27` ("Quem está com o item (F30)") diz que o dono é "a quem o hook `fila-do-item` cobra a cada turno". A linha 33 do mesmo arquivo, depois do PR 64, já diz que a cobrança por turno vale só em `planejamento` e `design`. As duas linhas se contradizem.
- `plugins/orquestracao/hooks/papel-do-pool.mjs:189`: a T7 libera o `clear_session` com `okDoBotaoDeLimpar` (`pool-comum.mjs:170`) e não apaga `limpeza/<local_…>.json`. O ok vale 30 min: durante esse tempo, um segundo `clear_session` da orquestradora passa sem novo clique.
- `papel-do-pool.mjs:75`: a T5 só recusa Edit/Write em `<BASE>/painel/`. A pasta `<BASE>/limpeza/` fica aberta: a própria orquestradora pode escrever o ok com Write e se liberar da T7.
- `plugins/painel-sessoes/hooks/barra.tsx:338` e `:353`: as linhas têm só espaços, dentro dos `<Button key="limpar">` e `<Button key="modo">`.
- `plugins/painel-sessoes/hooks/register.tsx:1235`: o `Limpando…` volta a `Limpar` quando a leitura vê `tokens < LIMPANDO_ABAIXO_DE` (150 mil). Se a orquestradora clica já abaixo de 150 mil, a próxima leitura (até `LEITURA_MS`, 30 s) apaga o `Limpando…` antes da limpeza acontecer, e o botão aceita um segundo clique, que manda o prompt de novo.

## Partes (uma por commit, teste antes do código)

### A · protocolo sem a cobrança "a cada turno"
- `protocolo.md:27`: trocar "e a quem o hook `fila-do-item` cobra a cada turno" por "e a quem o hook `fila-do-item` cobra a cada turno em `planejamento` e `design` (âncora abaixo, \"Enquanto é dono\")". Não mexer na linha 33.
- Teste (em `hooks/tests/perguntas-proprias-doc.test.mjs` ou num teste doc novo ao lado, à escolha da E): `protocolo.md` não tem a frase `cobra a cada turno` sem `planejamento` na mesma frase. Afirme antes que o arquivo foi lido e não é vazio, e que a frase da linha 33 (a certa) é encontrada.

### B · o ok do botão se gasta na liberação
- `pool-comum.mjs`: nova `export function gastarOkDoBotaoDeLimpar(localId)`, com a mesma validação de id de `okDoBotaoDeLimpar` (`/^local_[\w-]+$/`), que faz `unlinkSync` do arquivo e engole o erro (arquivo já ausente não é falha).
- `papel-do-pool.mjs:189`: `if (okDoBotaoDeLimpar(reg?.localId)) { gastarOkDoBotaoDeLimpar(reg.localId); return libera('botão da barra'); }`. Atualizar a linha T7 do cabeçalho: "o ok do botão vale uma limpeza".
- Testes em `hooks/tests/papel-do-pool.test.mjs`, junto dos casos da T7 com o botão: (1) com o arquivo, o primeiro `clear_session` "self" passa e o arquivo **some** (afirme antes que existia); (2) o segundo `clear_session` logo depois é negado com T7. Mutação: tirar a chamada de `gastar…` deixa (1) e (2) vermelhos.
- Caso de borda aceito: se o `clear_session` falhar depois da liberação, o ok já foi gasto e o operador clica de novo. Registre isso no comentário de `gastarOkDoBotaoDeLimpar`.

### C · a T5 cobre a pasta `limpeza/`
- `papel-do-pool.mjs:75`: a recusa vale para `join(BASE, 'painel') + '/'` **e** `join(BASE, 'limpeza') + '/'`. Mensagem própria da `limpeza/`: "O ok de limpar só se grava pelo botão `↺ Limpar` da barra: é o clique do operador." Cabeçalho: `T5  Edit/Write em <BASE>/painel/ e <BASE>/limpeza/`.
- Teste no caso `T5` (`papel-do-pool.test.mjs:330`): Write em `<BASE>/limpeza/local_X.json` é negado com T5, para qualquer sessão; outro arquivo da BASE continua passando (o caso já prova a presença).
- Fora daqui: escrita por Bash (`echo > …`) segue sem trava, como acontece hoje com `painel/`. Não abra essa frente.

### D · barra sem linhas de espaço
- `barra.tsx:338` e `:353`: apagar as duas linhas que têm só espaços. Conferir no fim com `grep -nE '^\s+$' plugins/painel-sessoes/hooks/*.tsx` vazio (cole a saída). Sem teste próprio.

### E · o `Limpando…` só volta quando o contexto cai de verdade
- O átomo `limpando` (`register.tsx:1136`) passa de `number | null` a `{ desde: number; tokens: number | null } | null`: `tokens` é o `barra.tokens` lido no clique (`limparPelaBarra`, antes do `update`).
- Regra nova em `register.tsx:1235`: volta a `Limpar` quando `tokens !== null && tokens < LIMPANDO_ABAIXO_DE && (l.tokens === null || tokens < l.tokens / 2)`, ou passados `LIMPANDO_MAX_MS`. Atualizar o comentário de `LIMPANDO_ABAIXO_DE` (`barra.tsx:18`) com a regra da metade.
- Ajustar os usos (`:1287`, `:1289`, `:1291`, `:1476` → `!== null` segue valendo).
- Testes em `tests/barra.test.tsx`, ao lado do teste de `:743`: (1) **novo, vermelho antes do código:** clique com `tokens: 90_000`, avança uma leitura com os mesmos 90 mil: segue `↺ Limpando…`; `definirTokens(20_000)`, avança uma leitura: volta `↺ Limpar`. (2) Os testes de `:743` (212 mil → 149.999) e `:759` (10 min) passam sem mudar a asserção. Mutação: voltar a regra antiga deixa (1) vermelho.

## Fechamento
- `plugin.json`: orquestracao 0.1.53, painel-sessoes 0.8.1.
- Gate: `npm test` e `claude plugin test plugins/painel-sessoes` verdes; `claude plugin validate .`, `claude plugin validate plugins/orquestracao --strict` e `plugins/painel-sessoes --strict`.
- Commits conventional em PT-BR (`docs(pool): …`, `fix(pool): …`, `fix(painel): …`), sem F-número nem ADR no título.
- Relatório: uma linha por parte com o arquivo:linha mudado e a saída real do teste novo (vermelho e verde) e das mutações de B e E.

## Fora do escopo (vai para `depois` do item, para uma D)
- Crítica de UI do F147: o glifo da barra ficou sem cor própria (o `Button` do motor só aceita uma string como filho) e não se mediu o clique de `↺ Limpar` com o turno da orquestradora rodando (o prompt entra na fila ou é recusado?). É trabalho de crítico, no app real, não de executora.
- Trava da T5 contra escrita por Bash em `painel/` e `limpeza/`.
