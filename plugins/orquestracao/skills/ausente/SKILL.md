---
name: ausente
description: Liga e desliga o modo ausente da orquestradora — /ausente on pré-cria o pool padrão (ligado, não se pede vaga nova nem cartão); /ausente off volta ao pool sem teto e sob demanda. Só pelo comando; nenhuma frase liga ou desliga.
argument-hint: on | off
disable-model-invocation: true
---

# /ausente on | off — o modo ausente

Argumento: `$ARGUMENTS`.

**Só este comando liga e desliga o modo** (operador, 24/10: *"mesmo que eu escreva, não sair do modo, pq posso vir, dar um comando e sair novamente"*). O hook `${CLAUDE_PLUGIN_ROOT}/hooks/operador-ausente.mjs` grava a bandeira `~/.claude/orquestracao/operador-ausente.json` no `on` e a apaga no `off`; frase ("vou dormir") e prompt comum não mexem, e não há prazo. Com o modo ligado, o operador pode mandar comandos normalmente: o turno dele abre sessão (é ele ali), e o de notificação ou de outra sessão só propõe cartão (trava T3a do `papel-do-pool.mjs`).

- **`off`:** responda numa linha que o modo ausente foi desligado. Daí em diante vale o pool sob demanda e sem teto (vaga nova quando o trabalho pedir): no próximo ritual, a orquestradora arquiva sozinha o membro sem item vivo. Grave a etapa no painel e uma linha no `~/.claude/orquestracao/<projeto>.md` (o da orquestradora deste projeto). Não faça os passos abaixo.
- **Sem argumento:** diga se o modo está ligado (a bandeira existe, e desde quando) e como ligar/desligar. Não mude nada.
- **`on`:** os passos abaixo.

O operador digitou `/ausente on`: vai ficar fora ou dormir. Este turno é dele, então `start_session` abre sessão. Depois dele, só sai cartão. Regra em `${CLAUDE_PLUGIN_ROOT}/pool/protocolo.md`, âncora `sob-demanda`.

**Fora da orquestradora:** se esta sessão não é a orquestradora (título sem `🎛 orquestradora`), diga isso numa linha e não faça nada.

## Passos

1. **O que existe e o que está vivo.** Rode `list_sessions {"linked": true}` e `painel list fila --projeto <este>`: quais frentes estão vivas, e se alguma toca tela (front, painel, design), mesmo que ainda esteja só no plano.
2. **O alvo é o POOL PADRÃO, não a fila** (operador, 24/10: *"se o planejamento envolve design, pode não ter nada na fila ainda, mas vai ter"*). Membro que falta quando a planejadora pede não pode ser aberto com o operador fora:
   - **4 E** e **3 V** sempre;
   - **uma D** se alguma frente viva toca tela, mesmo sem item de design na fila;
   - **uma P por frente viva, mais uma P livre** para frente que surgir (*assumida, a confirmar*).
3. **Quem já existe conta.** Membro livre ou trabalhando não se duplica. Abra só a diferença: `start_session` `user_asked`, título `<ID> · livre` com o próximo número livre do papel, e modelo e esforço do papel (skill `papeis-e-modelos`: P e V em Opus com esforço alto, E em Sonnet com esforço médio). Depois rode `node "${CLAUDE_PLUGIN_ROOT}/pool/aplicar-skills-do-papel.mjs" <local_…>` em cada uma.
4. **Despache já** o que tem item esperando o papel. O resto fica `livre`, **não se pede vaga nova nem cartão** (não há quem aceite; item além do pool espera o primeiro membro do papel que liberar) e **nada se arquiva** enquanto o modo ausente durar (a pergunta sobre os livres sem trabalho previsto só vale com o operador presente).
5. **Registre:**
   - no painel, a linha de cada membro novo e a da orquestradora (etapa *"modo ausente: N membros pré-criados"*);
   - uma linha no `~/.claude/orquestracao/<projeto>.md`.
6. **Responda numa mensagem curta:**
   - quantos membros abriu, por papel;
   - o que cada um já pegou;
   - o que vai precisar de você na volta (só o que pede Q-ID: produção, release, o irreversível).
