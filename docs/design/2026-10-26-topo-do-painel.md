# Revisão de arquitetura — o topo do pane diz o modo e liga o ausente (F48, bloco B)

- **Data:** 2026-10-26
- **Autora:** D1, designer do pool
- **Estado:** **liberada para execução pela P1 com 22/30** (Q279 decidida); histórico: sobe à planejadora (rodada 1: 19/30; rodada 2: 22/30; rodada 3, a última recrítica permitida: 22/30 com uma ressalva alta, P3-1). Todos os consertos da rodada 3 que cabem à designer estão aplicados; a P3-1 tem uma parte que é do plano (§Decisões, D1-7)
- **Mock:** [`2026-10-26-topo-do-painel-mock.html`](2026-10-26-topo-do-painel-mock.html), estático, claro e escuro, colunas com a largura útil do código (W = 372 e W = 288) e o terminal a 72 e a 40 colunas
- **Plano de origem:** [`docs/planos/2026-10-26-limpeza-com-ok-e-modo-ausente-no-painel.md`](../planos/2026-10-26-limpeza-com-ok-e-modo-ausente-no-painel.md), bloco B. O comportamento (contrato da bandeira, estados do botão, efeito otimista) é do plano; esta revisão decide o texto, a posição, o peso, como o ausente se distingue sem depender só de cor, os 300 px e o terminal.
- **Base:** [`2026-10-25-painel-redesenho.md`](2026-10-25-painel-redesenho.md) (F34) e [`2026-10-26-item-citado-pelo-numero.md`](2026-10-26-item-citado-pelo-numero.md) (F43). O que esta revisão não cita continua como lá.
- **Fontes lidas:** `plugins/painel-sessoes/hooks/register.tsx` (1282 linhas; barra do topo nas linhas ~1030–1036 no desktop e ~1166–1178 no terminal), `hooks/desenho.ts` (820; `CSS`, `em()`, `desde()`, `faixaSvg`), o contrato da bandeira no plano.
- **Pedido do operador:** *"Vamos colocar botões no header do painel, de ligar e desligar o modo ausente, informar qual modo está ativo, e fica um local para possíveis outros botões."*

---

## Tarefa

> **Ao abrir o pane, o operador sabe se está marcado como ausente, desde quando, e o que isso libera; e liga ou desliga com um clique, sem ir ao chat.**

O risco que o desenho combate é **voltar e esquecer o modo ausente ligado**. Com ele ligado, duas coisas mudam, e a faixa diz as duas:
- a orquestradora pode se limpar inteira enquanto o operador lê (D4 do plano);
- sessão nova só abre em turno que o operador começou (trava T3a, `papel-do-pool.mjs`): o resto do pool propõe cartão e espera.

Por isso o ausente pesa mais que o presente, e o texto diz a consequência, sem cortá-la.

**O botão não é o `/ausente on`.** O comando, além de gravar a bandeira, pré-abre o pool para a noite (skill `ausente`, passos 1–6); o botão só grava a bandeira (plano, D7). O toast de ligar diz isso (§2), e se o botão deve equivaler ao comando é decisão do plano (D1-7).

| Pergunta | Onde a faixa responde | Gesto |
|---|---|---|
| Estou presente ou ausente? | `Presente` na fileira, ou a faixa contornada do ausente logo abaixo dela | nenhum |
| Desde quando, e o que isso libera? | dentro da faixa do ausente | nenhum |
| O pane está atualizado? | a hora no próprio botão, `↻ 18:22`; a linha `⚠ Parou há 7 min` quando parou | ↻ |
| Quero mudar o modo | o botão do modo, sempre no canto esquerdo | Ficar ausente / Estou de volta |

## Quem e onde

- O operador, no pane do desktop. O código calcula `W = floor(bodyColumns × 8,75)`, com mínimo de **240**; a coluna de 300 px dá **W = 288**, a de 380 px dá ~**W = 372**. As medidas abaixo usam 288 e 240.
- O modo muda **poucas vezes por dia** (ao sair e ao voltar), e o topo é lido **em toda olhada**: leve no presente, impossível de não ver no ausente.
- O terminal ganha o mesmo modo, os mesmos rótulos e o mesmo botão (§5).

## Inventário

