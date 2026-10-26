# Plano · sobras do piso de uma E livre (validação do PR 40)

Base: `main` em `d785df4`. Versão: `orquestracao` 0.1.39 → **0.1.40**.
Origem: três achados da validação do PR 40 (`validacao-pr40.md`, pasta de notas da orquestradora do kit). Sem ADR novo: o plano cumpre o ADR 0004, não muda o desenho.
Executora: Sonnet. Teste antes do código em cada parte; uma parte por commit.

## Medido (d785df4)
- `plugins/orquestracao/hooks/tests/papel-do-pool.test.mjs:44`: o alvo `local_E1` tem o título `E1 · executora · livre`. `membrosLivres` (`pool-comum.mjs:210`, regex `^[PDEV]\d+ · livre\s*$`) **não** o conta como livre. Por isso o caso do piso (`:120-130`) passa mesmo sem a exclusão `x.localId !== reg.localId` (`papel-do-pool.mjs:145`): a mutação sobrevive (validação, seção Medições).
- `papel-do-pool.mjs:145`: a condição do piso não confere se o alvo é livre. Arquivar uma E de título que não é `livre`, sem item vivo, num projeto sem nenhuma E livre, é negado com o motivo "é a última E livre", que é falso: arquivá-la não muda a contagem de livres.
- `orquestradora-ritual.mjs:72-78` (`faltaPiso`): só conta `start_session` do turno corrente. O cartão de vaga proposto num turno de peer fica à espera do clique; o turno seguinte (outro peer, notificação) bloqueia de novo e a orquestradora propõe outro cartão. Todas as E ocupadas é o estado normal do pool trabalhando, então o cartão duplicado é frequente.
- Título de vaga já é convenção: `<ID> · livre` (skill `orquestradora`, `SKILL.md:28` e `:68`).
- `BASE` = `HOOKS_CREWAI_BASE` ou `~/.claude/orquestracao` (`hooks-crewai-comum.mjs:7`); os testes do ritual já apontam `HOOKS_CREWAI_BASE` para pasta temporária.

## Decisão do achado 2 (assumida, a confirmar)
**Marca de vaga pedida, por projeto, gravada pelo próprio hook do ritual, com prazo de 12 h e apagada quando aparece E livre.**
- Gravar: no fim do turno, se o turno teve `start_session` cujo `title` começa por `E<n>` (`/^E\d+\b/`) e o projeto está sem E livre, grava `BASE/piso/<chave>.json` com `{ repo, em, sessao }`. `<chave>` = os 16 primeiros caracteres do `sha1` do `repo` (git common dir), via `node:crypto`.
- Ler: `faltaPiso` não cobra quando há marca do mesmo `repo` com `em` dentro do prazo. Prazo = `PISO_VAGA_MIN` minutos (env, inteiro > 0), padrão **720**.
- Apagar: quando `faltaPiso` encontra E livre no projeto, apaga a marca (a vaga foi atendida). Sem isso, uma E que entrou e logo foi ocupada deixaria o piso calado até o prazo.
- Marca ilegível, de outro `repo` ou vencida conta como ausente. Erro de leitura ou escrita nunca bloqueia nem derruba o hook (o `main` já tem try/catch).
- A regra do turno corrente (`start_session` qualquer satisfaz o turno) **não muda**; a marca só a estende aos turnos seguintes, e só para `start_session` de E.

Por que assim:
- Só o hook do ritual escreve: não precisa de hook novo nem de registro em `hooks.json`.
- Prazo em vez de "até o clique": o hook não enxerga o cartão no app. 12 h cobre o dia do operador; depois disso, um cartão novo serve de lembrete (no máximo dois por dia, não um por turno).
- Alternativa descartada: varrer o transcript inteiro atrás do `start_session` antigo. Some quando a orquestradora se limpa (`clear_session`), justamente quando ela mais roda turnos de peer.
- Alternativa descartada: gravar no painel. O painel só se grava por `painel.mjs` (T5), e o item de vaga não é item da fila.

## Partes

