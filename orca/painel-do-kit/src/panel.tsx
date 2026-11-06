// Aba do kit no Orca (F436): perguntas abertas, decisões assumidas, entregas e o estado das sessões (F452), num trilho de seções.
// Ler não aciona modelo: o painel só pede `kit.ler` ao worker (arquivos e o CLI do Orca em modo leitura). Só
// responder, discordar e responder a uma entrega acordam uma sessão. Desenho: docs/design/revisoes/2026-11-06-aba-do-kit-no-orca.md.
import {
  atom, read, set, update, plugin, storage,
  Badge, Box, Button, Callout, Code, Collapsible, EmptyState, Heading, IconButton, Row, Skeleton, Spinner, Text, Textarea,
} from 'orca'
import { cortar, haQuanto, horaSP, itemDe, listaDePRs, ms, nomeDoDestino, nomeDoDia, plural, porDia, porItem, quando, semPrefixoDoItem, tempoDaSessao } from './vista'
import { SeloDoProjeto, partesDoSelo } from './selo-do-projeto'
import { separarLidas, limpar as limparLidas, desfazer as desfazerLidas, podarLidas } from './nucleo/lidas.mjs'
import type { Acompanhada, AtualizacaoDoKit, Bolinha as BolinhaDaSessao, Concluida, ConcluidasLidas, DesfechoDoArquivar, Entrega, EstadoDaEntrega, GrupoDeSessoes, Leitura, Pendente, Pergunta, Sessao, VistaDasSessoes } from './protocol'
import { PRAZO_DO_ARQUIVAR_MS, PRAZO_DO_ENVIO_MS } from './protocol'

// O "Sim" do painel (o mesmo texto do pane do app): a sessão e a trava de limpeza o reconhecem.
const SIM = 'sim (segue a recomendação)'
const SEM_ENDERECO = 'Sem endereço no Orca: a resposta fica gravada, mas não acorda a sessão. Se ela espera você, abra-a e avise.'
// A resposta que esta aba grava leva esta origem (a mesma do núcleo): é por ela que a aba reconhece a própria resposta no arquivo.
const ORIGEM = 'operador-orca'
// A sessão do app Claude só lê a resposta quando começa ou se limpa: parada esperando, alguém precisa avisá-la.
const APP_SEM_ENDERECO = 'A sessão é do app Claude e esta aba não a acorda: abra-a no app e avise que respondeu.'
const ehDoApp = (q: Pick<Pergunta, 'sessaoId'>) => /^local_/.test(q.sessaoId ?? '')
const semEndereco = (q: Pick<Pergunta, 'sessaoId'>) => (ehDoApp(q) ? APP_SEM_ENDERECO : SEM_ENDERECO)
const SEM_RESPOSTA = 'Não gravou: a aba não recebeu resposta do worker. Tente de novo.'

/** O relógio da aba; os testes o trocam para provar as janelas de tempo. */
export const relogio = { agora: () => Date.now() }

const RELER_MS = 30_000
/** Depois do prazo do envio, quanto a aba ainda espera o arquivo dizer o desfecho antes de desistir do "Entregando…". */
const FOLGA_DO_DESFECHO_MS = 15_000
/** A diferença tolerada entre o relógio da aba e a hora gravada no arquivo, para reconhecer a resposta desta vez. */
const FOLGA_DO_RELOGIO_MS = 60_000
const DESFAZER_MS = 10_000
const ARMADO_MS = 8_000
const TOQUE_MS = 500
const CASO_CURTO = 120
const ORCA_CURTO = 280

type Secao = 'perguntas' | 'decisoes' | 'entregas' | 'sessoes'
type Esperado = 'aberta' | 'assumida'
/** O que a pessoa fez nesta visita, por pergunta: fica no lugar até ela reler ou sair da aba. */
type Feito =
  | { tipo: 'andando'; q: Pergunta; esperado: Esperado; texto: string; mostrar?: string; desde: number }
  | { tipo: 'feito'; q: Pergunta; esperado: Esperado; texto: string; mostrar?: string; entrega: EstadoDaEntrega; em: number }
  /** Gravada, sem o desfecho da entrega: a aba segue o arquivo até ele anotar. */
  | { tipo: 'incerto'; q: Pergunta; esperado: Esperado; texto: string; mostrar?: string; desde: number }
  | { tipo: 'erro'; q: Pergunta; esperado: Esperado; motivo: string }
  | { tipo: 'fora'; q: Pergunta; esperado: Esperado }
  | { tipo: 'confirmando'; q: Pergunta; esperado: 'assumida' }
  | { tipo: 'confirmada'; q: Pergunta; esperado: 'assumida'; versao: number; ate: number; lote: string | null; em: number }
type Lote = { texto: string; tom: 'success' | 'warning'; itens: { id: string; versao: number }[]; ate: number; erro?: string }
type Envio = { tipo: 'andando' } | { tipo: 'ok'; texto: string } | { tipo: 'erro'; texto: string }
/** A nova tentativa de entrega em voo guarda a anotação de antes: outra anotação no arquivo é o desfecho dela. */
type Reentrega = { tipo: 'andando' | 'incerto'; desde: number; antes: string | null } | EstadoDaEntrega

/** A aba sempre abre em Sessões; a escolha vale só enquanto o painel está aberto (sem `persist`). */
const secao = atom<Secao>('secao', 'sessoes')
const leitura = atom<Leitura | null>('leitura', null)
const lendo = atom('lendo', false)
const falha = atom<string | null>('falha', null)
const tique = atom('tique', 0)
const rascunhos = atom<Record<string, string>>('rascunhos', {})
const campos = atom<Record<string, boolean>>('campos', {})
const feitos = atom<Record<string, Feito>>('feitos', {})
const inteiros = atom<Record<string, boolean>>('inteiros', {})
const detalhes = atom<Record<string, boolean>>('detalhes', {})
const grupos = atom<Record<string, boolean>>('grupos', {})
const armado = atom<number | null>('armado', null)
const lotes = atom<Record<string, Lote>>('lotes', {})
const reentregas = atom<Record<string, Reentrega>>('reentregas', {})
const envios = atom<Record<string, Envio>>('envios', {})
// As entregas limpas moram no armazenamento do plugin, gravadas à mão: o átomo `persist: 'storage'` do Orca relê o
// armazenamento depois de cada gravação, e essa releitura, se chega depois de um "Desfazer" feito na janela de 400 ms
// da gravação seguinte, devolve o valor velho (medido no `orca plugin test`).
const lidas = atom<Record<string, number>>('lidas', {})
let lidasMexidas = false
async function carregarLidas() {
  lidasMexidas = false
  try {
    const v = await storage.get('lidas')
    if (!lidasMexidas && v && typeof v === 'object') set(lidas, v as Record<string, number>)
  } catch (e) {
    console.warn('[kit] não li as entregas limpas:', e)
  }
}
function gravarLidas(nova: Record<string, number>) {
  lidasMexidas = true
  set(lidas, nova)
  storage.set('lidas', nova).catch((e: unknown) => console.warn('[kit] não gravei as entregas limpas:', e))
}
const limpasAgora = atom<Record<string, number>>('limpasAgora', {})
const verLimpas = atom('verLimpas', false)
// Os cartões de sessão abertos, por item: sobrevivem à releitura e à troca de lugar; fecham ao sair da aba.
const sessoesAbertas = atom<Record<string, boolean>>('sessoesAbertas', {})
// "Arquivar concluídas" (F469): as sessões que passam nas condições do arquivar, lidas pelo worker, e o que a pessoa fez com elas.
type Arquivo =
  | { tipo: 'confirmando'; itens: Concluida[] }
  | { tipo: 'andando'; itens: Concluida[] }
  | { tipo: 'feito'; desfecho: DesfechoDoArquivar }
const concluidas = atom<ConcluidasLidas | null>('concluidas', null)
const arquivo = atom<Arquivo | null>('arquivo', null)

const sem = <T,>(o: Record<string, T>, k: string) => Object.fromEntries(Object.entries(o).filter(([c]) => c !== k)) as Record<string, T>
const tocar = (ms: number) => setTimeout(() => set(tique, relogio.agora()), ms + 50)

function motivoDe(e: unknown): string {
  console.warn('[kit] pedido ao worker falhou:', e)
  const codigo = (e as { code?: string } | null)?.code
  if (codigo === 'timeout') return 'o Orca demorou a responder'
  if (codigo === 'capability_denied') return 'falta uma permissão ao plugin'
  return 'o worker do plugin não respondeu'
}

// ── O desfecho pelo arquivo (F450) ───────────────────────────────────────────────────────────────────────────────
// A promessa do pedido que envia pode não voltar: o guest do painel trocado (recarga) leva o estado da aba, mas não a
// promessa, e o Orca desiste dela no prazo. O arquivo da pergunta é a verdade: cada releitura confere o que está em voo.
const passouDoPrazo = (desde: number, agora: number) => agora - desde > PRAZO_DO_ENVIO_MS + FOLGA_DO_DESFECHO_MS

type Seguida = Extract<Feito, { tipo: 'andando' | 'incerto' }>
/** O que a aba segue no arquivo: o que está em voo e o que ficou sem confirmação. */
const seguida = (x: Feito): x is Seguida => x.tipo === 'andando' || x.tipo === 'incerto'
// O cartão que veio de uma versão da aba sem `desde` (recarga no meio do envio) conta como antigo: decide já.
const desdeDe = (x: Seguida) => (Number.isFinite(x.desde) ? x.desde : 0)
/** O arquivo tem a resposta que este cartão mandou: gravada por esta aba, com o mesmo texto, nesta tentativa. */
const ehDesta = (x: Seguida, a: Acompanhada | null | undefined): a is Acompanhada =>
  a?.estado === 'respondida' && a.respondidaPor === ORIGEM && a.resposta === x.texto && ms(a.respondidaEm) >= desdeDe(x) - FOLGA_DO_RELOGIO_MS
const semDesfecho = (x: Seguida): Feito => ({ tipo: 'incerto', q: x.q, esperado: x.esperado, texto: x.texto, mostrar: x.mostrar, desde: desdeDe(x) })

