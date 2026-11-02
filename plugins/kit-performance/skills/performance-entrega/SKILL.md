---
name: performance-entrega
description: Práticas de performance da entrega e da infra — CDN, compressão Brotli/Gzip, Cache-Control, dependência não usada, streaming de resposta de IA, servidor na região do banco e balanceamento de carga —, cada uma com quando vale, quando não vale e o sinal. Use ao configurar deploy, cabeçalhos HTTP, rota que responde arquivo ou IA, package.json, ou quando a pessoa disser "o site demora a abrir", "TTFB alto", "o bundle cresceu", "a resposta da IA demora".
---

# Performance da entrega e da infra

Regra quando o sinal aparece; `performance.naoSeAplica` do `.claude/kit.json` dispensa no projeto, com o motivo. As de tipo **decisão** (região, balanceamento) não se cobram por ausência: o sinal medido vai a quem decide a infra.

Complemento de fora, quando ligado: `vercel:cdn-caching` tem o como na Vercel; esta skill diz o que conferir.

<a id="cdn"></a>
## Estático e página pública pela CDN
- **Vale:** asset com hash no nome, imagem, página pública estática ou com revalidação.
- **Não vale:** resposta por usuário (atrás de login), que não pode ficar em cache compartilhado.
- **Sinal:** arquivo grande servido pela função/servidor da aplicação; página pública sem cache na borda.

<a id="compressao"></a>
## Resposta comprimida (Brotli, Gzip)
- **Vale:** texto (HTML, JS, CSS, JSON, SVG) servido por servidor próprio: Brotli para estático, Gzip ou Brotli leve para dinâmico.
- **Não vale:** plataforma que já comprime (a maioria das hospedagens gerenciadas e CDNs) e arquivo já comprimido (imagem, vídeo, zip).
- **Sinal:** servidor próprio (Express, Fastify, Nginx) sem compressão; `content-encoding` ausente na resposta de texto.

<a id="cache-de-navegador"></a>
## Cache-Control certo para cada resposta
- **Vale:** asset com hash: `public, max-age=31536000, immutable`; página e API pública: `s-maxage` + `stale-while-revalidate`; resposta por usuário: `private` ou `no-store`.
- **Não vale:** não existe resposta sem cabeçalho certo; o erro comum é cache público em resposta por usuário (vaza dado entre pessoas).
- **Sinal:** rota de API pública sem `Cache-Control`; `public` em resposta que lê sessão.

<a id="dependencias-nao-usadas"></a>
## Sem dependência que ninguém importa
- **Vale:** de tempos em tempos e antes de release: um detector de dependência e export mortos (ex.: `knip`, `depcheck`), e o tamanho do bundle por rota.
- **Não vale:** dependência usada só por script, config ou CLI (o detector precisa saber delas).
- **Sinal:** pacote no `package.json` sem `import` no código; duas bibliotecas para a mesma coisa (duas de data, duas de ícone).

<a id="streaming-de-ia"></a>
## Resposta de IA em streaming
- **Vale:** resposta de modelo exibida à pessoa enquanto ela espera: o texto chega em pedaços (SSE, stream do SDK) e a primeira palavra aparece em menos de um segundo.
- **Não vale:** saída estruturada que só serve inteira (JSON para gravar) ou trabalho em fila.
- **Sinal:** rota que espera a resposta inteira do modelo para devolver; spinner de vários segundos antes de qualquer texto.

<a id="servidor-perto-do-banco"></a>
## Servidor na região do banco — decisão
- **Quando a pergunta aparece:** rota que faz várias consultas em sequência e TTFB alto mesmo com consulta rápida no banco; função rodando numa região e banco em outra.
- **O que medir:** a latência por ida e volta ao banco × o número de idas por requisição.
- **O revisor não cobra a ausência:** leva a medida a quem decide a infra.

<a id="load-balancing"></a>
## Balanceamento de carga — decisão
- **Quando a pergunta aparece:** servidor próprio (VM, contêiner) perto do limite de CPU ou memória, ou ponto único de falha.
- **Não vale:** plataforma serverless ou gerenciada, que já escala e distribui.
- **O revisor não cobra a ausência:** leva a medida (uso, picos, erros) a quem decide a infra.
