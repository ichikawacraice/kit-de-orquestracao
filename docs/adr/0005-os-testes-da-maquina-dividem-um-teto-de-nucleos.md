# ADR 0005 — Os testes de todas as sessões e de todos os projetos dividem um teto de núcleos da máquina

- Data: 2026-10-26
- Status: Proposto
- Autor: sessão planejadora do kit, a pedido do operador (*"o pc está travando, tem que limitar o uso máximo de cores na soma de todos os testes"*)
- Relacionados: ADR 0400 do Izanagi, `docs/adr/0400-os-testes-da-maquina-dividem-um-teto-de-nucleos.md` na branch `f105-teto-de-nucleos` (item F105, a mesma decisão no gate de lá) · `gate/a-vez-do-gate.mjs` · `gate/o-teto-de-workers.mjs` · `plugins/orquestracao/pool/protocolo.md`
- Pendências: o Izanagi confirmar a pasta comum (decisão 1, *assumida, a confirmar*); remedir a carga com o teto no ar e ajustar o 7

<a id="contexto"></a>
## Contexto
- **O que se mediu em 26/10.** O Mac tem 15 núcleos. A carga chegou a 35 com 9 vitest vivos de várias sessões; o pool chegou a ter 8 executoras e 2 validadoras testando juntas; às 14:47 o `uptime` dava 14 a 21, e às 15:01, 16,7 com 10 processos de teste vivos. O ADR 0400 do Izanagi mediu, na mesma tarde, um gate sozinho em carga p50 16,7 e dois gates com as outras sessões em p50 25, máximo 53,8, memória livre mínima de 3% e testes de relógio vermelhos.
- **O que o kit tem hoje.** O gate (`gate/a-vez-do-gate.mjs`) põe a suíte numa fila com **uma vaga por repositório**: a trava mora no diretório comum do git, então cada projeto tem a sua. A fila do conserto (um pacote só) é outra trava, também por repositório. O teto de workers (`o-teto-de-workers.mjs`) limita cada vitest a ¼ da máquina. **Nada soma**: N projetos × (gate + conserto) × workers, mais todo teste rodado fora do gate.
- **Os furos.** O `npm test` do próprio kit é `node --test` cru, que roda `núcleos − 1` = 14 arquivos em paralelo e não passa por fila nenhuma. As regras do pool mandam a executora e a validadora rodarem "o teste do pacote mexido" sem dizer por onde. A orquestradora despacha V e abre vaga nova sem olhar a carga.
- **O F105 do Izanagi** (ADR 0400, branch `f105-teto-de-nucleos`) decidiu fichas de núcleo, teto padrão de metade dos núcleos, tomadas pelo processo principal do vitest. Mas guarda as fichas no diretório comum do git do Izanagi: o teto vale só para lá. Com o kit e os outros projetos de fora, a soma da máquina continua sem limite.

<a id="decisao"></a>
## Decisão
1. **O teto é da máquina e mora em `~/.claude/orquestracao/nucleos-de-teste/`.** Uma ficha = um núcleo de teste (um worker de vitest, um arquivo de `node --test` em paralelo, um `tsc`). A ficha k (de 1 ao teto) é o arquivo `<pasta>/<k>`, criado com `openSync(…, 'wx')`, com o JSON `{pid, token, worktree, projeto, desde}`. A ficha cujo PID morreu volta ao teto; a ilegível há mais de 30 s também. **O contrato é o mesmo do ADR 0400** (arquivo `<k>`, PID dono), com a pasta trocada pela da máquina, para o Izanagi e o kit dividirem as mesmas fichas. *Assumida, a confirmar* com a orquestradora do Izanagi (mensagem de 26/10). `KIT_NUCLEOS_DIR` troca a pasta e existe para os testes.
2. **O valor padrão é metade dos núcleos (7 em 15)**, o mesmo do ADR 0400: um gate e um teste de pacote, ou três testes de pacote. Ajuste, nesta ordem: a env `KIT_NUCLEOS_DE_TESTE` (ou o legado `IZANAGI_NUCLEOS_DE_TESTE`, que o kit já aceita como reserva dos `KIT_*`); senão o arquivo `<pasta>/teto.json` `{"nucleos": N}`, que vale para toda sessão sem reiniciar nenhuma; senão `floor(núcleos / 2)`, no mínimo 1. Valor que não é inteiro ≥ 1 é recusado alto. `node scripts/kit/o-teto-da-maquina.mjs` mostra quem tem as fichas e `--teto N` grava o arquivo. No CI não há teto (o runner não tem vizinho).
3. **Quem toma as fichas: todo teste que o kit sobe.** Pede o que quer, **leva o que houver livre (no mínimo 1)** e só espera quando não há nenhuma, dizendo a cada minuto por quem (worktree, projeto, PID). Devolve na saída; o que morre sem sair é retomado pelo PID morto. Quem já tem fichas passa `KIT_FICHAS_TOMADAS=<n>` ao filho, que não toma de novo. Os pontos:
   - o **gate** (`a-vez-do-gate.mjs`), depois de ganhar a vez do repositório, toma as fichas da suíte e passa ao filho o que levou: `KIT_TESTE_WORKERS` e o marcador `{fichas}` trocado no comando (`node --test --test-concurrency={fichas}`). A fila por repositório continua: o mesmo worktree nunca roda dois builds no mesmo `dist`;
   - o **typecheck do gate** toma `gate.nucleosTypecheck` (padrão 2);
   - o **teste isolado** passa por `scripts/kit/com-fichas.mjs [--quero N] -- <comando>`, que toma as fichas, troca `{fichas}` e roda o comando;
   - o **vitest chamado direto** toma as fichas no `tetoDeWorkers()` do `vitest.config`, só no processo principal, como no ADR 0400;
   - o `npm test` do próprio kit passa a ser `node gate/com-fichas.mjs -- node --test --test-concurrency={fichas}`.
