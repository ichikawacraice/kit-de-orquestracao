# Plano — via rápida, escopo trancado e piso de uma E livre (ADR 0004)

Branch: `regras-via-rapida-escopo-piso`. Decisão: [ADR 0004](../adr/0004-via-rapida-escopo-trancado-e-piso-de-uma-executora.md), que já está escrito e não se edita neste plano. Leia-o antes de começar.

## Regras do projeto que valem aqui
- Node ≥ 20, ESM, só módulos nativos; testes em `node:test`; script termina por `process.exitCode`.
- Teste antes do código quando o comportamento muda. O teste vermelho falha pelo motivo certo, e o teste de ausência prova antes que a presença seria detectada.
- Testes nunca tocam o `~/.claude` real: `HOME` e as envs de pasta apontam para um diretório temporário (siga o padrão dos testes vizinhos).
- Commits convencionais em PT-BR, sem citar ADR no título, com a linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- O texto de doc segue o tom dos arquivos vizinhos: frase curta, decisão com a origem entre parênteses (`ADR 0004, Q370, operador, 26/10`).

## Passos

### 1. Piso de uma E livre: o ritual cobra (código + teste)
Arquivo: `plugins/orquestracao/hooks/orquestradora-ritual.mjs`. Teste: `plugins/orquestracao/hooks/tests/orquestradora-ritual.test.mjs`.
1. Escreva primeiro os testes, que devem falhar:
   - com o modo ausente desligado, projeto da orquestradora sem nenhuma sessão `E<n> · livre` não arquivada, e nenhum `start_session` no turno → o hook bloqueia com uma frase que contém `sem E livre` e `peça a vaga`;
   - mesmo cenário com uma `E2 · livre` do projeto → não cobra o piso (prove antes, com o caso anterior, que a cobrança é detectada);
   - mesmo cenário com `start_session` usado no turno → não cobra;
   - modo ausente ligado → não cobra o piso.
2. Implemente com `membrosLivres(repo)`, que já existe em `pool-comum.mjs`: falta piso quando `!modoAusente()`, o projeto resolve, nenhum livre tem `papel === 'E'` e o turno não usou `start_session`. A frase entra no `reason` junto às outras, no formato: `Piso do pool (ADR 0004): sem E livre no projeto: peça a vaga (start_session; fora do turno do operador, cartão).`
3. Repo que não resolve (`gitCommonDir` nulo) → não cobra o piso. Erro de leitura nunca prende.

### 2. Piso de uma E livre: a trava de arquivar (código + teste)
Arquivo: `plugins/orquestracao/hooks/papel-do-pool.mjs`, regra T2 (por volta da linha 117). Teste: `plugins/orquestracao/hooks/tests/papel-do-pool.test.mjs`.
1. Teste primeiro: a orquestradora, fora do turno do operador e com o modo ausente desligado, arquiva `E3 · livre` sem item vivo quando ela é a **única** E livre do projeto → `deny` com motivo que cita `última E livre` e `ADR 0004`. Com outra E livre no projeto, o mesmo arquivamento passa, como hoje. No turno do operador (`origem === 'human'`), passa sempre.
2. Implemente dentro do ramo `!porComando`, depois das negações que já existem: se `m.papel === 'E'` e `membrosLivres(<repo do alvo>)` não tem outra E além do alvo, negue. Use o repo que o T2 já resolve para comparar os projetos e não crie uma segunda forma de achar o repo.
3. Atualize o comentário do cabeçalho (linhas 8–9) com a nova condição.

### 3. Protocolo do pool
Arquivo: `plugins/orquestracao/pool/protocolo.md`.
- Âncora `sob-demanda` (linha 9): depois de "sem limite de vagas fora do modo ausente (Q277)", acrescente que, fora do modo ausente, o pool mantém **pelo menos uma E livre por projeto** (ADR 0004, Q370), pedida no mesmo turno em que falta e nunca arquivada sozinha quando é a última.
- Bullet `**Sem piso:**` (linha 85): troque por `**Piso de uma E livre (ADR 0004, Q370, operador, 26/10):**`, com a regra, as duas travas (o ritual cobra e o T2 recusa arquivar a última) e o motivo em uma frase (o item esperava um clique no cartão da vaga). Os outros papéis continuam sob demanda.
- Nova seção `<a id="via-rapida"></a>\n## Via rápida e escopo trancado (ADR 0004, Q370, operador, 26/10)`, logo antes de `## Nunca travar`. Ela diz:
  - quando a via rápida vale (as duas condições do ADR) e que quem marca é a planejadora, com `via: "rapida"` no item e o motivo no plano;
  - o caminho: `planejamento` → `execucao`, sem a etapa `design`; uma crítica só (`design:critico-de-ui` em subagente, lançado pela E depois do código, com o escopo do plano no briefing), sem recrítica; validação leve (gate, diff dentro do escopo, a tela aberta);
  - quando o item sai da via: nota abaixo de 24/30, ou a descoberta de que ele muda decisão → volta à planejadora (`etapa: planejamento`, `via` removida);
  - o escopo trancado, que vale para todo item, com ou sem via rápida: o plano lista o escopo; achado da crítica ou da V fora dele vira item novo (`depois` com `F<n>`) e nunca entra no PR, qualquer que seja o peso; dentro do escopo vale o teto da Q207.
