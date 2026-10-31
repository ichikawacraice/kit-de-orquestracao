# Correções no plugin `wicomm` reveladas pelo piloto WiControl

Primeiro uso real da skill `auditar-projeto` (plugin 0.1.0, base 0.2.0), em 30/10/2026. F271 · primeira metade da fatia F261.9 do estudo.

**Onde ficou a auditoria.** Pedido do operador: a auditoria e o plano ficam no próprio WiControl, em `WiControl/docs/padronizacao-wicomm/`, para uma sessão futura executar as fatias lá. São estes arquivos:
- `auditoria.md`: os números por eixo, o contraste, o casco, as rotas, as peças e as notas das 5 telas;
- `plano.md`: a ordem das fatias, a situação de cada uma, os riscos e as decisões;
- `fatias/`: uma fatia por arquivo, de *antes*, E e 0 até 5.

Em 30/10 eles estavam só no commit local `316dc7a` da branch `docs/padronizacao-wicomm` do WiControl, ainda sem push.

Esta fatia não mexe em `plugins/wicomm/`: o F269 e o F270 trabalham ao lado. Cada correção abaixo é um pedido para um item próprio. A evidência de cada uma está em `WiControl/docs/padronizacao-wicomm/auditoria.md`, na parte de números corrigidos à mão.

## Prioridade alta: mede errado e muda a decisão do plano

| # | O que aconteceu | Evidência | Correção sugerida |
|---|---|---|---|
| 1 | **`rgba(` dentro de valor arbitrário não casa.** O `\b` antes de `rgba` não vê fronteira depois de `_`, e `shadow-[0_10px_30px_rgba(…)]` passa calado. O mesmo defeito está no aviso na escrita (hook) | 61 falsos negativos; `hooks/valor-solto.mjs:26` | Trocar `\b` por `(?<![A-Za-z])` e pôr um teste com sombra arbitrária |
| 2 | **A paleta Tailwind usada direto não é medida** (`text-zinc-700`, `bg-emerald-500/10`). Foi a maior deriva do projeto (COR-01, COR-05) | 767 classes | Categoria "paleta direto (COR-05)" no script e no hook, com exceção para o arquivo do idioma de cor declarado no `design/wicomm.json` |
| 3 | **`.ts` fica fora da medida.** O idioma de cor do projeto mora em `lib/colors.ts` | 40 hex em `lib/colors.ts`, 1 em `lib/wiflow-projects.ts` e 189 classes de paleta de fora; `scripts/medir-deriva.mjs:18` | Incluir `.ts`/`.js` que tenham string de classe (importam `cn`/`cva` ou têm `bg-`/`text-` em literal) |
| 4 | **Alfa que não gera CSS em Tailwind v3 é invisível.** Com cor `var(--x)` sem `<alpha-value>`, `bg-primary/10` não gera nada. É o que dimensiona a fatia 0 | 95 classes; provado no `dist/` do WiControl | O script detecta o caso no `tailwind.config` e conta as classes de tema com `/NN` |
| 5 | **MOV-02 contado por arquivo e sem a isenção de `transition-colors`.** E um `motion-reduce` em qualquer ponto do arquivo absolve todas as animações dele | 31 arquivos pelo script, 22 reais; `scripts/medir-deriva.mjs:79` | Contar por ocorrência, isentar `transition-colors` e exigir o escape na mesma string de classe |
| 6 | **Não há script de contraste no plugin.** A skill pede contraste, mas a conta só existe em `packages/tokens/lib/contraste.mjs`, que o projeto auditado não tem | O auditor teve de importar código de outro pacote | `scripts/medir-contraste.mjs <css>`: lê hex/`hsl()`/`oklch()` de `:root` e `.dark`, compõe o alfa e devolve a matriz da COR-12 e a COR-11 |
| 7 | **O agente e a skill se contradizem sobre a nota por tela.** A skill exige a nota nas 5 telas. O agente diz para não dar nota sem a tela à vista, e ele não tem navegador | As notas da auditoria saíram do código | A skill aceita "nota por leitura de código", com um marcador obrigatório na tabela. Ou o agente ganha um navegador |

## Prioridade média: número enganoso ou faltando

