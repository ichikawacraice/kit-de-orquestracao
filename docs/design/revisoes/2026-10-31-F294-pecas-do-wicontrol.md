# Revisão de arquitetura: F294, as peças que o piloto WiControl pediu

**Fontes lidas, nesta ordem:**
- **PRODUCT:** o repositório não tem. As peças são genéricas, e o papel de quem usa foi assumido.
- **Configuração:** não há `.claude/kit.json` nem `design/wicomm.json`. Valem a largura de 1280 px, o kit em `packages/registro/registry/wicomm/ui/` e as revisões em `docs/design/revisoes/`.
- **Base v0.4.0, lida inteira:** `ANATOMIA.md`, `DESIGN.md`, `CONVENCOES.md`.
- **Plano:** `docs/planos/2026-10-31-F294-pecas-do-wicontrol.md`.
- **Código de hoje:** `confirm-dialog`, `dialog`, `chip-de-estado`, `bloco-de-tinta`, `skeleton`, `painel`, `input`, `label`, `button`, `topo-da-pagina`, `menu` (o precedente do `aria-disabled`), `lib/idioma-de-cor.ts`, os tokens gerados (`packages/tokens/dist/tailwind-v4.css`) e as guardas `nada-de-vidro` e `o-carimbo-tem-forma`.
- **Referência, só leitura:** do WiControl, `faixa`, `medidor`, `progress`, `checkbox`, `badge`, `loading-overlay`, `status-alert` e o `confirm-dialog` de `826c2a4`.
- **Não renderizei.** Toda afirmação de contraste e de cor composta aqui é **a medir** na demonstração do ateliê, nos dois temas, a 1280 px (MED-01, CONV-18).

**Premissas, todas *assumidas, a confirmar*:**
- As duas densidades valem para todas as peças.
- D1…D15 são rótulos locais, não Q-IDs. A dona atribui o Q-ID ao levar a decisão ao operador.

---

## Tarefa
Quem monta uma tela Wicomm encontra no registro **uma peça por função** para seis funções que o piloto teve de fazer à mão:
- confirmar uma ação que roda no servidor;
- marcar;
- mostrar o progresso de uma etapa;
- comparar um número com um teto;
- rotular um valor;
- esperar uma troca de contexto;
- avisar que a tela inteira mente.

Nenhuma dessas funções ganha uma segunda forma.

## Quem e onde
- **Quem:** o dev de projeto que instala `@wicomm/<peça>` e, através dele, quem opera (densidade instrumento) e o cliente (densidade site).
- **Onde:** qualquer arquétipo. A `Faixa` e o `CarregandoPorCima` têm lugar fixo (ver as seções 6 e 7). Pior caso de 1280 px, nos dois temas.
- **Frequência:**
  - alta: `Checkbox`, `Badge` e a confirmação;
  - média: `Medidor` e `Progress`;
  - rara, e por isso crítica: a `Faixa` e o `CarregandoPorCima`, que aparecem quando a tela mente.

## Inventário

| o quê | onde está hoje | decisão que gera | frequência | veredito |
|---|---|---|---|---|
| Confirmação assíncrona (`onConfirmar`) | à mão no WiControl (`826c2a4`): `error.message` cru na tela, destrutivo com classe à mão, rótulo com reticências | "confirmo, e vejo se deu certo sem sair do diálogo" | alta | **fica**, na mesma peça `useConfirm` |
| `checkbox` | à mão no piloto (`rounded-[5px]`, `opacity-50`, `bg-background`) | marcar itens para uma ação em lote; o sim/não de formulário | alta | **fica**, peça nova |
| `progress` | à mão no piloto (`bg-primary`, sem valor escrito) | "em que etapa está, quanto falta" | média | **fica**, peça nova |
| `medidor` | à mão no piloto, com o `Progress` por dentro | "estou perto do teto?" | média | **fica**, peça nova, com o papel `meter` (D7) |
| `badge` | à mão no piloto (gradiente, contorno, hover, outro raio) | ler a classe de um objeto (plano, origem) | alta | **fica**, peça nova, no casco do carimbo |
| `loading-overlay` | à mão no piloto (`fixed inset-0 z-50` por cima do casco) | "espere, o que você vê vai mudar" | rara | **fica** como `carregando-por-cima`, só sobre a região (D10) |
| `status-alert` / `faixa` | `status-alert` com vidro e bisel; `faixa` local com ícone por tom | "a tela mente, e esta é a saída" | rara | **fica** como `faixa`; o `status-alert` **sai** |
| `sheet` | pedido do piloto | — | — | **outra peça:** `DialogLateral` ou `DialogLongo` (seção 8) |
| `tabs` | pedido do piloto | — | — | **outra peça:** `BarraDeModos densidade="abas"` |
| `hover-card` | pedido do piloto | — | — | **outra peça:** `Popover` ou `DicaDeAjuda` |
| `scroll-area` | pedido do piloto | — | — | **outra peça:** `RolagemDoPainel` |
| `command` | pedido do piloto | — | — | **adiada:** `Select` até haver regra |
| Conserto do `link-do-app` | escopo 2 do plano | nenhuma decisão de interface | — | fora desta revisão (é lint) |

## Hierarquia e peso

| peça | peso a 1280 px | o que mostra primeiro |
|---|---|---|
| `useConfirm` | diálogo `sm:max-w-lg` (512 px). Um primário, o confirmar, à direita. A linha de erro tem cerca de 18 px e fica logo acima dos botões | o título (o que vai acontecer). Rodando: o gerúndio no primário |
| `Checkbox` | caixa de 16 px, alvo de 24 px | o estado (marcado ou não) e o texto ao lado |
| `Progress` | uma linha de cerca de 18 px (rótulo e valor) mais a barra de 6 px, na largura de quem a contém | o valor escrito (`3 de 8`); a barra reforça |
| `Medidor` | cerca de 24 px no padrão, cerca de 21 px no compacto (cabe na linha de 40 px) | o número; a barra vem depois |
| `Badge` | a altura do carimbo (cerca de 22 px) | o valor |
| `CarregandoPorCima` | o véu cobre a região que mente; o cartão central tem cerca de 44 px | a frase ("Abrindo a versão") |
| `Faixa` | cerca de 38 px por linha, na largura da página. Na prática 1 ou 2 linhas; no máximo 6 assuntos | o ícone do assunto e a frase; a saída à direita |

## Mensagens

