# Revisão de arquitetura — a lista por período e o intervalo de dois campos (F395)

Escopo: o que o registro e a base precisam para a **lista agrupada por período** e o **intervalo de dois valores** deixarem de ser montados à mão no consumidor. Cinco pontos, K1 a K5:

- **K1** — a largura do **`Popover`** (`packages/registro/registry/design-system/ui/popover.tsx`) e o corte lateral que ele faz.
- **K2** — a peça nova **`IntervaloDeCampos`** (`ui/intervalo-de-campos.tsx`), com a terceira voz do **`Label`** (`ui/label.tsx`).
- **K3** — a contagem da **`LinhaDoGrupo`** (`ui/linha-do-grupo.tsx`) sem fração, e o *Sem linhas* sem contagem.
- **K4** — a linha nova *Lista agrupada por período* na **PECA-01**.
- **K5** — a espera de cada vista na **ARQ-01**, com a peça nova **`EsperaDosGrupos`** (em `ui/linha-do-grupo.tsx`).

Fica de fora (outros itens): o monograma e a pessoa, a prioridade, o filtro salvo. Aqui não se escreve código de peça (CONV-19).

**A origem.** A revisão do piloto WiControl `docs/design/revisoes/2026-11-04-tela-projetos-filtros-e-go-lives.md` (branch `claude/f389-tela-projetos-f1`) montou à mão, na tela de projetos, o que o kit não tinha: o intervalo de datas no filtro, a contagem de um grupo sem fração, o grupo vazio que diz a causa e a espera da vista por semana. O pedido é levar ao kit o que se repete, pelo menor diff que resolve inteiro.

**O que foi medido** (código do registro em `main` d03a975, do ateliê e do piloto, só leitura; nenhuma tela renderizada nesta rodada — o que é de navegador está em *O que o crítico confere*):

- **O popover corta, e corta de propósito.** O `PopoverContent` tem `w-72 overflow-x-hidden overflow-y-auto p-4`. O `overflow-x-hidden` entrou na F301 (commit 79899f3, *popover e dica sem rolagem lateral*): com `overflow-y-auto`, o CSS força o eixo x a `auto`, e o popover ganhava barra lateral por 1px de conteúdo. A largura útil é **256px** (288 menos 2×16). Dois `input type="date"` lado a lado com o *e* no meio medem **cerca de 291px** no Chromium (medido no piloto): passam da largura útil, e o segundo campo perde o ícone do calendário, sem aviso e sem rolagem. O defeito não é o corte; é o arranjo que não cabe.
- **Quem muda a largura hoje, e como.** No kit, a `EscolhaNaCelula` passa `className="w-auto"` (o formulário do popover se mede pelo conteúdo) e a vitrine do ateliê (`ladrilho-de-cor.tsx`) passa `className="flex w-80 flex-col gap-3"`. No piloto, o `SeloSomenteLeitura` passa `className="w-80"`. Três consumidores, três classes à mão, nenhuma com teto pela janela.
- **O intervalo do piloto.** `FiltrosDaLista.tsx` tem um `IntervaloDeCampos` e uma `LinhaDoIntervalo` locais: `fieldset` com `flex min-w-0 flex-col gap-1.5`, `legend` `t-rotulo mb-1.5`, cada lado numa linha `flex items-center gap-2` com `Label voz="campo" className="w-7 shrink-0"` e o `Input` ao lado. Funciona e cabe nos 256px. E `listas/celulas-da-linha.tsx` monta outro intervalo, o do prazo, com os rótulos *Início* e *Término* em cima dos campos e a checagem de `validity.badInput` à mão. Dois intervalos, duas formas, na mesma tela.
- **A contagem do grupo.** A `LinhaDoGrupo` só desenha contagem com `contagem={{ feitas, total }}`: *7 de 10* em `t-medida`, e `total === 0` vira o `semLinhas` (*Sem linhas*). Sem `contagem`, não desenha nada, nem com o grupo vazio. O piloto, para fazer o grupo vazio dizer a causa sem mostrar uma fração que não existe, escreve `contagem={grupo.itens.length === 0 ? { feitas: 0, total: 0 } : undefined}` em `ProximosGoLives.tsx`: um *0 de 0* fingido para chegar ao `semLinhas`. E a quantidade do grupo (*3 entregas*), que é o que a tela precisava dizer, não tem forma na peça. Os dois consumidores da `main` (a lista do portal e a de tarefas) passam a fração; o teste `pecas-de-lista.dom.test.tsx` (linha 96) passa `{ feitas: 0, total: 0 }` com `linhas={[]}`.
- **A espera.** O registro tem `EsperaDaLista` (`ui/skeleton.tsx`: N blocos `rounded-xl` com `gap-3`, `role="status"`, `aria-busy`) e `EsperaDoQuadro` (`ui/quadro.tsx`, colunas; **sem** `role="status"`). Não tem a espera da lista agrupada. O piloto montou `EsperaDosProximosGoLives` à mão: `Skeleton h-10` no lugar do degrau (o real tem 48px, `min-h-12`), as linhas com `ml-5` e o invólucro com `px-3 pt-1`. Quando os dados chegam, o degrau cresce 8px e o recuo muda: a lista pula. A base fala de espera por vista só num caso, na frase da **Mesa com abas** (ARQ-01).
- **A geometria real da `LinhaDoGrupo`** (de onde a espera tira as medidas): degrau `min-h-12` (instrumento) e `min-h-14` (site), `bg-muted` `rounded-xl`; vão antes do grupo depois de grupo aberto `pt-4`/`pt-6` (16/24px), entre fechados `pt-1.5`/`pt-2`; ar depois do topo `pb-1`/`pb-1.5` (4/6px); da régua do cabeçalho ao primeiro grupo `pt-2`/`pt-3` (8/12px); linhas recuadas `border-l-[20px]` (34px quando algum grupo tem identidade). O cabeçalho da `Table` é `h-10` com a régua `border-b`.

## Tarefa

Quem abre uma lista do que vem pela frente (entregas, marcos, prazos) **vê de relance o que cai em cada período e quantos são**, inclusive os períodos em que não cai nada, e **recorta a lista por um intervalo** (de uma data a outra, de um valor a outro) sem que o filtro corte o próprio campo, nem a espera desenhe uma tela que não vai chegar.

