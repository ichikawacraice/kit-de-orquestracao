# Guia do kit de orquestração

Para quem vai usar o kit num projeto e nunca o viu. Comece pelo primeiro dia; as outras páginas são de consulta.

| Página | Para quê |
|---|---|
| [O primeiro dia](primeiro-dia.md) | Instalar, pôr o kit no projeto, declarar a orquestradora e pedir o primeiro item |
| [O dia a dia](dia-a-dia.md) | Como pedir trabalho, responder às perguntas (Q-ID), usar o painel, sair com `/ausente`, limpar contexto e reiniciar o app |
| [Comandos](comandos.md) | O CLI `kit`, os comandos que o plugin põe no terminal das sessões e os comandos de barra |
| [O que ligar e desligar](ligar-e-desligar.md) | Cada trava e opção: o que faz, quando incomoda, como desligar e o que se perde |
| [Conflitos com outros plugins](conflitos.md) | Quando o kit convive com outros plugins, skills ou hooks seus |
| [Problemas comuns](problemas-comuns.md) | O sintoma, a causa e a saída |

## O kit em um minuto

- **Você conversa com uma sessão só, a orquestradora.** Pede o trabalho a ela em palavras suas; ela registra um item (`F12`), abre uma sessão dona para ele e cuida do merge.
- **A dona faz o item inteiro:** mede, decide, escreve, testa, pede revisão a um subagente de contexto limpo e abre o PR. Até 4 donas trabalham ao mesmo tempo (3 com a máquina cheia).
- **A fila de merge** junta os PRs prontos, roda os testes completos uma vez sobre a combinação e mergeia o que passou. O que conflitou ou ficou vermelho volta para a dona.
- **Tudo o que precisa de você chega com um ID (`Q12`),** com o caso, o que acontece se você não decidir e a recomendação. Você responde no chat ("Q12 sim") ou no botão do painel.
- **As regras que não podem depender de memória são travas** (hooks): a orquestradora não edita código, subagente não edita, segredo não sai para outra sessão, teste não roda fora do teto de núcleos, e assim por diante. [O que ligar e desligar](ligar-e-desligar.md) lista todas.

## Onde está a regra de verdade

O guia descreve; a regra mora no manual das sessões, que é o que elas leem:

- [`protocolo.md`](../../plugins/orquestracao/pool/protocolo.md) — a regra comum a todas as sessões.
- [`dona.md`](../../plugins/orquestracao/pool/dona.md) — o passo a passo da sessão dona.
- A skill [`orquestradora`](../../plugins/orquestracao/skills/orquestradora/SKILL.md) — o manual da orquestradora.
- Os [ADRs](../adr/README.md) — por que o desenho é este.

Se o guia e o manual discordarem, vale o manual; avise quem mantém o kit.