| mensagem | lugar | duração | tom | quem vê |
|---|---|---|---|---|
| "Excluindo" (o `rotuloRodando`) | o primário do diálogo | enquanto roda | `neutro` (em curso, COR-04) | quem confirmou |
| "Não deu para concluir agora. Tente de novo." (o padrão) ou o texto de `descreverErro` | linha `role="alert"` no rodapé do diálogo, acima dos botões | até a próxima tentativa ou até fechar | `ruim` | quem confirmou. O erro cru vai ao `console.error` (de quem opera, MSG-03) |
| "Está demorando mais que o normal. Confira se aconteceu antes de tentar de novo." | a mesma linha | idem | `espera` | quem confirmou |
| Linha da `Faixa` | abaixo do topo (no casco) ou abaixo da barra (no Editor) | enquanto vale; sem X | `espera`, `ruim`, `neutro` ou `alheio` (nunca `ok`) | todos |
| "Abrindo a versão" | o cartão do `CarregandoPorCima`, `role="status"` | enquanto dura, a partir de 120 ms | `neutro` | todos |
| `3 de 8` | ao lado do rótulo do `Progress` | enquanto anda | sem voz (o indicador é a marca) | todos |
| `120 h de —` (sem teto) | o `Medidor` | enquanto vale | `neutro` | todos |
| Campo de marcar inválido | abaixo da `OpcaoDeMarcar` (`aria-describedby`) | enquanto vale | `ruim` | quem preenche |

## Regiões e componentes

### 1. `useConfirm` com `onConfirmar` (a mesma peça, `confirm-dialog`)

**Função e linha da PECA-01:** "Confirmação → `useConfirm`". Não nasce linha nova: a assíncrona é uma opção da mesma peça.

**API proposta** (acrescenta a `OpcoesDaConfirmacao`, sem quebrar quem já usa):
- `onConfirmar?: () => Promise<void>`. Com ela, a ação roda com o diálogo aberto.
- `rotuloRodando: string`, **obrigatório quando há `onConfirmar`**: o tipo recusa compilar sem ele, na mesma forma do par `bloqueia`/`rodape` do `DialogLongo` (D1). É gerúndio, sem reticências (CTRL-07): "Excluindo", "Publicando".
- `descreverErro?: (erro: unknown) => string`. Traduz o erro do projeto em frase de quem usa (409 → "Outra pessoa mudou este relatório. Recarregue antes de excluir."). Se a função faltar, lançar ou devolver vazio, vale o texto padrão.
- `esperaMaxima?: number`, padrão 30 s (D4).
- **O que `pedir()` resolve:**
  - com `onConfirmar`: `true` só depois que a promessa cumpre (e aí o diálogo fecha); `false` em Cancelar, Esc, X, clique fora ou alternativa;
  - a falha **não resolve** a promessa: o diálogo fica aberto;
  - `pedir()` nunca rejeita;
  - sem `onConfirmar`, o comportamento é o de hoje.

**O que trava enquanto roda:**
- Esc e clique fora: `preventDefault`. O `onOpenChange(false)` também é ignorado (duas travas, porque o Radix tem mais de um caminho para fechar).
- O X: `fecharDesligado`, que já existe no `DialogContent` ("visível e desligado, não finge").
- Cancelar e a alternativa: visíveis e `disabled`. O rodapé não pula, e o controle não finge que funciona.
- O corpo: fica `inert` (React 19). O motivo escrito não muda depois de enviado.
- O diálogo declara `aria-busy="true"`.
- Uma `definirPodeConfirmar` chamada enquanto roda é ignorada.

**O foco enquanto roda (D2):**
- O confirmar usa `aria-disabled="true"`, não `disabled`. O `disabled` joga o foco no `body`, e quem está no teclado perde o lugar. O `menu` do kit já faz assim, pelo mesmo motivo.
- O clique e o Enter com `aria-disabled` não fazem nada: nada de clique duplo (EST-03, 1).
- O `button` ganha os estilos `aria-disabled:` iguais aos do `disabled:` (opacidade .42, `cursor-not-allowed`, sem hover).
- Um `role="status"` escondido no rodapé diz o `rotuloRodando` ao leitor de tela: o nome do botão que muda não é anunciado com confiança.
- **Sem círculo girando no botão:** o gerúndio e o desabilitado já dizem "rodando" (o porquê da CTRL-07).

**Onde mora o erro (D3):**
- **Lugar:** uma linha no slot `rodape-do-dialogo`, **acima** do `DialogFooter`. É o ponto do clique (CONV-09) e não rola com o corpo: num diálogo longo, um erro no fim do corpo ficaria fora da vista.
- **Forma:**
  - `CircleAlertIcon` de 14 px e a frase em `t-denso`, os dois em `COR_DO_TOM_DENSO.ruim` sobre o `bg-muted` do rodapé;
  - **sem caixa** (DENS-02: nunca caixa dentro de diálogo).
- **Anúncio:**
  - `role="alert"`, com uma chave por tentativa, para a segunda falha igual ser anunciada de novo;
  - ao tentar de novo, a linha sai na hora do clique.
- **Texto padrão:** "Não deu para concluir agora. Tente de novo." Ele não afirma "nada mudou", porque a peça não sabe se mudou.
- **O que não vai à tela:** o `error.message` cru, nunca (MSG-03). O piloto fazia isso, e é o defeito que esta peça fecha.
- O rótulo do confirmar **não** vira "Tentar de novo": a saída é a mesma ação (MSG-06).

**Espera máxima (D4):**
- Passados 30 s sem a promessa cumprir, a peça trata a espera como desfecho e destrava tudo, com a frase `espera`: "Está demorando mais que o normal. Confira se aconteceu antes de tentar de novo." (EST-03, 4: processo que morreu vira desfecho, não espera eterna).
- Se a promessa cumprir depois, vale o desfecho real: o sucesso fecha, a falha troca a frase.

**Sucesso:**
- O diálogo fecha e o foco segue a lógica de `devolverFoco` de hoje.
- O desfecho é de quem chama:
  - se o efeito é visível (a linha sumiu da lista), basta;
  - se não é, `useToast` depois que `pedir` resolve `true` (MSG-01: o bloco sumiu).

**Tokens:** os da peça de hoje, mais `COR_DO_TOM_DENSO.ruim` e `.espera`. Nenhum valor novo.

**O que NÃO fazer:**
- um segundo diálogo para o erro;
- toast de erro;
- fechar e rodar depois;
- `onConfirmar` para trabalho que enfileira (job): aí se confirma, fecha, e a rodada se observa no chip ou no botão (EST-03, CONV-07);
- `error.message` na tela;
- alternativa assíncrona (fica síncrona, como hoje).

### 2. `checkbox`

**Função:** marcar itens de uma lista para uma ação em lote (EST-03, 2: "sobre o quê") e o sim/não de um formulário que se grava com *Salvar*. **Linha nova da PECA-01** (texto na seção de emendas).

