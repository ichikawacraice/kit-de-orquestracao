---
name: medir-performance
description: Como medir performance antes e depois de otimizar — medição no usuário real (RUM, web vitals LCP/INP/CLS), rastreio do back (OpenTelemetry) e teste em celular médio e rede lenta —, com o orçamento do projeto. Use antes de otimizar ("está lento", "melhora a performance"), para provar que uma otimização funcionou, ao montar observabilidade, ou quando a pessoa perguntar "como sei se está rápido".
---

# Medir performance

Otimização sem medida é palpite: meça antes, mude uma coisa, meça depois, e cole os dois números. O laudo só afirma o que mediu.

O orçamento do projeto mora em `performance.orcamento` do `.claude/kit.json` (`lcpMs`, `inpMs`, `cls`); sem ele valem os padrões do plugin (LCP 2500 ms, INP 200 ms, CLS 0,1, no p75 do usuário real, o limiar "bom" dos web vitals).

Complemento de fora, quando ligado: `vercel:custom-metrics` tem o como na Vercel.

<a id="rum"></a>
## Medição no usuário real (RUM, web vitals)
- **Vale:** todo front em produção: coletar LCP, INP, CLS e TTFB do usuário real (biblioteca `web-vitals`, o analytics da plataforma ou um RUM) por rota, no p75. O laboratório (Lighthouse) acha a causa; o RUM diz se o problema existe.
- **Não vale:** ferramenta interna de poucos usuários, onde o teste em celular e rede lenta basta.
- **Sinal:** nenhum envio de web vitals no código nem analytics de performance ligado na plataforma.

<a id="opentelemetry"></a>
## Rastreio do back (OpenTelemetry)
- **Vale:** back com mais de um salto (rota → banco → API externa → fila): rastreio com spans por consulta e por chamada externa, para saber onde vai o tempo. OpenTelemetry evita prender o projeto a um fornecedor.
- **Não vale:** back de uma rota simples; aí o tempo por rota no log basta.
- **Sinal:** rota lenta sem como dizer qual parte é lenta; log sem duração.

<a id="celular-e-rede-lenta"></a>
## Teste em celular médio e rede lenta
- **Vale:** toda tela que gente de fora usa: CPU 4× mais lenta e rede "Slow 4G" no DevTools (ou um celular médio de verdade) antes de dar a tela por pronta.
- **Não vale:** painel só de desktop interno, se o projeto declarar isso em `performance.naoSeAplica`.
- **Sinal:** tela validada só no notebook do desenvolvedor.

## O ciclo
1. **Medir o atual** no ambiente mais próximo do real; anote o número e as condições.
2. **Achar a causa:** Lighthouse/Performance do DevTools para o front, `EXPLAIN ANALYZE` e o rastreio para o back.
3. **Mudar uma coisa** (a prática da skill `performance-front`, `performance-dados` ou `performance-entrega`).
4. **Medir de novo** nas mesmas condições; sem ganho, desfaça.
