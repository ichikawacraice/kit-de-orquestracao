// Fila de entrega das respostas no Orca (F448, fatia 9). Respostas dadas a poucos segundos uma da outra para a mesma
// sessão saem juntas numa só mensagem: cada mensagem acorda a sessão e custa um turno do modelo. A janela conta da
// primeira resposta do lote (uma resposta a cada poucos segundos não segura o lote para sempre); destinos diferentes
// nunca se juntam; o que chega enquanto um envio ao mesmo destino está em voo vai no lote seguinte, depois dele.
// Sem import nenhum: o relógio (`agendar`) e o transporte (`enviarLote`) vêm de fora.

/** Assunto e corpo de um lote. Uma resposta fica como era; várias viram uma lista numerada (cada texto já cita o Q-ID). */
export function montarLote(itens) {
  if (!itens?.length) throw new Error('lote vazio');
  const ids = itens.map((i) => i.id);
  if (itens.length === 1) return { assunto: `Resposta ${ids[0]}`, corpo: itens[0].texto, ids };
  const lista = itens.map((i, n) => `${n + 1}. ${i.texto}`).join('\n\n');
  const corpo = `${itens.length} respostas do operador pela aba do kit no Orca, juntas numa mensagem porque saíram a poucos segundos uma da outra:\n\n${lista}`;
  return { assunto: `Respostas ${ids.join(', ')}`.slice(0, 120), corpo, ids };
}

/**
 * `entregar(destino, { id, texto })` devolve a promessa do desfecho do lote em que a resposta saiu (`{ ok, motivo? }`);
 * nunca rejeita. `enviarLote(destino, { assunto, corpo, ids })` faz o envio de verdade.
 */
export function criarFilaDeEntrega({ janelaMs, enviarLote, agendar = (fn, ms) => setTimeout(fn, ms) }) {
  const abertos = new Map(); // destino → { itens: [{ id, texto }], esperando: [resolve] }
  const voos = new Map(); // destino → promessa do último envio (resolve sempre)

  function despachar(destino, lote) {
    const anterior = voos.get(destino) ?? Promise.resolve();
    const voo = anterior.then(async () => {
      let r;
      try { r = await enviarLote(destino, montarLote(lote.itens)); } catch (e) { r = { ok: false, motivo: e instanceof Error ? e.message : String(e) }; }
      const desfecho = r?.ok ? { ok: true } : { ok: false, motivo: r?.motivo ?? 'o envio não disse o motivo' };
      for (const resolver of lote.esperando) resolver(desfecho);
    });
    voos.set(destino, voo);
    void voo.then(() => { if (voos.get(destino) === voo) voos.delete(destino); });
  }

  function entregar(destino, { id, texto }) {
    return new Promise((resolver) => {
      let lote = abertos.get(destino);
      if (!lote) {
        lote = { itens: [], esperando: [] };
        if (janelaMs > 0) {
          abertos.set(destino, lote);
          agendar(() => { abertos.delete(destino); despachar(destino, lote); }, janelaMs);
        }
      }
      const repetida = lote.itens.find((i) => i.id === id);
      if (repetida) repetida.texto = texto;
      else lote.itens.push({ id, texto });
      lote.esperando.push(resolver);
      if (!(janelaMs > 0)) despachar(destino, lote);
    });
  }

  return { entregar };
}