**Partes e API:**
- `Checkbox`: o do shadcn, com os nomes dele (`checked`, `defaultChecked`, `onCheckedChange`, `disabled`, `required`, `name`, `value`, `id`). Leva a classe `peer`, para o `Label` de hoje (`peer-disabled:`) funcionar.
- `OpcaoDeMarcar { rotulo: string; descricao?: React.ReactNode } & PropsDoCheckbox`:
  - a caixa e o `Label voz="campo"`, ligados por `useId` e `htmlFor`;
  - `descricao` em `t-denso text-foreground-2` abaixo do rótulo, apontada por `aria-describedby`;
  - `items-start`, `gap-2`, com a caixa alinhada à primeira linha do texto;
  - a voz é `t-campo` nas duas densidades (D5): o texto da opção é frase, e o `t-rotulo` o poria em caixa alta.
- **Na lista:** o `Checkbox` sozinho, com `aria-label` ("Marcar pedido 1042"); no cabeçalho, "Marcar todos" em indeterminado quando só parte está marcada.

**Forma e tokens:**
- **Tamanho:** caixa `size-4` (16 px, o `xl` da escala de espaço); ✓ e − (`CheckIcon`, `MinusIcon`) de 14 px (CTRL-09).
- **Alvo de clique:** 24 px por um pseudo-elemento (`after:absolute after:-inset-1`), sem mudar o desenho.
- **Raio:** caixa de marcação, 5 px (FORMA-01). O token **não existe** no `@wicomm/tokens`: entra `--radius-marcacao` / `rounded-marcacao` (D5). Sem ele seria `rounded-[5px]`, valor solto.
- **Desmarcado:** `bg-card` e `border-input` (COR-11, 3:1 nos quatro fundos; o piloto usava `bg-background`).
- **Marcado e indeterminado:** `bg-primary border-primary`, o glifo em `primary-foreground`. A marca preenche, não escreve; o branco sobre a marca mede 4,25, acima dos 3:1 de ícone.
- **Desabilitado:** `cursor-not-allowed` e 45% (CTRL-04; o piloto usava 50).
- **Inválido:** `aria-invalid:border-destructive`, como o `Input`.
- **Foco:** o anel da SUP-06.

**Movimento:** só a cor muda (`transition-colors duration-cor`, que dispensa escape). O ✓ entra sem animação (MOV-03).

**Acessibilidade:**
- o `role="checkbox"` e o `aria-checked="mixed"` do Radix;
- o `input` escondido, para formulário nativo;
- desabilitado à vista diz por quê: `ComMotivo` ou a `descricao`.

**O que NÃO fazer:**
- `input type="checkbox"` com classe à mão;
- botão que alterna com ✓;
- `Select` sim/não;
- checkbox que grava na hora sem *Salvar*: a troca imediata é outra função, e a base não tem regra para ela;
- caixa de 14 px sem o alvo de 24 px.

### 3. `progress`

**Função:** progresso de **etapa conhecida**. PECA-01: "Progresso de etapa → `Progress`".

**Partes e API:**
- `Progress { value: number; max: number; rotulo: string; valorEscrito?: string; rotuloSoParaLeitor?: boolean }`.
  - `value` e `max` têm o nome do Radix/shadcn.
  - `max` é **obrigatório**: etapa conhecida tem total.
  - `value: null` (indeterminado) não compila: isso é a `LinhaDeAndamento`, fora do escopo.
- Primeira linha: `rotulo` à esquerda (`t-denso text-foreground-2`) e `valorEscrito` à direita, em `t-medida text-foreground` (padrão: `${value} de ${max}`). Embaixo, a barra. `gap-1.5`.
- `TrilhaDoProgresso` (parte exportada, apresentacional, `aria-hidden`): a barra sozinha, que o `Medidor` reusa (seção 4).

**Forma e tokens:**
- **Trilha:** `bg-foreground/[0.08]`, a mesma tinta de trilha da CTRL-06. Altura 6 px (`h-1.5`, o `sm` da escala); 4 px no compacto. Raio de pílula (D15).
- **Indicador:** o gradiente da marca (`bg-primary-gradient`, MARCA-03), **revelado da esquerda**. O gradiente ocupa a trilha inteira, e o indicador mostra a parte até o valor: em 1 de 8, a ponta é o vermelho escuro.
  - O deslocamento do shadcn (`translateX` de um elemento cheio) mostra só a **ponta clara** no começo.
  - E a ponta clara do claro (`#FF5C96`) contra a trilha mede cerca de 2,6:1 (cálculo meu, **a medir**).
- **Não depende da cor:** o valor é **sempre escrito**, então a barra reforça e não informa sozinha (COR-08, por analogia; D6). Com `rotuloSoParaLeitor`, quem monta já escreve o rótulo e o valor ao lado (é o caso do `Medidor`).
- **Valores fora:** valor não finito não desenha a barra e avisa em desenvolvimento (CONV-17). Valor fora de 0…max é preso ao intervalo.

**Movimento:** **nenhum.** O valor salta de etapa em etapa (D6): a etapa é discreta, e a MOV-03 manda trocar estado sem animar.

**Acessibilidade:** `role="progressbar"` (Radix), `aria-valuenow`, `aria-valuemax`, `aria-valuetext` com o `valorEscrito` e `aria-labelledby` no rótulo.

**O que NÃO fazer:**
- pintar a barra pela voz: a falha é desfecho do bloco, e a barra para e sai;
- `Progress` para o percurso de um objeto (é o `TrilhoDoPercurso`);
- `Progress` para cota (é o `Medidor`);
- porcentagem como valor padrão;
- círculo girando sem texto;
- deixar a barra em 100% na tela como desfecho.

### 4. `medidor`

**Função:** número contra teto. PECA-01: "Número contra teto → `Medidor`". ARQ-02: o painel de análise é Lista com medidores.

**Partes e API:**
- `Medidor { valor: number; teto: number | null; rotulo: string; formatar?: (n: number) => string; tom?: Tom; compacto?: boolean }`.
- **O rótulo à vista** vem de quem monta (o título do bloco, o par da `Ficha`, o cabeçalho da coluna). A peça usa `rotulo` só para o leitor: escrevê-lo de novo duplicaria.
- **Primeira linha:** `formatar(valor)` em `t-medida`, depois " de " e `formatar(teto)` em `text-muted-foreground`. **Embaixo**, a `TrilhaDoProgresso`: 6 px no padrão, 4 px e `gap-1` no compacto. O número fica **sempre em cima**, para as barras de uma coluna começarem no mesmo x.

**Voz (COR-05, COR-06; D8):**
- sem `tom`, o número fica na tinta do texto (`text-foreground`): é conteúdo e não pede nada;
- com `tom`, `COR_DO_TOM_DENSO[tom]` pinta **só o número**;
- quem decide a voz é quem chama; a peça não calcula limite;
- o zero que não informa vai em `tom="neutro"` (EST-04).

