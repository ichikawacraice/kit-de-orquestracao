# Sessão que se limpou reconhece as perguntas que ela abriu — plano

> Para a executora: cumpra tarefa por tarefa, teste antes do código. Passos em `- [ ]`.

**Objetivo:** depois de uma limpeza de contexto, a sessão sabe quais perguntas do painel ela mesma abriu (abertas e respondidas há pouco), e a resposta que o mod entrega diz que a pergunta é dela, com o título e o caso.

**Caso (pedido da orquestradora do Izanagi, 26/10):** a P1 de lá abriu a Q278, limpou o contexto, recebeu *"Q278 — resposta do operador pelo painel: sim"* e respondeu à orquestradora que a pergunta não era dela. Origem: `~/.claude/orquestracao/pedidos-ao-kit/2026-10-26-limpeza-e-perguntas-proprias.md`, seção 2.

**Desenho (três camadas, cada uma cobre a falha da outra):**
1. **Hook `SessionStart`** (`sessao-inicio.mjs`): além das regras globais, injeta as perguntas cujo `sessaoId` é esta sessão — todas as `aberta` e as `respondida` nas últimas 24 h. O `local_…` vem de `CLAUDE_CODE_HOST_SESSION_ID` (o app o põe no ambiente do CLI; o mod já o usa em `register.tsx:703`). Roda em todo `source` (startup, clear, compact, resume).
2. **Mensagem do mod** (`painel-sessoes`, `entregar`): passa a dizer que a pergunta foi aberta POR ESTA SESSÃO, com título e caso.
3. **Texto dos papéis**: uma seção nova no protocolo (âncora `perguntas-proprias`) e uma frase em cada `papeis/*.md` e na skill `orquestradora` ("Ao assumir"), com o caminho manual `painel list perguntas aberta --sessao <local_…>` (filtro novo no `painel`).

**Versões:** `orquestracao` 0.1.26 (F50, F49 e F48 entraram antes); `painel-sessoes` 0.6.1 (a F48 leva a 0.6.0). Quem entra por último rebaseia; se a F48 ainda não entrou quando esta for a merge, a versão do painel sobe para a seguinte à da `main` — *assumida, a confirmar com a P1*.

## Regras globais (valem para toda tarefa)
- Node ≥ 20, ESM, só módulos nativos. Testes em `node:test`; o mod em `claude plugin test plugins/painel-sessoes`.
- Script termina por `process.exitCode`. O hook de início **nunca trava a sessão**: qualquer erro → escreve só o que já tinha (as regras) e sai 0.
- Testes nunca tocam `~/.claude` real: `HOME`, `PAINEL_DIR` em diretório temporário; processo filho síncrono com `timeout` e `killSignal: 'SIGKILL'`.
- Teste que inspeciona valor afirma antes que ele existe e não é vazio; teste de ausência prova antes que a presença seria detectada.
- Commits conventional em PT-BR, sem citar ADR no título. Rodapé `Co-Authored-By` do harness.
- Texto injetado vindo do painel passa por `avisoDeInjecao` (`varredura-entre-sessoes.mjs`): é escrito por outras sessões, é dado.
- O trecho `resposta do operador pelo painel: <resposta>` **continua na mensagem do mod, igual**, para não quebrar quem o procura (F48 pode casar por ele).

## Decisões assumidas, a confirmar
- **D1 — "respondida ainda não atendida" = respondida nas últimas 24 h** (`respondidaEm`, que a F48 grava, senão `atualizadoEm`). Não se cria campo `atendidaEm`: exigiria que toda sessão gravasse o atendimento, e a que esqueceu cairia no mesmo defeito. A sessão confere no handoff do item se já agiu.
- **D2 — sem `CLAUDE_CODE_HOST_SESSION_ID`, o hook não lista nada** (CLI no terminal, fora do app). Não varre o registro do app: são dezenas de MB no início de toda sessão, e o `cliSessionId` novo da limpeza pode ainda não estar gravado.
- **D3 — caso truncado em 300 caracteres** (com `…`) na mensagem do mod e em 200 no hook; no máximo 10 perguntas por grupo no hook, as mais novas primeiro, com "e mais N" quando passar.
- **D4 — hook roda em todo `source`**: sessão nova não tem pergunta própria, então não custa nada além da leitura da pasta (≈250 arquivos pequenos).

