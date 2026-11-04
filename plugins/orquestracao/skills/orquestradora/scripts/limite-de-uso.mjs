// F371: a sessão parada pelo limite de uso e a hora em que ele volta, lidas do transcript. Sem I/O além de quem chama.
// Medido em 03/11 nos transcripts reais: a recusa vira uma linha `assistant` sintética do fio principal com `isApiErrorMessage`,
// `error: "rate_limit"`, o texto "You've hit your session limit · resets 8pm (America/Sao_Paulo)" e, desde o CLI de outubro,
// `quotaLimits.resetsAt` (epoch em segundos; o mesmo em `apiErrorParams.rate_limit_info.resetsAt`). As de julho só trazem o texto.

const ms = (v) => { const t = Date.parse(v); return Number.isNaN(t) ? null : t; };
const segundos = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v * 1000 : null);

// O deslocamento do fuso no instante `t` (ms a somar ao UTC para ter a hora de parede); `null` com fuso desconhecido.
function deslocamento(t, fuso) {
  let f;
  try { f = new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); } catch { return null; }
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}

// "resets 8pm (America/Sao_Paulo)" / "resets 1:30am (…)": a primeira ocorrência dessa hora de parede, no fuso, depois de `desdeMs`.
// O semanal com data ("resets Nov 1 at 1am") não é lido: → null.
export function resetDoTexto(texto, desdeMs) {
  const m = /\bresets (\d{1,2})(?::(\d{2}))?\s*(am|pm) \(([^)]+)\)/i.exec(String(texto ?? ''));
  if (!m || !Number.isFinite(desdeMs)) return null;
  const h12 = Number(m[1]); const min = Number(m[2] ?? 0);
  if (h12 < 1 || h12 > 12 || min > 59) return null;
  const hora = (h12 % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0);
  const fuso = m[4];
  const d0 = deslocamento(desdeMs, fuso);
  if (d0 === null) return null;
  const parede = new Date(desdeMs + d0); // a data de parede no fuso, lida pelos campos UTC
  for (let dia = 0; dia <= 1; dia++) {
    const alvo = Date.UTC(parede.getUTCFullYear(), parede.getUTCMonth(), parede.getUTCDate() + dia, hora, min);
    let t = alvo - d0;
    const d1 = deslocamento(t, fuso); // a troca de horário de verão entre a recusa e o reset
    if (d1 !== null && d1 !== d0) t = alvo - d1;
    if (t > desdeMs) return t;
  }
  return null;
}

// O fim do transcript diz que a sessão parou no limite? Só conta o fio principal (`isSidechain` não true) e as linhas `user` e
// `assistant`; a última delas tem de ser a recusa. Mensagem depois da recusa sem resposta ainda não é limite (não se sabe).
// → { resetsAtMs, emMs } ou null (sem recusa no fim, ou recusa sem hora de volta).
export function limiteDoTranscript(texto) {
  const linhas = String(texto ?? '').split('\n');
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (!linhas[i]) continue;
    let e;
    try { e = JSON.parse(linhas[i]); } catch { continue; } // linha parcial
    if (e?.isSidechain === true || (e?.type !== 'user' && e?.type !== 'assistant')) continue;
    if (e.type !== 'assistant' || e.isApiErrorMessage !== true || e.error !== 'rate_limit') return null;
    const emMs = ms(e.timestamp);
    const doTexto = () => {
      const c = e.message?.content;
      const t = Array.isArray(c) ? c.map((b) => (b?.type === 'text' ? b.text : '')).join(' ') : String(c ?? '');
      return emMs === null ? null : resetDoTexto(t, emMs);
    };
    const resetsAtMs = segundos(e.quotaLimits?.resetsAt) ?? segundos(e.apiErrorParams?.rate_limit_info?.resetsAt) ?? doTexto();
    return resetsAtMs === null ? null : { resetsAtMs, emMs };
  }
  return null;
}