**Barra (D7):**
- **Papel `meter`, não `progressbar`:** cota não é progresso. Por isso o `Medidor` usa a `TrilhaDoProgresso`, e não o `Progress`, por dentro. Leva `role="meter"`, `aria-valuemin=0`, `aria-valuemax=teto`, `aria-valuenow` preso ao teto e `aria-valuetext` com o valor real ("230 h de 200 h").
- **Preenchimento neutro** (`bg-muted-foreground`), não o gradiente. Numa Lista com doze medidores, doze barras vermelhas dizem "alarme" sem que nada peça nada, e a marca não responde estado (COR-08). Isto **contesta** o plano ("a barra é o `Progress`"); ver D7.
- **Teto ultrapassado:** barra cheia, número real.

**Sem teto (D8):**
- escreve `de —` em `muted-foreground` e **não desenha a barra**, porque não há fração;
- guarda a altura dela, para a linha não pular na lista;
- sem `role="meter"`, porque `meter` exige máximo;
- o leitor de tela ouve "120 h, sem teto".

**Tokens:** `t-medida`, `COR_DO_TOM_DENSO`, `muted-foreground`, `foreground/[0.08]`, `h-1.5`/`h-1`, `gap-1.5`/`gap-1`. Nada solto.

**Movimento:** nenhum. O valor troca seco.

**O que NÃO fazer:**
- porcentagem sozinha;
- barra pintada de `ruim`;
- gradiente da marca na cota;
- `—` com barra vazia (diria 0%);
- o rótulo escrito duas vezes;
- número fora de `t-medida`.

### 5. `badge`

**Função:** valor rotulado, um valor que **classifica** e não um estado (CTRL-05). PECA-01: "Valor rotulado → `Badge`".

**Partes e API:**
- `Badge { variant?: "neutro" | "marca" } & React.ComponentProps<"span">`. O nome `variant` é o do shadcn, com valores em português.
- Sem `tom` no tipo: o `Badge` com voz é `ChipDeEstado`.
- `span`, não `div` (vive em linha de texto).

**Forma e tokens:**
- `CASCO_DO_CARIMBO`, importado do `chip-de-estado`. Uma forma só; a guarda `o-carimbo-tem-forma` o lê.
- **Neutro (o padrão):** `BADGE_DO_TOM.neutro` (o alfa da COR-07, já medido).
- **Marca, explícito (D9):** `bg-marca-tinta text-foreground`. É o token opaco que já existe (`#FFE9EE` e `#331320`); sobre tinta da marca escreve-se tinta (MARCA-02). Raro: o valor que a Wicomm assina (o plano, o "Recomendado"), no máximo um por vista.

**Estados:** estático. Sem hover nem foco (o piloto tinha os dois). Sem valor, não desenha: nunca carimbo vazio.

**Acessibilidade:** texto puro. Se o valor só faz sentido com o nome do campo, quem monta põe o rótulo ao lado (o `ParDaFicha`).

**O que NÃO fazer:**
- gradiente;
- contorno;
- `variant="destructive"`, `outline` ou `secondary` do shadcn;
- `Badge` como botão;
- número de comparar dentro do carimbo: isso é `t-medida` na célula (TIPO-03);
- `Badge` para estado.

### 6. `carregando-por-cima`

**Função:** troca de contexto. O que está na região deixou de valer até o novo chegar. PECA-01: "Carregando → `CarregandoPorCima` (troca de contexto)".

**Partes e API:**
- `CarregandoPorCima { ativo: boolean; frase: string; className?: string; children: React.ReactNode }`.
- É um **invólucro**, não um irmão solto. Desenha o contêiner `relative`, os filhos e o véu, então ninguém esquece o `relative` (a armadilha que o `Painel` já documenta).

**Escopo (D10):**
- O véu cobre **a região que mente**:
  - no casco, o conteúdo da `PaginaDoApp`;
  - no Editor, as colunas abaixo da `BarraDoEditor`.
- **Nunca o casco.** Destinos, conta e tema valem em qualquer contexto, e a pessoa precisa de uma saída.
- O piloto usava `fixed inset-0 z-50` por cima de tudo.
- A MSG-01 hoje diz "bloqueia a tela inteira": a emenda está abaixo.

**Camada (LAY-05):**
- Fica `absolute inset-0 z-10` **dentro** do invólucro: sem portal e sem a camada 50, que é de sobreposição em portal.
- Diálogos e menus, que vão por portal na camada 50, passam por cima, como devem.

**Forma e tokens:**
- **Véu:** `bg-background/80`, com alfa fixado em teste, como a COR-07. Não é superfície: nada se lê nele. **Sem desfoque** (SUP-02); a guarda `nada-de-vidro` aceita.
- **No centro, um cartão flutuante:** `superficie-flutuante rounded-xl px-4 py-3`, com `LoaderCircleIcon` de 16 px e a frase em `t-denso text-foreground-2`. Em curso é palavra neutra com o indicador (COR-04), e o contraste se mede sobre o `card`, não sobre o que está atrás do véu (CONV-18).

**Tempo (D11):**
- A espera de 120 ms é um **relógio da peça**, não o `delay-veu` do CSS. Com `motion-reduce:animate-none`, que a MOV-02 exige, a animação e o atraso dela somem juntos, e o véu piscaria em toda troca rápida.
- Se `ativo` volta a `false` antes de 120 ms, nada aparece e nada é anunciado.
- Sai seco (MOV-03).

**Acessibilidade:**
- O `role="status"` com `aria-live="polite"` **existe vazio desde a montagem** e recebe a frase aos 120 ms: a região viva precisa existir antes do texto.
- Os filhos ficam `inert` e `aria-busy="true"` **desde o primeiro instante** de `ativo`, e não só depois dos 120 ms: o conteúdo já mente desde o clique, e o Tab não pode chegar a um botão de contexto velho.
- Se o foco estava dentro, vai para o cartão (`tabIndex={-1}`) e volta à região ao sair.

**Desfecho:** a peça não mostra erro. Ela sai, e a falha vai aonde a MSG-04 e a MSG-06 mandam:
- o bloco do gatilho;
- o chip da barra, quando o gatilho era um menu que fechou.

A troca que não termina é de quem chama (EST-03, 4): a peça não tem relógio de desistência.

**O que NÃO fazer:**
- véu no **primeiro** carregamento (aí é `Skeleton`);
- `fixed inset-0`;
- `backdrop-blur`;
- círculo sem frase;
- frase com reticências;
- véu escuro de diálogo (`zinc-950/45`): não é modal;
- animação de saída.

### 7. `faixa`