### A · T2: o piso só vale para alvo livre (achados 1 e 3)
Arquivo de teste: `plugins/orquestracao/hooks/tests/papel-do-pool.test.mjs`, no `caso('T2 piso (ADR 0004): …')` (`:120`).
1. Teste vermelho. Depois do `unlinkSync` do `local_E9`, acrescente:
   - **título canônico:** regrave `dir('app','conta','local_E1.json')` com o mesmo registro e `title: 'E1 · livre'`; `A('local_E1', depeer())` → `nega`, motivo com `última E livre` e `ADR 0004`. Antes dele, afirme que o registro foi gravado com o título novo (leia o arquivo e compare o `title`).
   - **alvo que não é livre:** com E1 de volta a `E1 · executora · livre` (ou use `local_E3`, `E3 · executora · F5`, sem item vivo), sem nenhuma E livre no projeto, `A('local_E3', depeer())` → `passa`.
   - Mantenha os casos que já existem (precondição com E9, turno do operador, outro projeto, V).
   Rode: o caso do alvo que não é livre fica vermelho no código atual (nega com "última E livre"). O caso canônico já fica verde (o código atual está certo nele).
2. Código em `papel-do-pool.mjs:145`: o piso só nega se o alvo está entre os livres do projeto e não há outra E livre. Leia `membrosLivres(dele)` uma vez:
   `const livresE = membrosLivres(dele).filter((x) => x.papel === 'E');`
   `if (!porComando && meu && meu === dele && m.papel === 'E' && livresE.some((x) => x.localId === reg.localId) && !livresE.some((x) => x.localId !== reg.localId))`.
   Ajuste o comentário da linha 144 para dizer "a última E livre (o alvo livre e nenhuma outra)".
3. Mutações (rode uma por vez, desfaça e cole a saída no relatório):
   - M1 tirar `x.localId !== reg.localId` → o caso canônico fica **vermelho**;
   - M2 tirar `livresE.some((x) => x.localId === reg.localId)` → o caso do alvo que não é livre fica **vermelho**.
4. Commit: `fix(pool): o piso do T2 só vale para a E livre e o teste usa o título canônico`.

### B · ritual: a vaga pedida vale até o clique, com prazo (achado 2)
Arquivo de teste: `plugins/orquestracao/hooks/tests/orquestradora-ritual.test.mjs`, junto dos `piso-1..6` (`:258`). Use `rodar(..., { env: { PISO_VAGA_MIN: '60' } })` onde o prazo importa. Ajudante novo no bloco: `marca(repo, minutos)` grava `join(base,'orq','piso', <chave>.json)` com `{ repo: <git common dir de repo>, em: minAtras(minutos), sessao: 'x' }`; a chave é calculada igual ao hook (exporte a função de chave do hook ou de `pool-comum.mjs` e importe no teste; não duplique a fórmula). O `repo` gravado é o mesmo valor que `gitCommonDir(repoA)` devolve: obtenha-o importando `gitCommonDir`, não montando o caminho à mão.
1. Testes vermelhos:
   - **(piso-7)** turno com `LIST, GRAVA, START` (título `E2 · livre`), sem E livre → `null` **e** a marca existe em `orq/piso/`, com `repo` não vazio igual ao do `repoA` e `em` parseável.
   - **(piso-8)** sem marca, `rodar([LIST, GRAVA])` → `block` com `sem E livre` (precondição); grave `marca(repoA, 30)`; de novo → `null`.
   - **(piso-9)** `marca(repoA, 61)` com `PISO_VAGA_MIN=60` → `block` com `sem E livre`.
   - **(piso-10)** `marca(repoA, 30)` e `livre('local_E2','E2 · livre')` → `null` e a marca **sumiu**; tire a E2 (apague o registro) → `block`.
   - **(piso-11)** marca de `repoB` → `block` (não vale para `repoA`).
   - **(piso-12)** turno com `start_session` de título `P3 · livre` → `null` (regra atual do turno) e **nenhuma** marca gravada; turno seguinte sem `start_session` → `block`.
   - **(piso-13)** marca com JSON inválido → `block`, e o hook sai com status 0.
   Rode e confirme que 7, 8 e 10 ficam vermelhos pelo motivo certo (marca ausente / cobrança repetida), e que 9, 11, 12 e 13 já passam ou falham pelo motivo esperado; anote no relatório.
