# F60 — o designer grava a revisão, e `.html` conta como tela

- **Data:** 2026-10-26 · **Planejadora:** sessão F60 · **Branch:** `claude/f60-designer-html` (sobre a main em `f507414`)
- **Origem:** laudo da prova K16 (`~/.claude/orquestracao/pool/handoffs/K16-laudo.md`), defeitos D1 e D2. O D3 (impeccable em modo DEGRADED) é da máquina e fica fora.

## O que foi medido (26/10, nesta árvore)

- **D1, a trava.** `plugins/orquestracao/hooks/subagente-nao-edita.mjs` recusa `Edit`/`Write`/`MultiEdit`/`NotebookEdit` de subagente (evento com `agent_id`) fora das pastas livres. A única exceção é a lista da máquina `~/.claude/orquestracao/subagente-pode-escrever.txt`, casada em `tipoLiberado` contra o tipo cru e contra `semPrefixoDoPlugin(tipo)`.
- **`semPrefixoDoPlugin`** (`plugins/orquestracao/hooks/hooks-crewai-comum.mjs:12`) só tira `orquestracao:`. O agent do plugin `design` chega como `design:designer`, que não casa com a linha `designer` da lista. É o caso do laudo.
- **A lista nasce vazia.** `cli/pacote.mjs` (`CABECALHO_SUBAGENTES`) grava só o cabeçalho, "vazio de propósito". Então, numa máquina nova, consertar só o prefixo não basta: o `iniciar --design` liga o designer e a trava continua recusando, porque ninguém escreveu `designer` na lista.
- **`semPrefixoDoPlugin` tem outros usos** que decidem quem é executor ou validador do pool (`executor-criterio.mjs:255`, `pool-comum.mjs:336`, `papel-do-pool.mjs:100`, `skill-do-papel.mjs:19`). `test/c14.test.mjs` exige que `outro:executor` não seja tratado como executor. Mudar a função para tirar qualquer prefixo mexeria nesses quatro.
- **O designer já tem guarda própria de escopo.** `plugins/design/hooks/guarda-de-design.mjs` nega ao designer o código de tela (`design.negadoAoDesigner`). A pasta onde ele grava é `design.revisoes` do `.claude/kit.json` (padrão `docs/design/revisoes`, `modelos/kit.json:52`). Nenhum hook lê essa chave hoje.
- **D2.** `guarda-de-design.mjs:56`: `EXTENSOES_DE_TELA = ["tsx", "jsx", "vue", "svelte", "css", "scss"]`. Sem `design.visual`, o padrão derivado de `design.pasta` não conta `web/index.html`. O teste `plugins/design/hooks/tests/guarda-de-design.test.mjs:123` fixa essa lista.
- **Versões:** `orquestracao` 0.1.29 (fixada em `test/cli.test.mjs:50`), `design` 0.2.0.

## Decisões (todas *assumidas, a confirmar*: reversíveis e baratas)

- **D1 · A liberação é por papel e por pasta, embutida na trava.** O subagente cujo tipo, sem prefixo de plugin do kit, é `designer` grava sem precisar de linha na lista, **só dentro da pasta de revisões** do projeto (`design.revisoes` do `.claude/kit.json`, padrão `docs/design/revisoes`). Fora dela vale a regra de sempre: recusa, a menos que a lista da máquina o libere. Motivo: o fluxo "o designer grava a revisão" é do kit e tem de funcionar no `iniciar --design` sem passo à mão. Limitar à pasta mantém a decisão Q154 ("quem escreve é sessão") para todo o resto, e a guarda do `design` continua negando código de tela.
  - *Alternativa descartada:* só consertar o prefixo. Não resolve a máquina nova, porque a lista nasce vazia.
  - *Alternativa descartada:* semear `design:designer` na lista pelo `iniciar`. Libera o designer no projeto inteiro e depende de um arquivo de máquina que o operador edita.
