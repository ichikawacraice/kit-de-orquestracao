---
name: Wicomm
versao: 0.6.0
description: A anatomia dos apps React da Wicomm — o que vai onde na tela, com a regra, o porquê e como cada regra se confere.
---

# Anatomia Wicomm — o que vai onde

> A [`DESIGN.md`](DESIGN.md) diz **como** a tela parece: token, cor, tipo, raio, sombra, movimento. Este arquivo diz **o que** vai **onde**: os tipos de tela, as regiões de cada um, o lugar de cada mensagem e a peça do kit para cada função. Valor de token aqui é defeito (está na DESIGN); regra de aparência aqui também.
>
> Quem desenha lê os dois antes de qualquer interface: o agente `designer` (revisão de arquitetura) e o `critico-de-ui` (crítica), que julga pelos dois. O formato de cada regra — **Regra · Por quê · Confere** — está explicado na [DESIGN](DESIGN.md#como-ler-uma-regra).
>
> Os nomes de peça são os do registro Wicomm (em português, com o nome shadcn equivalente na descrição da peça). Enquanto o registro não existe, a peça que falta no projeto se cria no kit do projeto, com o mesmo nome e a mesma função.

<a id="principios"></a>
## 1. Os seis princípios

Cada princípio é um critério da revisão de arquitetura e da crítica.

### PRIN-01 · Uma tela, uma tarefa
- **Regra.** A tela responde a **uma** pergunta. Configuração, histórico, análise e publicação que não são a tarefa dela vão para outra tela, gaveta ou diálogo.
- **Por quê.** Duas tarefas na mesma tela dividem o primário e a pessoa não sabe por onde começar.
- **Confere.** `crítica:hierarquia` · `crítica:ação primária`.

### PRIN-02 · O canvas é sagrado
- **Regra.** No arquétipo Editor, o preview domina: estrutura à esquerda, inspector ou conversa à direita, e nada cresce por cima ou por dentro do canvas. Exceção escrita por projeto, com motivo.
- **Por quê.** O que cresce sobre o canvas esconde justamente o que a pessoa está editando.
- **Confere.** `crítica:hierarquia`.

### PRIN-03 · Avançado não é ausente
- **Regra.** A **ação** rara mora no menu do objeto dela (o `⋯`, o `▾`), nunca numa dobra fechada. O **informativo** raro pode ir para a dobra, a aba ou a gaveta. Os dois continuam alcançáveis; o bloqueado segue PESO-03.
- **Por quê.** Ação escondida em dobra é ação que ninguém acha.
- **Confere.** `crítica:clareza da ação`.

### PRIN-04 · Dado sem ação é ruído
- **Regra.** Informação que não muda o que a pessoa faz agora não tem espaço permanente. Se importa em algum momento, vira chip com detalhe sob demanda.
- **Por quê.** Cada dado fixo na tela compete com o que pede decisão.
- **Confere.** `crítica:ruído` · revisão de arquitetura (o inventário diz a decisão que cada dado gera).

### PRIN-05 · Componente antes de layout
- **Regra.** Toda região é montada com peças do kit (o registro Wicomm). Se falta peça, a peça nova entra **no kit** — com partes, estados e variantes, e no ateliê — antes de entrar na tela. Arranjo à mão na tela é defeito.
- **Por quê.** O arranjo à mão vira a próxima variante que diverge, e é assim que dois apps deixam de parecer da mesma empresa.
- **Confere.** `guarda:componente-que-ninguem-monta` · `crítica:consistência`.

### PRIN-06 · Token ou não existe
- **Regra.** Cor, espaço, tipo, raio, sombra e duração saem da escala da DESIGN. Valor solto (`#hex`, `text-[15px]`, `h-[34px]`, `duration-200`) é defeito.
- **Por quê.** Valor solto não acompanha o próximo ajuste de escala nem o tema.
- **Confere.** `guarda` de valor arbitrário (aviso na escrita, reprova no CI).

---

<a id="casco"></a>
## 2. O casco

O casco é o que faz dois apps da Wicomm parecerem um só: é a primeira coisa que o cliente vê e a que ele mais repete.

### CASCO-01 · Regiões do casco
- **Regra.** Todo app autenticado tem o mesmo casco:
  | região | o que mora | o que NÃO mora |
  |---|---|---|
  | **Barra lateral** (esquerda, recolhível) | o logotipo Wicomm, os destinos do app (item com ícone **e** rótulo), a conta e o tema ao pé | ação de tela, aviso, filtro |
  | **Topo da página** | a trilha (em tela de detalhe), o título (`h1`, um só), o estado do objeto quando a tela é de um objeto, o primário da tela | ação rara (vai ao `⋯`) |
  | **Conteúdo** | o arquétipo da tela, em superfície | conteúdo solto no fundo |
  O **cabeçalho**, grudado acima do topo, é opcional e só leva o que vale **igual em todas as telas** e muda o app inteiro: a troca de contexto, a busca global, a conexão com um serviço de fora — nunca título, primário, conta ou tema. O **topo da página** leva o que muda quando a tela muda. Para um caso novo, o teste é: *a coisa continua valendo depois de trocar de destino?* Se sim, é do cabeçalho; se não, é do topo. O topo não rola (LAY-01). Os arquétipos **Entrada e Editor ficam fora do casco**; no Editor, a barra (ARQ-03) faz o papel dele e leva a volta, o nome do objeto e a conta.
- **Por quê.** Navegação, título e primário no mesmo lugar em todo app é o que o cliente reconhece como "a mesma empresa".
- **Confere.** Bloco do casco (registro, `@wicomm/casco`) · bloco do Editor (registro, `@wicomm/editor`) · `guarda:o-titulo-da-pagina-e-um-so` · `crítica:consistência`.

### CASCO-02 · Um menu só, o do kit
- **Regra.** Todo menu de ações é a peça `Menu` do kit (`ItemDoMenu`, `SubmenuDoMenu`). Nenhum arquivo de tela escreve a própria linha de menu nem separa grupos de menu por filete (`<hr>`).
- **Por quê.** Menus escritos à mão divergem em altura, foco e item bloqueado, e a pessoa aprende um comportamento por tela.
- **Confere.** `guarda:um-menu-so`.

### CASCO-03 · Tela de detalhe tem trilha
- **Regra.** Toda tela de um objeto (detalhe, edição) abre com a trilha até a lista de onde veio. No Editor, fora do casco, a volta e o nome da `BarraDoEditor` cumprem a trilha: a volta é obrigatória na peça. A lista das telas que existem e a das que montam a trilha são forçadas a concordar por teste.
- **Por quê.** A tela onde mais se passava tempo não tinha volta nenhuma, e a peça de trilha já existia.
- **Confere.** `guarda:toda-tela-de-detalhe-tem-trilha`.

---

<a id="arquetipos"></a>
## 3. Os arquétipos de tela

### ARQ-01 · Toda tela é um de cinco
- **Regra.** Toda tela é um destes arquétipos. A que não cabe em nenhum vira **arquétipo novo, aqui, antes do código** (proposta à base Wicomm, não exceção local).
  | Arquétipo | Pergunta | Exemplos | Regiões |
  |---|---|---|---|
  | **Lista** | *o que pede a minha atenção?* | a fila de pedidos, os clientes, as novidades | topo (título + filtro global + primário) · lista ou quadro · vazio |
  | **Mesa** | *em que pé está isto, e o que eu faço agora?* | o detalhe de um pedido, uma conferência | topo (nome + estado + primário) · trilho do percurso · conteúdo da etapa |
  | **Editor** | *como fica se eu mudar isto?* | editor de página, construtor de formulário | barra · estrutura · canvas · inspector ou conversa |
  | **Entrada** | *qual é o único passo?* | login, senha nova, conectar uma conta | cartão sozinho no fundo, uma ação (`xl`) |
  | **Formulário** | *o que eu preciso dizer para disparar?* | novo pedido, nova conferência | casco de formulário (largura de LAY-02) · um `Bloco` por grupo de campos (`fieldset`/`legend` por dentro, como semântica) · um primário no fim |
  A **Mesa pode não ter primário** quando a tela é de leitura e o gesto mora noutra: o topo é só nome + estado, e o caminho de ação é uma linha com link, nunca um segundo lugar para o mesmo gesto. A **Mesa com abas** põe as abas no lugar do trilho, sem apoio à direita, e o esqueleto de carregamento dela desenha abas, não colunas que a tela não tem.
- **Por quê.** Cinco formas conhecidas deixam a pessoa saber onde está o primário antes de ler a tela.
- **Confere.** Revisão de arquitetura (declara o arquétipo) · auditoria de projeto (classifica cada rota) · `crítica:hierarquia`.

### ARQ-02 · Painel de análise é Lista com medidores
- **Regra.** Tela de análise (custo, uso, cota) é **Lista**: filtros globais no topo valendo para a tela inteira; cada medidor com largura pelo peso da pergunta, não por grade igual.
- **Por quê.** Grade igual dá o mesmo peso a perguntas de pesos diferentes.
- **Confere.** `crítica:hierarquia`.

<a id="editor"></a>
### ARQ-03 · O Editor, região por região
- **Regra.** Larguras em **1280px**, o pior caso:
  | Região | Largura | O que mora | O que NÃO mora |
  |---|---|---|---|
  | **Barra** — uma linha | 100%, altura de um controle + respiro | à esquerda: voltar, onde estou, o estado do rascunho (chip), desfazer/refazer; ao centro: vista e zoom; à direita: a conversa, o **primário**, o `⋯` e a conta | aviso longo, frase, segundo primário, ação rara |
  | **Estrutura** — esquerda | 240–288px, recolhível | a árvore do que existe e em que ordem, e o "adicionar" | o formulário do item (é do inspector) |
  | **Canvas** — centro | o resto, **nunca menos de 60%** | o preview e a barra flutuante do item selecionado (nome, mover, `⋯`) | aviso, faixa, painel, cartão de ajuda |
  | **Inspector** — direita | 320–340px | os campos do item selecionado, agrupados por dobra | histórico, publicação |
  | **Conversa** — direita | 320–340px, **no lugar do inspector** | o pedido à IA e o desfecho de cada pedido | os passos da máquina e o porquê técnico (vão numa dobra *Detalhes*) |
  Inspector e conversa disputam a mesma coluna: abre um, o outro dá lugar. Abaixo de 1280px a coluna da direita vira gaveta lateral. A estrutura recolhe para o trilho de ícones quando, aberta, deixaria o canvas abaixo de 60% — a regra é medida, não um ponto fixo.
- **Por quê.** Com estrutura, inspector e conversa abertos ao mesmo tempo, o canvas cai abaixo de 60% em 1280px.
- **Confere.** Bloco do arquétipo Editor (registro) · `crítica:densidade`.

### ARQ-04 · Linha de lista que se reordena
- **Regra.** A linha começa pelo botão de selecionar (ícone + nome); a alça de arrastar fica **no fim**, à esquerda do `⋯`, com `gap-1`, aparece no hover, no foco e na linha ativa, e tem a dica *Arrastar para mudar a ordem*.
- **Por quê.** No início, a alça fica sob o ícone do trilho quando a lista abre por cima dele, e o clique vira arrasto.
- **Confere.** `crítica:clareza da ação`.

---

<a id="mensagens"></a>
## 4. Onde mora cada mensagem

A pergunta que decide o lugar: **a quem a mensagem diz respeito, e por quanto tempo ela vale?** Ela mora o mais perto possível da coisa de que fala, e dura o tempo que vale.

### MSG-01 · A matriz das mensagens
- **Regra.**
  | Lugar | Para quê | Duração | Peça | Exemplo |
  |---|---|---|---|---|
  | **No campo** | validação de um campo, e a ajuda que gera decisão | enquanto vale | `aria-describedby` + texto em legenda abaixo do campo | "Este link leva para fora do site" |
  | **No ⓘ do campo** | ajuda que não gera decisão (formato, limite, o que o vazio significa) | enquanto o foco ou o mouse estiver nele | `DicaDeAjuda`, ao lado do controle, com o texto no `aria-describedby` dele | "JPG, PNG ou GIF até 8 MB" |
  | **No bloco** | o desfecho de uma ação daquele bloco | até a próxima ação | texto no fim do bloco, com `tom` | "Nada mudou." |
  | **No item, no canvas** | estado de UM item (trabalhando, oculto, alterado e não publicado) | enquanto vale | `Estado` (ponto/play) na barra flutuante ou na linha da árvore | o item que a IA está editando |
  | **No cabeçalho do inspector** | o pedido em andamento sobre o item aberto, e o desfecho ainda não visto | enquanto anda; o desfecho até ser visto | `ChipQueAbre`; o clique abre a conversa no pedido | "editando" |
  | **Chip da barra** | estado do conjunto inteiro, em uma palavra e com número | enquanto vale | `ChipDeEstado`; o clique abre o detalhe | "3 mudanças" |
  | **Faixa abaixo da barra** | **só** quando a tela inteira mente se a pessoa não souber (está editando algo que não está no ar, ou num escopo diferente do normal) | enquanto vale, **com a saída na própria faixa** | `FaixaDoEditor` (uma só) | "Você está vendo uma versão que não está no ar" + "Voltar à versão no ar" |
  | **Conversa** | o que a IA fez, o que ela pergunta e o desfecho | o histórico do pedido | a bolha do desfecho em uma frase; o técnico na dobra *Detalhes* | "Preciso de uma escolha sua." |
  | **Diálogo** | confirmação de ação irreversível ou cara | até a pessoa responder | `useConfirm`, com a variante destrutiva | "Publicar agora?" |
  | **Diálogo que bloqueia** | a tela não serve até uma condição de fora mudar | até a condição mudar; a saída no rodapé | `DialogLongo` com `bloqueia` (`alertdialog`, sem X, sem Esc, sem clique fora) | "A sua conexão com o serviço venceu" |
  | **Toast** | desfecho de ação cujo bloco **sumiu** (fechou, navegou) | some sozinho | `useToast`, só `ok`/`ruim`/`neutro` | "Agendamento cancelado" |
  | **Carregando por cima** | troca de contexto que bloqueia a tela inteira | enquanto dura, a partir de 120ms | `CarregandoPorCima` | "Abrindo a versão" |
- **Por quê.** Mensagem longe da coisa de que fala não é lida; mensagem que dura mais do que vale vira ruído permanente.
- **Confere.** `crítica:aderência` (o crítico confere o lugar de cada mensagem da revisão contra esta matriz).

### MSG-02 · No máximo uma faixa
- **Regra.** Uma faixa por tela. A segunda condição vira linha da mesma faixa.
- **Por quê.** Duas faixas empilhadas empurram o conteúdo e competem; a pessoa para de ler as duas.
- **Confere.** `crítica:ruído`.

### MSG-03 · Mensagem para quem opera não aparece para quem usa
- **Regra.** Detalhe de máquina — fila, processo, credencial de integração, erro técnico cru, identificador interno — é de quem opera. Para quem usa o app (inclusive o cliente), o mesmo fato vira **o que ele pode fazer** ("não deu para publicar agora; tente em alguns minutos"). Exceção é declarada no projeto, com motivo, e lista exatamente o que passa.
- **Por quê.** Termo técnico na tela do cliente é ruído para ele e exposição para a Wicomm.
- **Confere.** `crítica:aderência` · revisão de texto.

### MSG-04 · Erro mora no bloco que o disparou
- **Regra.** O erro aparece **no bloco** da ação que falhou — nunca só no `title` nativo, nunca só no toast.
- **Por quê.** Toast diz que falhou e não diz onde consertar.
- **Confere.** `guarda:o-erro-de-submissao-alcanca-os-olhos`.

### MSG-05 · Texto de interface não cita documento
- **Regra.** Nada de `SPEC-014`, `ADR 0014`, `§3` em rótulo, dica, erro, e-mail — inclusive no texto que nasce no servidor e chega à tela. Escreva o que a coisa É.
- **Por quê.** Rastreabilidade vive em código, commit e docs; na tela, é ruído que ninguém pode abrir.
- **Confere.** `guarda:o-texto-da-tela-nao-cita-documento` (varredura de padrões `ADR \d`, `SPEC-\d`, `§`).

### MSG-06 · A mensagem que pede uma ação traz a saída
- **Regra.** Toda mensagem que pede uma ação (a faixa, a recusa de um primário) traz a saída consigo e chama **a mesma ação** do menu, não uma cópia. O andamento dela mora no botão que a disparou; disparada de um menu, que fecha, mora no chip da barra. Numa faixa com vários assuntos, uma linha por assunto, na ordem: erro, desfecho de gesto, conexão, prévia, versão, escopo.
- **Por quê.** A mensagem sem saída manda a pessoa caçar o gesto; duas cópias da mesma ação divergem.
- **Confere.** `crítica:clareza da ação`.

---

<a id="pecas"></a>
## 5. A peça de cada função

### PECA-01 · Tabela da peça por função
- **Regra.** Cada função tem **uma** peça, e a coluna "Não use" é defeito:
  | Função | Peça | Não use |
  |---|---|---|
  | Superfície de um assunto | `Card` / `Painel` / `Bloco` | `div` com borda à mão |
  | Agrupar dentro da peça | `BlocoDeTinta` (degrau de tinta) | segunda superfície, filete |
  | Título de bloco | `Secao`, `TopoDoPainel` | `h3` com classe à mão |
  | Esconder o informativo | `Dobra` (dentro de uma peça; numa linha de lista, a própria frase abre), `PainelDobravel` (a peça inteira) | esconder ação disponível |
  | Assunto da janela ou do item, antes da leitura | `MedalhaoDoIcone` (`md` no cabeçalho, `sm` no item; neutro por padrão, `tom` quando a tela diz erro ou recusa — a ausência é neutra, COR-10) | disco com ícone feito à mão |
  | Estado em uma palavra | `ChipDeEstado` (declara `tom`) | `span` colorido |
  | Estado que abre o detalhe | `ChipQueAbre` | `button` à mão em volta do chip |
  | Valor rotulado | `Badge` | chip para valor |
  | Marcador mínimo de voz | `Estado` (`ponto`, `play`) | círculo à mão |
  | O percurso de um objeto (na Mesa) | `TrilhoDoPercurso`: as etapas em ordem, só a atual com `Estado` e `tom`, a feita com o ícone de feito, a que vem sem ponto; a cor de etapa, quando o projeto a declara, entra como `PontoDaEtapa` dentro da estação | `Estado` com `tom` em toda etapa, cor da etapa à mão, `Passos` ou `Progress` para o percurso |
  | Região sem itens | `Vazio`, declarando a causa (`nada-ainda`, `filtro`, `nao-se-aplica`, `nao-informado`) e a saída quando há | ✓ sobre nada, cartão de voz, texto solto |
  | Lista de objetos | `Table` (linha de 40px, cabeçalho `t-coluna` grudado, a linha inteira abre por `LinkDaLinha`) | filete entre linhas, grade de `div` à mão |
  | O topo da tela dentro do casco | `PaginaDoApp` + `TopoDaPagina` (o único que escreve o `h1`) | `h1` e linha de ações à mão em cada tela |
  | A marca no casco e na Entrada | `Logotipo` | imagem ou texto da marca à mão |
  | Conta e tema | `MenuDaConta`, `MenuDoTema` (no pé da barra lateral) | conta ou tema no cabeçalho, `Select` de tema |
  | De quem é o menu, quando o gatilho só tem ícone | `TopoDoMenu`, primeiro filho do menu | repetir o que o gatilho já mostra; rótulo de menu em caixa alta |
  | A IA trabalhando com a conversa fechada | o contorno que corre a borda do botão de IA (`ContornoDaIa`; anel inteiro parado com movimento reduzido) e um `role="status"` escondido que diz começo e fim | ponto ou play ao lado da escrita |
  | Pares rótulo/valor | `Ficha`, `ParDaFicha` | tabela de duas colunas |
  | Número contra teto | `Medidor`, `Medidas` | barra de progresso para cota |
  | Progresso de etapa | `Progress`; `LinhaDeAndamento` para espera de uma linha só, sem etapas conhecidas | indicador girando sem texto |
  | Escolha com mais de dois desfechos e estado no servidor | `DialogLongo` (com `icone`) com o fato num parágrafo e a consequência de cada saída numa lista curta acima do rodapé (`Consequencias`), cada item encabeçado pelo termo do botão; as saídas lado a lado no rodapé (`AcoesDoDialogo`), o terciário como link | `useConfirm` com alternativa |
  | Troca de vista | `BarraDeModos` / `TrilhaDoSeletor` (`seletor-de-vista`) | botões `secondary`/`ghost` alternados |
  | Escolha com imagem | `EscolhaVisual` | radio com imagem à mão |
  | Ajuda curta | `Ajuda` (tooltip) no controle; `AjudaNoTexto` no texto que explica | `title` nativo para coisa importante |
  | Ajuda que não gera decisão | `DicaDeAjuda` (abre no foco e no toque) | texto escondido em hover |
  | Motivo do desabilitado | `ComMotivo` | `title` nativo, botão que some (salvo o gesto recusado pelo estado, PESO-03) |
  | Barra de topo do Editor | `BarraDoEditor`, `GrupoDaBarra`, `GrupoDaPessoa` | linha com `flex-wrap`, barra de duas linhas |
  | Colunas do Editor | `ColunasDoEditor`, `ItemDaEstrutura`, `ItemDoTrilho` (a regra dos 60% medida pela peça) | larguras escritas na tela, estrutura e inspector abertos abaixo do piso |
  | Primário com alternativas | `BotaoDividido` | dois botões soltos, menu sem o primário |
  | Menu de ações | `Menu`, `ItemDoMenu`, `SubmenuDoMenu`, `AncoraDoMenu` | `Popover` com linhas à mão |
  | Trocar de contexto num gesto (o tema, a versão) | `GrupoDeEscolhaDoMenu`: a escolha JÁ é a ação | `Select`, que só vale com *Salvar* |
  | Aviso do Editor sobre o canvas | `FaixaDoEditor` | faixas empilhadas, parágrafo vermelho solto |
  | Ícone de IA | `IconeDaIa`; em botão com cor, `IconeDaIa sobrePreenchido` (branco, sem disco) | ícone cru, disco atrás do ícone, `✦` escrito |
  | Instrução numerada | `Passos` / `Passo`, com a falha dentro do passo | `ol` à mão |
  | Detalhe sob demanda | `Popover` | faixa permanente |
  | Coluna lateral sob demanda | `DialogLateral` | painel `fixed` à mão |
  | Conteúdo alto em janela | `DialogLongo`; tela cheia é `DialogLongo` com `tamanho="tela"` | imagem com teto de altura; camada `fixed inset-0` à mão |
  | Confirmação | `useConfirm` (`confirm-dialog`) | `window.confirm` |
  | Bloquear a tela até uma condição de fora | `DialogLongo` com `bloqueia` (exige o rodapé com a saída) | faixa, cartão no lugar do conteúdo |
  | Rota sem o que mostrar (erro, não encontrado, sem permissão) | `TelaDeErro` (`error.tsx`, `not-found.tsx`), com a saída de quem chama | cartão tracejado |
  | Uma região que falhou, com a tela de pé | `TelaDeErro escala="bloco"` dentro do bloco: sem título nem saída, *Tentar de novo* em `outline sm` | cartão tracejado (tracejada é ausência), a tela de erro de rota no meio da tela |
  | Desfecho depois que o bloco sumiu | `useToast` | toast para erro de formulário |
  | Carregando | `Skeleton` (lugar), `CarregandoPorCima` (troca de contexto) | indicador solto |
- **Por quê.** Uma função com duas peças é a origem de toda deriva visual medida no produto de origem.
- **Confere.** `crítica:consistência` · `guarda:componente-que-ninguem-monta` · `guarda:o-irreversivel-pede-confirmacao`.

### PECA-02 · De onde a peça nova parte
- **Regra.** Peça nova parte do componente equivalente do **shadcn oficial** quando existe (menu ← `DropdownMenu`, botão dividido ← `ButtonGroup`, faixa ← `Alert`, colunas ← `Resizable`; as colunas do Editor são a exceção: `ColunasDoEditor` mede a regra da ARQ-03 e não se redimensiona à mão até um projeto pedir), adaptada aos tokens e à escala da DESIGN e à forma do kit (nome em português, `tom`, motivo no desabilitado). Entra pelo **registro Wicomm**; o projeto a instala com `shadcn add @wicomm/<peça>`. As peças que o kit já tem não são trocadas pelas do catálogo oficial: já são shadcn por baixo e estão ajustadas à escala. Catálogo de terceiros serve só de referência visual: não se copia nem se instala. O crítico julga a peça antes de ela chegar a uma tela.
- **Por quê.** O shadcn já resolveu acessibilidade e comportamento; o que é da Wicomm é a forma. Peça de catálogo de terceiros traz outra marca, outra fonte e padrão de landing page.
- **Confere.** Revisão de arquitetura · `crítica:consistência`.

---

<a id="peso"></a>
## 6. Peso e hierarquia

### PESO-01 · Um primário por tela, e por bloco
- **Regra.** Um primário por tela e um por bloco. A ação que fecha o trabalho de outra região (a conversa) tem o primário dela **dentro** dela, não na barra.
- **Por quê.** Dois primários dividem o olho e nenhum vence.
- **Confere.** `crítica:ação primária`.

### PESO-02 · O peso cresce com a gravidade
- **Regra.** Preenchido conclui; `secondary`/`outline` acompanha; `ghost` não grava; destrutivo é contorno (DESIGN, MARCA-05). O destrutivo não fica ao lado do primário na mesma linha: vai ao menu do objeto de que fala e pede confirmação. O gesto que só **abre** a confirmação destrutiva pode ser `ghost`; quem grava é o botão da confirmação.
- **Por quê.** Destrutivo ao lado do primário disputa o olho e o clique.
- **Confere.** `guarda:o-irreversivel-pede-confirmacao` · `crítica:ação primária`.

### PESO-03 · Gesto recusado não é desenhado; bloqueado à vista é linha com motivo
- **Regra.** O gesto que o servidor **recusa pelo estado do objeto** não é desenhado — nem apagado, nem como linha com o motivo: aparece só o que a função que decide o gesto libera. Fora disso, o gesto bloqueado que fica à vista é **linha com o motivo** (`ComMotivo`), nunca botão grande desabilitado.
- **Por quê.** Oito gestos com sete recusados eram sete controles mortos empurrando para baixo o que funciona; a lista de motivos que veio no lugar o dono do produto recusou ("só aparecer os botões do que dá pra fazer"). Os documentos de origem disseram o contrário por semanas e induziram uma revisão ao erro.
- **Confere.** `crítica:clareza da ação`.

### PESO-04 · Largura é peso
- **Regra.** Coluna que não é a tarefa da tela não passa de **25%** da largura em 1280px.
- **Por quê.** A largura diz ao olho o que importa antes de qualquer leitura.
- **Confere.** `crítica:hierarquia`.

### PESO-05 · Gesto que não grava não disputa o gesto que grava
- **Regra.** Em superfície de **conferência**, a imagem abre inteira — sem teto de altura, sem pan, sem zoom — e quem rola é a página (dentro do casco, a região do arquétipo — LAY-01). Arrastar fica só na **edição**, onde grava valor. Onde a tela empilha outros assuntos, a conferência pode morar numa janela (`DialogLongo`) aberta pela miniatura.
- **Por quê.** Com os dois gestos no mesmo pixel, quem é expulso para outra superfície é o que grava; e teto de altura deixou ~91% de uma imagem alcançável só arrastando.
- **Confere.** `crítica:clareza da ação` · guarda por projeto quando houver componente de conferência.

---

<a id="estados"></a>
## 7. Os estados que toda região declara

### EST-01 · Sete estados por região
- **Regra.** A revisão de arquitetura diz o que **cada região** mostra em cada um: **carregando · vazio · andando · erro · recusa · sucesso · sem permissão**.
- **Por quê.** O estado não desenhado é o que aparece em produção como tela em branco ou spinner eterno.
- **Confere.** Revisão de arquitetura (seção de estados) · `crítica:aderência` · `guarda:a-espera-nao-e-texto-solto` (a espera de imagem tem caixa, não texto solto).

### EST-02 · Vazio diz a causa
- **Regra.** Célula ou região vazia diz **por quê**: *não se aplica*, *não informado*, *não carregou* são três coisas com donos diferentes. Conjunto vazio nunca vira ✓.
- **Por quê.** Um ✓ sobre nada afirma uma conferência que não aconteceu.
- **Confere.** `crítica:aderência`.

### EST-03 · Ação assíncrona tem estado visível
- **Regra.** Todo botão que dispara trabalho mostra: (1) que disparou — vira "rodando", sem clique duplo; (2) sobre **o quê** — os itens marcados na própria lista; (3) o desfecho **sempre**, inclusive "nada mudou" e a falha real; (4) a rodada sobrevive ao F5 (estado no servidor, não em variável de módulo), e rodada cujo processo morreu vira desfecho, não espera eterna.
- **Por quê.** Silêncio depois do clique é lido como "não funcionou", e a pessoa clica de novo.
- **Confere.** `crítica:aderência` · guarda por projeto (quem dispara observa).

### EST-04 · Todos os contadores, e o zero é número
- **Regra.** Uma fileira de contadores mostra **todos** os da fonte, inclusive os zerados. O zero é sempre o número `0`: quando ele não informa nada, sai em `neutro` e o **rótulo** muda para a frase que diz o que o zero quer dizer. O não contado é `—`, também em `neutro`. O tom é do número que pede ação.
- **Por quê.** Mostrar só os diferentes de zero faz a linha mentir por omissão.
- **Confere.** `crítica:aderência`.

### EST-05 · Nenhuma porcentagem única para números com donos diferentes
- **Regra.** Números que pertencem a pessoas ou causas diferentes não se resumem numa porcentagem só; cada um aparece com o seu dono.
- **Por quê.** A porcentagem única esconde de quem é a próxima ação.
- **Confere.** `crítica:hierarquia`.

---

<a id="movimento"></a>
## 8. O que se move

### MOVA-01 · O que entra se move, e onde
- **Regra.** Coluna lateral desliza com `duration-painel`; popover e menu abrem com `duration-menu-abre ease-abre`; dobra com `duration-dobra-abre`; diálogo com `duration-modal-abre`. Mudança de estado só troca a cor. O canvas não anima ao trocar de item: rola até ele. Tudo com o escape de movimento reduzido (DESIGN, MOV-02).
- **Por quê.** Cada região tem um movimento só, e a pessoa aprende o que cada movimento quer dizer.
- **Confere.** `guarda:o-movimento-tem-escape` · `crítica:ruído`.

---

## Índice das regras

| Código | Regra | Confere |
|---|---|---|
| PRIN-01 | Uma tela, uma tarefa | crítica |
| PRIN-02 | O canvas é sagrado | crítica |
| PRIN-03 | Avançado não é ausente | crítica |
| PRIN-04 | Dado sem ação é ruído | crítica, revisão |
| PRIN-05 | Componente antes de layout | guarda, crítica |
| PRIN-06 | Token ou não existe | guarda |
| CASCO-01 | Regiões do casco | registro, guarda, crítica |
| CASCO-02 | Um menu só, o do kit | guarda |
| CASCO-03 | Tela de detalhe tem trilha | guarda |
| ARQ-01 | Cinco arquétipos | revisão, auditoria, crítica |
| ARQ-02 | Análise é Lista com medidores | crítica |
| ARQ-03 | O Editor, região por região | registro, crítica |
| ARQ-04 | Linha que se reordena | crítica |
| MSG-01 | A matriz das mensagens | crítica |
| MSG-02 | No máximo uma faixa | crítica |
| MSG-03 | O técnico não chega a quem usa | crítica |
| MSG-04 | Erro no bloco que disparou | guarda |
| MSG-05 | Texto de interface não cita documento | guarda |
| MSG-06 | A mensagem traz a saída | crítica |
| PECA-01 | A peça de cada função | crítica, guarda |
| PECA-02 | De onde a peça nova parte | revisão, crítica |
| PESO-01 | Um primário | crítica |
| PESO-02 | O peso cresce com a gravidade | guarda, crítica |
| PESO-03 | Recusado não aparece; bloqueado é linha | crítica |
| PESO-04 | Largura é peso | crítica |
| PESO-05 | Gesto que não grava não disputa | crítica |
| EST-01 | Sete estados por região | revisão, crítica, guarda |
| EST-02 | Vazio diz a causa | crítica |
| EST-03 | Ação assíncrona visível | crítica, guarda |
| EST-04 | Todos os contadores, zero é número | crítica |
| EST-05 | Sem porcentagem única | crítica |
| MOVA-01 | O que entra se move | guarda, crítica |
