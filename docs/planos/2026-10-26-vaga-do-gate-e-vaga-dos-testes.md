# Plano — vaga do gate e vaga dos testes normais no teto da máquina (F136)

Branch: `f136-vagas-do-gate-e-dos-testes`, a partir de `origin/main`. Decisão: [ADR 0008](../adr/0008-vaga-do-gate-e-vaga-dos-testes-no-teto-da-maquina.md), que muda as decisões 2 e 3 do [ADR 0005](../adr/0005-os-testes-da-maquina-dividem-um-teto-de-nucleos.md). Leia os dois antes de começar. Pedido do operador em 26/10 (Q407, pela orquestradora do Izanagi); o Izanagi adota por PR próprio depois.

<a id="medido"></a>
## O que se mediu (26/10, Mac de 15 núcleos)
- **O desperdício.** Teto de 10 fichas (`teto.json` gravado à mão). O gate de um `pnpm-workspace` pede `pacotesJuntos × workersPorPacote` = 2 × floor(15/4) = 6 fichas: sozinho, 4 ficam paradas. O kit não distingue gate de teste normal: o primeiro que chega leva o que houver, então um gate pode ficar com 1 ficha (e um vitest de 1 worker pela suíte inteira) porque três testes de pacote chegaram antes, e dois gates de projetos diferentes rodam juntos dividindo as fichas.
- **Um pacote com 3 e com 7 workers** (Izanagi `develop` 124afc57c, `com-fichas --quero N -- pnpm --filter @izanagi/<pacote> test`, `IZANAGI_TESTE_WORKERS=N`, duas rodadas cada, com a carga da hora):

| Pacote (arquivos de teste) | Workers pedidos | Fichas levadas | Tempo | Carga 1 min antes → depois |
|---|---|---|---|---|
| `runner` (532) | 3 | 3 | 209 s | 4,6 → 9,0 |
| `runner` | 7 | 6 | 157 s | 9,0 → 20,5 |
| `runner` | 3 | 3 | 237 s | 20,5 → 10,3 |
| `runner` | 7 | 7 | 136 s | 10,3 → 11,9 |
| `web` (725) | 3 | 3 | 164 s | 11,9 → 8,5 |
| `web` | 7 | 7 | 110 s | 8,5 → 14,7 |
| `web` | 3 | 3 | 162 s | 14,7 → 10,0 |
| `web` | 7 | 7 | 108 s | 10,0 → 13,4 |

Todas verdes. Leitura: 7 workers deixam um pacote só **1,5 a 1,7× mais rápido** (runner 223 → 136–157 s; web 163 → 109 s) com **2,3× os núcleos**. Dois testes de 3 juntos terminam os dois em ~3,5 min; os mesmos dois de 7 em fila, em ~4,5 min. **Para a máquina, vários testes de ~3 rendem mais que um de 7**; o de 7 só ganha na espera de quem roda aquele teste. O teste de pacote mais longo levou 4 min sob carga 20.

<a id="desenho"></a>
## O desenho (resumo do ADR)
- **Teto = fração dos núcleos**, padrão 2/3 → 10 em 15. `KIT_FRACAO_DE_TESTE` e `teto.json {"fracao": f}` ajustam; `KIT_NUCLEOS_DE_TESTE` e `teto.json {"nucleos": N}` continuam valendo (contrato do Izanagi), mas o `--teto N` passa a avisar que número fixo não acompanha a máquina.
- **Duas faixas de fichas no mesmo diretório.** Faixa do gate: fichas `1..G`, G = floor(T × 0,7) (7 em 10). Faixa normal: `G+1..T` (3 em 10). O gate só toma da faixa dele; o teste normal procura de `T` para baixo, então esgota a faixa normal antes de pedir emprestado.
- **Um gate por vez na máquina.** Arquivo `<pasta>/gate` (`wx`, `{pid, token, worktree, projeto, desde}`), tomado depois da vez do repositório e do verde reconferido; o segundo gate, de qualquer projeto, espera e diz por quem. PID morto é retomado.
- **Empréstimo.** Sem `<pasta>/gate`, o teste normal leva fichas da faixa do gate. O empréstimo **não aumenta o pedido**: o teste continua pedindo o dele (3 no vitest de pacote, `--quero N` no `com-fichas`), e a vaga emprestada serve para caber mais testes juntos, não um teste maior (medido: vários de ~3 rendem mais que um de 7).
- **O gate que chega com a vaga emprestada** grava `<pasta>/gate` na hora (nenhum empréstimo novo começa), leva o que está livre da faixa dele e espera a devolução até `PRAZO_DA_DEVOLUCAO` (padrão 5 min); vencido o prazo, começa com o que tem (no mínimo metade da faixa — senão segue esperando e avisa a cada minuto por quem).
- **Workers do gate.** `porPacote = floor(G / pacotesJuntos)`; o gate pede `pacotesJuntos × porPacote` e a sobra da divisão fica livre na faixa do gate para empréstimo.
- **A máquina cheia da orquestradora** (`maquinaCheia`) passa a olhar a faixa normal: cheia = nenhuma ficha normal livre e nenhuma emprestável, ou carga ≥ núcleos. Gate rodando sozinho não segura a V.

