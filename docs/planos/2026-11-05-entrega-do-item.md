# Plano — F404 · A entrega do item

Decisão em [ADR 0024](../adr/0024-a-dona-grava-a-entrega-no-item.md).

<a id="fatias"></a>
## O que muda
1. `painel.mjs`
   - valida `entrega` (`{resultado, medido?, naoMedido?, proximos?}`, resultado não vazio);
   - apaga `entrega` na reabertura (feito → vivo);
   - comando `entregas [--desde <ISO|HH:MM>] [--todos]`: itens com `feitoEm >= desde` (padrão 24 h), do projeto do cwd ou de todos, com `entrega` e o primeiro PR;
   - o `--anotar` devolve `avisoSemEntrega` quando o item do PR fecha e não tem entrega;
   - o resumo do desfecho (`desfechos.log`) leva o resultado da entrega do item que fechou.
2. `hooks/fila-do-item.mjs`: item meu em `merge`, com `prs`, sem `maisFatias: true` e sem `entrega.resultado` bloqueia o turno que mudou algo, com o comando pronto.
3. Pane (`register.tsx`, `desenho.ts`, `types`): `LinhaItem.entrega` no item feito; o cartão mostra "Entregue: …" e "próximos: N".
4. Docs: `pool/dona.md` (gravar a entrega antes do PR final), skill `orquestradora` (`painel entregas`), cabeçalho do `painel.mjs`.

<a id="testes"></a>
## Testes (antes do código)
- `fila-do-item.test.mjs`: bloqueia sem entrega no PR final; passa com entrega, com `maisFatias: true` e fora de `merge`.
- `painel-entrega.test.mjs`: validação, reabertura, `painel entregas`, aviso do `--anotar`.
- `painel.test.tsx`: o cartão do feito com entrega.

<a id="depois"></a>
## Depois
- "Entregue desde a última vez que você olhou" (precisa guardar quando o operador olhou).
