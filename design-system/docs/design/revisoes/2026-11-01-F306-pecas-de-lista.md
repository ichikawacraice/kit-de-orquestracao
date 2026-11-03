# Revisão de arquitetura — as peças de lista (F306)

Origem: a revisão de arquitetura das listagens do piloto WiControl (F305, `docs/design/revisoes/2026-11-01-listagens.md` no repositório do WiControl, branch `develop`), seção "Lacunas do registro [F2]". A especificação vem de lá, copiada abaixo como foi aprovada; a seção "O que a execução decidiu" diz onde a peça se afastou dela e por quê.

## O que a execução decidiu

- **`LinhaDoGrupo` sem o `Collapsible` do Radix.** O conteúdo do `Collapsible` é um `div`, e o grupo tem de ser o próprio `<tbody>`; a peça faz a dobra como a `Dobra` do kit (estado de vista, as linhas só montam aberto, `aria-expanded` no alternador).
- **O degrau mora num `div` dentro de cada célula.** Com `border-collapse`, o raio em célula de tabela não se desenha e o `tbody` não aceita margem; o `div` leva o `bg-muted` e o raio, e o vão de 6px é o `pt` da célula nos grupos depois do primeiro. Medido no navegador: 40px (instrumento) e 48px (site), raio 12px, vão 6px.
- **Células alinhadas por posição.** `celulas` ocupa as últimas colunas (uma por coluna) e o `acao` a última; o `th` fica com o resto (`colunas` menos as ocupadas).
- **A identidade do grupo é um encaixe** (`identidade`): o registro ainda não tem `PontoDaEtapa`; quem chama passa o ponto.
- **Monograma em item próprio** (`@wicomm/monograma`), com o `MonogramaAusente` tracejado; o `menu-da-conta` segue exportando `Monograma` e `iniciais`, para quem já importava de lá não quebrar.
- **Pilha com fundo opaco por monograma.** A tinta do monograma é translúcida: sobreposta, mostraria as iniciais do vizinho. Com um a mais que o limite, a pilha mostra a pessoa em vez de *+1*.
- **Prazo: a legenda é relativa ao fim.** *desde 2 jun* não vence e não leva legenda. Com `tom`, o verbo diz o que pede (*vence em 2 dias*); sem `tom`, só o tempo (*em 12 dias*); o passado é sempre *venceu*. O dia de referência (`hoje`) é parâmetro, para a vitrine e o teste serem fixos.
- **Escolha na célula: o estado da gravação é de quem chama** (`gravando`, `recusado`, `aoTentarDeNovo`): a peça não grava nada, só desenha. A margem negativa do gatilho mora na raiz: no botão, ela encolhia a medida e cortava o valor (achado no navegador).

## A especificação (da revisão das listagens)

## A gramática da linha (vale para as quatro listas)

O que dá ritmo não é cor nova. São oito regras repetidas em toda lista, cada uma
dentro da base:

1. **Duas linhas por linha, sempre.** A célula principal tem uma linha **principal**
   (`t-denso` em `text-foreground`; `text-sm` em densidade site) e uma **legenda**
   (`t-denso` em `text-muted-foreground`). Toda linha da lista tem a legenda, então
   toda linha tem a mesma altura: **≈ 48px** em instrumento, **≈ 56px** em site
   (medir no navegador). A linha de 40px fica para a linha de grupo e para lista de
   uma linha só. A hierarquia vem do degrau de tinta (`foreground` →
   `foreground-2` → `muted-foreground`), não de opacidade (COR-14).
2. **Uma medida da marca por linha.** O andamento principal da linha usa
   `TrilhaDoProgresso` no gradiente (`preenchimento="marca"`). Toda outra barra da
   linha usa `preenchimento="neutro"`. Oito barras vermelhas por linha diriam
   "alarme" (o próprio `Medidor` do registro dá esse motivo).
3. **Número em cima, barra embaixo.** É a ordem do `Medidor` do registro, para as
   barras de uma coluna começarem no mesmo x (TIPO-03: número em `t-medida`).
4. **A pessoa tem rosto.** Toda pessoa é `Monograma` (círculo de 20px, CTRL-05) +
   nome. Sem cor por pessoa: seria uma régua de identidade sem pergunta (COR-08,
   COR-09).