/** O cartão em "Entregando…" ou sem confirmação segundo o arquivo; `null` deixa como está. */
function desfechoDoArquivo(x: Feito, a: Acompanhada | null | undefined, agora: number): Feito | null {
  if (!seguida(x)) return null
  if (ehDesta(x, a)) {
    // A anotação de uma resposta anterior (a pergunta reaberta guarda a velha) não é o desfecho desta.
    const e = a.entregaDaResposta
    if (e && ms(e.em) >= ms(a.respondidaEm)) return { tipo: 'feito', q: x.q, esperado: x.esperado, texto: x.texto, mostrar: x.mostrar, entrega: e, em: ms(a.respondidaEm) || desdeDe(x) }
    return x.tipo === 'andando' && passouDoPrazo(desdeDe(x), agora) ? semDesfecho(x) : null
  }
  // Sem confirmação já se sabe gravada: o arquivo sem ela (reaberta, regravada) não a desfaz.
  return x.tipo === 'andando' && passouDoPrazo(desdeDe(x), agora) ? { tipo: 'erro', q: x.q, esperado: x.esperado, motivo: SEM_RESPOSTA } : null
}

/** A reentrega em voo ou sem confirmação segundo a leitura: outra anotação é o desfecho; fora das pendentes, a entrega saiu. `null` apaga. */
function desfechoDaReentrega(r: Reentrega, p: Pendente | undefined, agora: number): Reentrega | null {
  if (!('tipo' in r)) return r
  if (!p) return null
  if ((p.entregaDaResposta?.em ?? null) !== r.antes) return p.entregaDaResposta
  return r.tipo === 'andando' && passouDoPrazo(r.desde, agora) ? { ...r, tipo: 'incerto' } : r
}

// ── Leitura ──────────────────────────────────────────────────────────────────────────────────────────────────────
async function reler(forcar: boolean) {
  set(lendo, true)
  try {
    const antes = read(leitura)
    // O que a aba mandou responder e ainda não viu voltar: o arquivo diz o desfecho, se a resposta do worker se perdeu.
    const acompanhar = Object.entries(read(feitos)).filter(([, x]) => seguida(x)).map(([id]) => id)
    const lida = await plugin.request('kit.ler', acompanhar.length ? { forcar, acompanhar } : { forcar })
    // Sessões não lidas: o trilho guarda as paradas da última leitura boa em vez de dizer zero.
    const l = lida.sessoes?.erro && antes?.sessoes ? { ...lida, sessoes: { ...lida.sessoes, paradas: antes.sessoes.paradas } } : lida
    set(leitura, l)
    const agora = relogio.agora()
    if (l.acompanhadas) {
      const a = l.acompanhadas
      update(feitos, (f) => Object.fromEntries(Object.entries(f).map(([id, x]) => [id, desfechoDoArquivo(x, a[id], agora) ?? x])))
    }
    update(reentregas, (x) => Object.fromEntries(Object.entries(x).flatMap(([id, r]) => {
      const d = desfechoDaReentrega(r, l.pendentes.find((p) => p.id === id), agora)
      return d ? [[id, d]] : []
    })))
    set(falha, null)
    void lerConcluidas(forcar)
    const ids = (x: Leitura | null) => (x?.assumidas ?? []).map((q) => `${q.id}:${q.versao}`).join()
    if (read(armado) !== null && ids(antes) !== ids(l)) set(armado, null)
    // Quem respondeu fora desta aba: a recusa pediu releitura e a pergunta não está mais na lista.
    update(feitos, (f) => Object.fromEntries(Object.entries(f).map(([id, x]) => {
      if (x.tipo !== 'erro') return [id, x]
      const lista = x.esperado === 'aberta' ? l.abertas : l.assumidas
      return [id, lista.some((q) => q.id === id) ? x : { tipo: 'fora', q: x.q, esperado: x.esperado }]
    })))
    const podadas = podarLidas(read(lidas), relogio.agora())
    if (Object.keys(podadas).length !== Object.keys(read(lidas)).length) gravarLidas(podadas)
  } catch (e) {
    set(falha, motivoDe(e))
  } finally {
    set(lendo, false)
  }
}

/** As concluídas aptas a arquivar (o worker as confere com git e gh e guarda 2 min); falhar só some o botão. */
async function lerConcluidas(forcar: boolean) {
  try {
    set(concluidas, await plugin.request('kit.concluidas', { forcar }, { timeoutMs: PRAZO_DO_ARQUIVAR_MS }))
  } catch (e) {
    console.warn('[kit] não li as concluídas:', e)
  }
}

/** Arquiva os itens confirmados: o efeito entra na hora (o botão dá lugar ao "Arquivando…") e a recusa aparece com o motivo. */
async function arquivar(itens: Concluida[]) {
  set(arquivo, { tipo: 'andando', itens })
  let desfecho: DesfechoDoArquivar
  try {
    desfecho = await plugin.request('kit.arquivar', { itens: itens.map((c) => c.item) }, { timeoutMs: PRAZO_DO_ARQUIVAR_MS })
  } catch (e) {
    desfecho = { arquivadas: [], recusadas: [], erro: motivoDe(e) }
  }
  set(arquivo, { tipo: 'feito', desfecho })
  await lerConcluidas(true)
}

/** O reler da pessoa: força a caixa do Orca e tira o que ela já resolveu nesta visita. */
async function relerAgora() {
  const andando = new Set(['andando', 'incerto', 'confirmando', 'erro'])
  update(feitos, (f) => Object.fromEntries(Object.entries(f).filter(([, x]) => andando.has(x.tipo))))
  set(lotes, {})
  set(limpasAgora, {})
  set(reentregas, {})
  set(envios, {})
  set(armado, null)
  if (read(arquivo)?.tipo === 'feito') set(arquivo, null)
  await reler(true)
}

export function setup(ctx: { subscriptions: { dispose(): void }[]; visible: unknown }) {
  void carregarLidas()
  void reler(false)
  ctx.subscriptions.push(plugin.on('kit.mudou', () => void reler(false)))
  const relogioDaAba = setInterval(() => {
    if (!read(ctx.visible as never)) return
    set(tique, relogio.agora())
    if (relogio.agora() - (read(leitura)?.lidoEm ?? 0) >= RELER_MS && !read(lendo)) void reler(false)
  }, 10_000)
  return () => clearInterval(relogioDaAba)
}

// ── Gestos ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function responder(q: Pergunta, esperado: Esperado, texto: string, mostrar?: string) {
  const resposta = texto.trim()
  if (!resposta) return
  set(armado, null)
  const desde = relogio.agora()
  update(feitos, (f) => ({ ...f, [q.id]: { tipo: 'andando', q, esperado, texto: resposta, mostrar, desde } }))
  // A resposta só vale se o cartão ainda espera por ela: a releitura pode já ter posto o desfecho que o arquivo tem.
  const esperando = () => { const x = read(feitos)[q.id]; return x?.tipo === 'andando' && x.desde === desde }
  let motivo: string
  try {
    const r = await plugin.request('kit.responder', { id: q.id, versao: q.versao, esperado, resposta }, { timeoutMs: PRAZO_DO_ENVIO_MS })
    if (!esperando()) return
    if (r.gravou) {
      update(feitos, (f) => ({ ...f, [q.id]: { tipo: 'feito', q, esperado, texto: resposta, mostrar, entrega: r.entrega, em: relogio.agora() } }))
      update(rascunhos, (x) => sem(x, `${esperado}:${q.id}`))
      update(campos, (x) => sem(x, `${esperado}:${q.id}`))
      return
    }
    motivo = r.codigo === 'mudou' || r.codigo === 'sumiu'
      ? 'Não gravou: a pergunta mudou depois que a aba a leu. Ela foi relida acima; confira antes de responder de novo.'
      : `Não gravou: ${r.motivo}. O que você escreveu continua no campo.`
    update(feitos, (f) => ({ ...f, [q.id]: { tipo: 'erro', q, esperado, motivo } }))
    if (r.codigo === 'mudou' || r.codigo === 'sumiu') await reler(false)
  } catch (e) {
    motivo = `Não gravou: ${motivoDe(e)}. O que você escreveu continua no campo.`
    // Sem resposta (o Orca desistiu no prazo) a gravação pode ter saído: o arquivo decide antes do erro.
    if (!esperando()) return
    await reler(false)
    const x = read(feitos)[q.id]
    if (x?.tipo !== 'andando' || x.desde !== desde) return
    // Gravada, mas a entrega ainda sem anotação: não é erro de gravação, é desfecho que a aba não soube.
    const gravada = ehDesta(x, read(leitura)?.acompanhadas?.[q.id])
    update(feitos, (f) => ({ ...f, [q.id]: gravada ? semDesfecho(x) : { tipo: 'erro', q, esperado, motivo } }))
  }
}

async function reentregar(p: Pendente) {
  const id = p.id
  const desde = relogio.agora()
  update(reentregas, (x) => ({ ...x, [id]: { tipo: 'andando', desde, antes: p.entregaDaResposta?.em ?? null } }))
  // Como no responder: a releitura pode já ter posto o desfecho que o arquivo anotou.
  const esperando = () => { const r = read(reentregas)[id]; return Boolean(r && 'tipo' in r && r.tipo === 'andando' && r.desde === desde) }
  try {
    const r = await plugin.request('kit.reentregar', { id }, { timeoutMs: PRAZO_DO_ENVIO_MS })
    if (esperando()) update(reentregas, (x) => ({ ...x, [id]: r }))
  } catch (e) {
    // Sem resposta no prazo, o worker pode ainda estar entregando: o arquivo diz o desfecho na próxima releitura.
    // A recusa na hora (permissão, worker fora) prova que nada saiu: diz o motivo.
    const semResposta = (e as { code?: string } | null)?.code === 'timeout'
    const motivo = motivoDe(e)
    if (esperando()) {
      update(reentregas, (x) => ({ ...x, [id]: semResposta
        ? { tipo: 'incerto', desde, antes: p.entregaDaResposta?.em ?? null }
        : { estado: 'falhou', via: 'orca', em: new Date().toISOString(), motivo } }))
    }
  }
}

