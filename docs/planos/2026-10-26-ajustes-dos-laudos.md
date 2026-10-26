# Ajustes que as validações sugeriram e ficaram sem dono (F66)

Pedido do operador (26/10): *"ajustar os pontos que a validadora trouxe para ajuste"*. Três sugestões de laudos de hoje, num PR só, um commit por ponto. Branch: `f66-ajustes-dos-laudos`, a partir de `origin/main` (69850a4 ou mais novo).

## O que foi medido (planejadora, 26/10)

### Ponto 1 · recusa por link simbólico sem motivo (laudo F61, B1)
- `plugins/orquestracao/hooks/subagente-nao-edita.mjs:75-86`: `designerNaRevisao` devolve só `true`/`false`. Quando a pasta de revisões (ou o arquivo) passa por um symlink que leva para fora dela, cai no `deny` genérico das linhas 111-121 (*"Subagente não grava arquivo do projeto"*) e o log grava `recusou`, igual à recusa de quem escreve em `src/`.
- A recusa é a decisão D2 do plano da pasta de revisões e **continua**. Muda só o texto e o log.

### Ponto 2 · `## Platform` do PRODUCT.md (laudo K16, O3)
- `modelos/front/PRODUCT.md:7-9` traz `## Platform` seguido de `<!-- web | mobile | desktop -->`.
- O impeccable 4.1.1 (`skills/impeccable/scripts/context.mjs`, `extractSectionValue` e `extractPlatform`) lê **a primeira linha não vazia** depois do título como valor. O comentário vira o valor, não é reconhecido, e o `context.mjs` emite `WARNING: PRODUCT.md's ## Platform value … is not recognized; treating the project as web`.
- Além disso, a lista do comentário está errada: os valores que o impeccable aceita são `web`, `ios`, `android` e `adaptive` (iOS e Android de uma base só). `mobile` e `desktop` não existem para ele.
- A sugestão da V ("preencher com a plataforma passada em `--design`") parte de um engano: `--design` recebe a **pasta** do front (`cli/kit.mjs:20-25`, `--design apps/web`), não a plataforma. No K16 a pasta se chamava `web`, daí a leitura. Não há plataforma para repassar.
- **Decisão (assumida, a confirmar):** o modelo grava `web` como valor e põe a lista correta num comentário **depois** do valor. `web` é o que o impeccable já assume quando não acha o campo, então nenhum projeto muda de comportamento; só some o aviso. Projeto nativo troca a linha. Alternativas no fim.
- Alcance: o modelo só é copiado em projeto que ainda não tem o arquivo (`cli/pacote.mjs:328-330`). Projeto que já rodou `kit iniciar --design` continua com o comentário; não há migração (fora de escopo).

### Ponto 3 · o crítico diz que o impeccable não está instalado (laudo K16, O2)
- O agente `plugins/design/agents/critico-de-ui.md` (tools: Read, Glob, Grep, Bash; skill pré-carregada: só `critica-de-ui`) e a skill `plugins/design/skills/critica-de-ui/SKILL.md:26` mandam rodar *"o detector dele"* **sem dizer onde ele está nem como se chama**.
- O impeccable instalado como plugin mora em `~/.claude/plugins/cache/impeccable/impeccable/<versão>/skills/impeccable/scripts/detect.mjs` (registrado em `~/.claude/plugins/installed_plugins.json`, chave `impeccable@impeccable`, com `installPath` e `scope` user/project/local). A própria skill do impeccable só acha o script pelo *base directory* que o runtime informa quando **a skill impeccable está carregada**; sem isso, o caminho reserva dela é `.claude/skills/impeccable/scripts/detect.mjs` na pasta do projeto, que não existe numa instalação por plugin.
- O crítico não tem a skill impeccable carregada, então não tem nenhum caminho que funcione: procura, não acha e conclui que não está instalado. **A causa é do kit** (a instrução não dá o caminho), não do impeccable nem do ambiente. Não reproduzi o turno do crítico do K16; a conclusão sai da leitura das duas instruções e do arquivo de instalação, e o teste do passo 3.1 é a prova que fica.
- **Conserto:** um script do plugin `design` que acha o `detect.mjs` instalado e imprime o caminho; o agente e a skill passam a chamá-lo.

## Passos

