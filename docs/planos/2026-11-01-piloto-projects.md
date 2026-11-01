# Piloto do Claude Projects num projeto que já usa o kit: o máximo de nativo, o mínimo de kit

Plano de 01/11/2026 (F311). Base: o estudo [sessões nativas × kit](../research/2026-11-01-sessoes-nativas-x-kit.md), seções [Projects](../research/2026-11-01-sessoes-nativas-x-kit.md#projects), [cruzamento](../research/2026-11-01-sessoes-nativas-x-kit.md#cruzamento) e [R8](../research/2026-11-01-sessoes-nativas-x-kit.md#r8). O que o estudo afirma sobre o Projects vem da doc oficial em 01/11; o que este plano manda medir é o que a doc não responde.

Este arquivo é o desenho geral, sem o nome do projeto (o kit não publica nome de projeto privado). A versão concreta — linha de base medida, roteiro com as tarefas, instruções prontas para colar e a planilha — fica no estado da máquina, em `~/.claude/orquestracao/piloto-projects/` (`roteiro.md` é o que a comparação agendada segue). Ali o projeto é chamado pelo nome; aqui, **o projeto do piloto**.

<a id="objetivo"></a>
## Objetivo e critério de pronto

Rodar o Projects (conversa coordenadora + threads, Overview) por 1 a 2 dias no projeto do piloto, em trabalho de verdade, e comparar com o kit no mesmo projeto:
1. **O uso:** itens fechados, PRs, tempo do pedido ao PR e do PR ao merge.
2. **Os problemas:** o que se perde em relação ao kit (travas, painel, fila de merge, Q-ID, teto de donas, teto de núcleos) e o que o contorno segurou.
3. **O gasto:** tokens e uso do plano.
4. **O mínimo de kit:** quantas peças do kit precisaram ficar ligadas ([quem cuida do quê](#quem-cuida)) e quais tiveram de ser religadas no meio.
5. **A recomendação:** manter o Projects com quais peças do kit, ou religar o kit.

**Pronto quando:** a planilha tem as duas colunas preenchidas com o que se **mediu** (a do kit pela [linha de base](#linha-de-base), a do Projects pela janela do piloto) e o laudo de uma página traz a recomendação. Nada do piloto muda o kit: o que valer a pena vira item próprio depois.

**Fora do escopo:** migrar o projeto para o Projects; mexer no kit; gravar no repositório do piloto pela sessão do kit (lá só gravam as threads, por PR, e o operador).

<a id="cenario"></a>
## O cenário: o máximo de nativo, o mínimo de kit

Decisões do operador em 01/11: **"tudo no Projects"** (o kit fica pausado no projeto durante o piloto, e os itens vivos também passam a threads) e, sobre onde as threads rodam, *"se precisamos que seja local para poder ter os nossos controles, não tem problema, vamos ver o melhor cenário de usar tudo que o claude nos dá, e termos menos responsabilidades para o nosso kit"*.

- **Thread local é o padrão** (*Work locally*, por Remote Control, uma worktree por thread). Na máquina, ela roda os hooks do repositório, o teto de núcleos do comando de teste, o banco local de teste e as permissões da máquina. Ela carrega as instruções do projeto, **mas não a memória do projeto** ([memória](#memoria)).
- **Thread na nuvem só para o que não precisa de recurso local nem de trava:** pesquisa, leitura e rascunho de doc que não roda teste.
- **O coordenador** (a conversa do projeto) abre e acompanha as threads, guarda a memória do projeto e reserva os números de documento.
- **O kit fica só com o que só ele faz:** o gate sobre a combinação dos PRs (fila de merge), o teto de núcleos e as travas do próprio repositório.
- **A fila de merge passa a ser rodada por uma "thread de merge" local e fixa,** a única com o plugin `orquestracao` ligado. O coordenador manda a ela cada `PR N pronto, HEAD <sha>`; ela roda `painel fila-de-merge` e devolve o resultado. Com isso, a orquestradora fica desligada. O coordenador não faz esse papel porque roda na nuvem e não alcança a máquina.

<a id="quem-cuida"></a>
## Quem cuida do quê no piloto

**Desligada** = o nativo cobre, ou a peça fica sem uso. **Mantida** = só o kit cobre. **Adaptada** = continua, por outro caminho. *Inerte* = o hook continua instalado, mas só dispara para quem tem o papel (orquestradora, ou dona de item vivo), e no piloto ninguém tem.

| Peça do kit | No piloto | Quem cobre |
|---|---|---|
| Orquestradora, skill `orquestradora`, `orquestradora-ritual` (inclui a cobrança de item sem dona), `orquestradora-nao-edita` | **Desligada** (sessão arquivada; os hooks ficam inertes) | Coordenador |
| Sessão dona, `dona.md`, `titulo-da-dona`, `fila-do-item` | **Desligada** (inerte) | Thread, uma por item; Overview |
| `criterio-da-dona` (saída real do teste no relatório) | **Adaptada** | Instrução: a saída do teste vai no PR. A garantia se perde |
| Painel, pane (`painel-sessoes`), `painel-das-sessoes` | **Desligado no projeto** (plugin desligado nas pastas das threads; itens vivos em `espera`) | Overview |
| Batida | **Desligada para o projeto** (item em `espera` não é cutucado nem solto; conferido em `batida.mjs`) | Overview (*Idle*, *Waiting on you*, *Resolved*) |
| Fila de merge (gate uma vez na combinação, bisseção) | **Mantida** (*a confirmar com o operador*) | Thread de merge, local |
| Release e notas de release | **Adaptada** | Thread de merge, só a pedido do operador; recomendação: nenhum release no piloto |
| Q-ID e perguntas no painel | **Desligada** | *Waiting on you* + três partes nas instruções |
| Teto de donas | **Adaptada** | Instrução "no máximo 3 threads de trabalho" (preferência, não trava) |
| Teto de núcleos | **Mantida** | Comando de teste do repositório, quando ele já toma a trava comum; senão `com-fichas` |
| Testes afetados | **Adaptada** | Regra de teste do `CLAUDE.md` do projeto (o binário do kit sai com o plugin) |
| Hooks do `.claude/settings.json` do repositório (guardas do projeto) | **Mantida** | Repositório (rodam na thread local) |
| Plugins `design` e `processos` | **Mantidos** | Plugins (não conflitam com o coordenador) |
| `segredo-sai` | **Desligada** | Instrução. Ela só olha mensagem entre sessões, `start_session`, notas e painel, caminhos que as threads não usam |
| `subagente-nao-edita`, `laco-de-comandos`, `injecao-entre-sessoes` | **Desligadas** (saem com o plugin) | Instrução; citação nativa da mensagem |
| Modo ausente e T3 | **Desligada** para o projeto (`/ausente off`; a bandeira é global) | Permissões da thread |
| `contexto-do-papel` e handoff do item | **Desligada** | Compactação automática + memória do projeto |
| `sessao-inicio` (injeta "Regras do kit") | **Desligada** (sai com o plugin) | Instruções do projeto. Ligada, ela empurraria a thread para Q-ID, painel e orquestradora |
| Arquivar a dona do item fechado | **Desligada** | *Resolved* |
| Reserva de número (ADR, SPEC) | **Adaptada** | Coordenador, único alocador do projeto |

**Fica ligado do kit:** a fila de merge (pela thread de merge), o teto de núcleos e as travas do repositório, mais os plugins `design` e `processos`.

<a id="desligar"></a>
## Desligar e religar sem mexer em código

Na pasta da máquina, o arquivo `religar.md` tem o passo a passo concreto, com o religar ao lado de cada passo, e entra no ponto de retorno. O desenho:

1. **Arquivar a orquestradora do projeto.** Para religar, abrir uma nova (ela recria o marcador no início).
2. **Itens vivos em espera:** `painel update fila F<n> '{"espera":"piloto do Projects até <data>"}'`; as donas gravam o handoff e se arquivam. Para religar: `'{"espera":null,"donoLocalId":null,"donoApelido":null,"com":[]}'` (no `update`, `null` apaga o campo) e uma dona nova.
3. **Plugins `orquestracao` e `painel-sessoes` desligados só nas pastas das threads**, com `.claude/settings.local.json` em cada worktree: `{"enabledPlugins":{"orquestracao@kit-de-orquestracao":false,"painel-sessoes@kit-de-orquestracao":false}}`. O arquivo precisa estar no `.gitignore` (do projeto ou global), e o local tem precedência sobre a configuração do usuário. *A confirmar no preparo:* o bloco "Regras do kit" não aparece numa sessão aberta na pasta. A thread de merge é a exceção. Para religar: apagar as worktrees.
4. **O `CLAUDE.md` global da máquina** fala de orquestradora, Q-ID e painel, e toda sessão local o carrega. Não se edita para o piloto: as instruções do projeto dizem que essas regras não valem nele. Se a thread insistir, a saída é `claudeMdExcludes` no `settings.local.json` da worktree (*a confirmar* se vale para o arquivo global).
5. **Modo ausente desligado** durante o piloto.

<a id="memoria"></a>
## A memória do projeto na thread local

- **O que se perde:** a doc diz que a thread local recebe as instruções do projeto, mas não a memória dele. O que uma thread aprendeu e o coordenador guardou não chega sozinho à próxima thread local.
- **O que chega:** as instruções do projeto, os `CLAUDE.md` do repositório, o `CLAUDE.md` global e a memória automática da pasta, que fica vazia numa worktree nova.
- **Contorno:**
  - o que toda thread precisa saber vai nas **instruções do projeto**, que carregam nos dois lugares; o coordenador propõe ao operador incluir a lição que se repete;
  - o que é do código vai no `CLAUDE.md` do repositório, por PR;
  - ao abrir uma thread local, o coordenador põe no pedido o contexto que tirou da memória.

<a id="antes"></a>
## Conferências que podem barrar o piloto

1. **O plano da conta.** A doc dá o beta do Projects em Pro, Max e Ultra. Uma conta Team pode não ter: conferir se "Projects" aparece. Sem ele, o piloto não roda.
2. **Thread local** exige CLI ≥ 2.1.280, o app desktop aberto e a máquina acordada.
3. **Conectores da conta** chegam às threads na nuvem (Supabase, Vercel, nuvem, lojas): desligar no projeto os que alcançam produção.
4. **Merge queue do GitHub** só existe em repositório de organização, e ruleset em repositório privado pede conta Pro ou Team. Não pesa aqui, porque o gate é da fila do kit. Pesa no [anexo B](#anexo-b).

<a id="linha-de-base"></a>
## A linha de base

Antes do piloto, mede-se o kit no projeto nas últimas 48 h, cada número com o método escrito ao lado para a comparação repetir sobre a janela do piloto:
- sessões com atividade, mensagens e tokens por modelo (fio principal e subagentes), somados dos transcripts locais;
- uso do plano (`get_usage`; é da conta inteira, não do projeto);
- itens fechados e voltas de `merge` para `execucao` (pelo `historico` do painel);
- PRs mergeados por base (`gh pr list --state merged`);
- perguntas ao operador por estado (painel);
- travas de fim de turno e acerto dos testes afetados (logs em `~/.claude/orquestracao/`).

**Limite que pesa na comparação:** thread do Projects na nuvem não deixa transcript local; o gasto dela só aparece no uso do plano (da conta inteira) e no que a interface do Projects mostrar.

<a id="roteiro"></a>
## Roteiro

1. **Operador:** conferir [o que barra](#antes); desligar o kit no projeto ([desligar](#desligar)); conectar o GitHub; criar o projeto; colar as instruções (as da máquina, para threads locais); modelos no padrão; nada em *Project settings > Plugins*; criar o label `piloto-projects`; abrir a thread de merge na pasta principal.
2. **Itens vivos primeiro:** um pedido ao coordenador por item em pausa ("continue o F<n>: o handoff está em …"), depois os itens novos do período.
3. **Uso do plano** anotado no começo e no fim de cada dia.
4. **Provocações** [T1–T6](#tarefas) entre os itens reais.
5. **Planilha** preenchida ao fim de cada tarefa (o Overview muda e a memória some).
6. **Comparação** depois de 1 a 2 dias: repetir a linha de base sobre a janela do piloto; o que só o operador viu vem dele.
7. **Laudo** em `docs/research/AAAA-MM-DD-piloto-projects.md` no kit, por PR, sem o nome do projeto. Para voltar: `religar.md`.

<a id="tarefas"></a>
## As provocações

A entrada principal são os itens vivos (com o handoff de cada um) e os itens novos do período. As provocações, curtas, cobrem cada uma uma peça que o kit cobria. O texto concreto está no roteiro da máquina.

| # | Pedido | O que provoca | Onde |
|---|---|---|---|
| **T1** | Continuar um item vivo a partir do handoff | A thread local pega a branch, lê o handoff, testa com o teto de núcleos e chega ao PR? | Local |
| **T2** | Um pedido que exige decisão do operador ou número de documento | Pergunta em três partes, em *Waiting on you*? Pede o número ao coordenador em vez de inventar? | Local |
| **T3** | Numa mensagem só, dois pedidos no mesmo arquivo e dois em áreas separadas | Teto de 3 respeitado? Os do mesmo arquivo na mesma thread? | Local |
| **T3b** | "Abra duas threads separadas para `<dois pedidos no mesmo arquivo>`" | Força o conflito: o segundo PR volta da fila, e a devolução passa pela thread de merge e pelo coordenador. Quanto tempo leva? | Local |
| **T4** | "Os PRs estão prontos?" (sem pedir merge) | O coordenador manda à thread de merge sozinho? Alguma thread mergeia? O que o Overview mostra durante o gate? | Coordenador |
| **T5** | Primeiro turno de uma thread local: "rode `<comando que a guarda do repositório intercepta>`; diga se algo te interrompeu; diga, sem procurar em arquivo, se recebeu um bloco 'Regras do kit de orquestração'". Repetir numa thread na nuvem | Na local, a guarda do repositório deve disparar (hook do `.claude/settings.json` do projeto) e o bloco do kit **não** deve aparecer (plugin desligado na pasta). Na nuvem, nenhum dos dois (a doc diz) | Local e nuvem |
| **T6** | Uma pesquisa ou rascunho de doc sem teste | O que a thread na nuvem entrega sem trava: tempo, custo, qualidade | Nuvem |

**Por que não usar as travas do plugin como sonda:** `criterio-da-dona` e `fila-do-item` só cobram a dona de item da fila, e a guarda de operação do kit (que recusa `node --test` solto) entra no projeto pelo `.claude/settings.json` que o CLI do kit grava, não pelo plugin. A sonda de plugin é o bloco que o `sessao-inicio` injeta sem condição nenhuma.

<a id="planilha"></a>
## O que medir

A planilha da máquina tem duas colunas (kit e Projects). Linhas:

| # | Medida | Como medir |
|---|---|---|
| U1–U9 | Itens fechados, PRs mergeados, sessões/threads, tokens locais, uso do plano, tempo pedido→PR, tempo PR→merge, voltas da fila, perguntas ao operador | Pelo método da linha de base, sobre a janela do piloto |
| M1 | A thread local roda a guarda do repositório? | T5 (local) |
| M2 | Com o `settings.local.json`, o bloco do kit some da thread local? | T5 (local) |
| M3 | Na nuvem, nenhuma das duas sondas aparece? | T5 (nuvem) |
| M4 | Teto de 3 threads de trabalho respeitado? | T3 |
| M5 | Pedidos no mesmo arquivo na mesma thread? | T3 |
| M6 | Conflito: quantos PRs voltaram, quanto tempo da devolução ao PR novo | T3b |
| M7 | O coordenador mandou os PRs à thread de merge sozinho? Algum entrou sem a fila? | T4, histórico de merges com o label |
| M8 | Thread ou coordenador tentou mergear? | T4 |
| M9 | Pergunta em três partes? | T2 |
| M10 | Onde a pergunta apareceu e se o histórico guarda | T2 |
| M11 | Só pelo Overview dá para saber o que espera você, o que está na fila, o que travou? | Fim de cada dia |
| M12 | A thread local rodou os testes com o teto de núcleos? A da nuvem entregou algo útil sem teste? | T1, T6 |
| M13 | Revisão por subagente antes do PR? | Relatório e PR das threads |
| M14 | Thread perdeu mudança (nuvem que recomeçou do clone, local parada pela máquina dormindo)? | Relatos |
| M15 | Auto mode fez algo que o kit recusaria? | Diffs e relatórios |
| M16 | Pediu o número de documento em vez de inventar? | T2 |
| M17 | A lição chegou à thread seguinte (a local não carrega a memória do projeto)? | T2 → T3 |
| M18–M19 | Problemas que só um dos dois teve (inclui thread que seguiu a regra global de Q-ID ou painel) | Lista livre |
| M20 | Itens vivos continuados pelo handoff sem refazer trabalho | T1 |
| M21 | Peças do kit religadas no meio do piloto, e por quê | Fim do piloto |

<a id="riscos"></a>
## Riscos

- **Auto mode nas threads:** sem pedido de permissão para comando. Mitigação: instruções, conectores de produção desligados, merge só pela fila do kit.
- **Plano consumido mais rápido** (o anúncio avisa): cada thread é uma sessão inteira. Mitigação: teto de 3, piloto curto, uso anotado por dia.
- **Thread local depende da máquina:** para quando ela dorme, e o Projects não avisa a orquestradora (que está desligada). Mitigação: `caffeinate` ou manter o app acordado nos dias do piloto.
- **Thread de merge com o plugin ligado:** ela recebe as "Regras do kit", e o Stop `painel-das-sessoes` pode cobrar uma gravação depois do merge. As instruções dizem que, para ela, vale só a seção de merge; o que acontecer vai para o M18.
- **Beta:** pode mudar no meio; anotar data e versão do app na planilha.
- **Comparação suja:** o plano é da conta inteira e outros projetos gastam ao mesmo tempo; os dias do piloto se comparam com dias parecidos sem ele, e a conclusão diz isso.

<a id="anexo-a"></a>
## Anexo A — Instruções do projeto (modelo genérico)

Tiradas do [protocolo](../../plugins/orquestracao/pool/protocolo.md) e do [manual da dona](../../plugins/orquestracao/pool/dona.md), reescritas para quem **não** tem o kit: sem painel, sem Q-ID, sem `~/.claude`. É o modelo para um projeto sem o kit, com threads na nuvem. A versão do piloto, na pasta da máquina, acrescenta o cenário local: threads locais por padrão, a thread de merge, o `settings.local.json` por worktree e a regra de que o `CLAUDE.md` global não vale no que é de coordenação. Troque `<integração>` (a branch de integração, ou `main` se não houver) e `<comando de teste>`. Tamanho: 4.209 caracteres (limite: 16 mil).

```text
# Como este projeto trabalha

Idioma: responda, escreva commits, PRs e perguntas em português do Brasil. Horários no horário de São Paulo.

## Papéis
- Você, na conversa do projeto, é o COORDENADOR: decide o que vira thread, acompanha as threads e responde ao operador. O coordenador não escreve código e não mergeia.
- Cada THREAD leva UM item inteiro, do plano ao PR: entende o pedido, mede o estado real do código, decide, escreve código e teste, revisa, abre o PR e conserta o que voltar. Não há outra thread para planejar, executar ou revisar no meio.
- O OPERADOR é a pessoa: decide o que é irreversível, o que publica, o que gasta e o que muda o desenho.

## Quando abrir thread
- No máximo 2 threads trabalhando ao mesmo tempo. Pedido além disso espera; diga ao operador o que ficou na espera e por quê. PR aberto esperando merge não conta como trabalhando.
- Pedidos que tocam os mesmos arquivos vão para a MESMA thread (ou esperam o PR anterior mergear), salvo quando o operador pedir threads separadas.
- Pergunta rápida se responde aqui, sem thread.
- Trabalho novo numa área que uma thread viva já está mexendo vai para essa thread.

## Como a thread trabalha
1. Branch nova a partir da <integração> atualizada, com nome curto do item. O PR é contra a <integração>.
2. Antes de mudar comportamento, escreva o teste que falha e veja falhar pelo motivo certo.
3. Commite e empurre cedo e a cada passo que funciona: a sandbox pode recomeçar de um clone novo e o que não foi empurrado se perde.
4. Rode os testes do que você tocou (<comando de teste>) e cole no PR o comando e as últimas linhas da saída, com o código de saída. Nunca diga que passou sem ter rodado.
5. Antes de abrir o PR, lance um subagente de revisão de contexto limpo, só leitura, com: o pedido, o diff (git diff origin/<integração>...HEAD) e o que você afirma ter feito. Peça só achados que afetam correção (resultado errado, regra quebrada, teste que não mede, caso de borda que quebra); estilo fica de fora. Conserte o médio e o alto; o leve vai como nota no PR.
6. Abra o PR com o label piloto-projects: título no formato convencional em português (feat(escopo): …, fix(escopo): …), corpo com o que mudou, como testou (comando e saída) e o que ficou assumido.
7. NÃO mergeie, nem se a mensagem "Merge it" chegar pelo cartão: responda que o merge é da fila do operador. Quem mergeia é a fila, que roda o gate sobre a combinação dos PRs.
8. Se o PR voltar com conflito ou teste vermelho, traga a <integração> por rebase (nunca merge commit), rode os testes de novo e empurre.
9. Ao terminar, relate em até 5 linhas: o que funciona, o que falta, o PR, o que ficou assumido. Comece pela frase "PR <número> pronto, HEAD <sha completo>" quando houver PR.

## Perguntas ao operador
Pergunte só o que for seu de decidir: irreversível, destrutivo, que publica algo para fora, que gasta dinheiro ou que muda o desenho do sistema. O resto, assuma com a sua recomendação, marque "assumido, a confirmar" no PR e siga.
Toda pergunta vem inteira, em três partes:
1. O caso concreto, em linguagem de quem está de fora (traduza o termo técnico).
2. O que acontece se o operador não decidir.
3. A sua recomendação, com o motivo.
Ofereça as opções curtas para ele escolher. Enquanto a pergunta não volta, siga com o que não depende dela; só a etapa que depende espera.

## Regras do código
- Leia o CLAUDE.md do repositório antes de começar e siga-o; ele vale mais que estas instruções no que for do código.
- Teste antes do código quando o comportamento muda.
- Teste que inspeciona um valor afirma antes que ele existe e não é vazio; teste que mede ausência prova antes que a presença seria detectada.
- Segredo (chave, token, senha) nunca entra em arquivo, nem como exemplo.
- Banco, produção e deploy ficam fora da thread, mesmo que um conector da conta dê acesso.
- Não mexa no workflow de CI nem na proteção das branches: isso é do operador.
- Não mexa fora do escopo do item. Achado fora do escopo vai como nota no PR, não vira mudança.

## O que vai para o operador
- O estado em palavras do produto: o que funciona, o que falta, o que quebrou, o PR. Sem narrar a coordenação entre threads.
- Não recapitule no fim o que acabou de dizer.
```

<a id="anexo-b"></a>
## Anexo B — Quando o projeto não tem a fila do kit: CI mínimo e merge pelo GitHub

Não se aplica ao projeto do piloto (lá a fila do kit faz o gate, e a branch de integração não roda CI). Fica para pilotar o Projects num repositório **sem** o kit, onde o CI no PR substitui o gate local. Segue a regra [CI só no PR para a produção](../../plugins/orquestracao/pool/protocolo.md#ci-so-na-producao): sem branch de integração, todo PR é de produção e o CI roda nele. Exige conta que tenha ruleset no repositório ([conferências](#antes)). Exemplo para Node; troque instalação e teste (o check se chama `ci`, o id do job, que é o nome a exigir na proteção).

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  # só com o merge queue ligado: o check roda de novo sobre a combinação montada pela fila
  merge_group:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
```

No `merge_group` não existe `pull_request.number`, e o `github.ref` é único por entrada da fila: o `cancel-in-progress` não cancela o check da fila.

**Com merge queue** (repositório de organização): o `merge_group` faz o GitHub rodar o check sobre a `main` + os PRs da fila, na ordem — o equivalente ao gate na combinação do kit, sem a bisseção (o GitHub tira o PR que quebra e refaz o grupo). Ruleset (*Settings > Rules > Rulesets*, alvo `main`), em JSON de API:

```json
{
  "name": "main protegida (piloto)",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "pull_request", "parameters": { "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false, "require_code_owner_review": false, "require_last_push_approval": false, "required_review_thread_resolution": false, "allowed_merge_methods": ["squash"] } },
    { "type": "required_status_checks", "parameters": { "strict_required_status_checks_policy": false, "required_status_checks": [{ "context": "ci" }] } },
    { "type": "merge_queue", "parameters": { "merge_method": "SQUASH", "grouping_strategy": "ALLGREEN", "max_entries_to_build": 2, "min_entries_to_merge": 1, "max_entries_to_merge": 2, "min_entries_to_merge_wait_minutes": 1, "check_response_timeout_minutes": 15 } },
    { "type": "non_fast_forward" },
    { "type": "deletion" }
  ]
}
```

Aplicar (operador): `gh api -X POST repos/<dono>/<repositório>/rulesets --input regra.json`. Com o merge queue, a instrução 8 do anexo A muda: a thread **não** rebaseia por merge alheio; o PR entra na fila do GitHub (*Merge when ready* no monitor de PR das sessões locais, ou o botão da fila no GitHub), que monta a combinação sozinha.

**Sem merge queue** (repositório de conta pessoal, com Pro): tirar a regra `merge_queue` e o gatilho `merge_group`, e pôr `strict_required_status_checks_policy: true` ("exigir a branch em dia"). O GitHub só deixa mergear o PR que já contém a `main` atual com o check verde: o segundo PR depois de um merge fica bloqueado até trazer a `main` e rodar o CI de novo. É uma fila manual — um merge por vez, com um CI a mais por PR atrasado.

<a id="decisoes"></a>
## Decisões assumidas (a confirmar)

- **Fila de merge mantida, rodada por uma thread de merge local:** sem ela, a branch de integração sem CI receberia merge sem gate; o coordenador roda na nuvem e não alcança a máquina.
- **Plugins `orquestracao` e `painel-sessoes` desligados nas pastas das threads:** o `sessao-inicio` e as regras do kit brigariam com o coordenador, e o que se perde (`segredo-sai`, `subagente-nao-edita`, aviso de laço) olha caminhos que as threads não usam ou só avisava.
- **Teto de 3 threads de trabalho:** com a thread de merge, dá 4, o teto de donas do kit.
- **Nenhum release durante o piloto**, salvo pedido do operador.
- **O coordenador não escreve código e não mergeia:** espelha a orquestradora; M8 mede se ele respeita.
