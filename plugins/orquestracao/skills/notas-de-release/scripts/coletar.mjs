#!/usr/bin/env node
/**
 * Coleta os PRs de um release, em JSON, para a skill notas-de-release escrever.
 *
 * Modos (um por chamada):
 *   (padrão)        o que está em origin/<head> e não em origin/<base>  — o release que vai abrir
 *   --release <n>   os PRs que o PR de release <n> (já mergeado) levou     — histórico
 *   --pr <n>        um PR só (hotfix direto na base)
 *   --dia AAAA-MM-DD  os PRs mergeados na base naquele dia (Brasília) sem vir do head — histórico pré-tronco
 *
 * Opções: --base main --head develop --pasta docs/releases --repo dono/nome
 *
 * Exclui o PR já citado em `prs:` de alguma nota da pasta e o PR cujo título
 * começa por `docs(releases)` (as próprias notas), e DECLARA os dois em
 * `excluidos` — descarte calado é o defeito que esta lista existe para evitar.
 *
 * Sem dependência: node ≥ 18, git e gh no PATH.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const NOME_DA_NOTA = /^(\d{4}-\d{2}-\d{2})-[1-9]\d*\.md$/
const FUSO = 'America/Sao_Paulo'
const LIMITE_DO_CASO = 1200
const TETO_DA_LISTA = 200

function rodar(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', timeout: 120_000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024 })
}

export function opcoes(argv) {
  const o = { base: null, head: null, pasta: 'docs/releases', repo: null, release: null, pr: null, dia: null }
  for (let i = 0; i < argv.length; i++) {
    const chave = argv[i].replace(/^--/, '')
    if (!(chave in o)) throw new Error(`opção desconhecida: ${argv[i]}`)
    const valor = argv[++i]
    // Opção sem valor não pode cair calada no modo padrão (`--release` sozinho viraria a faixa inteira).
    if (valor === undefined || valor.startsWith('--')) throw new Error(`a opção ${argv[i - 1]} precisa de um valor`)
    o[chave] = valor
  }
  return o
}

/** Base e head do adaptador (`docs/releases/README.md`, linhas `- base: main` / `- head: develop`). */
export function lerAdaptador(pasta) {
  const caminho = join(pasta, 'README.md')
  if (!existsSync(caminho)) return { base: null, head: null }
  const texto = readFileSync(caminho, 'utf8')
  return {
    base: /^-\s*base:\s*`?([\w./-]+)`?\s*$/m.exec(texto)?.[1] ?? null,
    head: /^-\s*head:\s*`?([\w./-]+)`?\s*$/m.exec(texto)?.[1] ?? null,
  }
}

export function prsJaNotados(pasta) {
  const dono = new Map()
  if (!existsSync(pasta)) return dono
  for (const nome of readdirSync(pasta)) {
    if (!NOME_DA_NOTA.test(nome)) continue
    const m = /^prs:\s*\[(.*)\]\s*$/m.exec(readFileSync(join(pasta, nome), 'utf8').replace(/\r\n?/g, '\n'))
    for (const s of m?.[1].split(',') ?? []) {
      const n = Number(s.trim())
      if (Number.isInteger(n) && n > 0) dono.set(n, nome)
    }
  }
  return dono
}

/** A MAIOR ordem já usada no dia — não a contagem: com `-1` e `-3` na pasta, contar daria 3 e sobrescreveria uma nota. */
export function notasDoDia(pasta, data) {
  if (!existsSync(pasta)) return 0
  const ordens = readdirSync(pasta)
    .map((n) => /^(\d{4}-\d{2}-\d{2})-([1-9]\d*)\.md$/.exec(n))
    .filter((m) => m && m[1] === data)
    .map((m) => Number(m[2]))
  return ordens.length ? Math.max(...ordens) : 0
}

