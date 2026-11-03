// F351: o arquivo de estado da orquestradora (`~/.claude/orquestracao/<repo>.md`) gira. Cada limpeza de contexto acrescentava
// uma seção datada ("Retomar daqui (…, 02/11)", "Estado em 01/11 …") e o arquivo, lido inteiro no "Ao assumir", crescia sem fim
// (o deste repo tinha 38 KB em 02/11). O giro deixa no vivo as seções fixas e só a seção datada mais recente, corta as
// "Entregas arquivadas" às últimas MANTER_ENTREGAS linhas e leva o resto ao arquivo morto `<BASE>/arquivo-morto/<repo>/<AAAA-MM>.md`,
// que se busca com grep quando precisa. Seção fixa = título que começa por um dos FIXOS (mesmo com data no título); seção
// datada = qualquer outra com data no título; seção sem data e fora da lista fica onde está (na dúvida, não se move).
// "A mais recente" é pela data do título, não pela posição (há quem escreva o handoff no topo), e ficam todas as do dia mais
// recente: o mesmo handoff às vezes vem em duas seções.
// Uso: node estado-girar.mjs <arquivo .md> [--seco] → JSON {movidas, entregasMovidas, antes, depois, morto}.
import { readFileSync, writeFileSync, renameSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANTER_ENTREGAS = 15;
const FIXOS = ['prs abertos', 'fila de merge', 'itens vivos', 'sessões', 'produção', 'decisões', 'números reservados', 'adiados', 'próximo release', 'entregas arquivadas'];
const DATA = /\b\d{1,2}\/\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b/;
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const DM = /\b(\d{1,2})\/(\d{1,2})\b/;
// o dia do título (AAAAMMDD); dd/mm sem ano é do ano de `agora`, ou do anterior quando cairia mais de um dia no futuro
function dia(s, agora) {
  const iso = ISO.exec(s.titulo);
  if (iso) return Number(`${iso[1]}${iso[2]}${iso[3]}`);
  const dm = DM.exec(s.titulo);
  if (!dm) return 0;
  const [d, m] = [Number(dm[1]), Number(dm[2])];
  let ano = agora.getUTCFullYear();
  if (Date.UTC(ano, m - 1, d) > agora.getTime() + 86_400_000) ano -= 1;
  return ano * 10_000 + m * 100 + d;
}
const ENTREGAS = 'entregas arquivadas';

const titulo = (s) => s.titulo.replace(/^##\s+/, '').trim().toLowerCase();
const fixa = (s) => FIXOS.some((f) => titulo(s).startsWith(f));
const datada = (s) => !fixa(s) && DATA.test(s.titulo);

// texto → { cabeca, secoes: [{ titulo, corpo }] } (corpo inclui a linha do título; `##` dentro de bloco de código não corta)
function secoes(texto) {
  const linhas = texto.split('\n');
  const r = { cabeca: [], secoes: [] };
  let atual = null; let cerca = false;
  for (const l of linhas) {
    if (/^```/.test(l)) cerca = !cerca;
    if (!cerca && /^## /.test(l)) { atual = { titulo: l, linhas: [l] }; r.secoes.push(atual); continue; }
    (atual ? atual.linhas : r.cabeca).push(l);
  }
  return r;
}
const juntar = (linhas) => linhas.join('\n');

// texto → { vivo, morto (texto a acrescentar no arquivo morto, '' quando nada sai), movidas: [títulos], entregasMovidas }
export function girar(texto, { manterEntregas = MANTER_ENTREGAS, agora = new Date() } = {}) {
  const { cabeca, secoes: todas } = secoes(texto);
  const datadas = todas.filter(datada);
  const recente = Math.max(0, ...datadas.map((s) => dia(s, agora)));
  const vao = new Set(datadas.filter((s) => dia(s, agora) < recente));
  const morto = [];
  let entregasMovidas = 0;
  const ficam = [];
  for (const s of todas) {
    if (vao.has(s)) { morto.push(juntar(s.linhas).trimEnd()); continue; }
    if (titulo(s).startsWith(ENTREGAS)) {
      // as linhas de item (bullet) além das últimas `manterEntregas` saem; o resto da seção (texto solto) fica
      const itens = s.linhas.map((l, i) => (/^\s*[-*] /.test(l) ? i : -1)).filter((i) => i >= 0);
      const saem = new Set(itens.slice(0, Math.max(0, itens.length - manterEntregas)));
      if (saem.size) {
        morto.push([`${s.titulo} (as mais antigas)`, ...s.linhas.filter((_, i) => saem.has(i))].join('\n'));
        entregasMovidas = saem.size;
        ficam.push({ ...s, linhas: s.linhas.filter((_, i) => !saem.has(i)) });
        continue;
      }
    }
    ficam.push(s);
  }
  if (!morto.length) return { vivo: texto, morto: '', movidas: [], entregasMovidas: 0 };
  const vivo = `${[juntar(cabeca), ...ficam.map((s) => juntar(s.linhas))].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
  return { vivo, morto: `${morto.join('\n\n')}\n`, movidas: [...vao].map((s) => s.titulo.replace(/^##\s+/, '')), entregasMovidas };
}

// `<BASE>/arquivo-morto/<nome sem .md>/<AAAA-MM>.md`, o mês pela data de São Paulo
export function caminhoDoMorto(arquivo, agora = new Date()) {
  const mes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(agora);
  return join(dirname(arquivo), 'arquivo-morto', basename(arquivo).replace(/\.md$/, ''), `${mes}.md`);
}

// Gira o arquivo no disco: o morto recebe primeiro (append), o vivo troca por rename (atômico). → resumo
export function girarArquivo(arquivo, { seco = false, agora = new Date() } = {}) {
  const texto = readFileSync(arquivo, 'utf8');
  const g = girar(texto, { agora });
  const morto = caminhoDoMorto(arquivo, agora);
  const resumo = { arquivo, movidas: g.movidas, entregasMovidas: g.entregasMovidas, antes: Buffer.byteLength(texto), depois: Buffer.byteLength(g.vivo), morto, ...(seco ? { seco: true } : {}) };
  if (seco || !g.morto) return resumo;
  const quando = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(agora);
  mkdirSync(dirname(morto), { recursive: true });
  appendFileSync(morto, `\n<!-- girado de ${basename(arquivo)} em ${quando} (SP) -->\n\n${g.morto}`);
  const tmp = `${arquivo}.${process.pid}.tmp`;
  writeFileSync(tmp, g.vivo);
  renameSync(tmp, arquivo);
  return resumo;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const seco = args.includes('--seco');
  const [arquivo, ...sobra] = args.filter((a) => a !== '--seco');
  if (!arquivo || sobra.length || !arquivo.endsWith('.md')) {
    process.stderr.write('uso: estado-girar.mjs <arquivo .md> [--seco]\n');
    process.exitCode = 2;
  } else {
    try { process.stdout.write(`${JSON.stringify(girarArquivo(arquivo, { seco }), null, 2)}\n`); } catch (e) {
      process.stderr.write(`estado-girar: ${e?.message || e}\n`);
      process.exitCode = 1;
    }
  }
}
