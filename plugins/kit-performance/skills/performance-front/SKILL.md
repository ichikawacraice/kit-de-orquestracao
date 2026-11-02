---
name: performance-front
description: Práticas de performance do front e do render — skeleton, UI otimista, imagem preguiçosa e em WebP/AVIF, JS partido por rota, lista virtualizada, re-render, script de terceiro depois, fonte self-hosted, SSR/SSG, debounce e dedupe de chamadas —, cada uma com quando vale, quando não vale e o sinal no código. Use ao escrever ou revisar tela, componente, lista, busca, carregamento de dado na tela ou página pública, e quando a pessoa disser "a tela está lenta", "pisca", "trava ao digitar", "LCP alto", "bundle grande".
---

# Performance do front

Cada prática abaixo é **regra quando o sinal aparece**, não checklist para aplicar em tudo: aplicar onde não vale só soma código. Antes de mexer, leia a seção `performance` do `.claude/kit.json` do projeto: a prática listada em `naoSeAplica` está dispensada, com o motivo. Antes de otimizar por palpite, meça (skill `medir-performance`).

Complementos de fora, quando ligados: `vercel-react-best-practices` (ou `vercel:react-best-practices`) e `vercel:next-cache-components` têm o detalhe de React e Next.js; esta skill diz o que cobrar, aquelas dizem como na plataforma.

<a id="skeleton"></a>
## Skeleton no lugar do conteúdo que carrega
- **Vale:** conteúdo que leva mais de ~300 ms para chegar e ocupa área conhecida (card, lista, tabela). O skeleton reserva o espaço: a página não pula quando o dado chega (CLS).
- **Não vale:** resposta que chega em menos de ~300 ms (o skeleton vira pisca) e ação do usuário num botão (aí é o estado do botão: carregando, feito, falhou).
- **Sinal:** `isLoading ? null`, `if (!data) return null`, spinner de página inteira, ou altura que só existe depois do dado.

<a id="ui-otimista"></a>
## UI otimista: o efeito entra na hora e a recusa desfaz
- **Vale:** gesto que grava e quase sempre dá certo (marcar, arquivar, renomear, reordenar). A tela mostra o resultado na hora e volta atrás, dizendo o motivo, se o servidor recusar.
- **Não vale:** pagamento, ação irreversível ou cujo resultado o servidor calcula (o número do pedido, o preço final).
- **Sinal:** `await` da gravação antes de mudar o estado da tela; recusa que não desfaz ou não diz o motivo.

<a id="lazy-load-de-imagem"></a>
## Imagem fora da primeira dobra carrega preguiçosa
- **Vale:** imagem abaixo da dobra, em lista, carrossel ou aba escondida: `loading="lazy"` (ou o componente de imagem do framework).
- **Não vale:** a imagem do LCP (o herói, a primeira do produto): essa leva `fetchpriority="high"` e nunca `lazy`.
- **Sinal:** `<img>` sem `loading` em lista; `loading="lazy"` na primeira imagem da página; imagem sem `width`/`height` (pula o layout).

<a id="imagem-webp-avif"></a>
## Imagem em WebP/AVIF, no tamanho em que aparece
- **Vale:** foto e ilustração raster servidas pelo site: formato moderno, `srcset`/`sizes` no tamanho exibido, ou o otimizador do framework/CDN.
- **Não vale:** ícone e logo (SVG), imagem que o CDN de imagem já converte na borda.
- **Sinal:** `.png`/`.jpg` grandes no repositório servidos direto; imagem de 2000 px exibida a 300 px.

<a id="split-de-js"></a>
## JS partido por rota e por componente pesado
- **Vale:** componente pesado que não aparece na primeira tela (editor, gráfico, mapa, modal raro): `import()` dinâmico / `lazy`. Biblioteca grande importada inteira por uma função só.
- **Não vale:** componente pequeno ou presente na primeira dobra (o split só adia o que já precisava).
- **Sinal:** `import _ from 'lodash'`, `import * as`, biblioteca de gráfico no layout raiz, `'use client'` no topo de árvore grande.

<a id="virtualizar-listas"></a>
## Lista longa virtualizada
- **Vale:** lista ou tabela que pode passar de algumas centenas de linhas renderizadas de uma vez.
- **Não vale:** lista paginada no banco (a página já limita) ou curta; virtualizar lista de 30 itens só quebra a busca do navegador e a acessibilidade.
- **Sinal:** `.map` sobre o resultado inteiro de uma consulta sem limite.

<a id="re-render"></a>
## Re-render só de quem mudou
- **Vale:** tela que trava ao digitar ou rolar; contexto que muda a cada tecla e envolve a árvore toda; objeto ou função criados no render e passados a filho memorizado.
- **Não vale:** `useMemo`/`useCallback` em tudo por precaução: só onde o profiler mostra o custo (com React Compiler, quase nunca à mão).
- **Sinal:** estado de formulário no topo da página; `value={{…}}` num Provider; efeito que grava estado e dispara outro render em cadeia.

<a id="scripts-de-terceiros-depois"></a>
## Script de terceiro depois do conteúdo
- **Vale:** analytics, chat, pixel, teste A/B: carregados depois da interação ou do `load` (`defer`, `async`, estratégia `afterInteractive`/`lazyOnload` do framework).
- **Não vale:** o script de que a primeira tela depende de verdade (raro: consentimento exigido por lei antes de qualquer coleta).
- **Sinal:** `<script src>` de terceiro no `<head>` sem `defer`/`async`.

<a id="fontes-self-hosted"></a>
## Fonte servida pelo próprio site, com display swap
- **Vale:** fonte da web: arquivo no próprio domínio (ou `next/font`), `font-display: swap`, só os pesos usados, pré-carga da fonte do texto principal.
- **Não vale:** fonte do sistema (já é a mais rápida).
- **Sinal:** `<link>` para `fonts.googleapis.com`; seis pesos carregados e dois usados.

<a id="ssr-ssg"></a>
## Página renderizada no servidor ou no build quando o conteúdo permite
- **Vale:** página pública, de SEO ou de primeiro acesso: estática (SSG/ISR) se o conteúdo é igual para todos; servidor (SSR/RSC) se depende da requisição.
- **Não vale:** painel atrás de login muito interativo, onde o cliente já tem o dado em cache; a escolha é do desenho da página, não de cada PR.
- **Sinal:** página pública que busca o conteúdo principal no `useEffect`.

<a id="debounce"></a>
## Debounce na busca e no evento que dispara em rajada
- **Vale:** busca enquanto digita (~250–300 ms), autosave, `resize`/`scroll` que calcula layout (aí `throttle` ou `requestAnimationFrame`).
- **Não vale:** clique de botão (aí é desabilitar enquanto grava) e filtro local sobre lista pequena.
- **Sinal:** `onChange` que chama a API a cada tecla.

<a id="dedupe-de-chamadas"></a>
## A mesma chamada não sai duas vezes
- **Vale:** dois componentes da mesma tela que pedem o mesmo dado; o mesmo `fetch` no layout e na página; clique duplo que grava duas vezes.
- **Não vale:** dado que muda a cada chamada de propósito (contador, sorteio).
- **Sinal:** `useEffect(() => fetch…)` repetido; ausência de cache de consulta (React Query, SWR, `cache()` do React, memo de requisição do framework); botão de gravar que não trava durante o envio.
