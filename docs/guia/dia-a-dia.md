# O dia a dia

<a id="pedir-trabalho"></a>
## Pedir trabalho

- **Peça à orquestradora,** em palavras suas. Um pedido pode virar um item ou vários; ela diz quais abriu (`F12 · <tema>`).
- **O pedido é ponto de partida, não ordem.** A sessão confere a premissa contra o código e os docs antes de construir em cima e, se achar algo errado, diz e propõe outro formato. Discordar não trava: o que é reversível segue com a proposta dela, marcado *assumido, a confirmar*; se você mantiver o seu pedido, ela faz o que você pediu. Regra: [análise do pedido](../../plugins/orquestracao/pool/protocolo.md#analise-do-pedido).
- **Pergunta ou leitura** a orquestradora responde sem abrir item. Tudo o que muda código ou doc vira item com dona, mesmo uma edição pequena: a orquestradora coordena e não edita (a trava `orquestradora-nao-edita` pede a sua confirmação se ela tentar).
- **Falar direto com uma dona** é permitido: abra a sessão dela na lista do app. Correções do item vão melhor ali; trabalho novo vai à orquestradora.

<a id="perguntas"></a>
## As perguntas com ID

Toda decisão que precisa de você chega com um ID único (`Q12`) e em três partes: o caso, em português de quem está de fora; o que acontece se você não decidir; a recomendação, com o motivo.

- **Responder no chat:** `Q12 sim`, `Q12 não, faz X`. Vários de uma vez: `Q12 sim, Q13 adiar`.
- **Responder no painel:** a pergunta traz botões. Sem opções próprias, são `Sim` (segue a recomendação), `Não` e `Adiar` (fica o que diz o "se não decidir"); com opções, um botão por opção. A resposta chega à sessão que perguntou.
- **Resposta sem ID** ("segue as recomendações") vale só para as perguntas da última mensagem.
- **O contador é um só** para todas as sessões da máquina e nunca repete: `Q12` nunca cai na pergunta errada.
- O que é de baixo risco ou tem recomendação forte a sessão **não pergunta**: assume e marca *assumido, a confirmar*. Pergunta com ID esperando você fica para o irreversível, para produção, para o que gasta dinheiro e para o que publica.

<a id="painel"></a>
## O painel

Abra com `/painel`. Ele fica ao lado do chat e é a sua visão de tudo:

- **Esperando você:** as perguntas com ID e os botões de resposta.
- **Travado:** item parado, sessão bloqueada, PR devolvido pela fila.
- **Em execução** e **na fila:** cada item com a etapa (planejamento, design, execução, validação, merge), a dona e a linha do que se faz agora.
- **No topo, só o que pede gesto:** `Atualizar` quando há versão nova do kit; a linha do reinício quando há plugin para aplicar.

A **barra acima do prompt**, em toda sessão, mostra o relógio do cache, o contexto usado, o selo das perguntas abertas e os botões `Ficar ausente` / `Estou de volta`, `Abrir painel` e, só na orquestradora, `Limpar`.

A cada 10 minutos a **batida** confere a fila: cutuca a dona do item parado, solta o item cuja dona sumiu e avisa a orquestradora do que espera merge ou está sem dona. Detalhe: [a batida](../../plugins/orquestracao/pool/protocolo.md#batida).

<a id="ausente"></a>
## Sair e voltar: `/ausente`

Antes de sair por horas (dormir, reunião longa), diga na orquestradora:

```text
/ausente on
```

- Naquele turno ela abre as donas que faltam para os itens sem dona. Depois dele, **nenhuma sessão abre sessão nova sozinha**: o que nascer fica na fila, e o que precisa de sessão vira cartão para você iniciar.
- As decisões de baixo risco seguem assumidas e marcadas; nada se arquiva.
- Só o comando liga e desliga. Frase solta ("vou dormir") não mexe, e você pode dar ordens no meio sem desligar o modo.
- O botão `Ficar ausente` da barra liga a mesma bandeira, mas não abre as donas que faltam: para isso, o comando.

Na volta:

```text
/ausente off
```

A orquestradora entrega o resumo do período: o que foi feito, o que foi assumido e o que espera você. `/ausente` sem argumento só diz o estado.

<a id="limpar"></a>
## Limpar o contexto

Sessão longa enche o contexto e fica cara e lenta. A barra mostra o quanto foi usado.

- **Dona:** a partir de 350 mil tokens ela grava o handoff do item e se limpa no próximo momento oportuno, ou diz o que falta para seguir; aos 500 mil a trava exige a limpeza. Antes disso, aos 250 mil, a trava cobra limpar quando o turno termina esperando você. Depois da limpeza ela continua dona do mesmo item e reconhece as próprias perguntas.
- **Orquestradora:** não se limpa sozinha enquanto você está presente. Quando a barra destacar o botão `Limpar` (a partir de 250 mil), clique: ela grava o estado, se limpa e volta ao papel. Com `/ausente on` ela se limpa sozinha.
- **Sessão avulsa** (sem item): limpe quando quiser, pelo app.

<a id="reiniciar"></a>
## Reiniciar o app

Plugin novo ou atualizado só vale depois de reiniciar o app, e reiniciar derruba as sessões de **todos** os projetos no meio do que fazem.

- O painel avisa quando há plugin para aplicar e diz se **pode reiniciar agora**: conta turno rodando, teste rodando e merge ou rebase vivos.
- `Me avise` liga o aviso: a notificação chega quando der.
- No terminal de uma sessão: `painel pode-reiniciar` responde o mesmo, com os motivos.

<a id="atualizar"></a>
## Atualizar o kit

- **Os plugins:** o botão `Atualizar` do painel, ou `atualizar-plugins` no terminal de uma sessão. Depois, reinicie o app.
- **O kit no projeto** (gate, guarda, blocos do `CLAUDE.md`): na raiz do projeto, `kit atualizar --simular` e depois sem a flag. Troca só o que você não editou; o resto vira conflito para você decidir. Detalhe em [Comandos](comandos.md#kit-atualizar).

<a id="testes"></a>
## Os testes

- **Durante o trabalho,** a dona roda só os testes afetados pelo que tocou (`testes-afetados`).
- **O gate completo** (`npm test`) roda uma vez, na fila de merge da orquestradora, sobre a combinação dos PRs. Gate verde sobre a mesma árvore não se repete.
- **Todo teste passa pelo teto de núcleos da máquina,** somando todas as sessões: dez sessões rodando teste ao mesmo tempo não derrubam a máquina. Teste chamado solto (`vitest`, `node --test`, `jest`) é recusado com o comando certo. Detalhe: [teto de núcleos](../../plugins/orquestracao/pool/protocolo.md#teto-de-nucleos).
