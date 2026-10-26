# Plano — teto de núcleos da máquina para todos os testes (ADR 0005)

Branch: `teto-de-nucleos-dos-testes`, a partir de `origin/main`. Decisão: [ADR 0005](../adr/0005-os-testes-da-maquina-dividem-um-teto-de-nucleos.md). Leia-o antes de começar; ele não se edita neste plano. Referência do outro lado: o ADR 0400 do Izanagi (branch `f105-teto-de-nucleos` do repositório Izanagi), que usa o mesmo formato de ficha.

## Regras do projeto que valem aqui
- Node ≥ 20, ESM, só módulos nativos; testes em `node:test` (`node --test`), nunca vitest. Script termina por `process.exitCode`, nunca `process.exit()`.
- **Teste antes do código** quando o comportamento muda. O teste vermelho falha pelo motivo certo; o teste de ausência prova antes que a presença seria detectada; teste que inspeciona um valor afirma antes que ele existe e não é vazio.
- **Testes nunca tocam o `~/.claude` real:** todo teste aponta `HOME` e `KIT_NUCLEOS_DIR` para um `mkdtempSync` e apaga `KIT_FICHAS_TOMADAS`, `KIT_NUCLEOS_DE_TESTE`, `IZANAGI_NUCLEOS_DE_TESTE` e `CI` do env que passa. Siga os vizinhos (`gate/test/a-vez-do-gate.test.mjs`, `plugins/orquestracao/hooks/tests/papel-do-pool.test.mjs`).
- Processo filho de teste é síncrono, com `timeout` e `killSignal: 'SIGKILL'` (o teste de concorrência do passo 2 é a única exceção: use `spawn` com um `setTimeout` que mata o grupo, e diga isso num comentário).
- Comentário e texto no tom dos vizinhos: frase curta, em português, com a origem (`ADR 0005, operador, 26/10`).
- Commits convencionais em PT-BR, sem citar ADR no título, um por passo ou por par de passos, com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Atenção ao gate durante o trabalho:** a partir do passo 6 o `npm test` do kit passa pelo `com-fichas`. Antes disso, rode os testes com `node --test --test-concurrency=2 <arquivos>` para não somar carga à máquina.

## Passos

### 1. O módulo do teto: `gate/o-teto-da-maquina.mjs` (código + teste)
Teste novo: `gate/test/o-teto-da-maquina.test.mjs`. Escreva-o primeiro; ele falha porque o módulo não existe.
1. Casos do teste:
   - `pastaDoTeto({ KIT_NUCLEOS_DIR: d })` → `d`; sem a env, `join(homedir(), '.claude', 'orquestracao', 'nucleos-de-teste')` (com `HOME` apontado para o temporário, compare com ele).
   - `tetoDaMaquina(env, nucleos, pasta)`: `KIT_NUCLEOS_DE_TESTE=5` → 5; só `IZANAGI_NUCLEOS_DE_TESTE=4` → 4; sem env e com `<pasta>/teto.json` `{"nucleos":3}` → 3; sem nada, 15 núcleos → 7, 1 núcleo → 1; `KIT_NUCLEOS_DE_TESTE=0` e `"abc"` → lança erro que cita a variável; `teto.json` com `nucleos` inválido → lança erro que cita o arquivo; `CI=1` → `null`.
   - `tentarTomarFichas(pasta, teto, quero, eu)`: teto 3, quero 2 → leva `[1, 2]` e os arquivos `1` e `2` existem com o JSON `{pid, token, worktree, projeto, desde}`; segunda chamada com quero 2 → leva `[3]` (leva o que houver); terceira → `[]` e devolve os donos das três.
   - Ficha com PID morto (use um PID de um `spawnSync('node', ['-e', ''])` que já saiu) é retomada; ficha com conteúdo ilegível e `mtime` de 31 s atrás é retomada; ilegível recente, não.
   - **Ficha no formato do Izanagi** (`{pid, worktree, projeto, desde}` e o antigo `{pid, cwd, desde}`, ambos sem `token`) com PID vivo (`process.pid`) é respeitada, não retomada. Prove antes que a mesma ficha com PID morto é retomada.
   - `soltarFichas(pasta, [1,2], eu)` apaga só as fichas cujo `pid` e `token` são os de `eu`; a ficha de outro dono fica.
   - `tomarFichas({ quero, pasta, teto, dormir, agora, avisar })` (async, `dormir`/`agora`/`avisar` injetáveis como em `esperarAVez`): com o teto cheio, espera; quando uma ficha é solta, leva e devolve; avisa por quem espera ao começar e a cada minuto (texto com o worktree e o PID).
   - `tomarFichasSync(...)`: mesmo contrato, dormindo com `Atomics.wait` sobre um `SharedArrayBuffer`.
   - `estadoDoTeto(pasta, teto)` → `{ teto, tomadas: [{k, dono}], livres }`, contando só fichas vivas.