- **D2 · O prefixo dos plugins do kit sai só na trava de escrita.** Função nova `semPrefixoDoKit` em `hooks-crewai-comum.mjs` tira `orquestracao:`, `design:`, `processos:` e `painel-sessoes:`. Só `subagente-nao-edita.mjs` a usa (na lista e na regra do designer). `semPrefixoDoPlugin` não muda, e os quatro usos do pool ficam como estão. `outro:x` e `impeccable:x` continuam chegando como chegam (a lista casa `impeccable:*` pelo tipo cru, como no caso 4.7).
- **D3 · Como achar a raiz do projeto sem git.** Sobe a partir da pasta do arquivo até a primeira pasta que tenha `.claude/kit.json` ou `.git` (arquivo ou pasta: worktree tem `.git` arquivo). Sem raiz achada, não há liberação embutida; a raiz é sempre a mais próxima do arquivo. `design.revisoes` que não seja texto não vazio vale o padrão. A pasta de revisões é comparada com o caminho já resolvido (`resolve`), então `docs/design/revisoes/../../src/a.ts` não escapa.
- **D4 · `html` entra nas extensões de tela.** `EXTENSOES_DE_TELA` ganha `"html"`. Como `negadoAoDesigner` deriva do mesmo padrão, o designer passa a ter `web/**/*.html` negado. É o certo: HTML é código de tela. `astro`, `htm` e outros ficam fora até um projeto pedir.
- **D5 · Versões:** `orquestracao` 0.1.30, `design` 0.2.1. Quem mergear depois acerta no rebase.

## Bloco único — executora (Sonnet, médio)

Os dois defeitos tocam arquivos separados, mas o PR é um só. A ordem abaixo põe cada vermelho antes do seu código.

### Arquivos

- `plugins/orquestracao/hooks/tests/hooks-crewai.test.mjs`: casos novos `F60 …` logo depois do caso `K2 subagente-nao-edita` (linha ~484).
- `plugins/orquestracao/hooks/hooks-crewai-comum.mjs`: `semPrefixoDoKit`, ao lado de `semPrefixoDoPlugin`.
- `plugins/orquestracao/hooks/subagente-nao-edita.mjs`: `tipoLiberado` usa `semPrefixoDoKit`; regra embutida do designer; comentário do topo.
- `plugins/orquestracao/skills/papeis-e-modelos/SKILL.md:43`: a frase "Exceção por papel…" ganha a exceção embutida do designer.
- `plugins/design/hooks/tests/guarda-de-design.test.mjs`: o caso `A2` (linha ~120) e um caso novo do designer com `.html`.
- `plugins/design/hooks/guarda-de-design.mjs`: `EXTENSOES_DE_TELA`.
- `plugins/orquestracao/.claude-plugin/plugin.json` (0.1.30), `test/cli.test.mjs:50` (0.1.30), `plugins/design/.claude-plugin/plugin.json` (0.2.1).

### Passos

1. **Vermelho do D1.** Em `hooks-crewai.test.mjs`, depois do caso `K2 subagente-nao-edita`, acrescente (use `caso`, `rodar`, `editar`, `sub`, `decisao`, `igual`, `log`, `REPO`, `base` que já existem):
   - `F60.1 design:designer sem lista grava na pasta de revisões padrão`. Monte `mkdirSync(join(REPO, '.git'), { recursive: true })` (o `REPO` mora no HOME do teste, fora das pastas livres; apague `REPO` no fim do caso com `rmSync(REPO, { recursive: true, force: true })`). Precondições: `existsSync(join(base, 'subagente-pode-escrever.txt')) === false`, e `sub('executor')` em `${REPO}/docs/design/revisoes/a.md` dá `deny` (prova que a trava pegaria). Depois: `sub('design:designer')` em `${REPO}/docs/design/revisoes/2026-10-26-a.md` → `null`, e `Write` em `${REPO}/docs/design/revisoes/README.md` → `null`. O log tem `liberado-por-papel`.
   - `F60.2 o designer fora da pasta de revisões continua recusado`. Mesmo `REPO` com `.git`: `sub('design:designer')` em `${REPO}/web/index.html`, `${REPO}/CLAUDE.md` e `${REPO}/docs/design/revisoes/../../src/a.ts` → `deny` nos três.
   - `F60.3 design.revisoes do kit.json manda`. Grave `${REPO}/.claude/kit.json` com `{"design":{"revisoes":"docs/ux"}}`: `${REPO}/docs/ux/a.md` → `null`, `${REPO}/docs/design/revisoes/a.md` → `deny`. Com `{"design":{"revisoes":""}}`, volta o padrão (`docs/design/revisoes/a.md` → `null`).
   - `F60.4 a pasta de revisões é a do projeto mais próximo`. Crie `join(homedir(), 'solto', 'docs/design/revisoes')` sem `.git` nem `.claude/kit.json` em `solto` (confira antes com `existsSync`): `sub('design:designer')` em `join(homedir(), 'solto', 'docs/design/revisoes/a.md')` → `deny`. Ao subir, a raiz achada é outra pasta (o checkout do kit, acima do HOME do teste), e a pasta de revisões dela não contém o arquivo. Apague `solto` no fim.
   - `F60.5 a lista casa o prefixo de qualquer plugin do kit`. Lista `designer\n`: `sub('design:designer')` em `${REPO}/apps/web/a.tsx` → `null` (a lista libera em todo o projeto, como hoje). `sub('outro:designer')` no mesmo caminho → `deny`. `sub('design:executor')` com lista `executor\n` → `null`; `sub('outro:executor')` → `deny`.
   - `F60.6 os outros tipos não ganham a pasta de revisões`: sem lista, `sub('designerX')`, `sub('design:critico-de-ui')` e `sub('executor')` em `${REPO}/docs/design/revisoes/a.md` → `deny`.
