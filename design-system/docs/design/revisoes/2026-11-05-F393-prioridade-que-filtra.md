# Revisão de arquitetura — a prioridade que filtra e a contagem zerada (F393)

Escopo: a peça **`Prioridade`** (`packages/registro/registry/design-system/ui/prioridade.tsx`), o gesto que ela passa a dividir com o **`ChipQueAbre`** (`ui/chip-de-estado.tsx`), a linha da **PECA-01** (ANATOMIA) e a **COR-09** (DESIGN), com a frase das exceções da **COR-08** e a lista de peças da **CTRL-03**. Aqui não se escreve código de peça. O plugin `wicomm` (congelado por hash) não muda.

Origem: a revisão do QA no WiControl (`docs/design/revisoes/2026-11-04-qa-vista-filtro-prioridade.md`, branch `origin/claude/f388-qa-status-filtro-cor`), decisões **D4** (três carimbos de contagem ao lado do chip *15 pendentes*) e **D5** (o gesto de filtrar fica para o registro), e a crítica **P3** (os carimbos parecem chips e não filtram) e **P4** (o zero perde as barras).

**Fontes lidas:** a base em `plugins/design-system/base/` (0.21.0: ANATOMIA PECA-01, PESO-03, EST-01, EST-03, EST-04; DESIGN COR-03, COR-05 a COR-09, COR-12 a COR-14, CTRL-03 a CTRL-05, SUP-06, MOV-01 a MOV-03; CONVENCOES ACES-01 a ACES-03), o `CLAUDE.md` da pasta `design-system/`, o código de `prioridade.tsx`, `chip-de-estado.tsx`, `com-motivo.tsx`, `lib/idioma-de-cor.ts`, `quadro.tsx`, `table.tsx` (`LinkDaLinha`), os testes `o-quadro.dom.test.tsx` (*a prioridade*) e `as-pecas-dos-blocos.dom.test.tsx` (o `ChipQueAbre` e o alvo dele), a demo do ateliê `apps/atelie/src/catalogo/demos/prioridade.tsx`, `packages/registro/lib/itens.mjs` e a linha de rastreio da COR-09 e da PECA-01. O projeto não tem `design/design-system.json`: a base acima é a norma, e a largura de referência é a padrão, 1280px. Sem tela renderizada: a peça não tem tela própria, e a conferência visual é a do ateliê (ver *O que o crítico confere*).

**O que foi medido** (paleta do `tailwindcss/theme.css` v4, OKLCH → OKLab, ΔE euclidiano; script no scratchpad):

| par | claro | escuro |
|---|---|---|
| texto da Alta × texto do carimbo `ruim` (`red-700` × `rose-800`; `red-400` × `rose-300`) | **0,074** | **0,132** |
| texto da Alta × texto denso da voz `ruim` (`red-700` × `rose-700`; `red-400` × `rose-400`) | **0,042** | **0,031** |

O pedido trouxe 0,038 para o `red-700` × `rose-700`; aqui deu 0,042. A diferença não muda a leitura: os dois ficam no limiar de "mesma cor" para texto pequeno. Os outros números do pedido (Alta 5,57:1 e 5,02:1 sobre o carimbo neutro; carimbo `ruim` 6,33:1; fundos 0,044 e 0,055) são do pedido e não foram medidos de novo. Os contrastes do carimbo neutro (4,86:1 no claro, 4,90:1 no escuro) são os da COR-07 e valem para a zerada sem medição nova, porque ela usa a tinta e o texto do neutro sem mudar nada.

## Tarefa

Quem olha a contagem por prioridade de uma fila **aplica o recorte por nível num gesto** ("só as altas"), no carimbo que já mostra o número, e **lê o zero como zero** sem perder qual nível ele conta.

## Quem e onde

