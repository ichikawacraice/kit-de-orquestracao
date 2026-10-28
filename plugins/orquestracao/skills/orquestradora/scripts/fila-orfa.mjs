// F220: a fila de merge órfã. O estado da fila (`fila-de-merge/<projeto>.json`, painel.mjs) guarda {ocupada:{pid,desde,gate,
// preparar}|null, pendentes, emVoo}. A limpeza de contexto da orquestradora mata a tarefa de background que roda a fila
// (medido no Izanagi em 28/10: `[killed]`), e o que estava em voo ou anotado fica no arquivo sem ninguém para drenar: só a
// chamada seguinte o leva. Aqui se diz quando isso aconteceu (a batida e o início de sessão da orquestradora avisam) e qual
// chamada retoma. Dono vivo = o pid responde e o processo começou antes de `desde`: o pid reciclado por outro processo não
// prende a fila. Sem dependência do painel: o hook de início de sessão também lê.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// folga entre o início do processo (ps, em segundos) e o `desde` que ele mesmo grava depois de começar
const FOLGA_DO_INICIO_MS = 2000;

export function pidVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; }
}

// Hora em que o processo começou (ms), pelo `ps -o lstart=`; null quando o pid não existe ou o ps não responde.
export function inicioDoProcesso(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    const out = execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], {
      encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, LC_ALL: 'C' },
    }).trim();
    const t = Date.parse(out);
    return Number.isNaN(t) ? null : t;
  } catch { return null; }
}

export function donoDaFilaVivo(ocupada, { vivo = pidVivo, inicio = inicioDoProcesso } = {}) {
  if (!ocupada || !vivo(ocupada.pid)) return false;
  const desde = Date.parse(ocupada.desde);
  if (Number.isNaN(desde)) return true;
  const comecou = inicio(ocupada.pid);
  return comecou === null || comecou <= desde + FOLGA_DO_INICIO_MS;
}

const lista = (v) => (Array.isArray(v) ? v.filter((p) => Number.isInteger(p?.pr)) : []);

// → null | { prs: [{pr, sha?}], desde, pid, gate?, preparar? }: há PR anotado e ninguém vivo para levá-lo. A ordem é a que a
// chamada seguinte usaria (o lote em voo, depois os pendentes).
export function filaOrfa(estado, deps) {
  if (!estado || typeof estado !== 'object') return null;
  const prs = [];
  for (const p of [...lista(estado.emVoo), ...lista(estado.pendentes)]) if (!prs.some((x) => x.pr === p.pr)) prs.push({ pr: p.pr, ...(p.sha ? { sha: p.sha } : {}) });
  if (!prs.length || donoDaFilaVivo(estado.ocupada, deps)) return null;
  const o = estado.ocupada ?? {};
  return {
    prs, desde: o.desde ?? null, pid: o.pid ?? null,
    ...(typeof o.gate === 'string' && o.gate ? { gate: o.gate } : {}),
    ...(typeof o.preparar === 'string' && o.preparar ? { preparar: o.preparar } : {}),
  };
}

export function lerFilaOrfa(arquivo, deps) {
  let estado;
  try { estado = JSON.parse(readFileSync(arquivo, 'utf8')); } catch { return null; }
  return filaOrfa(estado, deps);
}

const aspas = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// A chamada que retoma a fila órfã, com o gate e o preparo de quem rodava.
export function comandoDeRelance(orfa) {
  const prs = orfa.prs.map((p) => (p.sha ? `${p.pr}:${p.sha}` : String(p.pr))).join(' ');
  return `painel fila-de-merge ${prs}${orfa.gate ? ` --gate ${aspas(orfa.gate)}` : ''}${orfa.preparar ? ` --preparar ${aspas(orfa.preparar)}` : ''}`;
}