2. Rode `node plugins/orquestracao/hooks/tests/hooks-crewai.test.mjs` e cole a saída: F60.1, F60.3 e F60.5 têm de falhar no `null` esperado (veio `deny`), não em precondição. F60.2, F60.4 e F60.6 já passam: são as cercas.
3. **Código do D1.**
   - Em `hooks-crewai-comum.mjs`, ao lado de `semPrefixoDoPlugin`:
     ```js
     // Os plugins do kit (`design:designer`, `processos:x`): a trava de escrita casa o papel sem o prefixo de qualquer um deles.
     // Só ela usa esta forma; as travas do pool seguem com `semPrefixoDoPlugin`, que só tira `orquestracao:`.
     export const semPrefixoDoKit = (nome) => String(nome ?? '').replace(/^\/?(?:orquestracao|design|processos|painel-sessoes):/, '');
     ```
   - Em `subagente-nao-edita.mjs`:
     - `tipoLiberado` troca `semPrefixoDoPlugin(tipo)` por `semPrefixoDoKit(tipo)`.
     - Função `raizDoProjeto(p)`: sobe de `dirname(p)` até achar uma pasta com `.claude/kit.json` ou `.git` (`existsSync`); devolve a pasta, ou `null` ao chegar em `/`.
     - Função `pastaDeRevisoes(raiz)`: lê `raiz/.claude/kit.json` se existir (`JSON.parse`, tirando BOM; erro de leitura ou JSON ruim = padrão); `design.revisoes` texto não vazio, sem `/` no fim, senão `docs/design/revisoes`. Devolve `resolve(raiz, valor)`.
     - Função `designerNaRevisao(tipo, p)`: `semPrefixoDoKit(tipo) === 'designer'`, raiz achada e `p.startsWith(pastaDeRevisoes(raiz) + '/')`.
     - Em `main`, depois do `tipoLiberado` e antes do `recusou`: se `designerNaRevisao(e.agent_type, p)`, registra `liberado-por-papel` com `${quem} ${e.tool_name} ${p}` e sai sem decisão.
     - Comentário do topo: a linha da exceção por papel ganha "e o designer do kit grava na pasta de revisões (`design.revisoes`) sem lista".
4. Rode de novo o arquivo de teste do passo 2 e cole a saída: todos `ok`, `falhas` zero.
5. **Doc do D1.** Em `plugins/orquestracao/skills/papeis-e-modelos/SKILL.md:43`, depois de "Exceção por papel em `~/.claude/orquestracao/subagente-pode-escrever.txt` (…)", acrescente: "; a lista casa o tipo com ou sem o prefixo de um plugin do kit. Sem lista, o `designer` do kit grava só na pasta de revisões do projeto (`design.revisoes` do `.claude/kit.json`, padrão `docs/design/revisoes`) e registra `liberado-por-papel`." Acrescente `liberado-por-papel` à lista de desfechos do log na mesma frase.
6. **Vermelho do D2.** Em `guarda-de-design.test.mjs`:
   - caso `A2` (linha ~123): a lista esperada passa a ser `['tsx', 'jsx', 'vue', 'svelte', 'css', 'scss', 'html']`, e acrescente `assert.equal(eCodigoDeTela('/r/web/index.html', c.visual), true)` e `assert.equal(eCodigoDeTela('/r/web/index.html.md', c.visual), false)`.
   - caso novo no mesmo `describe`: `F60: com só design.pasta, o designer não grava web/index.html` — `kit({ design: { pasta: 'web' } })`, `c = lerConfig(pasta)`, `assert.equal(eCodigoDeTela('/r/web/index.html', c.negadoAoDesigner), true)`.
   - `describe` novo depois de `o hook de ponta a ponta…` (linha ~503), no mesmo molde dele (repo git em `mkdtempSync`, `KIT_DESIGN_ESTADO` e `HOME` temporários, `hook()` com `spawnSync` síncrono, `timeout` e `killSignal: 'SIGKILL'`), mas com `.claude/kit.json` = `{"design":{"pasta":"web"},"guarda":{"tronco":"origin/main"}}`. Caso `F60: só web/index.html mudou e o Stop cobra`: `UserPromptSubmit`, grava `web/index.html`, `Stop` → `decision: 'block'`. Antes, a cerca no mesmo repo: um turno que só grava `web/LEIAME.md` dá `Stop` → `null` (prova que o vermelho é pelo `.html`, não por qualquer arquivo na pasta).
