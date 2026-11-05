# Revisão de arquitetura: os recortes contados no topo da Lista (F399)

Escopo: o slot novo **`resumo`** do **`TopoDaPagina`** (`packages/registro/registry/design-system/ui/topo-da-pagina.tsx`), a documentação da **`BarraDeModos`** (`ui/seletor-de-vista.tsx`) e as regras que mudam ou nascem na base: **CASCO-01**, **ARQ-01** e **PECA-01** mudam; **ARQ-05**, **PECA-03** e **EST-06** nascem. Também a demo do ateliê (`apps/atelie/src/catalogo/demos/topo-da-pagina.tsx`). Esta revisão não escreve código de peça.

**Origem.** Um app consumidor montou à mão uma fileira *"Pedem atenção"* de contadores clicáveis que recortam a lista. Ficou entre o desfecho e os filtros do topo: uma `div` com um `span` em `t-rotulo` e uma `BarraDeModos rotulo="Pedem atenção" densidade="modos"`, em que o valor nulo quer dizer *sem recorte*. É o arranjo à mão que a PRIN-05 proíbe, e a base não tinha lugar para ele. A proposta do operador (K6 a K12) foi o ponto de partida. Os pontos onde esta revisão discorda estão marcados com **≠**.

**O que foi lido** (código de hoje, só leitura):

- **O bloco da Lista já tem contagem no topo.** O `blocks/lista/lista-de-pedidos.tsx` põe nos `filtros` uma `BarraDeModos` em **`abas`** (*Fila*). Ela **reparte** o conjunto: cada pedido está numa aba só, uma aba está sempre escolhida e a busca a anula (`valor={termo ? null : modo}`). Ao lado fica a busca. O recorte que se sobrepõe é outra coisa e **vai conviver** com essa partição na mesma tela. Por isso a fileira tem de se distinguir dela pela forma e pela posição (ver *Hierarquia*).
- **A `BarraDeModos` já faz quase tudo.** Ela já aceita `numero` (`0` desenha `0`; `null` desenha o travessão numérico `‒`, U+2012, da largura de um algarismo, e o nome acessível diz *sem contagem*), aceita `tom` só acima de zero e aceita `valor: T | null`. Em `modos`, o grupo é `role="group"` com `aria-label={rotulo}`, e cada item é um `button` com `aria-pressed`. O que falta é **desligar ao clicar de novo**: hoje `onTrocar` recebe só a chave. O comentário de `numero` diz que `null` desenha `—` (travessão longo), mas o código desenha `‒`.
- **A `Faixa` já tem o assunto `escopo`** (`ui/faixa.tsx`, com o ícone de filtro, na ordem da MSG-06). Ela guarda **uma linha por assunto**: duas linhas de `escopo` viram uma, e a segunda some (`new Map(...)` pela chave do assunto).
- **O kit não tem peça de gráfico.** A peça mais próxima é o `Medidor` (número contra teto).
- **Medidas do topo** (das classes): a linha do título tem `min-h-9` (36px). A trilha das `abas` mede 36px (30 do item + 3 + 3) e a dos `modos` mede 30px (24 + 3 + 3). Entre as linhas do topo há `gap-1.5`, e os filtros têm `mt-1.5`, o que dá 12px antes deles.
- **Nada renderizado.** O slot não existe ainda e a tela do consumidor não está neste repositório. A conferência visual é do crítico, no ateliê, depois da peça (*O que o crítico confere*).

## Tarefa

Quem abre uma Lista **vê de relance quantos itens estão em cada situação que pede atenção e recorta a lista para uma delas com um clique**, sem perder os filtros que já escolheu. Depois volta a ver tudo, clicando de novo.

## Quem e onde

- **Papel:** quem opera listas de trabalho (pedidos, chamados, itens), a pessoa que abre a Lista para decidir o que atacar primeiro. A peça é da base; o papel concreto é do PRODUCT de cada projeto.
- **Largura:** 1280px de referência (o kit não tem `design/design-system.json`; vale o padrão da skill). Com a barra lateral aberta (224px) e o respiro de 24px de cada lado, sobram **~1008px** para o topo. Esse é o pior caso.
- **Frequência:** toda vez que a Lista abre, várias vezes por dia. O recorte é o gesto mais repetido do topo depois da busca.
- **Densidade:** instrumento (DENS-01). Em site, a voz do rótulo seria outra (ver D5).
- **Arquétipo:** **Lista** (ARQ-01), e **não arquétipo novo** (concordo com o K7). A pergunta da tela continua sendo *o que pede a minha atenção?*, e a fileira é a resposta dela no topo. Não é painel de análise (ARQ-02): não pergunta *quanto* nem *como evoluiu*, e cada número é um gesto que recorta, não um medidor.