/** Confirma decisões; `lote` é a chave do desfecho em lote (grupo ou todas), `null` para uma linha. */
async function confirmar(qs: Pergunta[], lote: string | null) {
  if (!qs.length) return
  set(armado, null)
  update(feitos, (f) => ({ ...f, ...Object.fromEntries(qs.map((q) => [q.id, { tipo: 'confirmando', q, esperado: 'assumida' }])) }))
  try {
    const r = await plugin.request('kit.confirmar', { itens: qs.map((q) => ({ id: q.id, versao: q.versao })) })
    const em = relogio.agora()
    const ate = em + DESFAZER_MS
    const porId = new Map(qs.map((q) => [q.id, q]))
    update(feitos, (f) => {
      const n = { ...f }
      for (const id of r.confirmadas) n[id] = { tipo: 'confirmada', q: porId.get(id)!, esperado: 'assumida', versao: r.versoes[id], ate, lote, em }
      for (const x of r.recusadas) n[x.id] = { tipo: 'erro', q: porId.get(x.id)!, esperado: 'assumida', motivo: `Não confirmou: ${x.motivo}.` }
      return n
    })
    if (lote) {
      const texto = r.recusadas.length
        ? `${r.confirmadas.length} confirmadas. ${r.recusadas.length} mudaram depois da leitura e continuam na lista.`
        : `${plural(r.confirmadas.length, 'decisão confirmada', 'decisões confirmadas')}.`
      update(lotes, (x) => ({ ...x, [lote]: { texto, tom: r.recusadas.length ? 'warning' : 'success', itens: r.confirmadas.map((id) => ({ id, versao: r.versoes[id] })), ate } }))
    }
    update(detalhes, (d) => ({ ...d, ...Object.fromEntries(r.confirmadas.filter((id) => read(inteiros)[id]).map((id) => [id, true])) }))
    tocar(DESFAZER_MS)
    if (r.recusadas.length) await reler(false)
  } catch (e) {
    const motivo = `Não confirmou: ${motivoDe(e)}.`
    update(feitos, (f) => ({ ...f, ...Object.fromEntries(qs.map((q) => [q.id, { tipo: 'erro', q, esperado: 'assumida', motivo }])) }))
  }
}

async function desfazerConfirmacao(itens: { id: string; versao: number }[], lote: string | null) {
  try {
    const r = await plugin.request('kit.desfazer', { itens })
    update(feitos, (f) => {
      const n = { ...f }
      for (const id of r.desfeitas) delete n[id]
      for (const x of r.recusadas) { const q = f[x.id]?.q; if (q) n[x.id] = { tipo: 'erro', q, esperado: 'assumida', motivo: `Não desfez: ${x.motivo}.` } }
      return n
    })
    if (lote) update(lotes, (x) => sem(x, lote))
  } catch (e) {
    if (lote) update(lotes, (x) => ({ ...x, [lote]: { ...x[lote], erro: `Não desfez: ${motivoDe(e)}.` } }))
  }
  await reler(false)
}

function limparEntregas(es: Entrega[]) {
  const chaves = es.flatMap((e) => e.chaves)
  gravarLidas(limparLidas(read(lidas), chaves, relogio.agora()))
  update(limpasAgora, (x) => ({ ...x, ...Object.fromEntries(es.map((e) => [e.chave, relogio.agora() + DESFAZER_MS])) }))
  tocar(DESFAZER_MS)
}
function trazerDeVolta(es: Entrega[]) {
  gravarLidas(desfazerLidas(read(lidas), es.flatMap((e) => e.chaves)))
  update(limpasAgora, (x) => { let n = x; for (const e of es) n = sem(n, e.chave); return n })
}

async function enviarSeguimento(e: Entrega, texto: string) {
  const s = e.seguimento
  if (!s || !texto.trim()) return
  const para = s.quem === 'sessao' ? `a ${e.item ?? 'sessão'}` : 'à orquestradora'
  update(envios, (x) => ({ ...x, [e.chave]: { tipo: 'andando' } }))
  try {
    const r = await plugin.request('kit.seguimento', { destino: s.destino, titulo: e.titulo, texto: texto.trim() }, { timeoutMs: PRAZO_DO_ENVIO_MS })
    if (r.ok) {
      update(envios, (x) => ({ ...x, [e.chave]: { tipo: 'ok', texto: `Enviado ${para}.` } }))
      update(rascunhos, (x) => sem(x, `e:${e.chave}`))
      update(campos, (x) => sem(x, `e:${e.chave}`))
    } else {
      update(envios, (x) => ({ ...x, [e.chave]: { tipo: 'erro', texto: `Não chegou: ${r.motivo ?? 'sem motivo'}. O que você escreveu continua no campo.` } }))
    }
  } catch (err) {
    update(envios, (x) => ({ ...x, [e.chave]: { tipo: 'erro', texto: `Não chegou: ${motivoDe(err)}. O que você escreveu continua no campo.` } }))
  }
}

// ── Contas da tela ───────────────────────────────────────────────────────────────────────────────────────────────
const ocupada = (id: string) => { const f = read(feitos)[id]; return Boolean(f && f.tipo !== 'erro') }
const abertasAtivas = (l: Leitura) => l.abertas.filter((q) => !ocupada(q.id)).length
const assumidasAtivas = (l: Leitura) => l.assumidas.filter((q) => !ocupada(q.id)).length

/** A lista da leitura mais o que a pessoa fez nesta visita e saiu dela, na ordem dada. */
function comFeitos(lista: Pergunta[], esperado: Esperado): Pergunta[] {
  const ids = new Set(lista.map((q) => q.id))
  const extras = Object.values(read(feitos)).filter((f) => f.esperado === esperado && !ids.has(f.q.id)).map((f) => f.q)
  return [...lista, ...extras]
}

function entregasVisiveis(l: Leitura) {
  const agoraLimpas = read(limpasAgora)
  const { visiveis, limpas } = separarLidas(l.entregas, read(lidas)) as { visiveis: Entrega[]; limpas: Entrega[] }
  const ficam = limpas.filter((e) => e.chave in agoraLimpas)
  const lista = [...visiveis, ...ficam].sort((a, b) => b.em.localeCompare(a.em))
  return { lista, limpas: limpas.filter((e) => !(e.chave in agoraLimpas)), novas: visiveis.length }
}

const destinoDaPergunta = (q: Pergunta) => q.endereco
  ? `Vai para ${nomeDoDestino(q)} · acorda a sessão`
  : SEM_ENDERECO

function Campo(props: { chave: string; rotulo: string; linhas: number; enviar: string; destino: string; aoEnviar: (texto: string) => void }) {
  const texto = read(rascunhos)[props.chave] ?? ''
  const fechar = () => update(campos, (x) => sem(x, props.chave))
  return (
    <Box gap="sm">
      <Textarea
        label={props.rotulo} rows={props.linhas} value={texto}
        onChange={(v: string) => update(rascunhos, (x) => ({ ...x, [props.chave]: v }))}
        onSubmit={(v: string) => props.aoEnviar(v)}
      />
      <Row gap="sm" wrap>
        <Button variant="solid" tone="accent" disabled={!texto.trim()} onPress={() => props.aoEnviar(texto)}>{props.enviar}</Button>
        <Button variant="ghost" onPress={fechar}>Cancelar</Button>
      </Row>
      <Text size="xs" muted>{props.destino}</Text>
    </Box>
  )
}

// ── Peças comuns dos cartões ─────────────────────────────────────────────────────────────────────────────────────
/** A primeira linha de todo cartão: o projeto (e o item) à esquerda, o estado do cartão na ponta. */
function Cabeca(props: { projeto: string | null; item: string | null; estado?: unknown }) {
  if (!props.estado && !partesDoSelo(props.projeto, props.item)) return null
  return (
    <Row justify="between" align="center" gap="sm" wrap>
      <SeloDoProjeto projeto={props.projeto} item={props.item} />
      {props.estado ?? null}
    </Row>
  )
}

/** Abre e fecha os detalhes de um compacto no lugar (o `Collapsible` não cabe dentro da dobra do grupo). */
function BotaoDeDetalhes(props: { id: string; titulo: string }) {
  const aberto = Boolean(read(detalhes)[props.id])
  return (
    <IconButton
      variant="ghost" size="sm" icon={aberto ? 'collapse' : 'expand'} label={`${aberto ? 'Esconder' : 'Ver'} detalhes: ${props.titulo}`}
      tooltip={aberto ? 'Esconder detalhes' : 'Ver detalhes'}
      onPress={() => update(detalhes, (d) => ({ ...d, [props.id]: !aberto }))}
    />
  )
}


// ── Perguntas ────────────────────────────────────────────────────────────────────────────────────────────────────
function CartaoDaPergunta(props: { q: Pergunta }) {
  const l = read(leitura)
  const q = l?.abertas.find((x) => x.id === props.q.id) ?? props.q
  const f = read(feitos)[q.id]
  const agora = read(tique) || relogio.agora()
  if (f?.tipo === 'feito') return <Compacto q={q} texto={f.mostrar ?? `Você respondeu: ${f.texto}`} entrega={f.entrega} em={f.em} />
  if (f?.tipo === 'incerto') return <Compacto q={q} texto={f.mostrar ?? `Você respondeu: ${f.texto}`} incerto em={f.desde || undefined} />
  if (f?.tipo === 'fora') return <Compacto q={q} nota="Já foi respondida fora desta aba." />
  const chave = `aberta:${q.id}`
  const aberto = read(campos)[chave]
  const item = itemDe(q)
  // Com opções, um botão por opção (a recomendada primeiro); `outra` só libera o campo livre, como no pane do app.
  const botoes = (q.opcoes ?? []).filter((o) => o.id !== 'outra')
  const livre = !q.opcoes || q.opcoes.some((o) => o.id === 'outra')
  return (
    <Box key={`q-${q.id}`} background="card" border="warning" radius="lg" padding="md" gap="sm">
      <Cabeca projeto={q.projeto} item={item} estado={<Badge tone="warning">{`espera ${haQuanto(ms(q.atualizadoEm), agora)}`}</Badge>} />
      <Text size="sm" weight="semibold">{semPrefixoDoItem(q.titulo, item)}</Text>
      <Text size="xs" muted>{q.id}</Text>
      {q.caso ? <Text size="sm">{q.caso}</Text> : null}
      {q.seNaoDecidir ? <Text size="sm" muted>{`Se ninguém decidir: ${q.seNaoDecidir}`}</Text> : null}
      {q.recomendacao ? <Recomendacao texto={q.recomendacao} /> : null}
      {f?.tipo === 'andando' ? (
        <Spinner label={q.endereco ? `Entregando a ${nomeDoDestino(q)}…` : 'Gravando…'} />
      ) : aberto ? (
        <Campo chave={chave} rotulo="Sua resposta" linhas={4} enviar={q.endereco ? 'Enviar resposta' : 'Gravar resposta'} destino={destinoDaPergunta(q)} aoEnviar={(t) => void responder(q, 'aberta', t)} />
      ) : (
        <Box gap="sm">
          <Row gap="sm" wrap>
            {botoes.map((o, i) => (
              <Button key={`op-${q.id}-${o.id}`} variant={i === 0 ? 'solid' : 'outline'} tone={i === 0 ? 'accent' : undefined} onPress={() => void responder(q, 'aberta', o.id, `Você escolheu: ${o.label}`)}>{o.label}</Button>
            ))}
            {!q.opcoes && q.recomendacao ? <Button key={`aceitar-${q.id}`} variant="solid" tone="accent" onPress={() => void responder(q, 'aberta', SIM, 'Você aceitou a recomendação.')}>Aceitar a recomendação</Button> : null}
            {livre ? <Button key={`outra-${q.id}`} variant="ghost" icon="edit" onPress={() => update(campos, (x) => ({ ...x, [chave]: true }))}>Responder outra coisa…</Button> : null}
          </Row>
          <Text size="xs" muted>{destinoDaPergunta(q)}</Text>
        </Box>
      )}
      {f?.tipo === 'erro' ? <Text size="xs" tone="danger">{f.motivo}</Text> : null}
    </Box>
  )
}

