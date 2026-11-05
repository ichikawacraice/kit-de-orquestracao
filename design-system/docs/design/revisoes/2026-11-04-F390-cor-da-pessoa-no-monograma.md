# Revisão de arquitetura — a cor da pessoa no monograma, em todo lugar (F390)

Escopo: a regra **COR-09** (e a frase das exceções da **COR-08**) e as peças do registro que desenham a pessoa: **`Monograma`** e **`MonogramaAusente`** (`packages/registro/registry/design-system/ui/monograma.tsx`), **`Pessoa`** e **`PilhaDePessoas`** (`ui/pessoa.tsx`), **`MenuDaConta`** (`ui/menu-da-conta.tsx`), o pé da **`BarraLateral`** (`blocks/casco/barra-lateral.tsx`), o **`GrupoDaPessoa`** (`ui/barra-do-editor.tsx`) e o **`AutorDaConversa`** (`ui/conversa.tsx`). O quadro (`ui/quadro.tsx`) não muda de código: recebe a `Pessoa` e a `PilhaDePessoas` de quem chama. Aqui não se escreve código de peça.

Pedido do operador (04/11/2026), literal: *"quando for bolinhas que simbolizam as pessoas, nesse caso vamos ter cor, no chat do QA entrou cor nos nomes mas nas bolinhas não, e isso vai valer para o kit e para projetos futuros"*. Confirmado: *"a cor da bolinha das pessoas é para ter cor em qualquer lugar que ela aparecer"*.

Regras que ficam (dadas no pedido): a chave estável é o id, nunca o nome; as 8 famílias sem dono; nunca a marca (MARCA-02); contraste medido nos dois temas; o nome fora da conversa a critério do designer, com a recomendação de seguir neutro.

**O que foi medido** (código do registro e do WiControl, só leitura; tokens de `packages/tokens/dist/tokens.css`; paleta do `tailwindcss/theme.css`; script de medição no scratchpad, WCAG 2.x e ΔE2000 sobre sRGB):

- **O defeito tem causa de API, não de cor.** O `Monograma` só pinta com `cor` vinda de fora, e a `Pessoa`, a `PilhaDePessoas`, o `MenuDaConta`, a `BarraLateral` e o `GrupoDaPessoa` não recebem o id da pessoa. O `AutorDaConversa` recebe `cor`, e por isso o nome da conversa tinha cor. Quem chama tem de lembrar de calcular `corDaPessoa(id)` em cada lugar, e o padrão silencioso é o neutro. Foi exatamente o que aconteceu no QA.
- **O WiControl tem uma cópia local da regra.** Ele usa `components/ui/cor-da-pessoa.ts`, com as mesmas 8 famílias e os mesmos mapas, e a `PilhaDeMonogramas` montada à mão em `QaCollaboration.tsx` com `className` por cima do `Monograma`. A cópia tem duas diferenças em relação ao kit. Primeira: o hash **normaliza** a chave (minúsculas, sem acento) e o do kit não, então a mesma chave pode dar família diferente quando tem maiúscula ou acento. Segunda: na falta do id, cai no **nome** do autor (o comentário antigo), e a regra proíbe isso. A `mencao.tsx` (a lista de quem se pode mencionar) e a `QaLista` desenham o monograma neutro. Nenhum outro projeto (Izanagi, WiTools, WiLayout, Wicomm IA, ClinIQ) usa essas peças: a quebra de API só atinge o WiControl.
- **As iniciais não dependem da superfície.** O fundo do monograma é opaco (`MONOGRAMA_DA_PESSOA`, 100/800 no claro e 900/200 no escuro), e as iniciais medem 6,47 a 8,18:1 sobre ele, já medidas. Levar o monograma a qualquer superfície (`card`, `muted`, `accent`, a linha acesa do menu) **não pede medição nova de texto**.
- **O círculo contra a superfície** é enfeite (`aria-hidden`; o nome está ao lado ou na dica) e não deve contraste. Mesmo assim, foi medido para saber o peso. No claro: 1,08 a 1,23 contra `card`, 1,01 a 1,11 contra `muted` e 1,00 a 1,07 contra `accent`, o mesmo peso do neutro de hoje (1,15). No escuro: 1,52 a 2,00 contra `card` e 1,37 a 1,81 contra `accent`, contra 1,20 do neutro. **No escuro o monograma colorido pesa mais que o neutro.**
- **Famílias vizinhas, lado a lado (ΔE2000 entre os fundos).** No claro: purple × fuchsia **2,6**, blue × indigo 4,3, sky × blue 4,4, teal × cyan 6,1. No escuro: blue × indigo 5,7, cyan × sky 6,6, purple × fuchsia 7,3. No claro, as 8 famílias se leem como cerca de 5 tintas distintas.
- **Colisão por acaso numa pilha de 3.** A chance de duas pessoas caírem na mesma família é 1 − (8·7·6)/8³ = **34%**.
- **Contra a tinta das vozes** (`TINTA_DO_TOM`, `{cor}-500/15` sobre `card`). No claro: purple-100 × `alheio` (violet) **1,4**, quase a mesma tinta; teal × `ok` 5,0; fuchsia × `ruim` 7,3. No escuro: teal × `ok` 9,8 e o resto acima de 13.
- **Contra a tinta da marca** (`marca-tinta`, o fundo do meu balão e do alvo de soltar): fuchsia 6,9 e purple 7,7 no claro, e todas acima de 21 no escuro.