5. **Prazo sempre relativo, com voz só quando pede.** A legenda diz *"em 12 dias"*
   em neutro; *"vence em 2 dias"* (`espera`) e *"venceu há 3 dias"* (`ruim`) só
   quando pedem. A data crua fica na linha principal, em `t-medida`.
6. **Um carimbo por linha, o do objeto da linha.** `ChipDeEstado` só para o estado
   do objeto que a linha **é** (o go-live do projeto, o status do item de QA). O
   estado que se repete em sub-linhas (prazo de grupo, prazo de tarefa, etapa do
   portal) usa `Estado` (ponto de 6px + palavra), mais leve.
7. **O topo da escala ganha forma, não cor.** Valor que classifica (criticidade,
   prioridade) é texto em `foreground-2`. Só o topo da escala (*Crítica*,
   *Prioridade 1*, *Alta* no QA) vira `Badge` neutro, o carimbo de valor (PECA-01).
   Peso por forma e por raridade, não por saturação (COR-10, Q721 mantida).
8. **Controle na linha é quieto.** O valor aparece como se lê, com um `▾` de 14px
   ao lado; o formulário mora no menu ou no popover que ele abre. Quem não edita vê
   só o valor (Q716).


### Lacunas do registro [F2]

Nenhuma das quatro existe em `registry/wicomm/`. Cada uma parte do equivalente
shadcn (PECA-02), entra no registro com ateliê (`data-vitrine`) e passa pelo
crítico antes de chegar a uma tela. **Ordem:** L1 (desbloqueia quatro listas) → L2
→ L3 → L4.

**L1 · `LinhaDoGrupo`** (de `Table` + `Collapsible`). Hoje há três construções à
mão do mesmo papel (`ProjectTasks` linhas 3404–3455, `ListaDoPortal`
`GrupoDaLista`, `ProximosGoLives` `LinhaDaSemana`), e o Templates tem a quarta. A
revisão de Projetos já previa a peça *"com dois usos"*.
- **Semântica.** Cada grupo é o próprio `<tbody>`, e a linha de grupo é a
  primeira linha dele, com `th scope="rowgroup"`. O leitor de tela anuncia o grupo
  ao entrar nas linhas.
- **Partes.**
  - alternador: o botão que ocupa a célula do nome, com `aria-expanded` e o
    chevron de 14px em `muted-foreground`, que gira em `duration-dobra-abre
    ease-abre` com escape;
  - identidade (opcional): o ponto de 7px, com a cor de dado do grupo (exceção
    declarada, a de hoje) ou um `PontoDaEtapa`;
  - nome: `t-denso` 600 em instrumento, `text-sm` 600 em site;
  - contagem: *7 de 10* em `t-medida`;
  - progresso (opcional): `TrilhaDoProgresso compacta` marca, `w-24`;
  - medida (opcional): `Medidor compacto`;
  - células alinhadas (opcional): o que mora sob as colunas da tabela, como o
    prazo sob Prazo e a pilha sob Responsável;
  - ação (opcional): `⋯`.
- **Forma.** O degrau de tinta `bg-muted` (SUP-03), com raio de agrupador (12px,
  FORMA-01) nas pontas da linha, e o vão de 6px (`spacing.sm`) antes de cada
  grupo, exceto o primeiro. O vão é da peça, não de cada tela.
- **Estados.**
  - fechado e aberto;
  - vazio: sem linhas, o alternador fica inerte e o chevron não aparece, com o
    espaço guardado; **sem** `opacity-40`, porque sobre tinta a opacidade não dá
    hierarquia (COR-14);
  - concluído: a barra sai e entra `ChipDeEstado ok`;
  - foco: o anel SUP-06 no alternador;
  - a linha não acende no hover, porque não abre objeto.
- **Variantes.** `densidade`: `instrumento` (40px) e `site` (48px).
- **Usos.** Tarefas do projeto, portal (Tarefas e Pedidos adicionais), Próximos
  go-lives (semana), Templates.

