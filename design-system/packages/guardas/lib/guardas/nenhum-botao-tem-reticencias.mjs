// CTRL-07 — nenhum botão tem reticências, nem o rótulo fixo ("Editar…") nem o
// do andamento ("Publicando…"): o botão desabilitado e o gerúndio já dizem que
// está rodando. A leitura é pela árvore do TypeScript, e não por regex: o
// `onClick={() => …}` tem chaves e `>` que uma regex corta, e o rótulo mora em
// ternários e em constantes, do arquivo ou exportadas por outro.
import { createRequire } from 'node:module'

import { TSX, CODIGO, violacao } from './_comum.mjs'

const RETICENCIAS = /…|\.\.\./
const ATRIBUTOS_DE_NOME = new Set(['aria-label', 'title'])

let ts
function typescript() {
  if (!ts) {
    try {
      ts = createRequire(import.meta.url)('typescript')
    } catch {
      throw new Error('esta guarda lê a árvore do TypeScript: instale `typescript` no projeto')
    }
  }
  return ts
}

const ehString = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)

function constantes(sf, soExportadas) {
  const m = new Map()
  const visitar = (n) => {
    if (ts.isVariableStatement(n) && (!soExportadas || n.modifiers?.some((x) => x.kind === ts.SyntaxKind.ExportKeyword))) {
      for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer && ehString(d.initializer)) m.set(d.name.text, d.initializer.text)
    }
    if (!soExportadas) ts.forEachChild(n, visitar)
  }
  if (soExportadas) sf.statements.forEach(visitar)
  else visitar(sf)
  return m
}

/** O que o nó desenha: texto JSX, literais e as constantes citadas. Não entra em atributo nem em função de evento. */
function desenhados(n, consts, saida) {
  if (ts.isJsxAttribute(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) return
  if (ts.isJsxText(n)) saida.push({ no: n, texto: n.text })
  else if (ehString(n)) saida.push({ no: n, texto: n.text })
  else if (ts.isTemplateExpression(n)) saida.push({ no: n, texto: n.getText() })
  else if (ts.isIdentifier(n) && consts.has(n.text) && !ts.isPropertyAccessExpression(n.parent)) saida.push({ no: n, texto: consts.get(n.text) })
  ts.forEachChild(n, (f) => desenhados(f, consts, saida))
}

export function botoesComReticencias(arquivo, fonte, botoes, exportadas = new Map()) {
  typescript()
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const consts = new Map([...exportadas, ...constantes(sf, false)])
  const achados = []
  let total = 0
  const linha = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const visitar = (n) => {
    const abertura = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null
    if (abertura && botoes.has(abertura.tagName.getText())) {
      total++
      const textos = []
      for (const a of abertura.attributes.properties) {
        if (!ts.isJsxAttribute(a) || !ATRIBUTOS_DE_NOME.has(a.name.getText()) || !a.initializer) continue
        const v = ts.isJsxExpression(a.initializer) ? a.initializer.expression : a.initializer
        if (v) desenhados(v, consts, textos)
      }
      if (ts.isJsxElement(n)) for (const filho of n.children) desenhados(filho, consts, textos)
      for (const t of textos) if (RETICENCIAS.test(t.texto)) achados.push({ linha: linha(t.no), texto: t.texto.trim() })
    }
    ts.forEachChild(n, visitar)
  }
  visitar(sf)
  return { botoes: total, achados }
}

export default {
  id: 'nenhum-botao-tem-reticencias',
  regras: ['CTRL-07'],
  titulo: 'Nenhum botão tem reticências',
  // Os elementos que se clicam como botão: o do kit, o nativo e os itens de menu e de abas.
  padrao: {
    botoes: ['Button', 'button', 'DropdownMenuItem', 'ContextMenuItem', 'MenubarItem', 'TabsTrigger', 'ToggleGroupItem', 'AlertDialogAction', 'AlertDialogCancel', 'ItemDoMenu', 'ItemDeEscolhaDoMenu', 'SubmenuDoMenu', 'BotaoDividido'],
  },
  examinar(p, op) {
    typescript()
    const exportadas = new Map()
    for (const { arquivo, texto } of p.fontes({ ext: CODIGO })) {
      const sf = ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, /x$/.test(arquivo) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      for (const [k, v] of constantes(sf, true)) exportadas.set(k, v)
    }
    const botoes = new Set(op.botoes)
    let total = 0
    const violacoes = p.fontes({ ext: TSX }).flatMap(({ arquivo, texto }) => {
      const r = botoesComReticencias(arquivo, texto, botoes, exportadas)
      total += r.botoes
      return r.achados.map((a) => violacao(arquivo, a.linha, 'botão com reticências', a.texto))
    })
    return { examinados: total, violacoes }
  },
}