## Tarefa

Quem olha uma tela com pessoas **reconhece de relance quem é cada uma** (o dono do cartão, quem está vendo, quem escreveu, a própria conta) **pela mesma cor em todo lugar** e confirma pelo nome ou pela dica, sem que a cor diga nada sobre o estado do item.

## Quem e onde

- **Papel:** todos os papéis de todos os apps do sistema. A peça é transversal e aparece no casco (a conta no pé da barra lateral, em toda tela), nas listas (a `Pessoa` na coluna de responsável, a `PilhaDePessoas` na linha do grupo), no quadro (o dono e a presença no cartão), na barra do Editor (`GrupoDaPessoa`), no menu da conta, na escolha de pessoas (a lista da menção, no WiControl) e na conversa.
- **Largura:** 1280px de referência (o projeto não tem `design/design-system.json`; vale o padrão da skill). O monograma tem 20px fixos em qualquer largura e não muda a métrica de nada.
- **Frequência:** em toda tela, o dia todo.
- **Densidade:** instrumento (DENS-01) e site (DENS-02). A `Pessoa` já tem a variante `site` do nome, e a cor vale igual nas duas.
- **Arquétipo:** não é uma tela, é peça de todos os arquétipos em que aparece gente (ARQ-01: Lista, Quadro, Mesa, Editor e o casco). A regra é da base e vale para o kit e para todo projeto futuro.

## Inventário

| o quê | onde | decisão que gera | frequência | veredito |
|---|---|---|---|---|
| Cor da pessoa no monograma | `Monograma`, em todo lugar que representa a pessoa | reconhecer a mesma pessoa de uma região (ou tela) à outra sem ler: *é a Ana de novo* | toda tela com gente | **muda**: deixa de ser só da conversa e vai a todo monograma; quem decide a cor é a peça, pela `chave` |
| A `chave` (o id da pessoa) | prop nova do `Monograma`; `id` em `DadosDaPessoa`, na `conta` e no `AutorDaConversa` | é ela que torna a cor estável e igual em todo lugar | toda pessoa | **nova**, obrigatória e anulável: `string \| null` (D1) |
| `cor` passada de fora | `Monograma`, `DadosDaPessoa`, `AutorDaConversa` | nenhuma: duplica o que a chave decide, e é por ela que a mesma pessoa pode sair com duas cores | — | **sai** (D2) |
| Neutro de reserva | `Monograma` com `chave={null}` | a pessoa existe, mas o app não tem id estável dela (o cliente anônimo, o comentário antigo sem autor) | raro | **fica**, declarado: quem chama escreve `null`, não esquece |
| Cor do nome de quem fala | `AutorDaConversa` | quem disse o quê, num grupo de balões que não tem monograma | toda conversa | **fica**, agora pela `chave` |
| Cor do nome fora da conversa | `Pessoa`, `MenuDaConta`, pé da `BarraLateral` | nenhuma: o monograma ao lado já responde *quem é*, e o nome tingido baixa o contraste de ~17:1 para ~5:1 sem ganho | — | **não entra** (D4): o nome segue na tinta de texto |
| Iniciais `?` com cor | `Pessoa` sem nome e com id | duas *Pessoa sem nome* com cores diferentes são duas pessoas; com a mesma cor, provavelmente a mesma | raro | **fica, colorido pelo id** (D5) |
| Círculo tracejado | `MonogramaAusente` | não há pessoa ali (sem responsável) | lista e quadro | **fica**, neutro, sem `chave` |
| Esqueleto redondo | `Pessoa carregando` | a pessoa ainda não chegou | ao carregar | **fica**, neutro |
| *+N* do excedente | `PilhaDePessoas` | quantas pessoas a mais | pilha cheia | **fica** em `t-medida` `muted-foreground`: é contagem, não pessoa |
| Anel da superfície e fundo opaco embaixo | `PilhaDePessoas` | separar um monograma do outro na sobreposição | toda pilha | **fica** em todos, com e sem cor (ver *Regiões*, a pilha) |
| `data-cor` | `Monograma` | o teste e o crítico conferem a família sem ler classe | — | **fica**: a família quando há chave e ausente no neutro |
| A frase *"o mapa de etapas não usa as famílias da pessoa quando a mesma tela mostra as duas"* | COR-09 | com a pessoa em toda tela (a conta no casco), ela proibiria 8 de ~12 matizes às etapas em todo app | — | **sai** (D3): as identidades se separam pela forma |
| A frase *"Fora da conversa, a pessoa segue neutra"* | COR-09 | é a regra que o pedido derruba | — | **sai** |
| A cópia local da regra no WiControl | `cor-da-pessoa.ts`, `PilhaDeMonogramas` | nenhuma depois da F390: duplica o kit, com outro hash | — | **sai no consumidor** (não neste item; ver *O que sai*) |