export function dataEmBrasilia(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

/** O último `(#N)` de cada assunto de squash; o resto é declarado. */
export function prsDosAssuntos(assuntos) {
  const prs = []
  const semPr = []
  for (const a of assuntos) {
    // Repositório que faz merge (e não squash) deixa o número no assunto do merge commit.
    const merge = /^Merge pull request #(\d+) /.exec(a)
    if (merge) { prs.push(Number(merge[1])); continue }
    const todos = [...a.matchAll(/\(#(\d+)\)/g)]
    if (todos.length) prs.push(Number(todos[todos.length - 1][1]))
    else if (a.trim()) semPr.push(a)
  }
  return { prs: [...new Set(prs)], semPr }
}

/** O texto de `## O caso` até o próximo `## `; sem a seção, o começo do corpo. */
export function casoDoCorpo(corpo) {
  const texto = (corpo ?? '').replace(/\r\n?/g, '\n')
  const m = /^##\s+O caso[^\n]*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/m.exec(texto)
  const caso = (m ? m[1] : texto.slice(0, 800)).trim()
  return caso.length > LIMITE_DO_CASO ? `${caso.slice(0, LIMITE_DO_CASO)}…` : caso
}

function assuntosDaFaixa(de, ate) {
  return rodar('git', ['log', '--first-parent', '--format=%s', `${de}..${ate}`]).split('\n').filter(Boolean)
}

function ghRepo(o) {
  return o.repo ? ['--repo', o.repo] : []
}

function dadosDoPr(n, o) {
  return JSON.parse(rodar('gh', ['pr', 'view', String(n), ...ghRepo(o), '--json', 'number,title,body,mergedAt,headRefName']))
}

function coletar(o) {
  const adaptador = lerAdaptador(o.pasta)
  const base = o.base ?? adaptador.base ?? 'main'
  const head = o.head ?? adaptador.head ?? 'develop'
  let modo, data, release = null, numeros, semPr = []

  if (o.release) {
    modo = 'release'
    const pr = JSON.parse(rodar('gh', ['pr', 'view', o.release, ...ghRepo(o), '--json', 'mergeCommit,mergedAt,number']))
    if (!pr.mergedAt) throw new Error(`o PR #${o.release} não foi mergeado`)
    release = pr.number
    data = dataEmBrasilia(pr.mergedAt)
    let assuntos
    try {
      assuntos = assuntosDaFaixa(`${pr.mergeCommit.oid}^1`, `${pr.mergeCommit.oid}^2`)
    } catch {
      assuntos = rodar('gh', ['pr', 'view', o.release, ...ghRepo(o), '--json', 'commits', '--jq', '.commits[].messageHeadline']).split('\n')
    }
    ;({ prs: numeros, semPr } = prsDosAssuntos(assuntos))
  } else if (o.pr) {
    modo = 'pr'
    const pr = dadosDoPr(o.pr, o)
    if (!pr.mergedAt) throw new Error(`o PR #${o.pr} não foi mergeado`)
    release = pr.number
    data = dataEmBrasilia(pr.mergedAt)
    numeros = [pr.number]
  } else if (o.dia) {
    modo = 'dia'
    data = o.dia
    const busca = `merged:${o.dia}T00:00:00-03:00..${o.dia}T23:59:59-03:00`
    const lista = JSON.parse(rodar('gh', ['pr', 'list', ...ghRepo(o), '--state', 'merged', '--base', base, '--search', busca, '--json', 'number,headRefName', '--limit', String(TETO_DA_LISTA)]))
    if (lista.length >= TETO_DA_LISTA) throw new Error(`${lista.length} PRs em ${o.dia}: a lista pode estar cortada em ${TETO_DA_LISTA}`)
    numeros = lista.filter((p) => p.headRefName !== head).map((p) => p.number).sort((a, b) => a - b)
  } else {
    modo = 'faixa'
    rodar('git', ['fetch', '--quiet', 'origin', base, head])
    data = dataEmBrasilia(new Date().toISOString())
    ;({ prs: numeros, semPr } = prsDosAssuntos(assuntosDaFaixa(`origin/${base}`, `origin/${head}`)))
  }

  const notados = prsJaNotados(o.pasta)
  const excluidos = []
  const prs = []
  // Commit que entrou sem PR não pode sumir das notas: no modo --release ele vai
  // por conta do próprio PR de release (o único número que o cobre), com os
  // assuntos no lugar do caso. Nos outros modos ele é declarado em `excluidos`.
  if (semPr.length && release && !notados.has(release)) {
    prs.push({ numero: release, titulo: `commits diretos levados pelo release #${release}`, tipo: null, caso: semPr.map((a) => `- ${a}`).join('\n') })
  } else {
    for (const assunto of semPr) excluidos.push({ numero: null, motivo: `commit sem número de PR: ${assunto}` })
  }
  for (const n of numeros) {
    if (notados.has(n)) { excluidos.push({ numero: n, motivo: `já está em ${notados.get(n)}` }); continue }
    const pr = dadosDoPr(n, o)
    if (pr.title.startsWith('docs(releases)')) { excluidos.push({ numero: n, motivo: 'é o PR das próprias notas' }); continue }
    prs.push({ numero: n, titulo: pr.title, tipo: /^(\w+)/.exec(pr.title)?.[1] ?? null, caso: casoDoCorpo(pr.body) })
  }
  return { modo, base, head, data, ordem: notasDoDia(o.pasta, data) + 1, release, prs, excluidos }
}

export function main(argv) {
  try {
    const resultado = coletar(opcoes(argv))
    process.stdout.write(`${JSON.stringify(resultado, null, 2)}\n`)
    if (resultado.prs.length === 0) process.stderr.write('nenhum PR novo: não há notas a escrever.\n')
    return 0
  } catch (e) {
    process.stderr.write(`coletar: ${(e && (e.stderr || e.message)) || e}\n`)
    return 1
  }
}

// Comparar pelo caminho REAL: chamado por um symlink (o de `~/.claude/skills`),
// `argv[1]` é o link e `import.meta.url` é o destino — e a comparação crua
// nunca casava, o script não rodava nada e saía 0, calado.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2))
}