function Recomendacao(props: { texto: string }) {
  return (
    <Box background="muted" border="accent" radius="md" padding="sm" gap="xs">
      <Text size="xs" weight="semibold" tone="accent">Recomendação</Text>
      <Text size="sm">{props.texto}</Text>
    </Box>
  )
}

/** O selo de estado da entrega, na ponta do cartão. `incerto`: gravada, sem o desfecho da entrega. */
function SeloDaEntrega(props: { q: Pick<Pergunta, 'item' | 'titulo'>; entrega?: EstadoDaEntrega; incerto?: boolean }) {
  const e = props.entrega
  if (props.incerto) return <Badge tone="neutral">Sem confirmação</Badge>
  if (!e) return null
  if (e.estado === 'entregue') return <Badge tone="success">{`Entregue a ${nomeDoDestino(props.q)}`}</Badge>
  if (e.estado === 'pendente') return <Badge tone="neutral">Só gravada</Badge>
  return <Badge tone="danger">A entrega falhou</Badge>
}

/** A linha que explica o selo, quando ele precisa de explicação. */
function LinhaDaEntrega(props: { q: Pick<Pergunta, 'item' | 'titulo' | 'sessaoId'>; entrega?: EstadoDaEntrega; incerto?: boolean }) {
  const e = props.entrega
  const para = nomeDoDestino(props.q)
  if (props.incerto) return <Text size="xs" muted>{`Gravada. A aba não soube se chegou a ${para}; confira na sessão.`}</Text>
  if (e?.estado === 'pendente') return <Text size="xs" muted>{semEndereco(props.q)}</Text>
  if (e?.estado === 'falhou') return <Text size="xs" tone="danger">{`Gravada, mas não chegou a ${para}: ${e.motivo ?? 'sem motivo'}.`}</Text>
  return null
}

/** O cartão de uma pergunta já respondida: compacto, com o selo de estado na ponta e os detalhes a um toque. */
function Compacto(props: { q: Pergunta; texto?: string; nota?: string; entrega?: EstadoDaEntrega; incerto?: boolean; em?: number; children?: unknown }) {
  const { q } = props
  // Sem confirmação vale mais que a anotação de antes: o selo é o do que a aba ainda não sabe.
  const e = props.incerto ? undefined : props.entrega
  const agora = read(tique) || relogio.agora()
  const item = itemDe(q)
  const titulo = semPrefixoDoItem(q.titulo, item)
  const aberto = Boolean(read(detalhes)[q.id])
  const perguntada = ms(q.atualizadoEm)
  return (
    <Box key={`q-${q.id}`} background="card" border={true} radius="lg" padding="md" gap="xs">
      <Cabeca projeto={q.projeto} item={item} estado={e || props.incerto ? <SeloDaEntrega q={q} entrega={e} incerto={props.incerto} /> : null} />
      <Text size="sm" weight="semibold">{titulo}</Text>
      {props.texto ? <Text size="sm">{props.texto}</Text> : null}
      {props.nota ? <Text size="sm" muted>{props.nota}</Text> : null}
      <LinhaDaEntrega q={q} entrega={e} incerto={props.incerto} />
      {props.children ?? null}
      <Row justify="between" align="center" gap="sm">
        <Text size="xs" muted>{[props.em ? horaSP(props.em) : null, q.id].filter(Boolean).join(' · ')}</Text>
        <BotaoDeDetalhes id={q.id} titulo={titulo} />
      </Row>
      {aberto ? (
        <Box gap="xs">
          {q.caso ? <Text size="sm">{q.caso}</Text> : null}
          {q.seNaoDecidir ? <Text size="sm" muted>{`Se ninguém decidir: ${q.seNaoDecidir}`}</Text> : null}
          {q.recomendacao ? <Recomendacao texto={q.recomendacao} /> : null}
          {perguntada ? <Text size="xs" muted>{`Perguntada pela ${item ? `sessão do ${item}` : 'sessão'} · ${quando(perguntada, agora)}`}</Text> : null}
        </Box>
      ) : null}
    </Box>
  )
}

function CartaoPendente(props: { p: Pendente }) {
  const p = props.p
  const r = read(reentregas)[p.id]
  const emVoo = Boolean(r && 'tipo' in r && r.tipo === 'andando')
  const incerto = Boolean(r && 'tipo' in r && r.tipo === 'incerto')
  const entrega = r && !('tipo' in r) ? r : p.entregaDaResposta
  return (
    <Compacto q={p} texto={`Você respondeu: ${p.resposta}`} entrega={entrega} incerto={incerto} em={ms(entrega.em) || undefined}>
      {emVoo ? <Spinner label={`Entregando a ${nomeDoDestino(p)}…`} />
        : (incerto || entrega.estado !== 'entregue') && p.endereco ? <Row><Button variant="outline" onPress={() => void reentregar(p)}>Tentar entregar de novo</Button></Row> : null}
    </Compacto>
  )
}

function Perguntas(props: { l: Leitura }) {
  const antigasPrimeiro = [...props.l.abertas].sort((a, b) => ms(a.atualizadoEm) - ms(b.atualizadoEm))
  const lista = comFeitos(antigasPrimeiro, 'aberta')
  const falhas = props.l.pendentes.filter((p) => p.entregaDaResposta?.estado === 'falhou')
  const semEndereco = props.l.pendentes.filter((p) => p.entregaDaResposta?.estado !== 'falhou')
  return (
    <Box gap="md">
      {lista.length ? lista.map((q) => <CartaoDaPergunta key={q.id} q={q} />) : <EmptyState title="Nenhuma pergunta esperando você" icon="check" />}
      {falhas.map((p) => <CartaoPendente key={p.id} p={p} />)}
      {semEndereco.length ? (
        <Collapsible title={`Respondidas, entrega pendente · ${semEndereco.length}`}>
          <Box gap="sm">{semEndereco.map((p) => <CartaoPendente key={p.id} p={p} />)}</Box>
        </Collapsible>
      ) : null}
    </Box>
  )
}

// ── Decisões ─────────────────────────────────────────────────────────────────────────────────────────────────────
function LinhaDaDecisao(props: { q: Pergunta }) {
  const l = read(leitura)
  const q = l?.assumidas.find((x) => x.id === props.q.id) ?? props.q
  const f = read(feitos)[q.id]
  const agora = read(tique) || relogio.agora()
  const item = itemDe(q)
  const titulo = semPrefixoDoItem(q.titulo, item)
  const caixa = (filhos: unknown, borda: unknown = true) => <Box key={`d-${q.id}`} border={borda} radius="md" padding="sm" gap="xs">{filhos}</Box>
  const decidiu = q.recomendacao ?? q.caso ?? ''
  const perguntada = ms(q.atualizadoEm)
  const quem = `Decidida pela ${item ? `sessão do ${item}` : 'sessão'}`
  const aberto = Boolean(read(detalhes)[q.id])
  if (f?.tipo === 'confirmada' || f?.tipo === 'feito' || f?.tipo === 'incerto') {
    const confirmada = f.tipo === 'confirmada'
    const incerto = f.tipo === 'incerto'
    const entrega = f.tipo === 'feito' ? f.entrega : undefined
    const em = f.tipo === 'incerto' ? f.desde : f.em
    const como = confirmada ? (f.lote === 'todas' ? ', com todas' : f.lote ? ', com o grupo' : '') : ''
    return caixa(
      <Box gap="xs">
        <Text size="sm" tone={confirmada ? 'success' : undefined}>{confirmada ? `Confirmada: ${titulo}` : `Você mudou: ${f.texto}`}</Text>
        {confirmada ? null : <Row><SeloDaEntrega q={q} entrega={entrega} incerto={incerto} /></Row>}
        {confirmada ? null : <LinhaDaEntrega q={q} entrega={entrega} incerto={incerto} />}
        <Row justify="end" align="center" gap="xs">
          {confirmada && !f.lote && agora < f.ate ? <Button variant="ghost" size="sm" onPress={() => void desfazerConfirmacao([{ id: q.id, versao: f.versao }], null)}>Desfazer</Button> : null}
          <BotaoDeDetalhes id={q.id} titulo={titulo} />
        </Row>
        {aberto ? (
          <Box gap="xs">
            {decidiu ? <Text size="xs">{`Decidiu: ${decidiu}`}</Text> : null}
            {q.caso && q.caso !== decidiu ? <Text size="xs" muted>{q.caso}</Text> : null}
            {q.seNaoDecidir ? <Text size="xs" muted>{`Se ninguém decidir: ${q.seNaoDecidir}`}</Text> : null}
            {perguntada ? <Text size="xs" muted>{`${quem} · ${quando(perguntada, agora)} · ${q.id}`}</Text> : null}
            <Text size="xs" muted>{`${confirmada ? 'Confirmada' : 'Mudada'} por você às ${horaSP(em)}${como}.`}</Text>
          </Box>
        ) : null}
      </Box>,
    )
  }
  if (f?.tipo === 'confirmando') return caixa(<Spinner label={`Gravando: ${titulo}`} />)
  if (f?.tipo === 'fora') {
    return caixa(
      <Box gap="xs">
        <Text size="sm" muted>{`${titulo}: já foi respondida fora desta aba.`}</Text>
        <Row justify="end" align="center"><BotaoDeDetalhes id={q.id} titulo={titulo} /></Row>
        {aberto ? (
          <Box gap="xs">
            {decidiu ? <Text size="xs">{`Decidiu: ${decidiu}`}</Text> : null}
            {q.caso && q.caso !== decidiu ? <Text size="xs" muted>{q.caso}</Text> : null}
            {q.seNaoDecidir ? <Text size="xs" muted>{`Se ninguém decidir: ${q.seNaoDecidir}`}</Text> : null}
            {perguntada ? <Text size="xs" muted>{`${quem} · ${quando(perguntada, agora)} · ${q.id}`}</Text> : null}
          </Box>
        ) : null}
      </Box>,
    )
  }
  const chave = `assumida:${q.id}`
  const { curto, cortou } = cortar(decidiu, CASO_CURTO)
  const inteiro = read(inteiros)[q.id]
  return caixa(
    <Box gap="xs">
      <Text size="sm" weight="semibold">{titulo}</Text>
      {decidiu ? <Text size="xs">{`Decidiu: ${inteiro ? decidiu : curto}`}</Text> : null}
      {inteiro && q.caso && q.caso !== decidiu ? <Text size="xs" muted>{q.caso}</Text> : null}
      <Row justify="between" align="center" gap="sm">
        <Text size="xs" muted>{`${q.id} · ${haQuanto(perguntada, agora)}`}</Text>
        {f?.tipo === 'andando' ? <Spinner label={q.endereco ? `Entregando a ${nomeDoDestino(q)}…` : 'Gravando…'} labelHidden /> : (
          <Row gap="xs">
            {cortou ? <IconButton variant="ghost" size="sm" icon={inteiro ? 'collapse' : 'expand'} label={inteiro ? 'Encolher' : 'Ler inteiro'} onPress={() => update(inteiros, (x) => ({ ...x, [q.id]: !inteiro }))} /> : null}
            <IconButton variant="ghost" size="sm" icon="edit" label="Discordar…" onPress={() => update(campos, (x) => ({ ...x, [chave]: true }))} />
            <IconButton variant="ghost" size="sm" icon="check" label={`Confirmar: ${titulo}`} tooltip="Só grava. Nenhuma sessão é acordada." onPress={() => void confirmar([q], null)} />
          </Row>
        )}
      </Row>
      {read(campos)[chave] && f?.tipo !== 'andando' ? (
        <Campo chave={chave} rotulo="O que deve mudar" linhas={3} enviar={q.endereco ? 'Enviar mudança' : 'Gravar mudança'} destino={destinoDaPergunta(q)} aoEnviar={(t) => void responder(q, 'assumida', t)} />
      ) : null}
      {f?.tipo === 'erro' ? <Text size="xs" tone="danger">{f.motivo}</Text> : null}
    </Box>,
    f?.tipo === 'erro' ? 'danger' : true,
  )
}