## Hierarquia e peso

A cor da pessoa **não muda a hierarquia de nada**. O monograma segue o mesmo círculo de 20px, no mesmo lugar, como enfeite do nome. Ele ganha matiz, não peso de posição nem de tamanho (COR-10).

1. **No claro, o peso é o de hoje.** O círculo colorido mede 1,08 a 1,23 contra `card`, e o neutro mede 1,15. A cor muda a matiz, não a presença.
2. **No escuro, o monograma sobe um degrau** (1,52 a 2,00 contra `card`, contra 1,20 do neutro). No cartão do quadro ele segue abaixo do título (13/500 em `foreground`, cerca de 15:1) e não disputa com a bandeja da vida, que é uma faixa de largura inteira com a palavra na tinta da voz. O crítico confere isso no escuro (*O que o crítico confere*, item 3).
3. **O que muda na leitura da F378.** A revisão do quadro diz que a bandeja *"chama porque é o único lugar com cor"* e que a cor do cartão vem por três canais. Depois da F390, o cartão tem uma quarta fonte de matiz: a identidade da pessoa, só no monograma. Ela não responde *o que isto pede de você* (COR-08), e o que a separa da voz é a forma: círculo com iniciais × faixa ou carimbo com a palavra. A F378 é registro e não se edita. Esta revisão é a que vale para o cartão a partir daqui.
4. **Ações:** a peça não tem ação primária. Os alvos que já existem continuam iguais (o `soMonograma` e a pilha focáveis com a dica; o botão da conta no pé da barra; o botão da conta no `GrupoDaPessoa`).

## Mensagens

A cor não carrega mensagem nenhuma: ela é pista, e o que se lê é o nome. As mensagens da peça são as de hoje.

| mensagem | lugar | duração | tom | quem vê |
|---|---|---|---|---|
| O nome da pessoa | ao lado do monograma (`Pessoa`), na dica e no nome acessível (`soMonograma`, pilha), no topo do menu da conta | enquanto vale | `neutro` (tinta de texto) | todos |
| *Ana Souza, Bruno Lima e Carla Dias* | dica e nome acessível da `PilhaDePessoas` | enquanto vale | `neutro` | todos |
| *Pessoa sem nome* | no lugar do nome, em `muted-foreground` | enquanto vale | `neutro` | todos |
| *Sem responsável* (a frase é de quem chama) | ao lado do tracejado | enquanto vale | `neutro` | todos |
| O nome de quem fala | `AutorDaConversa`, na cor da pessoa | enquanto vale | identidade (não é voz) | todos os que leem a conversa |

Nenhum texto de UI cita regra, spec ou documento (CONV-11). A cor não é anunciada ao leitor de tela, e não precisa: o nome já vai no nome acessível.

## Regiões e componentes

Nenhuma peça nova. Só mudam props e a regra.

### (a) `Monograma` — a peça decide a cor

```ts
function Monograma(props: {
  nome: string
  /** O id estável da pessoa (nunca o nome). `null`: o app não tem id dela, e o monograma fica neutro. */
  chave: string | null
  className?: string
}): JSX.Element
```

- **A cor é `corDaPessoa(chave)`**, dentro da peça, com o fundo e as iniciais de `MONOGRAMA_DA_PESSOA`. Sem chave, é o `NEUTRO`. `""` e chave só de espaços contam como `null`. A chave entra crua no hash, sem normalizar: o id é opaco, e normalizar faria dois ids diferentes colidirem por regra, não por acaso.
- **A prop se chama `chave` e não `id`** porque, numa peça que desenha um `<span>`, `id` se lê como o atributo do DOM. Nos dados (`DadosDaPessoa`, `conta`), o nome é `id`, porque ali é o dado da pessoa.
- **Sem `cor`** (D2). Os exports `corDaPessoa`, `CORES_DA_PESSOA`, `MONOGRAMA_DA_PESSOA` e `NOME_DA_PESSOA` ficam para os testes e para o `AutorDaConversa`. Fora do `monograma.tsx`, só o `conversa.tsx` importa o `NOME_DA_PESSOA` (teste, item 6 de *Estados*).
- `data-cor`: a família quando há chave, ausente no neutro. `aria-hidden` como hoje.
- **`MonogramaAusente` não muda.** Segue tracejado e neutro, sem `chave`: não há pessoa, e cor de pessoa que não há seria mentira.
- **Obrigatória e anulável (D1).** `<Monograma nome="Ana" />` sem chave não compila. Quem chama decide, e escreve, se tem id. É a trava contra o defeito do QA: o neutro deixa de ser o padrão silencioso e vira escolha escrita.

### (b) `Pessoa` e `PilhaDePessoas` — o id nos dados

