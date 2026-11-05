// F220: a fila de merge órfã. O estado da fila (`fila-de-merge/<projeto>.json`, painel.mjs) guarda {ocupada:{pid,desde,gate,
// preparar}|null, pendentes, emVoo}. A limpeza de contexto da orquestradora mata a tarefa de background que roda a fila
// (medido num projeto em 28/10: `[killed]`), e o que estava em voo ou anotado fica no arquivo sem ninguém para drenar: só a
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
// chamada seguinte usaria (o lote em voo, depois os pendentes). O PR que está nos dois leva o sha do pendente, o mais novo
// (F351: a dona que anotou de novo depois de uma rodada morta), como faz o `juntarPedidos` do painel.
export function filaOrfa(estado, deps) {
  if (!estado || typeof estado !== 'object') return null;
  const prs = [];
  for (const p of [...lista(estado.emVoo), ...lista(estado.pendentes)]) {
    const i = prs.findIndex((x) => x.pr === p.pr);
    if (i < 0) prs.push({ pr: p.pr, ...(p.sha ? { sha: p.sha } : {}) });
    else if (p.sha) prs[i] = { ...prs[i], sha: p.sha };
  }
  if (!prs.length || donoDaFilaVivo(estado.ocupada, deps)) return null;
  const o = estado.ocupada ?? {};
  // F396: o par de quem rodava; sem ele (a fila só anotada), o gravado no `config` da fila. O par vem inteiro de um lado só:
  // o `--gate` sem `--preparar` roda sem preparo.
  const texto = (v) => typeof v === 'string' && v.trim() !== '';
  const par = texto(o.gate) ? o : (estado.config && typeof estado.config === 'object' ? estado.config : {});
  return {
    prs, desde: o.desde ?? null, pid: o.pid ?? null,
    ...(texto(par.gate) ? { gate: par.gate } : {}),
    ...(texto(par.gate) && texto(par.preparar) ? { preparar: par.preparar } : {}),
  };
}

export function lerFilaOrfa(arquivo, deps) {
  let estado;
  try { estado = JSON.parse(readFileSync(arquivo, 'utf8')); } catch { return null; }
  return filaOrfa(estado, deps);
}

const aspas = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// A chamada que retoma a fila órfã, com o gate e o preparo de quem rodava (ou os gravados no `config`, F396).
// F396: a fila que nunca gravou gate (só o `--anotar`, que grava o cwd) não tem par para o relance; o comando sairia sem
// `--gate` e rodaria `npm test`, que então ficaria gravado como o gate do projeto. O aviso diz o que falta, em vez de
// entregar um comando que parece pronto. O comando segue sem placeholder, para nunca rodar `<gate>` no shell.
export function avisoSemGate(orfa) {
  return orfa?.gate ? '' : ' — a fila deste projeto nunca gravou gate: acrescente `--gate "<o gate do projeto>"` (e `--preparar`, se ele precisa) antes de rodar; sem isso a rodada usa `npm test` e o grava como gate do projeto';
}

export function comandoDeRelance(orfa) {
  const prs = orfa.prs.map((p) => (p.sha ? `${p.pr}:${p.sha}` : String(p.pr))).join(' ');
  return `painel fila-de-merge ${prs}${orfa.gate ? ` --gate ${aspas(orfa.gate)}` : ''}${orfa.preparar ? ` --preparar ${aspas(orfa.preparar)}` : ''}`;
}