**Função:** a tela inteira mente se a pessoa não souber (versão, escopo, prévia, conexão), e a saída mora no aviso (MSG-01, MSG-02, MSG-06). Parte do `Alert` (PECA-02). **A linha da PECA-01 muda:** deixa de ser só do Editor.

**Partes e API:**
- `Faixa { linhas: LinhaDaFaixa[]; className?: string }`.
- `AssuntoDaFaixa = "erro" | "desfecho" | "conexao" | "previa" | "versao" | "escopo"`.
- `LinhaDaFaixa = { assunto; frase: string } & ({ tom: "espera" | "ruim"; saida: React.ReactNode } | { tom: "neutro" | "alheio"; saida?: React.ReactNode })`:
  - **sem `ok`:** "deu certo" não faz a tela mentir, e faixa que fica é ruído (D12);
  - **saída obrigatória** onde a voz pede decisão ou conserto (MSG-06).
- **A peça ordena** as linhas pela ordem da MSG-06 (erro, desfecho, conexão, prévia, versão, escopo), seja qual for a ordem da entrada. Assunto repetido avisa em desenvolvimento.
- **Lista vazia** não desenha nada, nem espaço reservado.

**Forma e tokens (D12):**
- **Linha:** `BADGE_DO_TOM[tom]` no contêiner da linha, com tinta e texto declarados uma vez (COR-14).
  - Não é `TINTA_DO_TOM`: a faixa mora no **chão**, e o `bg-muted` neutro mede quase 1:1 contra o `background`.
  - O par do carimbo é o que já está medido nos dois fundos (COR-06: 800/300; COR-07).
- **Medidas:** `px-4 py-1.5`, `gap-3`, `rounded-xl` (raio de agrupador, degrau de tinta).
- **Várias linhas:** um contêiner com `rounded-xl overflow-hidden`, linhas com `gap-0.5` (2 px de ar, o `hairline`). Duas linhas do mesmo tom não se fundem, e não há filete (SUP-03).
- **Ícone pelo assunto, não pelo tom** (COR-08: a forma responde "que tipo de coisa é", a tinta responde "o que pede"; o piloto trocava os canais). Ícone de 16 px, herdando a cor da frase. Proposta, a julgar no ateliê:
  - erro: `CircleAlert`;
  - desfecho: `MousePointerClick`;
  - conexão: `Unplug`;
  - prévia: `Eye`;
  - versão: `History`;
  - escopo: `Filter`.
- **Frase:** `t-denso`, `min-w-0 flex-1`. Quebra, nunca trunca.
- **Saída:** `Button variant="outline" size="sm"`, **a mesma ação** do menu (MSG-06), à direita, `shrink-0`.
  - O andamento dela mora nela (gerúndio, `aria-disabled`).
  - A falha troca a frase da mesma linha para o motivo, em `ruim`, e a saída segue.
  - O anel `input` sobre a tinta 15% não está na lista da COR-11: **medir**. Se cair abaixo de 3:1, a saída vira `secondary sm` (D13).

**Onde mora:**
- **No casco:** entre o `TopoDaPagina` e a região que rola, como irmã na `PaginaDoApp`, com o `gap-6` dela. **Fora** da região que rola: a faixa que rola embora deixa a tela mentir de novo (LAY-01).
- **No Editor:** entre a `BarraDoEditor` e as `ColunasDoEditor`, nunca sobre o canvas (ARQ-03).
- **Fronteira com o `TopoDaPagina desfecho`:**
  - o desfecho do gesto do topo mora no topo, até a próxima ação (MSG-01, "no bloco");
  - vira linha `desfecho` da faixa **só** se, enquanto ele vale, a tela inteira mente (a publicação falhou e o que está no ar é o antigo).

**Acessibilidade:**
- `role` por linha: `alert` no `ruim`, `status` nos outros;
- **sem X:** fechar a faixa faz a tela mentir de novo, e a linha sai quando a condição acaba;
- sem permissão para a saída, a linha vira `alheio` e diz quem resolve; nunca `espera` sem saída.

**O que NÃO fazer:**
- duas `Faixa` na tela (MSG-02);
- ícone por tom;
- `tom` pelo vocabulário do `Alert` (`warning`, `info`);
- vidro e bisel (o `status-alert` do piloto);
- faixa dentro da região que rola;
- faixa sobre o canvas;
- saída que é cópia da ação;
- faixa para desfecho `ok`;
- título em `t-rotulo` (DENS-02).

### 8. As notas das lacunas que não entram

| pedido | nota do plano | veredito, contra a base |
|---|---|---|
| `sheet` | `DialogLateral` | **Confirmo com ressalva (D14).** O `DialogLateral` é **não modal**, para consultar ao lado do trabalho (PECA-01, ARQ-03 abaixo de 1280). O `Sheet` do shadcn costuma ser **modal com formulário**, e para isso a base manda o `DialogLongo` ("conteúdo alto em janela"). A nota diz as duas |
| `tabs` | `BarraDeModos densidade="abas"` | **Confirmo.** CTRL-06: "aba de tela e barra de modos são o mesmo controle". A peça já é `role="tablist"`. A conferir na demo: o `aria-controls` até o painel |
| `hover-card` | `Popover` ou `DicaDeAjuda` | **Confirmo.** PECA-01 proíbe "texto escondido em hover", e a CTRL-08 restringe o hover como pista à barra recolhida. **Achado:** os tokens `espiada-abre`/`espiada-fecha` ("abrir no passar do mouse") existem e nenhuma peça nem regra os usa (D14) |
| `scroll-area` | `RolagemDoPainel` | **Confirmo.** LAY-01 e LAY-06: a rolagem é nativa, com o respiro em três densidades. Mas a PECA-01 **não tem linha** para "coluna que rola": sem ela, não há onde escrever `ScrollArea` em "Não use". Linha nova abaixo |
| `command` | `Select` até haver regra | **Confirmo, e amplio (D14).** A CASCO-01 já nomeia "a busca global" no cabeçalho, sem peça. A fatia do combobox cobre as duas funções. A PECA-01 também **não tem linha** para o `Select`: linha nova abaixo |

## Estados

EST-01, peça por peça ("—" = não se aplica à peça; quem monta decide na tela).