```ts
type DadosDaPessoa = { id: string | null; nome?: string | null }
```

- A `Pessoa` passa `chave={pessoa.id}` ao `Monograma`. **Id sem nome:** as iniciais *?* na cor do id e o texto *Pessoa sem nome* em `muted-foreground` (D5). **Nome sem id** (`id: null`): o monograma neutro e o nome em `foreground`. **`pessoa={null}`:** o tracejado, como hoje.
- O nome segue em `text-foreground` (instrumento `t-denso`, site `text-sm`) e **nunca** na cor da pessoa (D4).
- A `PilhaDePessoas` passa `chave={p.id}` a cada monograma. A `key` do React passa a ser `p.id ?? i` (hoje é `i`, e com a cor presa ao id uma reordenação sem `key` estável troca a cor de lugar por um quadro).
- `soMonograma`, `decorativa`, `frase`, `max` e `sobre` não mudam.

### (c) A pilha: o anel e o fundo embaixo

- **O anel fica, e fica mais necessário.** No claro, o fundo colorido mede 1,08 a 1,23 contra `card`, e duas famílias vizinhas ficam a ΔE 2,6 (purple × fuchsia). O que faz dois círculos sobrepostos serem dois é o anel de 2px na cor da superfície (`ring-card` ou `ring-muted`), não a diferença de matiz.
- **O fundo opaco embaixo** (`bg-card`/`bg-muted` no invólucro) só é necessário para o neutro de reserva, que é translúcido (`bg-foreground/[0.07]`). Com a cor opaca ele não faz nada, mas também não atrapalha. **Fica em todos os monogramas da pilha:** uma construção só, sem ramo por cor, e o neutro de reserva continua coberto. Tornar o neutro opaco também resolveria, mas pede medição nova (COR-07, COR-12) e fica fora deste item.
- **Família repetida na pilha** (34% numa pilha de 3): aceita. Não há troca de cor para evitar a vizinha, porque trocar faria a mesma pessoa ter uma cor na pilha e outra no cartão, que é o contrário do pedido. Os dois círculos se separam pelo anel e pelas iniciais, e a frase inteira está na dica (a cor nunca é o único sinal: CONVENCOES, a regra de acessibilidade da cor).

### (d) A conta: `MenuDaConta`, o pé da `BarraLateral`, o `GrupoDaPessoa`

```ts
// menu-da-conta.tsx
MenuDaConta(props: { id: string | null; nome: string; email: string; onAbrirConta?; onSair; children; lado? })
// barra-lateral.tsx
type Conta = { id: string | null; nome: string; email: string; onAbrirConta?: () => void; onSair: () => void }
// barra-do-editor.tsx
GrupoDaPessoa(props: { conta: { id: string | null; nome: string; email: string; onSair: () => void } })
```

- Os três passam `chave={conta.id}` ao `Monograma`: no topo do menu, no gatilho do pé da barra (expandida e recolhida) e no botão da barra do Editor. A pessoa logada tem a **mesma cor** que tem no cartão, na pilha e na conversa dos outros.
- Na barra **recolhida**, sobra só o monograma. É o único círculo colorido da barra, e o ponto da contagem (`PONTO_DO_TOM`, 8px, âmbar ou rosa) mora nos destinos, em outra linha e com outra forma. Não há conflito.
- O nome da conta, ao lado (expandida) e no topo do menu, segue `text-foreground`.

### (e) `AutorDaConversa` — o nome, pela mesma chave

```ts
AutorDaConversa(props: { nome: string | null; selo?: string | null; chave: string | null })
```

- O nome pinta `NOME_DA_PESSOA[corDaPessoa(chave)]`. Sem chave (o cliente sem id, como o WiControl faz hoje), o nome fica `text-foreground-2`.
- A cor do nome e a do monograma da mesma pessoa saem da mesma chave, pela mesma função, e não podem divergir.

### (f) Onde a cor poderia atrapalhar, e o que se decide

| lugar | risco | decisão |
|---|---|---|
| Cartão do quadro: monograma `purple` e bandeja `alheio` | no claro, purple-100 × violet a 15% medem ΔE **1,4**: a mesma tinta | **aceito pela forma**: círculo de 20px com iniciais × faixa de largura inteira com a palavra. O crítico confere no ateliê (item 2). Se confundir, troca-se o **degrau** do purple no claro (com nova medição das iniciais), nunca a família |
| Cartão: monograma `sky` e `Prioridade` baixa | as duas usam `sky` | aceito pela forma (já era a regra): carimbo com o glifo de barras × círculo com iniciais |
| Cartão: dono e presença lado a lado | até 4 círculos coloridos, um ao lado do outro | aceito. Presença e dono se distinguem pela posição (a pilha à esquerda, o dono à direita, como na F378), não pela cor |
| Colunas do quadro com `PontoDaEtapa` nas mesmas famílias | ponto `cyan` no cabeçalho, pessoa `cyan` no cartão | aceito pela forma (D3): ponto de 6px com o nome × círculo de 20px com iniciais |
| Linha acesa do menu (`bg-accent`), hover do botão `ghost` | no claro, o círculo some contra `accent` (1,00 a 1,07) | aceito: as iniciais seguem a 6:1 ou mais sobre o próprio fundo, e o círculo é enfeite. O neutro de hoje também quase some ali |
| Foco | o anel de foco é `ring-ring` (a marca) com `ring-offset-background` | não muda: o vão de 2px separa o anel da marca do círculo |
| Seleção, linha, cartão, balão | a tentação de pintar o fundo da linha com a cor de quem é dono | **proibido** (COR-09): a cor da pessoa nunca é fundo de linha, item de menu, cartão ou balão, nem seleção, foco, borda ou filete |
| Meu balão (`marca-tinta`) | fuchsia-100 fica a 6,9 da tinta da marca no claro | aceito: a conversa não desenha monograma dentro do balão, e o meu lado não tem autor |

