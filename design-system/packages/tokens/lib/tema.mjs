// O tema: o que é da marca e não do sistema, numa pasta à parte (`temas/<id>/`).
//
// Dois arquivos, porque as cores já têm formato e leitor (DTCG, o slot `marca`)
// e o resto não é cor: `tema.tokens.json` (as cores) e `tema.json` (nome,
// logotipo, fonte, prefixo do registro). Trocar a marca é trocar a pasta.
//
// O tema não é aceito às cegas: ele é conferido pelas regras que a base já
// manda (MARCA-01, MARCA-03). Tema que as quebra reprova ao ler, com a regra no
// erro — antes de gerar uma saída que a guarda do projeto acusaria depois.
import { existsSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

import { hsl, razao } from './contraste.mjs'
import { cru } from './ler.mjs'

/** O tema dos apps da Wicomm, na raiz do repositório (fora do pacote: não é publicado). */
export const TEMA_PADRAO = resolve(import.meta.dirname, '..', '..', '..', 'temas', 'wicomm')

/** O que o tema Wicomm declara, para o gerador sem tema dar a saída de sempre. */
export const FONTE_PADRAO = { variavel: '--font-archivo', utilitaria: 'font-archivo' }

/** MARCA-01: o hover muda só a luz. A tolerância cobre o arredondamento do hex de 6 dígitos. */
const MATIZ_TOLERADA = 1.5
/** MARCA-03: as pontas do gradiente pagam 2:1 de luminância entre si. */
const PISO_DO_GRADIENTE = 2

/** Os campos obrigatórios de `tema.json`, com o tipo. O resto é livre (descrição, `$schema`). */
const CAMPOS = {
  id: 'string',
  nome: 'string',
  'logotipo.horizontal': 'string',
  'logotipo.monograma': 'string',
  'fonte.familia': 'string',
  'fonte.variavel': 'string',
  'fonte.utilitaria': 'string',
  'fonte.eixoDeLargura': 'boolean',
  contrasteAceitoSobreAMarca: 'number',
  'registro.prefixo': 'string',
}

const lerJson = (caminho) => JSON.parse(readFileSync(caminho, 'utf8'))
const ASSINATURA_DO_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ePng = (caminho) => existsSync(caminho) && readFileSync(caminho).subarray(0, 8).equals(ASSINATURA_DO_PNG)
/** O PNG que o gerador decodifica para tirar o negativo: RGBA de 8 bits, sem entrelaçamento (lido no IHDR). */
const ePngRgba8 = (caminho) => {
  const b = readFileSync(caminho)
  return b.length > 28 && b.toString('latin1', 12, 16) === 'IHDR' && b[24] === 8 && b[25] === 6 && b[28] === 0
}
const campo = (obj, caminho) => caminho.split('.').reduce((no, parte) => no?.[parte], obj)

/**
 * Lê a pasta de um tema. `{ validar: false }` devolve o tema sem conferir — para
 * quem quer a lista de problemas (`validarTema`) em vez do erro.
 */
export function lerTema(pasta, { validar = true } = {}) {
  const dir = resolve(pasta)
  const tema = { pasta: dir, meta: lerJson(join(dir, 'tema.json')), marca: join(dir, 'tema.tokens.json') }
  tema.tokens = lerJson(tema.marca)
  if (validar) {
    const problemas = validarTema(tema)
    if (problemas.length) throw new Error(`o tema ${basename(dir)} não passa:\n- ${problemas.join('\n- ')}`)
  }
  return tema
}

/** Os avisos do tema: o que gera, mas sai pior. */
export function avisosDoTema({ meta }) {
  return meta.fonte?.eixoDeLargura === false
    ? [`a família ${meta.fonte.familia} não tem o eixo de largura (wdth): as vozes que estreitam a letra (t-rotulo) caem no peso, não na largura`]
    : []
}

/** Os problemas do tema (lista vazia quando passa). Cada um cita a regra que quebra. */
export function validarTema({ pasta, meta, tokens }) {
  const problemas = []
  for (const [caminho, tipo] of Object.entries(CAMPOS)) {
    if (typeof campo(meta, caminho) !== tipo) problemas.push(`tema.json: \`${caminho}\` falta ou não é ${tipo}`)
  }
  if (typeof meta.id === 'string' && !/^[a-z0-9-]+$/.test(meta.id)) problemas.push('tema.json: o `id` é minúscula, algarismo e hífen (vira nome de pasta e de plugin)')
  if (typeof meta.registro?.prefixo === 'string' && !meta.registro.prefixo.startsWith('@')) {
    problemas.push('tema.json: `registro.prefixo` começa com `@` (é a chave do registro no components.json)')
  }
  if (pasta && meta.id !== basename(pasta)) problemas.push(`tema.json: o \`id\` (${meta.id}) é o nome da pasta (${basename(pasta)})`)
  if (typeof meta.fonte?.variavel === 'string' && !meta.fonte.variavel.startsWith('--')) {
    problemas.push('tema.json: `fonte.variavel` é uma variável CSS (começa com `--`)')
  }

  const imagem = meta.logotipo?.imagem
  if (imagem !== undefined) {
    for (const chave of ['sobreClaro', 'sobreEscuro']) {
      const arquivo = imagem?.[chave]
      if (typeof arquivo !== 'string' || !arquivo.endsWith('.png')) {
        problemas.push(`tema.json: \`logotipo.imagem.${chave}\` é o caminho de um PNG na pasta do tema`)
      } else if (pasta && !ePng(join(pasta, arquivo))) {
        problemas.push(`tema.json: \`logotipo.imagem.${chave}\` (${arquivo}) não é um PNG na pasta do tema`)
      }
    }
    if (typeof imagem?.origem !== 'string') problemas.push('tema.json: `logotipo.imagem.origem` diz de onde o arquivo oficial veio')
  }

  const simbolo = meta.logotipo?.simbolo
  if (simbolo !== undefined) {
    const arquivo = simbolo?.sobreClaro
    if (typeof arquivo !== 'string' || !arquivo.endsWith('.png')) {
      problemas.push('tema.json: `logotipo.simbolo.sobreClaro` é o caminho de um PNG na pasta do tema')
    } else if (pasta && !ePng(join(pasta, arquivo))) {
      problemas.push(`tema.json: \`logotipo.simbolo.sobreClaro\` (${arquivo}) não é um PNG na pasta do tema`)
    } else if (pasta && !ePngRgba8(join(pasta, arquivo))) {
      problemas.push(`tema.json: \`logotipo.simbolo.sobreClaro\` (${arquivo}) é PNG RGBA de 8 bits sem entrelaçamento: o negativo sai dele por script`)
    }
    if (typeof simbolo?.origem !== 'string') problemas.push('tema.json: `logotipo.simbolo.origem` diz de onde o arquivo oficial veio')
  }

  const m = tokens?.marca
  if (!m?.cor || !m.hover || !m.gradiente?.inicio || !m.gradiente?.fim) {
    problemas.push('tema.tokens.json: o slot `marca` declara `cor`, `hover` e `gradiente.inicio`/`fim`')
    return problemas
  }
  if (cru(m.cor, 'escuro') !== m.cor.$value) problemas.push('MARCA-01: a cor da marca é a mesma nos dois temas')
  for (const t of ['claro', 'escuro']) {
    const [cor, hover] = [hsl(cru(m.cor, t))[0], hsl(cru(m.hover, t))[0]]
    const distancia = Math.min(Math.abs(cor - hover), 360 - Math.abs(cor - hover))
    if (distancia > MATIZ_TOLERADA) {
      problemas.push(`MARCA-01: o hover muda só a luz, na mesma matiz — no ${t}, a marca está em ${cor.toFixed(1)}° e o hover em ${hover.toFixed(1)}°`)
    }
    const pontas = razao(cru(m.gradiente.inicio, t), cru(m.gradiente.fim, t))
    if (pontas < PISO_DO_GRADIENTE) problemas.push(`MARCA-03: as pontas do gradiente pagam ${PISO_DO_GRADIENTE}:1 — no ${t}, ${pontas}:1`)
  }
  return problemas
}
