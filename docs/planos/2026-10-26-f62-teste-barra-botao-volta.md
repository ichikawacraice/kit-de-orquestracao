# F62 · o teste da barra afirma o botão que volta

Origem: ressalva VD-1 [BAIXO] da revalidação do PR #23 (mergeado em `3bbf613`). O teste `pedido de limpeza: falha de gravação volta o botão e dá toast` (`plugins/painel-sessoes/tests/barra.test.tsx:493`) simula a falha apagando o arquivo da pergunta. Como o clique agora relê a barra (`relerDepoisDoClique`, `register.tsx:753`), a pergunta some e a linha some junto: o teste não pode mais afirmar o botão, e o título promete o que não mede. O caso real de recusa — o documento segue aberto, mas a versão mudou entre a leitura e o clique (`responder`, `register.tsx:459`) — ficou sem teste. O comportamento está certo (sonda da V no laudo); falta o teste no repositório.

## Arquivos
- `plugins/painel-sessoes/tests/barra.test.tsx` — único arquivo tocado.

## Passos
1. Renomeie o teste da linha 493 para o que ele mede: `pedido de limpeza: pergunta apagada antes do clique dá toast e não grava nada`. Corpo igual.
2. Logo abaixo, escreva o teste novo `pedido de limpeza: versão mudada entre a leitura e o clique dá toast, não grava e o botão volta`:
   - `iniciar` com `titulo: 'P3 · barra'` e `perguntas: [limpar('Q290', {}, 4)]`; `montar($, 'terminal')`.
   - Antes do clique, prove que o botão existe: `(await ui.find({ key: 'limpar-pedido' }))?.text` é `'Pode se limpar'`.
   - Troque o arquivo para a versão 5, ainda aberto: `m.arquivos.set(\`${PASTA}/perguntas/Q290.json\`, JSON.stringify(limpar('Q290', {}, 5)))`.
   - `ui.press({ key: 'limpar-pedido' })`, `m.relogio.settle()`.
   - Afirme: `m.toasts.at(-1)` casa `/Não consegui mandar o ok de limpar \(/`; nenhuma escrita em `Q290.json`; `m.enviadas` vazio.
   - Afirme o botão de volta na mesma montagem **e** numa montagem nova (`montar` de novo): `find({ key: 'limpar-pedido' })?.text` é `'Pode se limpar'`, e `lido(...)` não casa `/✓ Ok enviado/`. Desmonte as duas.
3. Prova de que o teste novo falha se o código regredir (só local, nada commitado em `hooks/`). Rode `claude plugin test plugins/painel-sessoes` com cada mutação, uma por vez, e reverta com `git checkout -- plugins/painel-sessoes/hooks/register.tsx`:
   - **M1** — em `responder` (`register.tsx:459`), tire a condição da versão (`|| (q.versao !== undefined && atual.version !== q.versao)`). Esperado: o teste novo falha (gravou Q290).
   - **M2** — em `darOkDeLimpar` (`register.tsx:1088-1089`), grave `okEnviado` mesmo na falha: `await update($, barra, b => ({ ...b, okEnviado: limpeza.id })); if (!r.gravou) $.ui.toast(…)`. Esperado: o teste novo falha na afirmação do botão, **e o teste renomeado do passo 1 passa** (mostra que só o novo cobre o botão).
   Cole no relatório a linha de falha de cada mutação e o resultado do teste renomeado sob M2.
4. Árvore limpa em `hooks/` (`git diff --stat` só mostra o teste). Gate: `claude plugin test plugins/painel-sessoes` e `npm test`, saída real colada.
5. Commit `test(painel): o teste da barra afirma o botão que volta na recusa por versão`, push, PR para `main` com rebase em dia.

## Critério de pronto
- Teste novo verde na árvore final; vermelho sob M1 e sob M2, pelo motivo certo (escrita sob M1; botão/✓ sob M2).
- Teste renomeado verde, e verde também sob M2.
- `claude plugin test plugins/painel-sessoes` e `npm test` verdes; `claude plugin validate plugins/painel-sessoes --strict` verde.
- Diff só em `barra.test.tsx` (e este plano).

## Fora de escopo
- Qualquer mudança em `hooks/` (o comportamento está certo).
- Versão do plugin: sem bump — o PR só mexe em teste, nada muda no que roda (*assumida, a confirmar*; se a orquestradora quiser, a reservada é a 0.6.6).
- As observações do laudo (janela de 30 min, linha D10 no pane): não são achado.

## Regras do projeto
- Testes do mod rodam com `claude plugin test plugins/painel-sessoes` (o `node --test` da raiz não pega `.tsx`).
- Teste que mede ausência prova antes a presença (por isso o passo 2 afirma o botão antes do clique).
- Commit conventional em PT-BR; nada em `~/.claude`.