### As regras que mudam (texto proposto)

**DESIGN.md, COR-08, a linha das exceções** (hoje a linha ~244):

> As exceções declaradas são duas (COR-09): a `Prioridade`, cujo glifo e palavra levam a cor do nível, com a tinta do carimbo na voz; e a cor da pessoa, no monograma em todo lugar que a represente e, na conversa entre pessoas, no nome de quem fala.

**DESIGN.md, COR-09, a regra** (o primeiro parágrafo só troca o trecho do "um lugar só"; o segundo é substituído inteiro):

> Cada família tem **um lugar só** (a etapa vive só no ponto do `PontoDaEtapa`; o nível da prioridade, só na `Prioridade`; a pessoa, só no `Monograma` e no nome do `AutorDaConversa`) …
>
> A **cor da pessoa** é a outra exceção: o monograma leva a cor da pessoa **em todo lugar que a represente** (a linha, a pilha, o cartão, a conta, a escolha de pessoas, a conversa), para a mesma pessoa ser reconhecida de relance de uma região à outra. São 8 famílias sem dono (nenhuma voz, nem o vermelho e o laranja da prioridade, nem a marca), escolhidas pela chave estável da pessoa (o id, nunca o nome) dentro do próprio `Monograma`: quem chama passa a chave (`chave`, ou `id` nos dados da pessoa), nunca a cor. Sem id estável, quem chama diz que não tem (`null`), e o monograma fica neutro. A pessoa que não há segue no tracejado neutro. A cor é pista, não identificador: duas pessoas podem cair na mesma família, e o que as separa são as iniciais, o nome ao lado ou a dica, nunca a cor sozinha. O **nome** só ganha a cor na conversa entre pessoas, no cabeçalho do grupo de balões, onde ele é o único sinal de quem fala. Fora dela, o nome segue na tinta de texto, porque o monograma ao lado já responde *quem é*. As identidades se separam pela **forma**, não pela exclusividade da matiz: o `sky` também é do nível baixo da prioridade (lá, o carimbo com o glifo de barras), e o mapa de etapas do projeto pode usar as mesmas famílias (lá, o ponto de 6px com o nome); a pessoa é o círculo de 20px com as iniciais e o nome do autor. As 8 famílias são declaradas num lugar só, no `Monograma` (`CORES_DA_PESSOA`, `MONOGRAMA_DA_PESSOA`, `NOME_DA_PESSOA`, `corDaPessoa`). A cor pinta só o monograma (fundo opaco, iniciais a 6:1 sobre ele, em qualquer superfície) e o nome do autor na conversa (4,5:1 sobre `muted` e `card`). Nunca pinta o fundo da linha, do item de menu, do cartão ou do balão, nem a seleção, o foco, a borda, o filete, o carimbo ou o glifo.

**COR-09, o porquê** (acrescentar ao fim):

> Com a cor só na conversa, o nome de quem escreveu tinha cor e o monograma da mesma pessoa no quadro e na presença não tinha: a pista não atravessava a tela. Por isso a peça calcula a cor pela chave, e quem chama não pode esquecer de dizer se tem a chave.

**COR-09, o confere:**

> `crítica:consistência` · registro (cada peça que desenha a pessoa, com o mesmo id, dá a mesma família; sem chave, neutro; o `NOME_DA_PESSOA` só na conversa) · revisão de código.

**ANATOMIA.md, PECA-01, a linha *A pessoa numa linha*** (hoje a ~215):

- Componente: *`Pessoa`: o `Monograma` de 20px na cor da pessoa pelo id (COR-09) e o nome na tinta de texto, o papel na legenda; …* (o resto igual).
- Antipadrão: troca *"cor por pessoa fora da conversa (COR-09)"* por *"a cor da pessoa pelo nome ou passada à mão, o nome na cor da pessoa fora da conversa, a cor da pessoa no fundo da linha (COR-09)"*. Ficam *"o id cru no lugar do nome, pilha sem a frase inteira"*.

