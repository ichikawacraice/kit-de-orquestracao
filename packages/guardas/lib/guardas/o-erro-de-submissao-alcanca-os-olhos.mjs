// CONV-09 e MSG-04 — o erro de submissão alcança os olhos. Três cobranças sobre
// os formulários (arquivo com campo e com envio): (1) toda chave que o mapa de
// erro recebe à mão tem quem a renderize, no arquivo ou num filho montado — uma
// chave sem leitor deu clique com zero efeito na tela; (2) o desfecho de gravar
// não sai em cinza (`text-muted-foreground` responde "nada ainda"); (3) o
// controle que nasce numa lista tem a mensagem dentro da lista.
import { semComentarios } from '../fonte.mjs'
import { TSX, violacao } from './_comum.mjs'

const TEM_CAMPO = /<Input\b|<Textarea\b|<Select\b|<Checkbox\b|<input\b|<textarea\b|<select\b/
const GRAVA = /fetch\(\s*['"`]\/api\/|onSubmit=/
const RECEBE_DESFECHO = /(res\.ok|body\?\.error|\?\.error|erro \$\{|\$\{res\.status)/
const TEM_VOZ = /(?:emerald|rose|destructive|COR_DO_TOM|BADGE_DO_TOM|FILETE_DO_TOM)/

export const semIndice = (c) => c.replace(/\$\{[^}]+\}/g, 'N').replace(/\.\d+(?=\.|$)/g, '.N')

export function chavesEscritasAMao(fonte) {
  const chaves = new Set()
  for (const bloco of fonte.matchAll(/setErr(?:o|or)s\(\s*\{([\s\S]*?)\}\s*[,)]/g)) {
    for (const chave of bloco[1].matchAll(/(?:^|[,{])\s*'?"?([A-Za-z_][\w.]*)'?"?\s*:/g)) chaves.add(semIndice(chave[1]))
  }
  for (const c of fonte.matchAll(/\[`([^`]+)`\]\s*=/g)) chaves.add(semIndice(c[1]))
  return [...chaves].sort()
}

export function renderizadoresDoArquivo(fonte) {
  const vistos = new Set()
  for (const m of fonte.matchAll(/\berr\(\s*['"]([^'"]+)['"]\s*\)/g)) vistos.add(semIndice(m[1]))
  for (const m of fonte.matchAll(/\berr\(\s*`([^`]+)`\s*\)/g)) vistos.add(semIndice(m[1]))
  for (const m of fonte.matchAll(/err(?:o|or)s\??\.([A-Za-z_]\w*)/g)) vistos.add(m[1])
  // O caminho montado por uma função local, `const p = (s) => (template a.${i}.${s})`:
  // cada `p('campo')` citado é a chave `a.N.campo`.
  for (const f of fonte.matchAll(/const\s+(\w+)\s*=\s*\(\s*(\w+)(?::\s*string)?\s*\)\s*=>\s*`([^`]*)\$\{\2\}`/g)) {
    for (const u of fonte.matchAll(new RegExp(`\\b${f[1]}\\(\\s*['"]([\\w.]+)['"]\\s*\\)`, 'g'))) vistos.add(semIndice(f[3] + u[1]))
  }
  for (const m of fonte.matchAll(/err(?:o|or)s\??\.?\[\s*['"`]([^'"`]+)['"`]\s*\]/g)) vistos.add(semIndice(m[1]))
  return vistos
}

export function desfechosEmCinza(fonte) {
  const culpados = []
  for (const m of fonte.matchAll(/const \[(\w+), (set\w+)\] = useState/g)) {
    const [, nome, setter] = m
    if (!new RegExp(`${setter}\\s*\\(([^;]{0,200}?)${RECEBE_DESFECHO.source}`, 's').test(fonte)) continue
    const emCinza = new RegExp(`<[a-zA-Z]+[^<>]*className=\\{?["\`][^"\`]*text-muted-foreground[^"\`]*["\`][^<>]*>\\{${nome}(\\.\\w+)?\\}`)
    if (!emCinza.test(fonte)) continue
    const oNome = new RegExp(`\\b${nome}\\b`)
    if (fonte.split('\n').some((l) => oNome.test(l) && TEM_VOZ.test(l))) continue
    culpados.push(nome)
  }
  return culpados
}

function corpoDaFuncao(fonte, inicio) {
  const abre = fonte.indexOf('{', fonte.indexOf('(', inicio))
  if (abre < 0) return ''
  let n = 0
  for (let i = abre; i < fonte.length; i++) {
    if (fonte[i] === '{') n++
    else if (fonte[i] === '}' && --n === 0) return fonte.slice(abre, i)
  }
  return ''
}

function trechosDeMap(fonte) {
  return [...fonte.matchAll(/\.map\s*\(/g)].map((m) => {
    let i = m.index + m[0].length - 1
    let n = 0
    for (; i < fonte.length; i++) {
      if (fonte[i] === '(') n++
      else if (fonte[i] === ')' && --n === 0) break
    }
    return [m.index, i]
  })
}

export function mensagemForaDaLista(fonte) {
  const achados = new Set()
  const trechos = trechosDeMap(fonte)
  for (const m of fonte.matchAll(/const \[(\w+), (set\w+)\] = useState/g)) {
    const [, nome, setter] = m
    if (!/error|erro|msg|falha/i.test(nome)) continue
    const renders = [...fonte.matchAll(new RegExp(`\\{\\s*${nome}\\s*(\\?|&&)`, 'g'))].map((r) => r.index)
    if (renders.length === 0) continue
    const donos = [...fonte.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(/g)].filter((f) => corpoDaFuncao(fonte, f.index).includes(`${setter}(`)).map((f) => f[1])
    for (const dono of donos) {
      for (const chamada of [...fonte.matchAll(new RegExp(`\\b${dono}\\s*\\(`, 'g'))].map((c) => c.index)) {
        const dentro = trechos.find(([a, b]) => chamada > a && chamada < b)
        if (!dentro || fonte.slice(dentro[0], dentro[1]).includes(`function ${dono}`)) continue
        if (renders.some((r) => r > dentro[0] && r < dentro[1])) continue
        achados.add(`${nome} via ${dono}()`)
      }
    }
  }
  return [...achados]
}

export default {
  id: 'o-erro-de-submissao-alcanca-os-olhos',
  regras: ['CONV-09', 'MSG-04'],
  titulo: 'O erro de submissão alcança os olhos',
  // `semCampo`: chaves que não são campo da tela ({ chave: motivo }) — o desfecho do servidor, por exemplo.
  padrao: { semCampo: {} },
  examinar(p, op) {
    const fontes = p.fontes({ ext: TSX, ignorar: [p.config.kit] })
    const formularios = fontes.filter((f) => TEM_CAMPO.test(f.texto) && GRAVA.test(f.texto))
    const erros = Object.entries(op.semCampo).filter(([, m]) => (m ?? '').trim().length < 20).map(([c]) => `chave sem campo sem motivo: ${c}`)
    const renderizadores = (arquivo, visto = new Set()) => {
      if (visto.has(arquivo)) return new Set()
      visto.add(arquivo)
      const fonte = p.ler(arquivo)
      const vistos = renderizadoresDoArquivo(fonte)
      for (const imp of fonte.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
        const nomes = imp[1].split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim()).filter((n) => /^[A-Z]/.test(n))
        if (!nomes.some((n) => new RegExp(`<${n}[\\s/>]`).test(fonte))) continue
        const alvo = p.resolverImport(arquivo, imp[2])
        if (alvo) for (const k of renderizadores(alvo, visto)) vistos.add(k)
      }
      return vistos
    }
    const violacoes = formularios.flatMap(({ arquivo, texto }) => {
      const codigo = semComentarios(texto)
      const vistos = renderizadores(arquivo)
      return [
        ...chavesEscritasAMao(codigo)
          .filter((c) => !vistos.has(c) && !(c in op.semCampo))
          .map((c) => violacao(arquivo, null, `a chave de erro "${c}" não tem quem a renderize (CONV-09)`)),
        ...desfechosEmCinza(codigo).map((n) => violacao(arquivo, null, `o desfecho "${n}" sai em text-muted-foreground: declare o tom (CONV-09)`)),
        ...mensagemForaDaLista(codigo).map((a) => violacao(arquivo, null, `o controle nasce numa lista e a mensagem mora fora dela: ${a} (MSG-04)`)),
      ]
    })
    return { examinados: formularios.length, violacoes, erros }
  },
}