function DesfechoDoLote(props: { chave: string; lote: Lote }) {
  const agora = read(tique) || relogio.agora()
  const { lote } = props
  return (
    <Box gap="xs">
      <Row gap="sm" align="center" wrap>
        <Text size="sm" tone={lote.tom}>{lote.texto}</Text>
        {agora < lote.ate && lote.itens.length ? <Button variant="ghost" size="sm" onPress={() => void desfazerConfirmacao(lote.itens, props.chave)}>Desfazer</Button> : null}
      </Row>
      {lote.erro ? <Text size="xs" tone="danger">{lote.erro}</Text> : null}
    </Box>
  )
}

function ConfirmarTodas(props: { pendentes: Pergunta[] }) {
  const n = props.pendentes.length
  const projetos = new Set(props.pendentes.map((q) => q.projeto ?? '—')).size
  const armadoEm = read(armado)
  const lote = read(lotes).todas
  if (lote) return <DesfechoDoLote chave="todas" lote={lote} />
  if (!n) return null
  if (props.pendentes.some((q) => read(feitos)[q.id]?.tipo === 'confirmando')) return <Spinner label={`Confirmando ${n}…`} />
  if (armadoEm === null) {
    return (
      <Row>
        <Button variant="ghost" tooltip="Só grava. Nenhuma sessão é acordada." onPress={() => { set(armado, relogio.agora()); tocar(ARMADO_MS) }}>{`Confirmar todas (${n})`}</Button>
      </Row>
    )
  }
  const agora = read(tique) || relogio.agora()
  if (agora - armadoEm > ARMADO_MS && relogio.agora() - armadoEm > ARMADO_MS) { setTimeout(() => set(armado, null), 0); return null }
  return (
    <Box gap="xs">
      <Row gap="sm" wrap>
        <Button variant="ghost" onPress={() => set(armado, null)}>Cancelar</Button>
        <Button variant="solid" tone="accent" onPress={() => { if (relogio.agora() - armadoEm >= TOQUE_MS) void confirmar(props.pendentes, 'todas') }}>{n === 1 ? 'Confirmar agora' : `Confirmar as ${n} agora`}</Button>
      </Row>
      <Text size="xs" muted>{projetos > 1 ? `Inclui as que você não abriu, de ${projetos} projetos.` : 'Inclui as que você não abriu.'}</Text>
    </Box>
  )
}

/** "Confirmar as 12 do F435"; com uma só, "Confirmar a decisão do F435". */
const confirmarGrupo = (n: number, item: string | null) => {
  const onde = item ? `do ${item}` : 'sem item'
  return n === 1 ? `Confirmar a decisão ${onde}` : `Confirmar as ${n} ${onde}`
}

function Decisoes(props: { l: Leitura }) {
  const lista = comFeitos(props.l.assumidas, 'assumida')
  if (!lista.length) return <EmptyState title="Nenhuma decisão para confirmar" description="Quando uma sessão decidir algo sozinha e seguir, aparece aqui." icon="check" />
  const gs = porItem(lista)
  const abertos = read(grupos)
  const agora = read(tique) || relogio.agora()
  const livres = (qs: Pergunta[]) => qs.filter((q) => !read(feitos)[q.id] || read(feitos)[q.id].tipo === 'erro')
  // Blocos por projeto (o da decisão mais recente primeiro); dentro, um grupo por item.
  const blocos: { projeto: string | null; grupos: typeof gs; total: number }[] = []
  for (const g of gs) {
    const b = blocos.find((x) => x.projeto === (g.projeto ?? null))
    const aConfirmar = livres(g.itens).length
    if (b) { b.grupos.push(g); b.total += aConfirmar } else blocos.push({ projeto: g.projeto ?? null, grupos: [g], total: aConfirmar })
  }
  blocos.sort((a, b) => Number(a.projeto === null) - Number(b.projeto === null))
  return (
    <Box gap="md">
      {blocos.map((bl, bi) => (
        <Box key={`p-${bl.projeto ?? '—'}`} gap="sm">
          <Heading level={3}>{`${bl.projeto ? cortar(bl.projeto, 28).curto : 'Sem projeto'} · ${bl.total}`}</Heading>
          {bl.grupos.map((g, i) => {
            const pendentes = livres(g.itens)
            const titulo = g.item ?? 'Sem item'
            const descricao = [plural(g.itens.length, 'decisão', 'decisões'), haQuanto(g.ultimaMs, agora)].join(' · ')
            const lote = read(lotes)[`grupo:${g.chave}`]
            return (
              <Collapsible key={g.chave} title={cortar(titulo, 26).curto} description={descricao} open={abertos[g.chave] ?? (bi === 0 && i === 0)} onChange={(v: boolean) => update(grupos, (x) => ({ ...x, [g.chave]: v }))}>
                <Box gap="sm">
                  <Box gap="xs">{g.itens.map((q) => <LinhaDaDecisao key={q.id} q={q} />)}</Box>
                  {lote ? <DesfechoDoLote chave={`grupo:${g.chave}`} lote={lote} />
                    : pendentes.length ? (
                      <Row>
                        <Button variant="solid" tone="neutral" tooltip="Só grava. Nenhuma sessão é acordada." onPress={() => void confirmar(pendentes, `grupo:${g.chave}`)}>
                          {confirmarGrupo(pendentes.length, g.item ?? null)}
                        </Button>
                      </Row>
                    ) : null}
                </Box>
              </Collapsible>
            )
          })}
        </Box>
      ))}
      <ConfirmarTodas pendentes={livres(props.l.assumidas)} />
    </Box>
  )
}

