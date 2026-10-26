# F65 — a barra mostra o contexto contra a janela, não contra a régua de limpeza (o pedido de limpeza novo não some nem quebra a barra)

- **Data:** 2026-10-26 · **Planejadora:** P1 · **Base:** main em `69850a4`
- **Pedido do operador (26/10):** "a janela de contexto aqui da orquestradora está errada, esta falando 198/250 mas o contexto maximo é 600".

## O que foi medido (26/10, main `69850a4`)

- **O denominador hoje é a régua de limpeza.** `plugins/painel-sessoes/hooks/barra.tsx`, `textoDoContexto` (≈ l. 206) escreve `${mil(tokens)}/${mil(regua.teto)} mil`; `REGUAS` (l. 32-39) dá à orquestradora `{aviso: 250_000, teto: 250_000}`, que é o `PEDIR` do hook `plugins/orquestracao/hooks/contexto-do-papel.mjs` (a partir dele ela pede o ok para se limpar). Por isso `198/250`. A revisão de design da barra decidiu assim de propósito: `docs/design/revisoes/2026-10-26-barra-de-status.md`, **D2-6** ("o denominador do contexto é o teto do papel"), assumida e agora contestada pelo operador.
- **A janela real** é a compactação automática, `autoCompactWindow` no `~/.claude/settings.json`: **600 000** (l. 91). Nenhuma `CLAUDE_CODE_AUTO_COMPACT_WINDOW` no `env` do settings. Os 400 mil (executor, validador) e 200 mil (explorador) do frontmatter de `plugins/orquestracao/agents/*.md` valem **só para subagentes**: os membros do pool são sessões comuns, então todos (orquestradora, P, D, E, V) compactam aos 600 mil do global.
- **A API do mod já dá uma janela:** `$.session.usage()` devolve `context.window` (o fixture do teste usa `1_000_000`, a janela do modelo). Não é a do `autoCompactWindow`: mostrar `/1000` seria tão enganoso quanto `/250`.
- **A barra já lê arquivos** fora do painel (`tituloDoApp`, `register.tsx` ≈ l. 979, por `$.fs.read` com `HOME` de `$.env.get`), então ler o `settings.json` não pede API nova.
- **O teste que compara as réguas** é `test/reguas-de-contexto.test.mjs` (raiz, `node --test`): lê `barra.tsx` por regex `<papel>: { aviso: N, teto: N }` e compara com `ALTO`, `TETO`, `EXEC`, `PEDIR` do hook. Se `REGUAS` mantiver a forma, ele continua valendo sem mudança.
- Testes do mod que fixam o texto atual: `plugins/painel-sessoes/tests/barra.test.tsx` l. 39-46 (`reguaDoPapel(...).teto`), l. 175-200 (`faixaDaBarra` com `REFERENCIA`), l. 440-445 (`/300\/300 mil · teto/`) e o de papel desconhecido logo abaixo.

## Decisões

