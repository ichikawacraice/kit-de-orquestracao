# Aba do kit no Orca

Plugin do Orca que mostra, numa aba da barra lateral, o que o kit de orquestração espera de você:

- **Perguntas** abertas pelas sessões, com o caso, o que acontece se ninguém decidir e a recomendação. "Aceitar a recomendação" ou "Responder outra coisa…".
- **Decisões** que as sessões tomaram sozinhas e seguiram, agrupadas por item. Confirmar uma, o grupo ou todas (só grava, ninguém é acordado; dá para desfazer por 10 s) ou "Discordar…", que manda a mudança à sessão.
- **Entregas** das sessões nos últimos 7 dias, do painel do kit e da caixa do Orca. "Limpar" tira da lista sem apagar nada; "Responder…" manda uma pergunta à sessão (ou à orquestradora, se a sessão já fechou).

A resposta vai só ao endereço gravado na pergunta (`endereco.orca`, que o painel do kit preenche com o `orca_session_id` de quem perguntou); sem endereço, a resposta fica gravada e a entrega, pendente. Respostas ao mesmo destino dadas a até 5 s da primeira saem numa mensagem só.

Ler não aciona modelo: a aba lê os arquivos do painel (`~/.claude/orquestracao/`) e o CLI do Orca em modo leitura (`orchestration inbox` e `worker-list`, com cache de 60 s). Só responder, discordar e responder a uma entrega acordam uma sessão, e só a que precisa.

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
- `src/worker.ts`: os pedidos que o painel faz (`kit.ler`, `kit.responder`, `kit.confirmar`, `kit.desfazer`, `kit.reentregar`, `kit.seguimento`) e o contador da barra de status.
- `src/panel.tsx`: a aba. `src/vista.ts`: tempo em português, dia de São Paulo e agrupamentos.
- O texto que você escreve nunca entra numa linha de shell: o worker o grava em arquivo e o comando fixo o lê de lá.

Desenho: `docs/design/revisoes/2026-11-06-aba-do-kit-no-orca.md`. Plano: `docs/planos/2026-11-06-aba-do-kit-no-orca.md`.