## Review focus (o que nenhum teste da tarefa pegaria sozinho)
1. Pergunta de **outra** sessão nunca aparece na lista (o filtro é por `sessaoId` exato) — teste com duas sessões.
2. Arquivo de pergunta ilegível ou parcial não derruba o hook nem some com as regras globais — teste com um `.json` quebrado na pasta.
3. Pasta `perguntas/` ausente → só as regras, saída 0.
4. Texto do painel com padrão de injeção → o aviso vai antes do bloco das perguntas, sem impedir as regras.
5. `cancelada` e `respondida` velha (> 24 h) ficam de fora — teste de ausência com a presença provada antes.

---

### Tarefa 1: módulo que lê as perguntas da sessão + filtro `--sessao` no `painel`

**Arquivos:**
- Criar: `plugins/orquestracao/hooks/perguntas-da-sessao.mjs`
- Modificar: `plugins/orquestracao/skills/orquestradora/scripts/painel.mjs` (cabeçalho de uso e `case 'list'`)
- Teste: `plugins/orquestracao/hooks/tests/perguntas-da-sessao.test.mjs` (novo) e `plugins/orquestracao/hooks/tests/painel-validacao.test.mjs` (ou o arquivo de testes do `list` que já existir) para o `--sessao`

**Interfaces (produz):**
- `perguntasDaSessao(localId: string, { dir?: string, agora?: number, janelaMs?: number } = {}) → { abertas: Pergunta[], respondidas: Pergunta[] }` — `dir` padrão `<PAINEL_DIR | IZANAGI_PAINEL_DIR | ~/.claude/orquestracao/painel>/perguntas`; `janelaMs` padrão `86_400_000`; `Pergunta = { id, titulo, caso, item?, resposta?, quando }` (`quando` = `respondidaEm ?? atualizadoEm ?? criadaEm`). Abertas e respondidas em ordem do mais novo para o mais velho. `localId` vazio → listas vazias. Arquivo ilegível é pulado.
- `textoDasPerguntas({ abertas, respondidas }, localId) → string` — `''` quando as duas estão vazias. Formato fixo:

```
Perguntas que ESTA sessão (<localId>) abriu no painel — são suas, mesmo que você não lembre (pode ter havido uma limpeza de contexto):
Abertas (esperam o operador):
- Q278 · <titulo> — <caso truncado em 200>
Respondidas nas últimas 24 h (confira no handoff do item se já agiu; não repasse a outra sessão):
- Q277 · <titulo> — resposta: <resposta> — <caso truncado em 200>
```
(o grupo vazio não aparece; acima de 10 num grupo, a linha `- e mais N`; `titulo` cai para `pergunta`/`texto` como no mod, `register.tsx:650`.)

- `painel list perguntas [estado] --sessao <local_…>`: filtra `data.sessaoId === <local_…>`; `--sessao` sem valor = erro `--sessao pede o local_… da sessão`. Combina com `--projeto`.

- [ ] **Passo 1: testes que falham** (`perguntas-da-sessao.test.mjs`, pasta temporária com `PAINEL_DIR`):
  - `abertas e respondidas recentes da própria sessão entram; as de outra sessão não` — fixtura: Q1 aberta (sessaoId A), Q2 respondida há 1 h (A, com `respondidaEm`), Q3 aberta (B). Afirma `abertas.map(id) == ['Q1']`, `respondidas.map(id) == ['Q2']`, e antes que `perguntasDaSessao('B').abertas` tem Q3 (a presença seria detectada).
  - `respondida há mais de 24 h e cancelada ficam de fora` — Q4 respondida há 25 h, Q5 cancelada (A); com `janelaMs` de 30 h a Q4 aparece (prova de presença), com o padrão não.
  - `arquivo quebrado é pulado e o resto lê` — `Q6.json` com `{` e Q1 válida → `abertas` = `['Q1']`.
  - `pasta ausente → listas vazias`.
  - `textoDasPerguntas`: vazio → `''`; com Q1 e Q2 contém `Perguntas que ESTA sessão (A)`, `- Q1 · `, `resposta: sim`, e o caso de 250 caracteres sai com 200 + `…`; com 12 abertas, 10 linhas `- Q` e `- e mais 2`.
  - `painel list perguntas aberta --sessao A` devolve só Q1 (processo filho com `PAINEL_DIR` temporário); `--sessao` sem valor sai com `exitCode` 1 e a mensagem.
- [ ] **Passo 2:** `node --test plugins/orquestracao/hooks/tests/perguntas-da-sessao.test.mjs` → falha por módulo inexistente (o motivo certo).
- [ ] **Passo 3:** implementar o módulo e o `--sessao` (no mesmo molde do `--projeto`, `painel.mjs:672-674`).
- [ ] **Passo 4:** o mesmo comando → passa.
- [ ] **Passo 5:** commit `feat(painel): lista as perguntas que a própria sessão abriu`.