- **Papel:** quem trabalha uma fila com prioridade (na origem, a equipe que pega os itens pendentes do QA). A peça é transversal: o gesto vale em qualquer tela que mostre a contagem por nível.
- **Largura:** 1280px de referência. O carimbo tem a largura da palavra (*3 altas* mede uns 62px). A peça não decide o que acontece abaixo de `lg`: na origem, o grupo some no estreito (P1 da crítica de lá), e essa decisão é da tela.
- **Frequência:** a contagem aparece em toda entrada na tela; o clique, algumas vezes por dia, quando a fila aperta.
- **Densidade:** instrumento (DENS-01) e site (DENS-02). O casco do carimbo é um só (CTRL-05) e não muda com a densidade.
- **Arquétipo:** não é uma tela. A peça mora no slot `estado` do `TopoDaPagina` (Lista, ARQ-01), ao lado do chip a que a contagem se refere. Dentro da linha da tabela e do cartão do quadro, a prioridade continua só leitura (D6).

## Inventário

| o quê | onde | decisão que gera | frequência | veredito |
|---|---|---|---|---|
| Glifo de barras (ou o alerta da urgente) | início do carimbo | que nível é, sem ler | toda leitura | **fica** |
| A palavra, com o número quando é contagem (*3 altas*) | o texto do carimbo, `children` | quantos itens há neste nível, e se começo por eles | toda leitura | **fica**. Quem chama escreve número e palavra concordando (*1 alta*, *0 altas*). A peça não conta nem flexiona (D4). |
| Cor do nível na palavra e nas barras | `COR_DO_NIVEL` | separar os níveis de relance | toda leitura | **fica**, só dentro do carimbo neutro (D5) |
| Tinta neutra do carimbo; a urgente na voz `espera` | casco | só a urgente pede algo a você (COR-03) | toda leitura | **fica** |
| **Gesto `onAbrir`** | o carimbo vira `button` | aplicar o recorte por esse nível | algumas vezes por dia | **entra** (D1) |
| Sublinhado do link (`sublinhado-de-link`) | a palavra, no carimbo que abre | o carimbo abre alguma coisa; o que não tem sublinhado não abre | toda leitura | **entra**, igual ao `ChipQueAbre` (D1) |
| Hover | o carimbo que abre | o ponteiro está no alvo | no gesto | **entra**: o sublinhado fecha de 50% para 100% da tinta da palavra. A tinta do carimbo não muda (D1). |
| Anel de foco (SUP-06) | o carimbo que abre | onde está o teclado | no Tab | **entra** |
| Alvo de 24px por pseudo-elemento (ACES-03) | o carimbo que abre | acertar o clique no touchpad | no gesto | **entra** |
| Desabilitado com motivo | — | nenhuma que a ausência do gesto já não dê | — | **não entra** (D2) |
| `aria-label` próprio | — | nenhuma: o nome é a palavra visível | — | **não entra**: a peça não aceita a prop |
| `aria-pressed` / `aria-expanded` | — | o recorte ligado já aparece no gatilho do filtro da tela | — | **não entra** (D1) |
| **Variante `zerada`** | prop booleana | o nível existe, mas tem 0 itens: não começo por ele | toda leitura com zero | **entra** (D3) |
| `nivel={0}` usado como contagem zero | hoje, na origem | nenhuma: troca o nível por *sem prioridade* e apaga as barras | — | **sai** (D3): `nivel={0}` volta a querer dizer só *sem prioridade* |
| Prop numérica `contagem` | — | duplica o número que já está na palavra | — | **não entra** (D4) |

## Hierarquia e peso

- **A peça não tem ação primária.** O gesto é terciário: a primária da tela continua onde está (PESO-01), e o chip de estado ao lado (`ChipQueAbre`, voz `espera`) pesa mais, porque é a única tinta com matiz no grupo.
- **O carimbo que abre não pesa mais que o que só mostra.** O que muda é o sublinhado a 50% da tinta da palavra, que diz *abre* sem subir de peso. Tinta, raio, tamanho e padding são os do casco (CTRL-05).
- **A zerada pesa menos que as outras:** perde a cor do nível e o sublinhado, e fica no cinza do carimbo neutro. Numa fila *3 altas · 0 médias · 7 baixas*, o olho vai aos dois que têm cor e gesto.
- **Ordem:** quem chama põe os níveis do mais alto para o mais baixo, como na origem. A peça não ordena.