## Regras do projeto que valem aqui
- Node ≥ 20, ESM, só módulos nativos; testes em `node:test`, nunca vitest. Script termina por `process.exitCode`.
- **Teste antes do código.** O vermelho falha pelo motivo certo; teste de ausência prova antes que a presença seria detectada.
- **Testes nunca tocam o `~/.claude` real:** `HOME` e `KIT_NUCLEOS_DIR` num `mkdtempSync`; apague do env passado `KIT_FICHAS_TOMADAS`, `KIT_NUCLEOS_DE_TESTE`, `KIT_FRACAO_DE_TESTE`, `KIT_FRACAO_DO_GATE`, `IZANAGI_NUCLEOS_DE_TESTE` e `CI`. Siga `gate/test/o-teto-da-maquina.test.mjs`.
- Núcleos sempre injetáveis (`nucleos = availableParallelism()` como parâmetro): nenhum teste depende da máquina que o roda.
- Processo filho de teste síncrono, com `timeout` e `killSignal: 'SIGKILL'`; a exceção é o teste de concorrência (passo 3), que usa `spawn` com `setTimeout` que mata o grupo, dito num comentário.
- Comentário no tom dos vizinhos, com a origem (`ADR 0008, operador, 26/10`). Commits convencionais em PT-BR, sem citar ADR no título.
- Rode os testes do kit por `npm test` (ele já passa pelo `com-fichas`); um gate por vez.

## Passos

### 1. As frações e as faixas: `gate/o-teto-da-maquina.mjs` (código + teste)
Teste primeiro, em `gate/test/o-teto-da-maquina.test.mjs`.
1. `tetoDaMaquina(env, nucleos, pasta)`: sem nada, 15 → 10, 4 → 2, 1 → 1 (padrão 2/3, `floor`, mínimo 1). `KIT_FRACAO_DE_TESTE=0.5` → 7; `teto.json {"fracao":0.4}` → 6; fração fora de `(0, 1]` ou não numérica → erro que cita a fonte. A ordem: `KIT_NUCLEOS_DE_TESTE`/`IZANAGI_` (absoluto) → `KIT_FRACAO_DE_TESTE` → `teto.json` (`nucleos` vence `fracao` se os dois vierem) → 2/3. CI → `null`. Os casos antigos de `{"nucleos":3}` continuam passando.
2. Função nova `faixas(teto, env)` → `{ gate: G, normal: T − G }`, G = floor(T × fração do gate), fração do gate padrão 0,7 (`KIT_FRACAO_DO_GATE`, validada em `(0, 1)`), com `normal ≥ 1` sempre e `gate ≥ 1` quando T ≥ 2; T = 1 → `{gate: 1, normal: 1}` sobre a mesma ficha (casos: 10 → 7/3, 7 → 4/3, 3 → 2/1, 2 → 1/1, 1 → 1/1 com `compartilhada: true`).
3. `tentarTomarFichas(pasta, teto, quero, eu, opcoes)` ganha `opcoes.ordem` = lista dos `k` na ordem de tentativa. Casos: com `ordem` `[10,9,8]` leva `[10, 9]`; sem `ordem`, o comportamento de hoje (1 para cima) — os testes atuais não mudam.
4. `estadoDoTeto` devolve também `{ faixas, gateRodando: dono | null, tomadasNaFaixa: {gate, normal} }`; a ponta de linha de comando imprime as duas faixas e quem tem a vez do gate. `--fracao f` grava `{"fracao": f}`; `--teto N` continua e imprime um aviso de que número fixo não acompanha a máquina.

