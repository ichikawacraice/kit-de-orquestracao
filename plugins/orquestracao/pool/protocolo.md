# Protocolo do trabalho em sessões

Todo trabalho do projeto é um **item** (`F<n>`) na fila do painel. Uma **sessão dona** leva cada item do plano ao PR; a **orquestradora** abre as donas, é a fila de merge e faz o release. Este arquivo diz o que cada sessão faz; como a máquina funciona por dentro (campos do item, fila de merge, batida, teto de núcleos) está na [referência](referencia.md), lida quando preciso. O manual de quem leva um item é [`dona.md`](dona.md); o de quem orquestra, a skill `orquestradora`. Decisões: [ADR 0011](../../../docs/adr/0011-uma-sessao-dona-do-item-do-plano-ao-pr.md) e [ADR 0012](../../../docs/adr/0012-o-kit-tem-um-modelo-so-a-dona.md).

<a id="modelo-da-dona"></a>
## O item e a dona
- **Um item, uma sessão dona, do plano ao PR.** A dona mede, decide, escreve código e doc, testa, revisa por subagente, abre o PR e conserta o que a fila de merge devolver. Sem sessões separadas por papel, sem handoff entre papéis.
- **Quem abre a dona é a orquestradora** ([a fila](#a-fila)), com `start_session` e o modelo pelo risco ([modelo e esforço](#modelo-e-esforco)). Título: `F<n> · <tema em palavras do produto>` (a trava `titulo-da-dona.mjs` recusa outro).
- **No Orca:** a coordenadora abre a dona com `orca orchestration worker-start` (a trava do `orca` recusa sem `--model`/`--effort` e na pasta de quem chama), e a dona se grava com o `orca_session_id:<id>` no lugar do `local_…`. Tabela completa: [anfitriao-orca.md](anfitriao-orca.md).
- **No primeiro turno a dona** grava a si mesma (`painel update fila F<n> '{"donoLocalId":"<seu local_…>","donoApelido":"dona"}'` e `painel com add`) e se desliga da orquestradora (`detach_session` com `"self"`; [ADR 0022](../../../docs/adr/0022-a-orquestradora-so-acorda-quando-precisa.md)). Troca a `etapa` (`planejamento` → `design`, só com tela → `execucao` → `validacao`) num `update` curto, sem o `agora`; a `merge` e o PR o `--anotar` grava.

<a id="painel-em-dia"></a>
## Quem mantém o painel em dia
- **A dona** grava o que só ela sabe: dono e `com` no primeiro turno, as perguntas, a entrega no PR que fecha o item e o handoff; não anota o `agora` a cada passo ([dona.md](dona.md#painel-em-dia)).
- **A orquestradora** grava ao criar o item, ao abrir a dona e ao mergear (`painel mergear` e `painel fila-de-merge` fecham o item; o devolvido volta a `execucao` com o motivo).
- **A batida** deduz a `etapa`, os `prs` e as sessões do item pelo GitHub e fecha o item pelo merge ([batida](#batida), [ADR 0027](../../../docs/adr/0027-o-estado-do-item-e-deduzido-e-fecha-pelo-merge.md)).
- **As travas:** `fila-do-item.mjs` recusa o fim do turno da dona que mudou algo (arquivo, commit, push, PR) com o item em `merge`, com PR e sem a `entrega` (salvo `maisFatias: true`); `painel-das-sessoes.mjs` recusa o turno que tirou ID de pergunta, ou recebeu resposta a uma pergunta aberta, sem gravar em `perguntas`; `criterio-da-dona.mjs`, no turno que editou em `execucao`, `validacao` ou `merge`, recusa o relatório que a saída real contradiz ou que afirma sucesso sem teste rodado, e avisa (sem turno extra) o que só não traz a saída colada.

<a id="skills-da-etapa"></a>
## Skills por etapa
Ao entrar numa etapa, a dona roda `node "${CLAUDE_PLUGIN_ROOT}/pool/skills-da-etapa.mjs" <etapa>` (lista tirada de `skills-por-etapa.json`) e carrega com `Skill` as **fixas** e as da lista que o trabalho pede; a que não está instalada fica de fora. Skill de fora que repete peça do kit (catálogo `skills-de-fora.json`, [ADR 0014](../../../docs/adr/0014-o-kit-decide-as-skills-de-fora-num-catalogo.md)) a trava `skills-de-fora` recusa, dizendo qual usar.

| Etapa | Fixas (carrega sempre) | Da lista, quando o trabalho pede |
|---|---|---|
| `planejamento` | `superpowers:writing-plans` | `superpowers:brainstorming` (cria algo novo), `processos:spec-driven` (ADR, spec, roadmap), `superpowers:systematic-debugging` (causa de defeito) |
| `design` | `design-system:revisao-de-arquitetura-de-ui` (subagente) | `frontend-design`, `impeccable:impeccable`, `agent-browser` (abrir a tela) |
| `execucao` | `superpowers:test-driven-development`, `superpowers:verification-before-completion` | `processos:auditoria-de-clique` (gesto que grava), `owasp-security`, `supabase`, `vercel-react-best-practices` |
| `validacao` | `processos:revisar-diff` (no briefing do `orquestracao:validador`) | `differential-review`, `security-audit`, `claude-security:claude-security` (segurança), `agent-browser` (artefato visual) |

<a id="modelo-e-esforco"></a>
## Modelo e esforço
- **Da sessão dona** ([ADR 0036](../../../docs/adr/0036-a-dona-planeja-em-opus-e-a-execucao-vai-ao-sonnet.md)): quem abre a dona passa `model` e `effort` explícitos, em sessão `fresh`. **Opus 5.5, esforço médio**; **alto** só por um [gatilho](../skills/papeis-e-modelos/SKILL.md#gatilhos-do-opus) nomeado no prompt (`Esforço alto: <gatilho> — <motivo>`; a antiga `Gatilho do Opus:` vale como sinônimo); na dúvida sobre um gatilho, alto. A trava `titulo-da-dona.mjs` recusa a dona sem `model` ou `effort`, por `fork`, fora do Opus, em esforço que não é médio nem alto, ou em alto sem gatilho. A dona planeja e escreve os documentos; o briefing que ela recebe traz só o pedido, as imagens e os fatos medidos.
- **Da execução:** o código e os testes do plano fechado vão ao subagente `orquestracao:executor` (Sonnet 5.5, médio), que grava só no repositório da dona, fora de `docs/` e de `.md`; a decisão que o plano não tomou volta à dona. Item pequeno a dona escreve.
- **No Orca** ([ADR 0030](../../../docs/adr/0030-o-kit-reconhece-o-anfitriao-e-no-orca-so-da-as-regras.md)): a trava é a do `orca` (`trava-do-orca.mjs`, no Bash). Todo worker Claude do `worker-start`, do `agent launch` e do `worktree create --agent` nasce com `--model` e `--effort` (a dona em `--model opus --effort medium`, `--effort high` com a linha `Esforço alto: <gatilho>` no texto do pedido; o worker que não é dona passa em Sonnet, Haiku ou Opus médio) e fora da pasta de quem chama (`--worktree new-child`), salvo com a linha `Só leitura: <motivo>` no texto do pedido.
- **Do validador:** a dona declara o risco uma vez, no planejamento (`painel update fila F<n> '{"risco":true}'` se grava estado, toca segurança, dinheiro ou produção, ou voltou da fila; senão `false`). O hook `modelo-do-validador.mjs` escolhe o modelo pelo risco e pelo diff e recusa o lançamento sem a declaração ([como decide](referencia.md#modelo-e-esforco)).
- **Dos outros subagentes:** `orquestracao:executor` em Sonnet, `orquestracao:explorador` em Haiku; nenhum acima do modelo da dona.

<a id="revisao"></a>
## Revisão por subagente
- **Item pequeno, dentro do corte, pode ir pela [via rápida da revisão](#via-rapida-da-revisao).** Fora do corte, sempre o validador separado.
- Antes do PR, a dona lança `orquestracao:validador` (só leitura, contexto limpo) com o plano, o diff (`git diff origin/<base>...HEAD`) e o que ela afirma ter feito, pedindo **só achados que afetam correção**: resultado errado, regra do projeto quebrada, teste que não mede, caso de borda que quebra ("skip style"). Ela espera o laudo no turno ([esperar no turno](#espera-no-turno)).
- Achado médio ou alto: a dona conserta e, em item de risco, lança um segundo validador sobre o delta. Achado leve vira nota no PR ou entra em `depois` do item, **nunca item novo**.

<a id="espera-no-turno"></a>
## Esperar dentro do turno, não terminando o turno
Fim de turno da dona que só diz "ainda roda, aguardo" faz a orquestradora reler o contexto inteiro para nada ([ADR 0021](../../../docs/adr/0021-o-validador-escolhe-o-modelo-pelo-diff-e-a-dona-espera-no-turno.md)).
- **Teste em primeiro plano**, no Bash com `timeout` até 600000 (10 min). O que passa disso vai em segundo plano gravando um marcador (`<comando> > log 2>&1; echo $? > <arquivo>`), e a dona espera com `esperar-fundo --arquivo <arquivo>`.
- **Subagente sempre em segundo plano.** Sem mais nada a fazer, a dona chama `esperar-fundo` (Bash, `timeout` 600000): volta quando os subagentes terminam, ou em 9 min (sai 3; chame de novo).
- **A trava:** o Stop hook `espera-no-turno.mjs` segura uma vez o fim de turno da dona de item vivo com subagente, ou shell de teste, tipo ou build, ainda rodando, dizendo como esperar. A segunda tentativa passa (espera de horas, limite de uso); o turno que termina perguntando ao operador passa direto.

<a id="menor-diff"></a>
## Escrever: o menor diff que resolve inteiro
Ideia do plugin [ponytail](https://github.com/dietrichgebert/ponytail) (MIT, Dietrich Gebert), reescrita para o kit.
- **Antes de escrever, liste o que a mudança alcança** (arquivos, quem chama, o teste que prova) e desça a escada até o primeiro degrau que resolve o pedido **inteiro**: (1) não escrever nada; (2) usar o que o repositório já tem; (3) a biblioteca padrão; (4) uma dependência já declarada; (5) a menor mudança nova. Dependência nova, abstração, opção de configuração e código "para depois" ficam fora, salvo pedido explícito.
- **A escada decide *o que* escrever, não *se* testa.** Comportamento que muda tem o teste antes do código. Validação de entrada, perda de dados, segurança e acessibilidade nunca saem para o diff ficar menor.
- **Menor não é pela metade:** chamador quebrado, caso conhecido de fora ou doc dizendo o contrário não é o menor que resolve. O que ficou de fora de propósito vai ao PR, com o motivo.

<a id="juntar-chamadas"></a>
## Juntar chamadas: cada ida e volta relê o contexto inteiro
- Cada chamada de ferramenta é um turno, e cada turno relê a conversa inteira do cache (~180 mil tokens por chamada; [orçamento de contexto](../skills/orquestradora/SKILL.md)).
- **Chamadas independentes vão juntas no mesmo turno:** `Read`, `grep` e `git` que não dependem um do outro, edições de arquivos diferentes.
- **Passos encadeados vão num script só** (`node - <<'EOF'` ou `sh -c`), com a saída cortada ao que decide o próximo passo.

<a id="via-rapida-da-revisao"></a>
## Via rápida da revisão: item pequeno se autorrevisa
No item pequeno o validador (piso de ~33 mil tokens) custa mais que o trabalho; a via rápida o troca por um roteiro fixo, **só dentro de um corte que se mede**.
- **O corte**, medido por `node "${CLAUDE_PLUGIN_ROOT}/pool/via-rapida.mjs" [--base origin/<base>]` (`cabe: true` ou os motivos de fora): até **60 linhas** mudadas em até **4 arquivos**, nenhum removido ou renomeado e nenhum de contrato ou de trava (ADR, spec, migration, SQL, `package.json`, `.claude/kit.json`, hooks, gate, CI, `CLAUDE.md`, o protocolo, agentes e skills de regra do kit; mais `viaRapida.fora` do `.claude/kit.json`).
- **O que o script não vê, a dona declara** no laudo, e qualquer "sim" tira o item da via rápida: grava estado, toca segurança, dinheiro ou produção, muda texto de regra, já voltou da fila, ou a dona foi aberta em Opus por risco.
- **O roteiro**, depois dos testes afetados verdes, com o diff relido do disco:
  1. cada arquivo do diff contra o plano: o que falta e o que sobra;
  2. **quem chama** cada função ou export mudado, fora do diff (`grep` pelo nome): continua certo?;
  3. o caso de borda que o teste não pega (vazio, ausente, repetido); o teste afirma que o valor existe antes de comparar;
  4. o teste falha sem o conserto (rode-o sobre a base, ou diga por que não dá);
  5. regra do projeto (`CLAUDE.md`) que o diff toca.
- **O laudo no PR:** seção `## Autorrevisão (via rápida)` com a saída do `via-rapida.mjs`, as declarações e uma linha por passo do roteiro. Conserto que tira o diff do corte devolve o item ao validador separado.
- Item que muda regra de revisão (inclusive esta seção) passa pelo validador separado. A fila de merge e o gate valem igual nas duas vias.

<a id="custo-do-item"></a>
## Custo por item
Ao fechar o item, `painel mergear` grava em `custo` o gasto das sessões que trabalharam nele, lido dos transcripts; `relativo` serve para comparar item com item, não é fatura ([campos e pesos](referencia.md#custo-do-item)).

<a id="testes-afetados"></a>
## Testes: os afetados no trabalho, o gate uma vez na fila
- Enquanto trabalha, a dona roda **só os testes do que tocou**: `testes-afetados -- <comando de teste do projeto>` (neste kit, o do `CLAUDE.md`). Ele devolve **todos** quando o efeito pode ser indireto ([o que o seletor pega](referencia.md#testes-afetados)).
- O **gate completo** (`npm test`, ou o do `CLAUDE.md`) roda **uma vez, na fila de merge**, sobre a combinação. A dona não o roda antes do PR, salvo quando o diff mexe na própria infraestrutura de teste.

<a id="fila-de-merge"></a>
## A fila de merge da orquestradora
- **A dona entrega anotando o PR** com o sha que testou: `painel fila-de-merge N:<sha completo> --anotar` (não roda gate nem mergeia; ele mesmo grava a etapa `merge` e o PR), grava a `entrega` quando o PR fecha o item e para, sem trazer a base por merge alheio. Se o `--anotar` recusar, manda `PR N pronto, HEAD <sha completo>` à orquestradora.
- **A fila** combina os PRs sobre a base por squash, roda o gate **uma vez**, mergeia o que passou e devolve o que conflitou ou ficou vermelho, achando por bisseção o PR que quebra ([por dentro](referencia.md#fila-de-merge)).
- <a id="fila-sem-turno"></a>**Sem turno da orquestradora:** o `--anotar` da dona lança a fila na hora quando nenhum gate do projeto roda, a [batida](#batida) lança a que ficou parada e entrega o desfecho à dona; à orquestradora vai só o que é dela ([fila sem turno](referencia.md#fila-sem-turno)). <a id="aviso-de-fatia"></a>Fatia mergeada (`maisFatias: true`) devolve o item à dona com o aviso `fatia PR N mergeada (F<n>): siga com a próxima.`
- **Conflito devolvido:** a dona traz a base pelo `sync_with_base_branch` do app ou, sem ele, rebaseia sobre `origin/<base>` ([dona](dona.md), passo 7); o merge commit do app fica só na branch dela, porque a fila mergeia por squash.
  No Orca: a dona faz `git merge origin/main` na própria branch (o merge commit fica só nela; a fila mergeia por squash); não há `sync_with_base_branch`.
- <a id="falha-de-infra"></a>**Falha de infraestrutura** (saída que casa com um padrão, de fábrica `container is not ready`) roda de novo uma vez antes de culpar um PR ([padrões](referencia.md#falha-de-infra)).
- **Sinais de entrega:** o PR anotado é o caminho principal; `PR N pronto, HEAD <sha>` é o de reserva; o aviso de fim de turno do app não é sinal de entrega, porque a dona desligada (`detach_session`) não o gera e o que chegar abre na orquestradora um turno sem leitura. PR pronto e não anotado a batida cobra da dona.
- <a id="corte-do-item"></a>**Corte do item:** o que prevê mais de ~1 dia de dona nasce em fatias, cada uma com o próprio PR (`maisFatias: true` até a última; [dona](dona.md) passo 7b); fatia pequena fecha mais cedo e custa menos.
- **Depois do lote** a versão dos plugins sobe num commit só, **no máximo uma vez por dia de São Paulo** (no primeiro lote depois das 00:00; à mão, `subir-versao --empurrar` força; o lote que não sobe não mexe nos plugins, que se atualizam no lote em que a versão sobe); na rodada sem turno, o pós-merge é da própria rodada (`subir-versao --empurrar --destacado --por-dia`; [ADR 0023](../../../docs/adr/0023-o-pos-merge-roda-sem-turno-da-orquestradora.md)); `KIT_POS_MERGE=off` devolve o pós-merge à orquestradora. A dona do PR que fecha o item liga `auto_archive_on_close` ([dona](dona.md) passo 6).

<a id="ci-so-na-producao"></a>
## CI só no PR para a produção
Abaixo, `main` é a branch de produção e `develop` a de integração (os nomes reais estão no `CLAUDE.md` do projeto).
- **O CI dispara só no `pull_request` contra a produção:** no GitHub, `on: pull_request: branches: [main]`; sem `pull_request:` sem filtro e sem `push:` na integração; `concurrency` com `cancel-in-progress`.
- **Sem `push:` de validação na produção só quando ela é protegida:** só PR com o check verde, mergeado por squash. Sem essa proteção, ou com merge commit, o `push: main` continua validando. O deploy pode disparar no `push: main`: ele sobe, não valida.
- **O PR para a integração não roda CI:** a dona roda os testes afetados (e o typecheck, se há) e **cola no corpo do PR o comando e o fim da saída, com o `exit=0`**; o gate completo roda na fila de merge.
- **Por quê:** o gate da fila mede a combinação real dos PRs; CI em todo PR é espera e minuto pagos para repetir isso, e na produção ele é o último portão antes do deploy ([a conta](referencia.md#ci-so-na-producao)).
- **Sem branch de integração**, todo PR é de produção e o CI, se houver, dispara nele. O kit não exige CI. Workflow que contraria a regra é ajustado por item próprio, com o operador sabendo.

<a id="teto-de-donas"></a>
## Quantas donas ao mesmo tempo
- **Não há teto de donas trabalhando** ([ADR 0033](../../../docs/adr/0033-sem-teto-de-donas-simultaneas.md)). O limite de concorrência é o dos **testes**: o [teto de núcleos](#teto-de-nucleos), que faz o teste esperar a ficha. A orquestradora pode manter dona em espera ou parada sem contá-la contra nada; `KIT_TETO_DE_DONAS`, se alguém a definiu, é ignorada sem erro.
- **Despacho por evento:** a orquestradora abre a dona quando o item nasce e quando uma dona termina (o recado `PR N pronto` e o item devolvido são os eventos).

<a id="sem-dona"></a>
## Item sem dona
- Item numa etapa de trabalho **sem dona e sem ninguém no `com`**, sem `espera` nem `trava`, está *sem dona* desde que entrou na etapa (`painel list fila sem-dona`).
- **A cobrança:** o ritual da orquestradora (`orquestradora-ritual.mjs`) recusa o fim do turno com item sem dona há `ESPERA_MIN` (padrão 5) minutos, sem `start_session` no turno; gravar o dono ou mandar mensagem que o cite também satisfaz. Com o modo ausente ligado não se cobra. O pane tem o botão "Pedir dona" ([a regra e o pedido](referencia.md#sem-dona)).

<a id="a-espera"></a>
## A espera do item
- **Quando gravar:** item parado de propósito, sem trabalho a fazer agora. `painel update fila F<n> '{"espera":{"motivo":"…","texto":"…"}}'`; `null` desfaz quando a espera acaba. O `texto` é obrigatório e aparece na aba, em palavras de quem está de fora.
- **`motivo: "item"`:** espera **outro item ou PR** (ex.: `{"motivo":"item","texto":"aguarda o F462 mergear"}`). A aba mostra *Esperando* com o texto, abaixo de quem trabalha, e não conta no trilho: não há nada a decidir. Não use `dependeDe` para isso: ele ordena o merge de dona que segue trabalhando.
- **`motivo: "operador"`:** espera decisão ou gesto da pessoa (a aba mostra *Espera você*). **`motivo: "gate"`:** espera o gate da fila de merge.
- **Nenhum dos três é cobrado pela batida** (nem a cutucada, nem a retomada, nem o `--anotar`); `trava` também não. Ao voltar a trabalhar, a dona limpa a espera.

<a id="a-fila"></a>
## A fila
- **Criar:** `proximo-item` e `painel set fila F<n> '{…}'` com `titulo` (sem `F<n>`), `etapa` e `tema` ([campos e recusas](referencia.md#a-fila)).
- **`com`** (quem trabalha agora) só muda por `painel com add|del`. **`espera`** (`{motivo, texto}`, [os três motivos](#a-espera)) é o item parado num gesto de fora; **`trava`**, o que quebrou ou bloqueia. **`painel soltar <F<n>> "<motivo>"`** é o único caminho de volta à fila sem dona.
- **O handoff do item** é o estado que sobrevive a uma limpeza de contexto:
<!-- regra-do-handoff-do-item: início (texto idêntico em handoff-de-sessao/SKILL.md e pool/protocolo.md; um teste compara) -->
- **Um arquivo por item, reescrito a cada vez.** O handoff do item é `~/.claude/orquestracao/pool/handoffs/F<n>.md`. Quem o grava (a dona antes de limpar o contexto, ou quem solta o item) **reescreve o arquivo inteiro** com o estado de agora, no molde da skill `handoff-de-sessao`: nunca acrescenta uma passagem nova ao fim. "Decidido" e "Tentado e falhou" levam tudo o que ainda vale, das vezes anteriores também, uma linha por item; o que deixou de valer sai. Plano, laudo e briefing do item podem morar em `F<n>-<slug>.md` ao lado.
- **Item fechado vai para o arquivo.** Quando o item vai a `feito` ou `descartado`, o `painel` move sozinho todo arquivo `F<n>.md` e `F<n>-*` (e `F<n><letra>-*`) para `handoffs/arquivo/`; item reaberto volta com os arquivos. `painel handoffs arquivar` faz o mesmo para os itens já fechados que ficaram para trás.
- **O arquivo se limpa.** Arquivo de item fechado há mais de **30 dias** (pelo `feitoEm` do item; sem item na fila, pela data do arquivo) é apagado do `arquivo/`. Roda sozinho a cada item que fecha, e à mão com `painel handoffs limpar [--dias N] [--seco]` (`--seco` só lista).
<!-- regra-do-handoff-do-item: fim -->
- **Achar o próprio `local_…`:** `get_session` com `"self"` (campo `sessionId`).
- **No Orca:** não há `get_session`; o id é o `orca_session_id:<ORCA_AGENT_SESSION_ID>` (`quemSou()` do `anfitriao.mjs`; o preâmbulo do worker também o traz).

<a id="batida"></a>
## A batida
Cada sessão cuida do próprio item e a orquestradora só lê. O mecânico roda sozinho, no mod `painel-sessoes`: a cada `BATIDA_MIN` min (10 por padrão; `BATIDA=off` desliga) uma das sessões vivas roda `painel batida` e leva as mensagens que ele devolve. Sem modelo e sem turno ([por dentro](referencia.md#batida)).
- **Item parado:** sem `espera` nem `trava`, sem gravar há `PAINEL_PRAZO_MIN` (30) min e ninguém da dona e do `com` trabalhando: uma cutucada à dona; se ninguém gravar em `BATIDA_SOLTA_MIN` (20) min, `painel soltar`. Dona e `com` todos arquivados ou fora da lista: solta direto.
- <a id="limite-de-uso"></a>**Dona no limite de uso:** antes da hora da volta o item não é cutucado nem solto; passada ela, com a dona parada, a batida manda uma vez *"O limite de uso voltou …: retome pelo handoff"* ([como lê](referencia.md#limite-de-uso)).
- **Item sem dona** há 5 min ou mais vira vaga de dona no relatório à orquestradora, menos o que tem cartão de sessão dona esperando o clique (proposto há menos de 12 h).
- **PR pronto fora da fila:** a batida cobra da dona viva; `merge` parado sem dona viva e fila parada vão ao relatório `batida/<projeto>.json`, com mensagem só quando algo mudou.
- **Fila sem turno:** lança a fila de merge anotada e entrega o desfecho ([fila sem turno](#fila-sem-turno)).
- **Não faz:** abrir, arquivar ou limpar sessão, nem mergear por conta própria. O hook do ritual da orquestradora avisa quando o relatório tem `em` de mais de 30 min.

<a id="perguntas-proprias"></a>
## Perguntas da própria sessão, depois de uma limpeza
A limpeza apaga a lembrança, não as perguntas: elas ficam no painel com `sessaoId` = você. No início da conversa nova, o hook `sessao-inicio.mjs` lista as abertas e as respondidas nas últimas 24 h que são suas; sem a lista, rode `painel list perguntas aberta --sessao <seu local_…>`. Mensagem que começa com `Q<n> — pergunta aberta POR ESTA SESSÃO` (ou que traz uma lista numerada delas: no Orca, as respostas que saem a poucos segundos uma da outra chegam juntas) é sua: retome pelo `caso` e pelo `handoff` do item, sem devolver à orquestradora. Resposta já atendida (o handoff diz) não se refaz. No Orca, o `sessaoId` é o seu `orca_session_id:…`: dele o painel grava o endereço de entrega (`endereco.orca`), o único lugar aonde a aba do kit manda a resposta ([tabela do Orca](anfitriao-orca.md#tabela)).

<a id="via-rapida"></a>
## Tela: revisão de design e via rápida
- **Item com tela** passa pela etapa `design`: a dona lança o subagente `design-system:revisao-de-arquitetura-de-ui`, grava a revisão (na pasta de revisões do projeto) e, depois do código, lança o `design-system:critico-de-ui`. Nota de 24/30 para cima, sem ressalva alta, libera; no máximo 2 recríticas.
- **Via rápida:** o item que reaproveita componente ou padrão que o produto já tem **e** não muda decisão registrada (ADR, spec ou revisão aprovada) pula a etapa `design` e tem uma crítica só, depois do código. A dona escreve o motivo no plano. Nota abaixo de 24/30, ou descobrir que o item muda decisão, o devolve ao caminho normal.
- **Escopo trancado (vale para todo item):** achado da crítica ou da revisão fora do escopo do plano vai para `depois` do item e nunca entra no PR.

<a id="teto-de-nucleos"></a>
## Teto de núcleos da máquina
- **O teto soma tudo:** todo teste de todas as sessões e projetos da máquina divide um teto de núcleos, uma **ficha** por núcleo em `~/.claude/orquestracao/nucleos-de-teste/` (`KIT_NUCLEOS_DIR` troca a pasta, para os testes). O teto é 2/3 dos núcleos por padrão (`KIT_NUCLEOS_DE_TESTE` absoluto, `KIT_FRACAO_DE_TESTE`); o gate usa a faixa de 70% dele (`KIT_FRACAO_DO_GATE`), e **um gate por vez na máquina** (a vez em `<pasta>/gate`) ([faixas e configuração](referencia.md#teto-de-nucleos)).
- **Três caminhos para rodar teste, e só eles:** `npm test` (o gate), `npm test <pacote>` (o gate pela fila do conserto) e `node scripts/kit/com-fichas.mjs -- <comando>` (teste isolado: toma as fichas, troca `{fichas}` nos argumentos e passa `KIT_FICHAS_TOMADAS` ao filho). A guarda **recusa** (`deny`, também em bypass) `vitest`, `node --test` e `jest` chamados direto fora do CI.
- **Máquina cheia:** o teste espera a ficha ([ADR 0005](../../../docs/adr/0005-os-testes-da-maquina-dividem-um-teto-de-nucleos.md)); a máquina cheia não baixa mais o número de donas ([quantas donas](#teto-de-donas)). No modo ausente nada afrouxa, e ninguém pergunta nada ao operador sobre o teto.

<a id="analise-do-pedido"></a>
## O pedido é ponto de partida, não ordem
Quem pede (o operador, a orquestradora no briefing, outra sessão) descreve um problema, uma hipótese e a solução que imagina; nada disso é verdade nem premissa por padrão. Antes de agir, a sessão confere o pedido contra o código, o banco, os docs e o estado real, diz onde ele está errado e propõe o melhor formato, inclusive um diferente do pedido.
- **Proporcional ao risco.** Pedido trivial e claro (corrigir um texto, rodar um comando, renomear) executa direto; se algo estiver errado, uma linha diz o quê. Pedido que muda desenho, contrato, estado gravado, segurança, produção ou dinheiro, ou que sai caro refazer, ganha a análise completa antes da primeira edição. Na dúvida, a completa.
- **A análise completa é curta e tem quatro partes,** no plano do item ou no começo da resposta:
  1. **Premissa conferida:** o que o pedido afirma e o que a medição mostrou (arquivo:linha, saída de comando); o que não deu para conferir, dito como tal.
  2. **O que está errado ou arriscado:** no pedido, na hipótese e na solução proposta (caso de borda, custo, o que quebra junto, regra do projeto contrariada).
  3. **Contraproposta:** o formato melhor quando há um, inclusive outro lugar, outra ferramenta, menos escopo ou não fazer.
  4. **Recomendação:** o que a sessão vai fazer e por quê.
- **Sem achado, não invente.** Conferiu e o pedido está certo: meia linha diz o que foi conferido, e a sessão segue. Discordar por discordar é ruído, e concordar sem conferir é obediência cega; as duas falham a regra.
- **Discordar não é travar.** Contraproposta reversível e barata de refazer: a sessão segue com ela, diz na primeira linha que fez diferente do pedido e por quê, e marca *assumida, a confirmar* ([nunca travar](#nunca-travar)). Irreversível, destrutiva, que publica para fora, que toca produção ou que gasta job: só essa etapa espera, como pergunta com Q-ID no formato de três partes (o caso, o que acontece sem decidir, a recomendação).
- **Discorda uma vez; a decisão é de quem pediu.** Se o operador ouviu a discordância e mantém o pedido, a sessão faz o que ele pediu e registra a ressalva no item ou no PR, salvo se for inseguro ou quebrar regra do projeto. A discussão não reabre a cada turno.
- **Vale para o briefing também.** A dona confere a premissa do briefing da orquestradora, e o subagente a do briefing da dona, do mesmo jeito; "conferido pela orquestradora" é ponto de partida, não medição.
- **Por que não há trava:** nenhum hook mede se a análise foi boa, e um hook por mensagem custaria tokens em toda mensagem. A regra mora no texto que toda sessão lê (o resumo injetado no início, este protocolo, o `CLAUDE.md` do projeto), e o `orquestracao:validador` confere no PR a premissa em que o diff se apoia.

<a id="nunca-travar"></a>
## Nunca travar
- Decisão reversível, de baixo risco ou com recomendação forte: **assuma** e siga, marcando *assumida, a confirmar* no item e no PR, **e gravando a decisão como pergunta `estado:"assumida"`** (`painel perguntas nova '{"estado":"assumida","titulo":…,"caso":…,"recomendacao":"o que se assumiu"}'`, que imprime o Q-ID; vira `respondida` quando o operador confirma ou muda), e cite o Q-ID junto da decisão; se o operador discordar depois, ajuste. <a id="pergunta-nasce-no-painel"></a>**A pergunta nasce no painel:** `painel perguntas nova` valida, reserva o Q-ID, grava, relê e só então imprime o ID (`sessaoId` padrão: a sessão que chama; `estado` `aberta` ou `assumida`; `titulo`, `caso`, `recomendacao` e, na aberta, `seNaoDecidir`); a recusa sai com exit 1 e não gasta número. A mensagem que cita o Q-ID diz onde o operador o acha: a `aberta` na seção Perguntas do painel, a `assumida` em Decisões (a confirmar); anunciar assumida como "pergunta em aberto" o manda procurar no lugar errado. O estado de pergunta é só `aberta · assumida · respondida · cancelada`: o painel recusa outro, que a tela não mostraria (sem `estado` é rascunho e segue aceito). A trava de fim de turno (`painel-das-sessoes.mjs`) recusa uma vez por turno a mensagem que marca *assumida, a confirmar* ou "Q-ID não reservado" sem essa pergunta no painel, o Q-ID que o `proxima-pergunta` reservou no turno sem arquivo no painel (o efeito, não o comando: o `painel set` recusado ou escondido por `| tail` não conta), e o Q-ID recente citado sem arquivo na mensagem final ou no texto de `orca orchestration ask|send`; as cobranças de Q-ID valem também para a orquestradora. Pergunta de verdade (irreversível, destrutiva, produção, gasto de job, publicar para fora) leva Q-ID, vai ao painel e só a etapa que depende dela espera.
- **Modo ausente** (`/ausente on` até `/ausente off`, ou o botão do painel): o turno em que o operador não escreveu não abre sessão, só propõe o cartão (`initiation: "own_initiative"`); a trava `travas-da-sessao.mjs` (T3) recusa o resto. O item sem dona espera na fila.

<a id="arquivar"></a>
## Quem arquiva
- A dona não se arquiva nem se limpa ao fechar o item: **a orquestradora arquiva a sessão dona cujo item fechou**, pelas condições da skill `orquestradora` ("Arquivar sessão que terminou"); com o modo ausente ligado, nada se arquiva fora do turno do operador. Sessão avulsa ela lista para o operador, que manda.

<a id="regras-do-repositorio"></a>
## Regras do repositório
As do `CLAUDE.md` do projeto em que o item roda (leia-o antes de começar). Ex.: só os testes afetados, sempre pelo gate ou pelo `com-fichas` ([teto de núcleos](#teto-de-nucleos)); o gate completo é da fila de merge; migration só da branch de integração; rebase em vez de merge commit (exceção: o `sync_with_base_branch` do app na devolução por conflito); commit em PT-BR; número de ADR/SPEC pedido à orquestradora. Cada item cria a própria branch a partir da integração (`git switch -c <slug> origin/<integração>`) com a árvore limpa. O PR não sobe a versão do plugin.

<a id="mais-de-um-projeto"></a>
## Mais de um projeto
O projeto é o repositório (worktrees do mesmo repositório são o mesmo projeto); fila e sessões ganham `projeto`, e a orquestradora de um projeto abre dona só para item dele (`list fila --projeto <nome>`; [como se acha](referencia.md#mais-de-um-projeto)). O modo ausente é global: o operador é um só.

<a id="operador"></a>
## O que vai para o operador
- A mensagem final de cada turno, a `etapa` do painel e o relatório da orquestradora dizem **o estado do trabalho em palavras do produto**: o que já funciona, o que falta, o que está quebrado, PR aberto. Ex.: *"Histórico das etapas do editor: código pronto, testes passando, falta a revisão."*
- **Não narrar a coordenação** entre sessões; ela fica nas mensagens entre sessões e no arquivo do item.
- Sem `F<n>` ou Q-ID solto no texto ao operador sem dizer em palavras o que é.
- **Item citado: `F13 · <título>` na primeira menção**, com o título de `painel get fila F13`, que pode ser encurtado sem trocar o sentido; as menções seguintes da mesma mensagem podem ser só `F13`. Vale para mensagem de fim de turno, relatório, pergunta, `agora`, `depois[].texto`, `trava`/`espera` e `sessoes.etapa`; mensagem entre sessões fica livre. O `painel` recusa a pergunta que cita `F<n>` solto em `titulo`, `caso`, `seNaoDecidir` e `recomendacao`. Exemplo aceito: `a dona do F13 · SPEC-155 fatia 2 está parada`. <!-- exemplo-item-citado: a dona do F13 · SPEC-155 fatia 2 está parada -->