## Mensagens

A peça não tem mensagem própria: a palavra é o conteúdo.

| mensagem | lugar | duração | tom | quem vê |
|---|---|---|---|---|
| *3 altas*, *5 médias*, *7 baixas* | o carimbo, no grupo ao lado do chip a que se refere (o grupo é rotulado por quem chama, como *Por prioridade*) | enquanto o chip existe | não é voz: é a cor do nível (COR-09) | quem vê o chip |
| *0 médias* | o carimbo `zerada` | enquanto o zero vale | `neutro` (EST-04: o zero é o número 0, em neutro) | idem |
| *N urgentes* | o carimbo `urgente` | enquanto N > 0 | `espera` | idem |
| *0 urgentes* | o carimbo `urgente` `zerada` | enquanto o zero vale | `neutro`: zero urgentes não pede nada a você (COR-03) | idem |
| O recorte aplicado | o gatilho do filtro da tela (não o carimbo) | enquanto o filtro vale | — | idem |

## Regiões e componentes

A peça tem uma região: o carimbo. Partes, estados e variantes:

**Partes**
1. **Casco**: `CASCO_DO_CARIMBO`, sem mudança. Tinta `BADGE_DO_TOM.neutro`; na urgente que não está zerada, `BADGE_DO_TOM.espera`.
2. **Glifo**: barras (3, alturas `ALTURA_DA_BARRA`; as `i < nivel` cheias em `bg-current`, as outras a 25%) ou o `CircleAlertIcon` da urgente. Continua `aria-hidden`.
3. **Palavra**: `children: string`, escrita por quem chama, com o número quando é contagem.

**Props novas**
- `onAbrir?: () => void`. Com ela, e sem `zerada`, o elemento é `<button type="button">`; sem ela, segue `<span>`. O `data-slot` continua `prioridade` nos dois.
- `zerada?: boolean` (padrão `false`). Com ela, o elemento ganha `data-zerada`.

**O gesto é um só, escrito uma vez.** O `chip-de-estado.tsx` passa a exportar a string do gesto do carimbo, `GESTO_DO_CARIMBO` (o `relative cursor-pointer`, o pseudo-elemento `after:absolute after:inset-x-0 after:-inset-y-[2px] after:content-['']`, o `sublinhado-de-link`, o `transition-colors duration-cor` e o anel `focus-visible:…` de hoje). O `ChipQueAbre` e a `Prioridade` que abre a usam, sem cópia, pelo mesmo motivo do `CASCO_DO_CARIMBO`: duas cópias do alvo e do anel divergem na primeira correção (CTRL-03 já proíbe copiar o sublinhado).

**Estados e variantes**

| | sem `onAbrir` | com `onAbrir` |
|---|---|---|
| nível 1–3 | `span`; palavra e barras na cor do nível (hoje) | `button`; cor do nível; sublinhado a 50% da cor do nível; hover fecha o sublinhado; foco com o anel; alvo de 24px |
| `urgente` | `span`; voz `espera` (hoje) | `button` na voz `espera`, com o mesmo gesto |
| `nivel={0}` (*sem prioridade*) | `span` neutro, barras a 25% (hoje) | `button` neutro com o gesto. É legítimo: recortar *as sem prioridade*. |
| `zerada` (qualquer nível) | `span`; tinta e texto do carimbo neutro; **as barras do nível ficam** (as `i < nivel` cheias, em `bg-current`, agora o cinza); a urgente zerada fica no neutro com o alerta | **igual à coluna da esquerda**: a peça ignora o `onAbrir`, e o zero não vira botão (D3) |

**Lacunas.** Nenhuma peça nova. O pedido cabe em duas props da `Prioridade` e numa constante exportada do `chip-de-estado`.

## Estados