### 2. A vez do gate da máquina: `gate/o-teto-da-maquina.mjs` (código + teste)
1. `tentarAVezDoGate(pasta, eu)` / `soltarAVezDoGate(pasta, eu)` sobre `<pasta>/gate`, com o mesmo contrato da ficha (`wx`, reler antes de apagar o morto, ilegível há mais de 30 s retomado, solta só se `pid` e `token` são os de `eu`). Casos: toma; o segundo não toma e recebe o dono; PID morto é retomado (prove antes que o vivo não é); soltar de outro dono não apaga.
2. `esperarAVezDoGate({ pasta, eu, dormir, agora, avisar })`: espera e avisa por quem a cada minuto, no mesmo texto de `tomarFichas`.
3. A pasta continua sendo a da máquina: `maquinaCheia` e `estadoDoTeto` ignoram o nome `gate` (não casa com `^[1-9]\d*$`) — teste que prova.

### 3. O teste normal: faixa normal primeiro, empréstimo só sem gate (código + teste)
Em `gate/o-teto-da-maquina.mjs`, função `tomarFichasNormais({ quero, pasta, teto, eu, … })` (async e Sync), usada por `com-fichas.mjs`, pelo `tetoDeWorkers()` e pelo conserto do gate.
1. Ordem: faixa normal de `T` para baixo; depois, só se `<pasta>/gate` não existe (vivo), a faixa do gate de `G` para baixo, até o limite de empréstimo (passo 3.2). Leva o que houver (mínimo 1); sem nenhuma, espera como hoje.
2. Limite de empréstimo: o próprio `quero` do teste (o empréstimo nunca aumenta o pedido). Nenhum parâmetro novo.
3. Casos: teto 10 (7/3), quero 3, sem gate → leva `[10, 9, 8]`; segundo pedido de 3 sem gate → leva da faixa do gate (`[7, 6, 5]`); com `<pasta>/gate` vivo → o segundo leva só o que sobrar da faixa normal, e com ela cheia espera; ficha emprestada leva no JSON `"emprestada": true`.
4. **Concorrência:** teto 10, um "gate" de teste toma a vez e a faixa do gate; cinco `com-fichas --quero 3` juntos → nenhum toca `1..7` enquanto a vez existe (a amostra da pasta a cada 50 ms prova), e o máximo somado é ≤ 10.

### 4. O gate: uma vez na máquina e a faixa do gate: `gate/a-vez-do-gate.mjs` (código + teste)
1. Fila `gate` (não o conserto): depois da vez do repositório e do verde reconferido, `esperarAVezDoGate`; depois, as fichas da faixa do gate, de 1 para cima: leva o livre, espera a devolução dos emprestados até `PRAZO_DA_DEVOLUCAO` (`gate.prazos.devolucaoSeg`, padrão 300 s; `KIT_PRAZO_DA_DEVOLUCAO_SEG` para o teste), avisando por quem a cada minuto; vencido o prazo, segue com o que tem se for ≥ metade da faixa, senão continua esperando.
2. `fichasDaSuite` no perfil `pnpm-workspace`: `pacotesJuntos × floor(G / pacotesJuntos)`; perfil `comando`: `min(gate.nucleos, G)`. O `KIT_TESTE_WORKERS` do filho continua sendo `floor(levou / pacotesJuntos)`.
3. A fila do **conserto** (um pacote) passa a tomar como teste normal (`tomarFichasNormais`), não pega a vez da máquina.
4. Saída solta as fichas, depois a vez da máquina, depois a vez do repositório (nesta ordem; teste que prova a ordem lendo a pasta no `finally`).
5. Casos com a pasta temporária: dois gates de repositórios diferentes (`KIT_GATE_TRAVA` distintos) → o segundo espera a vez da máquina e diz o worktree do primeiro; gate com 2 fichas emprestadas a um dono vivo → espera; soltas → começa com 7; prazo 1 s vencido com 5 de 7 → começa com 5; com 3 de 7 → não começa.

