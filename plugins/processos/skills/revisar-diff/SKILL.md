---
name: revisar-diff
description: Revisa o diff da branch atual contra o tronco do projeto com o workflow `revisao-do-diff` — revisores em paralelo por dimensão (correção, convenções do CLAUDE.md do projeto, falha silenciosa, docs e spec, segurança) e um cético que tenta derrubar cada achado bloqueante antes de reportá-lo. Use quando a pessoa pedir "revisa o diff", "revisa antes do PR", "/revisar-diff", ou antes de abrir PR de mudança não trivial. Não substitui o teste do PR nem o gate.
---

# Revisar o diff

Invocar esta skill é o pedido explícito para rodar o workflow — ele dispara vários subagentes (1 de escopo, até 5 revisores, até 6 verificadores).

## 1. Montar os args

- `base`: o que a pessoa disse; senão o `guarda.tronco` do `.claude/kit.json` como está (ele já traz o remoto, ex. `origin/main`); sem essa chave, `origin/main`. Rode `git fetch -q origin` antes.
- `head`: `HEAD`, salvo pedido de outra ref.
- `arvore`: `true` por padrão (entra o que não está commitado). `false` quando a pessoa quiser só o commitado.
- `maxVerificacoes`: 6 por padrão; suba se a pessoa pedir revisão exaustiva.

Árvore limpa e nenhum commit à frente da base = nada a revisar: diga isso e pare.

## 2. Rodar

```
Workflow({ name: "processos:revisao-do-diff", args: { base: "origin/main", head: "HEAD" } })
```

Se o nome não resolver (sessão aberta antes do plugin existir, ou o plugin não entrega workflow por nome), use o caminho do plugin:
`Workflow({ scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/revisao-do-diff.js", args: { … } })`.

<a id="performance"></a>
### Com o plugin de performance

Se o agente `kit-performance:revisor-de-performance` está disponível na sessão (o plugin opcional `kit-performance` ligado) e o diff toca código de aplicação (tela, consulta, rota, job, deploy, `package.json`), lance-o em paralelo ao workflow com a mesma `base` e `head`. Os achados dele entram no relato como uma seção à parte, **Performance**, e não mudam o `veredito`: são avisos, salvo o de peso Alto, que se relata junto dos bloqueantes. Sem o plugin, nada muda.

## 3. Relatar

O resultado volta com `veredito` (`APROVADO`, `MUDANCAS_PEDIDAS` ou `NADA_A_REVISAR`), `bloqueantes`, `avisos`, `refutados`, `dimensoesQueFalharam` e `numeros`.

- **`incompleta: true` vem primeiro**: uma dimensão não rodou, e o veredito não vale como aprovação. Diga qual.
- **Bloqueantes**, um por um: `arquivo:linha`, o que quebra (a `prova`), a convenção quando houver, e o conserto. Marque os que têm `nota` (incerto / não verificado) — são bloqueantes que ninguém confirmou nem derrubou.
- **Avisos** em uma linha cada. **Refutados**: só a contagem, e o título se a pessoa pedir.
- Os `numeros` numa linha (brutos → únicos → confirmados/refutados).

Não conserte nada sem a pessoa pedir. A revisão não comenta na PR e não bloqueia merge sozinha — quem decide é quem lê.
