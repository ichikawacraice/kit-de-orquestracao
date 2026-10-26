# F52 — a barra de status do kit, acima do prompt

- **Data:** 2026-10-26 · **Planejadora:** P3 · **Branch do plano:** `f52-barra-de-status` (sobre a main em `648c83f`)
- **Pedido do operador (26/10):** tirar o mod de terceiros que mostra a sessão acima do campo do prompt e criar um nosso, junto do sistema de orquestração, com comandos e informações básicas. Obrigatório: selo com as perguntas abertas (o clique abre o painel), botão de abrir e fechar o painel, botão que dá o ok para a orquestradora se limpar quando ela pedir, e a contagem regressiva do cache de 1 h.

## O que foi medido (26/10)

- **A faixa de hoje** é o `session-band` (claude-kit, `~/.claude/plugins/marketplaces/claude-kit/plugins/session-band/hooks/register.tsx`, 371 linhas, licença de outro autor: lido, não copiado). Ela usa `on('ui.render', { component: 'AbovePrompt' })`, devolve `next(e)` quando `e.props.hasSurvey` ou quando está escondida, e mede o cache assim: `expiresAt = agora + 1 h` no `turn.complete` sem `agentId`; um `$.clock.every(1000)` recalcula os segundos; moldura âmbar com ≤ 20 min e vermelha com ≤ 10 min, nunca enquanto `e.props.isWorking`; aviso aos 10 e 5 min (app nativo próprio, senão a ferramenta `PushNotification`, senão toast). Também mostra turno, tok/s, custo e o contexto em %.
- **API do motor (tipos desta build, `plugin-authoring/types/claude-code.d.ts`):**
  - `AbovePrompt` só é levantado no terminal e no desktop; props `hasSurvey`, `isWorking`, `maxRows`, `bodyColumns`, `scroll`, `view`. `Svg` só existe no desktop (`'Svg' in ui`).
  - Um plugin tem **um módulo** de hooks (`hooks.json` `modules`, um caminho). A faixa entra pelo `register.tsx` do `painel-sessoes`, com a lógica num arquivo próprio.
  - `$.session.usage()` dá `context.tokens` (tokens do contexto) e `context.window`.
  - `$.prompt.fill({ text })` põe um rascunho na caixa do prompt; a pessoa aperta Enter e o turno nasce com origem `composer` (humana). `$.prompt.submit` nasce com origem `plugin`.
