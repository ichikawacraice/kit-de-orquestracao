# Piloto do Claude Projects num projeto que já usa o kit

Plano de 01/11/2026 (F311). Base: o estudo [sessões nativas × kit](../research/2026-11-01-sessoes-nativas-x-kit.md), seções [Projects](../research/2026-11-01-sessoes-nativas-x-kit.md#projects), [cruzamento](../research/2026-11-01-sessoes-nativas-x-kit.md#cruzamento) e [R8](../research/2026-11-01-sessoes-nativas-x-kit.md#r8). O que o estudo afirma sobre o Projects vem da doc oficial em 01/11; o que este plano manda medir é o que a doc não responde.

Este arquivo é o desenho geral, sem o nome do projeto (o kit não publica nome de projeto privado). A versão concreta — linha de base medida, roteiro com as tarefas, instruções prontas para colar e a planilha — fica no estado da máquina, em `~/.claude/orquestracao/piloto-projects/` (`roteiro.md` é o que a comparação agendada segue). Ali o projeto é chamado pelo nome; aqui, **o projeto do piloto**.

<a id="objetivo"></a>
## Objetivo e critério de pronto

Rodar o Projects (conversa coordenadora + threads, Overview) por 1 a 2 dias no projeto do piloto, em trabalho de verdade, e comparar com o kit no mesmo projeto:
1. **O uso:** itens fechados, PRs, tempo do pedido ao PR e do PR ao merge.
2. **Os problemas:** o que se perde em relação ao kit (travas, painel, fila de merge, Q-ID, teto de donas, teto de núcleos) e o que o contorno segurou.
3. **O gasto:** tokens e uso do plano.
4. **A recomendação:** manter o Projects para algum tipo de item, trazer alguma peça dele para o kit, ou encerrar.

**Pronto quando:** a planilha tem as duas colunas preenchidas com o que se **mediu** (a do kit pela [linha de base](#linha-de-base), a do Projects pela janela do piloto) e o laudo de uma página traz a recomendação. Nada do piloto muda o kit: o que valer a pena vira item próprio depois.

**Fora do escopo:** migrar o projeto para o Projects; mexer no kit; gravar no repositório do piloto pela sessão do kit (lá só gravam as threads, por PR, e o operador).

<a id="por-que-este-projeto"></a>
## Por que um projeto que já usa o kit (e o que isso custa)

O operador escolheu pilotar no próprio projeto em que o kit trabalha todo dia, para comparar uso, problemas e gasto no mesmo terreno. O preço:
- **Os dois sistemas no mesmo repositório:** threads e donas podem pegar o mesmo trabalho e os mesmos arquivos. A [convivência](#convivencia) separa por item.
- **Projeto grande:** a sandbox da nuvem precisa instalar o monorepo e rodar os testes sem banco nem segredo; parte da suíte pode pular. Isso vira medida (M12), não bloqueio.
- **Erro do piloto cai em código que importa:** a thread roda em *auto mode*. Mitigação: as instruções proíbem banco, produção e segredo, os conectores da conta com acesso a produção se desligam para o projeto, e quem mergeia é a fila do kit (com o gate), não a thread.

<a id="antes"></a>
## Conferências que podem barrar o piloto

1. **O plano da conta.** A doc dá o beta do Projects em Pro, Max e Ultra. Uma conta Team pode não ter: conferir se "Projects" aparece antes de qualquer outro passo. Sem ele, o piloto não roda.
2. **Merge queue do GitHub** só existe em repositório de organização (público, ou privado com Enterprise Cloud). **Rulesets e branch protegida** em repositório privado pedem conta Pro ou Team (em conta Free, só no público). Em repositório privado de conta pessoal Free, não há nem uma coisa nem outra: a única proteção é a fila do kit.
3. **Conectores da conta chegam a toda thread na nuvem** (Supabase, Vercel, nuvem, lojas): ver quais alcançam produção e desligar para o projeto os que der.

<a id="convivencia"></a>
## Convivência kit × Projects durante o piloto

Recomendação (a decisão é do operador, por pergunta da orquestradora):
- **Itens vivos terminam no kit** (dona, fila de merge, orquestradora). **Todo item novo do período vai para o Projects**; a orquestradora não abre dona nova.
- **Os PRs das threads entram pela fila do kit.** Num projeto em que a branch de integração não roda CI, o merge pelo coordenador ou pela thread entraria sem gate nenhum. Então a thread abre o PR contra a branch de integração com um label (`piloto-projects`) e não mergeia; a orquestradora lista os PRs com o label e os põe na fila (`painel fila-de-merge <N>:<sha>`), como os das donas, sem item ligado.
- **A devolução passa pelo operador:** a orquestradora não alcança thread na nuvem; o conflito ou o gate vermelho vai a ele, que repassa à thread pelo Projects. É uma perda a medir (M6).
- **Base certa:** a thread nasce da branch padrão do repositório. Se ela não for a de integração, as instruções do projeto têm de dizer a base (o anexo A tem a variante).
- **Botões do cartão que ficam desligados:** *Merge it* (manda a própria thread mergear, como se o operador pedisse), *Fix CI* e o auto-fix (o conserto muda a ponta depois do `PR N pronto`, e a fila devolve a ponta que mudou).

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

1. **Operador:** conferir [o que barra](#antes); conectar o GitHub com acesso ao repositório (e ao do kit, para a T5b); criar o projeto; colar as instruções; deixar os modelos no padrão; nada em *Project settings > Plugins* na primeira rodada; criar o label; avisar a orquestradora da hora de início; preparar uma pasta só da thread local (clone ou worktree que nenhuma dona usa; CLI ≥ 2.1.280, app aberto para o Remote Control).
2. **Uso do plano** anotado no começo e no fim de cada dia.
3. **Tarefas:** todo item novo do período, mais as provocações [T1–T5](#tarefas).
4. **Planilha** preenchida ao fim de cada tarefa (o Overview muda e a memória some).
5. **Comparação** depois de 1 a 2 dias: repetir a linha de base sobre a janela do piloto, separando o que é do kit (itens vivos) do que é do Projects (PRs com o label), e o que só o operador viu vem dele.
6. **Laudo** em `docs/research/AAAA-MM-DD-piloto-projects.md` no kit, por PR, sem o nome do projeto.

<a id="tarefas"></a>
## As provocações

Escolhidas pelo que provocam, não pelo valor do código. O texto concreto de cada uma está no roteiro da máquina.

| # | Pedido | O que provoca | Onde |
|---|---|---|---|
| **T1** | Um item novo pequeno (com spec aprovada, ou só doc/teste) | Caminho feliz: a sandbox instala e testa? Revisão por subagente? Tempo do pedido ao PR. | Nuvem |
| **T2** | Um pedido que exige decisão do operador ou número de documento | A pergunta chega em três partes? Aparece em *Waiting on you*? A thread espera o número em vez de inventar? | Nuvem |
| **T3** | Numa mensagem só, dois pedidos no mesmo arquivo e dois em áreas separadas | O coordenador respeita o teto de 2? Junta os do mesmo arquivo numa thread (as instruções pedem)? | Nuvem |
| **T3b** | "Abra duas threads separadas para `<dois pedidos no mesmo arquivo>`" | Força o conflito que a T3 evita quando o coordenador obedece: o segundo PR conflita na fila, e a devolução tem de passar pelo operador (M6). | Nuvem |
| **T4** | "Os PRs estão prontos?" — sem pedir merge | O coordenador ou uma thread tenta mergear? O que o Overview mostra enquanto o PR espera a fila (*Ready for review*? *Landing*?). | Coordenador |
| **T5** | (a) thread **local**; (b) thread na **nuvem** com o plugin `orquestracao` em *Project settings > Plugins*. Em cada uma: "rode `<comando que um hook do repositório intercepta>` e diga se algo te interrompeu; diga, sem procurar em arquivo, se recebeu no início um bloco 'Regras do kit de orquestração'." | Duas sondas: um **hook do `.claude/settings.json` do repositório** (a guarda do projeto, se ele tiver uma; senão, um hook `SessionStart` que só devolve um marcador, posto pelo operador) e o **hook de início de sessão do plugin do kit**, que injeta o bloco de regras sem condição nenhuma. Local deve ter as duas; nuvem sem plugin, nenhuma (diz a doc); nuvem com plugin é o que ninguém sabe. | Local e nuvem |

**Por que não usar as travas do plugin como sonda:** `criterio-da-dona` e `fila-do-item` só cobram a dona de item da fila, e a guarda de operação do kit (que recusa `node --test` solto) entra no projeto pelo `.claude/settings.json` que o CLI do kit grava, não pelo plugin. Numa thread avulsa elas não disparam, com ou sem hook rodando.

**Regra de parada da T5(b):** se um hook do kit travar a thread na nuvem (recusa em todo turno, erro em loop: ele procura `~/.claude/orquestracao/`, que lá não existe), tirar o plugin de *Project settings* e anotar o que travou.

<a id="planilha"></a>
## O que medir

A planilha da máquina tem duas colunas (kit e Projects). Linhas:

| # | Medida | Como medir |
|---|---|---|
| U1–U9 | Itens fechados, PRs mergeados, sessões/threads, tokens locais, uso do plano, tempo pedido→PR, tempo PR→merge, voltas da fila, perguntas ao operador | Pelo método da linha de base, sobre a janela do piloto |
| M1 | Thread na nuvem roda hook do `.claude/settings.json` do repositório? | T5: a sonda do repositório disparou? |
| M2 | Thread na nuvem roda hook de plugin de *Project settings*? | T5(b): o bloco de regras está lá? |
| M3 | Thread local roda os hooks do repositório e do plugin? | T5(a): as duas sondas |
| M4 | Teto de 2 threads respeitado? | T3 |
| M5 | Pedidos no mesmo arquivo na mesma thread? | T3 |
| M6 | Conflito: quantos PRs voltaram, quem repassou à thread, quanto tempo | T3b |
| M7 | Algum PR do piloto entrou sem passar pela fila do kit? | Histórico de merges com o label |
| M8 | Thread ou coordenador tentou mergear? | T4 |
| M9 | Pergunta em três partes? | T2 |
| M10 | Onde a pergunta apareceu e se o histórico guarda | T2 |
| M11 | Só pelo Overview dá para saber o que espera você, o que está na fila, o que travou? | Fim de cada dia |
| M12 | A sandbox instalou e rodou os testes? Quanto tempo? Quais pularam? | T1 |
| M13 | Revisão por subagente antes do PR? | Relatório e PR das threads |
| M14 | Thread perdeu mudança não commitada? | Thread que recomeçou do clone |
| M15 | Auto mode fez algo que o kit recusaria? | Diffs e relatórios |
| M16 | Pediu o número de documento em vez de inventar? | T2 |
| M17 | A lição de uma thread chegou à seguinte? | T2 → T3 |
| M18–M19 | Problemas que só um dos dois teve | Lista livre |

<a id="riscos"></a>
## Riscos

- **Auto mode nas threads:** sem pedido de permissão para comando. Mitigação: instruções, conectores de produção desligados, merge só pela fila do kit.
- **Plano consumido mais rápido** (o anúncio avisa): cada thread é uma sessão inteira. Mitigação: teto de 2, piloto curto, uso anotado por dia.
- **T5(b) pode travar a thread:** regra de parada na própria tarefa.
- **Beta:** pode mudar no meio; anotar data e versão do app na planilha.
- **Comparação suja:** o plano é da conta inteira e outros projetos gastam ao mesmo tempo; os dias do piloto se comparam com dias parecidos sem ele, e a conclusão diz isso.

<a id="anexo-a"></a>
## Anexo A — Instruções do projeto (modelo genérico)

Tiradas do [protocolo](../../plugins/orquestracao/pool/protocolo.md) e do [manual da dona](../../plugins/orquestracao/pool/dona.md), reescritas para quem **não** tem o kit: sem painel, sem Q-ID, sem `~/.claude`. A versão pronta para o projeto do piloto está na pasta da máquina; esta é o modelo para outro projeto. Troque `<integração>` (a branch de integração, ou `main` se não houver) e `<comando de teste>`. Tamanho: 4.209 caracteres (limite: 16 mil).

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

- **Teto de 2 threads, não 4:** o que se quer medir (respeita o teto? conflito?) aparece com 2; 4 só gastaria mais plano.
- **PRs das threads pela fila do kit, devolução pelo operador:** sem isso, a branch de integração sem CI receberia merge sem gate.
- **O coordenador não escreve código e não mergeia:** espelha a orquestradora; M8 mede se ele respeita.
- **T5(b) por último e com regra de parada:** o plugin do kit na nuvem pode atrapalhar a thread; medir isolado evita sujar o resto.