2. Implemente com o padrão de `tentarTomar` de `a-vez-do-gate.mjs` (`openSync(caminho, 'wx')`, reler antes de apagar a ficha morta, `ENOENT` tolerado). **Mova `processoVivo` para este módulo** e faça `a-vez-do-gate.mjs` importá-lo e reexportá-lo (o teste de lá continua importando de lá). Este módulo não importa `a-vez-do-gate.mjs` (evita o ciclo).
3. Ficha legível = JSON com `pid` inteiro; `token` é opcional na leitura (o Izanagi não o grava). Não há `venceEm`: o vitest em modo watch segura a ficha de propósito (ADR 0005, Consequências).
4. Ponta de linha de comando (`rodarSePrincipal`): sem argumento, imprime `teto N · tomadas X · livres Y` e uma linha por ficha tomada (k, projeto, worktree, PID, desde); `--teto N` grava `<pasta>/teto.json` (cria a pasta); `--teto padrao` apaga o arquivo. Teste a ponta por `spawnSync` com prazo.

### 2. O teste isolado: `gate/com-fichas.mjs` (código + teste)
Teste novo: `gate/test/com-fichas.test.mjs`, primeiro.
1. Casos:
   - `node gate/com-fichas.mjs --quero 2 -- node -e "console.log(process.env.KIT_FICHAS_TOMADAS, process.env.KIT_TESTE_WORKERS)"` com teto 7 → imprime `2 2` e sai 0; depois do fim, a pasta não tem ficha.
   - `{fichas}` em qualquer argumento é trocado pelo número levado (`-- node -e "console.log('{fichas}')"` → `2`).
   - O código de saída do comando é o do `com-fichas` (comando que sai 3 → 3).
   - Com `KIT_FICHAS_TOMADAS=4` no env, não toma ficha nenhuma (a pasta continua vazia durante o comando) e repassa 4.
   - Sem `--quero`, pede 2. Sem `--` ou sem comando → sai 2 com o uso no stderr.
   - **Concorrência (o critério do ADR):** teto 3, três `com-fichas --quero 2 -- node -e "<grava o número de fichas da pasta num arquivo a cada 50 ms por 1,5 s>"` lançados juntos → o máximo medido de fichas é ≤ 3 e os três terminam com código 0.
   - `CI=1` → roda o comando sem tomar ficha e troca `{fichas}` por `os.availableParallelism()`.
2. Implemente: toma com `tomarFichas`, roda o comando num grupo de processos próprio (o mesmo jeito de `rodarASuite` em `a-vez-do-gate.mjs`: `detached`, repassar SIGINT/SIGTERM/SIGHUP ao grupo), env do filho com `KIT_FICHAS_TOMADAS` e `KIT_TESTE_WORKERS` = número levado, solta as fichas no `finally` e no `exit`.