- **O mod do painel** (`plugins/painel-sessoes/hooks/register.tsx`, main 1282 linhas): só lê os arquivos do painel enquanto o pane está aberto (`ligar`/`parar`); o `/painel` abre ou fecha (`deveFechar`, `mudarMarca`). `responder` (não exportado) grava a resposta e chama `entregar` (`send_message` à sessão dona, ou `$.prompt.submit` se a pergunta é desta sessão). `responder` usa `pastaLida`, que só existe **depois** da primeira leitura do pane: hoje, com o pane nunca aberto, ele falha com "a pasta do painel ainda não foi lida".
- **A limpeza da orquestradora (F48, PR #17, em validação, `origin/claude/f48-limpeza-e-header`):** a orquestradora com ≥ 250 mil abre a pergunta `limpar · orquestradora` (desde `fd3a5b5` só o título exato vale, como pedido e como ok; `sessaoId` dela) e só se limpa com ação humana: turno `human`, ou "sim" respondido **pelo painel**, provado por `respondidaPor: "painel"` e `respondidaEm` que só o `responder` do pane grava (vale 30 min). A F48 também traz `lerBandeira` e `alternarModo` (botão do modo ausente) no `register.tsx`, com o atom `trocandoModo`; `alternarModo` não faz nada enquanto `leitura.ausente` é `undefined`/`null`, isto é, enquanto o pane nunca leu.
- **Versões combinadas:** painel-sessoes 0.6.0 (F48) e 0.6.1 (F51, que mexe em `entregar` e pede para ninguém tocar em `responder`). A F52 fica com **0.7.0**.
- **Tetos de contexto por papel** (`plugins/orquestracao/hooks/contexto-do-papel.mjs`, main): executora 150 mil; planejadora/design/orquestradora 200 mil (alto) e 300 mil (teto); validadora só registra a partir de 200 mil. Com a F48, a orquestradora com o operador presente pede o ok a partir de **250 mil**.
- **Teto do pool:** a F49 (PR #15, mergeado na main em `42efaed`) tirou o teto de 4 E / 3 V. A barra mostra a contagem sem teto.

## Decisões

- **Q282** (operador, **confirmada** 26/10): `session-band` e `savvy-progress` **já foram desinstalados**. Até a barra entrar não há relógio do cache: a F52 tem pressa.
- **Q283** (operador, **confirmada** 26/10): a primeira versão tem os quatro pedidos mais as ideias 1, 2, 3, 4 e 7. Ideias 5 (gate), 6 (PRs e travados na orquestradora), 8 (recusas das travas) e 9 (custo) ficam para uma segunda versão.
- **D1 · Mora no plugin `painel-sessoes`, em arquivo próprio** (`hooks/barra.tsx`), registrado por uma linha no `register.tsx`. Motivo: reaproveita `responder`, `alternarModo` e o abrir/fechar do pane sem duplicar, e um plugin só tem um módulo. *Assumida, a confirmar.*
- **D2 · A barra lê sozinha, leve**, sem `list_sessions`: a cada 30 s e a cada `turn.complete`, só arquivos (`perguntas/`, `fila/`, a bandeira do modo ausente e o registro desta sessão no app). Motivo: roda em toda sessão; o `list_sessions` fica para o pane aberto.
- **D3 · O botão "ok para limpar" é o `responder` da F48** com a resposta `sim (segue a recomendação)` na pergunta `limpar · orquestradora` aberta. Grava `respondidaPor: "painel"` e `respondidaEm` (a prova que a trava T7 lê) e entrega a resposta à orquestradora. Aparece na barra de **toda sessão do mesmo projeto** enquanto a pergunta estiver aberta. Nenhum caminho novo de confiança. *Assumida, a confirmar.*
- **D4 · "Limpar antes de vencer" (ideia 7)** só na barra da própria orquestradora, quando faltam ≤ 10 min de cache, o turno não está rodando e o contexto passa de 150 mil. Com a pergunta `limpar · orquestradora` dela aberta, o clique faz o mesmo que D3. Sem pergunta aberta, o clique põe na caixa do prompt o rascunho `Pode se limpar agora, antes do cache vencer.` (`$.prompt.fill`): o operador aperta Enter e o turno é humano, que a T7 já aceita. Motivo: o mod nunca manda a limpeza sozinho.
- **D5 · O contexto (ideia 2)** se mede em tokens contra a régua do papel, lido do título da sessão: E → aviso 120 mil, teto 150 mil; P e D → aviso 200 mil, teto 300 mil; orquestradora → aviso 200 mil, teto 250 mil; V → aviso 200 mil, teto 300 mil; sem papel conhecido → só o número, sem cor. Os números ficam em constantes exportadas de `barra.tsx`, e um teste da raiz compara com os do `contexto-do-papel.mjs` (convenção "duas coisas que devem concordar"). *Assumida, a confirmar.*
- **D6 · Pool (ideia 4)** = sessões distintas no `com` dos itens vivos do projeto, por apelido: `E` trabalhando e `V` trabalhando (`E 2 · V 1`), sem teto (F49).
- **D7 · Aviso do cache aos 10 e aos 5 min**, uma vez cada por resposta, pela ferramenta `PushNotification` (`status: 'proactive'`); se ela não entregar, toast. Nada de app nativo. Motivo: tirar o `session-band` sem isso seria regressão no que o operador mais gostou. *Assumida, a confirmar.*
- **D8 · Esconder e mostrar** pelo comando `/barra` (alterna na sessão; volta a aparecer em sessão nova). A barra não tem `×`: o botão do painel e o selo já ocupam o espaço. *Assumida, a confirmar.*
- **D10 · O pedido de limpeza aparece também no painel** (pedido do operador, 26/10): na faixa do topo do pane (a do modo ausente, F48), enquanto houver `limpar · orquestradora` aberta do projeto, uma linha `A orquestradora pede para se limpar` com o mesmo botão da barra (`responder`, `sim (segue a recomendação)`), com "Enviando…" no lugar do clique. A pergunta continua também em "Esperam você", como hoje. Confirmado pela P1 (dona da regra de limpeza), valendo depois do merge do #17: a F53 fica só com a janela de pergunta e a T7 aceitando a resposta dela; o botão da barra e do painel é desta frente.
- **D9 · Tela passa pela D1 antes da E** (regra do projeto). O plano fixa o comportamento; a revisão fixa o visual. Onde divergirem no visual vale a revisão; no comportamento vale este plano.

## Base da branch e colisões

- A E parte da main **com o PR #17 (F48) mergeado**. Se ainda não estiver, parte de `origin/claude/f48-limpeza-e-header` e rebaseia sobre a main quando o #17 entrar. Sem a F48 não há `respondidaPor`, `alternarModo` nem a pergunta `limpar · orquestradora`.
- A F51 (`entregar`, 0.6.1) pode entrar antes: conflito esperado só no `plugin.json` (versão) e, se houver, em volta de `responder`. Resolver no rebase, mantendo o que a F51 fez em `entregar`.
- No `register.tsx`, a F52 mexe **só** em: a linha do pedido de limpeza na faixa do topo (D10); exportar `responder` e `alternarModo`; extrair o corpo do `command.run` do `/painel` para `export async function alternarPainel($)`; a pasta do painel em `responder` (abaixo); a função `atualizarModo`; e a linha que chama `registrarBarra(on)`.

## Bloco único — executora (Sonnet, médio), depois da revisão da D1

Faixa: só `plugins/painel-sessoes/**` e o teste de concordância na raiz (`test/`).

### Arquivos

| Arquivo | O que muda |
|---|---|
| `plugins/painel-sessoes/hooks/barra.tsx` (novo) | `export function registrarBarra(on)`: os hooks da barra (abaixo). Exporta as funções puras para teste: `reguaDoPapel(titulo)`, `corDoContexto(tokens, regua)`, `papelEApelido(titulo)`, `meuItem(docsFila, localId)`, `contarPool(docsFila, projeto)`, `orquestradorasDoProjeto(docsSessoes, projeto)`, `perguntaDeLimpeza(docsPerguntas, idsDaOrquestradora)`, `abertasDoProjeto(docsPerguntas)`, `relogio(segundos)`, `nivelDoCache(segundos, trabalhando)`, `mostraLimparAntes({ehOrquestradora, segundos, trabalhando, tokens})`; e as constantes `REGUAS` e `CACHE_TTL_MS` (3 600 000). |
| `plugins/painel-sessoes/hooks/register.tsx` | `import { registrarBarra } from './barra'` e a chamada `registrarBarra(on)` no fim de `register`; `export` em `responder` e `alternarModo`; `export async function alternarPainel($): Promise<{ text: string }>` com o corpo atual do `command.run` `painel` (o handler passa a chamá-la); em `responder`, quando `pastaLida` é vazia, usar `` `${await $.env.get('HOME')}/${PASTA}` `` em vez de lançar erro; `export async function atualizarModo($)`: lê `lerBandeira` e grava `leitura.ausente` respeitando `geracaoModo`/`trocandoAgora` (o mesmo cuidado de `ler`), erro de leitura = `ausente: null` e aviso em `erros`. |
| `plugins/painel-sessoes/hooks/desenho.ts` | a linha do pedido de limpeza na faixa do topo, se a revisão a pedir em SVG (desktop); no terminal, `Text` + `Button`. |
| `plugins/painel-sessoes/types/index.d.ts` | `PluginState['painel-sessoes']` ganha `barra: Barra` e `barraEscondida: boolean`; tipo `Barra` = `{ lidoEm: number \| null; abertas: number; limpeza: PerguntaAberta \| null; titulo: string \| null; item: { id: string; titulo: string; etapa: string } \| null; pool: { e: number; v: number }; projeto: string \| null; cache: { expiraEm: number \| null; segundos: number \| null }; avisado: number; tokens: number \| null; erros: string[] }`. |
| `plugins/painel-sessoes/tests/barra.test.tsx` (novo) | testes abaixo. |
| `plugins/painel-sessoes/.claude-plugin/plugin.json` | versão `0.7.0`; `description`: `Mod /painel e a barra de status acima do prompt: as sessões do pool, as perguntas com Q-ID e a fila.` |
| `test/reguas-de-contexto.test.mjs` (novo, raiz) | lê `plugins/orquestracao/hooks/contexto-do-papel.mjs` e `plugins/painel-sessoes/hooks/barra.tsx` como texto e confere que os tetos de E (150 000), P/D (300 000), orquestradora (250 000, constante `PEDIR` da F48) e o aviso de 200 000 são os mesmos nos dois. Primeiro afirma que cada número foi achado (não vazio). |

### O que a barra faz (comportamento)

1. **`session.start`:** registra o comando `barra` (`Mostra ou esconde a barra de status do kit`); liga `$.clock.every(1000)` para o relógio do cache e `$.clock.every(30_000)` para a leitura leve; faz a primeira leitura.
2. **Leitura leve** (`lerBarra($)`), uma por vez (guarda contra sobreposição como `atualizar`):
   - pasta do painel = `$HOME/.claude/orquestracao/painel`; lê `perguntas/*.json`, `fila/*.json` e `sessoes/*.json` com `lerDoc`; arquivo ruim vira linha em `erros`, nunca exceção;
   - esta sessão = `CLAUDE_CODE_HOST_SESSION_ID`; título = o registro do app (`$HOME/Library/Application Support/Claude/claude-code-sessions/<CLAUDE_CODE_ACCOUNT_UUID>/<CLAUDE_CODE_ORGANIZATION_UUID>/<id>.json`, campo `title`); sem ele, `null` (fora do app a barra mostra só o que não depende disso);
   - projeto = o `projeto` do item desta sessão; senão o nome da pasta que contém o `.git` comum (`$.session.cwd()` → subir até achar `.git`; worktree `.claude/worktrees/x` → a pasta acima de `.claude`), minúsculo, como o painel grava;
   - `abertas` = perguntas com `estado: "aberta"` (todas, como o selo do pane); `limpeza` = a pergunta aberta cujo `titulo` (sem espaços nas pontas) é exatamente `limpar · orquestradora` e cujo `sessaoId` está em `orquestradorasDoProjeto` (os `id` dos docs de `sessoes` com `papel: "orquestradora"` ou título começando por `🎛 orquestradora`, e `projeto` igual ao desta sessão, sem diferença de maiúscula); entre várias abertas (pedido repetido depois de "adiar"), a de `atualizadoEm` mais recente — responder uma basta para a T7, e a tela mostra só essa. **Não filtre pelo `projeto` da pergunta:** a skill não obriga gravá-lo, e a T7 exige o `sessaoId` da orquestradora de qualquer jeito;
   - `item` = o item vivo (etapa fora de `feito`/`descartado`) com `donoLocalId` desta sessão; senão o primeiro em cujo `com` ela está;
   - `pool` = `contarPool`: `localId` distintos do `com` dos itens vivos do projeto com apelido `^E\d` e `^V\d`;
   - chama `atualizarModo($)` (o modo ausente do pane, o mesmo atom);
   - `tokens` = `(await $.session.usage()).context.tokens ?? null`.
3. **`turn.complete` sem `agentId`:** `cache.expiraEm = agora + CACHE_TTL_MS`, `avisado = 0`, e uma leitura leve.
4. **Relógio (1 s):** recalcula `cache.segundos`; aos ≤ 600 s e ≤ 300 s, uma vez cada por resposta e só com o turno parado, avisa (`PushNotification` com `<projeto> — <título>: o cache vence em N min`; não entregue → toast). Só grava o atom quando o segundo muda.
5. **`ui.render` `AbovePrompt`:** `hasSurvey` ou `barraEscondida` → `next(e)`. Senão desenha, conforme a revisão da D1, com estes elementos e estas regras:
   - **Quem é:** apelido e papel do título (`🎛`, `P3`, `E2`…), o item `F<n>` e a etapa dele, se houver;
   - **Contexto:** tokens em mil contra a régua do papel (`corDoContexto`: normal, aviso, teto), sem cor quando o papel é desconhecido;
   - **Cache:** `mm:ss`, `—` sem resposta ainda, `venceu` no zero, `…` enquanto `isWorking`; nível aviso ≤ 20 min, alerta ≤ 10 min (`nivelDoCache`), nunca enquanto trabalha;
   - **Modo ausente:** o estado e o botão que liga/desliga (`alternarModo`; rótulo "Ligando…"/"Desligando…" enquanto `trocandoModo`);
   - **Pool:** `E n · V m`;
   - **Selo das perguntas:** `n perguntas` (some com zero); o clique **abre** o painel (se já aberto, não fecha);
   - **Botão do painel:** abre ou fecha (`alternarPainel`), o rótulo diz qual;
   - **Ok para limpar** (com `limpeza`): botão de destaque, o clique chama `responder($, limpeza, 'sim (segue a recomendação)', 'sim')`; enquanto envia, "Enviando…" (o atom `enviando` da F48) e o clique repetido é ignorado; falha vira aviso (o `avisar` de sempre) e toast;
   - **Limpar antes de vencer** (`mostraLimparAntes`): com `limpeza` aberta e da própria sessão, é o mesmo botão do item acima; sem ela, o clique chama `$.prompt.fill({ text: 'Pode se limpar agora, antes do cache vencer.' })` e um toast `Rascunho na caixa do prompt: aperte Enter para mandar.`; `isFilled: false` → toast dizendo que não deu.
   - O pedido de limpeza vale também no pane (D10): mesma pergunta (`perguntaDeLimpeza` sobre as perguntas que o pane já leu), mesmo botão, na faixa do topo.
   - Densidade pela largura (`bodyColumns`): o que sai primeiro quando aperta é decisão da D1; o botão de limpar e o relógio do cache nunca saem.
6. **`/barra`:** alterna `barraEscondida`; responde `Barra de status escondida.` / `Barra de status à mostra.`

### Passos (teste antes do código)

1. Base: `git fetch && git switch -c f52-exec origin/main` se a main já contém o #17 (`git log origin/main --oneline | grep -q "limpa inteira\|limpeza-e-header"` ou o título do #17); senão `origin/claude/f48-limpeza-e-header`. Depois puxe o plano e a revisão: `git checkout origin/f52-barra-de-status -- docs/planos/2026-10-26-barra-de-status-do-kit.md docs/design/<revisão da D1>`.
2. Escreva `tests/barra.test.tsx` e `test/reguas-de-contexto.test.mjs` (lista abaixo). Rode: têm de falhar pelo motivo certo (módulo/função ausente). Cole a saída vermelha.
3. Tipos (`types/index.d.ts`).
4. `barra.tsx`: funções puras primeiro (testes delas verdes), depois a leitura leve, os hooks e o desenho pela revisão.
5. `register.tsx`: exports, `alternarPainel`, `atualizarModo`, a pasta em `responder`, `registrarBarra(on)`.
6. `plugin.json` 0.7.0.
7. `claude plugin test plugins/painel-sessoes; echo "exit=$?"`, `claude plugin validate plugins/painel-sessoes --strict; echo "exit=$?"`, `claude plugin validate .; echo "exit=$?"`, `npm test; echo "exit=$?"` (um gate por vez).
8. **Na tela de verdade** (auditoria de clique): numa sessão do app com o plugin da branch (o `session-band` já foi desinstalado; confira com `claude plugin list` que ele não voltou), conferir: o relógio zera em 60:00 depois de uma resposta; `/barra` esconde e mostra; o selo abre o painel; o botão do painel abre e fecha; o botão do modo ausente liga e desliga (conferir `~/.claude/orquestracao/operador-ausente.json` antes e depois e **voltar ao estado em que estava**). O ok de limpar se confere com uma pergunta de teste `limpar · teste` com `sessaoId` da própria sessão de teste, nunca na orquestradora real; depois, marcar a pergunta de teste como `descartada`. Print da barra no desktop e no terminal (`claude` com `--plugin-dir plugins/painel-sessoes`).
9. Commits conventional em PT-BR (ex.: `feat(painel): barra de status do kit acima do prompt`), push de `f52-exec`, HEAD e saídas à P3; `painel com del F52 <seu local_> --fez`.

### Testes novos

`plugins/painel-sessoes/tests/barra.test.tsx` (HOME e pastas em diretório de teste, como o `painel.test.tsx`):
- `reguaDoPapel`: `E2 · x` → teto 150 000; `P1 · x` e `D1 · x` → 300 000; `🎛 orquestradora — kit` → 250 000; `V3 · x` → 300 000; `qualquer coisa` → `null`.
- `corDoContexto`: abaixo do aviso → normal; no aviso → aviso; no teto → teto; régua `null` → sem cor.
- `nivelDoCache`: 1 201 s → nenhum; 1 200 s → aviso; 600 s → alerta; qualquer valor com `trabalhando` → nenhum; `null` → nenhum.
- `relogio`: 3 600 → `60:00`; 59 → `00:59`; 0 → `venceu`; `null` → `—`.
- `orquestradorasDoProjeto`: pega a orquestradora do projeto pelo `papel` e pelo título; ignora a de outro projeto; aceita `projeto` com maiúscula diferente; prova antes que acha uma (não vazio).
- `perguntaDeLimpeza`: acha a `limpar · orquestradora` aberta com `sessaoId` da orquestradora do projeto, **mesmo sem o campo `projeto`**; ignora a respondida, a de `sessaoId` de outra sessão (inclusive de outro projeto) e `limpar · outra-coisa`; aceita espaço nas pontas do título; entre duas abertas, prefere a de `atualizadoEm` mais recente, mesmo quando ela tem o número maior **e** quando tem o menor (os dois casos).
- `meuItem`: dono vence `com`; item `feito` é ignorado. `contarPool`: E repetida em dois itens conta uma; item de outro projeto e item `feito` não contam; prova antes que um item vivo com `E1` é contado (não vazio).
- `mostraLimparAntes`: verdadeiro só com orquestradora, 1 ≤ segundos ≤ 600, não trabalhando e tokens ≥ 150 000; cada condição faltando → falso.
- Render: sem nenhuma resposta ainda → o relógio mostra `—`; depois de um `turn.complete` sem `agentId` → `60:00`; `turn.complete` **com** `agentId` não reinicia.
- Render: `hasSurvey` → `next(e)`; `/barra` → `next(e)`; `/barra` de novo → desenha.
- Render: com 3 perguntas abertas → o selo diz 3; com 0 → o selo some.
- Clique no selo com o pane fechado → `$.ui.open` do pane `painel-sessoes`; com o pane aberto → não fecha.
- Clique no botão do painel com o pane aberto → fecha; fechado → abre.
- Com uma `limpar · orquestradora` aberta → o botão aparece; o clique grava o documento com `estado: "respondida"`, `resposta: "sim (segue a recomendação)"`, `respondidaPor` exatamente `"painel"`, `respondidaEm` em string ISO (nunca epoch: a T7 nega) igual ao `atualizadoEm`, **com o pane nunca aberto** (prova da pasta em `responder`), e chama `send_message` com o `sessaoId` da pergunta; segundo clique durante o envio → uma gravação só.
- Limpar antes de vencer, sem pergunta aberta → `$.prompt.fill` com o texto exato e nenhuma escrita em `perguntas/`; o mod nunca chama `clear_session` (nenhum `tool.call` com esse nome em nenhum teste).
- Aviso do cache: com o relógio em 599 s e turno parado → um `PushNotification`; o tique seguinte não repete; em 299 s → o segundo; com `turn.start` em curso → nenhum.
- Botão do modo ausente com o pane nunca aberto → funciona (o `atualizarModo` da leitura leve preencheu o modo) e grava a bandeira pelo contrato da F48.
- Pane (D10): com `limpar · orquestradora` aberta, a faixa do topo mostra `A orquestradora pede para se limpar` e o botão; o clique grava como o da barra; sem a pergunta (ou só com `limpar · outra-coisa`), a linha não aparece; a pergunta continua em "Esperam você".
- O mod continua registrando só a ferramenta `onde_esta_o_painel`, e os comandos são `painel` e `barra`.

`test/reguas-de-contexto.test.mjs`: descrito na tabela de arquivos.

### Critério de pronto

- `claude plugin test plugins/painel-sessoes; echo "exit=$?"` → `exit=0`, com os testes acima listados e a saída vermelha do passo 2 colada.
- `claude plugin validate plugins/painel-sessoes --strict; echo "exit=$?"` → `exit=0`; `claude plugin validate .; echo "exit=$?"` → `exit=0`; `npm test; echo "exit=$?"` → `exit=0`.
- `grep -c "registrarBarra(on)" plugins/painel-sessoes/hooks/register.tsx` → `1`.
- Prints da barra no desktop e no terminal, e o conteúdo da bandeira e da pergunta de teste depois de cada clique, colados.

## Fora de escopo

- Ideias 5, 6, 8 e 9 (gate, PRs e travados, recusas das travas, custo/tok/s): segunda versão, item próprio.
- Desinstalar `savvy-progress`, `savvy-flow` e `session-band` (Q282): o operador, depois do merge.
- App nativo de notificação; notificação ao celular além do que a `PushNotification` já faz.
- Qualquer mudança na regra de limpeza da F48 (trava T7, 250 mil, 30 min): a barra só usa o que existe.
- O pane: fora a linha do pedido de limpeza na faixa do topo (D10), desenho, seções e leitura não mudam.

## Regras do projeto que tocam o trabalho

- `CLAUDE.md`: Node ≥ 20, ESM, sem dependência; testes do mod com `claude plugin test plugins/painel-sessoes` (o `node --test` da raiz não pega `.tsx`); testes nunca tocam `~/.claude` real; teste antes do código; commits em PT-BR, conventional; um gate por vez; o plugin é a cópia viva.
- "Design de interface": revisão da D1 antes da tela; ação assíncrona com estado visível no lugar do clique; efeito na hora e recusa que desfaz (o botão do modo já faz); texto de UI não cita spec, ADR, `F<n>` de documento nem nome de arquivo (o `F<n>` do item é dado, não citação de doc).
- "Convenções de teste": afirmar que o valor existe antes de medir; teste de ausência prova antes a presença; duas coisas que concordam ganham teste.
- React no mod: componentes funcionais; nada de estado fora dos atoms além das guardas de corrida (como o `respondendo` de hoje).

## Validação

**Robusta:** V em contexto novo, Opus, alto, com a barra clicada de verdade (skill `auditoria-de-clique`) no desktop e no terminal, e o ok de limpar provado ponta a ponta contra a trava T7 da F48 numa pergunta de teste (nunca na orquestradora real).

## Revisão de design (D1) — o que ela decide

Revisão em `docs/design/2026-10-26-barra-de-status.md` (+ mock): a ordem e o agrupamento dos elementos, a linha do pedido de limpeza na faixa do topo do pane (D10), o que cai primeiro quando a largura aperta (o relógio e o ok de limpar nunca caem), como o ok de limpar e o "limpar antes de vencer" se destacam sem depender só de cor, os rótulos exatos (selo, botão do painel, modo ausente, limpar), o desenho no terminal (sem `Svg`) e a moldura do cache em aviso e em alerta. Crítica ≥ 24/30 sem ressalva alta, no máximo 2 recríticas.
