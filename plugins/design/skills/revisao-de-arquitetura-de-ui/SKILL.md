---
name: revisao-de-arquitetura-de-ui
description: A revisão de arquitetura de UI — antes de escrever qualquer interface do front, decide a tarefa da tela, o inventário do que ela mostra (cada dado com a decisão que ele gera), a hierarquia, onde mora cada mensagem e quais componentes DO KIT montam cada região, e entrega no formato fixo para o crítico julgar. Use antes de criar ou mudar tela, painel, componente, mensagem ou fluxo do front ("desenha", "redesenha", "reorganiza", "a tela está confusa", "tem informação demais", "onde ponho este aviso"). Não escreve código de produto; quem implementa é o executor, a partir da revisão aprovada.
---

# Revisão de arquitetura de UI

Quem desenha decide **o que a tela é** antes de decidir **como ela parece**. Esta revisão vem antes de qualquer JSX, e o resultado dela é um documento — não um componente. Por quê: decidir o estilo antes da tarefa produz tela bonita que responde pergunta nenhuma.

## Onde estão os caminhos

Leia `.claude/kit.json`, seção `design`: `fontes` (lista de arquivos; padrão `<pasta>/PRODUCT.md`, `<pasta>/ANATOMIA.md`, `<pasta>/DESIGN.md`, com `<pasta>` = `design.pasta`), `kit` (pasta dos componentes), `revisoes` (padrão `docs/design/revisoes`). Fora dessas chaves: a largura de referência é `design.largura` do kit.json; sem a chave vale a opção `largura` do plugin, hoje ${user_config.largura} px (se este texto chegar sem o número, use 1280); a pasta do front é `design.pasta` do kit.json; sem a chave vale a opção `pasta_do_front` do plugin, hoje `${user_config.pasta_do_front}` (vazio = nenhuma; se este texto chegar sem expandir, trate como vazio). Sem a seção `design` nem a pasta, pergunte ao operador onde estão antes de opinar; não invente caminho.

## As fontes, nesta ordem (leia antes de opinar)

1. **PRODUCT** — quem usa, em que tela, para quê.
2. **ANATOMIA** — **o que vai onde**: arquétipos de tela, regiões, o lugar de cada mensagem, o componente de cada função.
3. **DESIGN** — **como parece**: tokens, tipo, cor, raio, sombra, movimento.
4. As convenções do front no `CLAUDE.md` do projeto (as que têm teste).
5. A spec da tela (pasta de specs do projeto, quando houver).
6. **O código de hoje** da tela, e não a captura antiga: o código vence a captura quando os dois divergem.

Conflito entre fontes: a decisão registrada (ADR, spec aprovada, convenção com teste) vence a sua preferência. Se ela parece errada, a revisão diz isso numa linha em *Decisões ao operador* — não a contorna.

## Os seis princípios (cada um é um critério, não um enfeite)

1. **Uma tela, uma tarefa.** A tela responde uma pergunta só. Configuração, histórico, analytics e publicação que não são a tarefa vão para outra tela, gaveta ou diálogo.
2. **A área de trabalho é sagrada.** Onde há um objeto central (canvas, documento, tabela), ele domina; estrutura de um lado, inspetor e conversa do outro, e nada cresce por cima ou por dentro dele.
3. **Avançado não é ausente.** A ação rara pode morar no menu do objeto dela (`⋯`, `▾`), nunca numa dobra fechada; o informativo raro pode ir para dobra, aba ou gaveta — e os dois continuam alcançáveis e dizem o motivo quando está bloqueado.
4. **Dado sem ação é ruído.** Se a informação não muda o que a pessoa faz agora, ela não tem espaço permanente.
5. **Componente antes de layout.** Cada região é montada com componentes que existem na pasta do kit (ou os do arquétipo, na ANATOMIA). Falta peça? A revisão propõe a peça nova **para o kit**, nunca um arranjo à mão na tela. Peça nova entra pelo registro oficial do kit de componentes que o projeto usa.
6. **Token ou não existe.** Cor, espaço, tipo, raio, sombra e duração saem da escala do DESIGN. Valor solto (`h-[34px]`, `text-[15px]`, hex) é defeito, não detalhe.