| estado (EST-01) | o que a peça mostra |
|---|---|
| carregando | nada. A contagem só aparece quando o número chega; a peça não tem esqueleto, e quem chama não a desenha antes. |
| vazio | `zerada`: o número `0`, a forma do nível, sem cor e sem gesto (EST-04) |
| andando | não há. O recorte por nível é síncrono na tela (filtro sobre o que já carregou), e o EST-03 não se aplica. Se um projeto filtrar no servidor, a espera e o desfecho são da região da lista, não do carimbo. |
| erro, recusa | não há: o gesto não grava nada |
| sucesso | a lista recorta, e o gatilho do filtro da tela mostra o valor. O carimbo não muda de aparência. |
| sem permissão | quem não pode recortar recebe o carimbo sem `onAbrir` (PESO-03: o gesto recusado não é desenhado) |
| a contagem cai a zero com o carimbo em foco | o `button` vira `span`, e o foco cai no `body`. É raro (só com o recálculo ao vivo) e foi aceito: a alternativa, manter um botão inerte no Tab, é uma parada morta em toda visita. |

## Movimento

Nada novo. O hover só troca a cor do sublinhado, por `transition-colors duration-cor` (MOV-03), que dispensa escape (MOV-02). A troca entre `zerada` e colorida, quando a contagem muda, não anima.

## O que sai

- O uso de `nivel={0}` para a contagem zero: perde as barras e diz *sem prioridade* com a forma, quando o certo é *zero itens deste nível* (P4 da origem).
- O `button` feito à mão em volta da `Prioridade`, que já era *Não use* por analogia com o `ChipQueAbre` e passa a constar na linha da PECA-01.
- A string do gesto escrita dentro do `ChipQueAbre`, que passa a sair da constante.
- O *desabilitado com motivo* do pedido de origem: não entra (D2).

## Decisões

Tomadas nesta revisão. Todas são reversíveis.

**D1 · O gesto é a prop `onAbrir` na `Prioridade`, não uma peça irmã.** O `ChipDeEstado` e o `ChipQueAbre` são duas peças; aqui não. Com uma `PrioridadeQueAbre` separada, a fileira *3 altas · 0 médias* obrigaria quem chama a escolher a peça pelo número, e essa é a lógica que a `zerada` põe dentro da peça (D3). O nome é `onAbrir`, igual ao do irmão: o carimbo abre a lista recortada, e um nome por gesto de carimbo basta. O nome acessível é a palavra visível (*3 altas*), e a peça não aceita `aria-label`. Sem `aria-pressed` nem `aria-expanded`: o gesto aplica o recorte, não liga nem desliga um estado do carimbo, e o recorte aparece no gatilho do filtro da tela. O hover não muda a tinta do carimbo: a tinta é voz (COR-08), e um degrau de hover sobre a tinta neutra seria um par a medir de novo sem informação nova. Quem diz *abre* é o sublinhado, como no irmão.

**D2 · Desabilitado com motivo não entra.** Três motivos: (a) **PESO-03**: quem não pode recortar não vê o gesto, então o carimbo sem `onAbrir` cobre a recusa; (b) não existe caso conhecido de recorte bloqueado que se mostre (o filtro é da própria tela); (c) o desabilitado do kit é 45% de opacidade (CTRL-04), e o carimbo que informa um número cairia abaixo de 4,5:1, o mesmo defeito que a COR-14 descreve. Se aparecer o caso, ele volta como item, com o `ComMotivo`.