| # | O que aconteceu | Correção sugerida |
|---|---|---|
| 8 | O padrão de valor arbitrário só pega número simples. Ficam de fora `shadow-[…]` (61), `grid-cols-[…]` (15) e `w-[min(…)]` | Categoria "arbitrário composto", sem contar `data-[…]`, `aria-[…]` e `var(--…)` |
| 9 | Arquivo morto entra na medida: o `App.css` do template, que ninguém importa | Medir só o CSS alcançável por `import`; o resto vai para uma lista à parte |
| 10 | Os tokens do projeto não são comparados com os da Wicomm (`--primary #ff012e` contra `#F30B42`), e as variáveis mortas não são contadas (24 de 57) | Seção "tokens do projeto": diferença para `@wicomm/tokens`, variáveis sem uso e `transparent` (CONV-03) |
| 11 | Ninguém confere se o tema escuro é alcançável: aqui o `.dark` é morto | O script informa `temaEscuro: declarado · alcançável · ausente` |
| 12 | "Alturas" mistura ícone, barra e controle. Ignora `size-*`, `min-h-*` e a altura com variante (`md:h-10`). Conta a declaração da variante do botão, não os usos | Separar altura de controle (CTRL-01) de tamanho de ícone (CTRL-09) e aceitar o prefixo de variante |
| 13 | O tamanho dos ícones não é medido: há 73 ícones fora de 14/16/18. O script só conta os arquivos que importam ícones | Contar os ícones distintos e o tamanho de cada uso |
| 14 | O raio não é resolvido pelo config: `rounded-lg` vale 10px aqui e outra coisa na Wicomm. O raio por lado (`rounded-t-2xl`) fica de fora | Resolver o `borderRadius` do config e devolver px |
| 15 | O `tailwind.config.*` fica fora da medida (filtro `.config.`), e é nele que moram a fonte, as cores sem alfa e as curvas soltas | Seção "config do Tailwind" no relatório |
| 16 | `tailwindV3` dá verdadeiro para qualquer projeto com `tailwind.config.*`, inclusive v4 com `@config` | Decidir pela versão do pacote; o config sozinho vira só um aviso |
| 17 | A pasta ui e as telas vêm somadas, mas o plano trata as duas em fatias diferentes (peças × telas) | Separar "ui" de "tela" em cada categoria |
| 18 | A lista de peças não mostra uso: `label` tem 0 usos, `command` e `sheet` têm 1 cada | Contar `<Peca` fora da pasta ui ao lado de cada nome |
| 19 | A densidade não tem de onde sair sem o `design/wicomm.json`, e o app é misto (instrumento por dentro, site no portal) | A skill diz como decidir por rota (com sessão = instrumento, link público = site), marcado *assumido*. O `design/wicomm.json` aceita densidade por rota. O plano do WiControl já assume um campo `densidadePorRota`, que o plugin ainda não lê |
| 20 | "Piores arquivos" engana: em `Dashboard.tsx`, 50 dos 96 valores soltos são uma mesma largura de coluna repetida | Mostrar ao lado os 2 ou 3 valores mais repetidos de cada arquivo |

## Na base (norma: muda a versão)

| # | O que aconteceu | Correção sugerida |
|---|---|---|
| 21 | Falta um arquétipo: o mestre-detalhe de configuração com arrastar (`/templates`) não cabe em nenhum dos cinco | A ARQ-01 avalia o arquétipo novo. Enquanto isso, a skill pede o arquétipo mais próximo ao lado do "nenhum" |
| 22 | A base não cobre o portal público, a área que o cliente abre por link com senha. No WiControl é metade do produto, com 3 cascas próprias | Uma regra nova de casco público (`CASCO-04`, código a confirmar) ou uma nota na DENS-02 |
| 23 | A PECA-01 não tem linha para peças comuns do shadcn: `Checkbox`, combobox, `Textarea`, `Table`, `Separator`, `Label`, calendário. Sem elas, "igual / equivalente / sem par" fica ambíguo | Acrescentar as linhas e dizer se o `Separator` é proibido (pela SUP-03, parece que sim) |

## Fora do plugin, no estudo

O §3.2 do estudo ainda põe os tokens antes do Tailwind v4 e fala em "preset v3". A Q640 inverteu a ordem e o plugin já segue a nova. O texto do estudo deve ganhar uma nota apontando para a Q640.

A skill `plano-de-padronizacao` só procura a auditoria em `docs/design/auditoria-*.md`. A do WiControl ficou em `docs/padronizacao-wicomm/`. A skill deve aceitar o caminho como argumento. O plano em fatias, um arquivo por fatia, também funcionou melhor que um plano único para a execução depois, e vale como formato da skill.

## Situação depois do F275 (30/10/2026)

O F275 resolveu as 20 correções do plugin (1 a 20), cada uma com um teste que falha na `main` anterior e passa depois: `plugins/wicomm/scripts/tests/deriva-wicontrol.test.mjs`, sobre o fixture `fixtures/wicontrol/`, e `medidas.test.mjs`. Duas decisões:
- **6 · contraste no plugin.** Script próprio, `scripts/medir-contraste.mjs`, com cópia da aritmética de `@wicomm/tokens` e da leitura de folha de `@wicomm/guardas`. O plugin é instalado sozinho, sem os pacotes do repositório, então importar não funciona. Um teste de concordância reprova se a cópia andar sem o original.
- **7 · nota por tela sem navegador.** A skill aceita a nota **por leitura de código**, com a coluna *Fonte* (`tela` ou `código`) obrigatória. O agente não ganhou navegador: ver a tela exige subir o app, e o auditor só lê (no WiControl, o login é o do sistema real).

A medida do WiControl contra a contagem à mão da auditoria:

| Medida | Plugin 0.1.0 | Agora | À mão |
|---|---|---|---|
| Valor solto, total | 338 | 453 | cerca de 450 |
| Cor literal | 24 | 122 | 123 (o 1 que falta é um `#hex` de reserva num `.ts` sem classe) |
| Arbitrário composto | 0 | 78 | 61 sombras + 15 `grid-cols` + `w-[min(…)]` |
| Paleta usada direto | 0 | 768 | 767 |
| Alfa que não gera CSS | 0 | 96 | 95 |
| Animação sem escape | 31 arquivos | 61 ocorrências em 22 arquivos | 61 em 22 |
| Variáveis sem uso | — | 24 de 57 | 24 de 57 |
| Ícones fora de 14/16/18 | — | 61 por uso | 73 pelo par `h-N w-N`, que também conta quadrado que não é ícone |
| CSS morto | medido | `App.css` fora da medida | `App.css` |

**Ficam para depois:**
- 21: a ARQ-01 avaliar o arquétipo novo. A skill já pede o mais próximo ao lado do "nenhum".
- 22 e 23: regra nova na base, que muda a versão. São itens próprios.
- A nota no §3.2 do estudo sobre a Q640.