## Quem e onde

- **Papel:** quem acompanha prazos e entregas nos apps do sistema (no piloto, o gestor de projetos). As peças são do registro e valem para todo app.
- **Largura:** 1280px de referência (o repositório do design system não tem `design/design-system.json`; vale o padrão da skill). O popover tem largura própria (256 úteis no padrão), e o intervalo é medido nele.
- **Frequência:** a lista por período, várias vezes ao dia; o filtro de intervalo, algumas vezes por semana; a espera, a cada troca de vista.
- **Densidade:** instrumento (DENS-01) nas listas e no popover; site (DENS-02) quando o intervalo mora num formulário.
- **Arquétipo:** **Lista** (ARQ-01), com mais de uma vista (`BarraDeModos`: corrida, por período, quadro). O intervalo também entra no **Formulário**, dentro de um `Bloco`.

## Inventário

| o quê | onde | decisão que gera | frequência | veredito |
|---|---|---|---|---|
| A largura do popover | `PopoverContent`, prop nova `largura` | quem chama escolhe entre três larguras conhecidas, em vez de escrever `w-…` | todo popover | **nova** (K1): `padrao` · `larga` · `conteudo` |
| O corte lateral do popover | `overflow-x-hidden` | nenhuma decisão de quem usa; evita a barra lateral por 1px | todo popover | **fica** (F301), agora documentado no comentário da peça |
| O intervalo de dois valores | `IntervaloDeCampos` | recortar a lista por *de* e *até* | filtros, formulários | **nova peça** (K2) |
| A legenda do intervalo (*Prazo*, *Valor (R$)*) | `legend` do `fieldset` | qual grandeza se recorta, e a unidade | todo intervalo | **fica**, obrigatória |
| *De* e *Até* | `Label` de cada lado | qual ponta é qual, e o nome acessível de cada campo | todo intervalo | **fica**, com rótulo visível (CTRL-04); a palavra vem por padrão e se troca |
| O *e* entre os campos | arranjo do piloto lado a lado | nenhuma: a ordem e os rótulos já dizem | — | **sai** (não cabe em 256px e repete o que o rótulo diz) |
| O erro de um lado | linha abaixo do campo, `t-denso` na voz `ruim` | o que corrigir, e em qual ponta | raro | **fica**, decidido por quem chama |
| A fração *7 de 10* | `LinhaDoGrupo`, `contagem={{ feitas, total }}` | quanto do grupo está feito | listas de tarefas | **fica** como está |
| A quantidade com unidade (*3 entregas*) | `LinhaDoGrupo`, `contagem={{ total, unidade }}` | quanto cai neste grupo, sem nada a concluir | listas por período | **nova** (K3) |
| O *0 de 0* fingido | consumidor | nenhuma: é um truque para chegar ao `semLinhas` | — | **sai** (K3) |
| *Sem linhas* / a frase de quem chama | `LinhaDoGrupo`, `semLinhas` | o grupo está vazio, e por quê (EST-02) | períodos vazios | **muda**: aparece também sem `contagem` |
| O período vazio | um grupo vazio no lugar dele | não há nada nesta semana: não é *não carregou* | toda lista por período | **fica** (K4): o período não some |
| A sequência de períodos vazios | um grupo só com o intervalo | *não há nada até 10 de jan* | listas com buracos | **nova** na base (K4) |
| O período atual | primeiro grupo, aberto | onde estou no tempo | toda lista por período | **fica**, nunca juntado a vazios |
| A espera da vista por período | `EsperaDosGrupos` | nenhuma decisão; impede o pulo na chegada e diz *carregando* ao leitor de tela | toda troca de vista | **nova peça** (K5) |
| A frase da Mesa com abas sobre o esqueleto | ARQ-01 | — | — | **sai dali** e vira regra geral (K5) |

## Hierarquia e peso

- **Nada disputa com o nome do grupo.** A quantidade com unidade fica onde a fração fica hoje, encostada no fim, em lugar fixo: o número em `t-medida` e a palavra em `t-denso`, os dois em `text-foreground-2`. Ela é a segunda leitura do grupo, depois do nome (`text-sm font-[600]` no instrumento, `t-titulo` no site, TIPO-02).
- **O grupo vazio pesa menos que o cheio, sem opacidade.** O `semLinhas` sai em `t-denso` `text-muted-foreground`, como hoje, e o grupo fica inerte. A sequência de períodos vazios ocupa **um** degrau, não cinco: o vazio não empurra para baixo o próximo período com entrega.
- **No intervalo, a legenda manda e os rótulos servem.** No instrumento, a legenda em `t-rotulo` (nomeia o conjunto, aparece uma vez) e *De*/*Até* em `t-coluna` (nomeiam o valor que se repete, mais leves). No site, a legenda em `t-campo` e *De*/*Até* também em `t-campo`, alinhados na coluna da grade (D4).
- **Ações:** nenhuma peça desta revisão tem primário. O filtro aplica ao mudar (a regra do filtro é da tela, não da peça); o popover não ganha botão.

## Mensagens

| mensagem | lugar | duração | tom | quem vê |
|---|---|---|---|---|
| *3 entregas* / *1 entrega* (a palavra é de quem chama, no singular e no plural) | fim da linha do grupo | enquanto vale | `neutro` | todos |
| *Nenhuma entrega* (o `semLinhas` de quem chama; padrão *Sem linhas*) | fim da linha do grupo vazio | enquanto vale | `neutro` | todos |
| *Nenhuma entrega em 5 semanas* | fim do grupo que junta os períodos vazios | enquanto vale | `neutro` | todos |
| *Esta semana · 2 a 8 de nov*, *7 de dez a 10 de jan* | nome do grupo | enquanto vale | `neutro` | todos |
| *Prazo*, *De*, *Até* | legenda e rótulos do intervalo | sempre | `neutro` | todos |
| O erro do lado (*A data final vem antes da inicial*, *Data incompleta*) — o texto é de quem chama | abaixo do campo do lado, na coluna do campo | até corrigir | `ruim` | quem preencheu |
| *Carregando as entregas* (o `rotulo` da espera, de quem chama) | `role="status"`, só para o leitor de tela | enquanto espera | — | leitor de tela |