// ── Entregas ─────────────────────────────────────────────────────────────────────────────────────────────────────
function CartaoDaEntrega(props: { e: Entrega }) {
  const e = props.e
  const agora = read(tique) || relogio.agora()
  const limpaAte = read(limpasAgora)[e.chave]
  if (limpaAte !== undefined) {
    return (
      <Box key={`e-${e.chave}`} background="card" border radius="lg" padding="md">
        <Row justify="between" align="center" gap="sm">
          <Box gap="xs" shrink>
            <SeloDoProjeto projeto={e.projeto} item={itemDe(e)} />
            <Text size="sm" muted>{`Limpa: ${semPrefixoDoItem(e.titulo, itemDe(e))}`}</Text>
          </Box>
          {agora < limpaAte ? <Button variant="ghost" size="sm" onPress={() => trazerDeVolta([e])}>Desfazer</Button> : null}
        </Row>
      </Box>
    )
  }
  const corpo = e.corpo ?? e.orca?.corpo ?? null
  const resultado = e.entrega?.resultado ?? (corpo ? cortar(corpo, ORCA_CURTO).curto : e.resultado ?? null)
  const meta = [horaSP(ms(e.em)), ...(e.prs ?? []).map((n) => `PR ${n}`), e.sessao].filter(Boolean).join(' · ')
  const maisDetalhes = [e.entrega?.medido ? `Medido: ${e.entrega.medido}` : null, e.entrega?.proximos ? `Próximos: ${e.entrega.proximos}` : null].filter(Boolean) as string[]
  const mensagemInteira = corpo && (e.entrega?.resultado || cortar(corpo, ORCA_CURTO).cortou) ? corpo : null
  const s = e.seguimento
  const chave = `e:${e.chave}`
  const envio = read(envios)[e.chave]
  const para = s?.quem === 'sessao' ? (e.item ?? 'a sessão') : 'a orquestradora'
  const destino = s?.quem === 'sessao'
    ? `Vai para ${e.item ?? 'a sessão'} · acorda a sessão`
    : e.item ? `A sessão do ${e.item} já fechou: vai para a orquestradora · acorda a orquestradora` : 'Vai para a orquestradora · acorda a orquestradora'
  return (
    <Box key={`e-${e.chave}`} background="card" border radius="lg" padding="md" gap="sm">
      <Cabeca projeto={e.projeto} item={itemDe(e)} />
      <Text size="sm" weight="semibold">{semPrefixoDoItem(e.titulo, itemDe(e))}</Text>
      <Text size="xs" muted>{meta}</Text>
      {resultado ? <Text size="sm">{resultado}</Text> : null}
      {e.entrega?.naoMedido ? (
        <Box border="warning" radius="md" padding="sm" gap="xs">
          <Text size="xs" weight="semibold" tone="warning">Não medido</Text>
          <Text size="sm">{e.entrega.naoMedido}</Text>
        </Box>
      ) : null}
      {maisDetalhes.length || mensagemInteira ? (
        <Collapsible title="Detalhes">
          <Box gap="xs">
            {maisDetalhes.map((d) => <Text key={d} size="sm">{d}</Text>)}
            {mensagemInteira ? <Text size="xs" muted>Mensagem do Orca</Text> : null}
            {mensagemInteira ? <Text size="sm">{mensagemInteira}</Text> : null}
          </Box>
        </Collapsible>
      ) : null}
      {read(campos)[chave] && s ? (
        envio?.tipo === 'andando' ? <Spinner label={`Enviando ${s.quem === 'sessao' ? `a ${para}` : 'à orquestradora'}…`} />
          : <Campo chave={chave} rotulo="O que você quer saber ou pedir" linhas={3} enviar={s.quem === 'sessao' ? `Enviar a ${para}` : 'Enviar à orquestradora'} destino={destino} aoEnviar={(t) => void enviarSeguimento(e, t)} />
      ) : (
        <Row gap="sm" wrap>
          <Button key={`limpar-${e.chave}`} variant="ghost" onPress={() => limparEntregas([e])}>Limpar</Button>
          {s ? <Button key={`responder-${e.chave}`} variant="ghost" onPress={() => { update(campos, (x) => ({ ...x, [chave]: true })); update(envios, (x) => sem(x, e.chave)) }}>Responder…</Button> : null}
        </Row>
      )}
      {envio?.tipo === 'ok' ? <Text size="xs" tone="success">{envio.texto}</Text> : null}
      {envio?.tipo === 'erro' ? <Text size="xs" tone="danger">{envio.texto}</Text> : null}
    </Box>
  )
}

function Entregas(props: { l: Leitura }) {
  const agora = read(tique) || relogio.agora()
  const { lista, limpas } = entregasVisiveis(props.l)
  const novas = lista.filter((e) => !(e.chave in read(limpasAgora)))
  const ver = read(verLimpas)
  const lote = read(lotes).limparTodas
  return (
    <Box gap="md">
      {props.l.erroDaCaixa ? (
        <Callout tone="warning">
          <Box gap="sm">
            <Text size="sm">{`Faltam as entregas do Orca: ${props.l.erroDaCaixa}. As do app estão abaixo.`}</Text>
            <Row><Button variant="outline" size="sm" onPress={() => void reler(true)}>Tentar de novo</Button></Row>
          </Box>
        </Callout>
      ) : null}
      {props.l.caixaAte ? <Text size="xs" muted>{`As entregas do Orca vão só até ${nomeDoDia(ms(props.l.caixaAte), agora)}, ${horaSP(ms(props.l.caixaAte))}: a caixa dele guarda as mensagens mais novas.`}</Text> : null}
      <Row justify="between" align="center" gap="sm" wrap>
        <Text size="xs" muted>Últimos 7 dias. Limpar não apaga.</Text>
        {novas.length ? <Button variant="outline" size="sm" tooltip="Somem desta lista. Nada é apagado." onPress={() => limparEntregas(novas)}>{`Limpar todas (${novas.length})`}</Button> : null}
      </Row>
      {lote ? <Text size="sm">{lote.texto}</Text> : null}
      {!props.l.entregas.length ? <EmptyState title="Nenhuma entrega nos últimos 7 dias" icon="package" /> : null}
      {props.l.entregas.length && !lista.length ? <EmptyState title="Nada novo para ver" icon="check" /> : null}
      {porDia(lista, agora).map((g) => (
        <Box key={g.chave} gap="sm">
          <Heading level={3}>{`${g.titulo} · ${g.itens.length}`}</Heading>
          {g.itens.map((e) => <CartaoDaEntrega key={e.chave} e={e} />)}
        </Box>
      ))}
      {limpas.length ? (
        <Box gap="sm">
          <Row><Button variant="ghost" onPress={() => set(verLimpas, !ver)}>{ver ? 'Esconder as limpas' : `Ver as limpas (${limpas.length})`}</Button></Row>
          {ver ? limpas.map((e) => (
            <Box key={`l-${e.chave}`} border radius="md" padding="sm">
              <Row justify="between" align="center" gap="sm">
                <Box gap="xs" shrink>
                  <SeloDoProjeto projeto={e.projeto} item={itemDe(e)} />
                  <Text size="sm">{semPrefixoDoItem(e.titulo, itemDe(e))}</Text>
                  <Text size="xs" muted>{`${nomeDoDia(ms(e.em), agora)} · ${horaSP(ms(e.em))}`}</Text>
                </Box>
                <Button variant="ghost" size="sm" onPress={() => trazerDeVolta([e])}>Trazer de volta</Button>
              </Row>
            </Box>
          )) : null}
        </Box>
      ) : null}
    </Box>
  )
}

// ── Sessões ──────────────────────────────────────────────────────────────────────────────────────────────────────
// A conta (estado, ordem, bolinhas) vem pronta do worker; aqui só o selo, a frase e o tempo de cada cartão.
// O aviso só sai depois de uma batida perdida: a batida roda a cada 10 min (a do app e a da aba no Orca, F460).
const BATIDA_VELHA_MS = 15 * 60_000
const BATIDA_DECLARADA_MS = 25 * 60_000
const SEM_ITEM_NO_TITULO = /^F\d+\s*·\s*/

type Tom = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
// Só 5 tons: o selo agrupa os estados por sentido, sem emoji e sem outro sinal de cor. Destaque anda (Executando, Planejando,
// No design, Validando, Mergeando); âmbar espera algo ou alguém (Espera você, PR aberto, Na fila); verde terminou; vermelho quebrou
// ou travou; neutro está parado sem causa. O texto sempre diz o estado: a cor nunca é a única pista.
export const SELOS: Record<string, { texto: string; tom: Tom }> = {
  esperando: { texto: 'Espera você', tom: 'warning' },
  travada: { texto: 'Travada', tom: 'danger' },
  'gate-vermelho': { texto: 'Gate vermelho', tom: 'danger' },
  'sem-movimento': { texto: 'Parada', tom: 'neutral' },
  falhou: { texto: 'Sessão falhou', tom: 'danger' },
  'sem-dona': { texto: 'Sem sessão', tom: 'neutral' },
  mergeando: { texto: 'Mergeando', tom: 'accent' },
  'na-fila': { texto: 'Na fila', tom: 'warning' },
  'pr-aberto': { texto: 'PR aberto', tom: 'warning' },
  validando: { texto: 'Validando', tom: 'accent' },
  planejamento: { texto: 'Planejando', tom: 'accent' },
  design: { texto: 'No design', tom: 'accent' },
  execucao: { texto: 'Executando', tom: 'accent' },
  entregue: { texto: 'Entregue', tom: 'success' },
}

export function chaveDoSelo(s: Sessao): string {
  if (s.estado === 'parada') return s.tipoDeParada && s.tipoDeParada in SELOS ? s.tipoDeParada : 'travada'
  if (s.estado === 'na-fila') return s.foraDaFila ? 'pr-aberto' : 'na-fila'
  if (s.estado === 'trabalhando') return s.subEtapa === 'planejamento' || s.subEtapa === 'design' ? s.subEtapa : 'execucao'
  return s.estado
}
const seloDe = (s: Sessao) => SELOS[chaveDoSelo(s)]
const semItem = (titulo: string) => titulo.replace(SEM_ITEM_NO_TITULO, '')
const dependencia = (s: Sessao) => (s.dependeDe.length ? `depende de ${s.dependeDe.join(' e ')}` : null)
const fatiaDe = (s: Sessao) => {
  if (!s.fatia) return null
  if (s.todasFeitas) return `as ${s.fatia.total} fatias mergeadas`
  return s.fatia.total ? `fatia ${s.fatia.atual} de ${s.fatia.total}` : `fatia ${s.fatia.atual}`
}

/** A frase curta da 2ª linha: o que exatamente prende ou anda; vazia quando só repetiria o selo. */
function fraseDaSessao(s: Sessao): string {
  const q = s.perguntas[0]
  switch (chaveDoSelo(s)) {
    case 'esperando': return q ? `${q.id} · ${semItem(q.titulo)}` : s.motivo ?? ''
    case 'travada': case 'gate-vermelho': return s.motivo ?? ''
    case 'sem-movimento': return dependencia(s) ?? 'sem atividade'
    case 'falhou': return 'a sessão no Orca terminou com falha'
    case 'sem-dona': return dependencia(s) ?? 'esperando a orquestradora abrir uma'
    case 'mergeando': return s.prNaFila ? `PR ${s.prNaFila} · gate rodando` : 'gate rodando'
    case 'na-fila': return s.prNaFila && s.posicaoNaFila ? `PR ${s.prNaFila} · ${s.posicaoNaFila}º da fila` : 'esperando o gate'
    case 'pr-aberto': return s.prNaFila ? `PR ${s.prNaFila} · fora da fila de merge` : 'fora da fila de merge'
    // Sem nota, a frase fica vazia: o selo já diz a etapa.
    default: return [fatiaDe(s), s.agora].filter(Boolean).join(' · ')
  }
}

const vivasDe = (g: GrupoDeSessoes) => g.sessoes.filter((s) => s.estado !== 'entregue')

