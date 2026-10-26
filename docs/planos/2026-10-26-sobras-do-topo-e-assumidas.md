# Plano · o painel não deixa sobra no topo da fila nem na decisão assumida (F85)

Base: `main` em `76ecef1`. Versões: `painel-sessoes` 0.6.10 → **0.6.11**; `orquestracao` 0.1.37 → **0.1.38** (o hook muda na parte D).
Origem: sobras do F82 (laudos `F82-laudo-V.md` e `F82-laudo-V2.md`, em `~/.claude/orquestracao/pool/handoffs/arquivo/`), achado B1 do F51 e a pendência do F59. Aprovado em Q346; decisões assumidas Q348 (desenho da parte D) e Q349 (texto da parte C).

## Medido (76ecef1)
- `register.tsx:737`: depois de um pedido com destino único, `enviarPedidos` abre a orquestradora com `botao: auto:<orq>`. `botaoOrquestradora` (`register.tsx:1500`) acende "Abrindo…" só com `abrindoAgora?.botao === key`, então nenhum botão `orq:*` acende enquanto ela abre, e o clique nele é ignorado pela guarda de `localId`, sem nada mudar na tela (sonda do `F82-laudo-V.md`, seção "Foco automático").
- `register.tsx:1452`: o "Abrir <apelido>" monta `botao = abrir:${itemId}:${localId}` mas usa `key={abrir:${localId}}`. O mesmo dono em dois cartões dá duas `key` iguais; o motor de teste recusa `press` ("key each once") e o caso não tem teste. Mutações M2b, M3b e M6 do laudo sobreviveram.
- `register.tsx:1498` (`textoDoAviso`): "Sem orquestradora ativa em <projeto> · N item" não diz a saída (R1 média do `F82-laudo-V2.md`).
- Perguntas com `estado: "assumida"`: 22 no painel real. O mod só lê `aberta` (`register.tsx:853`); as assumidas caem em `anteriores` (`register.tsx:871`, filtro `!== 'aberta'`) e aparecem em "Perguntas respondidas" como se estivessem fechadas, sem botão. `responder()` (`register.tsx:464`) recusa tudo que não seja `aberta`. O hook `perguntas-da-sessao.mjs` só junta `aberta` e `respondida`: a sessão que se limpou esquece o que assumiu.
- Convenção já usada para confirmar (Q339): `estado: "respondida"`, `resposta: "confirmada pelo operador (…)"`.

## Partes (uma por commit, teste antes do código)

### A · "Abrindo…" no botão da orquestradora aberta sozinha
- Teste vermelho (em `tests/painel.test.tsx`, nome `F85 A: …`): segurar o `open_session_in`, pedir um item com destino único (como a sonda do laudo); enquanto abre, o botão `orq:<projeto>` diz "Abrindo…"; clicar nele não pede outro `open_session_in` (conte as chamadas: 1). Depois que abre, volta a "Abrir a orquestradora".
- Código: em `botaoOrquestradora`, o rótulo acende "Abrindo…" quando `abrindoAgora?.botao === key` **ou** `abrindoAgora?.botao === \`auto:${id}\``. Não mexer em `enviarPedidos`.
- Mutação para conferir: tirar o `auto:` do rótulo deixa o teste vermelho.

### B · chave única no "Abrir <apelido>"
- Código: `key={botao}` (o `abrir:${itemId}:${localId}` que já existe). Na pergunta o item é `pergunta:<Q>`, então a chave fica `abrir:pergunta:<Q>:<localId>`.
- Atualize os testes que acham o botão por `abrir:${P7}` e afins (`painel.test.tsx` ~943–1131 e F34-3 ~1486) para a chave nova. Não afrouxe asserção: onde o teste conta "um botão só por sessão", conte na chave do item.
- Teste novo `F85 B`: o mesmo dono (P1) no `com` de dois itens diferentes, com link. (1) há dois botões, cada `key` aparece uma vez; (2) `press` no do item 1 com o `open_session_in` segurado: só ele diz "Abrindo…", o do item 2 segue "Abrir P1"; (3) `press` no do item 2 enquanto o 1 abre não pede outro `open_session_in`. Este teste tem de matar M2b (rótulo por `localId`), M3b (guarda por `botao`) e M6 (chave sem o item): rode as três mutações uma por vez e cole o resultado no relatório.

### C · o aviso diz o que fazer (Q349, assumida)
- `textoDoAviso`, ramo sem orquestradora: com `n`, `Sem orquestradora ativa em ${projeto} · ${n} item(ns) · abra uma orquestradora para pedir`; sem `n` (cartão), `Sem orquestradora ativa em ${projeto} · abra uma orquestradora para pedir`. O U+00A0 continua só dentro de `· N item`.
- Atualize os testes de `painel.test.tsx:2427`, `2863`, `2871` para o texto inteiro novo e acrescente o do cartão. O mock em `docs/design/revisoes/` não se mexe (é histórico).

### D · decisão assumida no painel e no hook (Q348, assumida)
Tipos (`types/index.d.ts`): `PerguntaAberta` ganha `assumida?: boolean` (ou um tipo irmão, à escolha da E, sem duplicar campos); `Leitura` ganha `assumidas: PerguntaAberta[]` (o `VAZIA` e o estado antigo sem o campo valem `[]`).