Nenhum texto de UI cita regra, spec ou documento (CONV-11). Os exemplos acima são do piloto; a base usa exemplos genéricos (*entregas*, *marcos*).

## Regiões e componentes

### K1 · `Popover` — três larguras, e o corte documentado

**Decisão.** O `PopoverContent` ganha a prop `largura`, e o `overflow-x-hidden` fica.

```ts
function PopoverContent(props: Omit<ComponentProps<typeof PopoverPrimitive.Content>, "avoidCollisions"> & {
  /** padrao: 288px (256 úteis) · larga: 320px (288 úteis) · conteudo: a largura do conteúdo, com teto pela janela. */
  largura?: "padrao" | "larga" | "conteudo"
}): JSX.Element
```

- **Partes:** `padrao` = `w-72`; `larga` = `w-80`; `conteudo` = `w-auto`. Nas três, **`max-w-(--radix-popover-content-available-width)`**: o teto pela janela, que vale também para as duas fixas na janela de 320px (SUP-07 já limita a altura; agora limita a largura pelo mesmo mecanismo).
- **Por que três, e não um número livre.** Os três consumidores medidos usam exatamente estas três (`w-72` padrão, `w-80` no selo e na vitrine, `w-auto` na escolha na célula). Um número livre seria o `className="w-…"` com outro nome.
- **Por que o corte fica.** Tirar o `overflow-x-hidden` volta a barra lateral da F301 em todo popover com conteúdo que passa 1px. O conteúdo que não cabe é defeito de quem monta (o intervalo lado a lado), e o conserto é a peça que cabe (K2), não a rolagem lateral (D1).
- **Estados:** aberto, fechado, perto da borda (troca de lado), janela estreita (a largura cede ao teto). Nenhum estado novo.
- **Consumidores no kit:** a `EscolhaNaCelula` troca `className="w-auto"` por `largura="conteudo"`; a vitrine `ladrilho-de-cor.tsx` troca `w-80` por `largura="larga"` e fica só com `flex flex-col gap-3` no `className`.

**O comentário da peça documenta** (acrescentar ao JSDoc):

> A largura é uma de três (`largura`): `padrao` (288px, **256 úteis** depois do `p-4`), `larga` (320px, 288 úteis), `conteudo` (a do conteúdo). As três têm teto pela janela. O conteúdo que passa da largura é **cortado, sem rolagem lateral** (`overflow-x-hidden`, de propósito: com `overflow-y-auto`, o eixo x vira `auto` e o popover ganharia barra lateral por 1px). Por isso o que entra aqui tem de caber: dois campos de data lado a lado (cerca de 291px no Chromium) não cabem em nenhuma das fixas — o intervalo vai no `IntervaloDeCampos`, um campo por linha. Não escreva `w-…` no `className`: escolha a `largura`.

### K2 · `IntervaloDeCampos` — peça nova

**Decisão.** Peça nova no registro (item `intervalo-de-campos`, título *Intervalo de campos*), a partir do `Field`/`FieldSet` do shadcn (PECA-02): o `fieldset` com a `legend`, e um campo por linha, rótulo à esquerda e campo à direita, numa grade. Controlada, e é ela que gera os dois `Input`.

```ts
function IntervaloDeCampos(props: {
  /** O que se recorta, com a unidade quando há: "Prazo", "Valor (R$)". Visível, sempre. */
  legenda: string
  tipo: "date" | "number"
  valor: { de: string; ate: string }
  aoMudar: (lado: "de" | "ate", valor: string) => void
  /** Padrão: { de: "De", ate: "Até" }. */
  rotulos?: { de: string; ate: string }
  /** Os limites de fora (o primeiro e o último dia possíveis). */
  min?: string
  max?: string
  /** O lado errado, e a frase quando há. Quem decide o erro é quem chama. */
  erro?: { lado: "de" | "ate"; texto?: string }
  /** Sem ela: a da Table em volta, senão instrumento. */
  densidade?: "instrumento" | "site"
  /** Os atributos que sobram para cada campo (name, autoComplete, onBlur, ref). */
  campoDe?: Omit<ComponentProps<typeof Input>, "id" | "type" | "value" | "onChange" | "min" | "max" | "disabled" | "aria-invalid">
  campoAte?: Omit<ComponentProps<typeof Input>, "id" | "type" | "value" | "onChange" | "min" | "max" | "disabled" | "aria-invalid">
  /** Base dos ids (`${id}-de`, `${id}-ate`, `${id}-erro`); sem ele, useId. */
  id?: string
  className?: string
}): JSX.Element
```

- **Partes:**
  - `fieldset` com `flex min-w-0 flex-col` (o `min-w-0` é obrigatório: o `fieldset` tem `min-inline-size: min-content` por padrão e empurra o popover).
  - `legend` com `mb-1.5`: `t-rotulo` no instrumento, `t-campo` no site.
  - A grade: `grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5`. Na coluna 1, os dois `Label` (`htmlFor` do campo); na coluna 2, os dois `Input` (`w-full min-w-0`, `h-ctrl`, a altura do kit). A coluna dos rótulos tem a largura do maior rótulo, e os dois campos começam no mesmo x.
  - O erro: um `p` na coluna 2, logo abaixo do campo do lado, `t-denso` na tinta de texto da voz `ruim` (`COR_DO_TOM_DENSO.ruim`, de `lib/idioma-de-cor`; COR-06), com `id` `${id}-erro`; o campo do lado ganha `aria-invalid` e `aria-describedby`. Erro sem `texto`: só o `aria-invalid` (o contorno de erro que o `Input` já desenha), sem linha.
- **A amarração das pontas.** O `De` recebe `max = valor.ate || max`; o `Até` recebe `min = valor.de || min`. O seletor nativo não oferece o dia impossível. Não é validação: o valor digitado à mão ainda pode estar fora, e quem chama decide o `erro`.
- **As vozes** (TIPO-02):
  - instrumento: legenda `t-rotulo` (o conjunto), rótulos `Label voz="coluna"` (o valor que se repete). O `Label` ganha a terceira voz, `coluna: "t-coluna leading-none"` (D4).
  - site: legenda `t-campo`, rótulos `Label voz="campo"`.
