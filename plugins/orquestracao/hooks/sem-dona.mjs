// Regra "item sem dona" e teto de donas: puro, sem I/O. Usada por `painel list fila`, pela batida, pelo ritual da orquestradora
// e pelo fila-do-item. O pane (plugin painel-sessoes) tem a cópia de `semDona` em `hooks/sem-dona.ts`; o teste
// `sem-dona-concorda.test.mjs` compara as duas.

// Etapas em que alguém trabalha no item; `merge` fica de fora (a dona só espera a fila) e `feito`/`descartado` são finais.
export const ETAPAS_DE_TRABALHO = ['planejamento', 'design', 'execucao', 'validacao'];

const ms = (v) => { const t = Date.parse(v); return Number.isNaN(t) ? null : t; };
const temGente = (d) => Boolean(d?.donoLocalId) || (Array.isArray(d?.com) && d.com.length > 0);

// Quando o item entrou na etapa atual (ms): a primeira entrada da sequência final do `historico` com essa etapa;
// sem histórico, `atualizadoEm`. `null` se não der para saber.
export function entradaNaEtapa(data) {
  if (!data || typeof data !== 'object') return null;
  let desde = null;
  const hist = Array.isArray(data.historico) ? data.historico : [];
  for (let i = hist.length - 1; i >= 0 && hist[i]?.etapa === data.etapa; i--) {
    const t = ms(hist[i].em);
    if (t !== null) desde = t;
  }
  if (desde === null && hist.length === 0) desde = ms(data.atualizadoEm);
  return desde;
}

// `{ desde (ISO), minutos }` quando o item está numa etapa de trabalho sem dona e sem ninguém no `com`, e sem `espera` nem
// `trava` (quem espera o operador ou está travado está parado de propósito); `null` caso contrário.
export function semDona(data, agoraMs) {
  if (!data || typeof data !== 'object') return null;
  if (!ETAPAS_DE_TRABALHO.includes(data.etapa)) return null;
  if (data.espera || data.trava || temGente(data)) return null;
  const desde = entradaNaEtapa(data);
  if (desde === null) return null;
  return { desde: new Date(desde).toISOString(), minutos: Math.max(0, Math.floor((agoraMs - desde) / 60000)) };
}

// Teto de donas trabalhando ao mesmo tempo no projeto: `KIT_TETO_DE_DONAS`, padrão 4.
export function tetoDeDonas(env = process.env) {
  const n = Number(env.KIT_TETO_DE_DONAS);
  return Number.isInteger(n) && n > 0 ? n : 4;
}

// Item com alguém trabalhando nele (a dona ou quem está no `com`), numa etapa que conta para o teto.
export const donaTrabalhando = (d) => ETAPAS_DE_TRABALHO.includes(d?.etapa) && temGente(d);