| O quê | Onde está hoje | Decisão que gera | Frequência | Veredito |
|---|---|---|---|---|
| "Atualizado 18:22" | `Text` à esquerda da barra | confiar no que vê | rara | **muda:** a hora entra no botão, `↻ 18:22`, como o terminal já faz (§2) |
| "⚠ Parou há 7 min" | o mesmo `Text`, em vermelho | reler | rara | **muda:** linha própria, em `er`, sob a fileira, só quando parou (§1) |
| ↻ Atualizar | `Button secondary` à direita | reler | rara | **fica** à direita, com a hora no rótulo |
| Modo ativo | **em lugar nenhum** (só o `/ausente` sem argumento, no chat) | lembrar de voltar | toda olhada | **novo** (§1) |
| Ligar / desligar o ausente | só `/ausente on|off` no chat | sair, voltar | poucas por dia | **novo:** botão no canto esquerdo (§2) |
| Lugar para botões futuros | — | — | — | **novo:** à direita do botão do modo (§2) |
| Faixa "Resposta não entregue" | sob os contadores | — | rara | **muda o título:** "Ação não concluída" (§3) |

## Hierarquia e peso

A faixa do topo substitui a barra de hoje: um `Box flexDirection="column"` **sem `gap`** (no motor, `gap={1}` é uma linha de texto inteira), o primeiro filho do pane. De cima para baixo:

1. **A fileira, sempre a primeira e sempre igual:** `Box row alignItems="center" flexWrap="wrap" columnGap={1}`:
   - **à esquerda**, `Box row columnGap={1}`: o botão do modo (`key="modo"`) e, depois dele, os botões futuros;
   - **à direita**, `Box row columnGap={1} alignItems="center" flexGrow={1} justifyContent="flex-end"`: a palavra do modo quando não há faixa (`Presente`, `Modo não lido (vale presente)`), num `Svg` estreito, e o botão `↻ 18:22` (`key="atualizar"`, `autoFocus`).
   - O `flexGrow` com `flex-end` é o que mantém o ↻ no canto direito **também quando o grupo desce para uma 2ª fileira** (W = 240, ou um botão futuro a 288): com `space-between`, o item que fica sozinho na fileira de baixo iria para a esquerda. O motor não tem `marginLeft="auto"`.
   - O `autoFocus` no ↻ mantém o primeiro foco de teclado onde ele está hoje: Tab + Enter continua relendo, e não troca o modo, mesmo com o botão do modo desenhado antes.
2. **A linha `⚠ Parou há 7 min`**, um `Svg` de 20 px em `er`, só quando a leitura parou.
3. **A faixa do ausente**, um `Svg` na largura W, só no ausente.

Depois vêm os contadores, como hoje.

**Os botões não mudam de lugar.** O do modo está sempre no canto esquerdo da 1ª fileira; o ↻, sempre no canto direito. Trocar o modo muda o rótulo e o que aparece **abaixo** da fileira, nunca a posição do botão: o mesmo ponto que ligou desliga. Nenhum botão da faixa é `primary`: a ação primária do pane continua sendo responder a pergunta.

| Modo | O topo | Altura (sem os contadores) |
|---|---|---|
| Presente | `[Ficar ausente]` ……… `Presente` `[↻ 18:22]` | uma fileira, ~28 px: **a mesma da barra de hoje** |
| Ausente | `[Estou de volta]` ……… `[↻ 18:22]` + a faixa | 28 + 66 (ou 82) |
| Modo não lido | ……… `Modo não lido (vale presente)` `[↻ 18:22]` | uma fileira |
| Antes da 1ª leitura | ……… `[Lendo…]` | uma fileira |
| Leitura parada | a fileira + `⚠ Parou há 7 min` (+ a faixa, se ausente) | + 20 px |

### A faixa do ausente

- **Sem preenchimento.** O texto fica sobre o fundo do pane, onde todas as classes passam de 4,5:1 nos dois temas (medido na recrítica: `s` 5,35, `m` 5,05, `er` 5,35 no claro).
- **Contorno de 1,5 px em lilás**, raio 8, com uma classe de traço nova, `.lis{stroke:#5b5cd6}` / escuro `#8b8cf8`: **o mesmo valor do `li`**, só que como traço. Nenhuma cor nasce nova. Contraste do contorno: 5,32:1 no claro e 5,65:1 no escuro contra o fundo; 4,80:1 contra os quadros dos contadores.
- **Sem filete à esquerda.** O contorno já dá a cor e a borda; um filete dentro de um retângulo arredondado pediria `clipPath` só para repetir o mesmo sinal.
- Três linhas: `☾ Ausente há 3 h`; `desde 14:05 · a orquestradora pode se limpar`; `sessões novas só abrem com você`. O `Svg` tem 4 px de respiro em cima (a distância da fileira), então a faixa desenhada mede **62** (frase da orquestradora numa linha) ou **78** (quebrada), e o `Svg`, **66** ou **82**.
- Por dentro: 12 px de cada lado. Largura útil = W − 24: **264 a 288**, **216 a 240**.