function SeloDoEstado(props: { s: Sessao }) {
  const selo = seloDe(props.s)
  // O Badge do Orca pinta cheio em neutral, accent e danger e só contorna success e warning: aqui todo selo é a mesma pílula
  // (contorno + bolinha ● no tom do sentido + o texto). O Text não tem o tom neutral: o neutro usa a bolinha muted.
  return (
    <Box border="neutral" radius="full" paddingX="sm" shrink={false}>
      <Row align="center" gap="xs">
        {selo.tom === 'neutral' ? <Text size="xs" muted>●</Text> : <Text size="xs" tone={selo.tom}>●</Text>}
        <Text size="xs" weight="semibold">{selo.texto}</Text>
      </Row>
    </Box>
  )
}

function LinhaDoEstado(props: { s: Sessao }) {
  const agora = read(tique) || relogio.agora()
  const tempo = tempoDaSessao(props.s, agora)
  const frase = fraseDaSessao(props.s)
  return (
    <Row align="center" gap="xs">
      <SeloDoEstado s={props.s} />
      {props.s.estado === 'mergeando' ? <Spinner label="Gate rodando" labelHidden /> : null}
      <Box grow minWidth={0}>{frase ? <Text size="xs" truncate>{frase}</Text> : null}</Box>
      {tempo ? <Box shrink={false}><Text size="xs" muted>{tempo}</Text></Box> : null}
    </Row>
  )
}

function Bolinha(props: { como: BolinhaDaSessao['estado'] }) {
  if (props.como === 'feito') return <Box width={8} height={8} radius="full" background="success" shrink={false} />
  if (props.como === 'agora') return <Box width={8} height={8} radius="full" background="accent" shrink={false} />
  return <Box width={8} height={8} radius="full" border="neutral" shrink={false} />
}

/** O estado no rótulo da bolinha: no merge, o que falta (`2º da fila`), não a etapa de novo; a sigla PR fica maiúscula. */
function estadoNaBolinha(s: Sessao): string {
  switch (chaveDoSelo(s)) {
    case 'mergeando': return 'gate rodando'
    case 'na-fila': return s.posicaoNaFila ? `${s.posicaoNaFila}º da fila` : 'esperando o gate'
    case 'pr-aberto': return 'fora da fila'
    default: return seloDe(s).texto.toLowerCase()
  }
}

/** O rótulo da bolinha de agora diz também o estado: `execução · travada`, `Lista de sessões — validando`. */
function rotuloDaBolinha(s: Sessao, b: BolinhaDaSessao, comNomes: boolean): string {
  if (b.estado !== 'agora') return b.nome
  const selo = estadoNaBolinha(s)
  if (comNomes) return `${b.nome} — ${selo}`
  if (s.estado === 'trabalhando') {
    if (s.subEtapa === 'design') return `${b.nome} · design`
    return s.fatia && !s.fatia.total ? `${b.nome} · ${fatiaDe(s)}` : b.nome
  }
  return s.estado === 'validando' ? b.nome : `${b.nome} · ${selo}`
}

function Etapas(props: { s: Sessao }) {
  const s = props.s
  const comNomes = Boolean(s.fatia?.total)
  return (
    <Box gap="xs">
      {s.feitasJuntas ? (
        <Row align="center" gap="xs">
          <Bolinha como="feito" />
          <Text size="xs" muted>{s.feitasJuntas === 1 ? 'Fatia 1 feita' : `Fatias 1 a ${s.feitasJuntas} feitas`}</Text>
        </Row>
      ) : null}
      {s.etapas.map((b, i) => (
        <Row key={`b-${s.item}-${i}`} align="center" gap="xs">
          <Bolinha como={b.estado} />
          <Text size="xs" muted={b.estado === 'feito'} weight={b.estado === 'agora' ? 'semibold' : undefined}>{rotuloDaBolinha(s, b, comNomes)}</Text>
        </Row>
      ))}
      {s.maisBolinhas ? <Text size="xs" muted>{`e mais ${s.maisBolinhas}`}</Text> : null}
      {s.todasFeitas ? <Text size="xs">Todas as fatias têm PR mergeado; o item segue aberto.</Text> : null}
    </Box>
  )
}