Teste antes do código em cada ponto (`superpowers:test-driven-development`): o teste novo falha com o código antigo pelo motivo certo; cole a saída vermelha no relatório.

### 1. Recusa por symlink com motivo (`fix(orquestracao): …`)
1. Teste em `plugins/orquestracao/hooks/tests/hooks-crewai.test.mjs`, junto dos `F61.*`: caso `F66.1` com `docs` em symlink para `outra/` **dentro** do repo (`outra/design/revisoes/` existe) e o designer gravando `docs/design/revisoes/x.md`. Afirma: (a) a decisão é `deny`; (b) o motivo cita link simbólico (regex `/link simb[oó]lico/i`) e a pasta de revisões configurada; (c) a última linha do log tem `recusou-symlink`. Repita (b) e (c) para os três cenários do `F61.2` (symlink de pasta dentro da revisão, symlink quebrado, a própria pasta é symlink).
2. Cerca no mesmo caso: designer gravando em `src/a.ts` (fora da pasta, sem symlink) continua com o motivo genérico e log `recusou`, **sem** "link simbólico". Prove antes que a regex pegaria a frase (afirme que o motivo do symlink casa).
3. Código: `designerNaRevisao` passa a devolver `'liberado'`, `'symlink'` ou `false`. `'symlink'` quando o caminho, lido sem resolver links (`resolve(raiz, rel) + '/'` como prefixo de `p`), está dentro da pasta de revisões, mas o caminho real não está (qualquer das duas comparações da linha 82 falha) **ou** a resolução lançou erro depois de `raiz` e `rel` calculados (é o symlink quebrado: `realpathSync` lança nele). Erro antes disso, ou caminho que nem lido sem links está na pasta, continua `false` (D3: na dúvida, nega). Em todos os casos a decisão continua `deny`; só o motivo muda. Em `main`, `'symlink'` registra `recusou-symlink` e devolve `deny` com o motivo: o caminho passa por um link simbólico, e o designer só grava na pasta de revisões real (`<rel>`); troque o link por uma pasta ou aponte `design.revisoes` do `.claude/kit.json` para o caminho real. Mantenha a frase final atual (devolver no relatório o que gravaria).
4. Atualize o comentário do topo (linhas 12-13) com uma frase sobre o `recusou-symlink`, e a lista de rótulos do log em `plugins/orquestracao/skills/papeis-e-modelos/SKILL.md:43` (`recusou`, `recusou-symlink`, `liberado-por-tipo`, …).

### 2. Plataforma no modelo de PRODUCT.md (`fix(cli): …`)
1. Teste em `test/modelos.test.mjs`: a primeira linha não vazia depois de `## Platform` em `modelos/front/PRODUCT.md` existe, não é comentário e é um de `web`, `ios`, `android`, `adaptive`. Reproduza a regra do impeccable no teste (primeira linha não vazia até o próximo título), sem importar o impeccable (o kit não tem dependência). Afirme antes que a seção existe.
2. Modelo: troque a linha 9 por `web` e, depois de uma linha em branco, o comentário `<!-- Um de: web · ios · android · adaptive (iOS e Android de uma base só). O Impeccable lê a primeira linha desta seção. -->`.
3. O `test/processos.test.mjs:67` compara a cópia com o modelo e continua valendo sem mudança; rode-o.

### 3. O crítico acha o detector instalado (`fix(design): …`)
1. Teste novo `plugins/design/hooks/tests/achar-detector.test.mjs` (`node:test`, `HOME` em pasta temporária, processo filho síncrono com `timeout` e `killSignal: 'SIGKILL'`). Casos:
   - `installed_plugins.json` com `impeccable@impeccable` de `scope: user` e `installPath` com `skills/impeccable/scripts/detect.mjs` existente → imprime esse caminho, sai 0.
   - entrada de `scope: project` cujo `projectPath` é a pasta atual (ou um ancestral dela) ganha da de `user`.
   - entrada de `scope: project` de outro projeto é ignorada.
   - sem plugin, mas com `<raiz do projeto>/.claude/skills/impeccable/scripts/detect.mjs` → esse caminho.
   - `installPath` registrado sem o `detect.mjs` no disco e nada mais → sai 1 e o stderr diz que o Impeccable não foi encontrado e lista os lugares conferidos.
   - `installed_plugins.json` ilegível → não lança; segue para os outros lugares.
