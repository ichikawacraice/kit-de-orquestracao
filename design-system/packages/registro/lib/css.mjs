// Lê o `tailwind-v4.css` de @wicomm/tokens e o devolve na forma do item de
// estilo do shadcn (`cssVars` + `css`). O arquivo é gerado e regular — blocos,
// declarações e at-rules de uma linha —, então um leitor de chaves basta; ele
// recusa o que não reconhece em vez de deixar passar calado.

/** A árvore do CSS: lista de nós `{ seletor, filhos }`, `{ prop, valor }` ou `{ regra }` (at-rule sem bloco). */
export function lerCss(texto) {
  const semComentario = texto.replace(/\/\*[\s\S]*?\*\//g, '')
  let i = 0
  function nivel() {
    const nos = []
    let buf = ''
    while (i < semComentario.length) {
      const c = semComentario[i++]
      if (c === '{') {
        const seletor = buf.trim()
        buf = ''
        nos.push({ seletor, filhos: nivel() })
      } else if (c === '}') {
        if (buf.trim()) throw new Error(`declaração sem ponto e vírgula antes de "}": ${buf.trim()}`)
        return nos
      } else if (c === ';') {
        const d = buf.trim()
        buf = ''
        if (!d) continue
        if (d.startsWith('@')) nos.push({ regra: d })
        else {
          const k = d.indexOf(':')
          if (k < 0) throw new Error(`declaração sem ":": ${d}`)
          nos.push({ prop: d.slice(0, k).trim(), valor: d.slice(k + 1).trim() })
        }
      } else buf += c
    }
    if (buf.trim()) throw new Error(`sobra no fim do CSS: ${buf.trim()}`)
    return nos
  }
  return nivel()
}

/** Um bloco da árvore como objeto `{ prop: valor, seletor: {…} }`, a forma do campo `css` do shadcn. */
function objeto(filhos) {
  const o = {}
  for (const n of filhos) {
    if (n.prop) o[n.prop] = n.valor
    else if (n.seletor) o[n.seletor] = objeto(n.filhos)
    else throw new Error(`at-rule dentro de bloco não suportada: ${n.regra}`)
  }
  return o
}

/** Valor de cor: hex ou rgb(a). Degradê e sombra usam cor dentro, mas não começam por ela. */
const COR = /^(#[0-9a-f]{3,8}|rgba?\()/i

const variavel = (filhos, onde) => {
  const vars = {}
  const resto = {}
  for (const n of filhos) {
    if (n.prop?.startsWith('--')) vars[n.prop.slice(2)] = n.valor
    else if (n.prop) resto[n.prop] = n.valor
    else throw new Error(`bloco inesperado em ${onde}: ${n.seletor ?? n.regra}`)
  }
  return { vars, resto }
}

/**
 * O `tailwind-v4.css` dos tokens no formato do item `registry:style`:
 * - `:root` e `.dark` → `cssVars.light` e `cssVars.dark` (o que não é variável, como `color-scheme`, vai ao `css`);
 * - `@theme inline` → `cssVars.theme`, e os `@keyframes` de dentro dele → `css`;
 * - `@layer`, `@utility` → `css`, como estão;
 * - `@custom-variant dark` é o mesmo que o `init` do shadcn já escreve, e é conferido, não copiado.
 */
export function estiloDoShadcn(texto) {
  const cssVars = { theme: {}, light: {}, dark: {} }
  const css = {}
  for (const n of lerCss(texto)) {
    if (n.regra) {
      if (n.regra === '@custom-variant dark (&:is(.dark *))') continue
      throw new Error(`at-rule de topo não suportada: ${n.regra}`)
    }
    if (n.seletor === ':root' || n.seletor === '.dark') {
      const { vars, resto } = variavel(n.filhos, n.seletor)
      // Só cor e `--radius` vão ao `cssVars`. O CLI do shadcn dá a toda variável
      // de `cssVars` um par `--x: var(--x)` no `@theme inline`; para sombra,
      // degradê e raio nomeado isso é ruído (o tema já os gasta por utilitária).
      // Esses vão ao `css`, no mesmo seletor, junto do que não é variável.
      const doTema = {}
      for (const [k, v] of Object.entries(vars)) {
        if (k === 'radius' || COR.test(v)) doTema[k] = v
        else resto[`--${k}`] = v
      }
      Object.assign(cssVars[n.seletor === ':root' ? 'light' : 'dark'], doTema)
      if (Object.keys(resto).length) css[n.seletor] = resto
    } else if (n.seletor === '@theme inline') {
      for (const f of n.filhos) {
        if (f.prop?.startsWith('--')) cssVars.theme[f.prop.slice(2)] = f.valor
        else if (f.seletor?.startsWith('@keyframes ')) css[f.seletor] = objeto(f.filhos)
        else throw new Error(`no @theme: ${f.prop ?? f.seletor ?? f.regra}`)
      }
    } else if (n.seletor.startsWith('@layer ') || n.seletor.startsWith('@utility ')) {
      css[n.seletor] = objeto(n.filhos)
    } else throw new Error(`bloco de topo não suportado: ${n.seletor}`)
  }
  return { cssVars, css }
}
