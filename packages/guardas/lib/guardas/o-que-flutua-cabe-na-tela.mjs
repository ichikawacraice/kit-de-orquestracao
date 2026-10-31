// SUP-07 — o que flutua cabe na tela: ninguém desliga a troca de lado
// (`avoidCollisions={false}`), e o conteúdo flutuante do Radix montado direto
// (menu, submenu, select, popover, hover-card, dica) limita a altura ao que
// sobra na tela. Sem o limite, a lista longa perto da borda corta e a última
// linha não se clica. As peças do kit já cumprem; quem monta o primitivo do
// Radix por conta própria é que precisa provar.
//
// O limite vale como achado na própria tag (`max-h-`, `maxHeight`) ou, quando
// a classe vem de uma constante (`className={cn(CAIXA, …)}`), em qualquer
// literal do arquivo: a guarda não segue a constante, e prefere deixar passar
// a acusar o kit que guarda a classe numa constante.
import { linhaDe, literaisDoFonte, semComentarios, tagsDeAbertura } from '../fonte.mjs'
import { TSX, ocorrencias, violacao } from './_comum.mjs'

/** Os primitivos do Radix que flutuam ancorados (popper), pelo nome no `radix-ui` e pelo pacote avulso. */
const FLUTUANTES = {
  DropdownMenu: 'dropdown-menu',
  ContextMenu: 'context-menu',
  Menubar: 'menubar',
  Popover: 'popover',
  HoverCard: 'hover-card',
  Select: 'select',
  Tooltip: 'tooltip',
}

const DESLIGADA = /\bavoidCollisions\s*(?:=\s*\{\s*false\s*\}|:\s*false\b)/g
const LIMITE = /\bmax-h-|\bmaxHeight\b/

/** Os primitivos flutuantes importados do Radix, nome local → primitivo: `{ Popover as PopoverPrimitive }` ou `* as X from "@radix-ui/react-popover"`. */
function primitivosDoArquivo(codigo) {
  const nomes = new Map()
  for (const m of codigo.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]radix-ui['"]/g)) {
    for (const parte of m[1].split(',')) {
      const [nome, alias] = parte.trim().replace(/^type\s+/, '').split(/\s+as\s+/).map((s) => s.trim())
      if (nome in FLUTUANTES) nomes.set(alias || nome, nome)
    }
  }
  const doPacote = Object.fromEntries(Object.entries(FLUTUANTES).map(([nome, pacote]) => [pacote, nome]))
  for (const m of codigo.matchAll(/import\s*\*\s*as\s+(\w+)\s+from\s*['"]@radix-ui\/react-([\w-]+)['"]/g)) {
    if (doPacote[m[2]]) nomes.set(m[1], doPacote[m[2]])
  }
  return nomes
}

/** Os nomes locais dos primitivos flutuantes importados do Radix. */
export function nomesDosFlutuantes(codigo) {
  return [...primitivosDoArquivo(codigo).keys()]
}

/** O que reprova num arquivo: a troca de lado desligada e o conteúdo flutuante sem limite de altura. */
export function flutuantesQueNaoCabem(fonte) {
  const codigo = semComentarios(fonte)
  const achados = ocorrencias(codigo, DESLIGADA).map(({ m, linha }) => ({
    linha,
    msg: 'troca de lado desligada: o flutuante sem espaço embaixo corta no fim da tela',
    trecho: m[0],
  }))
  const primitivos = primitivosDoArquivo(codigo)
  if (primitivos.size === 0) return achados
  const limiteNoArquivo = literaisDoFonte(codigo).some((l) => LIMITE.test(l.texto))
  for (const [nome, primitivo] of primitivos) {
    for (const parte of ['Content', 'SubContent']) {
      for (const { indice, tag } of tagsDeAbertura(codigo, `${nome}\\.${parte}`)) {
        if (LIMITE.test(tag)) continue
        // O select em `item-aligned` (o padrão do Radix) se mede sozinho contra a janela; só o `popper` precisa do limite.
        if (primitivo === 'Select' && !/\bposition\s*=\s*(?:['"]popper['"]|\{)/.test(tag)) continue
        // A classe numa constante: vale o limite escrito em qualquer literal do arquivo.
        if (/className\s*=\s*\{/.test(tag) && limiteNoArquivo) continue
        achados.push({
          linha: linhaDe(codigo, indice),
          msg: `${nome}.${parte} sem limite de altura: use a peça do kit, ou max-h-(--radix-…-available-height) com overflow-y-auto`,
          trecho: tag,
        })
      }
    }
  }
  return achados.sort((a, b) => a.linha - b.linha)
}

export default {
  id: 'o-que-flutua-cabe-na-tela',
  regras: ['SUP-07'],
  titulo: 'O que flutua cabe na tela',
  padrao: {},
  examinar(p) {
    // O kit entra: é nele que o primitivo do Radix costuma morar, e uma cópia velha da peça também precisa caber.
    const fontes = p.fontes({ ext: TSX })
    const violacoes = fontes.flatMap(({ arquivo, texto }) =>
      flutuantesQueNaoCabem(texto).map((a) => violacao(arquivo, a.linha, a.msg, a.trecho)),
    )
    return { examinados: fontes.length, violacoes }
  },
}
