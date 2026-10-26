---
name: auditoria-de-clique
description: Audita os gestos de uma tela seguindo cada clique até o estado final — o que o handler grava, o que a rota grava, quem move o efeito visível, como a tela relê — para achar o botão que "não faz nada", o efeito otimista que salta de volta, o desfecho que some e o gesto que pinta um estado que o banco não tem. Use quando a pessoa disser que um botão não funciona e o código parece certo, depois de mexer num gesto ou numa rota que grava, ou antes de mergear tela nova com ação que grava. Não serve para bug de API isolado nem para visual.
---

# Auditoria de clique

A leitura comum confere que o handler existe, não quebra e tem o tipo certo. Ela não confere se o **estado final** é o que o rótulo do botão promete. Caso típico: um botão *Novo e-mail* chamava `abrirEditor()` e depois `limparSelecao()`, e o segundo zerava o primeiro como efeito colateral. As duas funcionavam; o botão não fazia nada.

O estado de um gesto mora em quatro lugares, e o defeito quase sempre está na costura entre eles:

| Onde | O que é |
|---|---|
| **Estado local** | o estado do componente |
| **Aposta (efeito otimista)** | o efeito que entra no gesto, antes da resposta do servidor |
| **Decisão do servidor** | se o gesto pode, para onde leva, o que grava e **quem move** o efeito visível (a própria rota ou um processo em segundo plano) |
| **Observação** | como a tela fica sabendo do desfecho: resposta, releitura, sondagem, evento |

Descubra no projeto onde cada um mora (procure o hook ou helper de aposta, a rota/função que decide o gesto, a sondagem) antes de começar. Duas convenções são o critério: **ação assíncrona tem estado visível** e **o efeito entra na hora, e a recusa desfaz**.

## Antes de começar

Reproduzir exige as dependências instaladas: em worktree novo, instale-as antes de rodar teste de DOM. Sem isso a auditoria só consegue "lido no código".

## Passo 1 — o mapa do que cada gesto grava

Para cada gesto da tela:

```
GESTO: <rótulo> em <Componente:linha>
  handler grava (local):   <setX, apostar(...), ...>
  rota chamada:            <POST /api/...>  → abra a ROTA e liste o que ELA grava
  quem move o visível:     rota | processo em segundo plano | outro
  o que grava DEPOIS:      <o que o outro processo grava mais tarde> — e QUEM AVISA a tela disso
  como a tela relê:        resposta traz o estado | releitura | sondagem de <o quê> — e quando ela LIGA
  onde o efeito aparece:   <este componente | outro componente da mesma página>
  o que o rótulo promete:  <o que a pessoa espera ver depois>
```

Leia a rota de verdade: o que a tela antecipa só é válido se **a mesma requisição** grava. Rota que só enfileira um comando não grava o efeito — quem processa a fila grava, depois.

## Passo 2 — seguir cada clique, em ordem

Para cada gesto: cada chamada do handler, na ordem — o que lê, o que escreve, o que zera de outros campos, o que dispara assíncrono. Então confira os padrões.

**Os seis clássicos:**

1. **Uma chamada desfaz a anterior** — um setter com efeito colateral zera o que o anterior acabou de pôr.
2. **Corrida entre assíncronos** — duas respostas em ordem não garantida; o estado final depende de quem chega por último.
3. **Closure velha** — `setX(x + 1)` com `x` capturado; dependência faltando num `useCallback`.
4. **Transição que falta** — o botão diz *Salvar* e só valida; diz *Excluir* e só marca uma flag.
5. **Ramo morto** — a condição que guarda a ação é sempre falsa naquele ponto.
6. **Efeito que desfaz o gesto** — um `useEffect` observa o campo que o clique mudou e o devolve.

**Os de gesto que grava e observa:**