- **Estados:** vazio (os dois campos vazios, sem limite cruzado); só um lado preenchido (o outro ganha o limite); os dois preenchidos; erro num lado, com e sem texto; no popover padrão (256 úteis); no `Bloco` de formulário, no site. **Fora** (D2): o desabilitado com motivo (`ComMotivo`), o arranjo em linha (lado a lado), a validação própria, a unidade em cada campo (ela vai na legenda) e outros tipos (`time`, `datetime-local`, `month`).
- **Acessibilidade:** o grupo se chama pela legenda; cada campo, pelo rótulo visível (*Prazo, grupo · De, data*). Nada de `aria-label` no lugar do rótulo.

**O comentário da peça documenta:**

> O INTERVALO DE DOIS VALORES (ANATOMIA PECA-01) — *de* e *até* da mesma grandeza, num `fieldset` com a legenda e um campo por linha, o rótulo à esquerda e o campo à direita. Um campo por linha porque dois campos de data lado a lado não cabem no popover (256px úteis): o segundo seria cortado. A legenda diz a grandeza e a unidade; *De* e *Até* são rótulos visíveis (CTRL-04), e cada campo se chama pelo seu. As pontas se amarram (o *De* não passa do *Até* no seletor), mas a peça não valida: o erro é de quem chama (`erro`), e aparece abaixo do campo do lado. No instrumento, a legenda é `t-rotulo` e os rótulos `t-coluna`; no site, as duas `t-campo`. O `fieldset` tem `min-w-0`: sem ele, o mínimo do conteúdo empurra o popover. Não tem desabilitado, nem arranjo em linha.

**Descrição do item no registro** (`packages/registro/lib/itens.mjs`, `pecas: ['label', 'input']`): *"fieldset range — o intervalo de dois valores (de, até): a legenda com a grandeza, um campo por linha com o rótulo visível à esquerda, as pontas amarradas no seletor e o erro do lado abaixo do campo; cabe no popover."*

**Descrição do `label`:** *"label — o rótulo de campo em três vozes: rotulo (o conjunto, maiúsculas espaçadas), coluna (o valor que se repete, mais leve) e campo (13px, para rótulo que é conteúdo)."*

### K3 · `LinhaDoGrupo` — a contagem com unidade, e o *Sem linhas* sem contagem

**Decisão.** A `contagem` passa a aceitar duas formas, e o grupo vazio diz a causa com ou sem contagem.

```ts
contagem?:
  | { feitas: number; total: number }                              // fração: "7 de 10"
  | { total: number; unidade: { um: string; varios: string } }     // quantidade: "3 entregas"
```

- **A forma da quantidade:** o número em `t-medida`, um espaço, a palavra (`um` quando `total === 1`, senão `varios`) em `t-denso`, os dois em `text-foreground-2`, no mesmo lugar fixo da fração (as contagens de uma coluna começam no mesmo x). No estreito, cede em `@max-[5rem]:hidden` (a fração cede em `3.5rem`; a palavra pede mais).
- **Sem trilha.** A quantidade não tem o que concluir: o `progresso` não se desenha com a forma da quantidade (documentado e testado; o tipo não o proíbe, para não trocar a API da prop).
- **A precedência do que aparece no fim da linha do grupo:**
  1. `contagem` com `total > 0`: a contagem (fração ou quantidade), **mesmo que o grupo não tenha linhas** (a lista filtrada, os itens em outra página: o total é de quem chama).
  2. `contagem` com `total === 0`: o `semLinhas`.
  3. **sem `contagem` e sem linhas: o `semLinhas`** (novo; hoje não aparece nada).
  4. sem `contagem` e com linhas: nada, como hoje.
- **O padrão do `semLinhas` fica *Sem linhas*.** Quem chama troca pela causa (*Nenhuma entrega*, EST-02).
- **Quem é atingido pela mudança 3:** só quem tem grupo vazio sem contagem, e hoje esse grupo não diz nada, o que já descumpre a EST-02. Os dois consumidores da `main` passam contagem e não mudam. O piloto apaga o `{ feitas: 0, total: 0 }` fingido (D3).

**O comentário da peça documenta** (no item *Contagem* do JSDoc):

> A contagem tem duas formas: a fração (`{ feitas, total }`, *7 de 10*, com a trilha opcional) e a quantidade (`{ total, unidade: { um, varios } }`, *3 entregas*, sem trilha: não há o que concluir). As duas no mesmo lugar fixo. Com `total > 0`, a contagem aparece mesmo sem linhas (o total é seu). Grupo vazio — `total` 0, ou sem `contagem` e sem linhas — diz o `semLinhas`; troque o padrão (*Sem linhas*) pela causa. Não finja uma fração (`{ feitas: 0, total: 0 }`) para chegar a ele.

**Descrição do item no registro:** *"table/collapsible — o grupo de linhas de uma tabela: o próprio tbody, a linha do grupo no degrau de tinta que abre e fecha, a contagem (a fração ou a quantidade com unidade) e a trilha encostadas no fim (as barras no mesmo x), o grupo vazio que diz a causa, as células alinhadas às colunas, que esvaziam no celular quando a coluna some, e a espera dos grupos."* (`pecas` ganha `'skeleton'`.)

### K4 · A lista agrupada por período (PECA-01)

**Decisão.** Não há peça nova: a lista por período é a `Table` com uma `LinhaDoGrupo` por período. O que faltava era a regra do que cada grupo diz e do que fazer com o vazio, e ela entra como **linha nova da PECA-01**, logo depois da linha *Grupo de linhas numa lista*. A conta dos períodos (que semanas, onde juntar) é do app; uma função que a faça fica em *Pontos a observar*.

- **O período não some quando está vazio.** Uma lista por período que pula a semana sem entrega mente por omissão (EST-04): quem lê *1 a 7 de dez* seguido de *15 a 21 de dez* não sabe se a semana do meio está vazia ou não carregou.
- **Vazios em sequência viram um grupo.** Cinco semanas vazias em cinco degraus empurram a próxima entrega para fora da tela. Um grupo só, com o intervalo no nome (*7 de dez a 10 de jan*) e a extensão no `semLinhas` (*Nenhuma entrega em 5 semanas*), diz o mesmo em um degrau.
- **O período atual nunca se junta** a vazios e abre de início: é o ponto de referência de quem lê.
- **O nome do grupo é o período por extenso;** o atual pode levar o nome relativo antes (*Esta semana · 2 a 8 de nov*) (D6).
- **A contagem é a quantidade com unidade** (K3), não a fração: entregas de um período não são tarefas a concluir.