2. Script `plugins/design/skills/critica-de-ui/scripts/achar-detector.mjs` (ESM, só módulos nativos, `process.exitCode`). Ordem: entradas de `impeccable@*` em `~/.claude/plugins/installed_plugins.json` (`project`/`local` cujo `projectPath` contém o `cwd`, depois `user`); depois `<raiz>/.claude/skills/impeccable/scripts/detect.mjs` (raiz = ancestral com `.git` ou `.claude/kit.json`); depois `~/.claude/skills/impeccable/scripts/detect.mjs`. Imprime o primeiro que existe.
3. Skill `critica-de-ui/SKILL.md:26` e agente `critico-de-ui.md:16`: dizer como achar e rodar o detector, de dentro da pasta do front: `node "$(node "${CLAUDE_PLUGIN_ROOT}/skills/critica-de-ui/scripts/achar-detector.mjs")" --json .` (ou em dois passos). Se o script sair 1, aí sim siga sem o detector e diga isso na crítica com o motivo que ele imprimiu. Saída `DEGRADED` do detector (dependências de parser ausentes) entra como observação, não como "não instalado".
4. Teste de concordância (convenção do repo: doc × código): o caminho do script citado na skill existe no plugin.

### 4. Versões e gate
1. `plugins/orquestracao/.claude-plugin/plugin.json` → `0.1.34` e `test/cli.test.mjs:50` no mesmo valor; `plugins/design/.claude-plugin/plugin.json` → `0.2.2`. Se a main já tiver subido alguma delas quando você rebasear, suba a partir da nova.
2. Gate: `npm test` verde; `claude plugin validate .` e `claude plugin validate plugins/design --strict` e `plugins/orquestracao --strict`.
3. Push da branch, PR para `main` com o rebase em dia. Não mergeie.

## Critério de pronto (medível)
- Os testes novos falham no código antigo pelo motivo certo (saída colada) e passam no novo.
- `F61.1`–`F61.3` continuam verdes, sem mudar o que afirmam.
- `grep -n "web | mobile | desktop" modelos` não acha nada.
- `node plugins/design/skills/critica-de-ui/scripts/achar-detector.mjs` nesta máquina imprime um caminho que existe (cole a saída).
- `npm test` com `fail 0`, e os três `claude plugin validate` sem erro.

## Fora de escopo
- O detector rodar em modo reduzido por falta de dependências (`htmlparser2` & cia., K16 D3): é do ambiente.
- Os achados B2 e B3 do laudo F61 (informativos).
- A recusa por symlink em si (D2): continua recusando.
- Migrar o PRODUCT.md de projetos que já existem.
- `plugins/painel-sessoes/hooks/barra.tsx` (a P1 está nele).
- O hook `guarda-de-design.mjs` e o designer.

## Regras do projeto (do CLAUDE.md)
- Node ≥ 20, ESM, só módulos nativos; testes em `node:test`; `process.exitCode`, nunca `process.exit()`.
- Testes nunca tocam o `~/.claude` real: `HOME` em pasta temporária.
- Commits conventional em PT-BR, sem citar ADR nem item no título.
- Teste que inspeciona um valor afirma antes que ele existe; teste de ausência prova antes que a presença seria detectada.

## Alternativas consideradas
- **Ponto 2, passar a plataforma pelo CLI** (`--plataforma web|ios|…`): flag nova para um valor que quase todo projeto do kit tem igual a `web`. Rejeitada por ora; dá para acrescentar se aparecer projeto nativo.
- **Ponto 2, apagar a linha e deixar a seção vazia:** o impeccable trata seção vazia como `web` sem aviso, mas a pessoa perde a dica de que o campo existe e quais valores aceita. Rejeitada.
- **Ponto 3, pré-carregar a skill `impeccable` no crítico (`skills:` do agente):** traria o *base directory*, mas carrega a skill inteira (centenas de linhas e regras de design) num agente que só precisa do detector, e quebra o agente onde o impeccable não está instalado. Rejeitada.
- **Ponto 3, `ls ~/.claude/plugins/cache/impeccable/*/…` direto na instrução:** ignora instalação por projeto e versão antiga deixada no cache. Rejeitada a favor do `installed_plugins.json`.
