# Aba do kit no Orca

Plugin do Orca que mostra, numa aba da barra lateral, o que o kit de orquestração espera de você:

- **Perguntas** abertas pelas sessões, com o caso, o que acontece se ninguém decidir e a recomendação. "Aceitar a recomendação" ou "Responder outra coisa…".
- **Decisões** que as sessões tomaram sozinhas e seguiram, agrupadas por item. Confirmar uma, o grupo ou todas (só grava, ninguém é acordado; dá para desfazer por 10 s) ou "Discordar…", que manda a mudança à sessão.
- **Entregas** das sessões nos últimos 7 dias, do painel do kit e da caixa do Orca. "Limpar" tira da lista sem apagar nada; "Responder…" manda uma pergunta à sessão (ou à orquestradora, se a sessão já fechou).

**Versão nova do kit:** quando o kit publicou plugin mais novo que o instalado, uma barra curta no topo (em qualquer seção) diz "Versão nova do kit" e manda rodar `atualizar-plugins`. A aba não executa o `atualizar-plugins` (ele grava em `~/.claude`, e a aba só envia a terminais); ela só grava o cache de versões publicadas e atualiza o clone do marketplace. A conferência lê o cache `batida/kit-publicado.json` e, vencidos 30 min, refaz o `git fetch` do clone do marketplace em segundo plano (ler a aba nunca espera a rede). Sem versão nova, sem barra.

**Cores:** o `Badge` do Orca só aceita `tone` (cinco tons), então os selos de estado se agrupam por sentido, sem emoji: destaque anda (Executando, Planejando, No design, Validando, Mergeando), âmbar espera algo ou alguém (Espera você, PR aberto, Aguarda merge), verde terminou (Entregue), vermelho quebrou ou travou (Gate vermelho, Travada, Sessão falhou), neutro está parado (Parada, Sem sessão). O texto do selo sempre diz o estado, e cada cartão tem uma pista de cor só (o selo, sem borda colorida repetindo). O ícone de carregamento (`Spinner`) só aceita `label` e `labelHidden`: não tem cor própria.

A resposta vai só ao endereço gravado na pergunta (`endereco.orca`, que o painel do kit preenche com o `orca_session_id` de quem perguntou); sem endereço, a resposta fica gravada e a entrega, pendente. Respostas ao mesmo destino dadas a até 5 s da primeira saem numa mensagem só.

Ler não aciona modelo: a aba lê os arquivos do painel (`~/.claude/orquestracao/`) e o CLI do Orca em modo leitura (`orchestration inbox` e `worker-list`, com cache de 60 s). Só responder, discordar e responder a uma entrega acordam uma sessão, e só a que precisa.

**A batida de leitura.** No Orca, o mod do app desktop não roda, e a seção Sessões ficaria com o estado velho. Por isso o worker roda `painel.mjs batida --leitura` ao abrir e a cada 10 min: o relógio confere a cada minuto e roda quando `batida/deduzido.json` tem 10 min ou mais. O aviso de estado velho só aparece depois de 15 min, uma batida perdida.
- O que ela faz: deduz o estado dos itens pelo git, pelo `gh` e pela lista de workers do Orca, e grava o `deduzido.json`.
- O que ela não faz: não cutuca, não solta, não fecha nem lança fila; isso segue com a batida do app desktop e com a orquestradora.
- O `painel.mjs` é o do plugin `orquestracao` instalado no escopo do usuário.
- `PAINEL_DO_KIT_BATIDA=off` desliga.
- Decisão: `docs/adr/0032-no-orca-a-aba-do-kit-roda-a-batida-de-leitura.md`.

## Instalar (pasta de desenvolvimento)

```sh
orca plugin dev load "$PWD/orca/painel-do-kit"
```

O Orca pede aprovação (worker próprio, armazenamento do plugin, notificações, leitura do workspace e envio a terminais) e mostra o comando com `--approve <impressão>`. Depois disso, editar os arquivos recarrega o plugin sem pedir de novo.

## Testes

```sh
orca plugin test orca/painel-do-kit                                          # painel e worker (.ts/.tsx)
node gate/com-fichas.mjs -- node --test 'orca/**/test/**/*.mjs'              # núcleo (.mjs), também no npm test
orca plugin check orca/painel-do-kit                                         # renderiza os cenários de src/panel.check.ts
```

## Como está organizado

- `src/nucleo/*.mjs`: leitura e gravação do painel, entregas, envio pelo Orca e as contas do "Limpar". Só módulos nativos; o painel importa apenas `lidas.mjs`, que não usa `node:fs`.
- `src/worker.ts`: os pedidos que o painel faz (`kit.ler`, `kit.responder`, `kit.confirmar`, `kit.desfazer`, `kit.reentregar`, `kit.seguimento`, `kit.concluidas`, `kit.arquivar`), o contador da barra de status e o relógio da batida de leitura (`src/nucleo/batida.mjs` diz quando e com que script).
- `src/panel.tsx`: a aba. `src/vista.ts`: tempo em português, dia de São Paulo e agrupamentos.
- O texto que você escreve nunca entra numa linha de shell: o worker o grava em arquivo e o comando fixo o lê de lá.

Desenho: `docs/design/revisoes/2026-11-06-aba-do-kit-no-orca.md`. Plano: `docs/planos/2026-11-06-aba-do-kit-no-orca.md`.

## Arquivar concluídas (seção Sessões)

- O botão "Arquivar concluídas (N)" só aparece quando há dona de item `feito`/`descartado` que passa nas condições do arquivar. Quem confere e executa é o `painel.mjs orquestradora arquivar --concluidas` do plugin `orquestracao` (as mesmas condições do `arquivar <ctx_…>`); a aba não reimplementa nada e não pede capacidade nova (o worker roda o script como a batida de leitura roda).
- `kit.concluidas` lê as aptas (`--seco`, sem efeito; cache de 2 min). `kit.arquivar` manda só os itens que a pessoa viu e confirmou, com `--remover-worktree`: libera o worker, marca a worktree como concluída e a remove (`worktree rm`, nunca `--force`; só com a worktree limpa e empurrada), então a sessão some da barra lateral. O que deixou de valer na hora volta com o motivo.
- Sem o plugin `orquestracao` atualizado (script sem `--concluidas`), o botão não aparece.
