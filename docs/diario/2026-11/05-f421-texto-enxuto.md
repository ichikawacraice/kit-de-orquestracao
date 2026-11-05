<a id="f421-texto-enxuto"></a>
# 05/11/2026 · F421 — protocolo e skill da orquestradora enxutos

Fase 1 do diagnóstico de custo. O `pool/protocolo.md` e a `skills/orquestradora/SKILL.md` são relidos inteiros a cada turno de toda dona e da orquestradora. Os dois foram cortados para a regra viva. O "como funciona por dentro" foi para `pool/referencia.md` e `skills/orquestradora/referencia.md`, por link com âncora explícita. O teste `hooks/tests/links-e-ancoras.test.mjs` passa a conferir que todo link `arquivo.md#ancora` desses arquivos resolve.

| Arquivo | Antes | Depois |
|---|---|---|
| `pool/protocolo.md` | 53.899 B | 28.181 B |
| `skills/orquestradora/SKILL.md` | 55.091 B | 21.203 B |

A meta era ~16 KB em cada um. O protocolo parou em 28 KB porque os testes de documento travam o texto literal de algumas seções: a análise do pedido, o bloco do handoff (idêntico ao da skill), a tabela de skills, a via rápida da revisão, o CI só na produção, a batida e o teto de núcleos. Cortar mais exige mexer nesses testes, o que fica para um item próprio.

## O histórico que saiu dos textos
O texto de regra não carrega mais a origem de cada regra. O que segue foi tirado dos dois arquivos e fica registrado aqui.
- **Espera no turno** (F373, ADR 0021): de 02 a 04/11, a orquestradora teve 87 turnos só para ler "o validador ainda roda, aguardo".
- **Aviso de fim de turno da dona:** no mesmo período, foram 306 turnos da orquestradora vindos desse aviso, um terço do custo dela. Daí o `detach_session` no primeiro turno da dona.
- **Via rápida da revisão:** existe desde o F348 (Q851). O piso de um subagente é ~33 mil tokens.
- **Fila de merge em segundo plano:** medido em 28/10, a limpeza de contexto mata essa fila. Daí o `filaParada` da batida.
- **Orçamento de contexto:** medido em 02/11 sobre a semana de 26/10, com a conta inteira e o preço relativo do Opus 5.5:

  | Parte do custo | Fatia |
  |---|---|
  | Releitura de cache | ~66% |
  | Escrita de cache | ~21% |
  | Saída | ~12% |

  O contexto relido por chamada estava em ~180 mil tokens; antes de 25/10 era ~300 mil. O piso de uma sessão nova é ~105 mil tokens; o de um subagente, ~33 mil.
- **Rótulos de origem retirados da skill:** F209, F221, F351, F370, F371 (volta da limpeza), F373, F398 e F400 (trava das outras sessões).
