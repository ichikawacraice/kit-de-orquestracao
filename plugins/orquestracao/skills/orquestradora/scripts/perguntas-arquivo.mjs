// F183: onde mora cada pergunta do painel. A pasta quente (`perguntas/<Q>.json`) guarda as abertas e as assumidas (estas ainda
// esperam o operador confirmar ou mudar); respondida e cancelada vão para `perguntas/arquivo/<projeto>/<AAAA-MM>/<Q>.json`, com o
// mês da resposta em São Paulo. O projeto é um slug `[a-z0-9-]`; sem projeto, `sem-projeto`. Só módulos nativos, sem I/O ao importar.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const FECHADAS = new Set(['respondida', 'cancelada']);
export const SEM_PROJETO = 'sem-projeto';
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ARQUIVO = 'arquivo';

/** O nome do projeto como o painel o grava: minúsculo, o que não for [a-z0-9] vira traço, sem traço nas pontas; vazio = null. */
export function slugDoProjeto(nome) {
  const s = String(nome ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || null;
}

const MES_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' });
const DIA_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const primeiraData = (d) => [d?.respondidaEm, d?.atualizadoEm, d?.criadaEm].map((v) => Date.parse(v ?? '')).find((t) => !Number.isNaN(t));

/** O mês (AAAA-MM, São Paulo) em que a pergunta fechou: respondidaEm, senão atualizadoEm, senão criadaEm, senão `agora`. */
export function mesDe(data, agora = Date.now()) {
  return MES_SP.format(new Date(primeiraData(data) ?? agora)).slice(0, 7);
}
/** O dia (AAAA-MM-DD, São Paulo) de um instante. */
export const diaEmSP = (ms) => DIA_SP.format(new Date(ms));

/** O arquivo da pergunta fechada `id`, pelo projeto e pelo mês da resposta. */
export function caminhoNoArquivo(dir, id, data, agora = Date.now()) {
  return join(dir, ARQUIVO, slugDoProjeto(data?.projeto) ?? SEM_PROJETO, mesDe(data, agora), `${id}.json`);
}
/** Onde a pergunta deve morar: a pasta quente, ou o arquivo se está fechada. */
export const lugarDe = (dir, id, data, agora = Date.now()) => (FECHADAS.has(data?.estado) ? caminhoNoArquivo(dir, id, data, agora) : join(dir, `${id}.json`));

const subpastas = (dir) => { try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; } };

/** As pastas de mês do arquivo: `[{projeto, mes, dir}]`; `projeto` restringe a um. */
export function pastasDoArquivo(dir, { projeto } = {}) {
  const raiz = join(dir, ARQUIVO);
  const projetos = projeto ? [projeto] : subpastas(raiz);
  return projetos.flatMap((p) => subpastas(join(raiz, p)).map((mes) => ({ projeto: p, mes, dir: join(raiz, p, mes) })));
}

/** O arquivo da pergunta `id`: a pasta quente primeiro, depois o arquivo; não achou = null. */
export function acharPergunta(dir, id) {
  const q = join(dir, `${id}.json`);
  if (existsSync(q)) return q;
  for (const p of pastasDoArquivo(dir)) {
    const f = join(p.dir, `${id}.json`);
    if (existsSync(f)) return f;
  }
  return null;
}

/** Os arquivos `.json` do arquivo (de todos os projetos, ou de `projeto`); `desdeMs` pula o que não mudou desde então (pelo mtime). */
export function arquivadas(dir, { projeto, desdeMs } = {}) {
  const saida = [];
  for (const p of pastasDoArquivo(dir, { projeto })) {
    let nomes;
    try { nomes = readdirSync(p.dir); } catch { continue; }
    for (const n of nomes) {
      if (!n.endsWith('.json')) continue;
      const f = join(p.dir, n);
      if (desdeMs !== undefined) {
        try { if (statSync(f).mtimeMs < desdeMs) continue; } catch { continue; }
      }
      saida.push(f);
    }
  }
  return saida;
}
/** As fechadas que mudaram desde `desdeMs` (o arquivo é escrito na hora em que a pergunta fecha ou é movida). */
export const fechadasRecentes = (dir, { desdeMs }) => arquivadas(dir, { desdeMs });