**O ausente se distingue do presente por cinco coisas, e só uma é cor:**
1. **forma:** um bloco contornado onde, no presente, não há nada; é o único contorno do topo (os quadros dos contadores são preenchidos);
2. **altura:** o topo cresce 50 ou 66 px;
3. **sinal:** o ☾ antes da palavra;
4. **peso e palavra:** `Ausente há 3 h` em `t` 13/700 contra `Presente` em `s` 12,5/600;
5. **cor:** o contorno e o ☾ em lilás.

**Por que lilás:** o âmbar é de "espera você" e o vermelho de "travou"; usar um deles faria a faixa gritar sem nada a responder. O lilás já marca no pane as etapas em que o trabalho anda **sem o operador** (planejamento, design), e "ausente" é isso. *Limite aceito:* o lilás passa a ter dois usos; o que impede ler a faixa como "um item em planejamento" é o lugar (acima dos contadores, onde não há item), o contorno, o ☾ e a palavra `Ausente`.

### Textos que cabem (medidos com o `em()`; texto em 700 com +10%, que é o que a fonte real mede a mais)

| Texto | Tamanho | Largura | A 288 | A 240 |
|---|---|---|---|---|
| fileira presente: `Ficar ausente` (82,8 + 22 de cromo) + 8 + `Presente` (55,5) + 8 + `↻ 18:22` (46,8 + 22) | 12,5 | **246** | cabe, 42 de folga | **não** (6 px): o grupo da direita desce para uma 2ª fileira, pelo `flexWrap` |
| fileira ausente: `Estou de volta` (108) + 8 + `↻ 18:22` (69) | 12,5 | 185 | cabe | cabe |
| fileira presente + um botão futuro de ~80 px | — | ~334 | desce para a 2ª fileira | idem |
| `☾ Ausente há 40 min` (o mais largo; `há 2 d` = 102) | 13/700 | 122,7 → **135** | útil 264: cabe | útil 216: cabe |
| `desde 14:05 · a orquestradora pode se limpar` | 12 | 261,1 | cabe por 3 px (a fonte real mede 257) | **quebra** |
| `desde ontem 22:10 ·` / `a orquestradora pode se limpar` | 12 | 117,8 / 177,1 | **quebra**; cada uma cabe | quebra; cada uma cabe |
| `sessões novas só abrem com você` | 12 | 188 | cabe | cabe |
| `Modo não lido (vale presente)` | 12,5/600 | 167 (+10%: 184) | com o ↻: 261, cabe | desce para a 2ª fileira |
| `⚠ Parou há 7 min` | 12 | 92,4 | cabe | cabe |

**Quem quebra a fileira é o `flexWrap` do motor, não o código.** As somas acima (botões com ~22 px de cromo, vãos de 8) são estimativas do que cabe; quando não cabe, o grupo da direita desce inteiro e continua no canto direito pelo `flexGrow`. Um botão futuro não pede regra nova.

**O `Presente` fica junto do ↻, e não do botão do modo** (limite aceito, P3-8): o lugar do botão do modo é o canto fixo, e a palavra ao lado dele mudaria de lugar o que se clica. O ↻ tem largura mínima igual à de `↻ 00:00` (~69 px), para o `Lendo…` (mais estreito) não fazer o `Presente` andar a cada releitura.

## 1. O modo (`modoSvg`)

`modoSvg(W, { modo, desde, agora }) → { source, alt, height }` desenha **a faixa do ausente**, e `rotuloModoSvg(modo) → { source, alt, width }` desenha a palavra estreita da fileira (`Presente`, `Modo não lido`). `parouSvg(W, texto)` desenha a linha `⚠ Parou há 7 min`. As três não leem arquivo: recebem o modo pronto.

| Modo | Na fileira, à direita | Abaixo da fileira |
|---|---|---|
| `presente` | `Presente`, `s` 12,5/600 | — |
| `ausente` | — | a faixa: `☾` em `li` + `Ausente há 3 h`, `t` 13/700; `desde 14:05 · a orquestradora pode se limpar`, `s` 12, numa linha; quando não cabe, **quebra no ` · `** e vira duas (`desde 14:05 ·`, `a orquestradora pode se limpar`), nunca no meio da frase e nunca cortada; por último, `sessões novas só abrem com você`, `s` 12 |
| `desconhecido` (JSON inválido, `ausente: null`) | `Modo não lido (vale presente)`, `m` 12,5/600, itálico: pelo contrato, arquivo inválido = desligado para as travas | — |
| `lendo` (antes da 1ª leitura) | — | — |