**D3 · `zerada`: a forma do nível, sem a cor, e sem gesto.** Booleana, com padrão `false`. Na zerada, o carimbo usa a tinta e o texto do neutro, mantém as barras do nível (no cinza) e, na urgente, perde a voz `espera` e mantém o alerta. **O zero não abre:** com `zerada`, a peça ignora o `onAbrir` e desenha `span`. O recorte de um nível com zero itens só leva ao `Vazio` de filtro: o gesto custa um clique e devolve nada (PRIN-04). A falta do sublinhado diz que ele não abre, sem precisar de desabilitado.
- **Por que `zerada` e não `apagada`:** `apagada` descreve a aparência e convida a usar a variante para *inativo* ou *filtro desligado*, uma segunda linguagem de estado no carimbo. `zerada` diz a causa e só vale para ela.
- **Alternativa considerada:** uma prop `contagem: number`, que zeraria sozinha no 0. Ficou de fora porque o número já está na palavra, e as duas fontes podem divergir (D4).
- **`nivel={0}` não muda:** continua sendo *sem prioridade*, um valor do item, e não *zero itens*.

**D4 · A peça não conta nem flexiona.** A palavra é `children: string`, e quem chama escreve *3 altas*, *1 alta*, *0 altas*. O vocabulário do nível é do projeto (há projeto com *Crítica* no lugar de *Alta*), e a concordância em português depende da palavra. Pelo EST-04, o zero é o número `0` (*0 altas*), nunca *nenhuma*.

**D5 · A Alta fica no vermelho, e a COR-09 diz por que a cor só existe dentro do carimbo.** Julgamento do item 3 do pedido:
- **As medidas confirmam o risco.** Como texto solto, a Alta e a voz `ruim` são a mesma cor (0,042 e 0,031). Dentro do carimbo, elas se separam por três canais: a tinta (cinza × rosada), o glifo (barras × nada) e o texto (0,074 no claro, 0,132 no escuro).
- **Trocar de família não compra nada.** O laranja é da Média, o âmbar é da `espera`, e as famílias livres já são da pessoa. Um roxo ou um rosa-escuro para a Alta perderia o *alta = vermelho*, que quem usa já lê sem legenda, e cairia em cima do `alheio` (violet) ou da própria `ruim` (rose).
- **A regra já existe em parte.** A COR-09 diz *"o nível da prioridade, só na `Prioridade`"*, e a PECA-01 tem *"cor de nível fora da `Prioridade`"* no *Não use*. Falta o **porquê medido** e o fechamento do único buraco que a F393 abre: a cor do nível no sublinhado e no hover é a da palavra, dentro do carimbo, e isso vale; fora do carimbo nada leva a cor do nível. A frase vai na COR-09 (ver *O que a dona muda*).
- **Recomendo, junto, que a zerada entre na regra:** o zero de uma contagem fica sem a cor do nível. Assim, nenhum vermelho aparece onde não há item alto.

**D6 · O gesto não entra onde já há gesto.** O `LinkDaLinha` cobre a linha inteira com o pseudo-elemento, e o cartão do quadro abre o item. Um `button` de prioridade ali dentro seria gesto dentro de gesto, com dois alvos no mesmo pixel. Na linha e no cartão, a `Prioridade` fica sem `onAbrir`. O lugar do gesto é a contagem no `estado` do topo, ou um grupo de recortes fora da lista.

## O que a dona muda, arquivo por arquivo

Caminhos a partir de `design-system/`.

1. **`packages/registro/registry/design-system/ui/chip-de-estado.tsx`**
   - Exportar `GESTO_DO_CARIMBO` com a string de gesto que hoje está escrita no `ChipQueAbre` (do `relative cursor-pointer` ao `focus-visible:ring-offset-background`), e o `ChipQueAbre` passa a usá-la. O comportamento não muda.
2. **`packages/registro/registry/design-system/ui/prioridade.tsx`**
   - Adicionar `onAbrir?: () => void` e `zerada?: boolean`.
   - Com `onAbrir` e sem `zerada`: `<button type="button" onClick={onAbrir}>`, com `CASCO_DO_CARIMBO`, a tinta, a cor do nível e `GESTO_DO_CARIMBO`. Sem `onAbrir`, ou com `zerada`: o `<span>` de hoje.
   - Com `zerada`: tinta `BADGE_DO_TOM.neutro`, sem `COR_DO_NIVEL` e sem a voz `espera` da urgente; o glifo segue o `nivel` (as barras `i < nivel` cheias; na urgente, o alerta); `data-zerada`.
   - Sem `aria-label` nem espalhamento de props de `button` (o tipo continua fechado): o nome acessível é a palavra.
   - No comentário da peça, citar PECA-01 e COR-09 e o motivo de o zero não abrir.
