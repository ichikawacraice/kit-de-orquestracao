# F373 (fatia 3) · O pós-merge sem turno da orquestradora

- Data: 2026-11-04 (pedido do operador, repassado pela orquestradora)
- Decisão: [ADR 0023](../adr/0023-o-pos-merge-roda-sem-turno-da-orquestradora.md); fatias anteriores: [1](2026-11-04-gasto-fixo-validador-e-espera.md), [2](2026-11-04-orquestradora-so-acorda-quando-precisa.md)

<a id="premissas"></a>
## Premissas conferidas
- **O pós-merge é mecânico.** São scripts que já existiam: `subir-versao`, `atualizar-plugins` e `estado-girar`. O único passo que pedia julgamento era arquivar a dona pelas cinco condições, e a dona que acabou de entregar cumpre todas: worktree limpo e empurrado, parada, sem item vivo.
- **O checkout principal não serve para subir a versão sem turno.** O `subir-versao` exige estar na base, e a base não cabe em dois worktrees. Daí o worktree temporário destacado mais o `--destacado`.
- **Arquivar pelo mod esbarra na aprovação.** O `archive_session` pede aprovação fora do bypass e diz "only after the user has explicitly agreed". O interruptor `auto_archive_on_close` do monitor do PR existe para isto; não foi testado ao vivo.
- **A devolução não precisa da orquestradora:** a batida já manda o motivo e o log à dona.

<a id="escopo"></a>
## Escopo
1. `subir-versao --destacado`.
2. `scripts/pos-merge.mjs`, chamado pela rodada `--sem-turno` que mergeou; o resultado vai ao desfecho (`posMerge`).
3. `batida.mjs`: `desfechoAcorda` decide se o desfecho vai à orquestradora ou ao registro `batida/<projeto>.desfechos.log`.
4. `dona.md` passo 6: `auto_archive_on_close` no PR que fecha o item, salvo com o modo ausente ligado.
5. Skill `orquestradora` (`quando-acorda`, passo 3 do ritual, fim de lote) e `protocolo.md`.

Fora: o aviso `fatia PR N mergeada` (continua da batida); a rodada que a orquestradora chama (o pós-merge dela segue à mão).

<a id="criterio"></a>
## Critério de pronto
Testes afetados verdes: `subir-versao`, `pos-merge`, `painel-fila-de-merge`, `painel-batida` e `orquestradora-acorda-doc`.

<a id="medir-depois"></a>
## Medir depois
```bash
node scripts/custo-fixo.mjs --desde <data do merge>
```
Os turnos da orquestradora vindos da batida (`batida`) devem cair; o registro `batida/<projeto>.desfechos.log` mostra os lotes que fecharam sem ela.