- **"há X"** usa o `desde()` do pane, sem mudança: `há 40 min`, `há 3 h`, `há 2 d`. Abaixo de 1 min: `Ausente agora`.
- **`desde` no futuro** (relógio torto): o `desde()` devolve `undefined` para mais de 60 s à frente; a `modoSvg` trata isso **fora** dele e escreve `Ausente agora`. O `desde()` não muda (ele serve aos cartões).
- **"desde"** é a hora local `HH:MM` quando é hoje; `ontem HH:MM`; `DD/MM HH:MM` antes disso.
- **As duas frases de consequência** são as duas coisas que o modo muda (§Tarefa): a limpeza inteira da orquestradora sem o ok (D4 do plano) e a trava T3a.
- **`alt`:** `Modo presente.` / `Modo ausente há 3 h, desde 14:05: a orquestradora pode se limpar sozinha, e sessão nova só abre num turno seu.` / `Não consegui ler o modo ausente; para as travas, vale presente.`

## 2. Os botões

| Lugar | Botão | Quando aparece |
|---|---|---|
| canto esquerdo | **Ficar ausente** (no presente) / **Estou de volta** (no ausente) | quando o modo foi lido (`presente` ou `ausente`) |
| à direita dele | os botões futuros, em ordem de chegada | — |
| canto direito | **↻ 18:22** (a hora da última leitura) | sempre; `Lendo…` enquanto lê, como hoje; `↻ ler` antes da 1ª leitura boa (sem hora para mostrar) |

- **O rótulo é o gesto, não o estado.** O estado está ao lado (`Presente`) ou abaixo (a faixa); um botão "Ausente: ligado" obrigaria a adivinhar se clicar liga ou desliga.
- **O ↻ leva a hora**, como o terminal já faz (`↻ 18:22`). Assim o `Presente` ao lado dele não é lido como "presente desde 18:22": a hora está dentro do botão de reler. O `Button` não tem `alt`: o nome acessível vai no `label`, `<Button key="atualizar" label="Atualizar (última leitura às 18:22)">↻ 18:22</Button>`.
- **O botão do modo tem `key="modo"` fixa** nos quatro rótulos (`Ficar ausente`, `Ligando…`, `Estou de volta`, `Desligando…`), para o motor reencontrá-lo depois do redesenho e o foco do terminal não se perder. `label`: `Ligar o modo ausente` / `Desligar o modo ausente`.
- **Ligar sem confirmação, por escolha:** o efeito aparece na hora (a faixa lilás surge no clique) e **o mesmo botão, no mesmo lugar**, desfaz. Um "tem certeza?" custaria um clique a mais toda noite para evitar um engano que se vê e se desfaz em um segundo. O ↻ fica no canto oposto: quem clica por hábito para atualizar não cai no modo.

**Estados do botão do modo** (comportamento do plano, texto daqui):

| Estado | O modo na tela | Botão | Fora da faixa |
|---|---|---|---|
| parado | o modo lido | `Ficar ausente` / `Estou de volta` | — |
| gravando | **já o modo novo** (otimista): ao ligar, a faixa com `☾ Ausente agora` | `Ligando…` / `Desligando…`; clique ignorado | — |
| feito | o modo novo, **escrito na leitura antes de soltar o `trocandoModo`**; releitura que começou antes da troca não escreve o modo (geração, §Gotchas): nada pisca | o rótulo do modo novo | toast `Modo ausente ligado. Para pré-abrir o pool, use /ausente on no chat.` / `Modo ausente desligado` |
| falhou | **volta ao modo anterior** | o rótulo anterior | linha nova na faixa de avisos (§3) |

- Modo `desconhecido`: **sem** botão do modo. Gravar por cima de um arquivo que não se leu esconderia o problema. A faixa de erro de hoje ("Não consegui ler tudo") traz o motivo e o caminho: `/ausente off no chat zera o modo`. Quando a leitura volta boa, o botão aparece no canto esquerdo; nada à direita muda de lugar.

## 3. A falha

- A falha da gravação entra em `avisos` (plano) e aparece na faixa de avisos de hoje, sob os contadores.
- **No desktop, o título dessa faixa passa de "Resposta não entregue" para "Ação não concluída":** ela deixa de ser só da resposta de pergunta. O `faixaSvg` junta os avisos com ` · ` num parágrafo; cada aviso começa pelo que falhou: `Não consegui ligar o modo ausente (<motivo>).` / `Não consegui desligar o modo ausente (<motivo>).`
- **No terminal** a caixa de avisos não tem título (são linhas `⚠` numa borda vermelha) e continua sem: a linha já diz o que falhou.
- Nada pisca: o modo volta ao anterior no mesmo render em que o aviso aparece.

