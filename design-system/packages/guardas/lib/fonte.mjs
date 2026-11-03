// Leitura de código-fonte sem compilador: tirar comentário, achar as literais
// de string, separar a variante de uma classe do Tailwind, achar a tag de
// abertura de um componente. Funções puras sobre texto.

/**
 * Tira os comentários e preserva as quebras de linha, para o número de linha
 * de um achado continuar certo. Comentário não é código: sem isto a guarda
 * acusaria o arquivo que EXPLICA por que o defeito saiu. O `//` precedido de
 * `:` é URL dentro de string, e fica.
 */
export function semComentarios(fonte) {
  // Lê a string para não confundir `accept="image/*"` ou `href="//cdn"` com
  // comentário: aspas simples e duplas acabam na linha (e a apóstrofe de um
  // texto JSX não come o arquivo), a crase vai até a crase.
  let saida = ''
  let i = 0
  while (i < fonte.length) {
    const c = fonte[i]
    const dois = fonte.slice(i, i + 2)
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < fonte.length && fonte[j] !== c && !(c !== '`' && fonte[j] === '\n')) j += fonte[j] === '\\' ? 2 : 1
      saida += fonte.slice(i, j + 1)
      i = j + 1
    } else if (dois === '/*') {
      const fim = fonte.indexOf('*/', i + 2)
      const ate = fim === -1 ? fonte.length : fim + 2
      saida += fonte.slice(i, ate).replace(/[^\n]/g, ' ')
      i = ate
    } else if (dois === '//' && fonte[i - 1] !== ':') {
      while (i < fonte.length && fonte[i] !== '\n') i++
    } else {
      saida += c
      i++
    }
  }
  return saida
}

/** O número da linha (1-base) de uma posição no texto. */
export function linhaDe(texto, indice) {
  let n = 1
  for (let i = 0; i < indice && i < texto.length; i++) if (texto[i] === '\n') n++
  return n
}

/**
 * As literais de string do fonte (`"…"`, `'…'`, `` `…` ``), com a linha onde
 * começam. Comentário de linha inteira e de bloco ficam de fora; a literal com
 * `${}` entra inteira, com a expressão dentro, porque a classe pode morar num
 * ternário.
 */
export function literaisDoFonte(fonte) {
  const achadas = []
  let linha = 1
  let i = 0
  while (i < fonte.length) {
    const c = fonte[i]
    const dois = fonte.slice(i, i + 2)
    if (c === '\n') {
      linha++
      i++
    } else if (dois === '//' && fonte[i - 1] !== ':') {
      while (i < fonte.length && fonte[i] !== '\n') i++
    } else if (dois === '/*') {
      const fim = fonte.indexOf('*/', i + 2)
      const ate = fim === -1 ? fonte.length : fim + 2
      linha += (fonte.slice(i, ate).match(/\n/g) ?? []).length
      i = ate
    } else if (c === '"' || c === "'" || c === '`') {
      const inicio = linha
      let j = i + 1
      let texto = ''
      let fechou = false
      let linhasDentro = 0
      while (j < fonte.length) {
        const d = fonte[j]
        if (d === '\\') {
          texto += fonte.slice(j, j + 2)
          j += 2
          continue
        }
        if (d === c) {
          fechou = true
          break
        }
        if (d === '\n') {
          if (c !== '`') break
          linhasDentro++
        }
        texto += d
        j++
      }
      if (fechou) {
        achadas.push({ linha: inicio, texto })
        linha += linhasDentro
        i = j + 1
      } else {
        i++
      }
    } else {
      i++
    }
  }
  return achadas
}

/** As classes de uma literal, sem a pontuação de template (`${`, `}`, aspas). */
export function tokensDaLiteral(texto) {
  return texto
    .split(/\s+/)
    .map((t) => t.replace(/^["'`{}()$]+/, '').replace(/["'`{}()$]+$/, ''))
    .filter(Boolean)
}

/**
 * Separa as variantes da classe base: `dark:hover:!bg-x` → variantes
 * `['dark','hover']`, base `bg-x`. O `:` dentro de colchete (`data-[a=b]:`)
 * não separa.
 */
export function separaVariante(token) {
  const partes = []
  let atual = ''
  let fundo = 0
  for (const ch of token) {
    if (ch === '[') fundo++
    if (ch === ']') fundo--
    if (ch === ':' && fundo === 0) {
      partes.push(atual)
      atual = ''
    } else {
      atual += ch
    }
  }
  return { variantes: partes, base: atual.replace(/^[!-]+/, '') }
}

/**
 * As tags de abertura de um componente, inteiras: atravessa a seta do
 * `onClick={() => …}` contando chaves, e não confunde `<ButtonGroup>` com
 * `<Button>`.
 */
export function tagsDeAbertura(fonte, nome) {
  const tags = []
  const abre = new RegExp(`<${nome}(?=[\\s>/])`, 'g')
  for (let m = abre.exec(fonte); m; m = abre.exec(fonte)) {
    let chaves = 0
    let i = m.index + m[0].length
    for (; i < fonte.length; i++) {
      const c = fonte[i]
      if (c === '{') chaves++
      else if (c === '}') chaves--
      else if (c === '>' && chaves === 0) break
    }
    tags.push({ indice: m.index, tag: fonte.slice(m.index, i + 1) })
  }
  return tags
}

/** Os valores de `className=`: a string direta ou a expressão entre chaves inteira. */
export function valoresDeClassName(fonte) {
  const valores = []
  for (const m of fonte.matchAll(/className=/g)) {
    let i = m.index + m[0].length
    const abre = fonte[i]
    if (abre === '"' || abre === "'" || abre === '`') {
      const fim = fonte.indexOf(abre, i + 1)
      if (fim > i) valores.push({ indice: m.index, valor: fonte.slice(i + 1, fim) })
      continue
    }
    if (abre !== '{') continue
    let nivel = 0
    for (; i < fonte.length; i++) {
      if (fonte[i] === '{') nivel++
      else if (fonte[i] === '}' && --nivel === 0) break
    }
    valores.push({ indice: m.index, valor: fonte.slice(m.index + m[0].length, i + 1) })
  }
  return valores
}

/** Escapa um texto para entrar numa expressão regular. */
export function escapar(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Resume um trecho para a linha do relatório. */
export function resumo(texto, max = 90) {
  const t = texto.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}
