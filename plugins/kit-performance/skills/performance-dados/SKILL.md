---
name: performance-dados
description: Práticas de performance de dados e back — N+1, índices, select só das colunas, paginação no banco, pool de conexões, chamadas em paralelo, timeout em API externa, fila de jobs e cache de dados (Redis) —, cada uma com quando vale, quando não vale e o sinal no código. Use ao escrever ou revisar consulta, rota de API, server action, job, migration de índice ou integração com API externa, e quando a pessoa disser "a API está lenta", "o banco está no talo", "timeout", "a rota demora".
---

# Performance de dados e back

Cada prática é **regra quando o sinal aparece**. A seção `performance.naoSeAplica` do `.claude/kit.json` dispensa uma prática no projeto, com o motivo. A prática de tipo **decisão** (cache de dados) não se cobra por ausência: leva-se o sinal medido a quem decide a infra. Meça antes de otimizar (skill `medir-performance`): o plano da consulta (`EXPLAIN ANALYZE`) vale mais que o palpite.

Complementos de fora, quando ligados: `vercel:runtime-cache` e `vercel:queues` têm o como na Vercel; esta skill diz quando.

<a id="n-mais-1"></a>
## Sem N+1: uma consulta por lista, não uma por item
- **Vale:** sempre que uma lista busca algo por item.
- **Não vale:** lista de tamanho fixo e pequeno (2–3 itens) em caminho frio.
- **Sinal:** `await` de consulta dentro de `for`/`.map`; ORM que carrega relação preguiçosa no laço. Conserto: `in (...)`, join, relação embutida no select, ou um loader que agrupa.

<a id="indices"></a>
## Índice para o filtro e a ordenação que a consulta usa
- **Vale:** coluna em `where`, `join` ou `order by` de consulta frequente em tabela que cresce; chave estrangeira (o Postgres não cria índice nela sozinho); a coluna da política de RLS.
- **Não vale:** tabela pequena e estável; índice que ninguém usa só encarece a escrita.
- **Sinal:** filtro novo sem migration de índice; `Seq Scan` no plano de consulta quente.

<a id="select-so-das-colunas"></a>
## Select só das colunas usadas
- **Vale:** tabela com coluna larga (texto, JSON, embedding) ou lista que trafega para o cliente.
- **Não vale:** registro único de tabela estreita, lido inteiro de propósito.
- **Sinal:** `select('*')`, `SELECT *`, `findMany()` sem `select`, e o resultado inteiro passado ao cliente (vaza dado, além de pesar).

<a id="paginacao"></a>
## Lista paginada no banco, não no cliente
- **Vale:** toda lista que cresce com o uso. Cursor (`where id > :ultimo`) para lista longa ou rolagem infinita; `offset` só para poucas páginas.
- **Não vale:** lista que, por regra do domínio, tem teto pequeno.
- **Sinal:** consulta sem `limit`/`range`; `.slice` no cliente sobre tudo.

<a id="pool-de-conexoes"></a>
## Pool de conexões no banco, sobretudo em serverless
- **Vale:** função serverless ou edge falando com Postgres: use o pooler (modo transação) ou o cliente HTTP do provedor; servidor longo: um pool por processo, criado uma vez.
- **Não vale:** script de uma execução só.
- **Sinal:** `new Client()`/`new Pool()` dentro do handler; conexão direta na porta do banco a partir de função serverless; "too many connections" no log.

<a id="requisicoes-em-paralelo"></a>
## Chamadas independentes em paralelo
- **Vale:** duas ou mais chamadas que não dependem uma da outra: `Promise.all` (ou `allSettled` quando uma pode falhar sem derrubar a outra).
- **Não vale:** chamada que precisa do resultado da anterior, ou API externa com limite de taxa (aí, paralelo com teto).
- **Sinal:** `await a(); await b();` com `b` sem usar `a`.

<a id="timeout-em-api-externa"></a>
## Timeout em toda chamada a API externa
- **Vale:** toda chamada de rede para fora (`AbortSignal.timeout(ms)`, opção `timeout` do SDK), com retentativa e recuo só no que é idempotente.
- **Não vale:** nunca deixa de valer; o que muda é o prazo.
- **Sinal:** `fetch` para fora sem `signal`; SDK sem `timeout`; retentativa sem teto.

<a id="fila-de-jobs"></a>
## Trabalho lento vai para fila, fora da requisição
- **Vale:** trabalho que passa de alguns segundos ou pode falhar e ser refeito (e-mail, PDF, importação, chamada de IA longa, webhook de saída): a requisição enfileira e responde; o worker processa com retentativa.
- **Não vale:** trabalho curto cujo resultado a pessoa espera na tela.
- **Sinal:** rota que faz laço de chamadas externas antes de responder; `waitUntil`/promessa solta para trabalho que não pode se perder.

<a id="cache-de-dados"></a>
## Cache de dados (Redis ou similar) — decisão
- **Quando a pergunta aparece:** a mesma leitura cara (agregação, API externa lenta) repetida muitas vezes com o mesmo resultado, já com índice e consulta certos.
- **Antes de Redis:** cache do framework ou da CDN, view materializada, coluna calculada. Cache novo traz invalidação, e invalidação errada é dado velho na tela.
- **O revisor não cobra a ausência:** leva o sinal medido (a consulta, a frequência, o tempo) a quem decide a infra.