### K5 · A espera de cada vista (ARQ-01) e a `EsperaDosGrupos`

**Decisão.** A norma sozinha não basta: sem a peça, cada tela monta a espera da lista agrupada à mão, e a do piloto já saiu 8px mais baixa no degrau e com outro recuo. Entram as duas coisas: a frase geral na ARQ-01 (que hoje só existe para a Mesa com abas) e a `EsperaDosGrupos`, exportada de `ui/linha-do-grupo.tsx`, para compartilhar as constantes de altura, vão, ar e recuo com a peça real e não divergir delas.

```ts
function EsperaDosGrupos(props: {
  /** Quantas linhas em cada grupo; um número por grupo. Padrão: [3, 1, 2]. */
  grupos?: readonly number[]
  /** A classe de altura da linha real (`h-10`), como na EsperaDaLista. */
  alturaDaLinha: string
  /** O que o leitor de tela ouve: o que está vindo, não "carregando". */
  rotulo: string
  /** Sem ela: a da Table em volta, senão instrumento. */
  densidade?: "instrumento" | "site"
  /** Reserva a altura do cabeçalho da tabela (40px, com a régua). Padrão: true. */
  cabecalho?: boolean
  className?: string
}): JSX.Element
```

- **Partes:** um `div` com `role="status"` e `aria-busy="true"` e o `rotulo` em `sr-only` (como a `EsperaDaLista`).
  - Com `cabecalho`, uma faixa `h-10` com a régua `border-b border-border` e nada dentro (nenhum nome de coluna fingido).
  - De 8px (12 no site) da régua ao primeiro degrau.
  - Cada grupo: o degrau `Skeleton` `rounded-xl` na altura do degrau real (48px; 56 no site), o ar de 4px (6 no site) e as linhas, recuadas 20px, cada uma uma caixa na `alturaDaLinha` com uma barra `Skeleton h-3` centrada na vertical, em três larguras que se alternam (`w-1/2`, `w-2/3`, `w-5/12`), sem filete.
  - Entre grupos, o vão de grupo aberto: 16px (24 no site).
- **Estados:** espera (pulsa) e espera com movimento reduzido (parada, MOV-02, já do `Skeleton`). Não tem vazio nem erro: quando os dados chegam, a tela troca a espera pela lista; quando falham, pelo `TelaDeErro escala="bloco"`.
- **A `EsperaDaLista` não muda.** Ela é a espera da lista corrida, e segue servindo a ela.

**O comentário da peça documenta:**

> A ESPERA DOS GRUPOS (ARQ-01: a espera tem a forma do que vai chegar) — a espera da lista agrupada, com o degrau, o ar, o recuo e o vão da `LinhaDoGrupo` (as mesmas constantes, para a lista não pular quando chega). Vai no lugar da `Table` inteira, com a régua do cabeçalho reservada (`cabecalho`); a `alturaDaLinha` é a da linha real, como na `EsperaDaLista`. Declara a espera (`role="status"`, `aria-busy`) com o `rotulo` do que vem. A lista corrida espera na `EsperaDaLista`; o quadro, na `EsperaDoQuadro`. A tela com mais de uma vista troca a espera junto com a vista.

**Descrição do `skeleton`** (o item): *"skeleton — a caixa da espera, parada sob movimento reduzido, e a espera de uma lista corrida (a dos grupos está na linha-do-grupo, e a do quadro, no quadro)."*

### As regras que mudam (texto proposto)

**ANATOMIA.md, ARQ-01, a regra** — o parágrafo depois da tabela. Hoje:

> A **Mesa pode não ter primário** quando a tela é de leitura e o gesto mora noutra: o topo é só nome + estado, e o caminho de ação é uma linha com link, nunca um segundo lugar para o mesmo gesto. A **Mesa com abas** põe as abas no lugar do trilho, sem apoio à direita, e o esqueleto de carregamento dela desenha abas, não colunas que a tela não tem.

Passa a:

> A **Mesa pode não ter primário** quando a tela é de leitura e o gesto mora noutra: o topo é só nome + estado, e o caminho de ação é uma linha com link, nunca um segundo lugar para o mesmo gesto. A **Mesa com abas** põe as abas no lugar do trilho, sem apoio à direita.
> **A espera tem a forma do que vai chegar** (EST-01): a tela com mais de uma vista (abas, `BarraDeModos`) espera na forma da vista que está aberta, não na de outra — a Mesa com abas espera em abas; a lista corrida, em linhas (`EsperaDaLista`); a lista agrupada, em grupos (`EsperaDosGrupos`); o quadro, em colunas (`EsperaDoQuadro`). A troca de vista troca a espera junto. A altura, o recuo e o vão da espera são os da peça que vem, e saem da peça, não da tela.

**ARQ-01, o porquê** (acrescentar ao fim):

> A espera de outra forma promete uma tela que não vem, e a de medidas escritas à mão faz a lista pular quando os dados chegam.

**ARQ-01, o confere** (acrescentar): *· `crítica:aderência` (a espera de cada vista, no ateliê, contra a vista que chega).*

**ANATOMIA.md, PECA-01 — a linha *Grupo de linhas numa lista*** (dois trechos):

- Em *a contagem (\*7 de 10\*) em `t-medida`* passa a: *a contagem em `t-medida` — a fração (\*7 de 10\*) ou a quantidade com a unidade (\*3 entregas\*), esta sem trilha —*.
- Em *o grupo vazio fica inerte sem opacidade* passa a: *o grupo vazio fica inerte sem opacidade e diz a causa (`semLinhas`), com ou sem contagem*.
- Na coluna *Não use*, acrescentar: *fração fingida (\*0 de 0\*) para dizer que o grupo está vazio*.

**PECA-01, linha nova** (logo depois da linha *Grupo de linhas numa lista*):