7. **A aposta dentro do estado do servidor.** Escrita na lista que veio do servidor, a primeira releitura — de QUALQUER item — a apaga, e o item salta de volta no meio do voo. A aposta mora fora, junto com a base.
8. **Antecipar o que outro processo grava.** Quando quem move o efeito é um processo em segundo plano, antecipar pinta um estado que o banco não tem, e nada desfaz — `ok` da rota não é recusa.
9. **Meio fato antecipado.** A requisição grava quatro campos e a tela antecipa um: o resto da tela passa a acusar o que acabou de ser feito. Ou inteiro, ou nada.
10. **O `finally` que solta a aposta antes da releitura.** Em tela que relê depois da resposta, soltar a aposta quando a resposta chega mostra o valor ANTIGO durante a releitura. A aposta morre na primeira notícia nova do servidor, não na resposta.
11. **A recusa que não desfaz — ou desfaz errado.** Recusa sem estado devolve ao que era; recusa que traz o estado real vence o estado de partida. E o motivo aparece no lugar do gesto.
12. **Disparou e largou.** Comando enfileirado com spinner só pelos milissegundos de enfileirar; desfecho "nada mudou" sem mensagem; falha sem o motivo real.
13. **Sonda o efeito colateral, não a ação.** Contador que "devia chegar a zero" em vez do estado da rodada: lote parcial trava a tela. A rodada tem id e estado próprios.
14. **Não sobrevive.** Estado da rodada em variável de módulo (evapora no recompile) ou só em memória (some no F5); sondagem que não revalida ao voltar para a aba; rodada cujo processo morreu vira spinner eterno.
15. **Clique duplo.** O botão não vira "rodando" e o gesto dispara duas vezes.
16. **Sobre o quê.** Lote processando com spinner no topo e nada marcado na lista.
17. **O vão até o processo pegar.** A rota responde 202 com o pedido `pending`; a sondagem só liga quando o servidor já disser "rodando". Entre os dois ninguém relê, e a tela fica em "Entrando na fila…" até o F5. A observação liga no GESTO, sobre o comando, não sobre o estado que o processo ainda não gravou.
18. **Estado local semeado da prop.** `useState(row.texto)` com `key={row.id}`: a releitura traz o dado novo e o componente não remonta — o editor segue mostrando o antigo. Ou a `key` muda junto (`${id}:${atualizadoEm}`), ou o estado ressincroniza.
19. **O efeito aparece em OUTRO componente.** O gesto termina num controle e a lista ao lado (que mostra o mesmo dado) não relê — cada um diz uma coisa.
20. **`fetch` que lança é recusa também.** Erro de rede não é resposta: sem `try/catch`, a aposta fica de pé para sempre e o estado "ocupado" trava a tela. E `401/403` com corpo de erro não é "sem rodada" — confira `r.ok` antes de ler o corpo.

## Passo 3 — o laudo

Um bloco por defeito, e a **procedência** de cada um:

```
CLIQUE-NN [CRITICO|ALTO|MEDIO|BAIXO] · <padrão N>
  Gesto:     <rótulo> em <arquivo:linha>
  Trilha:    1. <chamada> → grava {…}
             2. <chamada> → ZERA {…}   ← conflito
  Esperado:  <o que o rótulo promete>
  Real:      <o que acontece>
  Procedência: lido no código | reproduzido em teste de DOM | reproduzido no navegador LOCAL
  Conserto:  <específico>
```

"Lido no código" é hipótese até ser reproduzido: diga qual das três. Cada defeito confirmado ganha um teste de DOM que o reproduz, visto vermelho antes do conserto.

## Escopo

- **Uma tela**: depois de tela nova, ou quando a pessoa diz que um botão não funciona.
- **Uma primitiva**: mexeu no helper de aposta, na decisão do gesto, na sondagem ou numa rota que grava? Audite TODOS os consumidores (`git grep -l <símbolo>`).
- **O app inteiro**: um agente monta o Passo 1 de todas as rotas que gravam primeiro — é a entrada dos outros —, depois um agente por tela.

## Armadilhas

- **Reproduzir clicando dispara trabalho de verdade.** Um gesto pode enfileirar job ou comando com custo, e cancelar queima a execução. Reproduza em teste de DOM ou no ambiente LOCAL com dados de demonstração — e confira a URL do navegador antes de clicar: pode ser a produção, logada.
- **O rótulo é a especificação.** O "esperado" sai do que o botão DIZ, não do que o código parece querer fazer.
- **Varredura verde não é tela certa.** Uma checagem automática de que o comando é observado não prova que a tela mostra o desfecho.
