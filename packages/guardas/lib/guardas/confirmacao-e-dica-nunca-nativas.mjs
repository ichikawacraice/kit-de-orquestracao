// CONV-10 — confirmação e dica nunca nativas: nada de `window.confirm`/`alert`
// (usa `useConfirm`) nem de `title` nativo num elemento de tela (usa `Ajuda`,
// `DicaDeAjuda` ou `ComMotivo`). O nativo não segue tema, foco nem toque, e o
// `title` não aparece no teclado nem no celular.
import { linhaDe, semComentarios, tagsDeAbertura } from '../fonte.mjs'
import { TSX, ocorrencias, violacao } from './_comum.mjs'

const NATIVO = /(?<![\w.$])(?:window\.)?(confirm|alert|prompt)\s*\(/g
/** Tag minúscula (elemento do DOM). `iframe`, `svg` e `abbr` precisam do título para o leitor de tela. */
const TAG_DO_DOM = /<(?!iframe\b|svg\b|abbr\b)([a-z][\w-]*)(?=[\s>/])/g

export function nativos(fonte) {
  const codigo = semComentarios(fonte)
  // `const [d, confirm] = useConfirm()`: o `confirm` é o do kit, não o nativo.
  const doHook = new Set([...codigo.matchAll(/const\s*\[[^\]]*\b(confirm|alert|prompt)\b[^\]]*\]\s*=\s*use\w+\(/g)].map((m) => m[1]))
  const titles = []
  for (const nome of new Set([...codigo.matchAll(TAG_DO_DOM)].map((m) => m[1]))) {
    // A tag inteira, contando chaves: o `>` do `onClick={() => …}` não a fecha.
    for (const { indice, tag } of tagsDeAbertura(codigo, nome)) {
      if (/\stitle=/.test(tag)) titles.push({ linha: linhaDe(codigo, indice), msg: 'title nativo: use Ajuda, DicaDeAjuda ou ComMotivo', trecho: tag })
    }
  }
  return [
    ...ocorrencias(codigo, NATIVO)
      .filter(({ m }) => !(doHook.has(m[1]) && !m[0].startsWith('window.')))
      .map(({ m, linha }) => ({ linha, msg: `${m[1]} nativo: use useConfirm`, trecho: m[0] })),
    ...titles.sort((a, b) => a.linha - b.linha),
  ]
}

export default {
  id: 'confirmacao-e-dica-nunca-nativas',
  regras: ['CONV-10'],
  titulo: 'Confirmação e dica nunca nativas',
  padrao: {},
  examinar(p) {
    const fontes = p.fontes({ ext: TSX, ignorar: [p.config.kit] })
    const violacoes = fontes.flatMap(({ arquivo, texto }) => nativos(texto).map((a) => violacao(arquivo, a.linha, a.msg, a.trecho)))
    return { examinados: fontes.length, violacoes }
  },
}