> | Lista agrupada por período (semana, mês) | `Table` com uma `LinhaDoGrupo` por período, na ordem do tempo: o nome do grupo é o período por extenso (o atual pode levar o nome relativo antes: *Esta semana · 2 a 8 de nov*), a contagem é a quantidade com a unidade (*3 entregas*); o período sem itens fica no lugar, como grupo vazio que diz a causa (*Nenhuma entrega*); períodos vazios em sequência viram um grupo só, com o intervalo no nome (*7 de dez a 10 de jan*) e a extensão na causa (*Nenhuma entrega em 5 semanas*); o período atual nunca se junta e abre de início; a espera é a `EsperaDosGrupos` | período vazio que some, um degrau por período vazio em sequência, fração no lugar da quantidade, a data repetida em cada linha no lugar do grupo, cabeçalho de período escrito à mão |

**PECA-01, linha nova** (logo depois da linha *Prazo numa linha*):

> | Intervalo de dois valores (de, até: datas, valores) | `IntervaloDeCampos`: o `fieldset` com a legenda da grandeza (e a unidade) e um campo por linha, com o rótulo visível à esquerda (*De*, *Até*); as pontas amarradas no seletor; o erro abaixo do campo do lado; cabe no popover | dois campos lado a lado com *e* no meio, `fieldset` sem `min-w-0`, `aria-label` no lugar do rótulo visível, intervalo montado à mão |

**PECA-01, a linha *Detalhe sob demanda***:

> | Detalhe sob demanda | `Popover`, numa das três larguras (`largura`: padrão, larga, a do conteúdo) | faixa permanente, `HoverCard`, largura à mão no conteúdo (`className="w-…"`), conteúdo mais largo que o popover (ele corta, sem rolagem lateral) |

**PECA-01, a linha *Carregando***:

> | Carregando | `Skeleton` (lugar), na espera da vista aberta (`EsperaDaLista`, `EsperaDosGrupos`, `EsperaDoQuadro`, ARQ-01); `CarregandoPorCima` (troca de contexto: cobre a região que mente, nunca o casco) | indicador solto, véu `fixed inset-0` à mão, esqueleto de outra vista, degrau ou recuo de esqueleto à mão |

**DESIGN.md, TIPO-02** — não muda: a tabela já diz que `t-coluna` *nomeia um valor que se repete*. O `Label` ganha a voz que a regra já tem. O nome da guarda `o-rotulo-tem-duas-vozes` fala das duas vozes do **rótulo de caixa alta** (`t-rotulo`, `t-coluna`) e segue certo.

**`docs/rastreio/origens-da-base.md`:**

- ARQ-01 (linha 78), acrescentar: *"A espera com a forma da vista aberta, regra geral (era só da Mesa com abas) · revisão da lista por período e do intervalo, F395 (`docs/design/revisoes/2026-11-05-F395-lista-por-periodo-e-intervalo.md`), 05/11/2026, a partir da tela de projetos do piloto WiControl (F389)."*
- PECA-01 (linha 91), acrescentar: *"As linhas da lista agrupada por período e do intervalo de dois valores, a quantidade com unidade e o vazio sem contagem no grupo, as larguras do popover e as esperas na linha do carregando · F395 (mesma revisão), 05/11/2026, a partir do piloto WiControl (F389)."*

**Versão da base:** de 0.21.0 para **0.22.0** nos três arquivos (regra que já existe muda: ARQ-01 e PECA-01). O `CHANGELOG.md` ganha a entrada *Camadas: base, registro*:

- *O que muda:* a lista agrupada por período (o vazio fica, os vazios em sequência se juntam, o atual nunca); a quantidade com unidade e o vazio sem contagem na `LinhaDoGrupo`; a `EsperaDosGrupos`; o `IntervaloDeCampos`; a voz `coluna` do `Label`; a `largura` do `Popover`; a espera com a forma da vista aberta (ARQ-01).
- *Migração:* `npx shadcn add <registro>/popover.json <registro>/label.json <registro>/linha-do-grupo.json <registro>/escolha-na-celula.json <registro>/intervalo-de-campos.json`. Troque `className="w-72"` / `"w-80"` / `"w-auto"` do `PopoverContent` por `largura`. Troque o intervalo montado à mão pelo `IntervaloDeCampos`. Apague a fração fingida (`{ feitas: 0, total: 0 }`) do grupo vazio e passe `contagem={{ total, unidade }}` onde a contagem é quantidade. Troque a espera da lista agrupada montada à mão pela `EsperaDosGrupos`. **Atenção:** grupo vazio sem `contagem` passa a mostrar *Sem linhas*; troque pela causa.

## Estados

| estado | o que a peça mostra | teste que a dona escreve |
|---|---|---|
| 1. Popover nas três larguras | `w-72` / `w-80` / `w-auto`, as três com o teto `max-w-(--radix-popover-content-available-width)` e o `overflow-x-hidden` | sem `largura` tem `w-72`; `larga` tem `w-80` e **não** tem `w-72`; `conteudo` tem `w-auto` e não tem `w-72` (a ausência depois de provar a presença no padrão) |
| 2. Escolha na célula | o mesmo popover de hoje | a `EscolhaNaCelula` abre o popover com `w-auto` e sem `className` de largura |
| 3. Intervalo vazio | dois campos vazios, sem limite cruzado | os dois `Input` existem, com `type` do `tipo`; `De` sem `max` e `Até` sem `min` (sem `min`/`max` de fora) |
| 4. Intervalo com um lado | o outro lado ganha o limite | com `de="2026-11-02"`, o `Até` tem `min="2026-11-02"`; com `ate`, o `De` tem `max`; com `min` de fora e `de` vazio, o `Até` tem o `min` de fora |
| 5. Rótulos e nomes | legenda visível; cada campo pelo seu rótulo | `getByRole('group', { name: 'Prazo' })`; `getByLabelText('De')` e `getByLabelText('Até')` são os dois campos; com `rotulos`, as palavras trocam |
| 6. Erro num lado | `aria-invalid` e a frase abaixo do campo do lado | `erro={{ lado: 'ate', texto: '…' }}`: o `Até` tem `aria-invalid="true"` e `aria-describedby` apontando para o texto; o `De` não tem `aria-invalid`; sem `texto`, nenhum `p` |
| 7. `aoMudar` | o lado e o valor | digitar no `Até` chama `aoMudar('ate', valor)` |
| 8. Vozes do intervalo | instrumento: `t-rotulo` + `t-coluna`; site: `t-campo` + `t-campo` | as classes, nas duas densidades, e com a densidade herdada da `Table` |
| 9. `Label voz="coluna"` | `t-coluna`, sem `t-rotulo` | a classe troca, não empilha |
| 10. Contagem fração | *7 de 10* em `t-medida` | como hoje (fica) |
| 11. Contagem quantidade | *3 entregas* / *1 entrega*, o número em `t-medida` | `{ total: 3, unidade: { um: 'entrega', varios: 'entregas' } }` dá *3* em `t-medida` e *entregas*; `total: 1` dá *entrega*; com `progresso`, nenhuma trilha (provar antes que com a fração a trilha aparece) |
| 12. Contagem com total e sem linhas | a contagem, não o `semLinhas` | `contagem={{ total: 3, unidade }}` com zero filhos mostra *3 entregas* e não *Sem linhas* |
| 13. Vazio sem contagem | o `semLinhas` | zero filhos e sem `contagem`: *Sem linhas* (e o `semLinhas` de quem chama, quando passado); o grupo inerte |
| 14. Com linhas e sem contagem | nada no fim | como hoje (fica) |
| 15. `EsperaDosGrupos` | `role="status"`, `aria-busy`, o `rotulo` | o status tem nome; `grupos={[2, 1]}` desenha 2 degraus e 3 linhas; com `cabecalho={false}`, sem a faixa da régua |
| 16. As medidas da espera e as da peça | a mesma altura de degrau, o mesmo recuo, o mesmo vão | um teste lê as constantes exportadas (ou as classes) da `LinhaDoGrupo` e da `EsperaDosGrupos` e afirma que são iguais, nas duas densidades, depois de afirmar que não são vazias (as duas coisas que devem concordar) |