**ANATOMIA.md, a linha da conversa** (hoje a ~216): *"A cor da pessoa (COR-09) no monograma, como em todo lugar, e no nome do autor (`AutorDaConversa`, pela mesma chave)"*.

**Descrição do item `monograma` no registro** (`packages/registro/lib/itens.mjs` e, gerados a partir dele, `registry.json` e o `README.md` do registro): *"avatar: o círculo de 20px com as iniciais, na cor da pessoa pelo id (`chave`), neutro sem id, e o círculo tracejado da pessoa que não há."*

**`docs/rastreio/origens-da-base.md`:**

- COR-09: troca o último período por *"A cor da pessoa no monograma e no nome de quem fala na conversa: Q942, 04/11/2026, com o contraste medido na F380 e levado ao kit na F379. Levada a todo monograma, pela chave dentro da peça, com o nome fora da conversa neutro e a separação entre identidades pela forma: pedido do operador de 04/11/2026, revisão F390 (`docs/design/revisoes/2026-11-04-F390-cor-da-pessoa-no-monograma.md`)."* (Se a orquestradora deu Q-ID ao pedido, ele entra no lugar de *"pedido do operador"*.)
- COR-08: acrescenta *"A exceção da cor da pessoa em todo monograma: F390, 04/11/2026."*

**Versão da base:** de 0.20.3 para **0.21.0** nos três arquivos da base, porque a API do registro quebra. O `CHANGELOG.md` ganha a entrada com *Camadas: base, registro*. Em *O que muda*: a cor em todo monograma; a `chave`/`id` obrigatória e anulável; o `cor` que sai. Em *Migração*: `npx shadcn add` de `monograma`, `pessoa`, `menu-da-conta`, `barra-lateral`, `barra-do-editor` e `conversa`; em cada lugar que o compilador apontar, passe o id da pessoa ou `null`; troque `cor={corDaPessoa(id)}` por `chave={id}`; apague a cópia local da cor da pessoa, se houver. O plugin legado `plugins/wicomm/` (base 0.14.1) não muda.

## Estados

| estado | o que a peça mostra | teste que a dona escreve |
|---|---|---|
| 1. Com id e nome | iniciais na cor de `corDaPessoa(id)`, `data-cor` = família | `Monograma` com `chave="pessoa-ana"` tem `MONOGRAMA_DA_PESSOA[corDaPessoa("pessoa-ana")]` e `data-cor` |
| 2. Sem id (`null`, `""`, só espaços) | neutro, sem `data-cor` | o mesmo nome com `chave={null}`, `""` e `"  "` dá `NEUTRO` e nenhuma classe das 8 famílias. Antes, no mesmo teste, prova que com chave a classe da família apareceria (a ausência só mede depois de provar a presença) |
| 3. Id sem nome | *?* na cor do id; *Pessoa sem nome* em `muted-foreground` | `Pessoa` com `{ id: "x", nome: null }`: monograma com `data-cor` e texto *Pessoa sem nome* |
| 4. Sem pessoa | tracejado neutro e a frase de quem chama | `MonogramaAusente` sem `data-cor` |
| 5. Carregando | esqueleto redondo neutro | como hoje |
| 6. A mesma pessoa em toda peça | a mesma família em `Pessoa`, `Pessoa soMonograma`, `PilhaDePessoas`, `MenuDaConta` (topo), `BarraLateral` (pé expandido e recolhido), `GrupoDaPessoa`, e o nome do `AutorDaConversa` na família do mesmo id | um teste renderiza todas com `id: "pessoa-ana"` e afirma que a lista de `data-cor` **não é vazia** e tem um valor só, igual a `corDaPessoa("pessoa-ana")`. É o teste das duas coisas que devem concordar |
| 7. Nome fora da conversa | tinta de texto | a `Pessoa` e o pé da barra, com id, não têm classe de `NOME_DA_PESSOA`. Um teste lê o código do registro e afirma que `NOME_DA_PESSOA` só é importado por `ui/conversa.tsx` (e que esse import existe) |
| 8. Pilha | anel e fundo da superfície em todos; `key` pelo id | a pilha com dois ids da mesma família desenha dois monogramas com anel |
| 9. Tipo | `chave` obrigatória | se o pacote passa os testes pelo `tsc`, um `// @ts-expect-error` com `<Monograma nome="A" />`; se não passa, a dona diz no PR que a trava do tipo não tem teste |
| 10. Temas | a mesma família no claro e no escuro | os mapas já têm o par `dark:` em teste (`a-conversa.dom.test.tsx`), e ficam |

Os testes de hoje que usam `cor` (`a-conversa.dom.test.tsx`: *"o Monograma com cor…"*, *"a Pessoa e a PilhaDePessoas passam a cor…"*) passam a usar `chave`/`id`. Os de `pecas-de-lista.dom.test.tsx` ganham `id` nos dados.

**O ateliê** (o que o crítico vai olhar):