## O procedimento

1. **A tarefa.** Uma frase com um verbo: *"o cliente muda o conteúdo de uma seção e vê o resultado"*. Quem usa (papel do PRODUCT), em que largura (a de referência é o pior caso real), com que frequência.
2. **O inventário.** Toda informação, controle e mensagem que a tela mostra HOJE (ou que a proposta mostraria), numa tabela: *o quê* · *onde está* · *que decisão gera* · *frequência de uso* · *veredito*. O veredito é um de: **fica** (permanente), **sob demanda** (`⋯`, dobra, popover, gaveta — diga qual), **outra tela**, **sai**. Linha sem decisão que ela gere é **sai**, salvo motivo escrito.
3. **A hierarquia.** Uma ação primária por tela (e por bloco), as secundárias, as terciárias. Para cada região: **peso visual** (largura relativa ou altura em px na largura de referência), o que ela mostra primeiro, e o que cabe sem rolar.
4. **Onde mora cada mensagem.** Para cada mensagem do inventário, o lugar pela matriz da ANATOMIA (*no campo · no bloco · chip da barra · faixa abaixo da barra · conversa · diálogo*), a duração (enquanto vale · até a pessoa fechar · some sozinha) e o tom (`ok`, `espera`, `ruim`, `neutro`, `alheio`). Mensagem para quem opera não aparece para o cliente.
5. **Os componentes.** Para cada região, os componentes do kit que a montam, pelo nome do arquivo. Lacuna = proposta de componente novo para o kit, com a anatomia dele (partes, estados, variantes).
6. **Os estados.** Carregando, vazio, andando, erro, recusa, sucesso, sem permissão — o que cada região mostra em cada um. Ação assíncrona dispara, diz sobre o quê, tem desfecho sempre e sobrevive ao recarregar.
7. **O movimento.** O que entra, o que sai, por qual token de duração e curva, e o que acontece com `prefers-reduced-motion`.
8. **O corte.** O que **sai** da tela, em lista. Uma revisão que só acrescenta não terminou.

## A entrega (formato fixo — o crítico lê por estes títulos)

```markdown
# Revisão de arquitetura — <tela>
## Tarefa
## Quem e onde
## Inventário            (tabela: o quê · onde · decisão que gera · frequência · veredito)
## Hierarquia e peso     (primária, secundárias; peso de cada região na largura de referência)
## Mensagens             (tabela: mensagem · lugar · duração · tom · quem vê)
## Regiões e componentes (região → componentes do kit; lacunas → peça nova do kit)
## Estados
## Movimento
## O que sai
## Decisões ao operador  (cada uma: o caso · se não decidir · recomendação)
```

Grave em `<design.revisoes>/AAAA-MM-DD-<tela>.md` quando a revisão sustenta trabalho; rascunho fica no scratchpad. Depois dela vem o **crítico** (`critico-de-ui`), em contexto separado: quem desenhou já acredita no desenho. Achado do crítico volta para esta revisão antes de qualquer código, até o teto: com 24/30 ou mais e sem ressalva alta, a revisão está liberada para execução, e a ressalva média ou baixa vira item próprio na fila (a alta volta para conserto); no máximo 2 recríticas, e na terceira o que estiver abaixo de 24 sobe à planejadora (skill `critica-de-ui`, seção *O teto da crítica*).

## O que esta revisão não faz

- Não escreve componente, JSX nem CSS de produto.
- Não escolhe outra marca, fonte ou paleta: o estilo é o do DESIGN (catálogo de estilos de terceiros não entra: propõe outra marca).
- Não reabre decisão registrada sem dizer qual e por quê, em *Decisões ao operador*.
- Não cita spec nem ADR em texto que vai para a tela: o texto de UI fala com quem usa, não com quem mantém.