- **D1 · O denominador passa a ser a janela de compactação, igual para todos os papéis**; as réguas do papel continuam no hook e na barra, só como cor e palavra. Ex.: orquestradora com 198 mil → `contexto 198/600 mil`; com 260 mil → `contexto 260/600 mil · limpar` (cor de teto). *Assumida, a confirmar* (é o pedido do operador; reverte a D2-6 da revisão).
- **D2 · De onde vem a janela, nesta ordem:** (1) `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (`$.env.get`), (2) `autoCompactWindow` de `${HOME}/.claude/settings.json`, (3) `context.window` do `$.session.usage()`; nenhuma → sem denominador (`198 mil`, como o papel desconhecido de hoje). Valor aceito só se for inteiro > 0; o escolhido é limitado por `context.window` quando este existir (a compactação não passa da janela do modelo). Motivo: o operador mexe nesse número (já foi outro), e uma constante na barra mentiria em silêncio no dia em que mudar; o settings já é a fonte que a skill `papeis-e-modelos` cita. Lido junto com o resto, a cada 30 s e a cada turno; falha de leitura não vira erro na barra, cai para o próximo da lista. *Assumida, a confirmar.*
  - Fora de escopo: `settings.json` de projeto/local e o frontmatter de agente (o pool não roda como agente).
- **D3 · A palavra do teto vira `· limpar`** (era `· teto`): com o denominador sendo a janela, `250/600 · teto` diria "parou" com 350 mil sobrando; o que acontece ali é a régua do papel mandar limpar (E, P, D) ou pedir o ok para limpar (orquestradora). `· alto` fica. *Recomendação ao design; a D decide o texto final.* Validadora também ganha `· limpar` aos 500 mil (o hook não a obriga, mas é o sinal de limpar ao fim da validação).
- **D4 · Tela mudada → D1 antes da E** (protocolo). Pedido à D: **delta** da revisão `docs/design/revisoes/2026-10-26-barra-de-status.md`, não revisão nova: §1 (texto do contexto, tabela da l. 88 e os exemplos `142/300` → `142/600`), §O que cai quando aperta (as somas mudam: `· limpar` tem 2 células a mais que `· teto`; a faixa já usa os textos reais, então só os números de exemplo e o quadro 3b mudam), e uma decisão nova que substitui a D2-6, citando o pedido do operador. Crítica pelo `design:critico-de-ui` só se a D achar que muda hierarquia; texto de denominador e palavra não pede (teto da crítica: 24/30, no máximo 2 recríticas).
- **D5 · Versão:** `plugins/painel-sessoes/.claude-plugin/plugin.json` sobe um patch sobre o que estiver na main na hora do PR (conferir; colisão de versão se resolve no rebase).

## Plano para a E (depois do delta da D)

Regras: Node ≥ 20, ESM, sem dependência npm; teste antes do código; testes do mod por `claude plugin test plugins/painel-sessoes`, os da raiz por `npm test`; commit conventional em PT-BR; não mergear. React: hooks e componentes como já estão no arquivo (nada de estado novo no desenho; `desenharBarra` segue pura e recebe a janela pronta).

1. **Teste vermelho (mod), `plugins/painel-sessoes/tests/barra.test.tsx`:**
   - `textoDoContexto` recebe a janela: `textoDoContexto(198_000, REGUAS.orquestradora, 600_000, 0)` → `contexto 198/600 mil`; `260_000` → `contexto 260/600 mil · limpar`; régua P com 360 mil → `… · alto`; janela `null` → `contexto 198 mil` (com palavra se houver régua); faixa 2 → só `198 mil` (+ palavra).
   - A janela vem do settings: no fixture (`iniciar`), `fs.read` de `${HOME}/.claude/settings.json` devolve `{"autoCompactWindow": 600000}` → a barra montada mostra `198/600 mil`. Afirme antes que o fixture devolve o arquivo (convenção: insumo vazio não pode passar).
   - Precedência: env `CLAUDE_CODE_AUTO_COMPACT_WINDOW=500000` vence o settings; settings ausente ou inválido (`"x"`, `0`, JSON quebrado) → cai para `context.window`; `autoCompactWindow` maior que `context.window` → vale `context.window`; nada disponível → sem `/`.
   - Ausência que mede: prove que o caso "sem janela" mostraria `/` se a janela existisse (mesmo estado, só a janela muda).
   - Atualize os que fixam o texto antigo (l. 440-445 → `300/600 mil · limpar`; `REFERENCIA` e as faixas da l. 192-199 com os novos números, recalculados, não chutados).
2. **Código, `plugins/painel-sessoes/hooks/barra.tsx`:**
   - `textoDoContexto(tokens, regua, janela: number | null, faixa)`; o numerador/denominador usa `janela`; a palavra do teto `· limpar` (ou a que a D fixar), numa constante exportada, como as outras.
   - `EstadoBarra` ganha `janela: number | null`; `pecasDaBarra`/`faixaDaBarra` passam adiante (a soma da faixa já usa os textos reais).
   - Função pura exportada `janelaDeCompactacao({ env, settings, modelo }): number | null` com a precedência e o limite da D2 (testável sem motor).
   - Comentário de `REGUAS`: o `teto` deixa de ser o denominador; é onde a palavra muda. **Forma e números de `REGUAS` ficam iguais** (o `test/reguas-de-contexto.test.mjs` os lê por regex).
3. **Leitura, `plugins/painel-sessoes/hooks/register.tsx` (`lerBarra`):** leia env e `settings.json` (por `$.fs.read`, `try` silencioso) e o `context.window` do mesmo `usage()` que já dá `tokens`; grave `janela` na `Barra` (`types/index.d.ts`, l. ≈ 140, ao lado de `tokens`, valor inicial `null`) e passe ao `EstadoBarra` em `desenharBarra`. Nada mais muda no `register.tsx`.
4. **Raiz:** acrescente a `test/reguas-de-contexto.test.mjs` um caso que afirma que `barra.tsx` não usa mais `regua.teto` como denominador (ex.: `textoDoContexto` não contém `regua.teto`), para a régua não voltar ao lugar da janela.
5. Versão (D5); `npm test` e `claude plugin test plugins/painel-sessoes` verdes; `claude plugin validate plugins/painel-sessoes --strict`.
6. Ver na barra de verdade (skill `run` ou abrindo uma sessão): orquestradora mostra `…/600 mil`; cole a linha lida no PR.

## Critério de pronto (medível)

- Com `autoCompactWindow: 600000` e 198 mil de contexto, a barra da orquestradora mostra `contexto 198/600 mil` sem palavra; a 260 mil, `260/600 mil · limpar` em cor de teto; a P com 360 mil, `360/600 mil · alto`.
- Os casos de precedência do passo 1 verdes; `test/reguas-de-contexto.test.mjs` verde sem mudar `REGUAS`.
- `npm test` e `claude plugin test plugins/painel-sessoes` verdes, saída colada no PR.

## Fora de escopo

- Mudar as réguas (`REGUAS`, `PEDIR`, `ALTO`, `TETO`, `EXEC`) ou o hook `contexto-do-papel.mjs`.
- O frontmatter `autoCompactWindow` dos agentes e a skill `papeis-e-modelos` (corrigir lá que os membros do pool não herdam o frontmatter fica para outro item, se a orquestradora quiser).
- Mostrar percentual, barra gráfica ou a régua como segundo número (`198/600 · limpa em 250`): recusado para não alargar a peça mais apertada da faixa; se a D achar que o número da régua faz falta, propõe no delta.

## Parte B — o pedido de limpeza aberto depois do ok volta a aparecer (pedido do operador, 26/10)

Origem: laudo da V da F52 (delta), "Observações", primeiro item: a janela de 30 min do ok esconde também um pedido `limpar · orquestradora` **aberto depois** do ok.

- **Medido:** `perguntaDeLimpeza` (`barra.tsx` ≈ l. 98) devolve `null` se houver um sim do painel há ≤ 30 min (`OK_VALE_MS`) da mesma orquestradora, sem comparar o `respondidaEm` desse sim com o `atualizadoEm` das abertas. O teste da l. 118-131 de `barra.test.tsx` só cobre abertas **anteriores** ao ok. Efeito: a orquestradora abre um pedido novo (ex.: o ok chegou, ela não limpou, e pede de novo) e a barra e a faixa do pane (D10) não mostram o botão; a pergunta só aparece em "Esperam você", e ela fica esperando.
- **Vale fazer.** A segurança não muda: a T7 já aceita o sim de ≤ 30 min, e um ok novo só renova essa prova pelo mesmo `responder`. O custo é uma comparação; o ganho é não esconder a pergunta de quem espera a resposta.
- **D6 · Regra:** o sim do painel de ≤ 30 min esconde só as abertas com `atualizadoEm` **até** o `respondidaEm` dele (≤); aberta com `atualizadoEm` posterior volta a ser candidata, e entre as candidatas vale a mais recente, como hoje. Com vários sins na janela, vale o de `respondidaEm` mais recente. `atualizadoEm` ilegível na aberta → tratada como anterior (escondida, o comportamento de hoje). *Assumida, a confirmar.*
  - Limite conhecido: o painel não grava data de criação, então uma aberta **antiga** que seja regravada depois do ok (o `atualizadoEm` muda) também volta. Aceito: regravar a pergunta é a orquestradora ainda pedindo.
- **Passos para a E** (antes da parte A ou junto, mesmo PR):
  1. Teste vermelho em `barra.test.tsx`, no teste da l. 118: `ok('Q99053', 5)` (sim às 11:55) com `limpar('Q99054', { atualizadoEm: '2026-10-26T11:58:00Z' })` → devolve `Q99054`; aberta com `atualizadoEm` igual ao `respondidaEm` → `null`; dois sins na janela (5 e 20 min) e aberta entre eles (11:50) → `null` (vale o mais recente); aberta com `atualizadoEm` inválido → `null`. Os casos já existentes continuam verdes sem mudança.
  2. Teste montado (o mesmo `iniciar`/`montar` da barra): com o sim de 5 min e um pedido aberto 2 min atrás, a barra mostra a linha `A orquestradora pede para se limpar` e o botão `Pode se limpar`; e o pane (`desenharPedidoNoPane`) também, porque lê da mesma função. **Feito em `a687231`** com a frase de antes da parte C; a E da parte C troca a afirmação da barra para `◆ pede limpeza` (revisão, D1-F65) e mantém a do pane com a frase longa, que não muda.
  3. Código: em `perguntaDeLimpeza`, troque o `some(...)` que devolve `null` pelo cálculo do `respondidaEm` mais recente dos sins válidos e filtre as `achadas` por `Date.parse(atualizadoEm) > esse`. Comentário de uma linha dizendo a regra.
  4. `processos:auditoria-de-clique` no gesto `Pode se limpar` depois do pedido novo: o clique grava o sim na pergunta nova, a próxima leitura a esconde, e o "✓ Ok enviado" aparece (o `respondidaAgora` do `lerBarra` compara pelo `id`, então segue valendo).
- **Critério de pronto:** os quatro casos do passo 1 e o montado do passo 2 verdes; os testes atuais de `perguntaDeLimpeza` verdes sem edição.
- **Para a V:** tente fazer o pedido novo sumir (empate de horário, sim de outra `sessaoId`, sim com `resposta: não`, sim de 31 min) e confira que a T7 (`plugins/orquestracao`) não foi tocada.

## Parte C — o pedido de limpeza não quebra a barra (pedido do operador, 26/10)

Origem: print do operador, *"quebrou o layout com o botão de se limpar"*. Com `◆ A orquestradora pede para se limpar [Pode se limpar]` na tela, a barra ocupa duas linhas tortas: o relógio aparece como `⧗ …`, `253/250 mil · teto` cai para a segunda linha e os botões `● 1 pergunta` · `Ficar ausente` · `Fechar painel` ficam desalinhados à direita.

- **Medido no código (sem o print em mãos, a confirmar pela E):**
  - O pedido é uma **linha própria acima** da linha principal (`desenharBarra`, `linhaDoPedido`, `Box` coluna): a barra passa de 1 para 2 linhas por desenho, como a revisão previu (§Quem e onde, l. 33).
  - `faixaDaBarra` escolhe a faixa só pela linha principal e estima cada botão como `rótulo + 4` células. No **desktop** o `Button` tem respiro próprio e o `bodyColumns` é convertido de pixels; se a estimativa ficar curta, o `flexWrap` da linha principal quebra o grupo da esquerda (o contexto desce) e o da direita (`flexGrow`, `justifyContent: flex-end`) fica solto. Hipótese mais provável para o "desalinhado": a quebra acontece dentro da linha principal, não por causa da linha do pedido em si.
  - `⧗ …` **não é corte**: é o relógio enquanto o turno roda (`d.isWorking ? '…'`). A D decide se isso confunde (ex.: `⧗ em curso`), mas não é o defeito.
- **Pedido à D (delta, junto da parte A):** o pedido de limpeza cabe **na própria barra, numa linha só**, sem quebrar nas larguras de 94 células para cima, terminal e desktop. Recomendação: o botão `Pode se limpar` entra como **primário no começo do grupo da direita** e a frase curta (`◆ pede limpeza`) toma o lugar de item e pool no grupo da esquerda enquanto o pedido estiver aberto; a linha de cima deixa de existir (vale também para `Limpar antes de vencer`, que hoje usa a mesma linha). Abaixo de 94, a D diz o que cai primeiro. A faixa do pane (D10) não muda.
- **Passos para a E (depois do delta):**
  1. Reproduzir antes de mexer (`superpowers:systematic-debugging` é da P, mas a E mede): teste montado no **desktop** e no terminal com o pedido aberto, `bodyColumns` 94, 114 e 140, afirmando que a árvore tem **uma** linha principal com o botão do pedido dentro dela e nenhuma `Box` `linha-do-pedido`. Se o motor de teste não mede quebra, cole o print da barra real (skill `run`) antes e depois.
  2. `faixaDaBarra` passa a somar o botão do pedido e a frase, com os textos reais (a mesma regra de hoje), e o teste de faixas ganha os casos com pedido.
  3. Corrigir a estimativa do botão no desktop se a reprodução mostrar que é ela (medir o respiro real, não chutar); se for, constante nomeada e teste.
  4. `processos:auditoria-de-clique` no `Pode se limpar` na nova posição (o clique, o `Enviando…`, o `✓ Ok enviado` e a volta).
- **Critério de pronto:** com o pedido aberto, a barra da orquestradora fica numa linha a 114 colunas no desktop e no terminal, com relógio, contexto e o botão do pedido visíveis; print real colado no PR.

## Para a V

Compare o diff com este plano e o delta da D; tente derrubar: a precedência (env > settings > modelo, limite pelo modelo), a ausência de `/` sem janela, a palavra nas três faixas, `REGUAS` intacta, e a barra real mostrando `/600`.
