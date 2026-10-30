// Roda as guardas sobre um projeto, aplica as exceções declaradas e a catraca,
// e escreve o relatório.
import { join } from 'node:path'

import { baseAtualizada, comparar, contagem, gravarBase, lerBase } from './catraca.mjs'
import { GUARDAS } from './guardas/index.mjs'
import { criarProjeto, lerConfig } from './projeto.mjs'

const MOTIVO_MINIMO = 20

/**
 * O projeto visto por uma guarda: o `ignorar` dela soma ao global, e o `em`
 * dela restringe a varredura às pastas que a configuração escolher.
 */
function vistaDaGuarda(projeto, op) {
  const fora = op.ignorar ?? []
  return {
    ...projeto,
    fontes: (o = {}) => projeto.fontes({ ...o, em: o.em ?? op.em, ignorar: [...fora, ...(o.ignorar ?? [])] }),
    paginas: (o = {}) => projeto.paginas({ ...o, ignorar: [...fora, ...(o.ignorar ?? [])] }),
  }
}

/** Roda uma guarda e devolve o resultado com as exceções aplicadas. */
export function rodarGuarda(guarda, projeto) {
  const cfg = projeto.config.regras[guarda.id]
  const base = { id: guarda.id, regras: guarda.regras, titulo: guarda.titulo, examinados: 0, violacoes: [], erros: [] }
  if (cfg === false) return { ...base, estado: 'erro', erros: [`desligar pede motivo: "${guarda.id}": { "desligada": "<por quê>" }`] }
  if (cfg && typeof cfg.desligada === 'string') {
    if (cfg.desligada.trim().length < MOTIVO_MINIMO) return { ...base, estado: 'erro', erros: ['desligada sem motivo escrito'] }
    return { ...base, estado: 'desligada', motivo: cfg.desligada }
  }
  const op = { ...guarda.padrao, ...(cfg ?? {}) }
  const sumidas = [...(op.em ?? []), ...(op.ignorar ?? [])].filter((c) => !projeto.existe(c))
  if (sumidas.length) return { ...base, estado: 'erro', erros: [`caminho da configuração que não existe: ${sumidas.join(', ')}`] }
  let r
  try {
    r = guarda.examinar(vistaDaGuarda(projeto, op), op)
  } catch (e) {
    return { ...base, estado: 'erro', erros: [e.message] }
  }
  const erros = [...(r.erros ?? [])]
  // CONV-14: o vazio não reprova, atravessa. Guarda que não examinou nada é erro, não verde.
  if (!(r.examinados > 0)) erros.push('não achou nada a examinar: confira os caminhos da configuração (CONV-14)')

  const excecoes = op.excecoes ?? []
  const isentos = new Set()
  for (const e of excecoes) {
    if (!e.arquivo || (e.motivo ?? '').trim().length < MOTIVO_MINIMO) {
      erros.push(`exceção sem arquivo ou sem motivo escrito: ${JSON.stringify(e)}`)
      continue
    }
    if (!r.violacoes.some((v) => v.arquivo === e.arquivo)) {
      erros.push(`exceção velha: ${e.arquivo} já não viola — tire-a da lista`)
      continue
    }
    isentos.add(e.arquivo)
  }
  const violacoes = r.violacoes.filter((v) => !isentos.has(v.arquivo))
  return { ...base, examinados: r.examinados, violacoes, erros, estado: erros.length ? 'erro' : violacoes.length ? 'violacoes' : 'ok' }
}

/**
 * Confere o projeto. `modo`: `conferir` (o CI), `atualizar` (grava só a
 * descida da base) ou `iniciar` (cria a base com o estado de hoje, só quando
 * ela não existe — a adoção num projeto legado).
 */