- Na descrição dos campos da fila (linha 26), onde aparece `via`, acrescente: `"rapida"` marca a via rápida (âncora `via-rapida`); `"subagente"` continua só nos itens antigos.

### 4. Papéis
- `pool/papeis/planejadora.md`, em "Para quem passa": um bullet novo, `item simples → via rápida`, com as duas condições e o destino (E direto, `via: "rapida"`, escopo no plano). Cite `protocolo.md#via-rapida`.
- `pool/papeis/executora.md`, em "O papel": na via rápida, depois do código, a E lança o subagente `design:critico-de-ui` **uma vez**, com o escopo do plano. Nota ≥ 24 sem ressalva alta dentro do escopo → entrega à V. Ressalva alta dentro do escopo → conserta sem recrítica e registra no handoff. Nota < 24 ou item que muda decisão → devolve à planejadora. Achado fora do escopo → não faz: anota no handoff para virar item. Não mexa em "Não lê": a E só **lança** o subagente, não lê a skill.
- `pool/papeis/validadora.md`: na via rápida a validação é leve (gate, diff contido no escopo do plano, a tela aberta, sem auditoria). Em todo item, arquivo ou comportamento do diff fora do escopo do plano é achado `alta` ("fora do escopo: sai do PR e vira item").
- O parágrafo **"Teto da crítica de tela (Q207…)"**, que se repete em `pool/papeis/design.md`, `pool/papeis/planejadora.md`, `pool/papeis/orquestradora.md`, `skills/orquestradora/SKILL.md` (linha 30) e `skills/papeis-e-modelos/SKILL.md` (linha 106): acrescente a **mesma** frase ao fim de cada um: `Achado fora do escopo do plano vira item novo e nunca entra no mesmo PR, qualquer que seja o peso; na via rápida a crítica é uma só, sem recrítica (ADR 0004).` Se algum teste compara essas cópias, ele precisa continuar verde.

### 5. Skill da orquestradora
Arquivo: `plugins/orquestracao/skills/orquestradora/SKILL.md`. Onde a skill descreve o pool sob demanda e o pedido de vaga, acrescente o piso de uma E livre fora do modo ausente: pedir a vaga quando falta e não arquivar a última. Use `grep -n "sob-demanda\|vaga"` para achar o lugar.

### 6. Design: crítica e modelo de CLAUDE.md
- `plugins/design/skills/critica-de-ui/SKILL.md` e `plugins/design/agents/critico-de-ui.md`: a crítica recebe o escopo do plano quando ele existe, e o problema fora dele leva a marca `Fora do escopo` na linha do Peso. Não acrescente campo obrigatório: o `SubagentStop` da guarda valida a forma, e esse validador não muda.
- `modelos/CLAUDE.md`, seção `kit:` "Design de interface", bullet "O fluxo": acrescente `Item simples (reaproveita componente que já existe e não muda decisão registrada) pode ir pela via rápida: sem revisão, com uma crítica só depois do código.` Reproduza a mesma mudança no `CLAUDE.md` da raiz, entre as marcas, e rode os testes do CLI que comparam os dois, se houver.

### 7. ADR e índice
- `docs/adr/README.md`: linha da 0004 no índice, com a célula de decisão até 200 caracteres e Status `Aceito`.

### 8. Gate e PR
- `npm test` verde, `claude plugin validate .` e `claude plugin validate plugins/orquestracao --strict` e `plugins/design --strict`.
- Suba a versão dos plugins tocados (`orquestracao` e `design`) no `plugin.json` e onde o marketplace a repete, seguindo os commits anteriores de versão (`git log -p -3 -- '**/plugin.json'`).
- Commits por passo, push da branch e PR para `main` com o corpo em PT-BR (o caso, o que muda e a saída real do gate). Não mergeie.

## Critério de pronto
- Os testes novos dos passos 1 e 2 falham antes da implementação (cole a saída vermelha no relatório) e passam depois.
- `npm test` passa inteiro (cole o resumo `# pass / # fail`).
- `grep -rn "Sem piso" plugins` não acha nada; `grep -rn "via-rapida" plugins` acha a âncora e pelo menos as citações da planejadora.
- As cinco cópias do teto da Q207 terminam na mesma frase nova (`grep -c "ADR 0004"` em cada um dos cinco arquivos dá ≥ 1).

## Fora de escopo
- A regra 3 (diário sem arquivo único) e a regra 5 (duas vagas na fila de teste), que são do Izanagi.
- Piso para V, P ou D.
- O painel e o pane: nenhuma mudança de UI. `via` já é um campo livre da fila e não ganha validação.
- O `esperando-papel.mjs`, o `fila-do-item.mjs` e o validador da forma da crítica.
- Os worktrees antigos em `.claude/worktrees/`.