7. Rode `node --test plugins/design/hooks/tests/guarda-de-design.test.mjs` e cole a saída: os casos do passo 6 falham pelo `html` que falta.
8. **Código do D2.** `EXTENSOES_DE_TELA = ["tsx", "jsx", "vue", "svelte", "css", "scss", "html"]`. Rode o teste do passo 7: verde.
9. **Versões.** `orquestracao` → `0.1.30` (`plugin.json` e `test/cli.test.mjs:50`); `design` → `0.2.1`.
10. **Gate.** `npm test`, `claude plugin validate .`, `claude plugin validate plugins/orquestracao --strict` e `claude plugin validate plugins/design --strict`. Cole o fim de cada saída com o código de saída.
11. Commits em PT-BR, convencionais, um por defeito mais o de versão:
    - `fix(orquestracao): o designer do kit grava a revisão sem a lista da máquina`
    - `fix(design): .html conta como tela para a guarda`
    - `chore: orquestracao 0.1.30 e design 0.2.1`

## Critério de pronto

- `node plugins/orquestracao/hooks/tests/hooks-crewai.test.mjs`: todos os casos `ok`, entre eles F60.1 a F60.6.
- `node --test plugins/design/hooks/tests/guarda-de-design.test.mjs`: `fail 0`, com o `html` no caso A2 e o caso F60.
- `npm test`: `fail 0`. Os quatro `claude plugin validate`: exit 0.
- Reprodução do laudo, colada no relatório: o evento `{"agent_id":"a1","agent_type":"design:designer","tool_name":"Write","tool_input":{"file_path":"<repo com .git>/docs/design/revisoes/x.md"},"cwd":"<repo>"}` passado ao hook com `HOOKS_CREWAI_BASE` num diretório temporário sem lista sai **sem** `permissionDecision`. O mesmo evento com `file_path` em `<repo>/src/a.ts` sai com `deny`. O repo de teste fica fora de `/tmp` e de `/var/folders`, que são pastas livres da trava (o scratchpad também é: mora em `/private/tmp`). Use `mktemp -d ~/f60-XXXX` e apague no fim.

## Fora do escopo

- D3 (detector do impeccable em modo reduzido), O1 (seção `Alternativas consideradas` sem conferência por máquina), O2 (o crítico não acha o impeccable), O3 (`## Platform` do PRODUCT.md em comentário).
- Mudar `semPrefixoDoPlugin` ou qualquer trava do pool.
- Outras extensões de tela (`astro`, `htm`, `mdx`).
- O `~/.claude/orquestracao/subagente-pode-escrever.txt` da máquina e o `CABECALHO_SUBAGENTES` do CLI.

## Regras do projeto que tocam o trabalho

- `CLAUDE.md` (raiz): Node ≥ 20, ESM, só módulos nativos; `process.exitCode`, nunca `process.exit()`; teste nunca toca `~/.claude` real (o teste da trava já aponta `HOME` e `HOOKS_CREWAI_BASE` para pastas próprias).
- `CLAUDE.md`, *Convenções de teste*: o vermelho falha pelo motivo certo; teste de ausência prova antes que a presença seria detectada (por isso F60.1 confere que `executor` é negado no mesmo caminho); processo filho síncrono com `timeout` e `killSignal: 'SIGKILL'` (o `rodar` já faz).
- Gate: `npm test` (`node --test`) mais `claude plugin validate`. Commits convencionais em PT-BR, sem citar ADR no título.