2. Código em `orquestradora-ritual.mjs`:
   - constante `PISO_VAGA_MIN` como `ESPERA_MIN` (`:20`), padrão 720;
   - funções `chaveDoPiso(repo)`, `lerMarca(repo)`, `gravarMarca(repo, sessao)`, `apagarMarca(repo)` sobre `join(BASE, 'piso')` (`mkdirSync` recursivo ao gravar; `BASE` de `hooks-crewai-comum.mjs`). Exporte só o que o teste precisa (a chave), sem mudar o `main`;
   - `faltaPiso(cwd, usadas, startsDeE, sessao)`: ordem — modo ausente → `null`; repo nulo → `null`; há E livre → `apagarMarca(repo)` e `null`; turno com `start_session` → se `startsDeE` grava a marca; `null`; marca no prazo → `null`; senão a frase atual (sem mudar o texto, os testes `piso-1/5` dependem dele);
   - no laço do `main` (`:108`), junte `startsDeE` = algum `tool_use` terminado em `start_session` com `input.title` casando `/^E\d+\b/`.
   - Comentário de uma linha acima de `faltaPiso` citando a marca e o prazo.
3. Mutações (uma por vez, cole a saída): sem apagar a marca com E livre → piso-10 vermelho; sem o filtro de título de E → piso-12 vermelho; prazo ignorado → piso-9 vermelho.
4. Commit: `fix(pool): o ritual lembra a vaga de E já pedida e não duplica o cartão`.

### C · texto e versão
1. `plugins/orquestracao/pool/protocolo.md:92` e `plugins/orquestracao/skills/orquestradora/SKILL.md:70`: acrescente uma frase igual nos dois — "O cartão de vaga de E já proposto conta por até 12 h (`PISO_VAGA_MIN`), ou até aparecer E livre: não proponha outro nesse prazo." Nada mais nesses arquivos.
2. `plugins/orquestracao/.claude-plugin/plugin.json` 0.1.39 → 0.1.40 e `test/cli.test.mjs:50` para `'0.1.40'`.
3. Commit: `docs(pool): o piso de E conta o cartão de vaga já proposto` (versão no mesmo commit).

## Critério de pronto (medível)
- `node --test plugins/orquestracao/hooks/tests/orquestradora-ritual.test.mjs` verde, com `piso-1` a `piso-13`; saída colada.
- `node --test plugins/orquestracao/hooks/tests/papel-do-pool.test.mjs` com exit 0 e nenhuma linha `FAIL` (o arquivo usa o próprio `caso()`); saída colada.
- As cinco mutações (M1, M2 da parte A; três da parte B) ficam vermelhas, cada uma com a saída colada, e o código volta ao certo.
- `grep -n "PISO_VAGA_MIN" plugins/orquestracao/pool/protocolo.md plugins/orquestracao/skills/orquestradora/SKILL.md plugins/orquestracao/hooks/orquestradora-ritual.mjs` acha os três.
- `claude plugin validate .` e `claude plugin validate plugins/orquestracao --strict` passam.
- Gate `npm test`: rode uma vez. Se falhar por tempo em testes que o diff não toca (c5–c8, c14, k7, painel-fila etc., como na validação do PR 40), rode esses isolados com `--test-concurrency=1` e cole os dois resultados; não afirme verde sem a saída.
- PR aberto para `main` com rebase em dia, número mandado à orquestradora do kit. Não mergear.

## Fora de escopo
- A cobrança de vaga de item esperando papel (`cobrancaDeEspera`, `:48`) tem o mesmo defeito do turno corrente. Não mexer: se valer, vira item novo (citar no relatório).
- O piso entre projetos (alvo livre de projeto sem orquestradora se arquiva mesmo sendo a última): aceito na validação.
- `dismiss_task` apagar a marca: não; o prazo e a E livre cobrem.
- Mudar o texto da cobrança, o T2 fora do piso, os outros papéis (P, D, V continuam sob demanda).
- Nada em `~/.claude/` real; nada no repositório Izanagi.

## Regras do projeto
Node ≥ 20, ESM, só módulos nativos (`node:crypto`, `node:fs`), `node:test`, `process.exitCode` (nunca `process.exit()`), testes com `HOME`/`HOOKS_CREWAI_BASE`/`POOL_APP_SESSOES_DIR` em pasta temporária, processo filho síncrono com `timeout` e `killSignal: 'SIGKILL'`. Commits convencionais em PT-BR, sem citar ADR no título, terminando com a linha `Co-Authored-By` do modelo.