- demo `monograma`: as 8 famílias, o neutro sem chave e o tracejado;
- demo `pessoa`: `id` em todos, um *Pessoa sem nome* com id, e a pilha com duas pessoas da mesma família (escolha ids que colidam);
- demo `quadro`: um cartão com dono `purple` e bandeja `alheio`, um com dono `sky` e `Prioridade` baixa;
- demos `menu-da-conta`, `linha-do-grupo`, `_lista-grande`, `table`, `escolha-na-celula` e `conversa`, com `id` ou `chave`.

## Movimento

Nenhum. A cor não anima: sem `transition-colors` no monograma. Se o id chegar depois do nome (raro), a troca do neutro para a cor é instantânea. Com `prefers-reduced-motion` não há o que reduzir. O fade do balão que chega (`duration-revela`) não muda.

## O que sai

- **Da base:** *"Fora da conversa, a pessoa segue neutra"* e *"só na conversa entre pessoas"* (COR-09); *"só no monograma e no nome de quem fala na conversa entre pessoas"* (COR-08, trocado pelo texto acima); *"O mapa de etapas do projeto não usa as famílias da pessoa quando a mesma tela mostra as duas"* (COR-09, D3); o antipadrão *"cor por pessoa fora da conversa"* (ANATOMIA).
- **Do registro:** a prop `cor` do `Monograma`, de `DadosDaPessoa` e do `AutorDaConversa`; a `key={i}` da pilha; os comentários JSDoc que dizem *"a cor só entra onde a COR-09 a permite: a conversa"* (`monograma.tsx`, `pessoa.tsx`) e a frase *"em tinta neutra"* como regra do `Monograma`; a descrição *"só na conversa"* em `itens.mjs` e no `README.md` do registro.
- **Do WiControl** (consumidor; não é deste item, porque o kit não grava em repositório de outro projeto, mas vai no CHANGELOG e no recado à dona do WiControl): `components/ui/cor-da-pessoa.ts` inteiro; a `PilhaDeMonogramas` local de `QaCollaboration.tsx`, trocada pela `PilhaDePessoas`; o `className={MONOGRAMA_DA_PESSOA[…]}` por cima do `Monograma`; o nome como chave da cor no comentário antigo (passa a `null`, neutro); o `classeDoNome` em `QaCommentThread.tsx`, trocado por `chave`. A `mencao.tsx` e a `QaLista` passam o id. **Atenção:** o hash local normaliza a chave e o do kit não, então uma pessoa com id em maiúsculas ou com acento muda de cor **uma vez**, na migração.

## Decisões ao operador

**D1 · A chave é obrigatória e anulável (`string | null`), não opcional** — *assumida, a confirmar*

- **O caso:** o defeito do QA foi esquecimento. A peça só pinta se alguém lembrar de calcular a cor, e quem esquece não vê erro nenhum, só a bolinha cinza. Com o id opcional, o esquecimento continua possível e silencioso. Com o id obrigatório sem `null`, a pessoa sem id estável (o cliente anônimo, o comentário antigo) não teria como aparecer.
- **Se não decidir:** vale o opcional, e o próximo app repete o QA. Toda tela nova precisa de um crítico atento para notar uma bolinha cinza.
- **Recomendação:** obrigatória e anulável. O compilador aponta cada lugar uma vez e quem chama escreve o id ou `null`: o neutro vira decisão escrita, não omissão. O custo é a quebra de compilação na atualização, e ela só atinge o WiControl (o único consumidor medido) e as demos do ateliê. Num kit 0.x, é a versão 0.21.0.

**D2 · A prop `cor` sai, em vez de ficar como alternativa** — *assumida, a confirmar*

- **O caso:** a proposta do pedido era `cor ?? corDaPessoa(chave)`. Mas duas entradas para a mesma resposta deixam a mesma pessoa sair com duas cores, quando um lugar passa `cor` calculada com outra chave (o WiControl calcula com outro hash e cai no nome).
- **Se não decidir:** a `cor` fica, ninguém é obrigado a migrar, e a divergência entre o hash local e o do kit fica em produção.
- **Recomendação:** tirar a `cor` na mesma quebra da D1. A migração é uma só (`cor={corDaPessoa(id)}` vira `chave={id}`), e depois dela a cor só pode vir da chave.

**D3 · A separação entre as identidades é pela forma, e o mapa de etapas pode usar as famílias da pessoa** — *assumida, a confirmar*

- **O caso:** a COR-09 de hoje proíbe as famílias da pessoa no mapa de etapas *"quando a mesma tela mostra as duas"*. Com a pessoa em todo lugar, a conta no pé da barra está em toda tela, e a proibição tiraria das etapas 8 matizes, sobrando green, yellow e pink, poucas para um quadro de até 11 colunas. O próprio exemplo do `PontoDaEtapa` no registro usa `cyan` e `indigo`.
- **Se não decidir:** a frase fica, e o primeiro app que declarar etapas descumpre a base no exemplo do próprio kit, ou fica com três cores.
- **Recomendação:** tirar a frase e escrever a regra que o `sky` já usa. Identidades se separam pela forma: o ponto de 6px com o nome é etapa, o carimbo com o glifo de barras é prioridade, o círculo de 20px com iniciais é pessoa. O crítico confere no ateliê a coluna `cyan` com o dono `cyan` no cartão.

