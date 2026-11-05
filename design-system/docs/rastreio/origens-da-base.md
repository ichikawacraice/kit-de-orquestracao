# Rastreio da base Wicomm — de onde veio cada regra

A base (`plugins/wicomm/base/`) fala só da Wicomm (regra do operador, 30/10/2026; Q639). O rastro de cada regra até o produto de origem de onde foi extraída mora aqui, fora do plugin: é o que permite reabrir o raciocínio e as medições quando uma regra for discutida.

- **Produto de origem:** o repositório onde a base foi medida e escrita, `main @ 7b1267cce` (30/10/2026), fatia F262 (`docs/planos/2026-10-30-F262-base-wicomm.md`).
- **Os números de ADR e SPEC** são desse repositório; a lista conferida está em `scripts/origens-conhecidas.json`.
- **O teste** (`scripts/base.test.mjs`) cobra que toda regra da base tem uma linha aqui, com origem rastreável, e que nenhuma regra some ou aparece sem passar por aqui.

## Origens

| Código | Arquivo | Origem |
|---|---|---|
| MARCA-01 | DESIGN.md | ADR 0146 · ADR 0124. |
| MARCA-02 | DESIGN.md | ADR 0124. |
| MARCA-03 | DESIGN.md | ADR 0124 · ADR 0146. |
| MARCA-04 | DESIGN.md | Convenção do front (raster da marca) · ADR 0124 · a exceção do arquivo oficial da marca: Q938 · o negativo do símbolo por script, a partir do oficial positivo: Q940, 04/11/2026. |
| MARCA-05 | DESIGN.md | ADR 0124. |
| COR-01 | DESIGN.md | ADR 0102 · SPEC-065. |
| COR-02 | DESIGN.md | ADR 0124 · ADR 0125. |
| COR-03 | DESIGN.md | ADR 0055 · ADR 0064 · ADR 0102. A cor de identidade fora da régua de estado: Q939. |
| COR-04 | DESIGN.md | ADR 0064. |
| COR-05 | DESIGN.md | ADR 0102 · SPEC-065. O mapa `TEXTO_SOBRE_A_TINTA` e o mapa de etapas do `PontoDaEtapa` como exceção declarada · revisão do quadro de tarefas, F378 (`docs/design/revisoes/2026-11-04-F378-quadro.md`), 04/11/2026. |
| COR-06 | DESIGN.md | ADR 0102 · SPEC-065 · ADR 0425. |
| COR-07 | DESIGN.md | SPEC-065. |
| COR-08 | DESIGN.md | SPEC-080 · ADR 0130. A exceção do glifo da prioridade: Q939. A exceção da cor da pessoa em todo monograma: F390, 04/11/2026. A prioridade que recorta e a contagem zerada; a cor do nível só dentro do carimbo, com o porquê medido · revisão F393 (`docs/design/revisoes/2026-11-05-F393-prioridade-que-filtra.md`), 05/11/2026, a pedido do piloto WiControl (F388, D4/D5 e crítica P3/P4). |
| COR-09 | DESIGN.md | ADR 0130 · ADR 0420 · SPEC-080 (substituída nesse ponto pelo ADR 0130). O nível da prioridade como identidade declarada, que pinta a palavra: Q939, 04/11/2026, com o contraste medido na F379. A cor da pessoa no monograma e no nome de quem fala na conversa: Q942, 04/11/2026, com o contraste medido na F380 e levado ao kit na F379. Levada a todo monograma, pela chave dentro da peça, com o nome fora da conversa neutro e a separação entre identidades pela forma: pedido do operador de 04/11/2026, revisão F390 (`docs/design/revisoes/2026-11-04-F390-cor-da-pessoa-no-monograma.md`). A prioridade que recorta e a contagem zerada; a cor do nível só dentro do carimbo, com o porquê medido · revisão F393 (`docs/design/revisoes/2026-11-05-F393-prioridade-que-filtra.md`), 05/11/2026, a pedido do piloto WiControl (F388, D4/D5 e crítica P3/P4). |
| COR-10 | DESIGN.md | ADR 0064. |
| COR-11 | DESIGN.md | ADR 0126 · SPEC-080. |
| COR-12 | DESIGN.md | Convenção "par de cor opaco tem teste que calcula" · ADR 0126. |
| COR-13 | DESIGN.md | Seção "Ícone" da direção de design de origem (contraste de ícone). |
| COR-14 | DESIGN.md | Do's and Don'ts da direção de design de origem. |
| COR-15 | DESIGN.md | Direção de design de origem, seção Neutral (o terminal) · ADR 0425. |
| TIPO-01 | DESIGN.md | SPEC-008 · direção de design de origem, seção Typography. *Assumida, a confirmar:* Archivo como fonte Wicomm. |
| TIPO-02 | DESIGN.md | ADR 0138 · SPEC-086 · ADR 0147 · ADR 0150 · ADR 0364 · ADR 0392. *Nota:* o frontmatter da direção de origem ainda descreve uma escala anterior (display 1,25rem/700, title 1rem…); a regra segue as classes do código, que vencem. A exceção do `h1` do Editor (TIPO-04) · revisão de arquitetura dos blocos de tela, F272 (`docs/design/revisoes/2026-10-30-F272-blocos-de-tela.md`), 30/10/2026. O nome do grupo de linhas · revisão da separação das listas, F307 (`docs/design/revisoes/2026-11-01-F307-separacao-das-listas.md`), 01/11/2026. A voz do título do item de quadro e o nome da coluna do quadro · revisão do quadro de tarefas, F378 (`docs/design/revisoes/2026-11-04-F378-quadro.md`), 04/11/2026. |
| TIPO-03 | DESIGN.md | Direção de design de origem, Regra da Medida em Mono. |
| TIPO-04 | DESIGN.md | ADR 0147 · ADR 0150. O `h1` do Editor na barra, em `t-titulo` · revisão de arquitetura dos blocos de tela, F272 (`docs/design/revisoes/2026-10-30-F272-blocos-de-tela.md`), 30/10/2026. (emenda E3, P4 da crítica 1). |
| DENS-01 | DESIGN.md | Direção de design de origem, Regra do Corpo Denso. |
| DENS-02 | DESIGN.md | ADR 0401 · ADR 0364. |
| LAY-01 | DESIGN.md | ADR 0396 · direção de design de origem, seção Layout. O topo parado, a barra por cima abaixo de 768px e a marca antes da hidratação · revisão de arquitetura dos blocos de tela, F272 (`docs/design/revisoes/2026-10-30-F272-blocos-de-tela.md`), 30/10/2026. |
| LAY-02 | DESIGN.md | Direção de design de origem, seção Layout. |
| LAY-03 | DESIGN.md | ADR 0099 · SPEC-062. |
| LAY-04 | DESIGN.md | Direção de design de origem, seção Layout. |
| LAY-05 | DESIGN.md | Direção de design de origem, seção Layout. |
| LAY-06 | DESIGN.md | Direção de design de origem, seção Movimento (larguras e respiro com nome) · ADR 0392. |
| SUP-01 | DESIGN.md | ADR 0125 · ADR 0099. |
| SUP-02 | DESIGN.md | ADR 0125. |
| SUP-03 | DESIGN.md | ADR 0125 · convenção "a separação é o ar". O ar da lista e o degrau medido contra o cartão · revisão da separação das listas, F307 (`docs/design/revisoes/2026-11-01-F307-separacao-das-listas.md`), 01/11/2026. O filete-guia e a régua do cabeçalho da `Table`, e a faixa do `border` contra o cartão · revisão da tabela, F321 (`docs/design/revisoes/2026-11-01-F321-tabela.md`), pedido do operador e referências de tabela de mercado, 01/11/2026. |
| SUP-04 | DESIGN.md | ADR 0125 · convenção "conteúdo mora em superfície". |
| SUP-05 | DESIGN.md | ADR 0125. |
| SUP-06 | DESIGN.md | ADR 0125 · ADR 0126. |
| SUP-07 | DESIGN.md | Decisão do dono do produto (pedido do operador, 31/10/2026, F301): o menu de acrescentar seção de um app abria sempre para baixo e, com muitos itens, cortava no fim da tela sem deixar clicar. |
| FORMA-01 | DESIGN.md | ADR 0344 · direção de design de origem, seção Shapes. *Nota:* a escala segue as classes que as peças de origem usam de fato; os tokens `--raio-cartao` (14) e `--raio-badge` (6) da origem quase não têm uso. O valor de `rounded-md` (8px pelo config, 6px pelo comentário de origem) se decide no navegador, na fatia de tokens. A trilha de progresso na pílula · revisão de arquitetura das peças, F294, 31/10/2026. O raio de 14px do cartão de quadro e de lista · revisão do quadro de tarefas, F378 (`docs/design/revisoes/2026-11-04-F378-quadro.md`), 04/11/2026. |
| FORMA-02 | DESIGN.md | Direção de design de origem, Regra da Tracejada. |
| FORMA-03 | DESIGN.md | ADR 0125. |
| CTRL-01 | DESIGN.md | ADR 0344 · ADR 0263. |
| CTRL-02 | DESIGN.md | ADR 0262. |
| CTRL-03 | DESIGN.md | ADR 0124 · ADR 0344. A prioridade que recorta e a contagem zerada; a cor do nível só dentro do carimbo, com o porquê medido · revisão F393 (`docs/design/revisoes/2026-11-05-F393-prioridade-que-filtra.md`), 05/11/2026, a pedido do piloto WiControl (F388, D4/D5 e crítica P3/P4). |
| CTRL-04 | DESIGN.md | ADR 0126 · SPEC-062 · SPEC-066. |
| CTRL-05 | DESIGN.md | ADR 0102 · SPEC-065. O ponto do estado neutro · Q825 (crítica de UI do F324, no piloto WiControl: o estado neutro no topo igual aos valores logo abaixo), F328, 01/11/2026. O filete da marca no `Badge` de marca · crítica de UI do F328 (P4: o de marca e o `ruim` no mesmo rosa), pedido do operador; a tinta neutra no de marca · Q828 (operador, 01/11/2026), F330. |
| CTRL-06 | DESIGN.md | ADR 0134 · SPEC-084. |
| CTRL-07 | DESIGN.md | Decisão do dono do produto em 05/10/2026 (convenção do front). |
| CTRL-08 | DESIGN.md | ADR 0124 · direção de design de origem, seção Navigation. |
| CTRL-09 | DESIGN.md | ADR 0382 · inventário do estudo F261 (128 arquivos com `lucide-react`). *Assumida, a confirmar:* os tamanhos 14/16/18 como tokens. |
| MOV-01 | DESIGN.md | ADR 0374 · ADR 0392. |
| MOV-02 | DESIGN.md | ADR 0374. |
| MOV-03 | DESIGN.md | ADR 0374. A espera de 120ms vale também com movimento reduzido · revisão de arquitetura das peças, F294, 31/10/2026. |
| MED-01 | DESIGN.md | Convenção "contraste se compõe" · Do's and Don'ts da direção de origem. |
| PRIN-01 | ANATOMIA.md | SPEC-062. |
| PRIN-02 | ANATOMIA.md | ADR 0379 · ADR 0404. |
| PRIN-03 | ANATOMIA.md | SPEC-062 (§7, dobra) · ADR 0379. |
| PRIN-04 | ANATOMIA.md | SPEC-062. |
| PRIN-05 | ANATOMIA.md | SPEC-062 · decisão do dono do produto (Q138, peça nova parte do shadcn oficial). |
| PRIN-06 | ANATOMIA.md | ADR 0392 · ADR 0374. |
| CASCO-01 | ANATOMIA.md | ADR 0396 · ADR 0147 · SPEC-043 · SPEC-062 · direção de design de origem (Layout e Navigation). A divisão entre cabeçalho e topo da página, que era síntese desta base, foi fixada pelo bloco do casco · revisão de arquitetura dos blocos de tela, F272 (`docs/design/revisoes/2026-10-30-F272-blocos-de-tela.md`), 30/10/2026. O Editor também fora do casco (emenda E1, D1 *assumida, a confirmar*). A linha de valores no topo · F326 (CASCO-04), 01/11/2026. Os recortes contados · F399, 05/11/2026. |
| CASCO-02 | ANATOMIA.md | ADR 0379 · SPEC-062 (§ menu rotulado não é dobra). |
| CASCO-03 | ANATOMIA.md | SPEC-043. O Editor fora do casco, com a volta e o nome da barra no lugar da trilha · revisão de arquitetura dos blocos de tela, F272 (`docs/design/revisoes/2026-10-30-F272-blocos-de-tela.md`), 30/10/2026. (emenda E2, D1 *assumida, a confirmar*). |
| CASCO-04 | ANATOMIA.md | Q820 · Q821 (o selo neutro numa linha abaixo do título; a linha entra no registro antes da tela). Lacuna do registro achada no piloto WiControl, F324 (`docs/design/revisoes/2026-11-01-selos-do-projeto.md`, seção *Lacuna do registro*, no repositório do WiControl): quatro valores no `estado` zeram o título a 1280px no pior caso e cortam o nome a 1024px no caso comum; slot `valores` · F326, 01/11/2026. |
| ARQ-01 | ANATOMIA.md | SPEC-062 · ADR 0425 · ADR 0428 · ADR 0421. A região *lista ou quadro* com a coluna no chão · revisão do quadro de tarefas, F378 (`docs/design/revisoes/2026-11-04-F378-quadro.md`), 04/11/2026. Os recortes contados · F399, 05/11/2026. A espera com a forma da vista aberta, regra geral (era só da Mesa com abas) · revisão da lista por período e do intervalo, F395 (`docs/design/revisoes/2026-11-05-F395-lista-por-periodo-e-intervalo.md`), 05/11/2026, a partir da tela de projetos do piloto WiControl (F389). |
| ARQ-02 | ANATOMIA.md | SPEC-062. |
| ARQ-03 | ANATOMIA.md | ADR 0379 · ADR 0404. |
| ARQ-04 | ANATOMIA.md | ADR 0404. |
| ARQ-05 | ANATOMIA.md | Decisão do dono do produto, *a confirmar* no PR do F399 (pedido do operador de levar ao kit os achados de um app consumidor, 05/11/2026). Fileira de recortes montada à mão no topo de uma Lista de um app consumidor; revisão dos recortes contados, F399 (`docs/design/revisoes/2026-11-05-F399-topo-com-resumo.md`), 05/11/2026. |
| MSG-01 | ANATOMIA.md | SPEC-062 · SPEC-066. A faixa abaixo do topo, a confirmação que espera a ação terminar e o véu só sobre a região · revisão de arquitetura das peças, F294 (`docs/design/revisoes/2026-10-31-F294-pecas-do-wicontrol.md`), 31/10/2026. |
| MSG-02 | ANATOMIA.md | SPEC-062. |
| MSG-03 | ANATOMIA.md | SPEC-062 · ADR 0401. |
| MSG-04 | ANATOMIA.md | SPEC-066. |
| MSG-05 | ANATOMIA.md | Convenção "texto de UI não cita spec/doc". |
| MSG-06 | ANATOMIA.md | ADR 0379 · anatomia de origem (o editor, ações raras no `⋯`). |
| MSG-07 | ANATOMIA.md | O item que leva a um lugar ou escolhe uma opção diz o nome: medido no registro (`menu-do-tema`, `menu-da-conta`, `seletor-de-vista`) · plugin `design` da Anthropic (knowledge-work-plugins@2574e29, Apache-2.0), skill `ux-copy` (CTA: verbo e específico; botões do diálogo com a ação) · padrão `Cancelar` do `confirm-dialog` do registro · CTRL-07 · F334, pedido do operador de 02/11/2026 (absorver o que serve dos plugins da Anthropic, sem depender deles). |
| MSG-08 | ANATOMIA.md | plugin `design` da Anthropic (knowledge-work-plugins@2574e29, Apache-2.0), skill `ux-copy` (diálogo de confirmação: a ação e a consequência, não *Are you sure?*) · F334, pedido do operador de 02/11/2026 (absorver o que serve dos plugins da Anthropic, sem depender deles). |
| MSG-09 | ANATOMIA.md | plugin `design` da Anthropic (knowledge-work-plugins@2574e29, Apache-2.0), skill `ux-copy` (erro: o que houve, por quê, como resolver), reescrita em duas partes para casar com MSG-03 e MSG-06 · F334, pedido do operador de 02/11/2026 (absorver o que serve dos plugins da Anthropic, sem depender deles). |
| PECA-01 | ANATOMIA.md | SPEC-062 · ADR 0102 · ADR 0134 · ADR 0382 · ADR 0412 · ADR 0420 · ADR 0425. As linhas do percurso, do vazio, da tabela, do topo, do logotipo, da conta e do tema, e o medalhão neutro na ausência · revisão de arquitetura dos blocos de tela, F272 (`docs/design/revisoes/2026-10-30-F272-blocos-de-tela.md`), 30/10/2026. A linha das colunas do Editor e o `GrupoDaPessoa` na barra (F272, fatia 2). As linhas da caixa de marcar, do `Select`, da coluna que rola, da `Faixa` (que deixa de ser só do Editor), do `Badge`, do `Medidor`, do `Progress`, do `CarregandoPorCima` e da confirmação com `onConfirmar`, e o nome do shadcn na coluna "Não use" · piloto WiControl e revisão de arquitetura das peças, F294 (`docs/design/revisoes/2026-10-31-F294-pecas-do-wicontrol.md`), 31/10/2026. As linhas do grupo de linhas, da pessoa e da pilha, do prazo e da escolha na célula · revisão de arquitetura das listagens do piloto WiControl (F305) e das peças de lista, F306 (`docs/design/revisoes/2026-11-01-F306-pecas-de-lista.md`), 01/11/2026. O alinhamento das barras do grupo, a célula do grupo no celular, o prazo de um dia, só a data e numa linha, e o formulário e a dica da escolha na célula · lacunas do uso das peças de lista no piloto WiControl (F305), F307, 01/11/2026. A linha que cresce com o conteúdo, o hover com a forma do foco e o grupo com vão, ar e recuo · revisão da separação das listas, F307 (`docs/design/revisoes/2026-11-01-F307-separacao-das-listas.md`), 01/11/2026. O vão grande só depois de grupo aberto, o topo que cresce com o prazo e o recuo que conta a identidade · crítica da fatia 3 da F305 nas peças 0.9.0, F313 (`f305-fatia3-achados-do-registro`), 01/11/2026. O filete-guia, a régua e o cabeçalho de 40px da tabela, e o ar da régua ao primeiro grupo · revisão da tabela, F321 (`docs/design/revisoes/2026-11-01-F321-tabela.md`), 01/11/2026. Os valores no `TopoDaPagina` · F326 (CASCO-04), 01/11/2026. As linhas do quadro de tarefas e da prioridade · revisão do quadro de tarefas, F378 (`docs/design/revisoes/2026-11-04-F378-quadro.md`), 04/11/2026; as medidas, a paleta de exemplo das etapas e a prioridade em carimbo alinhadas ao quadro de solicitações do Izanagi, pedido do operador, 04/11/2026. A cor por nível no glifo e na palavra da prioridade: Q939, 04/11/2026. O `fechaAoClicarFora` do `DialogLateral`: F379, 04/11/2026, levado da coluna do item do produto de origem, que fechava ao clicar fora com a lista de exceções à mão. A conversa entre pessoas e a pilha decorativa: Q942, F380 → F379, 04/11/2026. A prioridade que recorta e a contagem zerada; a cor do nível só dentro do carimbo, com o porquê medido · revisão F393 (`docs/design/revisoes/2026-11-05-F393-prioridade-que-filtra.md`), 05/11/2026, a pedido do piloto WiControl (F388, D4/D5 e crítica P3/P4). Os recortes contados · F399, 05/11/2026. As linhas da lista agrupada por período e do intervalo de dois valores, a quantidade com unidade e o vazio sem contagem no grupo, as larguras do popover e as esperas na linha do carregando · revisão F395 (`docs/design/revisoes/2026-11-05-F395-lista-por-periodo-e-intervalo.md`), 05/11/2026, a partir do piloto WiControl (F389). |
| PECA-02 | ANATOMIA.md | Decisão do dono do produto (Q138, 23/10/2026) · Q95 · ADR 0375. As colunas do Editor sem `Resizable` · revisão de arquitetura dos blocos de tela, F272 (`docs/design/revisoes/2026-10-30-F272-blocos-de-tela.md`), 30/10/2026. (crítica 1, conflito da E5). |
| PECA-03 | ANATOMIA.md | Decisão do dono do produto, *a confirmar* no PR do F399 (pedido do operador de levar ao kit os achados de um app consumidor, 05/11/2026). Frases de gráfico da fileira de recortes montada à mão no topo de uma Lista de um app consumidor; revisão dos recortes contados, F399 (`docs/design/revisoes/2026-11-05-F399-topo-com-resumo.md`), 05/11/2026. |
| PESO-01 | ANATOMIA.md | SPEC-062. |
| PESO-02 | ANATOMIA.md | SPEC-062 · ADR 0124. |
| PESO-03 | ANATOMIA.md | ADR 0127 · ADR 0421 · convenção "gesto bloqueado". |
| PESO-04 | ANATOMIA.md | SPEC-062. |
| PESO-05 | ANATOMIA.md | ADR 0272 · convenção "gesto que não grava". |
| EST-01 | ANATOMIA.md | SPEC-062 · SPEC-067. |
| EST-02 | ANATOMIA.md | Do's and Don'ts da direção de origem. |
| EST-03 | ANATOMIA.md | Convenção "ação assíncrona tem estado visível". |
| EST-04 | ANATOMIA.md | ADR 0425 · direção de design de origem (Do's and Don'ts). O não contado escrito como o travessão numérico `‒`, o que a peça desenha · F399, 05/11/2026. |
| EST-05 | ANATOMIA.md | Direção de design de origem (Do's and Don'ts). |
| EST-06 | ANATOMIA.md | Decisão do dono do produto, *a confirmar* no PR do F399 (pedido do operador de levar ao kit os achados de um app consumidor, 05/11/2026). Vazio parcial da vista alternada da mesma fileira de recortes montada à mão no topo de uma Lista de um app consumidor; revisão dos recortes contados, F399 (`docs/design/revisoes/2026-11-05-F399-topo-com-resumo.md`), 05/11/2026. |
| MOVA-01 | ANATOMIA.md | ADR 0374. |
| CONV-01 | CONVENCOES.md | Convenção "cor de tema com alfa" · direção de design de origem, Regra do Alfa por `color-mix`. |
| CONV-02 | CONVENCOES.md | Convenção "fonte e var no mesmo escopo". |
| CONV-03 | CONVENCOES.md | Convenção "token transparente" · ADR 0126. |
| CONV-04 | CONVENCOES.md | ADR 0392 · ADR 0374 · ADR 0344. |
| CONV-05 | CONVENCOES.md | Convenção "escala e caixa de conteúdo". |
| CONV-06 | CONVENCOES.md | Convenção "estado de vista". |
| CONV-07 | CONVENCOES.md | Convenção "ação assíncrona tem estado visível". |
| CONV-08 | CONVENCOES.md | Convenção "o efeito entra na hora, e a recusa desfaz". |
| CONV-09 | CONVENCOES.md | SPEC-066 · SPEC-062. |
| CONV-10 | CONVENCOES.md | SPEC-062 · Do's and Don'ts da direção de origem. |
| CONV-11 | CONVENCOES.md | Convenção "texto de UI não cita spec/doc". |
| CONV-12 | CONVENCOES.md | Convenção "o glossário da interface não é o do código". |
| CONV-13 | CONVENCOES.md | Convenção "agente não propõe ação que a tela não tem". |
| CONV-14 | CONVENCOES.md | Convenção "guarda com insumo vazio" · convenção "a varredura que força tem piso". |
| CONV-15 | CONVENCOES.md | Convenção "duas coisas que precisam concordar". |
| CONV-16 | CONVENCOES.md | Convenção "guarda com insumo vazio". |
| CONV-17 | CONVENCOES.md | Convenção "a varredura que força tem piso e régua de número". |
| CONV-18 | CONVENCOES.md | Convenção "contraste se compõe". |
| CONV-24 | CONVENCOES.md | Convenção "teste que mede uma ausência declara essa ausência". |
| CONV-19 | CONVENCOES.md | ADR 0378. |
| CONV-20 | CONVENCOES.md | ADR 0378 · ADR 0401 · estudo F261 (seção 1.4, escala da nota). |
| CONV-21 | CONVENCOES.md | ADR 0129. |
| CONV-22 | CONVENCOES.md | ADR 0375 · Q95. *Assumida, a confirmar:* só o detector local. |
| CONV-23 | CONVENCOES.md | Do's and Don'ts da direção de origem · convenção "duas coisas que precisam concordar". |
| CONV-25 | CONVENCOES.md | Decisão do operador Q701, 31/10/2026, piloto WiControl (F293). *Revogada na 0.16.0:* os pacotes saíram no npm público (decisão do operador Q869, primeiro envio em 03/11/2026, F357). |
| CONV-26 | CONVENCOES.md | Convenção "o filtro da Lista lembrado no navegador". Piloto WiControl, F388 (PR 67, 04/11/2026), levado ao kit na F394, 05/11/2026. |
| ACES-01 | CONVENCOES.md | WCAG 2.1 AA, critérios 2.1.1, 2.1.2, 2.4.3 e 2.4.7 · isenção do foco por programa e do fundo como sinal de foco no menu e no select: medido no registro (`barra-do-editor`, `menu`, `select`) · plugin `design` da Anthropic (knowledge-work-plugins@2574e29, Apache-2.0), skill `accessibility-review` (teclado, ordem do foco, armadilha de foco em modal) · F334, pedido do operador de 02/11/2026 (absorver o que serve dos plugins da Anthropic, sem depender deles). |
| ACES-02 | CONVENCOES.md | WCAG 2.1 AA, critérios 1.1.1, 1.3.1, 1.4.1, 3.3.2 e 4.1.2 · plugin `design` da Anthropic (knowledge-work-plugins@2574e29, Apache-2.0), skill `accessibility-review` · F334, pedido do operador de 02/11/2026 (absorver o que serve dos plugins da Anthropic, sem depender deles). |
| ACES-03 | CONVENCOES.md | WCAG 2.2 AA, critério 2.5.8 (24×24px). O original cita o 2.5.5 (44×44px) como AA, mas ele é AAA: a base fica no AA e mantém os 44px só na Entrada (CTRL-02) · F334, pedido do operador de 02/11/2026 (absorver o que serve dos plugins da Anthropic, sem depender deles). Medido no registro: a barra de modos tem `h-6` (`seletor-de-vista.tsx`); o fechar do `toast` (14px) e o `ChipQueAbre` (~21px) ficam abaixo e estão marcados na nota *assumida, a confirmar* da regra. A folga do círculo de 24px segue o texto do critério. |
| ACES-04 | CONVENCOES.md | WCAG 2.1 AA, critérios 1.3.1, 2.4.6 e 3.1.1 · plugin `design` da Anthropic (knowledge-work-plugins@2574e29, Apache-2.0), skill `accessibility-review` (landmarks) · F334, pedido do operador de 02/11/2026 (absorver o que serve dos plugins da Anthropic, sem depender deles). |
| ACES-05 | CONVENCOES.md | WCAG 2.1 AA, critério 4.1.3 (mensagem de status) · F334, pedido do operador de 02/11/2026 (absorver o que serve dos plugins da Anthropic, sem depender deles). Medido no registro: `carregando-por-cima` monta a região `status` antes do texto; `toast` e `faixa` marcam `status`/`alert`, mas a região nasce com o texto (`faixa` devolve `null` vazia; a área dos toasts não é região viva) — marcado na nota *assumida, a confirmar* da regra. O `alert` que nasce com o texto, e renasce para repetir a falha (`confirm-dialog`), é o padrão e fica permitido. |
