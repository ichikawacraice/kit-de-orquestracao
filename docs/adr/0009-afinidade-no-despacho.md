# ADR 0009 — Item do mesmo assunto vai primeiro ao membro que fez o último

- Data: 2026-10-27
- Status: Proposto
- Autor: sessão planejadora do kit (item F143), a pedido do operador (Q418)
- Relacionados: complementa o [ADR 0007](0007-cada-sessao-cuida-do-proprio-item-e-a-batida-roda-no-mod.md) (a batida avisa o livre) · plano [`2026-10-27-afinidade-no-despacho`](../planos/2026-10-27-afinidade-no-despacho.md)
- Pendências: medir depois de uma semana quantos itens foram ao membro afim e quanto esperaram por ele; confirmar os 20 min de espera e "mesma tela = mesmo tema"

<a id="contexto"></a>
## Contexto
- **Hoje** a batida avisa o membro livre do papel que está parado há mais tempo (`livresDe`, ADR 0007), e quem termina um item se limpa. Cada item novo começa com uma sessão que relê o projeto do zero, mesmo quando o item anterior dela era do mesmo assunto.
- **O pedido do operador (Q418, 27/10):** a mesma planejadora com itens do mesmo assunto e a mesma designer com itens da mesma tela; um item por vez e um PR por item.
- **O que a fila guarda (medido em 27/10, 143 itens):** `fez` em 75 itens, só de quem saiu com `--fez` (na prática E e D); `historico` só com o apelido, que se repete entre sessões diferentes (dois `E2` em momentos diferentes). Nada diz, com o `local_…`, que planejadora passou por um item. Todo item tem `tema`, e os temas de tela já são telas (`editor`, `quadro`, `painel`).

<a id="decisao"></a>
## Decisão
1. **O item registra quem passou por ele:** campo `passaram` (`{localId, apelido, papel, em}`), gravado só pelo `painel` em `com add` e `pegar`. Item antigo usa o `fez`.
2. **Membro afim** de um item que espera o papel X: quem, do papel X, passou mais recentemente por um item do mesmo projeto e mesmo `tema`, com a sessão viva e o título ainda com o mesmo apelido. Para a designer, "mesma tela" é o mesmo `tema`.
3. **A batida oferece primeiro ao afim.** Livre: o aviso vai a ele. Ocupado: recebe uma vez "pegue ao terminar o atual", e o item espera por ele até 20 min (`BATIDA_AFINIDADE_MIN`) antes de ir ao livre mais antigo ou virar vaga.
4. **Quem termina olha o mesmo assunto antes de se limpar:** `painel seguinte <local_…> <apelido> [--tokens N]` pega, dentro da trava, o item mais antigo do mesmo tema que espera o papel dele, e a sessão segue com a conversa. Com o contexto acima do aviso do papel, recusa: a sessão se limpa e o item vai a outro.
5. **Continua:** um item por vez, um PR por item.

<a id="alternativas"></a>
## Alternativas consideradas
- **Usar o `fez` como registro.** Descartada: a P não entra nele, e o `--fez` é o que isenta a executora da limpeza; ampliá-lo mudaria essa regra.
- **Usar o apelido do `historico`.** Descartada: o apelido se repete entre sessões diferentes, e a afinidade é com a conversa, que mora no `local_…`.
- **Esperar o afim ocupado sem prazo.** Descartada: um item longo do afim pararia a fila do assunto; com 20 min, abaixo dos 30 do item parado, cabe um item pequeno e nada fica preso.
- **"Mesma tela" pelos globs de tela do `kit.json`.** Descartada por ora: os globs dizem quais arquivos são tela, não qual tela; o tema já separa as telas.
- **Vários itens do mesmo assunto num PR.** Recusada pelo operador (Q418).

<a id="consequencias"></a>
## Consequências
- Menos sessões relendo o projeto e menos limpezas; o membro afim chega ao item com o contexto do anterior.
- O contexto cresce mais por sessão: o teto do papel (decisão 4) é o limite, e a barra já avisa.
- O item pode esperar até 20 min a mais pelo afim ocupado.
- O `painel` ganha um campo que só ele grava (`passaram`) e um comando (`seguinte`); os papéis ganham um passo no "Ao terminar".