3. **`packages/registro/test/o-quadro.dom.test.tsx`**, no `describe("a prioridade")`
   - *sem `onAbrir` é texto*: nenhum `button` na peça.
   - *com `onAbrir` é botão com a palavra por nome*: `getByRole("button", { name: "3 altas" })`, `type="button"`, sem atributo `aria-label`, e o clique chama `onAbrir` uma vez.
   - *o gesto é o do `ChipQueAbre`*: as classes de `GESTO_DO_CARIMBO` (lista não vazia, afirmada antes) estão no botão da `Prioridade` **e** no do `ChipQueAbre`. São duas coisas que devem concordar.
   - *o alvo passa de 24px*: o mesmo cálculo do teste do `ChipQueAbre` (`11 × 1,4 + 2 × 3 + 2 × 2 ≥ 24`, com as classes `after:-inset-y-[2px]` e `py-[3px]` presentes).
   - *a zerada guarda a forma sem a cor*: provar antes que a `nivel={3}` sem `zerada` tem 3 barras cheias e as classes do `COR_DO_NIVEL[3]`; depois, a `nivel={3} zerada` tem as mesmas 3 barras cheias, a tinta neutra e nenhuma classe de `COR_DO_NIVEL`.
   - *a urgente zerada fica neutra*: sem `TINTA_DO_TOM.espera` e com o ícone do alerta.
   - *o zero não abre*: provar antes que `nivel={2} onAbrir` é botão; depois, `nivel={2} zerada onAbrir` não tem `button`, e o `onAbrir` não é chamado ao clicar no `span`.
4. **`packages/registro/lib/itens.mjs`** (e o `registry.json` gerado a partir dele, pelo script de sempre)
   - Na descrição da `prioridade`, acrescentar: *"…; com `onAbrir`, aplica o recorte pelo nível; `zerada` mostra a contagem zero na forma do nível, sem a cor."*
5. **`apps/atelie/src/catalogo/demos/prioridade.tsx`**
   - Nova amostra *"A contagem que recorta"*: `3 altas` (nível 3), `0 médias` (nível 2, `zerada`) e `7 baixas` (nível 1), as que não estão zeradas com `onAbrir`, ao lado de um `ChipQueAbre` `espera` (*15 pendentes*), no claro e no escuro. É aqui que o crítico vê o hover, o foco e a zerada.
6. **`plugins/design-system/base/ANATOMIA.md`**, linha *Prioridade de um item* da PECA-01
   - **Peça:** acrescentar *"; com `onAbrir`, o carimbo aplica o recorte pelo nível, com o gesto do `ChipQueAbre` (o sublinhado do link, o anel de foco, o alvo de 24px) e a palavra visível como nome; na contagem, quem chama escreve o número e a palavra (*3 altas*), e o zero é `zerada`: a forma do nível, sem a cor e sem gesto"*.
   - **Não use:** acrescentar *"`button` à mão em volta da `Prioridade`, `nivel={0}` para a contagem zero, `aria-label` que diga outra coisa que a palavra, `onAbrir` dentro da linha ou do cartão que já abre o item"*.