| peça | carregando | vazio | andando | erro | recusa | sucesso | sem permissão |
|---|---|---|---|---|---|---|---|
| `useConfirm` | o corpo com dado usa `Skeleton` de quem monta | — | gerúndio no primário, tudo o mais travado, `aria-busy` | linha `ruim` no rodapé, destrava | a mesma linha, com o motivo do `descreverErro` | fecha, `pedir` → `true` | o gesto que abre não é desenhado (PESO-03) |
| `Checkbox` | `Skeleton size-4 rounded-marcacao` | — | marcados ficam marcados e desabilitados enquanto o lote roda | `aria-invalid` mais a mensagem no campo | desfaz a marca e diz no bloco (CONV-08) | — | desabilitado com `ComMotivo`, ou não desenhado |
| `Progress` | `Skeleton` com a altura da peça | sem etapas não é `Progress` | o único estado | para e sai; o desfecho `ruim` é do bloco | idem | sai; o desfecho `ok` é do bloco | — |
| `Medidor` | `Skeleton` com a altura da peça | `0 h de 200 h` (o zero é número); sem teto, `de —` | — | "não carregou": `—` neutro e a causa no bloco (EST-02) | — | — | não desenha (o bloco decide) |
| `Badge` | `Skeleton` com a altura do carimbo | não desenha | — | — | — | — | — |
| `CarregandoPorCima` | é a própria espera; abaixo de 120 ms, nada | — | véu, cartão e `inert` | sai; o desfecho vai ao gatilho | idem | sai seco | — |
| `Faixa` | — | sem linhas, nada | a saída em gerúndio | a frase da linha vira o motivo, em `ruim` | idem | a condição acaba e a linha sai | a linha vira `alheio`, sem saída |

## Movimento

| peça | entra | sai | movimento reduzido |
|---|---|---|---|
| `useConfirm` | o diálogo de hoje (`duration-modal-abre ease-abre`, 0,97). Rodando e erro trocam sem animar | `duration-modal-fecha` | o `!animate-none` de hoje |
| `Checkbox` | só a cor (`duration-cor`) | só a cor | `transition-colors` dispensa escape |
| `Progress` / `Medidor` | o valor salta | — | — |
| `Badge` | nada | nada | — |
| `CarregandoPorCima` | aos 120 ms (relógio): `animate-in fade-in-0 duration-revela ease-abre`. O círculo com `animate-spin` | seco | `motion-reduce:animate-none` nos dois. A espera de 120 ms continua valendo |
| `Faixa` | `animate-in fade-in-0 duration-revela ease-abre` | seco | `motion-reduce:animate-none` |

## O que sai
- O `status-alert` do piloto: vidro, bisel, `sky` (uma sexta matiz), vocabulário `alert`/`warning`/`info`/`success`.
- O `badge` do piloto: gradiente no carimbo, contorno, hover, `rounded-lg`, `variant="destructive"`.
- O ícone por tom da `faixa` do piloto.
- O `fixed inset-0 z-50` do `loading-overlay`, e o `delay-veu` como única garantia dos 120 ms.
- O `role="progressbar"` dentro do `Medidor`.
- No `confirm-dialog`:
  - o `error.message` cru;
  - "Excluindo..." com reticências;
  - destrutivo com classe à mão;
  - o botão `disabled` que derruba o foco.
- No `checkbox`: o `rounded-[5px]` solto e o `opacity-50`.
- A linha "Aviso do Editor sobre o canvas → `FaixaDoEditor`" da PECA-01 (vira `Faixa`).

## Demonstrações no ateliê

Uma por peça, em `apps/atelie/src/catalogo/demos/`, com `data-vitrine` e os dois temas lado a lado (CONV-23).

- **`confirm-dialog.tsx`** (ampliar a demo que existe):
  - as duas amostras de hoje;
  - "Assíncrona que dá certo" (1,5 s, rodando, fecha, desfecho ao lado);
  - "Falha, e depois dá certo" (com `descreverErro`);
  - "Falha sem `descreverErro`" (o texto padrão);
  - "Passa da espera máxima" (`esperaMaxima` de 3 s, só na demo);
  - uma com `corpo` (o motivo escrito), para ver o `inert`.
- **`checkbox.tsx`:**
  - desmarcado, marcado, indeterminado;
  - desabilitado desmarcado e marcado;
  - inválido com a mensagem;
  - `OpcaoDeMarcar` com e sem `descricao`;
  - uma lista de 4 linhas com "Marcar todos" indeterminado;
  - a caixa sobre `card`, `background`, `muted` e `accent`, para medir o contorno a 3:1.
- **`progress.tsx`:**
  - 0, 1, 3 e 8 de 8;
  - `valorEscrito` próprio ("12 de 40 arquivos");
  - `rotuloSoParaLeitor`;
  - sobre `card` e `muted`;
  - a medida da ponta do indicador contra a trilha em 1/8 e 7/8.
- **`medidor.tsx`:**
  - sem `tom`;
  - `espera` (180 h de 200 h) e `ruim` (230 h de 200 h);
  - zero em `neutro`;
  - sem teto;
  - o compacto numa `Table` de 4 linhas (barras alinhadas);
  - `formatar` de horas.
- **`badge.tsx`:**
  - neutro e marca;
  - ao lado de um `ChipDeEstado` neutro (mesma forma, função diferente);
  - numa linha de `Table`;
  - sobre `card`, `background` e `muted`.
- **`carregando-por-cima.tsx`:**
  - um `Painel` com uma `Ficha`;
  - "Trocar para a versão 2" (2 s: o véu aparece) e "Troca rápida" (80 ms: nada aparece);
  - uma amostra fixa com `ativo` para a captura;
  - um menu aberto sobre o véu, para provar a camada.
- **`faixa.tsx`:**
  - uma linha de cada tom (`espera`, `ruim`, `neutro`, `alheio`);
  - três assuntos dados fora de ordem (a peça ordena);
  - a saída em gerúndio e a saída que falhou;
  - `alheio` sem saída;
  - frase longa que quebra a 1280;
  - dentro de um mini-casco (`TopoDaPagina` + `Faixa` + `Painel`) e de um mini-Editor (`BarraDoEditor` + `Faixa` + colunas).

## Emendas à base (texto exato)

A base sobe a 0.5.0 nos três arquivos. Cada regra mudada (PECA-01, MSG-01, FORMA-01, MOV-03) ganha uma linha em `docs/rastreio/origens-da-base.md`.