## Mensagens

| Mensagem | Lugar | Duração | Tom | Quem vê |
|---|---|---|---|---|
| `Presente` | fileira, à direita | enquanto valer | neutro | operador |
| `☾ Ausente há 3 h` / `desde 14:05 · a orquestradora pode se limpar` / `sessões novas só abrem com você` | faixa do ausente | enquanto valer | neutro, com peso | operador |
| `Modo não lido (vale presente)` | fileira, à direita | até a próxima leitura boa | neutro (o erro está na faixa de erro) | operador |
| `⚠ Parou há 7 min` | linha sob a fileira | até ler de novo | ruim | operador |
| `Ligando…` / `Desligando…` | rótulo do botão | enquanto grava | neutro | operador |
| `Modo ausente ligado. Para pré-abrir o pool, use /ausente on no chat.` / `Modo ausente desligado` | toast | some sozinho | ok | operador |
| `Não consegui ligar o modo ausente (…)` | faixa de avisos | até Limpar avisos | ruim | operador |

Texto de UI sem F<n>, sem plano e sem ADR.

## Regiões e componentes

| Região | Monta com | Novo? |
|---|---|---|
| Fileira | `Box row flexWrap columnGap={1}`: `Box row columnGap={1}` (modo, futuros) + `Box row columnGap={1} flexGrow={1} justifyContent="flex-end"` (`rotuloModoSvg`, ↻ com `autoFocus`) | muda |
| Faixa do ausente | `modoSvg` em `desenho.ts`; classes do `CSS` de hoje mais **`.lis`** (traço, mesmo valor do `li`) | **sim** |
| Linha "parou" | `parouSvg`, 20 px | **sim** (era `Text`) |
| Botão do modo | `Button secondary`; o rótulo lê o átomo `trocandoModo` (plano) e o modo da leitura | **sim** |
| ↻ | o `botaoAtualizar` de hoje, com o rótulo `↻ HH:MM` | só o rótulo |
| Faixa de avisos | `faixaSvg` de hoje, com o título novo | só o título |

## Estados

| Estado | O que se vê | Mock |
|---|---|---|
| Presente | `[Ficar ausente]` … `Presente [↻ 18:22]`, uma fileira | 1 |
| Ausente | `[Estou de volta]` … `[↻ 18:22]` e a faixa contornada; os contadores a pleno, abaixo | 2 |
| Ligando (otimista) | a faixa com `☾ Ausente agora`; `[Ligando…]` no mesmo lugar | 3a |
| Ligado | o mesmo, com `Estou de volta` e o toast | 3b |
| Falhou ao ligar | presente de volta; faixa "Ação não concluída" com o motivo | 4 |
| Modo não lido | `Modo não lido (vale presente) [↻ 18:22]`, sem botão do modo; a faixa de erro diz como zerar | 5 |
| W = 288 | presente numa fileira; ausente com a frase numa linha (cabe por 3 px; 66); ausente desde ontem, frase quebrada (82), com a leitura parada | 6 |
| W = 240, ou um botão futuro a 288 | o grupo da direita desce para a 2ª fileira e fica no canto direito | 6 |
| Antes da 1ª leitura | só `[Lendo…]` à direita; se a 1ª leitura falhar, `[↻ ler]` | — |
| Claro / escuro | os botões no topo do mock | todos |
| Terminal, 72 e 40 colunas | §5 | 7 |

## Movimento

Nenhum. A troca de modo é instantânea (otimista); a faixa não entra deslizando (regra do F34: o pane redesenha a cada 60 s).

## 5. O terminal

A barra do terminal hoje é um `Box row space-between`: os contadores (com `flexWrap`) à esquerda e `↻ 18:22` à direita, sem `wrap`, dentro de um `Box column gap={1}`.

**O topo do terminal vira um `Box flexDirection="column"` sem `gap`**, o primeiro filho, com a mesma ordem do desktop — **a fileira primeiro**:
1. **sempre, a fileira:** `Box row flexWrap="wrap" columnGap={1}`: à esquerda o botão do modo (`key="modo"`); à direita, `Box row flexGrow={1} justifyContent="flex-end" columnGap={1}`: `presente` em `dimColor` (ou `modo não lido (vale presente)` em `dimColor italic`) e o `↻ 18:22` com `autoFocus` (`⚠ ler` quando a leitura parou, como hoje). Os botões ficam numa linha própria, e não mudam de lugar quando muda o número de contadores.
2. **só no ausente:** `Box row flexWrap="wrap" columnGap={1}`: `Text inverse bold` ` ☾ AUSENTE há 3 h `, `Text dimColor` `desde 14:05`, `Text dimColor` `· a orquestradora pode se limpar`, `Text dimColor` `· sessões novas só abrem com você`. Num terminal estreito as frases descem, inteiras. O **inverso** (fundo e texto trocados) distingue o ausente sem cor: funciona em terminal monocromático.
3. **sempre:** os contadores como hoje, sem o ↻ (que subiu para a fileira).

