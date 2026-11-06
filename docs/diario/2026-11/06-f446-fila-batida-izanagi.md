<a id="f446-fila-batida-izanagi"></a>
# 06/11/2026 · F446 — fila e batida: defeitos vistos no Izanagi

Cinco defeitos relatados no projeto Izanagi, conferidos contra a main (097db9b). Quatro foram reproduzidos com teste vermelho e consertados; um não se reproduziu.

- **Fechamento pelo PR velho (F303):** a dona abria os PRs num worktree ao lado do checkout da sessão. Só o primeiro PR (1698) ficou ligado ao item. Com `maisFatias: false`, a batida fechou o item às 00:35 com o 1704 aberto; a devolução do 1704, às 01:01, saiu sem item. Agora a dedução liga também o PR aberto cuja branch (fora da base) traz o id do item como o primeiro id, palavra inteira, criado depois de o item nascer. Só o aberto: o id segura o fechamento, nunca fecha; e o PR que a branch da sessão de outro item liga continua dele. Na fila, o PR sem `prs` nem branch de dona se liga ao item do primeiro id da branch dele, e a devolução chega à dona.
- **Cobrança de item em espera:** a dedução roda fora da trava, com até 25 s de `gh`, e o `parado` dela não via a espera gravada nesse meio tempo. A retomada do limite de uso e o relatório de merge parado pela fila órfã nem olhavam a espera. Agora a espera e a trava do item relido seguram os três.
- **Fila sem turno com release aberto:** não havia o conceito. A rodada sem turno agora pausa a base que tem um PR aberto levando-a a outra branch; o PR de outra base no mesmo lote segue ([referência](../../../plugins/orquestracao/pool/referencia.md#pausa-por-release)).
- **Sem `refs/pull/N/head`:** a `fila-de-merge` e o `mergear` buscam a ponta pela branch do PR (`headRefName`) e conferem que o sha validado veio junto.
- **"Devolvido" de rodada antiga reenviado:** não se reproduziu. Nos transcripts do Izanagi, cada devolução chegou uma vez; as repetições eram devoluções distintas do mesmo PR (motivos diferentes) ou releituras do log. O código entrega cada desfecho às donas no máximo uma vez (`donasAvisadas` e a baixa na mesma trava, antes de a saída ir ao mod).
