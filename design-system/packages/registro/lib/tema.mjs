// O tema no registro (F345): o que é da marca e chega ao projeto que instala —
// o prefixo do registro, o nome no título do estilo, os tokens do estilo e o
// logotipo e o rótulo da marca no código das peças.
//
// O código das peças traz a marca do tema padrão escrita por extenso (é o que o
// teste dom renderiza e o que o projeto de hoje recebe). Com outro tema, o build
// troca esses trechos no arquivo do item: o arquivo instalado continua um só,
// sem uma dependência nova (`lib/tema.ts`) que mudaria o que o `shadcn add`
// grava em todo projeto (o critério: `test/o-que-o-add-grava.test.mjs`).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lerTema } from '../../tokens/lib/tema.mjs'
import { saidas } from '../../tokens/lib/saidas.mjs'

const RAIZ = join(import.meta.dirname, '..')

/** O tema dos tokens publicados: o que o registro usa quando ninguém passa `--tema`. */
export const TEMA_PADRAO = join(RAIZ, '..', '..', 'temas', 'wicomm')

/** `{ pasta, meta }` de um tema, conferido (o tema que não passa é erro, como no gerador de tokens). */
export const temaDoRegistro = (pasta = TEMA_PADRAO) => lerTema(pasta)

/** O tema é o padrão: o registro sai exatamente como antes do tema existir. */
export const ePadrao = (tema) => tema.pasta === temaDoRegistro().pasta

/** O `tailwind-v4.css` do tema: o publicado em @wicomm/tokens para o padrão; gerado do tema para os outros. */
export const tailwindDoTema = (tema) => saidas({ tema: tema.pasta })['tailwind-v4.css']

/**
 * Os trechos da marca no código das peças, por arquivo: o texto do tema padrão e como ele fica com o tema dado.
 * Trecho que sumiu do código é erro do build, não troca calada que deixa a marca padrão no item.
 */
/** Um atributo JSX com o valor dado: entre aspas quando cabe; como expressão quando ele tem aspas ou barra. */
const atributo = (nome, valor) => (/["\\]/.test(valor) ? `${nome}={${JSON.stringify(valor)}}` : `${nome}="${valor}"`)

/** A peça que embute o desenho do logotipo do tema. */
export const PECA_DO_LOGOTIPO = 'registry/design-system/ui/logotipo.tsx'

/** A linha do desenho na peça, como está no arquivo (o gerador a reescreve; nada mais nela muda). */
export const LINHA_DO_DESENHO = /^const DESENHO_DO_LOGOTIPO: .*$/m

const dataUri = (caminho) => `data:image/png;base64,${readFileSync(caminho).toString('base64')}`

/**
 * A linha do desenho do logotipo com o tema dado (MARCA-04: o raster sai do arquivo do tema por script, e a
 * suíte confere): os dois PNG do tema em data URI, ou `null` quando o tema não declara desenho.
 */
export function linhaDoDesenho(tema) {
  const imagem = tema.meta.logotipo.imagem
  const valor = imagem
    ? `{ sobreClaro: ${JSON.stringify(dataUri(join(tema.pasta, imagem.sobreClaro)))}, sobreEscuro: ${JSON.stringify(dataUri(join(tema.pasta, imagem.sobreEscuro)))} }`
    : 'null'
  return `const DESENHO_DO_LOGOTIPO: { sobreClaro: string; sobreEscuro: string } | null = ${valor}`
}

export const MARCA_NO_CODIGO = {
  [PECA_DO_LOGOTIPO]: [
    [linhaDoDesenho(temaDoRegistro()), linhaDoDesenho],
    ['aria-label="Wicomm"', (t) => atributo('aria-label', t.meta.nome)],
    [
      '{variante === "horizontal" ? "wicomm" : "w"}',
      (t) => `{variante === "horizontal" ? ${JSON.stringify(t.meta.logotipo.horizontal)} : ${JSON.stringify(t.meta.logotipo.monograma)}}`,
    ],
  ],
  'registry/design-system/blocks/casco/barra-lateral.tsx': [['aria-label="Wicomm, início"', (t) => atributo('aria-label', `${t.meta.nome}, início`)]],
}

/** O código de um arquivo do registro com a marca do tema. Com o tema padrão, o texto volta igual. */
export function codigoComOTema(caminho, texto, tema) {
  const trocas = MARCA_NO_CODIGO[caminho] ?? []
  let saida = texto
  for (const [de, para] of trocas) {
    if (!saida.includes(de)) throw new Error(`${caminho}: o trecho da marca \`${de}\` sumiu do código; atualize MARCA_NO_CODIGO (lib/tema.mjs)`)
    saida = saida.split(de).join(para(tema))
  }
  return saida
}

/** O mesmo, lendo do disco do pacote. */
export const arquivoComOTema = (caminho, tema) => codigoComOTema(caminho, readFileSync(join(RAIZ, caminho), 'utf8'), tema)
