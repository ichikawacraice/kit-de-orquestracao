#!/usr/bin/env node
/**
 * Confere notas de release contra o formato (formato.md). Versão do formato: 1.
 *
 *   node validar.mjs docs/releases            # a pasta inteira (inclui PR repetido entre arquivos)
 *   node validar.mjs docs/releases/2026-10-04-1.md
 *
 * Sai 0 quando tudo passa; ≠ 0 com `arquivo: motivo` (com a linha, quando há).
 *
 * O formato pode ter mais de um leitor (um repositório com página própria tem o
 * dele). Mudou um, mude o outro — e, se o repositório tiver teste, que um teste
 * os compare.
 */
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const NOME_DA_NOTA = /^(\d{4}-\d{2}-\d{2})-([1-9]\d*)\.md$/
const CATEGORIAS = [
  { chave: 'novidades', titulo: 'Novidades' },
  { chave: 'correcoes', titulo: 'Correções' },
  { chave: 'bastidores', titulo: 'Bastidores' },
]
const TIPOS = new Set(['release', 'entregas-do-dia'])
const RASTRO = /\s\((#\d+(?:,\s*#\d+)*)\)$/
const CITA_DOC = /\bSPEC-\d|\bADR\b|§/
const LIMITE_DO_RESUMO = 140

function dataValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function lerNota(nomeDoArquivo, texto) {
  const nome = NOME_DA_NOTA.exec(nomeDoArquivo)
  if (!nome) return { ok: false, erros: [`nome: "${nomeDoArquivo}" não segue AAAA-MM-DD-<n>.md`] }
  const erros = []
  const linhas = texto.replace(/\r\n?/g, '\n').split('\n')
  if (linhas[0] !== '---') return { ok: false, erros: ['linha 1: o arquivo começa pelo frontmatter (---)'] }
  const fim = linhas.indexOf('---', 1)
  if (fim < 0) return { ok: false, erros: ['frontmatter sem o --- que o fecha'] }

  const campos = new Map()
  for (let i = 1; i < fim; i++) {
    const m = /^([a-z]+):\s*(.*)$/.exec(linhas[i])
    if (!m) { erros.push(`linha ${i + 1}: frontmatter fora de "chave: valor"`); continue }
    campos.set(m[1], m[2].trim())
  }

  const data = campos.get('data') ?? ''
  if (!dataValida(data)) erros.push(`data: "${data}" não é uma data AAAA-MM-DD`)
  else if (data !== nome[1]) erros.push(`data: ${data} difere do nome do arquivo (${nome[1]})`)

  const ordem = Number(campos.get('ordem'))
  if (!Number.isInteger(ordem) || ordem < 1) erros.push('ordem: inteiro ≥ 1')
  else if (String(ordem) !== nome[2]) erros.push(`ordem: ${ordem} difere do nome do arquivo (${nome[2]})`)

  const tipo = campos.get('tipo') ?? ''
  if (!TIPOS.has(tipo)) erros.push(`tipo: "${tipo}" — use release ou entregas-do-dia`)

  const releaseCru = campos.get('release')
  const release = releaseCru === undefined || releaseCru === '' ? null : Number(releaseCru)
  if (release !== null && (!Number.isInteger(release) || release < 1)) erros.push(`release: "${releaseCru}" não é número de PR`)

  const resumo = (campos.get('resumo') ?? '').replace(/^"(.*)"$/, '$1')
  if (!resumo) erros.push('resumo: obrigatório')
  else if (resumo.length > LIMITE_DO_RESUMO) erros.push(`resumo: ${resumo.length} caracteres, o limite é ${LIMITE_DO_RESUMO}`)

  const prsCru = campos.get('prs') ?? ''
  const mPrs = /^\[(.*)\]$/.exec(prsCru)
  const prs = mPrs ? mPrs[1].split(',').map((s) => s.trim()).filter(Boolean).map(Number) : []
  if (!mPrs || prs.length === 0 || prs.some((n) => !Number.isInteger(n) || n < 1)) erros.push(`prs: "${prsCru}" — lista não vazia de números, [1, 2]`)
  const repetidos = prs.filter((n, i) => prs.indexOf(n) !== i)
  if (repetidos.length) erros.push(`prs: repetido(s) ${[...new Set(repetidos)].join(', ')}`)

  const secoes = []
  let atual = null
  let ultimaPosicao = -1
  for (let i = fim + 1; i < linhas.length; i++) {
    const linha = linhas[i]
    if (linha.trim() === '') continue
    const titulo = /^## (.+)$/.exec(linha)
    if (titulo) {
      const posicao = CATEGORIAS.findIndex((c) => c.titulo === titulo[1].trim())
      if (posicao < 0) { erros.push(`linha ${i + 1}: seção "${titulo[1]}" — só Novidades, Correções e Bastidores`); atual = null; continue }
      if (posicao <= ultimaPosicao) erros.push(`linha ${i + 1}: seção "${titulo[1]}" fora da ordem Novidades → Correções → Bastidores`)
      ultimaPosicao = posicao
      atual = { categoria: CATEGORIAS[posicao].chave, itens: [] }
      secoes.push(atual)
      continue
    }
    const item = /^- (.+)$/.exec(linha)
    if (!item || !atual) { erros.push(`linha ${i + 1}: fora do formato (esperava "## Seção" ou "- item (#N)")`); continue }
    const rastro = RASTRO.exec(item[1])
    if (!rastro) { erros.push(`linha ${i + 1}: o item termina pelo rastro (#N)`); continue }
    atual.itens.push({ texto: item[1].slice(0, rastro.index).trim(), prs: rastro[1].split(',').map((s) => Number(s.trim().slice(1))) })
  }
  if (secoes.length === 0) erros.push('corpo: nenhuma seção — ao menos uma de Novidades, Correções, Bastidores')
  for (const s of secoes) if (s.itens.length === 0) erros.push(`seção ${s.categoria} vazia — omita a seção`)

  const citados = new Set(secoes.flatMap((s) => s.itens.flatMap((it) => it.prs)))
  for (const n of citados) if (!prs.includes(n)) erros.push(`#${n} está num item e não em prs`)
  for (const n of prs) if (!citados.has(n)) erros.push(`#${n} está em prs e em nenhum item`)

  for (const t of [resumo, ...secoes.flatMap((s) => s.itens.map((it) => it.texto))]) {
    if (CITA_DOC.test(t)) erros.push(`cita documento interno (SPEC/ADR/§): "${t}"`)
  }

  if (erros.length) return { ok: false, erros }
  return { ok: true, nota: { data, ordem, tipo, release, resumo, prs, secoes } }
}

export function main(argv) {
  const alvo = argv[0]
  if (!alvo) { process.stderr.write('uso: validar.mjs <pasta|arquivo>\n'); return 2 }
  const pasta = statSync(alvo).isDirectory()
  const arquivos = pasta ? readdirSync(alvo).filter((n) => NOME_DA_NOTA.test(n)).map((n) => join(alvo, n)) : [alvo]
  // Nome errado não pode sumir calado: na pasta, todo .md é o adaptador ou uma nota.
  const foraDoNome = pasta ? readdirSync(alvo).filter((n) => n.endsWith('.md') && n !== 'README.md' && !NOME_DA_NOTA.test(n)) : []
  for (const n of foraDoNome) process.stderr.write(`${n}: nome fora de AAAA-MM-DD-<n>.md — a nota não seria lida\n`)
  if (arquivos.length === 0) { process.stderr.write(`${alvo}: nenhuma nota para conferir — vazio não é aprovação\n`); return 1 }
  let falhas = 0
  const dono = new Map()
  for (const caminho of arquivos) {
    const nome = basename(caminho)
    const r = lerNota(nome, readFileSync(caminho, 'utf8'))
    const erros = r.ok ? [] : r.erros
    if (r.ok) {
      for (const n of r.nota.prs) {
        if (dono.has(n)) erros.push(`#${n} já está em ${dono.get(n)}`)
        else dono.set(n, nome)
      }
    }
    for (const e of erros) process.stderr.write(`${nome}: ${e}\n`)
    if (erros.length) falhas++
  }
  process.stdout.write(`${arquivos.length - falhas}/${arquivos.length} nota(s) no formato\n`)
  return falhas || foraDoNome.length ? 1 : 0
}

// Comparar pelo caminho REAL: chamado por um symlink (o de `~/.claude/skills`),
// `argv[1]` é o link e `import.meta.url` é o destino — e a comparação crua
// nunca casava, o script não rodava nada e saía 0, calado.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2))
}