### 3. O gate toma as fichas: `gate/a-vez-do-gate.mjs` e `gate/config.mjs` (código + teste)
Testes: `gate/test/a-vez-do-gate.test.mjs` (casos novos), primeiro.
1. Config: `gate.nucleos` (padrão 4, perfil `comando`) e `gate.nucleosTypecheck` (padrão 2) em `PADRAO`; `arvore.foraDaChave` ganha `NUCLEOS_DIR`, `NUCLEOS_DE_TESTE` e `FICHAS_TOMADAS` (não mudam o verde). Teste em `gate/test/perfis.test.mjs` ou no teste de config que já cobre `PADRAO`.
2. Quanto o gate pede (`fichasDaSuite(env, argv, raiz, cfg)`, exportada): perfil `pnpm-workspace`, suíte inteira → `pacotesJuntos × workers` (workers = `KIT_TESTE_WORKERS` ou `workersPorPacote(núcleos)`); conserto → `gate.workersConserto` (ou `KIT_CONSERTO_WORKERS`); perfil `comando` → `gate.nucleos`. Teste cada ramo.
3. Em `main`, **depois** de ganhar a vez e de reconferir o verde, toma as fichas (`tomarFichas`), e só então constrói e roda. O filho recebe `KIT_FICHAS_TOMADAS = levou`; no perfil `pnpm-workspace`, `KIT_TESTE_WORKERS = max(1, floor(levou / pacotesJuntos))`; no perfil `comando`, `{fichas}` trocado no comando (`comandoDaSuite` ganha o parâmetro `fichas`). Solta as fichas no mesmo `finally` que solta a vez, e antes dela.
4. Com `KIT_FICHAS_TOMADAS` já no env (o gate chamado por quem já tem fichas), não toma de novo.
5. A linha `[gate] a vez é minha …` passa a dizer `… N fichas de T da máquina` no lugar de `até X núcleos repartidos pelo teto`.
6. CI: nada muda (sem fila, sem fichas).
7. Casos de teste: a suíte do gate (com `gate.comandoCompleto` = um `node -e` que imprime `KIT_FICHAS_TOMADAS` e `{fichas}`) vê o número levado; com o teto cheio por fichas de `process.pid`, o gate espera e diz por quem (injete `dormir`/`agora` como os testes de `esperarAVez` já fazem, ou exporte a etapa para testá-la à parte).

### 4. O typecheck e o vitest direto: `gate/o-typecheck-do-gate.mjs` e `gate/o-teto-de-workers.mjs` (código + teste)
1. Typecheck: antes do `spawnSync`, `tomarFichasSync` com `gate.nucleosTypecheck` (respeitando `KIT_FICHAS_TOMADAS`); solta depois, mesmo no erro. Teste em arquivo novo `gate/test/o-typecheck-do-gate.test.mjs`: com o teto cheio por ficha de outro PID vivo, o typecheck não começa antes de a ficha ser solta (use um processo filho que segura a ficha por 1 s).
2. `tetoDeWorkers(env, nucleos, workersPorNucleo, opcoes)`:
   - `CI` → `{}` (como hoje);
   - `KIT_FICHAS_TOMADAS` no env → `{ maxWorkers: n, minWorkers: 1 }` sem tomar nada;
   - processo de worker do vitest (`VITEST_WORKER_ID` ou `VITEST_POOL_ID` no env) → o comportamento de hoje, sem tomar;
   - senão, pede o de hoje (`KIT_TESTE_WORKERS` ou `workersPorPacote`), toma com `tomarFichasSync`, grava `KIT_FICHAS_TOMADAS` no `process.env` (os filhos herdam), solta no `exit` e devolve `maxWorkers` = levou.
   Teste novo `gate/test/o-teto-de-workers.test.mjs` com os quatro ramos (o último com pasta temporária e teto 2: pede 3, leva 2, `maxWorkers: 2`).

### 5. A guarda recusa teste fora do teto: `gate/guarda-de-operacao.mjs` (código + teste)
Teste: `gate/test/guarda-de-operacao.test.mjs`, primeiro.
1. Regra nova `teste-fora-do-teto`, na lista `REGRAS` e ligada por padrão (atualize `PADRAO.guarda.regras` em `config.mjs` e o README).
2. Pega, em comando Bash fora do CI: `vitest` (inclusive `npx vitest`, `pnpm vitest`, `pnpm exec vitest`), `node --test` e `jest`, **quando** o comando não começa por `node …/com-fichas.mjs`, não tem `KIT_FICHAS_TOMADAS=` e não é o gate (`npm test`, `pnpm test`, `node …/a-vez-do-gate.mjs`). Casos que passam: `npm test`, `npm test -- gate`, `node scripts/kit/com-fichas.mjs -- npx vitest run x`, `grep vitest arquivo`, `cat package.json | grep "node --test"` (palavra dentro de argumento de outro programa não é chamada: siga o jeito que as outras regras da guarda já usam para separar comando de argumento).
3. Decisão: **`deny`, também em bypass** (ADR 0005, decisão 4) — diferente das outras regras, que só avisam em bypass. Motivo na mensagem, com o comando certo: `Teste fora do teto da máquina (ADR 0005): rode por \`node scripts/kit/com-fichas.mjs -- <o comando>\` ou pelo gate (\`npm test [pacote]\`).` Prove no teste que o mesmo comando em bypass sai `deny`, e que `npm test` em bypass não sai nada.