## Inventário

| o quê | onde | decisão que gera | frequência | veredito |
|---|---|---|---|---|
| Rótulo da fileira (*Pedem atenção*) | início da fileira, `t-rotulo` | diz que os botões ao lado são situações sobrepostas, não mais uma partição como a *Fila* logo acima. Sem ele, *Atrasados 3* lê como outra aba | toda abertura | **fica**. A mesma string é o nome do grupo (uma fonte só, D1) |
| Nome de cada recorte | o botão | qual situação olhar | toda abertura | **fica** |
| Contagem de cada recorte | no botão, depois do nome, `t-medida` (já é da peça) | qual situação atacar primeiro, ou se dá para ignorar | toda abertura | **fica** |
| Voz do número | o número, `COR_DO_TOM_DENSO`, só acima de zero | o que pede você (`espera`), o que quebrou (`ruim`), o que está com outra pessoa (`alheio`) | toda abertura | **fica**. `ok` não entra: o que acabou bem não pede atenção (COR-03) |
| Zero | `0` em `muted-foreground` | *nada aqui*. Esconder o zero faria a fileira mentir por omissão | comum | **fica** (EST-04). O rótulo do recorte **não** muda no zero, porque aqui o zero informa. Ver *Estados* |
| Não contado | `‒` em `muted-foreground` | *ainda não sei*. Não se confunde com o zero | ao carregar | **fica** (EST-04) |
| Recorte ativo | pílula + texto 650 (`aria-pressed`) | o que a lista está mostrando agora | a cada recorte | **fica** |
| Total (*12 pedem atenção*) | (proposta comum) | nenhuma: as situações se sobrepõem, a soma mente e a união é outra pergunta | — | **sai** |
| Cartão de indicador, número grande, gráfico (pizza, barra empilhada, tendência) | (proposta comum) | nenhuma que a fileira não dê: dá peso de tela de análise a um gesto de recorte | — | **sai** (ARQ-05, PECA-03) |
| Porcentagem (*15% atrasados*) | (proposta comum) | nenhuma: esconde de quem é a próxima ação | — | **sai** (EST-05) |
| *Limpar recorte* como botão separado | (proposta comum) | duplica o clicar de novo e a saída do vazio | — | **sai**. Desliga-se clicando de novo; o *Limpar filtros* e o vazio levam o recorte junto |
| Sinal do recorte na linha | numa célula própria da linha (o `Prazo` com `tom`, a `Pessoa` ausente, o `ChipDeEstado`) | confere por que a linha está no recorte; com recortes sobrepostos, mostra os outros em que ela também entra | toda linha | **fica**. É dado da linha, não coluna nova de etiquetas: não some com o recorte ativo |
| *N ficaram de fora desta vista* | `Faixa`, assunto `escopo` | os itens que a vista não desenha existem, e a saída leva a vê-los | quando a vista omite | **sob demanda**: a linha só existe com N > 0 (EST-06) |

## Hierarquia e peso

Primário da tela: o do topo (`primario`, `lg`), que não muda. A fileira **não tem primário**: são gestos de vista, terciários em peso de controle. O que ela tem de forte é **a voz do número**, a única cor do topo de uma Lista além do estado. É intencional: o número com voz é o que pede ação (EST-04).

**A ordem do topo, de cima para baixo** (≠ proposta): trilha → título, estado e ações → valores → desfecho → **filtros** → **resumo**.

- **O resumo vem depois dos filtros, não antes.** A contagem conta **o que os filtros mostram** (ver *Regiões*, a regra da contagem), e quem lê de cima para baixo precisa ver primeiro o que define o conjunto, depois quanto dele está em cada situação, depois a lista. Acima dos filtros, *Atrasados 3* se leria como um número da tela inteira. A pessoa trocaria a *Fila* e veria o 3 mudar sem entender por quê. Com o resumo logo acima da lista, o recorte também fica encostado no que ele recorta.
- O desfecho continua logo abaixo do título, perto das ações que o geram.

**Peso de cada linha a 1280px** (Lista sem trilha e sem valores):

| linha | altura | o que se lê primeiro |
|---|---|---|
| título + primário | 36px | o nome da lista |
| (12px) | | |
| filtros: *Fila* em `abas` + busca | 36px | a partição (texto 13px, trilha mais alta) |
| (12px) | | |
| resumo: rótulo + recortes em `modos` | 30px | os números com voz |
| (24px, `gap-6` da página) | | |
| lista (`Painel`) | o resto | |

