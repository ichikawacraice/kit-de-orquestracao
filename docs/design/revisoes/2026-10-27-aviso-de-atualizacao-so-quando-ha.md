# Revisão de arquitetura: aviso de atualização e de reinício só quando há o que fazer (adendo)

- **Data:** 2026-10-27 (SP)
- **Autor:** designer (subagente da dona do F209)
- **Estado:** falta a crítica (`critico-de-ui`, contexto separado). Sem crítica, não está liberada.
- **Base:** [`2026-10-26-pode-reiniciar.md`](2026-10-26-pode-reiniciar.md). Tudo o que este adendo não muda continua valendo: régua de idade, vigia, `Me avise`, bloco com moldura, barra. **Este adendo substitui a decisão "A linha do reinício fica sempre no topo do pane"** da base. Quem reverteu foi o operador, com estas palavras: *"só devem aparecer quando necessário… reiniciando e estando ok, não tem mais porque ele aparecer"*.
- **Plano:** `docs/planos/2026-10-27-aviso-de-atualizacao-so-quando-ha.md`. Os três estados e as medições são dele. Este adendo decide como cada estado aparece.
- **Fontes lidas:** o plano; a revisão de base; `plugins/painel-sessoes/hooks/desenho.ts` (`reinicioSvg`, `versoesDaAtualizacao`, `contagemDoReinicio`, o `CSS` com `an`/`ok`/`er`/`m`/`s`/`t`, `caber`, `largura`); `plugins/painel-sessoes/hooks/register.tsx` (`botaoDoAviso`, `dadosDoReinicio`, os dois `bloco-do-reinicio`, `ligarAviso`/`desligarAviso`, `falhouOAviso`, `avisar`, `COR_RESUMO`); `plugins/painel-sessoes/hooks/barra.tsx` (`GLIFO_REINICIO`); `plugins/orquestracao/skills/orquestradora/scripts/atualizar-plugins.mjs` (a saída `--json` e as mensagens de erro).
- **Medido no código de hoje (d424817):**
  - O pane do **terminal não mostra a linha azul** da atualização. Só o desktop a desenha (`reinicioSvg`); o `bloco-do-reinicio` do terminal não lê `atualizacao`. Este adendo fecha esse buraco.
  - As larguras abaixo saíram da própria `largura()` de `desenho.ts`, com W = 288.
  - O botão sem aviso reserva 96 px (`W - 96`). Pela mesma régua, `Tentar de novo` mede 93 px de texto a 13 px, então não cabe em 96.

## Tarefa

*O operador vê no topo do pane só o que pede um gesto dele: baixar a atualização do kit (um clique) e, depois, reiniciar o app para aplicá-la. Quando não há nada pendente, o topo não mostra nada sobre isso.*

## Quem e onde

- **Quem:** o operador, sozinho. Isso acontece poucas vezes por dia: um lote de merges sobe a versão dos plugins, ou o app baixa uma versão nova sozinho.
- **Onde:** o topo do pane, nas duas superfícies.
  - **Desktop:** coluna com W = 288 no pior caso e 360 na referência, desenhada em SVG.
  - **Terminal:** `Text` com `Box`.
  - **Posição:** a mesma do bloco de hoje, depois da faixa do modo ausente e antes do cartão do resumo.
- **A barra acima do prompt não muda:** ela já só fala com o aviso ligado (fora do escopo pelo plano).

## Inventário