**L2 · `Pessoa` e `PilhaDePessoas`** (de `Avatar` / grupo de avatares). O
`Monograma` mora hoje dentro de `menu-da-conta` e as listas o importam de lá;
propõe-se também **tirá-lo para um item próprio** (`@wicomm/monograma`).
- **`Pessoa`.**
  - Partes: monograma de 20px, nome (`t-denso` ou `text-sm`, cortado, com o nome
    inteiro no nome acessível) e papel opcional na legenda (*Gerente*).
  - Estados:
    - com pessoa;
    - sem pessoa: o círculo **tracejado** de 20px em `border-input`, porque a
      tracejada é ausência (FORMA-02), com o texto de quem chama (*Sem
      responsável*) em `muted-foreground`;
    - pessoa sem nome: o id veio e o nome não, então *?* e *Pessoa sem nome*;
    - carregando: `Skeleton` redondo + barra.
  - Variantes: `nome` (à vista) ou `soMonograma` (nome na `Ajuda` e no nome
    acessível; o alvo é focável).
- **`PilhaDePessoas`.**
  - Partes: até `max` (3) monogramas sobrepostos (`-space-x-1.5`) com anel da
    superfície onde mora (`ring-card`, ou `ring-muted` sobre degrau, prop
    `sobre`), *+N* em `t-medida` `muted-foreground` e a `Ajuda` com a frase
    inteira, que também é o nome acessível.
  - Estados: vazia (não desenha), uma pessoa, excedente.
  - Origem: o `PilhaDeMonogramas` local de `QaCollaboration.tsx`, que já se
    declara *"composição LOCAL"* e sobe ao registro.
- **Sem cor por pessoa**, nas duas.
- **Usos.** Gerente (Projetos), responsável (tarefas, QA, quadro do QA),
  responsáveis do grupo (L1), presença no QA.

**L3 · `Prazo`** (sem equivalente shadcn; parte da `Ficha` para o ausente). Hoje
são quatro construções do mesmo fato: `GoLiveDoProjeto`, `CelulasDoPrazoDoGrupo`,
`periodo()` do portal e a data de `ProximosGoLives`. Pelo CONV-15, tem de ser uma.
- **Partes.**
  - a data ou o intervalo em `t-medida` (*24 jul*, *2 jun → 24 jul*, *até 24 jul*,
    *desde 2 jun*; ano só quando não é o corrente; dia em America/Sao_Paulo);
  - a legenda relativa: `Estado` com o `tom` que **quem chama** declara (o limiar
    é do projeto: 7 dias no grupo e na tarefa, 10 no go-live), ou texto neutro
    (*em 12 dias*).
- **Variantes.** `forma="estado"` (sub-linha) ou `forma="chip"` (quando o prazo é
  o estado do objeto da linha: o go-live); `densidade`.
- **Estados.** Com data · sem data (*Sem data*, EST-02) · só a proposta (legenda
  *proposta*, sem voz) · concluído (sem legenda relativa) · parcial (com `Ajuda`,
  *Prazo de 4 de 20 tarefas*).
- **Regra da peça.** Sem `tom`, nunca pinta: é como o portal a usa (Q738).

**L4 · `EscolhaNaCelula`** (de `DropdownMenu`, gatilho `ghost`). São seis usos do
mesmo arranjo na F1 (tarefas: responsável, etapa, prazo; QA: status, prioridade,
responsável).
- **Partes.**
  - o valor como se lê, pela peça de leitura (`Pessoa`, `PontoDaEtapa`, `Estado`,
    texto), **no peso da leitura**;
  - o chevron de 14px sempre à vista em `muted-foreground`: é o único sinal de
    que abre, então paga 3:1 (COR-13);
  - o conteúdo: `GrupoDeEscolhaDoMenu` (a escolha já é a ação, PECA-01), ou
    `Popover` com **Salvar** na variante `popover` (datas).
- **Estados.**
  - repouso: sem contorno nem fundo;
  - hover: `bg-accent` em `duration-cor`;
  - foco: SUP-06;
  - aberto;
  - gravando: inerte, o valor novo na hora, `aria-busy`;
  - recusado: volta o valor antigo e aparece *Não mudou. Tentar de novo* na
    célula (CONV-08);
  - sem permissão: não desenha o gatilho, só a leitura (Q716);
  - recusado pelo estado do objeto: não desenha (PESO-03, *Fora do Wiflow*).
- **Variantes.** `menu` ou `popover`; `densidade`.
- **Camada.** A célula pinta por cima do `LinkDaLinha` (`relative`, a lacuna 2 da
  revisão de Projetos), na própria peça.