O topo inteiro mede **~126px**. Num notebook de 720px de altura útil, a lista começa por volta de 175px da borda de cima, e o topo continua parado (LAY-01).

**Como a fileira se separa da *Fila*:** pela altura (30 × 36px), pelo corpo (12 × 13px), pelo rótulo visível em `t-rotulo` (a *Fila* não tem rótulo visível) e pela posição (linha própria, abaixo). A matiz não entra nessa separação. O crítico confere as duas lado a lado no ateliê.

**Largura:** a fileira cabe **numa linha** nos ~1008px. Com o rótulo (~100px) e botões de ~80 a 130px, cabem 6 ou 7 recortes. Se não cabe, são recortes demais, e a regra (ARQ-05) diz isso em vez de deixar quebrar a linha.

## Mensagens

| mensagem | lugar | duração | tom | quem vê |
|---|---|---|---|---|
| A contagem de cada recorte (*Atrasados, 3*) | no botão do recorte, e no nome acessível dele | enquanto vale; troca sem anúncio a cada recontagem | a voz do recorte acima de zero; `neutro` no zero | todos os que veem a lista |
| *sem contagem* (`‒`) | no botão, e no nome acessível | até a contagem chegar | `neutro` | todos |
| *Nada em "Atrasados" agora* | `Vazio causa="filtro"` na região da lista, com a saída *Ver todos* (desliga o recorte: a **mesma** ação do clicar de novo, MSG-06) | enquanto vale | `neutro` | todos |
| *Nenhum pedido com estes filtros* (recorte + outros filtros) | `Vazio causa="filtro"`, saída *Limpar filtros*, que leva o recorte junto | enquanto vale | `neutro` | todos |
| *3 pedidos sem data não aparecem no calendário* + *Ver em lista* | `Faixa`, assunto `escopo` (MSG-01, a tela mente se a pessoa não souber), entre o topo e a região que rola | enquanto vale; some no zero | `neutro` | todos |
| A lista não carregou | `TelaDeErro escala="bloco"` na região da lista (como hoje) | até *Tentar de novo* | `ruim` | todos |

Nenhum texto cita regra, spec ou documento (MSG-05). Os textos acima são exemplo genérico. O de cada projeto segue a skill `textos-de-interface` (MSG-07: *Ver todos* e *Ver em lista* dizem o lugar a que levam).

## Regiões e componentes

Nenhuma peça nova. O `TopoDaPagina` ganha um slot, e a `BarraDeModos` muda só a documentação.

### (a) `TopoDaPagina`: o slot `resumo`, tipado (≠ K6)

```ts
type ResumoDoTopo<R extends string> = {
  /** O nome da fileira: escrito à vista em `t-rotulo` e nome do grupo, da mesma string. */
  rotulo: string
  /** TODOS os recortes da fonte, na ordem da fonte, com `numero` (`null` enquanto conta) e `tom`. */
  recortes: ReadonlyArray<ModoDoSeletor<R>>
  /** `null`: sem recorte. */
  valor: R | null
  /** Recebe a chave do recorte clicado, ou `null` quando se clica no ativo. */
  onTrocar: (chave: R | null) => void
}

function TopoDaPagina<R extends string = string>(props: { …; filtros?: ReactNode; resumo?: ResumoDoTopo<R> }): JSX.Element
```

- **A peça monta a fileira.** Quem chama não passa um `ReactNode`, como na proposta (`{ rotulo, conteudo }`). Passa os dados, e o `TopoDaPagina` desenha `<span aria-hidden className="t-rotulo …">{rotulo}</span>` e `<BarraDeModos rotulo={rotulo} densidade="modos" …/>`. Três motivos:
  1. **Uma fonte só para o rótulo** (CONV-15). Com o `ReactNode`, o texto visível e o `rotulo` da `BarraDeModos` são duas strings que quem chama tem de manter iguais. O `aria-hidden` no visível só é honesto enquanto elas concordarem.
  2. **O slot não aceita cartão de indicador, número grande nem gráfico.** O tipo cumpre a ARQ-05 sem guarda nova.
  3. **A alternância mora num lugar só** (ver (b)).
