// Handoffs dos itens da fila (F50): o arquivo do item é arquivado ao fechar, volta ao reabrir e sai depois de DIAS_ARQUIVO dias.
// Só mexe em arquivos regulares da raiz de `dir` (e em `dir/arquivo/`); nunca desce em outra pasta. Quem chama trata o erro de fs.
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { extname, basename, join } from 'node:path';

export const DIAS_ARQUIVO = 30;
const DIA_MS = 86_400_000;
const ITEM_DO_POOL = /^F\d+$/;

const regulares = (dir) => (existsSync(dir)
  ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name)
  : []);
// `F7` é dono de F7.md, F7-x.md, F7a-x.md; nunca de F70.md (o número não pode continuar).
const doItem = (id) => (nome) => nome.startsWith(id) && !/^[0-9]/.test(nome.slice(id.length));
const itemDoArquivo = (nome) => nome.match(/^(F\d+)(?![0-9])/)?.[1] ?? null;

// destino livre: o mesmo nome, ou com `-<timestamp>` antes da extensão (nada é sobrescrito em silêncio)
function destinoLivre(pasta, nome) {
  if (!existsSync(join(pasta, nome))) return nome;
  const ext = extname(nome);
  return `${basename(nome, ext)}-${Date.now()}${ext}`;
}
function mover(de, para, nomes) {
  mkdirSync(para, { recursive: true });
  return nomes.map((n) => {
    const novo = destinoLivre(para, n);
    renameSync(join(de, n), join(para, novo));
    return novo;
  });
}

export function arquivarItem(dir, id) {
  if (!ITEM_DO_POOL.test(id)) return [];
  return mover(dir, join(dir, 'arquivo'), regulares(dir).filter(doItem(id)));
}
export function desarquivarItem(dir, id) {
  if (!ITEM_DO_POOL.test(id)) return [];
  const arquivo = join(dir, 'arquivo');
  return mover(arquivo, dir, regulares(arquivo).filter(doItem(id)));
}

// `fechadoEm`: Map id -> ISO do `feitoEm` dos itens da fila que estão fechados.
export function arquivarFechados(dir, fechadoEm) {
  return [...fechadoEm.keys()].flatMap((id) => arquivarItem(dir, id));
}

// Item com `feitoEm` decide por ele; arquivo sem item na fila (ou que não é de item) decide pelo mtime.
// `itens`: Map id -> { feitoEm?: ISO } de todos os itens da fila; item na fila sem `feitoEm` (reaberto) nunca é apagado.
export function limparArquivados(dir, itens, { dias = DIAS_ARQUIVO, seco = false, agora = Date.now() } = {}) {
  const arquivo = join(dir, 'arquivo');
  const limite = dias * DIA_MS;
  const apagados = [];
  for (const nome of regulares(arquivo)) {
    const id = itemDoArquivo(nome);
    let idade;
    if (id && itens.has(id)) {
      const t = Date.parse(itens.get(id)?.feitoEm);
      if (Number.isNaN(t)) continue;
      idade = agora - t;
    } else {
      idade = agora - statSync(join(arquivo, nome)).mtimeMs;
    }
    if (idade <= limite) continue;
    apagados.push(nome);
    if (!seco) rmSync(join(arquivo, nome), { force: true });
  }
  return apagados;
}