### 5. O typecheck e o vitest direto (código + teste)
- `gate/o-typecheck-do-gate.mjs`: toma como teste normal (é curto e roda também fora do gate). Caso: com a vez do gate de outro dono e a faixa normal livre, toma da faixa normal sem esperar.
- `gate/o-teto-de-workers.mjs`: troca `tomarFichasSync` por `tomarFichasNormais` Sync. Caso: com a vez do gate tomada, não leva ficha `≤ G`.

### 6. A máquina cheia da orquestradora: `plugins/orquestracao/hooks/pool-comum.mjs` (código + teste)
1. `maquinaCheia` lê as faixas pelas mesmas regras (o plugin não importa `gate/`: duplique `faixas` e a leitura de fração, como já faz com o teto) e devolve `{ cheia, tomadas, teto, faixas, livresNormais, gateRodando, … }`. Cheia = `livresNormais === 0` e (gate rodando, ou faixa do gate sem livre), ou carga ≥ núcleos.
2. `gate/test/o-teto-concorda-com-o-plugin.test.mjs` ganha as combinações com fração (env e arquivo) e compara também as faixas.
3. `plugins/orquestracao/hooks/tests/pool-comum.test.mjs`: gate rodando com a faixa normal livre → não cheia; faixa normal cheia e gate rodando → cheia; faixa normal cheia sem gate e faixa do gate livre → não cheia.

### 7. As regras escritas (doc + teste que compara)
- `plugins/orquestracao/pool/protocolo.md` (âncora `teto-de-nucleos`): padrão 2/3, as duas faixas, um gate por vez na máquina, o empréstimo e a devolução. `gate/README.md` e `modelos/CLAUDE.md` na mesma linha. `plugins/orquestracao/hooks/tests/teto-de-nucleos-doc.test.mjs` passa a conferir 2/3, 0,7 e o nome `<pasta>/gate` contra as constantes do código.
- `docs/adr/0005-*`: não se edita; o ADR novo diz o que substitui. Índice `docs/adr/README.md` com a linha nova e o 0005 marcado "Substituído em parte por 0008" na coluna de status só se o projeto já usa esse formato; senão, só a linha nova.

### 8. Gate e laudo
`npm test` verde; `claude plugin validate .`; `node gate/o-teto-da-maquina.mjs` na máquina de verdade mostra as duas faixas (cole a saída). Laudo com a saída real.

## Critério de pronto (medível)
- Com teto 10: um gate sozinho leva 6 fichas da faixa `1..7`; três `com-fichas --quero 3` simultâneos com o gate rodando levam 3 fichas no total, todas `≥ 8`, e o quarto espera (teste do passo 3.4).
- Dois gates de projetos diferentes nunca têm fichas ao mesmo tempo (teste do passo 4.5).
- Sem gate, testes normais somam até 10 fichas; o gate que chega espera a devolução e começa com ≥ 4 de 7 (teste do passo 4.5).
- `tetoDaMaquina({}, 15)` = 10; `faixas(10)` = 7/3; o teste de concordância plugin × gate verde com fração.
- `npm test` verde.

## Fora de escopo
- O lado do Izanagi (`scripts/os-nucleos-de-teste.mjs`, `vitest.teto.mjs`, `a-vez-do-gate.mjs` de lá): PR próprio, item à parte. Até ele, as fichas do Izanagi tomam de 1 para cima (caem na faixa do gate) e o gate do Izanagi não pega a vez da máquina — o ADR registra a transição.
- Mudar `pacotesJuntos` do gate (2) ou medir o gate inteiro com 1 × 7 contra 2 × 3.
- Memória e `next build` (ficam como no ADR 0005).
- Apagar o `teto.json` da máquina: decisão do operador (o padrão novo dá os mesmos 10).