- **Lugar e forma:** depois de `filtros`, `data-slot="resumo-do-topo"`, `mt-1.5 flex min-w-0 items-center gap-2`. O rótulo é `t-rotulo shrink-0` (a cor vem da voz, `foreground-2`). São só tokens e classes da escala (PRIN-06).
- **Abaixo de `sm`:** `max-sm:flex-col max-sm:items-start max-sm:gap-1.5`. O rótulo vai para a linha de cima e **só a barra rola na horizontal**, num invólucro `max-w-full overflow-x-auto` (≠ proposta, em que o rótulo rolava junto e sumia). Ver *Estados*, o estreito.
- **Sem `resumo`, a linha não existe.** Sem variantes.
- `ResumoDoTopo` é exportado. O item `topo-da-pagina` do registro passa a depender de `seletor-de-vista`.

### (b) A alternância: dentro do `TopoDaPagina`, sem mudar a API da `BarraDeModos` (≠ K8)

- O slot liga `onTrocar` da barra a `(k) => resumo.onTrocar(k === resumo.valor ? null : k)`. Clicar no ativo desliga. Clicar noutro troca: **um recorte por vez**.
- A `BarraDeModos` **não ganha prop nova**. A alternância só tem sentido nos recortes, e os recortes só moram no slot (ARQ-05). Uma prop `desligavel` na barra abriria o mesmo gesto fora do topo, que é o arranjo que esta revisão fecha.
- **Semântica:** `role="group"` com nome e itens `aria-pressed`. É o padrão de botões que alternam, e o leitor anuncia *pressionado* e *não pressionado* sem texto a mais.

### (c) `BarraDeModos`: só a documentação (K8, ajustado)

O JSDoc diz qual densidade serve a quê:

- **`abas`** quando as situações **repartem** o conjunto: cada item numa só, uma sempre escolhida (salvo a busca que cruza), as contagens somam o todo. É a *Fila* do bloco da Lista.
- **`modos`** troca o **desenho** do mesmo conteúdo (lista, quadro, calendário). Dentro do `resumo` do `TopoDaPagina`, `modos` também serve aos **recortes que se sobrepõem**, com o valor nulo e o clicar de novo que desliga, que a peça do topo monta. Fora dele, recorte contado é defeito (PECA-01).
- O comentário de `numero` passa a dizer o que o código desenha: *"`null` desenha `‒`, o travessão numérico (o não contado)"*.

### (d) A regra da contagem (é da ARQ-05; quem cumpre é o app)

- **O que cada número conta:** os itens que **os filtros** mostram (a *Fila*, a busca, o responsável) **e** que caem no recorte. O número **não** muda com o recorte ativo: com *Atrasados* ligado, *Sem responsável* continua contando sobre o conjunto dos filtros, não sobre a interseção. Se mudasse, os números da fileira mudariam a cada clique e nenhum diria o tamanho da situação.
- **Um predicado por recorte**, o mesmo para contar e para recortar (CONV-15). O app tem uma função `(item) => boolean` por recorte, e a contagem é `filtrados.filter(p).length`. Contagem feita no servidor usa o mesmo predicado lá, num lugar só. Um teste do app compara a contagem com o tamanho da lista recortada.
- **O recorte soma com os filtros** (os dois valem juntos), mora no endereço (CONV-06, escrito pela função única do projeto, `replaceState(null, …)`) e **conta como filtro ativo**: o *Limpar filtros* o leva, e a lista vazia diz `filtro` (EST-02).
- **Chave desconhecida no endereço** (um recorte que deixou de existir, um link antigo): vale como sem recorte, e o endereço se reescreve sem ela.
- **O recorte que coincide com uma aba da partição não entra na fileira:** ele é a aba. Uma fileira *Pedem você* ao lado de uma aba *Pedem você* é o mesmo gesto em dois lugares.
- **O recorte que não gera ação para o papel** (PRIN-04) não aparece para ele. *Todos os da fonte* (EST-04) quer dizer todos os do papel.

### (e) As regras que mudam (texto proposto)

Versão da base: **0.22.0 → 0.23.0** nos três arquivos. Há regra nova e mudam regras existentes; a API do registro não quebra.

**ANATOMIA, CASCO-01**, na célula *o que mora* do **Topo da página**, acrescentar ao fim: *"…, o primário da tela; na Lista, os filtros que valem para a tela inteira e, abaixo deles, os recortes contados (ARQ-05)"*.

**ANATOMIA, ARQ-01**, na linha **Lista**, coluna *Regiões*: *"topo (título + filtro global + primário; os recortes contados abaixo dos filtros, quando a atenção se divide em situações que se sobrepõem, ARQ-05) · lista ou quadro (…) · vazio"*.

**ANATOMIA, ARQ-05 (nova)**, depois da ARQ-04:

