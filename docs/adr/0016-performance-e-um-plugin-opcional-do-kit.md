# ADR 0016 — Performance é um plugin opcional do kit, com as práticas por camada e um revisor

- Data: 2026-11-02
- Status: Proposto
- Autor: sessão dona do F343
- Relacionados: [ADR 0002](0002-processos-de-documento-e-design-sao-plugins-opcionais.md) (plugins de processo), [ADR 0014](0014-o-kit-decide-as-skills-de-fora-num-catalogo.md) (skills de fora), [ADR 0015](0015-o-plugin-declara-as-substitutas-dele.md) (substitutas); guia em [`docs/guia/ligar-e-desligar.md#kit-performance`](../guia/ligar-e-desligar.md#kit-performance)

<a id="contexto"></a>
## Contexto
- O operador pediu que os padrões novos (design, performance e o que vier) morem no mesmo marketplace, cada um opcional, "e a pessoa decide o que instalar", com uma lista de 31 práticas de performance.
- O kit não tinha nada de performance além da regra de UI otimista no bloco de design do `CLAUDE.md`. Fora do kit, o plugin `vercel` (cache na CDN, cache de runtime, filas, métricas) e a skill `vercel-react-best-practices` cobrem parte, presos à plataforma; a revisão de código de fora cita N+1.
- A lista mistura regra de código (N+1, `select` só das colunas, timeout em API externa), prática de tela (skeleton, imagem preguiçosa, virtualização) e decisão de infra (Redis, região do servidor, balanceamento). Cobrar decisão de infra como regra gera achado falso em todo projeto pequeno.
- Skill de plugin não se liga uma a uma (ADR 0002): o que é opcional vira plugin.

<a id="decisao"></a>
## Decisão
1. **Plugin novo `kit-performance` no marketplace do kit, opcional:** o `kit iniciar` e o `kit adotar` não o ligam (os quatro plugins de antes seguem ligados por padrão, ADR 0002). Não depende de outro plugin do kit nem de fora.
2. **Quatro skills por camada, não 31:** `performance-front`, `performance-dados`, `performance-entrega` e `medir-performance`. Cada prática é uma seção com âncora pelo id, e diz quando vale, quando não vale e o sinal no código.
3. **O catálogo `praticas.json`** na raiz do plugin dá a cada prática um id, a camada e o tipo: `regra` (cobrada quando o sinal aparece) ou `decisao` (cache de dados, região, balanceamento: nunca cobrada por ausência; o sinal medido vai a quem decide a infra). Um teste confere o catálogo contra as âncoras das skills.
4. **Um agente só leitura, `revisor-de-performance`:** audita o diff (ou o projeto, se pedido) e devolve até 8 achados com prática, onde, evidência e conserto.
5. **Seção `performance` opcional no `.claude/kit.json`:** `naoSeAplica` (`{ id: motivo }`, a dispensa do projeto) e `orcamento` (`lcpMs`, `inpMs`, `cls`). Sem chave de liga/desliga: ligar é o `enabledPlugins`, e o `kit.json` não religa plugin desligado (ADR 0002). O `kit doutor` confere a seção contra o catálogo, só com aviso.
6. **Integração sem obrigar:** com o `processos` ligado, o `revisar-diff` lança o revisor quando ele existe na sessão e o diff toca código de aplicação. Com o plugin `vercel` ligado, as skills apontam para as dele no detalhe da plataforma; nenhuma skill de fora é barrada nem declarada substituta.

<a id="alternativas"></a>
## Alternativas consideradas
- **Uma skill por prática (31).** Rejeitada: 31 descrições disputando o gatilho no contexto de toda sessão, e as práticas de uma camada se leem juntas (a lista longa é paginação e virtualização ao mesmo tempo).
- **Pôr as práticas dentro do `processos` ou do `kit-design`.** Rejeitada: o operador quer cada padrão opcional, e o projeto que quer os processos e não quer performance teria as duas coisas juntas.
- **Ligar o `kit-performance` por padrão no `kit iniciar`, como os outros.** Rejeitada: o pedido é "a pessoa decide o que instalar"; o plugin não tem trava, e ligá-lo sem pedir só soma skills ao contexto.
- **O crítico de UI do `kit-design` cobrar skeleton, otimista e layout shift.** Rejeitada: o crítico julga seis eixos visuais fixos, e o estado visível da ação assíncrona e o efeito otimista já são regra do bloco de design; a medida de runtime (CLS, LCP) é do revisor de performance, que o `kit-design` não precisa conhecer.
- **Declarar as skills da Vercel como substitutas (ADR 0015).** Rejeitada: substituta barra a original, e as da Vercel complementam (dizem o como na plataforma), não repetem o kit.
- **Cobrar Redis, região e balanceamento como regra.** Rejeitada: são decisões de infra com custo; como regra viram achado falso em todo projeto pequeno.
- **Uma trava (hook) que cobre o revisor antes do PR, como a do crítico.** Adiada: sem medida de quantas vezes a revisão de performance faltou, a trava seria custo sem evidência.

<a id="consequencias"></a>
## Consequências
- O projeto liga o plugin quando quer (`--scope project` para ligar só nele); o projeto onde ele não está ligado, nem na conta, não sente nada.
- Prática nova entra no `praticas.json` e na seção da skill da camada, ou o teste reprova.
- Mais um plugin para versionar: a orquestradora sobe a versão dele no lote, como os outros.
