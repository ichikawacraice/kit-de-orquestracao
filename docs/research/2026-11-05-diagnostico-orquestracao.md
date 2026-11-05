# Diagnóstico da orquestração de sessões e proposta de redesenho

Data: 2026-11-05 (SP). Snapshot: não se edita; para medir de novo, rode os comandos da seção [Como foi medido](#como-foi-medido) com outra janela.
Autora: sessão avulsa aberta pela orquestradora do kit. Proposta, não decisão: vira regra só pelo ADR que sair dela.

<a id="resposta-curta"></a>
## Resposta curta

- **O custo não está na orquestradora: está nas donas, e está no Opus.** Nos 7 dias de 29/10 a 05/11, nos três projetos, as sessões principais leram 9,0 bi de tokens e os subagentes mais 2,4 bi. As donas ficaram com **84%** das sessões principais, a orquestradora com **15%** (e caiu para **11%** do gasto depois do F373). **99% das chamadas das donas foram em Opus**, embora a regra diga "Sonnet para o mecânico". O validador tem o modelo escolhido por hook desde 04/11 (ADR 0021) e saiu em Opus em 120 de 134 rodadas nesses dois dias, por desenho: quase todo item toca hook ou protocolo.
- **98% dos tokens são releitura de cache.** O custo é *número de chamadas × tamanho do contexto*. As alavancas são três: menos chamadas (travas que forçam turno extra), contexto menor (donas longas, piso de ~95 mil) e modelo mais barato onde o risco permite.
- **As travas de Stop geram ~1.300 turnos extras por semana** (estimativa de 0,5–0,8 bi de tokens, 6–9% das sessões principais). Uma só, a do `criterio-da-dona` ("relatório sem a saída real"), responde por **566**.
- **A fila de merge não é o gargalo de entrega.** Do PR aberto ao merge: mediana de **4 min** no kit, **11 min** no Izanagi, **1 min** no WiControl. O tempo está dentro da dona, antes do PR.
- **O painel sai do compasso porque o estado é declarado, não derivado.** Doze passos do ciclo de um item dependem de o modelo lembrar de gravar; cada esquecimento vira um status falso, e cada trava que cobra o esquecimento vira um turno caro.
- **O kit consome o que tenta economizar.** O próprio repositório do kit gastou ~1,2 bi de tokens na semana (~10% do total), teve 144 commits (53 só de subir versão) e tem ~13 mil linhas de código de orquestração com ~28 mil de testes.
- **Recomendação: manter a orquestradora, mas fina; tornar o painel uma projeção derivada; tirar as travas que cobram bookkeeping; rotear modelo de verdade.** Não adotar ORCA nem Claude Flow como plataforma; copiar três ideias do ORCA e duas do artigo de ferramentas da Anthropic. Plano em quatro fases em [Plano](#plano).

<a id="como-foi-medido"></a>
## Como foi medido

- **Transcripts:** script avulso sobre `~/.claude/projects/**/*.jsonl` dos três projetos (inclui worktrees), janela 29/10 00:00 a 05/11 (SP). Por sessão: chamadas de assistente únicas por `message.id`, soma de `input`, `cache_read`, `cache_creation` e `output`; papel pelo `custom-title` (`🎛 orquestradora` → orquestradora; `F<n> ·` → dona). Subagentes lidos de `<sessão>/subagents/*.jsonl`. Turno extra de trava = mensagem do usuário que começa com `Stop hook feedback`.
- **Custo em dólar:** `node scripts/custo-fixo.mjs --desde 2026-11-04` (e o relatório do inventário, com `--desde 2026-11-02`).
- **Piso:** `node scripts/piso-da-sessao.mjs --desde 2026-11-04`.
- **Entrega:** `gh pr list --state merged --search "merged:>=2026-10-29"` em cada repo, `createdAt → mergedAt`.
- **Estado vivo:** leitura de `~/.claude/orquestracao/` (painel, batida, logs), só leitura.
- **Fontes externas:** PDF do Claude Flow (Analytics Vidhya), o Model Routing Playbook (Notion, lido pelo DOM; seções colapsadas não abertas), `anthropic.com/research/advanced-tool-use`, `onorca.dev/docs`.

<a id="custo"></a>
## 1. Onde vão os tokens

### Sessões principais, 7 dias

```
grupo                    sessões  chamadas  tokens   cache_read  stop-fb  tok/chamada
izanagi/dona                 192    29.124  6.345 M    6.238 M    1.100     218 mil
izanagi/orquestradora         21     4.304    977 M      963 M       22     227 mil
kit/dona                      40     3.921    635 M      622 M       76     162 mil
kit/orquestradora              9     1.759    350 M      343 M        8     199 mil
wicontrol/dona                26     3.030    576 M      566 M       92     190 mil
wicontrol/orquestradora        2       374     52 M       50 M        3     138 mil
(outras)                       8       403     54 M       53 M        5
TOTAL                                        8.990 M
```

### Subagentes, 7 dias

```
izanagi opus   17.714 chamadas  1.806 M | sonnet 266  22 M | haiku 200  13 M
wicontrol opus  3.850 chamadas    427 M | sonnet  60   2 M
kit opus        2.181 chamadas    153 M | sonnet 218  15 M | haiku  55   5 M
```

### Modelo nas sessões principais

```
dona          opus 35.684 chamadas | sonnet 340
orquestradora opus  6.412 chamadas
```

### Gasto por categoria desde 04/11 (`custo-fixo.mjs`)

```
total: 23699 chamadas, US$ 1542.12
validador: 134 rodadas, US$ 221.65 (14.4% do total), US$ 1.65 por rodada
  opus: 120 rodadas, US$ 1.79 por rodada
  sonnet: 14 rodadas, US$ 0.48 por rodada
orquestradora: 12 sessões, US$ 171.89 (11.1% do total), contexto médio 160 mil por chamada
  turnos de humano: 169 (45.8%), US$ 117.73 (68.5% da orquestradora)
  turnos de evento: 108 (29.3%), US$ 20.04 (11.7% da orquestradora)
  turnos de tarefa: 76 (20.6%), US$ 19.57 (11.4% da orquestradora)
  turnos de batida: 10 (2.7%), US$ 11.92 (6.9% da orquestradora)
```

### Leitura

- **A dona é 3/4 do gasto.** O F373 e o F404 atacaram a orquestradora, que já está em 11%; o resto do ganho está na dona e no validador.
- **Na dona, o roteamento por risco existe no papel e não na prática.** No validador ele existe por hook (`modelo-do-validador.mjs`, ADR 0021, desde 04/11) e escolhe Opus quase sempre de propósito. A rodada Sonnet do validador custa US$ 0,48 e a Opus US$ 1,79, mas a diferença vem mais do tamanho das rodadas do que do preço: na tabela do `custo-fixo.mjs` a leitura de cache tem o mesmo preço nos dois modelos, e ela é 98% dos tokens. Sonnet nas donas com plano escrito economizaria na ordem de 10–20% (estimativa, não medida); a fase 0 mede antes de decidir.
- **O contexto médio por chamada caiu de ~250 mil para ~140 mil em 04–05/11** nos três projetos (por dia, donas do Izanagi: 263 → 142 mil). O piso mediano está em 95,3 mil, dos quais o kit alcança pouco (o resto é o app: ferramentas nativas 16,1 mil, system prompt 13,7 mil, Artifact 13,5 mil, skills 11,1 mil, navegador 8,0 mil).
- **As donas mais caras** passam de 150 M tokens cada, com 600 a 1.650 chamadas e 17 a 27 horas de vida (F359, F364, F358 no Izanagi; F293 no WiControl com contexto de até 567 mil). Item grande vira sessão longa, e sessão longa relê muito.
- **A orquestradora deixou de acordar pelos turnos das donas:** avisos "a sessão que você abriu terminou" caíram de 24–36/dia para 1–3/dia no kit depois do `detach` (ADR 0022). Hoje 68% do custo dela é o operador conversando com ela — o uso que se quer.

<a id="travas"></a>
## 2. Hooks e travas que geram custo

Turnos forçados por Stop hook (deduplicados por sessão), 7 dias:

```
566  "Relatório sem a saída real do comando de critério"  (criterio-da-dona)   izanagi 475, kit 50, wicontrol 41
183  "O visual do front mudou e o crítico não rodou"       (design-system)      izanagi 173, wicontrol 10
 88  "Painel das sessões não atualizado neste turno"      (painel-das-sessoes)
~120 "Você é dona do item F<n>… mudou algo neste turno"   (fila-do-item)
~80  "Contexto em 3xx mil…"                               (contexto-do-papel)
~269 outros, motivo não separado (espera-no-turno: 92 nos logs; orquestradora-ritual e demais)
total 1.306
```

- Cada turno extra relê o contexto inteiro da dona (média ~200 mil) duas ou três vezes; estimado 0,5–0,8 bi de tokens na semana (6–9% das sessões principais). A estimativa é teto: parte das cobranças pega defeito de verdade.
- **O `criterio-da-dona` confere o relatório contra a saída real** (falha escondida, status ou resumo que não batem com a última saída), e só em turno que editou algo. O que ele pega é defeito real, mas a primeira cobrança resolve ~89% dos casos (contagem bruta 5.424 "1 de 2" × 611 "2 de 2", com repetições de contexto): a maior parte é esquecimento de colar a saída, não teste escondido. O ajuste é separar os dois casos, não tirar a trava.
- **O `fila-do-item` e o `painel-das-sessoes` cobram bookkeeping:** existem porque o estado é declarado. Se o estado fosse derivado, os dois sumiriam.
- **O `contexto-do-papel` está certo no diagnóstico e errado no remédio:** a dona longa é cara, mas cobrar a cada turno acima de 350 mil gera turno extra; melhor é cortar o item antes.
- O `laco-de-comandos` roda em toda chamada de ferramenta (PostToolUse sem matcher) e nunca bloqueia: custo de latência, não de token.
- O custo de injeção fixa do kit é baixo: SessionStart ~0,9 mil tokens; o hook do kit é 1,3 mil de um piso de 95 mil.

<a id="estado"></a>
## 3. O painel e o estado

Retrato de 05/11, cerca de 14:17 (SP), feito só lendo `~/.claude/orquestracao/`, que abrevio `~/o/`, e `gh pr list`. Os números mudaram durante a coleta: as perguntas passaram de 88 para 89 e os itens de 254 para 257.

**Conclusão:** o painel não mente sobre o que já foi entregue, mas defasa no que está andando. Toda defasagem medida é de um campo que alguma sessão precisava gravar e não gravou.

| # | Incoerência | Medida | Origem |
|---|---|---|---|
| 1 | Item que diz esperar o operador sem pergunta aberta | 4 dos 9 itens vivos no retrato das 14:17 (F359, F366, F364 e F303; ao fim da coleta eram 12 vivos, com F415–F417 novos) | `~/o/painel/fila` × `painel/perguntas` |
| 2 | Pergunta aberta cujo item já está feito | 8 (Q761, Q910, Q923–925, Q936, Q986 e Q987) | idem |
| 3 | Pergunta "assumida" aberta há mais de 72 h | 47, quase todas do WiControl (Q702–Q759, de 31/10 a 01/11) | `painel/perguntas` |
| 4 | Registro de sessão não concluído com o PR já mergeado | 11 (wicontrol 4, luna 5, izanagi 2) | `painel/sessoes` × `gh pr list --state merged` |
| 5 | Cartão defasado | 1: a proposta do F408, que já está em validação | `painel/cartoes` |
| 6 | Item que diz estar na fila de merge, mas não está | F411 diz "PR 1688 na fila"; `fila-de-merge/izanagi.json` está vazio | `fila-de-merge/` |
| 7 | Item vivo sem sessão visível | F303, F364 (`donoLocalId` indefinido) e F366 | `painel/fila` × `batida/sessoes.json` |
| 8 | Q-ID citado em `.md` e ausente do painel | Q981, em `WiControl.md` | `painel/` |
| 9 | Falha de entrega "sem sinal em 20 s" | 9, das quais 8 em 05/11 | `batida/falhas.jsonl` |
| 10 | Item com o campo `custo` preenchido | 53 de 257 | `painel/fila` |

**O que está coerente**
- O `contador-de-perguntas` (1014) é igual ao maior Q-ID.
- Todo Q-ID citado em item ou sessão existe, contando o `perguntas/arquivo/`.
- Não há sessão ativa de item fechado com PR mergeado. As 11 da linha 4 já estão arquivadas no app; o defasado é só o registro do painel.

**O que não dá para medir**
- `orquestradora-ritual` e `painel-das-sessoes` só gravam log quando dão erro, e os arquivos `ritual-hook.log` e `painel-hook.log` não existem. Os bloqueios dessas duas travas só aparecem pelos transcripts (seção 2).
- A batida não registra se um acordar foi útil ou nulo. Hoje não há como saber quanto dela é desperdício.

**Os logs das travas confirmam a seção 2** (`fila-hook.log` e `hooks-crewai.log`, de 29/10 14:16 SP em diante):
- `criterio-da-dona`: 508 primeiras cobranças e 42 segundas. Em 478 casos a dona corrigiu depois da cobrança; a trava ainda adiou 834 vezes esperando tarefa de fundo.
- `contexto-do-papel`: 214 cobranças, 612 avisos de contexto alto e 137 limpezas.
- `fila-do-item`: 113 bloqueios em 87 sessões.
- `espera-no-turno`: 92 bloqueios.
- 44 sessões tiveram 3 ou mais bloqueios encadeados em até 3 minutos.

**Fila de merge** (`*.desfechos.log`, desde 04/11 04:14 SP)
- 27 PRs mergeados.
- 9 devolvidos à dona: 5 por conflito, 3 por gate vermelho e 1 porque a ponta mudou.
- Da etapa "merge" até "feito", a mediana é de 14 min no Izanagi e 7 min no kit e no WiControl. A média do Izanagi (313 min) vem de releases segurados.

**Volume**
- 257 itens, dos quais 245 feitos.
- 951 perguntas, 863 delas no arquivo.
- 46 arquivos de ausência (552 KB).
- 140 KB de arquivo morto, girado em 03/11.

<a id="entrega"></a>
## 4. Entrega e lacunas

```
repo                  PRs mergeados 7d   PR→merge p50   p75    p90
kit-de-orquestracao          52              4 min      10 min  30 min
Izanagi                     343             11 min      24 min  53 min
WiControl                    58              1 min       4 min  10 min
```

- A fila sem turno e o pós-merge sem turno (ADR 0019, 0023) funcionam: o PR pronto vira merge em minutos.
- **O tempo de entrega está antes do PR.** As donas mais caras vivem de 17 a 27 horas. "Deploy mais rápido" é item menor e dona mais curta, não fila mais rápida.
- **No kit, 53 dos 144 commits da semana (37%) são `chore(versao)`.** Um commit de versão por lote é ruído no histórico e dispara atualização de plugin nas sessões.

**Passos que dependem do modelo lembrar** (do inventário do código): `agora`, `etapa`, `prs`; `com add` e `detach_session self` no 1º turno (sem rede); `risco`; `entrega`; `--anotar`; `auto_archive_on_close`; pergunta `assumida` e Q-ID no painel; handoff antes de limpar; saída do critério. Os automáticos: gate, merge, fechar item, versão, rotação, arquivar pergunta, cutucar, retomar. **Cada passo manual é uma lacuna possível; o sistema hoje fecha as lacunas com travas, que custam turno.**

<a id="complexidade"></a>
## 5. O peso do próprio kit

- Código de orquestração: hooks 3.478 linhas (24 arquivos), scripts da orquestradora 4.251 (`painel.mjs` 1.904), mod `painel-sessoes` 5.101 (`register.tsx` 166 KB). Testes: ~28 mil linhas, ~1.500 casos.
- Leitura obrigatória: `skills/orquestradora/SKILL.md` ~13,7 mil tokens; `pool/protocolo.md` ~13,4 mil; `papeis-e-modelos` ~5,1 mil; `dona.md` ~2,9 mil. Uma dona que lê `protocolo.md`, `papeis-e-modelos` e `dona.md` paga ~21,5 mil tokens a cada início e a cada limpeza, e relê isso em toda chamada até limpar.
- 24 ADRs em 6 semanas; o projeto do kit gastou ~1,2 bi de tokens na semana. Parte grande do esforço vai a consertar o próprio sistema (F373, F404, F393…) — cada regra nova pede trava nova, e cada trava, regra de exceção.

<a id="fontes"></a>
## 6. Fontes externas

| Fonte | Substituiria | Melhoria a adicionar | Não serve |
|---|---|---|---|
| **Claude Flow** (PDF, Analytics Vidhya, "beginner", mar/2026; produto hoje "ruflo") | Nada. Swarm "queen/worker" sem fila de merge nem verificação. | Nada novo: estado em SQLite nós já temos em arquivo. | Marketing sem número verificável; admite que mais agentes = mais custo. Já analisado em `2026-10-25-ruflo*.md`. |
| **Model Routing Playbook** (Notion) | Nada; valida o desenho. | Fixar **esforço** junto com o modelo; cascata "escala uma vez"; medir **custo por item resolvido** e p90; nunca trocar de modelo no meio da sessão (perde o cache); linha de base em tarefas reais. | Roteadores automáticos de API (LiteLLM, OpenRouter); números de GPT. |
| **Advanced tool use** (Anthropic, nov/2025) | Parte do piso de ferramentas: o app já difere ferramentas (`ToolSearch`). | Ideia do *programmatic tool calling*: scripts que agregam o estado e devolvem só o resumo ao modelo (o `painel.mjs batida` já é isso; estender para o relatório da orquestradora). | `betas`, `allowed_callers`, `input_examples` são da API: o app não expõe. |
| **ORCA IDE** (onorca.dev) | Em parte, a visão do operador e os worktrees — mas é **outro app**, concorrente do desktop. Perderíamos o mod, as ferramentas `ccd_*` (sessões, PR, auto-fix), Artifacts. | Três ideias: **estado derivado de eventos** (colunas "Precisa de você / Trabalhando / Concluído / Ocioso" vindas de hook, não declaradas); **conclusão presa ao despacho** (`taskId` + `dispatchId`); **`precheck` barato** antes de acordar uma sessão. | Adotar inteiro: sem fila de merge, sem gate combinado, sem perguntas ao operador; orquestração experimental. |

<a id="perguntas"></a>
## 7. As perguntas do operador

**Manter a orquestradora?** Sim, fina. Ela custa 11% e 68% disso é o operador conversando — é a interface dele, e é Opus por bom motivo (abrir dona com briefing bom é decisão). O ajuste: tirar dela todo bookkeeping que sobrou (já quase todo em script), encolher a skill de ~14 mil para ~4 mil tokens, limpar a cada assunto fechado, e ela não ler painel cru: lê um resumo pronto do script.

**Hook, processo ou skill atrapalhando?** Sim: `criterio-da-dona` (566 turnos/semana), `fila-do-item` e `painel-das-sessoes` (cobram bookkeeping que deveria ser derivado), `contexto-do-papel` como cobrança por turno, a crítica de UI obrigatória a cada mudança visual (183 turnos, do design-system), o `protocolo.md` de 13 mil tokens lido por toda dona, e o commit de versão por lote.

**O painel pelo mod é o melhor formato?** O lugar é bom (ao lado do chat, sem custo de modelo para desenhar); o problema é a **fonte** do que ele mostra. Artifact não serve como painel vivo (publicar custa turno de modelo e não lê `~/.claude`); HTML local não tem ação; sem painel o operador perde a fila de perguntas. Recomendo manter o mod, mas como **projeção derivada** de git, `gh`, `list_sessions` e dos arquivos de pergunta — e mostrar menos: só "precisa de você", "trabalhando", "pronto para merge", "parado".

**Entrega tudo sem esquecer?** Não com garantia: doze passos dependem de memória do modelo. Ver [Estado](#estado) para o que está desalinhado agora. O conserto não é mais trava, é menos passo manual.

<a id="alternativas"></a>
## 8. Alternativas

| Alternativa | Prós | Contras | Veredito |
|---|---|---|---|
| **A. Manter como está** | Funciona; F373/F404 já cortaram a orquestradora. | Donas em Opus, travas de ritual, estado declarado que desalinha, kit pesado. | Não. |
| **B. Ajustar com corte** (recomendada) | Mantém o que funciona (dona única, fila e pós-merge sem turno, mod); ataca as três alavancas medidas; reversível por fase. | Exige disciplina para **apagar** código e regra, não só acrescentar. | **Sim.** |
| **C. Sem orquestradora** (operador abre donas por cartão; fila e pós-merge já são script) | Zera os 11%. | Operador vira o despachante; perde o relatório consolidado e o briefing bom; mais cartões esperando clique. | Não agora; possível depois da fase 2 se o uso dela cair. |
| **D. ORCA + nossas skills** | Visão por agente pronta, multi-provedor, automações com `precheck`. | Troca o app; perde mod, `ccd_*`, Artifacts, auto-fix de PR; sem fila de merge; orquestração experimental. | Não como plataforma; copiar ideias. |
| **E. Claude Flow / ruflo** | Swarm pronto. | Modelo oposto ao nosso (paralelo sem verificação), mais custo, sem evidência. | Não. |
| **F. Sem painel** | Menos código (5 mil linhas). | Perguntas ao operador ficam espalhadas no chat; sem visão de parado. | Não; encolher em vez de tirar. |
| **G. Refazer do zero** | Desenho limpo. | Joga fora a fila sem turno, o pós-merge e o teto de núcleos, que funcionam e foram medidos. | Não; cortar por dentro. |

<a id="plano"></a>
## 9. Plano

**Fase 0 — linha de base (1 dia).** Um script único `medir-semana` (juntar o desta pesquisa com `custo-fixo` e `piso-da-sessao`) que dá: tokens e US$ por papel, por modelo, **custo por item fechado** (mediana e p90), turnos de trava por hook, tempo item aberto → PR → merge. Sem isso, as fases seguintes não provam ganho.

**Fase 1 — o barato e reversível (2–3 dias).**
- Roteamento de verdade: a orquestradora abre dona com `model` e `effort` explícitos; padrão **Sonnet** para item com plano escrito e sem estado gravado/produção; Opus só por gatilho listado. O validador fica no hook do ADR 0021, que recusou "Sonnet por padrão" porque a dona esquece de declarar o risco; o ajuste é só ampliar os casos em que o hook escolhe Sonnet, com o dado da fase 0.
- `criterio-da-dona`: continua bloqueando quando o relatório afirma sucesso e a saída real o contradiz, ou quando afirma sucesso sem ter rodado teste; a saída não colada passa a ser aviso.
- `contexto-do-papel`: um aviso por limiar, não por turno.
- Crítica de UI: só no fim do item, não a cada turno que muda visual (conversar com o design-system).
- `protocolo.md` e skill da orquestradora: cortar para o essencial com links por âncora; meta ~4 mil tokens cada.

**Fase 2 — estado derivado (1 semana).**
- O item tem só o que o modelo **decide** (título, plano, risco, entrega, perguntas). Etapa, PR, dona viva, parado, mergeado saem de git/`gh`/`list_sessions` na batida.
- Sai a obrigação de gravar `agora` a cada passo; saem `fila-do-item` e a parte de bookkeeping do `painel-das-sessoes`.
- Conclusão presa ao despacho (ideia do ORCA): o item fecha pelo merge do PR ligado a ele, nunca por declaração.
- O mod mostra quatro estados derivados e a fila de perguntas.

**Fase 3 — itens menores, sessões curtas (contínuo).**
- Corte de item pela orquestradora: item que prevê mais de ~1 dia de dona vira fatias com PR cada.
- Versão: subir uma vez por dia (ou por release), não por lote.
- Revisar a cada duas semanas com o `medir-semana`: o que não baixou custo por item ou tempo até o merge, sai.

**Meta medível (proposta):** custo por item fechado −40% e tempo item→merge p50 −30% em 3 semanas, com a mesma taxa de gate verde.
