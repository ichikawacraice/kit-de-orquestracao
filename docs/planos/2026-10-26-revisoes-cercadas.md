# F61 · a pasta de revisões não deixa o designer gravar fora dela

Origem: achados B1 e B2 do laudo da validação do F60 (PR #26, main `052007a`). Branch: `claude/f61-revisoes-cercadas`, a partir de `origin/main`.

## O caso
A trava `subagente-nao-edita` libera o `design:designer` (sem lista da máquina) para gravar só na pasta de revisões do projeto (`design.revisoes` do `.claude/kit.json`, padrão `docs/design/revisoes`). Medido no laudo do F60, com o código de `052007a`:
- **B1.** `design.revisoes` igual a `.`, `..` ou a um caminho absoluto (ex.: `$HOME`) faz a "pasta de revisões" virar o projeto inteiro ou algo acima dele: `src/a.ts` sai sem decisão (devia ser `deny`).
- **B2.** A comparação é por texto. Um symlink dentro da pasta de revisões (`revisoes/link → ../../src`), ou a própria pasta sendo um symlink para `src`, leva a escrita para fora: `revisoes/link/a.ts` sai sem decisão.

## Decisões (assumidas, a confirmar; reversíveis)
- **D1. Valor inválido vale o padrão**, como já vale para `kit.json` ilegível. Inválido = absoluto, com algum segmento `..`, ou que resolve para a própria raiz (`.`, `./`, `docs/..`). Motivo: o designer continua com uma pasta de revisões que funciona; negar tudo travaria o fluxo de design por um erro de configuração.
- **D2. A comparação é pelo caminho real, e a pasta de revisões não pode passar por symlink.** Com `realRaiz = realpathSync(raiz)` e `esperada = resolve(realRaiz, rel)`:
  - o caminho real da pasta de revisões (do ancestral que existe, mais o resto) tem de ser igual a `esperada`; se a própria pasta, ou uma pasta no caminho entre a raiz e ela, é symlink, não libera;
  - o caminho real do arquivo (mesma regra do ancestral que existe) tem de começar com `esperada + '/'`.
  - Motivo: comparar só `realpath(p)` com `realpath(pasta)` deixa passar a pasta que é ela mesma symlink para `src` (os dois lados caem em `src`).
- **D3. Na dúvida, nega.** Qualquer erro dentro da checagem do designer (ex.: `realpathSync` de symlink quebrado) faz `designerNaRevisao` devolver `false`, com o erro capturado ali dentro. Hoje um erro sobe até o `catch` do `main`, que registra e deixa passar (falha aberta).
- **D4. "Existe" usa `lstatSync`**, não `existsSync`: um symlink quebrado existe. Assim `revisoes/novo.ts → ../../src/novo.ts` (alvo ainda não criado) cai no `realpathSync` do próprio link, que lança, e D3 nega. Com `existsSync`, o ancestral seria `revisoes/` e o link passaria.
- Fica de fora (já é assim e o laudo explica): Bash não é coberto; a trava é cerca de política, não fronteira de segurança.

## Arquivos
- `plugins/orquestracao/hooks/subagente-nao-edita.mjs` — `pastaDeRevisoes`, `designerNaRevisao`, um helper `caminhoReal(p)`; comentário do topo (linhas 10–12) passa a dizer que a pasta de revisões é cercada (valor inválido vale o padrão; symlink não libera).
- `plugins/orquestracao/hooks/tests/hooks-crewai.test.mjs` — casos F61, logo depois do F60.6. Use os helpers que já existem (`comRepo`, `REV`, `LISTA`, `rodar`, `editar`, `sub`, `decisao`, `log`). `symlinkSync` entra no import de `node:fs`.
- `plugins/orquestracao/.claude-plugin/plugin.json` — `version` `0.1.31` → `0.1.32`.
- `test/cli.test.mjs:50` — `'0.1.31'` → `'0.1.32'`.

## Passos (teste antes do código; o vermelho falha pelo motivo certo)

### Commit 1 — B1: `fix(orquestracao): design.revisoes inválido vale a pasta padrão`
1. Escreva **F61.1 valor inválido de design.revisoes vale o padrão** (dentro de `comRepo`, escrevendo o `kit.json` como o F60.3 faz). Para cada `v` em `['.', './', '..', 'docs/..', 'docs/../..', REPO, homedir(), '/']`:
   - `editar(\`${REPO}/src/a.ts\`, sub('design:designer'))` → `deny` (mensagem com `v`);
   - `editar(\`${REPO}/${REV}/a.md\`, sub('design:designer'))` → `null` (o padrão vale).
   - Precondição no começo do caso: com `v = 'docs/ux'`, `docs/ux/a.md` dá `null` e `src/a.ts` dá `deny` (prova que o `kit.json` é lido e que a trava nega `src` quando a pasta é boa).
2. Rode só esse arquivo (`node --test plugins/orquestracao/hooks/tests/hooks-crewai.test.mjs`) e **cole a saída vermelha**: tem de falhar no `src/a.ts` com `.` (esperado `deny`, veio `null`). Se falhar por outro motivo (import, precondição), conserte o teste antes.
3. Conserto em `pastaDeRevisoes(raiz)`: depois do `trim`/tirar a barra final, se `rel` é absoluto (`isAbsolute`), tem segmento `..` (`rel.split(/[\\/]+/).includes('..')`) ou `resolve(raiz, rel) === raiz`, use o padrão. Devolva o caminho **relativo** validado (D2 precisa dele), não mais o absoluto; ajuste o chamador.
4. Rode de novo: F61.1 e todos os F60 verdes. Commit.

### Commit 2 — B2: `fix(orquestracao): symlink não leva o designer para fora da pasta de revisões`
5. Escreva **F61.2 symlink não tira o designer da pasta de revisões** (dentro de `comRepo`; `mkdirSync(join(REPO, 'src'))`):
   - precondição: `${REPO}/${REV}/a.md` (arquivo comum, pasta real) dá `null`;
   - `REV/link → REPO/src` (symlink de pasta): `${REPO}/${REV}/link/a.ts` → `deny`;
   - `REV/novo.ts → REPO/src/novo.ts` (symlink quebrado, alvo inexistente): `${REPO}/${REV}/novo.ts` → `deny`;
   - a própria pasta é symlink: apague `REV`, `symlinkSync(join(REPO,'src'), join(REPO, REV))`: `${REPO}/${REV}/a.ts` → `deny`.
6. Escreva **F61.3 o projeto aberto por um caminho com symlink continua liberado** (cerca contra bloquear demais, o caso `/var` × `/private/var` do macOS): `alias = join(homedir(), 'alias')`, `symlinkSync(REPO, alias)`; `${alias}/${REV}/a.md` → `null` e `${alias}/src/a.ts` → `deny`. Apague o `alias` no `finally`.
7. Rode e **cole a saída**: F61.2 vermelho nos três `deny` (veio `null`); F61.3 verde (é cerca: tem de passar antes e depois).
8. Conserto:
   - `caminhoReal(p)`: sobe de `p` até o primeiro ancestral que existe por `lstatSync` (try/catch), aplica `realpathSync` nele e junta o resto (`relative` + `join`). Pode lançar.
   - `designerNaRevisao(tipo, p)`: tudo dentro de `try { … } catch { return false; }` (D3). `realRaiz = realpathSync(raiz)`; `esperada = resolve(realRaiz, rel)`; libera só se `caminhoReal(resolve(raiz, rel)) === esperada` **e** `caminhoReal(p).startsWith(esperada + '/')`.
9. Rode: F61.2, F61.3, F61.1 e F60.* verdes. Commit.

### Commit 3 — versão: `chore(orquestracao): 0.1.32 para o cache pegar o F61`
10. `plugin.json` e `test/cli.test.mjs:50` em `0.1.32`.
11. Gate: `npm test`; `claude plugin validate .`; `claude plugin validate plugins/orquestracao --strict`. Cole as linhas de resumo.

## Critério de pronto (medível)
- `npm test` com `fail 0`; os dois `validate` com exit 0.
- No relatório, a saída vermelha real de F61.1 (passo 2) e de F61.2 (passo 7), e a verde final.
- Os 17 casos da seção 3 do laudo do F60 refeitos à mão (ou um script) dão: os quatro B1 e os dois B2 agora `deny`; os demais iguais ao laudo.
- Três commits, na ordem acima, em `claude/f61-revisoes-cercadas`, empurrada; PR aberto contra `main` com rebase em dia, título `fix(orquestracao): a pasta de revisões não deixa o designer gravar fora dela`, corpo em PT-BR.

## Fora de escopo
- Bash do subagente, a lista `subagente-pode-escrever.txt`, `tipoLiberado`, `semPrefixoDoKit`, o plugin `design` (versão e guarda), `c14.test.mjs`.
- Validar o `design.revisoes` em outro lugar (CLI, `kit validar`): só a trava.
- Mergear: quem mergeia é a orquestradora.

## Regras do projeto que tocam
- Node ≥ 20, ESM, só módulos nativos; testes em `node:test`; nunca `process.exit()`.
- Testes nunca tocam `~/.claude` real: o arquivo de teste já aponta `HOME` para pasta própria fora de `/tmp` — não mude isso; crie tudo sob `homedir()`/`REPO`.
- Teste que mede ausência prova antes que a presença seria detectada (as precondições dos passos 1 e 5).
- Commits conventional em PT-BR, sem citar ADR no título.