/** `PR 173 aberto · PRs 168 e 165 mergeados`. */
function linhaDosPRs(s: Sessao): string | null {
  const { abertos } = s.prs
  const mergeados = [...s.prs.mergeados].sort((a, b) => b - a)
  const partes = [
    abertos.length ? `${abertos.length === 1 ? 'PR' : 'PRs'} ${listaDePRs(abertos)} ${abertos.length === 1 ? 'aberto' : 'abertos'}` : null,
    mergeados.length ? `${mergeados.length === 1 ? 'PR' : 'PRs'} ${listaDePRs(mergeados)} ${mergeados.length === 1 ? 'mergeado' : 'mergeados'}` : null,
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : null
}

function DetalheDaSessao(props: { s: Sessao }) {
  const s = props.s
  const agora = read(tique) || relogio.agora()
  const prs = linhaDosPRs(s)
  return (
    <Box gap="sm">
      {s.perguntas.length ? (
        <Box gap="xs">
          {s.perguntas.map((q) => <Text key={`sq-${s.item}-${q.id}`} size="sm">{`${q.id} · ${semItem(q.titulo)}`}</Text>)}
          <Row><Button variant="ghost" size="sm" onPress={() => set(secao, 'perguntas')}>Responder em Perguntas</Button></Row>
        </Box>
      ) : s.motivo ? <Text size="sm">{`Motivo: ${s.motivo}`}</Text> : null}
      {/* Espera sem pergunta não tem gesto em Perguntas: diz onde retomar. */}
      {s.estado === 'esperando' && !s.perguntas.length ? <Text size="xs" muted>{`Retome na sessão do ${s.item}.`}</Text> : null}
      {s.etapas.length ? <Etapas s={s} /> : null}
      {prs ? <Text size="xs">{prs}</Text> : null}
      {s.agora ? (
        <Box gap="xs">
          <Text size="xs" muted>{s.notaEm && ms(s.notaEm) ? `Nota da sessão · ${haQuanto(ms(s.notaEm), agora)}` : 'Nota da sessão'}</Text>
          <Text size="sm">{s.agora}</Text>
        </Box>
      ) : null}
      {s.dependeDe.length ? <Text size="xs">{`Depende de ${s.dependeDe.join(' e ')}, ainda ${s.dependeDe.length === 1 ? 'aberto' : 'abertos'}.`}</Text> : null}
    </Box>
  )
}

function CartaoDaSessao(props: { s: Sessao }) {
  const s = props.s
  const aberto = Boolean(read(sessoesAbertas)[s.item])
  return (
    <Box key={`s-${s.item}`} border={true} radius="md" padding="sm" gap="xs">
      <Row justify="between" align="center" gap="sm">
        <Box grow minWidth={0}><Text size="sm" weight="semibold" truncate={!aberto}>{s.nome}</Text></Box>
        <IconButton
          variant="ghost" size="sm" icon={aberto ? 'collapse' : 'expand'} label={`${aberto ? 'Fechar' : 'Abrir'} ${s.item}`}
          onPress={() => update(sessoesAbertas, (x) => (aberto ? sem(x, s.item) : { ...x, [s.item]: true }))}
        />
      </Row>
      <LinhaDoEstado s={s} />
      {aberto ? <DetalheDaSessao s={s} /> : null}
    </Box>
  )
}

function EntreguesHoje(props: { g: GrupoDeSessoes; entregues: Sessao[] }) {
  return (
    <Collapsible title={`Entregues hoje · ${props.entregues.length}`}>
      <Box gap="sm">
        {props.entregues.map((s) => (
          <Box key={`h-${s.item}`} gap="xs">
            <Text size="sm">{s.nome}</Text>
            <Text size="xs" muted>{[s.desdeEm ? horaSP(ms(s.desdeEm)) : null, s.prs.mergeados.length ? `${s.prs.mergeados.length === 1 ? 'PR' : 'PRs'} ${listaDePRs(s.prs.mergeados)}` : null].filter(Boolean).join(' · ')}</Text>
          </Box>
        ))}
        <Row><Button variant="ghost" size="sm" onPress={() => set(secao, 'entregas')}>Ver em Entregas</Button></Row>
      </Box>
    </Collapsible>
  )
}

function GrupoDoProjeto(props: { g: GrupoDeSessoes }) {
  const g = props.g
  const vivas = vivasDe(g)
  const entregues = g.sessoes.filter((s) => s.estado === 'entregue')
  if (!vivas.length && !entregues.length) return null
  return (
    <Box gap="sm">
      <Heading level={3}>{`${g.projeto ?? 'Sem projeto'} · ${vivas.length}`}</Heading>
      {g.filaIlegivel ? <Text size="xs" muted>Não li a fila de merge deste projeto.</Text> : null}
      {vivas.map((s) => <CartaoDaSessao key={`s-${s.item}`} s={s} />)}
      {entregues.length ? <EntreguesHoje g={g} entregues={entregues} /> : null}
    </Box>
  )
}

/** O kit publicou versão mais nova que a instalada: uma barra curta com o comando. A aba não executa (só envia a terminais). */
function AvisoDeAtualizacao(props: { novas: AtualizacaoDoKit[] }) {
  if (!props.novas.length) return null
  return (
    <Callout tone="accent" title="Versão nova do kit">
      <Row gap="xs" align="center" wrap>
        <Text size="sm">Atualize: rode</Text>
        <Code>atualizar-plugins</Code>
        <Text size="sm">numa sessão</Text>
      </Row>
    </Callout>
  )
}

/** A faixa do estado deduzido velho: a fila e as perguntas seguem em dia, porque o worker as lê a cada leitura. */
function AvisoDasSessoes(props: { v: VistaDasSessoes }) {
  const agora = read(tique) || relogio.agora()
  const em = ms(props.v.batidaEm)
  if (!em || agora - em <= BATIDA_VELHA_MS) return null
  const texto = agora - em > BATIDA_DECLARADA_MS
    ? `O estado das sessões não se atualiza ${haQuanto(em, agora)}. As etapas abaixo são as que as sessões gravaram.`
    : `O estado das sessões não se atualiza ${haQuanto(em, agora)}. Etapa, PRs e paradas podem estar atrasados; a fila e as perguntas estão em dia.`
  return <Callout tone="warning"><Text size="sm">{texto}</Text></Callout>
}

/** "Arquivar concluídas (N)": só com sessão concluída que passa nas condições; confirma com a lista e mostra o desfecho no lugar. */
function ArquivarConcluidas() {
  const aptas = read(concluidas)?.aptas ?? []
  const a = read(arquivo)
  if (a?.tipo === 'andando') return <Spinner label={`Arquivando ${plural(a.itens.length, 'sessão', 'sessões')}…`} />
  if (a?.tipo === 'confirmando') {
    const n = a.itens.length
    return (
      <Box gap="sm">
        <Text size="sm" weight="semibold">{`Arquivar ${plural(n, 'sessão concluída', 'sessões concluídas')}?`}</Text>
        <Box gap="xs">{a.itens.map((c) => <Text key={`c-${c.item}`} size="xs">{`${c.item} · ${semPrefixoDoItem(c.titulo, c.item)}`}</Text>)}</Box>
        <Text size="xs" muted>{n === 1
          ? 'A pasta dela é apagada (o que o git ignora, como .env, vai junto) e ela some da barra lateral.'
          : 'A pasta de cada uma é apagada (o que o git ignora, como .env, vai junto) e elas somem da barra lateral.'}</Text>
        <Row gap="sm" wrap>
          <Button variant="ghost" onPress={() => set(arquivo, null)}>Cancelar</Button>
          <Button variant="outline" tone="danger" onPress={() => void arquivar(a.itens)}>{n === 1 ? 'Arquivar' : `Arquivar as ${n}`}</Button>
        </Row>
      </Box>
    )
  }
  if (a?.tipo === 'feito') {
    const { arquivadas, recusadas, erro } = a.desfecho
    const tom = erro ? 'danger' : recusadas.length ? 'warning' : 'success'
    return (
      <Box gap="xs">
        {erro ? <Text size="sm" tone="danger">{`Não arquivou: ${erro}.`}</Text> : <Text size="sm" tone={arquivadas.length ? 'success' : tom}>{arquivadas.length ? `${plural(arquivadas.length, 'sessão arquivada', 'sessões arquivadas')}.` : 'Nenhuma sessão arquivada.'}</Text>}
        {recusadas.map((r) => <Text key={`r-${r.item}`} size="xs" tone={tom}>{`${r.item} ficou: ${r.motivo}.`}</Text>)}
        <Row gap="sm" wrap>
          {erro ? <Button variant="outline" size="sm" onPress={() => { set(arquivo, null); void lerConcluidas(true) }}>Tentar de novo</Button> : null}
          <Button variant="ghost" size="sm" onPress={() => set(arquivo, null)}>Fechar</Button>
        </Row>
      </Box>
    )
  }
  if (!aptas.length) return null
  return <Row><Button variant="outline" size="sm" tooltip="Só as que têm PR mergeado, a worktree limpa e a sessão parada. A pasta é apagada." onPress={() => set(arquivo, { tipo: 'confirmando', itens: aptas })}>{`Arquivar concluídas (${aptas.length})`}</Button></Row>
}

function Sessoes(props: { v: VistaDasSessoes }) {
  const v = props.v
  if (v.erro) {
    return (
      <Callout tone="danger">
        <Box gap="sm">
          <Text size="sm">{`Não li as sessões: ${v.erro}.`}</Text>
          <Row><Button variant="outline" size="sm" onPress={() => void reler(true)}>Tentar de novo</Button></Row>
        </Box>
      </Callout>
    )
  }
  const vivas = v.projetos.reduce((n, g) => n + vivasDe(g).length, 0)
  return (
    <Box gap="lg">
      <AvisoDasSessoes v={v} />
      <ArquivarConcluidas />
      {!vivas ? <EmptyState title="Nenhuma sessão trabalhando agora" description="Quando a orquestradora abrir uma sessão para um item, ela aparece aqui." icon="activity" /> : null}
      {v.projetos.map((g) => <GrupoDoProjeto key={`g-${g.projeto ?? 'sem-projeto'}`} g={g} />)}
    </Box>
  )
}

// ── Casca ────────────────────────────────────────────────────────────────────────────────────────────────────────
const SECOES: { id: Secao; nome: string; icone: string; rotulo: (l: Leitura | null) => string; numero: (l: Leitura | null) => number; tom: Tom }[] = [
  // O número conta só o que nenhuma outra seção mostra: paradas e esperas sem pergunta aberta.
  { id: 'sessoes', nome: 'Sessões', icone: 'activity', tom: 'neutral',
    numero: (l) => l?.sessoes?.paradas ?? 0,
    rotulo: (l) => {
      if (l?.sessoes?.erro) return 'Sessões · não li as sessões'
      const n = l?.sessoes?.paradas ?? 0
      return `Sessões · ${n ? plural(n, 'parada', 'paradas') : 'nenhuma parada'}`
    } },
  { id: 'perguntas', nome: 'Perguntas', icone: 'bell', tom: 'warning',
    numero: (l) => (l ? abertasAtivas(l) : 0),
    rotulo: (l) => { const n = l ? abertasAtivas(l) : 0; return `Perguntas · ${n ? plural(n, 'aberta', 'abertas') : 'nenhuma aberta'}` } },
  { id: 'decisoes', nome: 'Decisões', icone: 'flag', tom: 'neutral',
    numero: (l) => (l ? assumidasAtivas(l) : 0),
    rotulo: (l) => { const n = l ? assumidasAtivas(l) : 0; return `Decisões · ${n ? `${n} a confirmar` : 'nenhuma a confirmar'}` } },
  { id: 'entregas', nome: 'Entregas', icone: 'package', tom: 'neutral',
    numero: (l) => (l ? entregasVisiveis(l).lista.filter((e) => !(e.chave in read(limpasAgora))).length : 0),
    rotulo: (l) => { const n = l ? entregasVisiveis(l).lista.filter((e) => !(e.chave in read(limpasAgora))).length : 0; return `Entregas · ${n ? plural(n, 'nova', 'novas') : 'nenhuma nova'}` } },
]

function Trilho(props: { l: Leitura | null; atual: Secao }) {
  return (
    <Box width={44} border radius="lg" paddingY="sm" gap="xs" align="center" shrink={false}>
      {SECOES.map((s) => {
        const n = s.numero(props.l)
        return (
          <Box key={s.id} gap="xs" align="center">
            <IconButton
              icon={s.icone} label={s.rotulo(props.l)}
              variant={s.id === props.atual ? 'solid' : 'ghost'} tone={s.id === props.atual ? 'accent' : 'neutral'}
              onPress={() => { set(secao, s.id); set(armado, null) }}
            />
            {n ? <Badge tone={s.tom}>{String(n)}</Badge> : null}
          </Box>
        )
      })}
    </Box>
  )
}

function Cabecalho(props: { nome: string; l: Leitura | null }) {
  const agora = read(tique) || relogio.agora()
  const motivo = read(falha)
  const estado = read(lendo) && !props.l ? 'Lendo…'
    : props.l && motivo ? `Não consegui reler ${haQuanto(props.l.lidoEm, agora)}: ${motivo}.`
      : props.l ? haQuanto(props.l.lidoEm, agora) : ''
  return (
    <Row justify="between" align="center" gap="sm">
      <Heading level={2}>{props.nome}</Heading>
      <Row gap="xs" align="center">
        {read(lendo) && props.l ? <Spinner label="Lendo…" labelHidden /> : null}
        <Text size="xs" muted={!(props.l && motivo)} tone={props.l && motivo ? 'warning' : undefined}>{estado}</Text>
        <IconButton variant="ghost" size="sm" icon="refresh" label="Reler agora" onPress={() => void relerAgora()} />
      </Row>
    </Row>
  )
}

function Carregando(props: { atual: Secao }) {
  if (props.atual === 'perguntas') return <Skeleton shape="block" label="Lendo as perguntas" />
  if (props.atual === 'decisoes') return <Skeleton shape="text" lines={5} label="Lendo as decisões" />
  if (props.atual === 'sessoes') {
    return (
      <Box gap="xs">
        <Skeleton shape="text" lines={1} label="Lendo as sessões" />
        <Skeleton shape="block" label="Lendo as sessões" /><Skeleton shape="block" label="Lendo as sessões" /><Skeleton shape="block" label="Lendo as sessões" />
      </Box>
    )
  }
  return <Box gap="sm"><Skeleton shape="block" label="Lendo as entregas" /><Skeleton shape="block" label="Lendo as entregas" /><Skeleton shape="block" label="Lendo as entregas" /></Box>
}

const SEM_SESSOES: VistaDasSessoes = { projetos: [], paradas: 0, ilegiveis: 0, batidaEm: null, erro: null, lidoEm: 0 }

export default function Painel() {
  const atual = read(secao)
  const l = read(leitura)
  const motivo = read(falha)
  const s = SECOES.find((x) => x.id === atual) ?? SECOES[0]
  const presas = l ? abertasAtivas(l) : 0
  let corpo
  if (!l && motivo) {
    corpo = (
      <Callout tone="danger">
        <Box gap="sm">
          <Text size="sm">{`Não li o painel do kit: ${motivo}.`}</Text>
          <Row><Button variant="outline" size="sm" onPress={() => void reler(true)}>Tentar de novo</Button></Row>
        </Box>
      </Callout>
    )
  } else if (!l) corpo = <Carregando atual={atual} />
  else if (atual === 'perguntas') corpo = <Perguntas l={l} />
  else if (atual === 'decisoes') corpo = <Box gap="sm"><Text size="xs" muted>Confirmar só grava; ninguém é acordado.</Text><Decisoes l={l} /></Box>
  else if (atual === 'sessoes') corpo = <Sessoes v={l.sessoes ?? SEM_SESSOES} />
  else corpo = <Entregas l={l} />
  return (
    <Box direction="row" gap="sm" padding="sm" align="start">
      <Trilho l={l} atual={s.id} />
      <Box grow gap="md" minWidth={0}>
        <Cabecalho nome={s.nome} l={l} />
        {atual !== 'perguntas' && presas ? (
          <Box border="warning" radius="md" padding="sm">
            <Row justify="between" align="center" gap="sm">
              <Text size="sm">{`${plural(presas, 'pergunta esperando', 'perguntas esperando')} você`}</Text>
              <Button variant="ghost" size="sm" onPress={() => set(secao, 'perguntas')}>Ver</Button>
            </Row>
          </Box>
        ) : null}
        <AvisoDeAtualizacao novas={l?.atualizacao ?? []} />
        {corpo}
      </Box>
    </Box>
  )
}