### 6. O kit usa o próprio teto: `package.json`, `modelos/kit.json`, `cli/` (código + teste)
1. `package.json` do kit: `"test": "node gate/com-fichas.mjs --quero 4 -- node --test --test-concurrency={fichas}"`.
2. `modelos/kit.json`, perfil `simples`: `suitePadrao` passa a `node --test --test-concurrency={fichas}`.
3. `cli/pacote.mjs` (`arquivosDoGate` e as raízes): `o-teto-da-maquina.mjs` e `com-fichas.mjs` entram em `scripts/kit/` sempre que o gate ou a guarda entram (a guarda cita `com-fichas`, e o gate importa o teto). Teste em `gate/test/m2-instalacao.test.mjs`: uma instalação de perfil `simples` em pasta temporária tem os dois arquivos em `scripts/kit/`.
4. Rode `npm test` (agora pelo `com-fichas`) e confira na saída, ou com `node gate/o-teto-da-maquina.mjs` numa segunda janela, que o teste tomou ≤ 4 fichas.

### 7. A orquestradora segura a V com a máquina cheia (código + teste)
Arquivos: `plugins/orquestracao/hooks/pool-comum.mjs`, `papel-do-pool.mjs`, `orquestradora-ritual.mjs`. Testes: `plugins/orquestracao/hooks/tests/pool-comum.test.mjs`, `papel-do-pool.test.mjs`, `orquestradora-ritual.test.mjs`, primeiro.
1. `maquinaCheia({ pasta, teto, carga, nucleos })` em `pool-comum.mjs` (o plugin não importa `gate/`, que não vai junto quando o plugin é instalado): lê a pasta do teto (`KIT_NUCLEOS_DIR` ou `~/.claude/orquestracao/nucleos-de-teste`), o teto (mesma ordem do ADR: env, `teto.json`, metade dos núcleos), conta as fichas de PID vivo e devolve `{ cheia, tomadas, teto, carga }`; `cheia` = `tomadas ≥ teto` ou `carga ≥ nucleos`; `carga` padrão `os.loadavg()[0]`, `nucleos` padrão `os.availableParallelism()`. Teste com pasta temporária: 2 fichas de `process.pid` e teto 2 → cheia; 1 ficha → não; 0 fichas e `carga: 20, nucleos: 15` → cheia.
2. **As duas leituras concordam:** teste em `gate/test/` que, para os mesmos env e `teto.json` em pasta temporária, compara `tetoDaMaquina` (gate) e o teto de `maquinaCheia` (plugin) e a pasta padrão dos dois, em quatro combinações (env KIT, env IZANAGI, arquivo, nada).
3. `papel-do-pool.mjs`, regra **T8**: orquestradora, Bash com `painel … com add F<n> …`, item `F<n>` em `etapa: "validacao"` (leia o item pela `filaDir()`), máquina cheia → `deny` com `Máquina cheia (X de T fichas, carga C): não despache a V agora; grave no item espera {"motivo":"gate","texto":"máquina cheia"} (ADR 0005).` Item em `execucao` passa. Máquina livre passa. Atualize o comentário de cabeçalho com a T8. Testes: os três casos, e a prova de que o `com add` de V com a máquina livre passa.
4. `orquestradora-ritual.mjs`, em `cobrancaDeEspera`: com a máquina cheia, item em `validacao` esperando V não é cobrado de despacho, e o pedido de vaga de E ou V não é cobrado; no lugar, se o item não tem `espera.motivo === 'gate'`, cobra `F<n> esperando V com a máquina cheia (X de T fichas): grave espera {"motivo":"gate","texto":"máquina cheia"} no item`. Item com essa espera gravada não é cobrado. Com a máquina livre, a cobrança é a de hoje (teste que prova os dois lados). Modo ausente: a mesma regra, sem exceção.
5. Registre nada de novo em `hooks.json` (as duas regras moram em hooks já registrados); `hooks-json.test.mjs` continua verde.