Leitura (`register.tsx`, em `ler`):
- `assumidas` = perguntas com `estado === 'assumida'`, montadas como as abertas (mesmo `map`), **mais nova primeiro** (número desc).
- `anteriores` passa a excluir `assumida` (só o que fechou: `respondida`, `cancelada` e outros que não sejam `aberta` nem `assumida`).
- `contarSecoes`, a barra e o "Esperam você" **não** contam assumidas.

Tela (as duas superfícies: o pane desenhado em SVG e a do terminal):
- No rodapé, ao lado de "Perguntas respondidas", o botão `key="assumidas"` com `▸/▾ Decisões assumidas · N` (só com N > 0), que alterna um átomo novo `verAssumidas` (padrão recolhido).
- Aberto: cada assumida num cartão como o da pergunta, com a linha `Assumido: <recomendacao>` no lugar de `Recomendo:` (no SVG, `perguntaSvg` ganha um parâmetro do rótulo, padrão `Recomendo`; no terminal, o `Text` correspondente). Sem `recomendacao`, o cartão mostra o `titulo` (que já cai para `pergunta`/`texto`). O botão "Abrir <sessão>" da pergunta vale aqui também, com a chave `abrir:assumida:<Q>:<localId>`.
- Ações: **Confirmar** (`primary`, `key="<Q>:confirmar"`) e **Mudar…** (`secondary`, abre o `Input` como o "Responder…"; `submitLabel` "Enviar").
- Confirmar grava `estado: "respondida"`, `resposta: "confirmada pelo operador (painel)"`, `respondidaPor`/`respondidaEm` e **não** manda nada à sessão (não acorda ninguém). Toast: `<Q> confirmada`.
- Mudar… grava `estado: "respondida"`, `resposta: <texto>` e entrega à sessão dona pelo caminho de hoje (`entregar`), com o texto próprio: `<Q> — decisão que ESTA sessão assumiu (talvez antes de uma limpeza de contexto): "<titulo>". O operador mudou pelo painel: <texto>. A pergunta já está como respondida no painel; ajuste pelo caso e pelo handoff do item.`
- `responder()` ganha o estado esperado (`'aberta'` padrão, `'assumida'` para estes botões) na trava de versão; a mensagem de "mudou desde a leitura" segue igual. Estado do botão em curso ("Enviando…") igual ao das perguntas.

Hook (`plugins/orquestracao/hooks/perguntas-da-sessao.mjs`):
- `perguntasDaSessao` devolve também `assumidas` (estado `assumida` da sessão, sem janela de tempo, mais nova primeiro); o vazio vira `{ abertas: [], respondidas: [], assumidas: [] }`.
- `textoDasPerguntas` acrescenta o grupo `Assumidas por você, a confirmar pelo operador (seguem valendo até ele confirmar ou mudar no painel):` com `- <Q> · <titulo> — assumido: <recomendacao>`. Sem nenhuma das três, texto vazio como hoje.
- Testes em `hooks/tests/perguntas-da-sessao.test.mjs`: assumida da sessão aparece; a de outra sessão não; a presença seria detectada (prove com uma da sessão antes de medir a ausência); os `deepEqual` do vazio passam a ter `assumidas: []`.

Testes do mod (`F85 D …`): (1) assumida não entra em "Perguntas respondidas" nem no contador; (2) o botão do rodapé mostra o N certo e abre a lista; (3) Confirmar grava o JSON esperado (leia o arquivo) e não chama `send_message`; (4) Mudar… grava a resposta e chama `send_message` com o texto novo; (5) assumida que mudou de versão desde a leitura não é sobrescrita e vira aviso. Cada teste afirma antes que o insumo existe e não é vazio.

## Fechamento
- `plugin.json`: painel 0.6.11, orquestracao 0.1.38.
- Gate: `npm test` e `claude plugin test plugins/painel-sessoes` verdes; `claude plugin validate . ` e `claude plugin validate plugins/painel-sessoes --strict` e `plugins/orquestracao --strict`.
- Auditoria de clique (skill `processos:auditoria-de-clique`) dos gestos novos e mudados: Confirmar, Mudar…/Enviar, "Abrir <apelido>" em dois cartões, "Abrir a orquestradora" depois do pedido. Uma linha por gesto no relatório: o que grava, quem relê, o que a tela mostra.
- React: regras da `vercel-react-best-practices` que tocam aqui — `key` estável e única por irmão (é a parte B); nada de estado derivado guardado em átomo quando sai da leitura.
- Commits conventional em PT-BR (`fix(painel): …`, `feat(painel): …`, `feat(orquestracao): …`), sem citar ADR nem F-número no título.

## Fora do escopo
- O cartão do resumo da ausência (pede revisão da designer).
- Migrar as assumidas antigas (sem `titulo`/`recomendacao`): o cartão só cai para o `texto` delas.
- Abrir a orquestradora pelo painel quando o projeto não tem uma (seria botão novo).
- R2 e R3 do `F82-laudo-V2.md` (vocabulário "cartão" × "item").

## Critério de pronto
- Os testes `F85 A`, `F85 B`, `F85 C`, `F85 D` e os do hook verdes no HEAD e vermelhos pelo motivo certo sem o código (relatório com a saída real).
- M2b, M3b e M6 mortas pelo `F85 B`.
- Gate verde com os números colados; versões trocadas; PR aberto contra `main` com o rebase em dia.