> ### ARQ-05 · O que pede atenção em situações que se sobrepõem é uma fileira de recortes contados
> - **Regra.** Quando a pergunta da Lista se responde por situações que **se sobrepõem** (atrasado, sem responsável, parado: um item pode estar em várias), o topo leva uma fileira de recortes contados no `resumo` do `TopoDaPagina`, **abaixo dos filtros**: o nome da fileira e um botão por situação, com o nome e a contagem. É **um recorte por vez**: clicar de novo desliga, e sem recorte a lista mostra tudo o que os filtros mostram. O recorte vale junto com os filtros, mora no endereço (CONV-06) e conta como filtro ativo: o *limpar* o leva, e a lista vazia diz `filtro` (EST-02). Cada número conta o que os filtros mostram e cai no recorte, pelo **mesmo predicado** que recorta a lista (CONV-15), e não muda com o recorte ativo. Todos os recortes do papel aparecem, o zero inclusive (EST-04). **Não há total:** as partes se sobrepõem e não somam. O tom do número é a voz que a situação pede (COR-03), só acima de zero, e `ok` não entra. A linha mostra, numa célula dela (o prazo, a pessoa, o estado), o sinal de cada recorte em que entra. A situação que **reparte** o conjunto é a `BarraDeModos` em `abas` dos filtros, e o recorte que coincide com uma aba não se repete. O peso vem da posição e da voz do número, não do tamanho: nada de cartão de indicador, número grande ou gráfico (PRIN-04, COR-10), e *quanto* e *como evoluiu* são de outra tela (ARQ-02). A fileira cabe numa linha na largura de referência com a barra lateral aberta; se não cabe, são recortes demais.
> - **Por quê.** Sem lugar na base, a fileira foi montada à mão no topo de uma Lista, com o rótulo e o nome do grupo em duas strings que podiam divergir. O número fora do predicado da lista promete uma quantidade e entrega outra. O total de situações que se sobrepõem conta o mesmo item duas vezes. E o cartão de indicador dá peso de análise a um gesto que só recorta.
> - **Confere.** Peça `TopoDaPagina` (registro, slot `resumo`: a alternância, o zero, o `‒` e o nome do grupo em teste) · `crítica:hierarquia` · `crítica:aderência`.

**ANATOMIA, PECA-01**, linha nova logo depois de *Troca de vista*:

> | Recortes contados da lista (situações que se sobrepõem) | `resumo` do `TopoDaPagina` (a peça monta a `BarraDeModos` em `modos`, com `numero` e `tom`, e o clicar de novo que desliga; ARQ-05) | cartão de indicador, número grande, gráfico, total, `BarraDeModos` com recortes solta no topo ou no corpo, chip clicável à mão |

E, na linha *Troca de vista*, a coluna *Peça* ganha *"(`abas` quando reparte o conjunto; o recorte que se sobrepõe é a linha abaixo)"*.

**ANATOMIA, PECA-03 (nova)**, depois da PECA-02:

> ### PECA-03 · O gráfico desenha a forma que o dado tem
> - **Regra.** O gráfico entra só quando responde uma pergunta que o número escrito não responde (comparar muitas partes de um todo, ver uma tendência) e quando o dado tem a forma que o desenho afirma. Contagens que se sobrepõem não viram pizza nem barra empilhada: as partes não somam o todo. Tendência só se desenha com o histórico gravado; a série não se reconstrói para trás a partir do estado de hoje. Número contra teto é o `Medidor`. O kit ainda não tem peça de gráfico: o primeiro entra pelo registro (PECA-02), julgado por esta regra.
> - **Por quê.** A pizza de partes sobrepostas passa de 100% ou esconde a sobreposição, e a curva reconstruída inventa o passado. Os dois desenhos parecem dado e não são.
> - **Confere.** Revisão de arquitetura · `crítica:aderência`.

**ANATOMIA, EST-06 (nova)**, depois da EST-05:

> ### EST-06 · A vista que deixa itens de fora diz quantos
> - **Regra.** Quando a vista escolhida não consegue desenhar parte do conjunto que os filtros e o recorte mostram (o calendário, os itens sem data; o mapa, os sem endereço), a tela diz **quantos ficaram de fora** numa linha da `Faixa` (assunto `escopo`, `neutro`, MSG-01), com a saída para a vista que mostra todos **sem desfazer o recorte nem os filtros** (MSG-06). Com zero de fora, a linha não existe. A paginação, que já diz a parte, não conta.
> - **Por quê.** A vista que omite em silêncio mente como o contador que some no zero (EST-04): o topo diz 7, o calendário mostra 4, e a pessoa conclui que os outros 3 não existem. Na vista que mostra todos, o vazio dos sem data diz a causa (EST-02).
> - **Confere.** `crítica:aderência`.