**PECA-01, linhas que mudam:**
- `| Valor rotulado (um valor que classifica, não um estado) | `Badge`: neutro por padrão; `variant="marca"` explícito, na tinta da marca com texto em tinta | chip para valor, `Badge` com `tom`, `ChipDeEstado` para valor |`
- `| Número contra teto | `Medidor` (o número em `t-medida` primeiro, a barra depois; `tom` pinta só o número; sem teto, `—` e sem barra), `Medidas` | `Progress` para cota, porcentagem sozinha, barra pintada pela voz |`
- `| Progresso de etapa | `Progress`, com o valor escrito (`3 de 8`) e o indicador no gradiente; `LinhaDeAndamento` para espera de uma linha só, sem etapas conhecidas | indicador girando sem texto, `Progress` sem valor escrito ou pintado pela voz |`
- `| A tela inteira mente se a pessoa não souber (versão, escopo, prévia, conexão) | `Faixa`, uma por tela: uma linha por assunto, na ordem da MSG-06, cada uma com `tom` e a saída; no casco, entre o `TopoDaPagina` e a região que rola; no Editor, entre a `BarraDoEditor` e as colunas | faixas empilhadas, parágrafo vermelho solto, aviso com X, faixa dentro da região que rola ou sobre o canvas |` (substitui "Aviso do Editor sobre o canvas")
- `| Coluna lateral sob demanda (consultar ao lado do trabalho) | `DialogLateral` | painel `fixed` à mão, `Sheet` (o trabalho que pede janela é `DialogLongo`) |`
- `| Troca de vista | `BarraDeModos` / `TrilhaDoSeletor` (`seletor-de-vista`) | botões `secondary`/`ghost` alternados, `Tabs`, `ToggleGroup` |`
- `| Ajuda que não gera decisão | `DicaDeAjuda` (abre no foco e no toque) | texto escondido em hover, `HoverCard` |`
- `| Detalhe sob demanda | `Popover` | faixa permanente, `HoverCard` |`
- `| Confirmação | `useConfirm` (`confirm-dialog`); com `onConfirmar`, a ação roda com o diálogo aberto e a falha aparece nele | `window.confirm`, rodar a ação depois de fechar sem dizer a falha, segundo diálogo para o erro |`
- `| Carregando | `Skeleton` (lugar), `CarregandoPorCima` (troca de contexto: cobre a região que mente, nunca o casco) | indicador solto, véu `fixed inset-0` à mão |`

**PECA-01, linhas novas:**
- Depois de "Escolha com imagem": `| Marcar itens de uma lista, ou o sim/não de um formulário que se grava com *Salvar* | `Checkbox`; com o texto ao lado, `OpcaoDeMarcar`; na lista, a primeira coluna, com "Marcar todos" indeterminado no cabeçalho | caixa à mão, botão que alterna com ✓, `Select` sim/não |`
- Depois de "Lista de objetos": `| Coluna que rola | `RolagemDoPainel`, numa das densidades da LAY-06 | `ScrollArea`, `overflow-y-auto` com respiro à mão |`
- Depois da linha nova do `Checkbox`: `| Escolher um valor de uma lista num formulário (vale com *Salvar*) | `Select` | `Command` (a escolha com busca ainda não tem regra) |`

**MSG-01, linhas que mudam:**
- `| **Faixa abaixo do topo** | **só** quando a tela inteira mente se a pessoa não souber (está editando algo que não está no ar, ou num escopo diferente do normal) | enquanto vale, **com a saída na própria faixa**; sem X | `Faixa` (uma só): no casco, entre o `TopoDaPagina` e a região que rola; no Editor, abaixo da barra | "Você está vendo uma versão que não está no ar" + "Voltar à versão no ar" |`
- `| **Diálogo** | confirmação de ação irreversível ou cara | até a pessoa responder; com `onConfirmar`, até a ação terminar, e a falha fica no diálogo | `useConfirm`, com a variante destrutiva | "Publicar agora?" |`
- `| **Carregando por cima** | troca de contexto: o que está na região deixou de valer até o novo chegar | enquanto dura, a partir de 120ms | `CarregandoPorCima` em volta da região que mente, nunca do casco | "Abrindo a versão" |`

**FORMA-01** (D15): "**pílula** (botão de ícone, contador, alça, trilha de progresso)".

**MOV-03** (D11): "Véu de carregamento só aparece se a espera passar de 120ms (`delay-veu`), **também com movimento reduzido: o escape tira o esmaecer, não a espera**."

**Fora da base:**
- **`@wicomm/tokens`:** `--radius-marcacao: 5px` (D5). A DESIGN já declara o valor.
- **README do registro:**
  - `chip-de-estado` deixa de equivaler a `badge`;
  - `badge` passa a equivaler a `badge`;
  - entram as cinco notas pelo nome do shadcn.

## Decisões ao operador

Todas são *assumidas, a confirmar*: reversíveis e baratas antes do código.

**D1 · O gerúndio é obrigatório na confirmação assíncrona.**
- **O caso:** com a ação rodando dentro do diálogo, o botão precisa dizer o que está acontecendo. Um padrão genérico ("Confirmando") diz pouco.
- **Se não decidir:** cada tela escolhe, e aparecem "Confirmando" e "Aguarde".
- **Recomendação:** o tipo exige `rotuloRodando` quando há `onConfirmar`, como o `DialogLongo` exige o rodapé com `bloqueia`.

**D2 · O botão que roda não perde o foco.**
- **O caso:** botão desabilitado de verdade joga o foco do teclado para o começo da página, e quem usa leitor de tela perde o lugar.
- **Se não decidir:** o piloto já faz assim, e o foco se perde a cada confirmação.
- **Recomendação:** o confirmar usa `aria-disabled` (o `menu` do kit já faz assim) e ignora o clique. O `button` ganha os estilos `aria-disabled:`. Cancelar, X e alternativa ficam `disabled`, e o corpo fica `inert`. Sem círculo no botão.

**D3 · O erro fica no rodapé do diálogo e nunca é o texto técnico.**
- **O caso:** o piloto mostrava a mensagem crua do erro, e ela é de quem opera (MSG-03).
- **Se não decidir:** "Request failed with status 409" chega ao cliente.
- **Recomendação:** uma linha acima dos botões, `role="alert"`. O texto padrão é "Não deu para concluir agora. Tente de novo.", e `descreverErro` traduz o caso conhecido. O erro cru vai ao `console.error`.

**D4 · Uma espera máxima de 30 s destrava o diálogo.**
- **O caso:** com tudo travado, uma requisição que nunca responde prende a pessoa no diálogo para sempre.
- **Se não decidir:** a única saída é recarregar a página (EST-03 proíbe espera eterna).
- **Recomendação:** aos 30 s (`esperaMaxima`), a frase "Está demorando mais que o normal. Confira se aconteceu antes de tentar de novo." e tudo destravado. Se a resposta chegar depois, vale o desfecho real.

**D5 · A caixa de marcar: token de raio, alvo e voz do texto.**
- **O caso:** a base declara o raio de 5 px para a caixa de marcação, mas o pacote de tokens não o gera. A caixa de 16 px é pequena para o dedo. E o texto ao lado, na voz de rótulo, sairia em caixa alta.
- **Se não decidir:** `rounded-[5px]` solto (CONV-04), alvo de 16 px, e cada tela alinha caixa e texto à mão.
- **Recomendação:** `rounded-marcacao` entra nos tokens, o alvo sobe a 24 px sem mudar o desenho, e a `OpcaoDeMarcar` usa `t-campo` nas duas densidades.