| O quê | Onde | Decisão que gera | Frequência | Veredito |
|---|---|---|---|---|
| Linha `↓ Atualização do kit · …` | pane, topo, **primeira** das linhas do reinício | baixar agora | quando sai lote novo | **fica**, só no estado 1 |
| Botão `Atualizar` / `Atualizando…` / `Tentar de novo` | à direita da linha `↓` | baixar, ou tentar de novo | idem | **fica**, junto da linha |
| O motivo da falha (2ª linha da `↓`) | sob a frase da `↓` | tentar de novo agora ou deixar para depois | raro | **fica** enquanto a falha vale (ver [Estados](#estados)) |
| Versões de/para de cada plugin | `alt` da `↓` e toast de feito | conferir o que mudou | raro | **sob demanda** (`alt`). Na linha, só o nome e a versão quando o plugin é um só |
| Linha `⏻ Pode reiniciar` / `Reiniciar: espere · N rodando` / `Reiniciar: não sei` + `Me avise` | pane, topo | reiniciar agora ou esperar | idem | **fica, só no estado 2** (ou com o aviso ligado). Igual à de hoje |
| Linha `↑ Pronta para aplicar · …` | logo abaixo da `⏻` (sem moldura) ou como última linha da moldura | entender **por que** reiniciar | idem | **fica** só no estado 2. Texto novo, com os plugins do kit |
| Bloco emoldurado do aviso ligado | pane, topo | esperar a notificação ou desligar | minutos | **fica** enquanto o aviso estiver ligado, **com ou sem pendência** |
| `⏻ Pode reiniciar o app` sem nada pendente | pane, topo | nenhuma: não há o que aplicar | o dia inteiro | **sai** |
| `⏻ Reiniciar: espere` sem nada pendente | pane, topo | nenhuma | o dia inteiro | **sai** |
| `Me avise` sem nada pendente | pane, topo | ligar o aviso por outro motivo (app travado) | raríssimo | **sai**, com o motivo em [Decisões ao operador](#decisoes) |

## Hierarquia e peso

- **Estado 1:** a ação primária do bloco é `Atualizar`. A frase `↓ Atualização do kit` vem antes e as versões ficam por último.
- **Estado 2:** a primária continua sendo a resposta `⏻` (pode, espere ou não sei), como na base. A linha `↑` é secundária: diz o motivo de reiniciar. O `Me avise` também é secundário.
- **Botões:** `Atualizar` é `Button variant="secondary"`, como todos os do topo (modo, `↻`, `Me avise`). O único `primary` do pane é o da pergunta, e assim continua.
- **Peso a W = 288:**

| Situação | Altura |
|---|---|
| Estado 3, sem aviso | **0 px**: o bloco não existe |
| Estado 1 sozinho | 20 px (38 px com a falha) |
| Estado 2 sem aviso | 38 px (`⏻` + `↑`), como hoje |
| Estados 1 + 2 | 20 + vão `gap={1}` + 38 ≈ 66 px |

O "Esperam você" continua na primeira dobra.

### (1) A linha do estado 1: desktop

- **Fileira:** `Box row alignItems="center" columnGap={1} flexWrap="wrap"`, a mesma do `bloco-do-reinicio` sem aviso, com `key="linha-do-kit"`.
- **Largura:** o SVG mede **W − 120**, e o botão fica à direita. A reserva é **120 px fixos**, no tamanho do rótulo mais longo (`Tentar de novo`). Assim a linha não se rearruma quando o rótulo troca. É o mesmo princípio da peça da barra. A executora mede o botão no desktop: se o `Tentar de novo` passar de 120, a constante acompanha, com teste.
- **Anatomia:** a da linha `pode` de hoje. Glifo e frase com cor e peso 600 a 12,5 px; o resto em `m`, 400.

```
↓ Atualização do kit                         [ Atualizar ]       ← W=288: ↓ e frase em `an`, 600; 20 px
↓ Atualização do kit · 2 plugins             [ Atualizar ]       ← W=360: o resto em `m`
↓ Atualização do kit                       [ Atualizando… ]      ← no mesmo render do clique; cliques ignorados
↓ Não atualizou o kit                     [ Tentar de novo ]     ← ↓ e frase em `er`, 600; 38 px
ficou na versão antiga                                           ← 12 px, `s`, cortado por `caber`
```

- **Frase, em cadeia** (fica a primeira que cabe em W − 120, como faz `fraseQueCabe`):
  1. `↓ Atualização do kit · <nome> <versão>` (um plugin) ou `↓ Atualização do kit · N plugins` (dois ou mais);
  2. `↓ Atualização do kit`.
- **Medidas a 12,5 px:** `↓ Atualização do kit` = 117. `· 2 plugins` = 183. `· orquestracao 0.1.71` = 255.
  - A W = 288, a linha tem 168 px: sai a forma 2.
  - A 360, tem 240 px: sai a forma 1 com `N plugins`. Com um plugin só, a forma 1 não cabe e sai a 2.
- **Glifo `↓`:** é diferente do `↑` do estado 2 de propósito. Baixar e aplicar são passos distintos. A cor é `an`, a mesma da linha `↑`: azul aqui é "atualização". Não é aviso nem erro.
- **`alt`:**
  - normal: `Atualização do kit disponível: orquestracao 0.1.70 para 0.1.71, painel-sessoes 0.9.10 para 0.9.11.`
  - atualizando: `Atualizando o kit: …`
  - falhou: `O kit não atualizou: <motivo>. orquestracao segue em 0.1.70.`
- **O motivo** é sempre um destes textos curtos. O texto cru do erro não vai para a tela, porque pode citar comando; ele fica no arquivo da trava (`falhou.detalhe`):

| Situação (saída do script) | Motivo na tela |
|---|---|
| instalada ≠ publicada depois do update (`não pegou`) | `ficou na versão antiga` |
| `ls-remote` ou `marketplace update` falhou, rede fora | `sem acesso ao repositório` |
| passou do tempo (`não respondeu em`, ou o teto do mod) | `demorou demais` |
| `claude não encontrado no PATH` | `não achei o Claude Code` |
| outro | `erro inesperado` |

### (1) A linha do estado 1: terminal

```tsx
<Box key="linha-do-kit" flexDirection="row" flexWrap="wrap" columnGap={1}>
  <Text wrap="truncate-end"><Text color="suggestion">↓</Text><Text bold> Atualização do kit</Text><Text dimColor> · 2 plugins</Text></Text>
  {botaoDoKit}
</Box>
```

- **Cor:** `suggestion` é o par de `an` (o mesmo de `COR_RESUMO`).
- **Na falha:** `↓` e frase `Não atualizou o kit` em `color="error"` e `bold`. Abaixo vem `<Text dimColor wrap="truncate-end">ficou na versão antiga</Text>`.
- **A frase do terminal** é sempre a forma 1 com `truncate-end`. A ordem da frase garante que o corte come o menos importante.

### (2) A linha do estado 2

- **Texto novo.** "Baixada" e "instalar" saem: plugin do kit não se baixa nem se instala no reinício, só passa a valer.
- **Frase, em cadeia.** O `V` é a lista `app X, motor Y, <kit>`, nesta ordem, só com o que existe. O `<kit>` é `<nome> <versão>` com um plugin e `kit (N plugins)` com dois ou mais. O `V curto` troca o `<kit>` por `kit`.
  1. `↑ Pronta para aplicar · V · reinicie o app`
  2. `↑ Pronta para aplicar · V`
  3. `↑ Para aplicar · V`
  4. `↑ Para aplicar · V curto`
  5. `caber` da forma 4.
- **Medidas a 12 px:**
  - pior caso, a forma 4: `↑ Para aplicar · app 3.2.0, motor 2.1.308, kit` = 259. Cabe em 288 (sem moldura) e em 264 (com moldura);
  - `↑ Pronta para aplicar · orquestracao 0.1.71` = 255;
  - `↑ Pronta para aplicar · app 3.2.0, motor 2.1.308` = 279.
- **Cor:** a linha inteira em `an`, 12 px, no mesmo lugar de hoje: logo abaixo da `⏻` (sem moldura) ou como última linha da moldura.
- **`alt`:** `Pronta para aplicar ao reiniciar o app: app 3.2.0, motor 2.1.308, orquestracao 0.1.71, painel-sessoes 0.9.11.` Esse texto substitui o `Atualização baixada: …` de hoje.
- **Terminal (buraco de hoje):** `<Text color="suggestion" wrap="truncate-end">` com a forma 1, logo abaixo do título `⏻`. Com o aviso ligado, entra como última das linhas `dimColor`, mas em `suggestion`.
- **A linha `⏻` (pode, espere, não sei, `Me avise`) continua igual** nos textos, nas cores, na reserva de 96 e no bloco com moldura. Só passa a nascer quando há o que aplicar.

### (3) O estado 3

- **Nada:** sem `linha-do-kit` e sem `bloco-do-reinicio`. O cartão do resumo sobe e encosta no topo.
- **Com o `Me avise` ligado e nada pendente, o bloco com moldura fica até o aviso desligar.** O aviso desliga pelas regras da base: `Não avisar mais`; 30 min depois da notificação; reinício do app. Quem pediu o aviso disse que quer reiniciar, então a resposta continua visível.
- **Quando o aviso desliga sem nada pendente, o bloco some inteiro.** Ele não volta para a linha discreta.
  - No `Não avisar mais`, isso acontece no mesmo render.
  - Se a gravação for recusada, o bloco volta, com o toast e a faixa de hoje.

### (4) Os estados 1 e 2 juntos

- **A ordem:** primeiro `linha-do-kit` (`↓`), depois `bloco-do-reinicio` (`⏻` com `↑`). São irmãos no `column gap={1}` do pane.
- **Por quê:**
  - a ordem de leitura é a ordem do gesto: baixa, depois reinicia;
  - um reinício só aplica as duas coisas, e a linha `↓` em cima avisa que vale atualizar antes de reiniciar.
- **Depois que `Atualizar` dá certo,** a `↓` sai e o kit entra no `V` da `↑` no mesmo render. O bloco continua uma linha só.

## Mensagens

| Mensagem | Lugar | Duração | Tom | Quem vê |
|---|---|---|---|---|
| `↓ Atualização do kit · …` | pane, `linha-do-kit` | enquanto há versão publicada maior que a instalada | `neutro` (azul de atualização) | o operador, em todo pane |
| `Atualizando…` (no botão) | o botão, onde clicou | do clique ao fim do script, até 9 min | `espera` | todo pane (trava entre sessões) |
| `↓ Não atualizou o kit` + motivo + `Tentar de novo` | pane, `linha-do-kit` (38 px) | até a próxima tentativa, até a `↓` sumir ou até 30 min | `ruim` | todo pane |
| `↑ Pronta para aplicar · …` | pane, sob a `⏻` ou na moldura | enquanto algo instalado espera o reinício | `neutro` | todo pane |
| Toast de feito: `Kit atualizado: orquestracao 0.1.71, painel-sessoes 0.9.11. Reinicie o app para aplicar.` | toast | some sozinho | `ok` | a sessão que clicou |
| Toast de já em dia (outra sessão atualizou antes): `O kit já estava em dia.` | toast; a `↓` some | some sozinho | `neutro` | a sessão que clicou |
| Toast de feito em parte: `Atualizei orquestracao 0.1.71; painel-sessoes não atualizou (ficou na versão antiga).` | toast + faixa "Ação não concluída" (`avisar`) | o toast some sozinho; a faixa fica até `Limpar avisos` | `ruim` | a sessão que clicou; a `↓` fica só com o que faltou, em todo pane |
| Toast de falhou: `Não consegui atualizar o kit (<motivo>).` | toast + faixa "Ação não concluída" (`avisar`, pelo padrão do `falhouOAviso`) | o toast some sozinho; a faixa fica até `Limpar avisos` | `ruim` | a sessão que clicou |

Nenhum texto cita item, revisão, comando nem nome de arquivo. O `<motivo>` sai só da tabela de motivos acima.

## Regiões e componentes

| Região | Componentes | Peça nova? |
|---|---|---|
| Decidir o que aparece | **`oQueMostrarDoReinicio({ arquivo, aviso, lido })`**, função pura em `barra.tsx` ao lado de `estadoDoReinicio`. Devolve `{ kit: paraBaixar \| null, reinicio: boolean }`, com `reinicio = aviso !== null \|\| há app/motor/plugins esperando`. As duas superfícies leem dela | Função, não componente, com teste próprio: as duas superfícies não podem divergir |
| `linha-do-kit` (desktop) | **`kitSvg(W, k)`** em `desenho.ts`, montada sobre a anatomia da linha `pode` de `reinicioSvg`. A executora extrai essa anatomia para uma função comum (glifo e frase com classe, 600, 12,5 px; resto em `m`; 2ª linha opcional a 12 px), e as duas linhas a usam. Mais `Button` secundário | Não é peça visual nova: é a linha que já existe, compartilhada. Teste: cadeia de frases a 288 e 360, 20 e 38 px, `alt` |
| `linha-do-kit` (terminal) | `Box`, `Text`, `Button` | Não |
| Linha `↑` | `versoesDaAtualizacao` ganha `plugins` e o token `<kit>`. A cadeia de `fraseQueCabe` passa para as cinco formas acima | Não |
| `bloco-do-reinicio` | o de hoje, nas duas superfícies, por trás da decisão de `oQueMostrarDoReinicio` | Não |

## Estados

| Estado | `linha-do-kit` | `bloco-do-reinicio` |
|---|---|---|
| antes da 1ª leitura | nada | nada (como hoje) |
| arquivo do reinício ausente, ilegível ou o comando falhou | nada: sem dado não se sabe se há pendência | nada, salvo com o aviso ligado (aí, o "não sei" da base). O erro vai para "Não consegui ler tudo", como hoje |
| sem rede para ler a versão publicada | nada; tenta de novo na janela seguinte do cache (30 min) | segue o próprio estado |
| 1 | `↓` + `Atualizar` | nada (sem aviso) |
| clicou `Atualizar` | `Atualizando…` no mesmo render; grava a trava `batida/atualizando-kit.json` (`por`, `desde`); os outros panes mostram `Atualizando…` inerte | segue igual |
| feito | a `↓` sai no mesmo render; toast | o kit entra na `↑` no mesmo render, pelo JSON do script (versões `depois`). A releitura do `pode-reiniciar` confirma e vence se divergir |
| feito em parte | a `↓` fica só com o que faltou, em estado de falha | entra na `↑` o que pegou |
| falhou | `↓ Não atualizou o kit` + motivo + `Tentar de novo`. A trava vira `falhou: { motivo, detalhe, em }`, e a falha aparece em todo pane por até 30 min. Depois disso volta o `Atualizar` | segue igual |
| outra sessão está atualizando | `Atualizando…` inerte; o toast sai só na que clicou | segue igual |
| trava com mais de 10 min sem desfecho | volta `Atualizar`: a trava velha não prende o botão | segue igual |
| 2 | nada | `⏻` (pode, espere ou não sei, `Me avise`) + `↑` |
| 1 + 2 | `↓` primeiro | depois o bloco |
| 3, sem aviso | nada | nada |
| 3, com aviso | nada | o bloco com moldura, sem a `↑`, até o aviso desligar |
| reiniciou e está em dia | nada | nada. O aviso que tinha `avisadoEm` já é apagado ao carregar (base) |

- **O teto do mod:** o mod roda o script com `timeoutMs` de 9 min, abaixo dos 10 min da trava. Passou disso, o resultado é falha com o motivo `demorou demais`.
- **O clique não pede confirmação.** O operador pediu "clicando nele ele atualiza", e o script só instala a versão publicada.

## Movimento

Nenhum. As linhas entram e saem por redesenho, sem transição, como no resto do pane. Com `prefers-reduced-motion`, nada muda.

## O que sai

- `⏻ Pode reiniciar o app · conferido às…` e `⏻ Reiniciar: espere · N rodando` quando não há nada pendente (estado 3, sem aviso). Sai também o `Me avise` que vinha com eles.
- O texto `↑ Atualização baixada · … · reinicie o app para instalar` e a forma curta `↑ Atualização · …`.
- O `alt` `Atualização baixada: …. Reinicie o app para instalar.`
- A volta para a linha discreta depois do `Não avisar mais` quando não há pendência: agora o bloco some.

<a id="decisoes"></a>
## Decisões ao operador

Nenhuma trava a execução. As três vão como *assumidas, a confirmar* e se revertem trocando uma constante ou uma condição.

- **O `Me avise` fica sem lugar quando não há nada para aplicar.**
  - *O caso:* hoje dá para pedir "me avise quando der para reiniciar" a qualquer hora, por exemplo com o app travado. Com o topo vazio no estado 3, esse botão só aparece quando há atualização esperando o reinício.
  - *Se não decidir:* fica assim. Para reiniciar por outro motivo, você pergunta na conversa, e a orquestradora confere.
  - *Recomendação:* aceitar. É o que você pediu, o caso é raríssimo, e uma porta permanente para ele traria de volta a linha que você mandou tirar.
- **Como o kit aparece na linha azul.**
  - *O caso:* você sugeriu `kit 0.1.71`, mas o kit não tem versão própria: cada plugin tem a sua (orquestracao 0.1.71, painel-sessoes 0.9.11). Proponho o nome e a versão quando o plugin é um só, e `kit (2 plugins)` quando são vários. As versões de cada um ficam no texto de leitura de tela e no toast.
  - *Se não decidir:* fica como proposto.
  - *Recomendação:* como proposto. Usar a versão do orquestracao como "versão do kit" mentiria no lote que só sobe o painel.
- **A falha de atualizar aparece em todo pane, por até 30 min.**
  - *O caso:* se a atualização falha numa sessão, os panes das outras também mostram "Não atualizou o kit" com o motivo, em vez de oferecer `Atualizar` de novo como se nada tivesse acontecido.
  - *Se não decidir:* todo pane, 30 min.
  - *Recomendação:* todo pane. Sem isso, você clica de novo em outra sessão e recebe a mesma falha sem saber que já tinha falhado.