- **Custo aceito:** o presente ganha uma linha no terminal (a fileira). É o preço de os botões não dançarem com a contagem; o terminal desenha `[ rótulo ]` com espaços, e a linha única de antes passava de 70 colunas no caso comum.
- **Rótulos iguais aos do desktop** (`Ficar ausente`, `Estou de volta`, `Ligando…`, `Desligando…`).

72 colunas (70 úteis, `paddingX={1}`):

```
[ Estou de volta ]                                    [ ↻ 18:22 ]
 ☾ AUSENTE há 3 h  desde 14:05 · a orquestradora pode se limpar
· sessões novas só abrem com você
● 1 esperam você  ● 2 executando
```

```
[ Ficar ausente ]                          presente  [ ↻ 18:22 ]
● 1 esperam você  ● 2 executando
```

40 colunas (38 úteis; tudo quebra, nada sai pela direita, o ↻ continua à direita):

```
[ Estou de volta ]         [ ↻ 18:22 ]
 ☾ AUSENTE há 3 h  desde 14:05
· a orquestradora pode se limpar
· sessões novas só abrem com você
● 1 esperam você  ● 2 executando
```

## O que sai

- O `Text` "Atualizado 18:22" da barra (a hora vai para o ↻; o "parou", para a linha própria).
- O título "Resposta não entregue" da faixa de avisos do desktop.
- O `gap={1}` entre a barra do terminal e o resto do topo.

## Decisões

**Assumidas, a confirmar** (reversíveis, a execução segue com elas):
- **D1-1 · Rótulos "Ficar ausente" / "Estou de volta", nos dois motores.** Se não decidir: ficam. Recomendo: ficam; são o gesto em palavras de quem sai e volta.
- **D1-2 · Lilás no contorno e no ☾.** Se não decidir: fica. Recomendo: fica; é a única cor existente sem alerta. Custo aceito: o lilás ganha um segundo uso, desambiguado pelo lugar, pelo contorno, pelo ☾ e pela palavra.
- **D1-3 · A hora da leitura vai para o botão (`↻ 18:22`) no desktop, como no terminal.** Se não decidir: fica. Recomendo: fica; o presente cabe numa fileira a 288 px, e a hora não se confunde com o "desde" do modo.
- **D1-4 · No modo não lido, sem botão do modo.** Recomendo: fica; o `/ausente off` no chat zera o arquivo e a faixa de erro diz isso.
- **D1-5 · A faixa de avisos do desktop passa a se chamar "Ação não concluída".**
- **D1-6 · Ligar sem confirmação** (§2): o mesmo botão, no mesmo lugar, desfaz.

**Para a planejadora (P1), antes de a E começar o bloco B:**
- **D1-7 · O botão "Ficar ausente" deve equivaler ao `/ausente on`?**
  - **O caso:** o `/ausente on` grava a bandeira **e** pré-abre o pool para a noite (4 E, 3 V, D, P; skill `ausente`). O botão, pelo plano (D7), só grava a bandeira. Com a bandeira ligada, a trava T3a impede abrir sessão em turno que não seja do operador. Quem liga pelo botão à noite pode amanhecer com o pool parado.
  - **Se não decidir:** a E executa como está nesta revisão: a faixa diz `sessões novas só abrem com você` e o toast de ligar diz `Para pré-abrir o pool, use /ausente on no chat.` O operador fica avisado, mas o botão continua menor que o comando.
  - **Recomendo:** manter o botão só como bandeira (o pane não deve abrir sessões; isso é da orquestradora) e, no bloco A, fazer a orquestradora, ao ver a bandeira com `por:"painel"` ligada sem o pré-abrir, perguntar ao operador se pré-abre. É mudança de comportamento, por isso é do plano, não da designer.
  - **Decidido pela P1 (Q279, assumida, a confirmar):** o botão fica só como bandeira, **sem** a pergunta da orquestradora no bloco A (com o operador fora, ninguém responderia). O aviso no clique (3ª linha da faixa e toast) fecha a P3-1; a E cumpre esta revisão como está.

