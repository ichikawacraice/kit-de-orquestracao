// Regra "item esperando o papel X" (F58): puro, sem I/O. Usada por `painel list fila`, pelo ritual da orquestradora
// e pelo fila-do-item. O pane (plugin painel-sessoes) tem a cópia em `hooks/esperando.ts`; o teste
// `esperando-concorda.test.mjs` compara as duas. Plano: docs/planos/2026-10-26-item-esperando-papel.md (D1).

export const PAPEL_DA_ETAPA = { design: 'D', execucao: 'E', validacao: 'V' };

const ms = (v) => { const t = Date.parse(v); return Number.isNaN(t) ? null : t; };
const doPapel = (apelido, papel) => typeof apelido === 'string' && apelido.toUpperCase().startsWith(papel);

// `{ papel, desde (ISO), minutos }` quando o item está esperando alguém do papel da etapa; `null` caso contrário.
export function esperandoPapel(data, agoraMs) {
  if (!data || typeof data !== 'object') return null;
  const papel = PAPEL_DA_ETAPA[data.etapa];
  if (!papel) return null;
  if (data.espera || data.trava) return null;
  const com = Array.isArray(data.com) ? data.com : [];
  const ocupado = (p) => doPapel(data.donoApelido, p) || com.some((c) => doPapel(c?.apelido, p));
  if (ocupado(papel)) return null;
  if (papel === 'V' && ocupado('E')) return null; // E no `com` é o conserto; a V volta depois

  // entrada na etapa atual: a primeira entrada da sequência final do `historico` com essa etapa
  let desde = null;
  const hist = Array.isArray(data.historico) ? data.historico : [];
  for (let i = hist.length - 1; i >= 0 && hist[i]?.etapa === data.etapa; i--) {
    const t = ms(hist[i].em);
    if (t !== null) desde = t;
  }
  if (desde === null && hist.length === 0) desde = ms(data.atualizadoEm);
  if (desde === null) return null;
  // `entregue`: alguém do papel já entregou a parte (`fez`) nesta etapa; o item não pede despacho, pede à dona avançar a etapa.
  const entrada = desde;
  let entregue = false;
  for (const f of Array.isArray(data.fez) ? data.fez : []) {
    const t = ms(f?.em);
    if (!doPapel(f?.apelido, papel) || t === null || t < entrada) continue;
    entregue = true;
    if (t > desde) desde = t;
  }
  return { papel, desde: new Date(desde).toISOString(), minutos: Math.max(0, Math.floor((agoraMs - desde) / 60000)), entregue };
}