**D4 · O nome fora da conversa segue na tinta de texto** — *recomendação do pedido, aceita*

- **O caso:** com o monograma colorido ao lado, pintar também o nome em listas, cartões e na conta repetiria a pista e baixaria o nome de cerca de 17:1 para cerca de 5:1. E abriria uma terceira tinta de texto ao lado da das vozes.
- **Se não decidir:** vale esta revisão: nome neutro.
- **Recomendação:** neutro. Na conversa o nome é colorido porque ali não há monograma: um sinal de cor por pessoa, por lugar.

**D5 · A pessoa com id e sem nome tem o *?* na cor do id** — *assumida, a confirmar*

- **O caso:** o id veio e o nome não. O texto é *Pessoa sem nome* em qualquer caso, e o *?* pode ficar neutro ou colorido.
- **Se não decidir:** vale o colorido.
- **Recomendação:** colorido. A cor é do id, que é conhecido, e é ela que diz que duas *Pessoa sem nome* são pessoas diferentes, coisa que o texto não diz. O nome sem id fica neutro, pela D1.

## O que o crítico confere

1. A regra nova está nos três lugares (COR-08, COR-09, ANATOMIA) e no rastreio, e nenhuma frase velha de *"só na conversa"* sobrou (`grep` em `plugins/design-system/base/`, `packages/registro/` e `apps/atelie/`; o `CHANGELOG` antigo e o plugin legado `plugins/wicomm/` ficam como estão).
2. No ateliê, **claro**: o cartão com dono `purple` e bandeja `alheio` (ΔE 1,4) se lê como pessoa + voz, não como dois *alheio*; a pilha com duas pessoas da mesma família tem dois círculos separados pelo anel; a coluna `cyan` com o dono `cyan` não sugere que a pessoa é da etapa.
3. No ateliê, **escuro**: o monograma colorido (1,5 a 2,0 contra `card`) não passa o título do cartão nem a bandeja da vida em peso.
4. O foco do `soMonograma` e da pilha (anel da marca com o vão) continua visível em volta dos 8 círculos, nos dois temas.
5. A linha acesa do menu e o hover do botão da conta: as iniciais seguem legíveis e o círculo que some contra `accent` no claro não esconde de quem é (o nome está ao lado ou no `aria-label`).
6. Nenhuma linha, cartão, item de menu, balão, borda ou filete pinta com a cor da pessoa. Nenhum nome fora do `AutorDaConversa` usa `NOME_DA_PESSOA`.
7. A mesma pessoa (mesmo id) tem a mesma família em toda peça do estado 6, com o teste colado no PR.

## Pontos a observar (para o `depois`, não para esta rodada)

- **Tema com a marca numa das 8 famílias.** Hoje a marca é a Wicomm (`#F30B42`, longe de todas as famílias; a mais perto é o fuchsia, a ΔE 6,9 da `marca-tinta` no claro). Um tema com marca azul (a fixture `outro`, `#0057D9`) cairia em `blue` e `indigo`, e a regra *"nunca a marca"* deixaria de valer sem ninguém notar. Se um dia houver outro tema, a lista de famílias passa a ser do tema, com a família da marca fora. Não é deste item: a marca dos apps é sempre a Wicomm.
- **No claro, purple e fuchsia ficam a ΔE 2,6.** As 8 famílias valem como cerca de 5 tintas distintas. Se o crítico achar pouco, o conserto é o degrau, não a família, e a troca de degrau pede medir de novo as iniciais.

## Crítica 1 (2026-11-04)

Nota 26/30 (hierarquia 4 · densidade 5 · consistência 4 · ruído 4 · ação primária 5 · aderência 4). Aprovada com ressalvas.

- **P1 · média · o `className` pintava o monograma por cima da chave.** Corrigido: no `Monograma`, a tinta vem depois do `className`; teste novo em `a-cor-da-pessoa.dom.test.tsx`; a migração do CHANGELOG diz para tirar o `className` com a cor.
- **P2 · baixa · "família" com dois sentidos na COR-09.** Corrigido: "Cada identidade (a etapa, o nível da prioridade, a pessoa) tem um lugar só"; "família" fica só para a matiz.
- **P3 · baixa · as demos acham o id pelo nome (`pessoaDaDemo`).** Os dois testes que usavam o nome como id passaram a ids próprios. As demos ficam como estão neste PR: pendência para o `depois` (os dados das demos guardarem `{ id, nome }`).
- **P4 · baixa · falta no quadro uma pilha de 3 pessoas ao lado do dono para conferir o peso no escuro.** Pendência para o `depois`.
- **P5 · fora do escopo · a lista de escolha de pessoas não mostra o monograma.** Trabalho novo.
- A conferência visual nos dois temas (itens 2 a 5 de *O que o crítico confere*) ficou em aberto: o ateliê não estava no ar.