Por que na **Faixa**, e não numa linha da região da vista: a MSG-01 já tem o lugar (*"a tela inteira mente se a pessoa não souber … num escopo diferente do normal"*, com a saída na própria faixa) e a peça já tem o assunto `escopo`. Uma linha nova na vista seria a peça que falta montada à mão (PRIN-05).

**Índice da ANATOMIA:** ARQ-05, PECA-03 e EST-06, nas posições delas.

**`docs/rastreio/origens-da-base.md`:** uma linha para cada regra nova, com a origem *"fileira de recortes montada à mão no topo de uma Lista de um app consumidor; revisão F399 (`docs/design/revisoes/2026-11-05-F399-topo-com-resumo.md`), 05/11/2026"*. Também acrescentar *"Os recortes contados · F399, 05/11/2026"* às linhas de CASCO-01, ARQ-01 e PECA-01.

**Registro:** a descrição do `topo-da-pagina` em `packages/registro/lib/itens.mjs` ganha *"…, os filtros e os recortes contados (CASCO-01, CASCO-04, ARQ-05)"*, e o `pecas` dele ganha `'seletor-de-vista'`. O `registry.json` e o `README.md` do registro são regenerados.

**`CHANGELOG.md`:** entrada `0.23.0`, *Camadas: base, registro*. Em *O que muda*: o slot `resumo`, as três regras novas e a ordem do topo. Em *Migração*: `npx shadcn add <registro>/topo-da-pagina.json`; trocar a fileira montada à mão pelo `resumo` (passar `rotulo`, `recortes`, `valor` e `onTrocar` com `null`); apagar a alternância local.

**Ateliê** (`demos/topo-da-pagina.tsx`), amostras novas, todas com título *Pedidos*, o primário, os `filtros` com a *Fila* em `abas` e a busca, e o `resumo` com quatro recortes (*Atrasados* `espera`, *Sem responsável* `espera`, *Bloqueados* `ruim`, *Com outra equipe* `alheio`):

1. *"Os recortes contados, abaixo dos filtros"*: um recorte ativo, um zero e o resto com número. É interativa (estado local), para clicar de novo e desligar.
2. *"Nada pede atenção: todos os zeros"*.
3. *"Contando: o travessão numérico"*: `numero: null` em todos.
4. *"Sem recorte"*: `valor: null`.

## Estados

| estado | o que a fileira mostra | o que a lista mostra |
|---|---|---|
| **Carregando** | o rótulo e todos os botões, com `‒`. Os recortes da fonte são conhecidos antes dos dados (são do app), então não há esqueleto: a fileira nasce na altura e quase na largura final. Clicar já recorta (grava no endereço), e a lista recortada chega com os dados | a espera da lista (`EsperaDaLista`) |
| **Pronto** | os números; voz só acima de zero | as linhas do recorte, cada uma com o sinal na célula dela |
| **Todos zero** | `0` em todos, em `muted-foreground`, sem voz. **O rótulo e os nomes não mudam:** aqui o zero informa (*nenhum atrasado*), então a troca de rótulo da EST-04, que é para o zero que não informa, não se aplica. Trocar faria o nome do grupo e a largura da linha mudarem | a lista dos filtros, sem recorte |
| **Recorte cujo número é zero** | o botão continua clicável (não há gesto recusado, PESO-03: é só uma vista) | `Vazio causa="filtro"`, *Nada em "Atrasados" agora*, saída *Ver todos* |
| **O recorte ativo cai a zero** (os itens se resolveram) | o recorte **continua ativo**: quem o escolheu foi a pessoa | o mesmo vazio com a saída. Desligar sozinho trocaria a lista sem gesto |
| **Vazio de verdade** (`nada-ainda`) | `0` em todos, como no *todos zero* | `Vazio causa="nada-ainda"` |
| **Andando** (recontagem por atualização ou tempo real) | o número anterior fica até o novo chegar. Não volta a `‒`, porque só o que nunca foi contado é `‒` | a lista atualiza |
| **Erro da lista** | `‒` em todos (nada foi contado) | `TelaDeErro escala="bloco"` com *Tentar de novo* |
| **Erro só da contagem** (quando ela vem de outra consulta) | `‒` nos que não vieram; o recorte continua funcionando. Contar pela mesma carga da lista (d) elimina este estado | a lista, recortada |
| **Recusa / sucesso** | não há: o recorte não grava nada no servidor | — |
| **Sem permissão** | a Lista inteira é `TelaDeErro` de rota; a fileira não existe. O recorte que o papel não pode usar não aparece (d) | — |
| **Abaixo de `sm`** | o rótulo numa linha e a barra embaixo, rolando na horizontal. Ao montar, o recorte ativo vem para a vista rolando só a barra (`scrollLeft` do invólucro, e só quando ela não cabe; `scrollIntoView` rolaria a página também), sem animação. O anel de foco (2px + 1px de vão) cabe no respiro de 3px da trilha e não é cortado pela rolagem. O último botão cortado na borda é o aviso de que há mais | a lista |
| **Leitor de tela** | o grupo *Pedem atenção*, e cada botão *Atrasados, 3, pressionado* ou *não pressionado*. A recontagem **não** é anunciada: seria ruído a cada atualização. O número já está no nome do botão quando a pessoa chega nele | — |
| **Teclado** | Tab passa por cada recorte (é `group`, não `tablist`: sem setas). Espaço ou Enter liga ou desliga | — |

