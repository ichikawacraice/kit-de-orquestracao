# F373 (fatia 2) · A orquestradora só acorda quando precisa

- Data: 2026-11-04 (pedido do operador, repassado pela orquestradora)
- Decisão: [ADR 0022](../adr/0022-a-orquestradora-so-acorda-quando-precisa.md); fatia 1: [plano](2026-11-04-gasto-fixo-validador-e-espera.md)

<a id="medido"></a>
## Medido antes (02 a 04/11)
`node scripts/custo-fixo.mjs --desde 2026-11-02 --ate 2026-11-05` (agora com os turnos da batida à parte):

| Turnos da orquestradora | Turnos | Custo |
|---|---|---|
| Aviso de fim de turno de dona | 306 (57%) | US$ 68,6 (33% da orquestradora) |
| Operador | 106 | US$ 85,4 |
| Notificação de tarefa dela | 93 | US$ 35,2 |
| Batida | 18 | US$ 11,5 |
| Mensagem de sessão | 12 | US$ 3,5 |

Orquestradora: US$ 209 (15,4% do total), ~260 mil tokens por chamada.

<a id="premissas"></a>
## Premissas conferidas
- **Dá para não gerar o aviso:** a descrição de `detach_session` diz que quem abriu a sessão "is no longer told when its turns end", e aceita `"self"` na sessão aberta pelo Claude de outra. Recusa a aberta por cartão do operador, a que divide worktree e a sem operador. Não testado ao vivo: o desligamento não se desfaz e muda a barra lateral do operador; a medição depois do merge confirma (linha `turnos de evento`).
- **O PR pronto já não precisa da orquestradora:** a fila roda sem turno dela desde o F351; o único caso que ela cobrava pelo aviso, o PR fora da fila, a batida passa a cobrar da dona.
- **O pós-merge** (subir-versao, atualizar-plugins, arquivar, girar o estado) ainda é dela e fica para a fatia 3.

<a id="escopo"></a>
## Escopo
1. `dona.md` passo 1 e `protocolo.md`: a dona se desliga no primeiro turno.
2. Skill `orquestradora`: seção `quando-acorda` (os quatro gatilhos), o turno de aviso sem leitura, a dona achada pelo painel.
3. `batida.mjs`: o merge parado com PR fora da fila e dona viva vira mensagem `anotar` à dona; à orquestradora só o resto.
4. `scripts/custo-fixo.mjs`: turnos da batida à parte.

Fora: o pós-merge sem turno (fatia 3); travar a dona que não se desligou (o registro do app não mostra ainda como fica a sessão desligada).

<a id="medir-depois"></a>
## Medir depois
```bash
node scripts/custo-fixo.mjs --desde <data do merge>
```
A linha `turnos de evento` deve cair perto de zero (sobram as donas que o app não deixa desligar), e a de `batida` pode subir pouco (o merge parado sem dona viva).