7. **`plugins/design-system/base/DESIGN.md`**
   - **COR-09, Regra:** depois de *"o nível da prioridade, só na `Prioridade`"*, acrescentar: *"A cor do nível só existe dentro do carimbo neutro da `Prioridade`: na palavra, nas barras e no sublinhado da que abre, que é a tinta da palavra. Fora dele (texto solto, ponto, filete, linha, legenda), nunca. O zero de uma contagem (`zerada`) fica sem a cor."*
   - **COR-09, Por quê:** acrescentar: *"Fora do carimbo, a Alta e a voz `ruim` são o mesmo vermelho: ΔEok 0,04 no claro e 0,03 no escuro, contra o texto denso da voz. Dentro, a tinta neutra × rosada, o glifo e o texto (0,07 e 0,13) as separam. Trocar a família da Alta tiraria o 'alta = vermelho' sem ganho, porque as famílias livres já são da pessoa."*
   - **COR-09, Confere:** acrescentar *"registro (a `zerada` sem `COR_DO_NIVEL`)"*.
   - **COR-08:** na frase das exceções, *"a `Prioridade`, cujo glifo e palavra levam a cor do nível"* passa a *"a `Prioridade`, cujo glifo e palavra levam a cor do nível (salvo a contagem zerada)"*.
   - **CTRL-03 (link):** na lista de peças que usam o `sublinhado-de-link`, *"carimbo que abre"* passa a *"carimbo que abre (o `ChipQueAbre` e a `Prioridade` com `onAbrir`)"*.
8. **Versão da base:** `versao` de `0.21.0` para **`0.22.0`** no frontmatter dos três arquivos (`ANATOMIA.md`, `DESIGN.md`, `CONVENCOES.md`). É uma regra que muda e uma variante nova, sem quebra de API: *assumido, a confirmar*.
9. **`CHANGELOG.md`:** entrada `## 0.22.0 · 05/11/2026`, `Camadas: base, registro`.
   - *O que muda*: a `Prioridade` que recorta (`onAbrir`), a `zerada` e a frase da COR-09.
   - *Migração*: `npx shadcn add <registro>/prioridade.json <registro>/chip-de-estado.json`; trocar `nivel={0}` da contagem zero por `nivel={n} zerada`; trocar o `button` à mão em volta da peça por `onAbrir`.
10. **`docs/rastreio/origens-da-base.md`:** nas linhas da **PECA-01**, da **COR-09**, da **COR-08** e da **CTRL-03**, acrescentar *"A prioridade que recorta e a contagem zerada; a cor do nível só dentro do carimbo, com o porquê medido · revisão F393 (`docs/design/revisoes/2026-11-05-F393-prioridade-que-filtra.md`), 05/11/2026, a pedido do piloto WiControl (F388, D4/D5 e crítica P3/P4)."*
11. **Gate:** `cd design-system && npm ci && node ../gate/com-fichas.mjs --quero 4 -- npm test`, com a saída colada no PR. Os testes do registro também (`o-quadro.dom.test.tsx`, `as-pecas-dos-blocos.dom.test.tsx`).

**Não muda:** o plugin `wicomm` (congelado por hash), o `COR_DO_NIVEL`, o `idioma-de-cor` e os consumidores. O WiControl migra no próprio repositório, quando trouxer a peça.

## O que o crítico confere

1. No ateliê, nos dois temas: a fileira *15 pendentes · 3 altas · 0 médias · 7 baixas*. As que abrem têm o sublinhado a 50% da cor da palavra; a zerada fica cinza, com as duas barras de Média, sem sublinhado.
2. O hover fecha o sublinhado sem mudar a tinta do carimbo; o Tab mostra o anel; a zerada não entra no Tab.
3. No claro, a *3 altas* ao lado de um carimbo `ruim` qualquer: os dois se distinguem pela tinta e pelo glifo.
4. A árvore de acessibilidade: o botão se chama *3 altas*.

## Decisões ao operador

Nenhuma bloqueia a execução. Duas foram tomadas aqui e são *assumidas, a confirmar*:

1. **O zero não abre o recorte (D3).**
   - *O caso:* na fileira *3 altas · 0 médias · 7 baixas*, clicar em *0 médias* aplicaria um filtro que mostra uma lista vazia. Decidi que o zero fica sem botão: só aparência, sem clique.
   - *Se não decidir:* vale o que está aqui. O custo é que, se a contagem de um nível cair a zero enquanto o carimbo está com o foco do teclado, o foco volta ao topo da página.
   - *Recomendação:* manter. Um clique que sempre dá em nada é ruído (PRIN-04), e esse foco perdido é raro.