**Região a região (EST-01), na lista por período:**

| região | carregando | vazio | andando | erro | recusa | sucesso | sem permissão |
|---|---|---|---|---|---|---|---|
| a lista | `EsperaDosGrupos` | a lista sem nenhum período com item: `Vazio` com a causa (`nada-ainda` ou `filtro`), não uma fila de grupos vazios | — | `TelaDeErro escala="bloco"` | — | os grupos | a rota (`TelaDeErro`) |
| um período | — | o grupo vazio com a causa | — | — | — | o grupo com a quantidade | — |
| o filtro de intervalo | — | os dois campos vazios = sem recorte | a lista em espera ao aplicar (da tela) | o erro abaixo do campo do lado | — | a lista recortada | — |

## Movimento

Nenhum novo. O popover abre e fecha como hoje (`duration-menu-abre`/`fecha`, parado com movimento reduzido). A `EsperaDosGrupos` pulsa pelo `Skeleton` e fica parada com `prefers-reduced-motion` (MOV-02). A troca da espera pela lista é instantânea, sem fade: a geometria igual é o que impede o pulo, não uma transição. O grupo abre e fecha como hoje.

## O que sai

- **Da base:** *"e o esqueleto de carregamento dela desenha abas, não colunas que a tela não tem"* (ARQ-01), que vira a regra geral; *"a contagem (\*7 de 10\*)"* como forma única da contagem (PECA-01).
- **Do registro:** o `className="w-auto"` da `EscolhaNaCelula`; o *"em duas vozes"* do comentário do `Label` e da descrição do item; a descrição do `skeleton` que diz *"a espera de uma lista"* sem dizer qual.
- **Do ateliê:** o `w-80` à mão da vitrine (`ladrilho-de-cor.tsx`).
- **Do WiControl** (consumidor; não é deste item, porque o kit não grava em repositório de outro projeto, mas vai no CHANGELOG e no recado à dona do F389): o `IntervaloDeCampos` e a `LinhaDoIntervalo` locais de `FiltrosDaLista.tsx`; o intervalo do prazo em `celulas-da-linha.tsx` (rótulos *Início*/*Término* passam a `rotulos`, a checagem de `validity.badInput` fica no `campoDe`/`campoAte` com `ref` e vira `erro`); a fração fingida em `ProximosGoLives.tsx`; a `EsperaDosProximosGoLives`; o `className="w-80"` do `SeloSomenteLeitura`.

## O que o ateliê mostra

O crítico olha no ateliê (`apps/atelie/src/catalogo/demos/`), nos dois temas, a 1280px e a 360px:

1. **`popover.tsx`** — as três larguras lado a lado, cada uma com o conteúdo real que a pede (a frase da falha no padrão; um selo com duas linhas na larga; o formulário de uma escolha no conteúdo). E um popover padrão com o `IntervaloDeCampos` de datas dentro, aberto perto da borda direita. A 360px, a `larga` e a `conteudo` com o teto pela janela.
2. **`intervalo-de-campos.tsx`** (demo nova, registrada em `demos.ts`) — datas no popover padrão (instrumento); valores com a unidade na legenda (*Valor (R$)*) num `Bloco` de formulário (site); o vazio; um lado preenchido, com o seletor do outro mostrando o limite; o erro no *Até* com texto; o erro sem texto; os rótulos trocados (*Início*, *Término*).
3. **`label.tsx`** — as três vozes, uma ao lado da outra.
4. **`linha-do-grupo.tsx`** — além do de hoje: a quantidade (*1 entrega*, *3 entregas*) e a fração na mesma tabela, para conferir o mesmo x; o grupo com `total` e sem linhas; o vazio sem contagem com o padrão e com a causa; o estreito, com a quantidade cedendo antes do nome.
5. **`_lista-por-periodo.tsx`** (demo nova, ao lado do `_lista-grande.tsx`) — oito semanas: a atual aberta com *Esta semana · …*, uma semana vazia no meio com a causa, uma sequência de cinco vazias juntada num grupo com o intervalo, e uma semana com entrega depois dela. Um botão (`BarraDeModos`: *Lista* · *Por semana* · *Quadro*) que alterna as vistas e um interruptor *simular espera*, que mostra a espera de cada vista no lugar dela.
6. **`skeleton.tsx`** — a `EsperaDaLista` e a `EsperaDosGrupos` (instrumento e site, com e sem `cabecalho`), e a `EsperaDosGrupos` sobreposta à lista real a 50% de opacidade, para ver que o degrau, o recuo e o vão caem no mesmo lugar.
7. **`escolha-na-celula.tsx`** — sem mudança visual depois do `largura="conteudo"` (o crítico confere que não mudou).

## Decisões ao operador

**D1 · O popover segue cortando o que passa da largura** — *assumida, a confirmar*

- **O caso:** o popover do kit esconde o que passa da largura dele, de propósito: a alternativa é a barra de rolagem lateral, que aparecia por 1px de conteúdo (consertada na F301). No piloto, isso cortou o segundo campo de data sem ninguém notar.
- **Se não decidir:** vale a recomendação; o corte fica e o comentário da peça passa a avisar.
- **Recomendação:** manter o corte e resolver o arranjo (um campo por linha, K2) e a largura (K1). Tirar o corte devolve a barra lateral a todo popover para consertar um caso que tem conserto melhor.

**D2 · O intervalo nasce sem desabilitado e sem arranjo em linha** — *assumida, a confirmar*

- **O caso:** o intervalo poderia vir com o modo desabilitado (com o motivo ao lado) e com o modo lado a lado para formulários largos. Nenhuma tela medida usa os dois.
- **Se não decidir:** a peça nasce sem eles; quem precisar pede numa revisão.
- **Recomendação:** sem os dois. O lado a lado é o arranjo que quebrou no popover, e o desabilitado do grupo pede decidir onde mora o motivo (um para os dois campos ou um por campo); sem caso real, a decisão seria chute.

**D3 · O grupo vazio sem contagem passa a dizer *Sem linhas*** — *assumida, a confirmar*

- **O caso:** hoje um grupo sem linhas e sem contagem não diz nada no fim da linha. Para dizer a causa, o piloto finge uma fração *0 de 0*. Com a mudança, todo grupo vazio diz *Sem linhas* (ou a frase que quem chama passar).
- **Se não decidir:** vale a mudança; um app que tinha grupo vazio mudo passa a mostrar *Sem linhas* depois de atualizar.
- **Recomendação:** mudar. O grupo vazio mudo já descumpre a EST-02 (vazio diz a causa), os dois consumidores medidos não são atingidos, e o CHANGELOG avisa.

**D4 · O `Label` ganha uma terceira voz (`coluna`)** — *assumida, a confirmar*

- **O caso:** no intervalo do instrumento, a legenda (*PRAZO*) nomeia o conjunto e *De*/*Até* nomeiam a ponta. A base já tem a voz para isso (`t-coluna`, o valor que se repete, mais leve que o rótulo), mas o `Label` só tem `rotulo` e `campo`. O piloto usou `campo` (13px), que é a voz do site.
- **Se não decidir:** o `IntervaloDeCampos` usa `campo` no instrumento também, e a legenda em caixa alta fica acima de rótulos maiores do que ela.
- **Recomendação:** acrescentar a voz `coluna` ao `Label`. É a voz que a TIPO-02 já define para o papel, e a regra *a voz troca, não empilha* continua valendo.

**D5 · A largura `larga` fica** — *assumida, a confirmar*

- **O caso:** com o intervalo em um campo por linha, nenhum dos casos desta revisão precisa de 320px. Mas o selo do piloto e a vitrine do ateliê já usam `w-80`.
- **Se não decidir:** a `larga` entra.
- **Recomendação:** manter. Sem ela, os dois consumidores voltam ao `className="w-80"` que a PECA-01 passa a proibir.

**D6 · A base pode usar *Esta semana* no exemplo do nome do grupo** — *assumida, a confirmar*

- **O caso:** o nome relativo do período atual (*Esta semana*, *Este mês*) ajuda a achar o presente, mas um nome relativo envelhece se a tela fica aberta de um dia para o outro.
- **Se não decidir:** o exemplo entra, como *pode levar*, não *deve*.
- **Recomendação:** entrar como opção, sempre seguido do período por extenso (*Esta semana · 2 a 8 de nov*): o extenso garante a leitura certa mesmo quando o relativo envelhece.

## O que o crítico confere

1. Os textos de ARQ-01 e PECA-01 estão na base como acima, a versão é 0.22.0 nos três arquivos, o rastreio tem as duas linhas e o `CHANGELOG` a entrada. Nenhuma marca, produto ou domínio do piloto na base (*go-live*, *projeto* como produto): os exemplos são *entregas* e *marcos* (`scripts/base.test.mjs`).
2. No ateliê, **claro e escuro**: o intervalo de datas dentro do popover padrão mostra os dois campos inteiros, com o ícone do calendário à vista, a 1280 e a 360px.
3. A quantidade (*3 entregas*) e a fração (*7 de 10*) na mesma tabela começam no mesmo x, e a quantidade cede antes do nome no estreito.
4. A `EsperaDosGrupos` sobreposta à lista real: degrau, recuo das linhas e vão entre grupos no mesmo lugar, nas duas densidades; nada pula ao trocar a espera pela lista no `_lista-por-periodo`.
5. No escuro, o degrau da espera (`bg-foreground/[0.06]`) ainda se separa do fundo da superfície (o piloto anotou o degrau fraco no escuro; ver *Pontos a observar*).
6. Nenhum `PopoverContent` do registro e do ateliê com `w-…` no `className` (`grep`).
7. Os testes do item 16 de *Estados* (espera × peça) e do 11 (a trilha não aparece com a quantidade) estão colados no PR.

## Pontos a observar (para o `depois`, não para esta rodada)

- **`EsperaDoQuadro` sem `role="status"`.** As outras duas esperas declaram a espera; a do quadro, não. Conserto pequeno, de outro item.
- **Guarda da largura do popover.** A PECA-01 passa a proibir `className="w-…"` no `PopoverContent`; uma guarda que leia isso no projeto (`@wicomm/guardas`) evitaria depender do crítico. Não entra aqui para não mexer no pacote publicado.
- **O degrau da espera no escuro.** O piloto anotou que o `Skeleton` sobre `card` some no escuro. Se o crítico confirmar, o conserto é o degrau de tinta do `Skeleton` (todas as esperas), não um degrau próprio da `EsperaDosGrupos`.
- **A espera com identidade.** Com algum grupo com identidade, o recuo real é 34px e o da espera, 20px: um deslocamento lateral de 14px na chegada, sem pulo vertical. Se aparecer um caso, a espera ganha a prop.
- **Uma função para os períodos.** Juntar os vazios em sequência e nunca juntar o atual é conta que cada app vai repetir. Se um segundo app montar a lista por período, a função (`gruposPorPeriodo`) vira item do registro.