**D6 · O progresso sempre escreve o valor, revela o gradiente e salta.**
- **O caso:** a ponta clara do gradiente contra a trilha mede cerca de 2,6:1 no tema claro (estimativa a medir), e o deslocamento do shadcn mostra justo essa ponta no começo.
- **Se não decidir:** a barra informa sozinha com contraste insuficiente, e o início parece rosa-claro.
- **Recomendação:**
  - `max` e o valor escrito são obrigatórios: a barra reforça, não informa sozinha;
  - o indicador revela o gradiente a partir da esquerda;
  - sem animação: a etapa é discreta.

**D7 · O medidor é `meter` e tem preenchimento neutro.** Contesta o plano.
- **O caso:** o plano põe o `Progress` dentro do `Medidor`. Mas cota não é progresso: o leitor de tela anunciaria "barra de progresso" para horas usadas. E numa Lista de análise, doze barras no vermelho da marca dizem "alarme" sem que nada peça nada (COR-08: a marca não responde estado).
- **Se não decidir:** a semântica errada e uma tela de análise vermelha.
- **Recomendação:**
  - o `Medidor` usa a `TrilhaDoProgresso` (a mesma forma) com `role="meter"`;
  - preenchimento em `muted-foreground`;
  - a voz fica só no número.

**D8 · O número sem voz e o teto ausente.**
- **O caso:** a voz `neutro` é cinza de legenda. Um painel com todos os números em cinza perde a hierarquia. E "sem teto" não é "não contado".
- **Se não decidir:** o piloto pintava o neutro de tinta do texto à mão, contrariando o mapa.
- **Recomendação:** sem `tom`, o número fica na tinta do texto; `tom="neutro"` só quando o zero não informa. Sem teto: "de —", sem barra (com a altura guardada) e sem papel `meter`.

**D9 · A tinta do `Badge` de marca.**
- **O caso:** a base diz "sobre tinta da marca, escreve-se tinta", mas não diz qual tinta. O item ativo do menu usa `bg-primary/10`, translúcido. Existe o token opaco `marca-tinta`, que ninguém usa.
- **Se não decidir:** cada projeto escolhe, e o carimbo muda de cor conforme o fundo.
- **Recomendação:** `bg-marca-tinta text-foreground`: opaco, igual sobre qualquer fundo, como pede a "tinta chapada" da CTRL-05.

**D10 · O véu cobre a região, não a página.** Muda o texto da MSG-01.
- **O caso:** a MSG-01 diz "bloqueia a tela inteira", e o piloto cobria até a barra lateral. Mas o menu, a conta e os destinos valem em qualquer contexto, e cobrir tudo tira da pessoa a saída.
- **Se não decidir:** cada projeto escolhe a área, e uma troca lenta prende a pessoa sem navegação.
- **Recomendação:** o `CarregandoPorCima` envolve a região que mente (o conteúdo da página, ou as colunas do Editor), na camada da própria região. A MSG-01 ganha o texto acima.

**D11 · Os 120 ms são um relógio da peça.** Emenda a MOV-03.
- **O caso:** o atraso de 120 ms do CSS some junto com a animação para quem pede movimento reduzido. Para essa pessoa, o véu piscaria em toda troca rápida.
- **Se não decidir:** a regra dos 120 ms falha justo com quem pediu menos movimento.
- **Recomendação:** a espera é um relógio da peça, e o escape tira só o esmaecer. O véu fica em `bg-background/80`, com alfa fixado em teste. A MOV-03 diz isso.

**D12 · A forma da linha da faixa.**
- **O caso:** o piloto usava a tinta de bloco, cujo cinza mede quase 1:1 contra o fundo da página, onde a faixa mora. E escolhia o ícone pelo tom, o que mistura os canais da COR-08.
- **Se não decidir:** a faixa neutra (a de versão, a mais comum) fica quase invisível, e o ícone repete a cor em vez de dizer o assunto.
- **Recomendação:**
  - a linha usa o par do carimbo (`BADGE_DO_TOM`, já medido no fundo e no cartão);
  - o ícone vem do assunto;
  - sem `ok`;
  - saída obrigatória em `espera` e `ruim`;
  - sem X;
  - conferir que a guarda `o-carimbo-tem-forma` aceita o mapa fora do casco do carimbo.

**D13 · O botão de saída sobre a tinta.**
- **O caso:** o contorno de controle só foi medido contra quatro fundos neutros, e a faixa é tingida.
- **Se não decidir:** o botão `outline` pode ficar abaixo de 3:1 na faixa âmbar.
- **Recomendação:** `outline sm`, medido na demo. Se cair, `secondary sm` (superfície de cartão), sem regra nova.

**D14 · As notas das lacunas, com três ajustes.**
- **O caso:**
  - o `Sheet` do shadcn costuma ser modal com formulário, e o `DialogLateral` não é;
  - os tokens de "espiada" (abrir no passar do mouse) existem sem peça nem regra;
  - a busca global do cabeçalho também não tem peça;
  - e a PECA-01 não tem as linhas onde escrever `ScrollArea` e `Command`.
- **Se não decidir:** quem procura o `Sheet` cai num painel não modal para um formulário; os tokens órfãos convidam a um "hover-card" à mão; e as notas não têm onde morar.
- **Recomendação:**
  - a nota do `sheet` diz `DialogLateral` ou `DialogLongo`;
  - entram as duas linhas novas da PECA-01;
  - a fatia do combobox cobre também a busca global;
  - os tokens de espiada ganham dona numa fatia própria (uma regra que os use, ou a revogação).

**D15 · A trilha de progresso entra na lista da pílula.**
- **O caso:** a FORMA-01 lista um raio por classe de peça, e a trilha de progresso não está em nenhuma.
- **Se não decidir:** a barra sai com um raio fora da escala, que a regra chama de defeito.
- **Recomendação:** "pílula (botão de ícone, contador, alça, trilha de progresso)", na mesma subida para a 0.5.0.

---

**Riscos a conferir:**
- `inert` e `aria-busy` nos filhos do `CarregandoPorCima` mudam o foco se o gatilho estava dentro da região. A demo precisa de um gatilho interno para provar a devolução do foco.
- `role="status"` montado já com texto nem sempre é anunciado. Na `Faixa`, a linha que nasce com a página pode passar calada (aceitável: ela é visível e não se fecha).
- A frase da `Faixa` e do erro do diálogo está em `t-denso`, como o desfecho do `TopoDaPagina` e a `TelaDeErro` de bloco. Em densidade site, isso dá 12 px para o cliente. A peça não lê a densidade do app; se a crítica de "cara de site" cobrar, é uma mudança das três peças juntas.