**Testes que a dona escreve** (registro, `node --test` com DOM, no arquivo de teste das peças do topo):

1. Com `resumo`, existe `[data-slot="resumo-do-topo"]`. Sem `resumo`, não existe. A presença se prova antes da ausência (CONV-24).
2. O rótulo visível tem `aria-hidden`, e `getByRole("group", { name: rotulo })` acha a barra. A mesma string está nos dois.
3. Clicar num recorte inativo chama `onTrocar("atrasados")`; clicar no ativo chama `onTrocar(null)`.
4. `numero: 0` desenha `0` sem classe de voz, mesmo com `tom`; `numero: null` desenha `‒` com o nome acessível *…, sem contagem*.
5. No DOM, `filtros-do-topo` vem **antes** de `resumo-do-topo`.
6. O `pecas` do item `topo-da-pagina` inclui `seletor-de-vista` (o teste de concordância do registro já cobra o import).

## Movimento

- **A pílula desliza** de um recorte a outro pela peça (`transition-[transform,width] duration-painel ease-abre`). Com `prefers-reduced-motion`, não anda (`motion-reduce:transition-none`, já na peça).
- **Ligar a partir de nenhum e desligar** não animam: a pílula nasce e some no lugar, sem deslizar a partir da borda.
- **O número troca sem animação.** Contagem que sobe dígito a dígito é enfeite e atrasa a leitura.
- A contagem que passa de `‒` (1 algarismo) para um número de 2 ou 3 algarismos alarga o botão, e a pílula, se estiver nele, reacompanha pela medida. Fica aceito: acontece uma vez, ao carregar.
- A linha da `Faixa` (EST-06) entra e sai como a peça já faz.

## O que sai

- **Do app consumidor** (não é deste item: o kit não grava em repositório de outro projeto; vai na migração do CHANGELOG): a `div data-slot="resumo-do-topo"` à mão, o `span` do rótulo, a `BarraDeModos` passada como conteúdo e a alternância local (`k === valor ? null : k`).
- **Da proposta:**
  - o `conteudo: ReactNode` do slot (D1);
  - o lugar entre o desfecho e os filtros (D2);
  - a `PRIN-06` como fundamento do *"sem cartão de indicador"*: ela é a do token. O fundamento é PRIN-04, COR-10 e ARQ-02;
  - a docstring que fazia a `BarraDeModos` servir a recortes fora do topo (o recorte só mora no slot).
- **Da fileira:** o total, a porcentagem, o cartão de indicador, o número grande, o gráfico e o *Limpar recorte* separado.
- **Do registro:** o comentário de `numero` que diz `—` onde o código desenha `‒`.

## Decisões ao operador

**D1 · O slot `resumo` recebe os dados da fileira, não um `ReactNode`**: *assumida, a confirmar*

- **O caso:** na proposta, quem chama passa o rótulo e a barra pronta. O texto escrito na tela e o nome que o leitor de tela ouve ficam em duas strings, e o slot aceitaria qualquer coisa: um cartão de indicador, um gráfico.
- **Se não decidir:** vale esta revisão. O `TopoDaPagina` recebe `{ rotulo, recortes, valor, onTrocar }` e monta a `BarraDeModos`.
- **Recomendação:** os dados. O tipo cumpre a regra sem guarda nova, o rótulo tem uma fonte só e a alternância mora num lugar. O custo: uma fileira que não seja `BarraDeModos` (nenhuma prevista) pede uma mudança na peça, que é o caminho certo (PRIN-05).

**D2 · O resumo vai abaixo dos filtros, não entre o desfecho e os filtros**: *assumida, a confirmar*