4. **Executora e validadora rodam teste só por esses caminhos**: `npm test` (o gate), o teste de pacote pelo gate (`npm test <pacote>`, fila do conserto) ou `com-fichas`. A guarda de operação ganha a regra `teste-fora-do-teto`, que **recusa** (`deny`, vale em bypass) o `vitest`, `node --test` ou `jest` chamado direto fora do CI, com o comando certo na mensagem. As regras do pool (`protocolo.md`, `executora.md`, `validadora.md`) dizem isso.
5. **A orquestradora não despacha teste novo com a máquina cheia.** Máquina cheia = todas as fichas tomadas, ou carga de 1 min ≥ número de núcleos. Com ela cheia:
   - o hook `papel-do-pool.mjs` (regra T8) **recusa** à orquestradora o `painel com add` de item em `validacao`, porque a V testa logo ao começar. Item em `execucao` segue: a executora escreve código antes de testar, e o teste dela espera nas fichas;
   - o `orquestradora-ritual.mjs` deixa de cobrar o despacho de item em `validacao` e o pedido de vaga de E e V; cobra, no lugar, gravar no item `espera: {motivo: "gate", texto: "máquina cheia"}`. A espera não entra em `vencidos`, então o item não é solto por prazo;
   - na primeira volta do ritual com a máquina livre, a cobrança de sempre (F58) volta e o item é despachado.
6. **No modo ausente o teto não afrouxa.** O pool padrão (4 E, 3 V) continua pré-criado; a V espera a máquina como fora dele, e ninguém pergunta nada ao operador sobre o teto: é reversível e o próprio ritual retoma o despacho quando as fichas voltam.

<a id="alternativas"></a>
## Alternativas consideradas
- **Fichas no diretório comum do git, como no ADR 0400.** Recusada: o teto vira um por repositório, e o pedido é a soma da máquina. Com o kit e o Izanagi cada um com 7, a soma já seria 14 de 15 núcleos.
- **Teto em vagas de gate (processos) em vez de núcleos.** Recusada: a vaga conta processo, e um gate de workspace sobe 4 workers ou mais; dez sessões com uma vaga cada ainda somam dez vezes o teto.
- **Reservar só no lançador (o gate).** Recusada sozinha: o vitest e o `node --test` chamados direto ficariam fora. Por isso há três pontos (gate, `com-fichas`, `tetoDeWorkers`) e a guarda recusa o resto.
- **Reservar só no `vitest.config`, como o Izanagi.** Recusada como única: o kit é genérico e o `node --test` (o runner do próprio kit) não lê config.
- **Ler a carga (`loadavg`) e esperar abaixo do limite, sem fichas.** Recusada: a carga atrasa um minuto em relação ao que entrou, então dez sessões que olham juntas entram juntas. A carga só entra como sinal da orquestradora (decisão 5), que despacha devagar.
- **`nice`/`renice` nos testes.** Recusada: o ADR 0400 lembra que em 11/10 o `renice` não resolveu, porque a pressão era também de memória.
- **Teto por sessão ou limite no número de executoras.** Recusada: o número de sessões vivas muda a toda hora e o que trava é a soma; o pool sem teto (Q277) continua.
- **A orquestradora segurar também o despacho de executora.** Recusada: a executora passa a maior parte do tempo escrevendo código; o teste dela já espera nas fichas, e segurá-la só atrasa o item.
- **Teto padrão de núcleos − 3 (12).** Recusada: o medido mostra a máquina travando por memória antes de faltar CPU; metade é o que o operador já usava à mão desde 11/10 e o que o Izanagi decidiu.

<a id="consequencias"></a>
## Consequências
- **Melhor:** a máquina tem um limite de testes que não depende de quantas sessões nem de quantos projetos estão abertos; o `npm test` do kit deixa de ocupar 14 núcleos sozinho.
- **Pior:** com o teto cheio um teste espera mesmo com a fila do repositório livre, e a espera passa a ter dois motivos (a vez e as fichas), ambos ditos na saída. Vitest em modo watch segura as fichas enquanto está aberto. A V fica parada enquanto a máquina está cheia.
- **Passamos a ter que:** manter o contrato da ficha igual ao do Izanagi (um teste compara o formato e o caminho com o que o protocolo diz); remedir a carga com o teto no ar; tratar à parte o que fica fora (o `next build`, a memória).