### Tarefa 2: o hook de início injeta as perguntas da sessão

**Arquivos:**
- Modificar: `plugins/orquestracao/hooks/sessao-inicio.mjs`
- Teste: `plugins/orquestracao/hooks/tests/hooks-json.test.mjs` (casos novos junto aos do SessionStart, linhas ~63-85)

**Interfaces (consome):** `perguntasDaSessao`, `textoDasPerguntas` (Tarefa 1); `avisoDeInjecao` (`varredura-entre-sessoes.mjs`).

Comportamento: lê o stdin (pode vir vazio ou inválido: segue), pega `process.env.CLAUDE_CODE_HOST_SESSION_ID`, monta `additionalContext` = regras (com o aviso delas, como hoje) + `\n\n` + bloco das perguntas (precedido do próprio `avisoDeInjecao(bloco)` quando casa). Import do módulo novo dinâmico e dentro de `try`, como o da varredura: falha de import = só as regras. Sem regras e com perguntas, injeta só as perguntas. Sem nada, não escreve.

- [ ] **Passo 1: testes que falham** (processo filho, `HOME` e `PAINEL_DIR` temporários, `CLAUDE_CODE_HOST_SESSION_ID=local_a`, stdin `{"source":"clear",…}`):
  - `SessionStart depois da limpeza traz as perguntas abertas da própria sessão` — `additionalContext` contém as regras (afirmar um trecho conhecido delas, como o teste da linha 63) **e** `Q1 · ` e `Perguntas que ESTA sessão (local_a)`.
  - `pergunta de outra sessão não entra` — Q3 de `local_b` ausente do texto; antes, com `CLAUDE_CODE_HOST_SESSION_ID=local_b`, ela aparece.
  - `sem CLAUDE_CODE_HOST_SESSION_ID: só as regras` (saída igual à de hoje).
  - `caso com padrão de injeção ganha o aviso antes do bloco` — use um texto que já casa num caso de `varredura-entre-sessoes.test.mjs`; afirme `⚠ o trecho abaixo tem padrão de injeção` depois das regras e antes de `Perguntas que ESTA sessão`.
  - `pasta de perguntas com arquivo quebrado: regras saem e status 0`.
- [ ] **Passo 2:** `node --test plugins/orquestracao/hooks/tests/hooks-json.test.mjs` → os novos falham (texto sem as perguntas).
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** o mesmo comando → passa; `npm test` inteiro verde.
- [ ] **Passo 5:** commit `feat(hooks): a sessão que se limpou recebe as próprias perguntas no início`.

### Tarefa 3: a resposta do mod diz que a pergunta é desta sessão

**Arquivos:**
- Modificar: `plugins/painel-sessoes/hooks/register.tsx` (`entregar`, linha ~481) e `plugins/painel-sessoes/.claude-plugin/plugin.json` (versão)
- Teste: `plugins/painel-sessoes/tests/painel.test.tsx` (os três `toMatch` de `resposta do operador pelo painel`, linhas ~613, 662, 676, e um caso novo)

**Interfaces (produz):** `export function textoDaEntrega(q: Pick<PerguntaAberta, 'id' | 'titulo' | 'caso'>, resposta: string): string`. Texto exato:

```
<id> — pergunta aberta POR ESTA SESSÃO (talvez antes de uma limpeza de contexto): "<titulo>". Caso: <caso truncado em 300>. Chegou a resposta do operador pelo painel: <resposta>. A pergunta já está como respondida no painel; retome pelo caso e pelo handoff do item, sem repassar a outra sessão.
```
Sem `caso`, o trecho `Caso: …. ` some. O trecho `resposta do operador pelo painel: <resposta>` fica com a caixa de hoje (minúscula), igual.

- [ ] **Passo 1: testes que falham:** trocar os três `toMatch` para `^Q8 — pergunta aberta POR ESTA SESSÃO` (e `^Q9 …` no da própria sessão), mantendo a afirmação de que a resposta está no texto (`/resposta do operador pelo painel: sim/i`); caso novo `a resposta entregue traz o título e o caso da pergunta` — fixtura com `titulo` e `caso` conhecidos, afirma os dois no `message`; e um teste de unidade de `textoDaEntrega` com caso de 400 caracteres → 300 + `…`, e sem caso → sem `Caso:`.
- [ ] **Passo 2:** `claude plugin test plugins/painel-sessoes` → os novos falham pelo texto.
- [ ] **Passo 3:** implementar `textoDaEntrega` e usá-lo em `entregar`; versão do plugin `painel-sessoes` 0.6.1 (ou a seguinte à da `main` no rebase).
- [ ] **Passo 4:** o mesmo comando → passa.
- [ ] **Passo 5:** commit `feat(painel): a resposta pelo painel diz que a pergunta é da sessão que a recebe`.