**Gotchas para a E:**
- **A releitura é de 60 s.** Quem liga pelo `/ausente on` no chat vê a faixa mudar só na próxima leitura (ou no ↻).
- **O otimista e a releitura:** enquanto `trocandoModo` estiver ligado, a tela mostra o modo pedido, não o lido. **No sucesso, escreva o modo novo na `Leitura` antes de desligar o `trocandoModo`**. E uma **geração** do modo (um contador incrementado a cada troca): a `atualizar` guarda a geração ao começar e, se ela mudou quando termina, não escreve o campo `ausente` (escreve o resto). Sem isso, um ↻ clicado durante a gravação, que leu o arquivo antes dela, apaga a faixa até a próxima releitura.
- **`desde` vem do arquivo**, gravado por quem ligou (pane ou comando); o pane formata na hora local.
- **`gap` no motor é linha de texto.** A faixa e o topo do terminal usam `gap` 0; o respiro de 4 px está desenhado no `Svg` da faixa.
- **Os testes de hoje** procuram `Atualizado` num `Text` e o rótulo `↻ Atualizar`; o desktop passa a usar `↻ HH:MM` e o `alt` `Atualizar (última leitura às HH:MM)`.

## Para a E (bloco B, a parte visual)

Arquivos: `hooks/desenho.ts` (`modoSvg`, `rotuloModoSvg`, `parouSvg`, classe `.lis` no `CSS`), `hooks/register.tsx` (a faixa, os botões, o título da faixa de avisos, o topo do terminal), `tests/painel.test.tsx`.

Testes, além dos do plano:
1. Presente: a 1ª fileira tem, nesta ordem, o botão `Ficar ausente`, o `Svg` com `Presente` e o botão `↻ HH:MM`; não há `Svg` com `☾`.
2. `modoSvg` ausente há 3 h a W = 372: `source` tem `☾`, `Ausente há 3 h`, `desde HH:MM · a orquestradora pode se limpar` numa linha e `sessões novas só abrem com você`; altura 66; tem `class="lis"` e nenhum `fill` de fundo na faixa; `alt` com as duas consequências.
3. A W = 288 com `desde` ontem: a frase quebra no ` · ` em duas linhas inteiras (nenhuma termina em `…`); altura 82.
4. `desde` 5 min no futuro → `Ausente agora`; o `desde()` continua devolvendo `undefined` nesse caso.
5. **O botão do modo é o primeiro `Button` da faixa nos dois modos (`key="modo"`), e o ↻ é o último, com `autoFocus` e `label` `Atualizar (última leitura às HH:MM)`.** No modo não lido, o do modo não existe e o ↻ continua o último. O grupo do ↻ tem `flexGrow` e `justifyContent="flex-end"`.
6. **Sem piscar:** (a) depois de um ligar bem-sucedido, com a releitura ainda pendente, a faixa continua desenhada; (b) um ↻ clicado durante a gravação e resolvido depois dela, com o arquivo lido antes, mantém a faixa.
10. O toast de ligar diz `Para pré-abrir o pool, use /ausente on no chat.`
7. A faixa de avisos com uma falha do modo tem o título `Ação não concluída` e a linha `Não consegui ligar o modo ausente`.
8. Leitura parada: há um `Svg` com `⚠ Parou há` logo depois da fileira.
9. Terminal: a 1ª linha é a fileira (botão do modo e ↻) nos dois modos; no ausente, a 2ª tem `AUSENTE` com `inverse`; o topo não tem `gap`; o ↻ saiu da linha dos contadores.

**Gestos que a V audita no app** (`auditoria-de-clique`): ligar e desligar pelo botão sem mover o mouse (o mesmo ponto liga e desliga), olhando a faixa mudar antes do toast; o ↻ durante a gravação não desfaz a faixa; a 300 px, o presente numa fileira e a frase do ausente inteira; claro e escuro, com o contorno visível nos dois; o terminal estreito sem nada saindo pela direita.

## Crítica

### Rodada 1: 19/30, volta

O crítico rodou em contexto separado, mediu as larguras com o `em()` e o contraste no mock aberto. Notas: hierarquia 2, densidade 3, consistência 3, ruído 4, ação primária 4, aderência 3. Duas ressalvas altas; as doze foram aplicadas:

| # | Peso | Ressalva | Conserto |
|---|---|---|---|
| P1 | alta | o texto sobre o fundo `k` ficava entre 4,2 e 4,5:1 no tema claro | a faixa perde o fundo |
| P2 | alta | a faixa `k` era da cor dos quadros dos contadores (1,07:1), e o mock escondia isso | contorno lilás (`.lis`); o mock mostra os contadores a pleno |
| P3 | média | a consequência era cortada no ausente que atravessa a noite | quebra no ` · `, nunca cortada |
| P4 | média | o mock "300 px" não tinha a largura do código | medidas a W = 288 e 240; mock na largura útil |
| P5 | média | o presente custava uma linha | presente numa fileira (refeito na rodada 2, D1-3) |
| P6 | média | o lilás ganhava dois sentidos | D1-2 |
| P7 | média | o ↻ saía da direita | o ↻ fica no canto direito (completado na rodada 2) |
| P8–P12 | baixa | `há 2 d`; `desde` no futuro; mock 3a/3b; rótulos do terminal; avisos do terminal sem título | aplicados |

### Rodada 2: 22/30, volta (sem ressalva alta)

Recrítica em contexto novo: hierarquia 4, densidade 3, consistência 3, ruído 4, ação primária 4, aderência 4. Confirmou P1–P3 e P8–P12; P4, P5 e P7 em parte. Aplicado:

| # | Peso | Ressalva | Conserto |
|---|---|---|---|
| P-A | média | o botão do modo e o ↻ mudavam de lugar a cada troca de modo, e a D1-6 dizia "o mesmo lugar desfaz" | a fileira vem primeiro e nunca muda; o modo e a faixa ficam à direita e abaixo dela (§Hierarquia; teste 5) |
| P-B | média | o terminal prometido não se montava: `gap={1}` punha linha em branco e o ↻ não quebrava | topo do terminal num `Box column` sem `gap`, `flexWrap` nas duas linhas, botão do modo junto do ↻; mock a 40 colunas (§5) |
| P-C | média | `Presente · 18:22` se lia como "presente desde 18:22" | a hora vai para o botão `↻ 18:22`; o presente cabe numa fileira a 288 (D1-3) |
| P-D | média | a faixa piscava entre o fim da gravação e a releitura | o modo novo vai para a `Leitura` antes de soltar o `trocandoModo` (§2; teste 6) |
| P-E | baixa | o `em()` mede o 700 por baixo | +10% no 700; folgas refeitas |
| P-F | baixa | o filete dentro do contorno arredondado pedia `clipPath` | o filete sai |
| P-G | baixa | o limite fixo de 320 | regra medida (soma ≤ W) |
| P-H | baixa | o não lido gastava duas fileiras | uma fileira: `Modo não lido [↻]` |
| P-I | baixa | alturas do mock × especificação | faixa 46/62 + 4 de respiro = `Svg` 50/66; mock na largura útil |
| P-J | baixa | o terminal não dizia a consequência | a frase entra na linha do ausente, com quebra |

### Rodada 3: 22/30, sobe à planejadora (uma ressalva alta)

Última recrítica permitida (Q207), contexto novo. Notas: hierarquia 4, densidade 3, consistência 4, ruído 4, ação primária 3, aderência 4. Aplicado tudo o que é da designer; o que é do plano foi para a D1-7:

| # | Peso | Ressalva | Conserto |
|---|---|---|---|
| P3-1 | **alta** | a faixa e o toast tratavam o botão como o `/ausente on`; o botão não pré-abre o pool e a T3a passa a barrar sessão nova fora de turno do operador | 3ª linha na faixa `sessões novas só abrem com você` (Svg 66/82); toast de ligar aponta o `/ausente on`; **a equivalência botão × comando é decisão do plano (D1-7)** |
| P3-2 | média | com `space-between`, o grupo do ↻ que desce de fileira ia para a esquerda | `flexGrow={1}` + `justifyContent="flex-end"` no grupo da direita, desktop e terminal; mock com botão futuro a 288 |
| P3-3 | média | a linha do terminal a 72 colunas somava 73 > 70 | botões numa fileira própria e fixa no topo do terminal; contadores abaixo |
| P3-4 | média | releitura começada antes da gravação apagava a faixa | geração do modo; teste 6b |
| P3-5 | média | o botão do modo, desenhado primeiro, ganhava o primeiro Tab | `autoFocus` no ↻ |
| P3-6…P3-12 | baixa | `alt` × `label` no Button; `key="modo"`; alturas e o estado de 288 no mock; esmaecido do 3a; largura do ↻ em `Lendo…`; `⚠ ler` no terminal; `↻ ler` antes da 1ª leitura boa; `Modo não lido (vale presente)`; quem quebra a fileira é o `flexWrap`; `faixaSvg` junta com ` · ` | aplicados |
