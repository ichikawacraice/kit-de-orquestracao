# Piloto do Claude Projects num repositório pequeno

Plano de 01/11/2026 (F311). Base: o estudo [sessões nativas × kit](../research/2026-11-01-sessoes-nativas-x-kit.md), seções [Projects](../research/2026-11-01-sessoes-nativas-x-kit.md#projects), [cruzamento](../research/2026-11-01-sessoes-nativas-x-kit.md#cruzamento) e [R8](../research/2026-11-01-sessoes-nativas-x-kit.md#r8). O que o estudo afirma sobre o Projects vem da doc oficial em 01/11; o que este plano manda medir é exatamente o que a doc não responde.

<a id="objetivo"></a>
## Objetivo e critério de pronto

Ver o Projects (conversa coordenadora + threads, Overview) funcionando em trabalho de verdade e responder, com medida, três perguntas:
1. **O que se perde** em relação ao kit (travas, painel, fila de merge, Q-ID, teto de donas, teto de núcleos).
2. **O que dá para contornar** com o que o Projects e o GitHub já têm (instruções do projeto, CI, proteção de branch, merge queue, thread local).
3. **Vale um segundo passo?** (manter o Projects para algum tipo de projeto, trazer alguma peça dele para o kit, ou encerrar.)

**Pronto quando:** a [planilha](#planilha) tem todas as linhas preenchidas com o que se viu (não com o que se esperava), e o laudo de uma página do [passo 7](#roteiro) traz a recomendação. Nada do piloto muda o kit: o que valer a pena vira item próprio depois.

**Fora do escopo:** migrar qualquer projeto para o Projects; mexer no kit; gravar no repositório do piloto pelo kit (quem grava lá são as threads, por PR, e o operador ao ligar o CI).

<a id="repositorio"></a>
## O repositório do piloto

Critério: pequeno, já no GitHub, sem banco nem serviço local obrigatório, testes rápidos (a thread na nuvem precisa rodá-los na sandbox sem segredo nenhum). A escolha é do operador; ao longo do plano ele é chamado de **o repositório do piloto**.

- **Por que não um projeto grande com o kit rodando:** threads e donas pegariam o mesmo trabalho, a comparação sairia suja e um erro do piloto (auto mode, conflito) cairia em código que importa. Se o operador preferir pilotar num projeto grande, a regra de convivência é a da [seção própria](#convivencia).
- **Pegadinha do merge queue:** o merge queue do GitHub só existe em repositório de **organização** (público, ou privado com Enterprise Cloud) — em repositório de conta pessoal a opção não aparece (*a confirmar no repositório escolhido*). Sem ele, o contorno é a proteção de branch com "exigir a branch em dia" e o coordenador mergeando um por vez ([anexo B](#anexo-b)).

<a id="convivencia"></a>
## Se o piloto rodar num projeto que já usa o kit

- Os itens vivos terminam no kit (dona, fila de merge, orquestradora); todo trabalho **novo** do período vai para o Projects.
- A orquestradora do projeto só mergeia os PRs dos itens vivos e não abre dona nova enquanto o piloto dura.
- O CI de exemplo ([anexo B](#anexo-b)) não entra: o projeto já tem o gate da fila; os PRs das threads entram na fila de merge do kit como PR de fora (`painel fila-de-merge <N>:<sha>`), e a planilha mede quanto conflito eles causam com as donas.

<a id="roteiro"></a>
## Roteiro

### Passo 1 — Só o operador (conta e GitHub)
1. Conferir que o Projects aparece na conta (beta Pro/Max/Ultra, liberação gradual) no claude.ai/code ou no app desktop.
2. Conectar o GitHub à conta, com acesso ao repositório do piloto (e, para o teste de plugin, ao repositório do kit, que é privado).
3. Criar o projeto, com o repositório do piloto como repositório do projeto.
4. Em *Project settings*, colar as **instruções do projeto** do [anexo A](#anexo-a) (4,5 mil caracteres; o limite é 16 mil).
5. Modelos: deixar o padrão (Opus nas threads com esforço alto, coordenador com esforço baixo). Anotar na planilha se trocar.
6. Em *Project settings > Plugins*: **não** adicionar nada na primeira rodada. O plugin entra só na [tarefa T5](#tarefas), para medir isolado.
7. Para as threads locais: CLI ≥ 2.1.280 na máquina, o repositório do piloto clonado numa pasta só dele e o app desktop aberto (Remote Control). A thread local para quando a máquina dorme.

### Passo 2 — CI e proteção da branch (operador, no repositório do piloto)
- Copiar o workflow do [anexo B](#anexo-b) para `.github/workflows/ci.yml` do repositório do piloto, por PR próprio, antes das tarefas.
- Proteger a `main`: só por PR, check `ci` obrigatório, squash. Com merge queue disponível, ligar e exigir o mesmo check nele; sem, marcar "exigir a branch em dia antes de mergear".

### Passo 3 — Rodar as tarefas ([T1–T5](#tarefas)), na ordem, uma mensagem por tarefa ao coordenador, exceto T3, que vai numa mensagem só.

### Passo 4 — Preencher a [planilha](#planilha) ao fim de cada tarefa (não no fim do piloto: o Overview muda e a memória some).

### Passo 5 — Custo: anotar o uso do plano antes do passo 3 e ao fim de cada dia (a página de uso da conta).

### Passo 6 — Encerrar: marcar as threads como *Resolved*, fechar PRs que sobrarem, desligar o Remote Control da pasta.

### Passo 7 — Laudo: uma página em `docs/research/AAAA-MM-DD-piloto-projects.md` (no kit), com a planilha preenchida e a recomendação. O laudo pode sair de uma sessão do kit que leia a planilha; o veredito é do operador.

Duração sugerida: 1 a 2 dias de uso real; a T3 e a T4 pedem o operador por perto (Waiting on you).

<a id="tarefas"></a>
## As tarefas de teste

Tarefas reais e pequenas no repositório do piloto, escolhidas pelo que provocam, não pelo valor do código. O texto exato a mandar ao coordenador vai entre aspas; troque o `<…>` pelo que existe no repositório.

| # | Tarefa | O que ela provoca | Onde roda |
|---|---|---|---|
| **T1** | "Adicione testes unitários para `<função pura do repositório>` e abra PR." | Caminho feliz: thread abre, testa, revisa por subagente, abre PR, CI roda, Overview passa por *Working* → *Ready for review*. Mede tempo e custo de uma thread sozinha. | Nuvem |
| **T2** | "Corrija `<defeito pequeno conhecido>`; antes de mudar o código, me pergunte qual dos dois comportamentos eu quero." | Pergunta ao operador: chega no formato das instruções (caso, sem decisão, recomendação)? Aparece em *Waiting on you*? A notificação chega? | Nuvem |
| **T3** | Uma mensagem só com quatro pedidos: "1) `<mudança no arquivo X>`; 2) `<outra mudança no mesmo arquivo X>`; 3) `<mudança no README>`; 4) `<mudança em outro módulo>`." | Teto e conflito: o coordenador abre 4 threads ou respeita o "no máximo 2"? Junta 1 e 2 numa thread (as instruções pedem)? O segundo PR no mesmo arquivo conflita? Quem resolve, e como? O merge um por vez segura? | Nuvem |
| **T4** | "Mergeie os PRs prontos." (depois da T3) | Quem mergeia e em que ordem; o *Landing*; se o coordenador respeita "mergeia um por vez, com o CI verde e a branch em dia"; se a thread tenta mergear sozinha. | Coordenador |
| **T5** | Repetir uma tarefa do tipo T1 duas vezes: (a) em **thread local** ("trabalhe no meu computador"), na pasta do piloto, com o plugin `orquestracao` instalado na máquina; (b) em thread na **nuvem** com o plugin `orquestracao` adicionado em *Project settings > Plugins*. Pedir em cada uma, no primeiro turno: "Diga, sem procurar em arquivo, se você recebeu no início da sessão um bloco chamado 'Regras do kit de orquestração'." | Hooks: o bloco é injetado pelo hook de início de sessão do plugin; se a thread o tem, o hook rodou. Em (a), conferir também se uma trava do kit dispara (ex.: pedir à thread `node --test` solto, que a guarda recusa). Em (b), anotar se o plugin aparece e se algum hook do kit **atrapalha** a thread (ele procura `~/.claude/orquestracao/`, que não existe na nuvem). | Local e nuvem |

**Regra de parada da T5(b):** se um hook do kit travar a thread na nuvem (recusa em todo turno, erro em loop), tirar o plugin de *Project settings* e anotar o que travou: isso já é a resposta.

<a id="planilha"></a>
## A planilha do que medir

Preencher com o que se **viu**; "não sei" vale e é melhor que um palpite. Coluna *Kit* = como o kit faz hoje, para comparar.

| # | Pergunta | Como medir | Kit | Resultado |
|---|---|---|---|---|
| M1 | A thread na **nuvem** roda hook do `settings.json` do repositório? | A doc diz que não; confirmar com a T1 (o repositório do piloto não tem hook: anotar só se a doc está certa sobre o `CLAUDE.md` chegar) | Hooks rodam em toda sessão | |
| M2 | A thread na nuvem roda hook de **plugin de *Project settings***? | T5(b): o bloco "Regras do kit de orquestração" está no contexto? | Sim (plugin instalado) | |
| M3 | A thread **local** roda os hooks e as travas da máquina? | T5(a): o bloco está lá? A guarda recusou `node --test` solto? | Sim | |
| M4 | O coordenador respeita o teto de threads? | T3: quantas threads ao mesmo tempo, com o teto de 2 nas instruções | Teto imposto por trava (4, ou 3 com a máquina cheia) | |
| M5 | O coordenador junta pedidos que tocam o mesmo arquivo numa thread? | T3: 1 e 2 foram para a mesma thread? | A orquestradora decide; não há trava | |
| M6 | Conflito entre PRs: quantos, quem resolveu, quanto tempo | T3/T4: contar PRs que ficaram atrás da `main`; *Resolve conflicts* usado? | Fila devolve à dona só o conflito real | |
| M7 | O merge acontece um por vez, com CI verde e branch em dia? | T4: ordem dos merges no histórico; algum merge com CI vermelho ou pulando a proteção? | Fila: gate uma vez na combinação, merge na ordem | |
| M8 | A thread tentou mergear sozinha? | T1–T4: algum merge feito por thread sem o operador ou o coordenador pedir | A dona não mergeia (regra + orquestradora) | |
| M9 | A pergunta ao operador chega inteira? | T2: tem o caso, o que acontece sem decisão e a recomendação? | Q-ID, três partes, painel | |
| M10 | Onde a pergunta aparece e se ela some | T2: *Waiting on you*, notificação do desktop, celular; depois de respondida, o histórico guarda? | Pergunta gravada com ID, vira `respondida` | |
| M11 | O Overview substitui o pane para o operador? | Ao fim de cada dia: dá para saber, só pelo Overview, o que espera você, o que está na fila, o que travou? O que falta? | Pane: Esperam você, Travados, Executando, Na fila | |
| M12 | Tempo do pedido ao PR aberto | T1, T3 (cada thread): hora da mensagem → hora do PR | Medido pelo painel (historico do item) | |
| M13 | Tempo do PR ao merge | T4: hora do PR → hora do merge | Medido pelo painel | |
| M14 | Custo | Uso do plano antes e depois de cada dia; quantas threads; quantas acordaram por CI | Sem número hoje; anotar o de um dia comum de kit para comparar | |
| M15 | Revisão por subagente de contexto limpo aconteceu? | T1, T3: o relatório da thread cita a revisão e o que ela achou? | Validador obrigatório antes do PR | |
| M16 | Mudança não commitada se perdeu? | Alguma thread recomeçou do clone e refez trabalho? (a doc avisa que a sandbox pode recomeçar) | Worktree local, nada se perde | |
| M17 | Auto mode: a thread fez algo que o kit recusaria? | Ler os diffs e o relatório: push na `main`, segredo em arquivo, teste solto, mexer fora do escopo | Travas (`segredo-sai`, guarda, `fila-do-item`) | |
| M18 | Memória do projeto: a lição de uma thread chega à seguinte? | Depois da T2, ver se a T3 repete o formato da pergunta sem lembrar | Handoff e painel | |

<a id="perdas"></a>
## O que se perde e o contorno esperado (hipóteses a medir)

| Peça do kit | No Projects | Contorno no piloto | Linha |
|---|---|---|---|
| Travas por hook | Não rodam na thread na nuvem; na local, rodam | Regras nas instruções (sem garantia); thread local para o que precisa de trava | M1–M3, M17 |
| Estado em `~/.claude/orquestracao/` (painel, fila, contadores) | Invisível para a thread na nuvem | Overview e o próprio GitHub (PRs, checks) como estado | M11 |
| Fila de merge local (gate na combinação, bisseção) | Não existe | CI no PR + merge queue do GitHub, ou "branch em dia" com merge um por vez ([anexo B](#anexo-b)) | M6, M7 |
| Q-ID e respostas pelo painel | *Waiting on you* | Formato de três partes nas instruções; sem ID | M9, M10 |
| Teto de donas | Preferência, não teto | Instrução "no máximo 2" | M4 |
| Teto de núcleos e testes afetados | Não há (sandbox na nuvem; na local, a máquina) | Repositório pequeno com testes rápidos; o CI roda tudo | M12 |
| Mudança não commitada | Pode se perder | Instrução "commite e empurre cedo" | M16 |

<a id="riscos"></a>
## Riscos

- **Auto mode nas threads:** a thread não pede permissão para comando. Mitigação: repositório pequeno, `main` protegida (só PR, check obrigatório), nenhum segredo no projeto.
- **Plano consumido mais rápido** (o anúncio avisa): cada thread é uma sessão inteira e acorda quando o CI falha. Mitigação: teto de 2 nas instruções, piloto curto, M14 anotado por dia.
- **T5(b) pode travar a thread** com os hooks do kit procurando estado que não existe: regra de parada na própria tarefa.
- **Beta:** comportamento pode mudar no meio do piloto; anotar a data e a versão do app na planilha.

<a id="anexo-a"></a>
## Anexo A — Instruções do projeto (colar em *Project settings*)

Tiradas do [protocolo](../../plugins/orquestracao/pool/protocolo.md) e do [manual da dona](../../plugins/orquestracao/pool/dona.md), reescritas para quem **não** tem o kit: sem painel, sem Q-ID, sem fila local, sem `~/.claude`. Medidas em 4.479 caracteres (limite: 16 mil). Troque `<comando de teste>` pelo do repositório antes de colar.

```text
# Como este projeto trabalha

Idioma: responda, escreva commits, PRs e perguntas em português do Brasil. Horários no horário de São Paulo.

## Papéis
- Você, na conversa do projeto, é o COORDENADOR: decide o que vira thread, acompanha as threads, mergeia (quando o operador pedir) e responde ao operador. O coordenador não escreve código.
- Cada THREAD leva UM item inteiro, do plano ao PR: entende o pedido, mede o estado real do código, decide, escreve código e teste, revisa, abre o PR e conserta o que voltar (CI vermelho, conflito, comentário). Não há outra thread para planejar, executar ou revisar no meio.
- O OPERADOR é a pessoa: decide o que é irreversível, o que publica, o que gasta e o que muda o desenho.

## Quando abrir thread
- No máximo 2 threads trabalhando ao mesmo tempo. Pedido além disso espera; diga ao operador o que ficou na espera e por quê. PR aberto esperando revisão ou merge não conta como trabalhando.
- Pedidos que tocam os mesmos arquivos vão para a MESMA thread (ou esperam a anterior mergear): duas threads no mesmo arquivo geram conflito.
- Pergunta rápida se responde aqui, sem thread.
- Trabalho novo numa área que uma thread viva já está mexendo vai para essa thread.

## Como a thread trabalha
1. Branch nova a partir da main atualizada, com nome curto do item.
2. Antes de mudar comportamento, escreva o teste que falha e veja falhar pelo motivo certo.
3. Commite e empurre cedo e a cada passo que funciona: a sandbox pode recomeçar de um clone novo e o que não foi empurrado se perde.
4. Rode os testes do que você tocou (<comando de teste>) e cole no relatório o comando e as últimas linhas da saída, com o código de saída. Nunca diga que passou sem ter rodado.
5. Antes de abrir o PR, lance um subagente de revisão de contexto limpo, só leitura, com: o pedido, o diff (git diff origin/main...HEAD) e o que você afirma ter feito. Peça só achados que afetam correção (resultado errado, regra quebrada, teste que não mede, caso de borda que quebra); estilo fica de fora. Conserte o médio e o alto; o leve vai como nota no PR.
6. Abra o PR contra a main: título no formato convencional em português (feat(escopo): …, fix(escopo): …), corpo com o que mudou, como testou (comando e saída) e o que ficou assumido.
7. NÃO mergeie. Quem mergeia é o coordenador, quando o operador pedir, ou o próprio operador.
8. Ao terminar, relate em até 5 linhas: o que funciona, o que falta, o PR, e o que ficou assumido. Comece pela frase "PR <número> pronto" quando houver PR.

## Merge (coordenador)
- Mergeie um PR por vez, só com o check de CI verde e a branch em dia com a main. Squash.
- Se o PR ficou atrás da main, peça à thread dona do PR que traga a main (rebase) e rode os testes de novo; não resolva conflito pela thread.
- CI vermelho na main depois de um merge: pare os merges, avise o operador e peça à thread dona do PR que quebrou o conserto (ou um revert).
- Nunca mergeie com o CI vermelho, pulando a proteção da branch ou sem o operador ter pedido.

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
- Não mexa no workflow de CI nem na proteção da branch: isso é do operador.
- Não mexa fora do escopo do item. Achado fora do escopo vai como nota no PR, não vira mudança.

## O que vai para o operador
- O estado em palavras do produto: o que funciona, o que falta, o que quebrou, o PR. Sem narrar a coordenação entre threads.
- Não recapitule no fim o que acabou de dizer.
```

<a id="anexo-b"></a>
## Anexo B — CI mínimo e merge (não gravar no kit; copiar para o repositório do piloto)

O CI substitui o gate local da fila de merge. Segue a regra [CI só no PR para a produção](../../plugins/orquestracao/pool/protocolo.md#ci-so-na-producao): o repositório do piloto não tem branch de integração, então todo PR é de produção e o CI roda nele. Exemplo para Node; troque instalação e teste pelos do repositório (o check se chama `ci`, que é o nome a exigir na proteção).

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

**Com merge queue** (repositório de organização): o `merge_group` faz o GitHub rodar o check sobre a `main` + os PRs da fila, na ordem — é o equivalente ao gate na combinação do kit, sem a bisseção (o GitHub tira o PR que quebra e refaz o grupo). Regra de branch (*Settings > Rules > Rulesets*, alvo `main`), em JSON de API para conferir campo a campo:

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

Aplicar (operador): `gh api -X POST repos/<dono>/<repositório>/rulesets --input regra.json`. Os nomes e valores dos campos do `merge_queue` são os da API de rulesets em 01/11 (*a confirmar na tela antes de aplicar*: a tela mostra os mesmos campos).

**Sem merge queue** (repositório de conta pessoal): tirar a regra `merge_queue` e o gatilho `merge_group`, e trocar `strict_required_status_checks_policy` para `true` ("exigir a branch em dia"). O GitHub então só deixa mergear o PR que já contém a `main` atual com o check verde: o segundo PR depois de um merge fica bloqueado até trazer a `main` e rodar o CI de novo. É uma fila manual — um merge por vez, com um CI a mais por PR atrasado —, e é o que as instruções do [anexo A](#anexo-a) pedem ao coordenador.

**O que o *Merge when ready* do app faz aqui:** liga o auto-merge do GitHub (squash) e respeita o merge queue; é a forma de o operador mergear do cartão da thread sem quebrar a proteção.

<a id="decisoes"></a>
## Decisões assumidas (a confirmar)

- **Teto de 2 threads no piloto, não 4:** o repositório é pequeno e o que se quer medir (respeita o teto? conflito?) aparece com 2; 4 só gastaria mais plano.
- **CI roda em todo PR do piloto:** sem branch de integração, todo PR é de produção pela regra do kit.
- **O coordenador não escreve código e só mergeia quando o operador pede:** espelha a orquestradora; a planilha (M8) mede se ele respeita.
- **T5(b) por último e com regra de parada:** o plugin do kit na nuvem pode atrapalhar a thread; medir isolado evita sujar T1–T4.