export function verificar({ raiz = process.cwd(), config, caminhoDaConfig, modo = 'conferir', so } = {}) {
  const cfg = config ?? lerConfig(raiz, caminhoDaConfig)
  const projeto = criarProjeto({ raiz, config: cfg })
  const guardas = so ? GUARDAS.filter((g) => so.includes(g.id)) : GUARDAS
  if (so) for (const id of so) if (!GUARDAS.some((g) => g.id === id)) throw new Error(`guarda desconhecida: ${id}`)
  for (const id of Object.keys(cfg.regras)) {
    if (!GUARDAS.some((g) => g.id === id)) throw new Error(`a configuração cita uma guarda que não existe: ${id}`)
  }
  const resultados = guardas.map((g) => rodarGuarda(g, projeto))
  const caminhoDaBase = join(projeto.raiz, cfg.base)
  const base = lerBase(caminhoDaBase)
  const atual = contagem(resultados)
  const baseConsiderada = so ? Object.fromEntries(Object.entries(base.guardas).filter(([g]) => so.includes(g))) : base.guardas

  let gravou = null
  const emErro = resultados.filter((r) => r.estado === 'erro')
  if (modo !== 'conferir' && emErro.length > 0) {
    // Guarda em erro conta zero; gravar agora apagaria a dívida dela da base sem volta.
    throw new Error(`não gravo a base com guarda em erro: ${emErro.map((r) => r.id).join(', ')} — corrija antes`)
  }
  if (modo === 'iniciar') {
    if (base.existe) throw new Error(`a base ${cfg.base} já existe: use --atualizar (que só grava a descida)`)
    if (so) throw new Error('--iniciar grava a base inteira: rode sem --so')
    gravarBase(caminhoDaBase, atual)
    gravou = cfg.base
  }
  const baseEfetiva = modo === 'iniciar' ? atual : baseConsiderada
  let comparacao = comparar(atual, baseEfetiva)
  if (modo === 'atualizar' && comparacao.desceram.length > 0) {
    if (so) throw new Error('--atualizar grava a base inteira: rode sem --so')
    const nova = baseAtualizada(atual, base.guardas)
    gravarBase(caminhoDaBase, nova)
    gravou = cfg.base
    comparacao = comparar(atual, nova)
  }
  const erros = resultados.filter((r) => r.estado === 'erro')
  const ok = erros.length === 0 && comparacao.novas.length + comparacao.subiram.length + comparacao.desceram.length === 0
  return { ok, resultados, comparacao, atual, gravou, config: cfg, relatorio: relatorio({ resultados, comparacao, gravou, ok, cfg }) }
}

function relatorio({ resultados, comparacao, gravou, ok, cfg }) {
  const linhas = []
  const porGuarda = new Map(resultados.map((r) => [r.id, r]))
  for (const r of resultados.filter((x) => x.estado === 'erro')) {
    linhas.push(`✗ ${r.id} (${r.regras.join(', ')}) — a guarda não pôde valer:`)
    for (const e of r.erros) linhas.push(`    ${e}`)
  }
  const detalhe = (item) => {
    const r = porGuarda.get(item.guarda)
    return (r?.violacoes ?? []).filter((v) => v.arquivo === item.arquivo).map((v) => `      ${v.arquivo}${v.linha ? `:${v.linha}` : ''} — ${v.mensagem}${v.trecho ? ` · ${v.trecho}` : ''}`)
  }
  if (comparacao.novas.length) {
    linhas.push('✗ violação nova (fora da base):')
    for (const i of comparacao.novas) linhas.push(`    ${i.guarda} (${porGuarda.get(i.guarda)?.regras.join(', ') ?? '?'}) · ${i.arquivo}: ${i.agora}`, ...detalhe(i))
  }
  if (comparacao.subiram.length) {
    linhas.push('✗ contagem subiu:')
    for (const i of comparacao.subiram) linhas.push(`    ${i.guarda} · ${i.arquivo}: ${i.antes} → ${i.agora}`, ...detalhe(i))
  }
  if (comparacao.desceram.length) {
    linhas.push(`✗ contagem desceu e a base não foi regravada — rode \`wicomm-guardas --atualizar\` e comite ${cfg.base}:`)
    for (const i of comparacao.desceram) linhas.push(`    ${i.guarda} · ${i.arquivo}: ${i.antes} → ${i.agora}`)
  }
  const desligadas = resultados.filter((r) => r.estado === 'desligada')
  for (const r of desligadas) linhas.push(`· ${r.id} desligada: ${r.motivo}`)
  if (gravou) linhas.push(`· base gravada em ${gravou}`)
  const ativas = resultados.filter((r) => r.estado !== 'desligada')
  const naBase = ativas.reduce((n, r) => n + r.violacoes.length, 0)
  linhas.push(`${ok ? '✓' : '✗'} ${ativas.length} guardas, ${ativas.reduce((n, r) => n + r.examinados, 0)} itens examinados, ${naBase} violações contadas`)
  return linhas.join('\n')
}

/** Para o teste do projeto (vitest, node:test, jest): lança com o relatório se a catraca reprovar. */
export function afirmarGuardas(opcoes = {}) {
  const r = verificar(opcoes)
  if (!r.ok) throw new Error(`guardas de design Wicomm reprovaram:\n${r.relatorio}`)
  return r
}