### 8. As regras escritas (doc + teste que compara)
1. `plugins/orquestracao/pool/protocolo.md`: seção nova `<a id="teto-de-nucleos"></a>\n## Teto de núcleos da máquina (ADR 0005, operador, 26/10)`, antes de `## Nunca travar`: o teto soma todas as sessões e projetos; a pasta e o valor padrão; os três caminhos para rodar teste (`npm test`, `npm test <pacote>`, `com-fichas`); a guarda recusa o resto; a orquestradora segura a V com a máquina cheia (T8 e o ritual) e grava `espera` `gate`; no modo ausente nada afrouxa. Na linha 70 (regras do projeto), troque "o teste do pacote mexido" por "o teste do pacote mexido, sempre pelo gate ou pelo `com-fichas` (âncora `teto-de-nucleos`)".
2. `plugins/orquestracao/pool/papeis/executora.md` (linha 8) e `validadora.md` (linhas 8 e 11): o teste roda pelo gate ou pelo `com-fichas`, com link para a âncora.
3. `plugins/orquestracao/skills/orquestradora/SKILL.md`: no passo 3 do ritual ("Despachar o pool"), uma frase: com a máquina cheia não despacha V nem pede vaga de E/V, grava `espera` `gate` e retoma na primeira volta livre (trava T8 e ritual); `node scripts/kit/o-teto-da-maquina.mjs` mostra quem tem as fichas.
4. `modelos/CLAUDE.md`, seção de comandos (a do `kit:`): uma linha `- **Teste isolado:** \`node scripts/kit/com-fichas.mjs -- <comando>\` (teto de núcleos da máquina, somando todas as sessões).` — e o mesmo no `CLAUDE.md` da raiz deste repo, fora das marcas `kit:`.
5. `gate/README.md`: linhas novas na tabela para `o-teto-da-maquina.mjs` e `com-fichas.mjs`, e um parágrafo "Teto da máquina" com a pasta, a ordem do ajuste e o `KIT_FICHAS_TOMADAS`.
6. Teste doc × código em `plugins/orquestracao/hooks/tests/` (siga `limites-de-contexto-doc.test.mjs`): o protocolo cita a mesma pasta padrão e o mesmo nome de env que o código; executora e validadora citam a âncora `teto-de-nucleos`, e ela existe no protocolo.

### 9. Gate final e laudo
1. `npm test` verde (pelo `com-fichas`), `claude plugin validate .` e `claude plugin validate plugins/orquestracao --strict` sem erro.
2. Medida real, colada no PR: em pasta temporária com teto 3, rode o teste de concorrência do passo 2 e mostre a saída; e `node gate/o-teto-da-maquina.mjs` (com `KIT_NUCLEOS_DIR` temporário) imprimindo o estado durante um `com-fichas` vivo.
3. Abra o PR com o rebase em dia sobre `main`, mande o número à orquestradora do kit e não mergeie.

## Critério de pronto (medível)
- `npm test` verde e rodando por `com-fichas` (o `package.json` mostra o comando).
- O teste de concorrência prova máximo de fichas ≤ teto com três processos pedindo mais que o teto.
- O gate, o typecheck, o `com-fichas` e o `tetoDeWorkers` tomam e soltam fichas na pasta da máquina; nenhum deixa ficha depois de sair (teste por caminho).
- A ficha no formato do Izanagi (`{pid, worktree, projeto, desde}` e o antigo `{pid, cwd, desde}`) é respeitada.
- A guarda recusa `npx vitest run` e `node --test x` diretos, também em bypass, e deixa `npm test` passar.
- A T8 recusa o `com add` de item em `validacao` com a máquina cheia; o ritual cobra a `espera` `gate` no lugar do despacho; com a máquina livre, os dois se comportam como hoje.
- O teste que compara o teto do gate e o do plugin passa nas quatro combinações.
- Nenhum teste grava em `~/.claude` real: `git status` limpo e `ls ~/.claude/orquestracao/nucleos-de-teste` não criada pelo `npm test` (confira antes e depois).

## Fora de escopo
- Qualquer mudança no repositório Izanagi (o F105 é da P9 de lá; a pasta comum foi pedida à orquestradora dele).
- Teto de memória, o `next build` e qualquer processo que não seja teste ou typecheck.
- `nice`/`renice`, CI, e o limite no número de sessões do pool (Q277 continua).
- Segurar o despacho de executora (ADR 0005, alternativas).
- Gravar o `teto.json` real da máquina: o operador ajusta, se quiser, com `--teto N`.