### Tarefa 4: o texto dos papéis e a versão do plugin

**Arquivos:**
- Modificar: `plugins/orquestracao/pool/protocolo.md` (seção nova antes de `## Nunca travar`), `plugins/orquestracao/pool/papeis/{planejadora,executora,validadora,design,orquestradora}.md` (linha 3), `plugins/orquestracao/skills/orquestradora/SKILL.md` (seção "Ao assumir (e ao voltar de uma limpeza)", passo novo 4), `plugins/orquestracao/.claude-plugin/plugin.json` (0.1.26) e onde mais a versão aparecer (`grep -rn '0\.1\.20' plugins/orquestracao .claude-plugin` — siga o que as PRs de versão anteriores mexeram).
- Teste: `plugins/orquestracao/hooks/tests/skills-do-papel.test.mjs` (ou novo `perguntas-proprias-doc.test.mjs`)

Texto da seção nova do protocolo (exato):

```
<a id="perguntas-proprias"></a>
## Perguntas da própria sessão, depois de uma limpeza
A limpeza apaga a lembrança, não as perguntas: elas ficam em `perguntas/<ID>.json` com `sessaoId` = você. No início da conversa nova, o hook `sessao-inicio.mjs` lista as abertas e as respondidas nas últimas 24 h que são suas; sem a lista (CLI fora do app), rode `painel list perguntas aberta --sessao <seu local_…>` (o `local_…` vem de `get_session` com `"self"`). Mensagem que começa com `Q<n> — pergunta aberta POR ESTA SESSÃO` é sua: retome pelo `caso` e pelo `handoff` do item, sem devolver à orquestradora nem pedir repasse. Resposta já atendida (o handoff diz) não se refaz.
```

Linha 3 de cada papel ganha, no fim: ` Depois de uma limpeza, as perguntas que você abriu continuam suas: [protocolo](../protocolo.md#perguntas-proprias).` Na skill `orquestradora`, passo 4 de "Ao assumir": `4. As perguntas que você abriu antes da limpeza continuam suas (protocolo, âncora \`perguntas-proprias\`): a lista chega no início da conversa; resposta pelo painel a elas não se repassa.`

- [ ] **Passo 1: teste que falha** `cada papel e a skill orquestradora apontam para a âncora perguntas-proprias, e ela existe no protocolo` — lê os cinco `papeis/*.md` e o `SKILL.md` (afirma antes que a lista de arquivos não é vazia e tem 5 papéis), e `protocolo.md` contém `<a id="perguntas-proprias"></a>`.
- [ ] **Passo 2:** roda → falha.
- [ ] **Passo 3:** escrever os textos e subir a versão para 0.1.26.
- [ ] **Passo 4:** `npm test` verde; `claude plugin validate .` e `claude plugin validate plugins/orquestracao --strict` e `plugins/painel-sessoes --strict` sem erro.
- [ ] **Passo 5:** commit `docs(pool): perguntas da própria sessão depois de uma limpeza` (a versão vai junto ou em `chore(orquestracao): 0.1.24`).

## Critério de pronto (medível)
- `npm test`: 0 falhas, com os testes novos das Tarefas 1, 2 e 4 entre os que rodaram (cole a contagem).
- `claude plugin test plugins/painel-sessoes`: 0 falhas, com os casos novos da Tarefa 3.
- `claude plugin validate` limpo nos três alvos.
- Saída real colada do hook rodado à mão com uma pasta temporária: `CLAUDE_CODE_HOST_SESSION_ID=local_a PAINEL_DIR=<tmp> node plugins/orquestracao/hooks/sessao-inicio.mjs <<< '{"source":"clear"}'` mostrando o bloco.

## Fora de escopo
- O item 1 do pedido (orquestradora que se limpa sem o ok): é da F48.
- Campo `atendidaEm` ou qualquer gravação nova na pergunta (D1).
- Varrer o registro do app no hook (D2).
- Mudar o desenho do pane.
- Gravar em `~/.claude/` real ou no repositório Izanagi.