2. **Sem estado desabilitado com motivo (D2).**
   - *O caso:* o pedido de origem citou um carimbo desabilitado com a explicação na dica. Não existe caso conhecido de recorte bloqueado, e o desabilitado do kit (45% de opacidade) derrubaria o contraste do número.
   - *Se não decidir:* quem não pode recortar recebe o carimbo sem gesto, como manda a PESO-03.
   - *Recomendação:* manter fora até aparecer um caso real, que então vira item próprio com o `ComMotivo`.

## Crítica 1 (2026-11-05)

Nota 28/30 (hierarquia 4 · densidade 5 · consistência 5 · ruído 5 · ação primária 5 · aderência 4). Aprovada com ressalvas, as duas atendidas no mesmo PR:
- **P1 (média):** o *Por quê* da COR-09 citava o item (F393) e o ΔEok 0,038, que a medição não repetiu. Volta ao texto do item 7 desta revisão (0,04 e 0,03; dentro do carimbo, 0,07 e 0,13; as famílias livres já são da pessoa), sem ID de item na base.
- **P2 (baixa):** a amostra do ateliê agrupa as contagens em `role="group"` com `aria-label="Por prioridade"`, ao lado do chip, e a primeira fileira ganha um `ChipDeEstado` `ruim` para a conferência da Alta × `ruim`.

## Emenda da D1 (F408, 2026-11-05)

A D1 dizia: sem `aria-pressed`, o recorte aparece no gatilho do filtro da tela. O piloto (WiControl, F406) mostrou que a tela com a contagem por nível não tem gatilho de filtro: o carimbo que filtrou não dizia que estava ligado, e o segundo clique aplicava o recorte de novo em vez de desligá-lo. **Emenda:** a `Prioridade` ganha `ativo?: boolean` e `onDesligar?: () => void`. Com `onAbrir`, `ativo` dá `aria-pressed` e o sublinhado cheio e mais grosso (sem contorno: CTRL-05; 0,48px a 50% da tinta no repouso, 2px a 100% ligado); o clique no ativo chama `onDesligar`, ou `onAbrir` se não houver. `onAbrir(null)` foi descartado: o carimbo não tem chave para passar. Sem `ativo`, vale a D1 como estava. A `zerada` segue sem gesto (D3), exceto a ligada: o recorte que caiu a zero continua ativo (ARQ-05). *Assumida, a confirmar:* se uma tela tiver o gatilho do filtro visível, ela pode não passar `ativo`.

## Crítica 2 (2026-11-05)

Nota 23/30 (hierarquia 4 · densidade 3 · consistência 3 · ruído 5 · ação primária 5 · aderência 3). Volta por: **P1** a barra de abas encolhia por cima da busca no estreito (agora `shrink-0`); **P2** a zerada ligada virava `span` e não se desligava mais (agora segue botão apertado); **P3** a terceira forma de "ligado" contra a D1 (registrada na emenda acima, com o piloto como motivo; o crítico recomendava retirar `ativo`); **P4** comentário citava peça inexistente e faltavam versão e CHANGELOG (feitos).

## Crítica 3 (2026-11-05)

Nota 26/30 (hierarquia 4 · densidade 4 · consistência 4 · ruído 5 · ação primária 5 · aderência 4). Aprovada com ressalvas. P3 (o `Button` encolhia na fileira: agora `shrink-0`) e P4 (amostra da zerada ligada) atendidas neste PR. **Decisões ao operador** (*assumidas, a confirmar*): (1) conferir no ateliê, nos dois temas, se o ligado (2px, 100%) se separa do vizinho sob o mouse (1px passa a 100% no hover); se não, a forma de selecionado da `BarraDeModos` entra e mexe na D1; (2) tipar `ativo` e `onDesligar` juntos e tirar a volta ao `onAbrir`: a emenda mantém a volta ao `onAbrir` porque o piloto usa só `onAbrir`; o tipo mais rígido fica para uma revisão própria.