- **O caso:** a contagem precisa contar o que os filtros mostram. Se contasse a tela inteira, *Atrasados 3* recortaria uma lista já filtrada e mostraria 1, e o número mentiria. Acima dos filtros, o número parece da tela inteira e muda quando a pessoa troca a *Fila*, sem explicação à vista.
- **Se não decidir:** vale esta revisão: filtros, depois resumo, depois a lista.
- **Recomendação:** abaixo. A leitura fica *o conjunto → quanto dele em cada situação → as linhas*, e o recorte encosta no que recorta. O app consumidor muda a ordem na migração.

**D3 · O desligar ao clicar de novo fica no `TopoDaPagina`, e a `BarraDeModos` não ganha prop**: *assumida, a confirmar*

- **O caso:** o K8 previa documentar na barra que `modos` serve a recortes com alternância. Isso convida cada tela a escrever a própria alternância, e a usar a barra como recorte fora do topo.
- **Se não decidir:** vale esta revisão: a barra só ganha a documentação, e a alternância é do slot.
- **Recomendação:** no slot. Se um dia outro lugar pedir recorte contado (não há caso hoje), a regra muda antes, e a prop nasce com ela.

**D4 · Os itens que a vista deixa de fora (EST-06) moram na `Faixa`, assunto `escopo`**: *assumida, a confirmar*

- **O caso:** o K12 não dizia o lugar. A matriz já tem a `Faixa` para *escopo diferente do normal*, e a peça já tem o assunto. **Atenção:** a `Faixa` guarda uma linha por assunto. Se a tela já mostra outra linha de `escopo`, as duas condições têm de virar uma frase só, ou a segunda some.
- **Se não decidir:** vale a `Faixa`. O consumidor que já usa uma linha de `escopo` junta as frases.
- **Recomendação:** a `Faixa`. Se juntar frases ficar ruim no primeiro caso real, o conserto é a `Faixa` aceitar duas linhas do mesmo assunto, num item próprio, e não uma linha à mão na vista.

**D5 · A fileira nasce só com a voz de instrumento**: *assumida, a confirmar*

- **O caso:** o rótulo em `t-rotulo` (caixa alta, condensado) é voz de sistema, que a densidade site evita (DENS-02). Ali o rótulo seria `t-campo`. O `TopoDaPagina` não recebe densidade hoje.
- **Se não decidir:** o slot sai com `t-rotulo`, e uma Lista em densidade site que use recortes fica com a voz de instrumento.
- **Recomendação:** aceitar assim neste item: recorte contado é coisa de quem opera listas o dia todo. A primeira tela site que pedir a fileira acrescenta a densidade à peça, com revisão.

## O que o crítico confere

1. As três regras novas e as três mudadas estão na base com **Regra · Por quê · Confere**, no índice e no rastreio, e a versão é 0.23.0 nos três arquivos. Nenhuma frase cita produto, marca nem domínio de origem (o gate da base cobra).
2. No ateliê, **claro e escuro**, a 1280px: a fileira (30px, 12px, rótulo visível) se separa da *Fila* (36px, 13px) logo acima e não se lê como uma segunda fileira de abas. Os números com voz são o único matiz do topo e não disputam com o primário.
3. Os zeros e os `‒` lado a lado: distinguíveis, os dois em `muted-foreground`. A pílula sobre um recorte com zero não pinta o número.
4. O recorte ativo se lê pelo texto (650 + `foreground`) antes da pílula (CTRL-06).
5. A 375px: o rótulo em cima, a barra rolando, o ativo à vista ao abrir, o foco inteiro em cada botão.
6. Teclado e leitor: o nome do grupo e o *pressionado* em cada botão.
7. A saída do vazio (*Ver todos*) desliga o recorte pela mesma função do clique.

## Pontos a observar (para o `depois`, não para esta rodada)

- **Descobrir o desligar.** Clicar de novo é o gesto padrão de botão que alterna, mas não tem marca visual. Se o uso mostrar gente presa num recorte, a saída é a pílula ganhar o `×` no ativo, que vale para todo `modos` com valor nulo. Não é motivo para *Limpar recorte* separado.
- **O bloco da Lista** (`lista-de-pedidos.tsx`) não ganha recortes neste item: o exemplo do arquétipo fica com a partição só. A convivência das duas aparece na demo do topo.
- **Contagem no servidor:** quando a lista pagina no servidor, o predicado do recorte e o da contagem moram lá. A regra do mesmo predicado continua valendo, e o teste de concordância passa a ser do projeto.
