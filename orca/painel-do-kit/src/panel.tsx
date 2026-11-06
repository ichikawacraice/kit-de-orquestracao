// Aba do kit no Orca (F436): perguntas abertas, decisões assumidas e entregas das sessões, num trilho de seções.
// Ler não aciona modelo: o painel só pede `kit.ler` ao worker (arquivos e o CLI do Orca em modo leitura). Só
// responder, discordar e responder a uma entrega acordam uma sessão. Desenho: docs/design/revisoes/2026-11-06-aba-do-kit-no-orca.md.
import {
  atom, read, set, update, plugin, storage,
  Badge, Box, Button, Callout, Collapsible, EmptyState, Heading, IconButton, Row, Skeleton, Spinner, Text, Textarea,
} from 'orca'
import { cortar, haQuanto, horaSP, ms, nomeDoDestino, nomeDoDia, plural, porDia, porItem } from './vista'
import { separarLidas, limpar as limparLidas, desfazer as desfazerLidas, podarLidas } from './nucleo/lidas.mjs'
import type { Entrega, EstadoDaEntrega, Leitura, Pendente, Pergunta } from './protocol'
import { PRAZO_DO_ENVIO_MS } from './protocol'

// O "Sim" do painel (o mesmo texto do pane do app): a sessão e a trava de limpeza o reconhecem.
const SIM = 'sim (segue a recomendação)'
const SEM_ENDERECO = 'Sem endereço no Orca: a resposta fica gravada, mas não acorda a sessão. Se ela espera você, abra-a e avise.'

/** O relógio da aba; os testes o trocam para provar as janelas de tempo. */
export const relogio = { agora: () => Date.now() }

const RELER_MS = 30_000
const DESFAZER_MS = 10_000
const ARMADO_MS = 8_000
const TOQUE_MS = 500
const CASO_CURTO = 120
const ORCA_CURTO = 280

type Secao = 'perguntas' | 'decisoes' | 'entregas'
type Esperado = 'aberta' | 'assumida'
/** O que a pessoa fez nesta visita, por pergunta: fica no lugar até ela reler ou sair da aba. */
type Feito =
  | { tipo: 'andando'; q: Pergunta; esperado: Esperado; texto: string }
  | { tipo: 'feito'; q: Pergunta; esperado: Esperado; texto: string; mostrar?: string; entrega: EstadoDaEntrega }
  | { tipo: 'erro'; q: Pergunta; esperado: Esperado; motivo: string }
  | { tipo: 'fora'; q: Pergunta; esperado: Esperado }
  | { tipo: 'confirmando'; q: Pergunta; esperado: 'assumida' }
  | { tipo: 'confirmada'; q: Pergunta; esperado: 'assumida'; versao: number; ate: number; lote: string | null }
type Lote = { texto: string; tom: 'success' | 'warning'; itens: { id: string; versao: number }[]; ate: number; erro?: string }
type Envio = { tipo: 'andando' } | { tipo: 'ok'; texto: string } | { tipo: 'erro'; texto: string }

const secao = atom<Secao>('secao', 'perguntas', { persist: 'plugin' })
const leitura = atom<Leitura | null>('leitura', null)
const lendo = atom('lendo', false)
const falha = atom<string | null>('falha', null)
const tique = atom('tique', 0)
const rascunhos = atom<Record<string, string>>('rascunhos', {})
const campos = atom<Record<string, boolean>>('campos', {})
const feitos = atom<Record<string, Feito>>('feitos', {})
const inteiros = atom<Record<string, boolean>>('inteiros', {})
const grupos = atom<Record<string, boolean>>('grupos', {})
const armado = atom<number | null>('armado', null)
const lotes = atom<Record<string, Lote>>('lotes', {})
const reentregas = atom<Record<string, 'andando' | EstadoDaEntrega>>('reentregas', {})
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

const sem = <T,>(o: Record<string, T>, k: string) => Object.fromEntries(Object.entries(o).filter(([c]) => c !== k)) as Record<string, T>
const tocar = (ms: number) => setTimeout(() => set(tique, relogio.agora()), ms + 50)

function motivoDe(e: unknown): string {
  console.warn('[kit] pedido ao worker falhou:', e)
  const codigo = (e as { code?: string } | null)?.code
  if (codigo === 'timeout') return 'o Orca demorou a responder'
  if (codigo === 'capability_denied') return 'falta uma permissão ao plugin'
  return 'o worker do plugin não respondeu'
}

// ── Leitura ──────────────────────────────────────────────────────────────────────────────────────────────────────
let primeira = true
async function reler(forcar: boolean) {
  set(lendo, true)
  try {
    const antes = read(leitura)
    const l = await plugin.request('kit.ler', { forcar })
    set(leitura, l)
    set(falha, null)
    if (primeira && l.abertas.length > 0) set(secao, 'perguntas')
    primeira = false
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

/** O reler da pessoa: força a caixa do Orca e tira o que ela já resolveu nesta visita. */
async function relerAgora() {
  const andando = new Set(['andando', 'confirmando', 'erro'])
  update(feitos, (f) => Object.fromEntries(Object.entries(f).filter(([, x]) => andando.has(x.tipo))))
  set(lotes, {})
  set(limpasAgora, {})
  set(reentregas, {})
  set(envios, {})
  set(armado, null)
  await reler(true)
}

export function setup(ctx: { subscriptions: { dispose(): void }[]; visible: unknown }) {
  primeira = true
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
  update(feitos, (f) => ({ ...f, [q.id]: { tipo: 'andando', q, esperado, texto: resposta } }))
  let motivo: string
  try {
    const r = await plugin.request('kit.responder', { id: q.id, versao: q.versao, esperado, resposta }, { timeoutMs: PRAZO_DO_ENVIO_MS })
    if (r.gravou) {
      update(feitos, (f) => ({ ...f, [q.id]: { tipo: 'feito', q, esperado, texto: resposta, mostrar, entrega: r.entrega } }))
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
    update(feitos, (f) => ({ ...f, [q.id]: { tipo: 'erro', q, esperado, motivo } }))
  }
}

async function reentregar(id: string) {
  update(reentregas, (x) => ({ ...x, [id]: 'andando' }))
  try {
    const r = await plugin.request('kit.reentregar', { id }, { timeoutMs: PRAZO_DO_ENVIO_MS })
    update(reentregas, (x) => ({ ...x, [id]: r }))
  } catch (e) {
    update(reentregas, (x) => ({ ...x, [id]: { estado: 'falhou', via: 'orca', em: new Date().toISOString(), motivo: motivoDe(e) } }))
  }
}

/** Confirma decisões; `lote` é a chave do desfecho em lote (grupo ou todas), `null` para uma linha. */
async function confirmar(qs: Pergunta[], lote: string | null) {
  if (!qs.length) return
  set(armado, null)
  update(feitos, (f) => ({ ...f, ...Object.fromEntries(qs.map((q) => [q.id, { tipo: 'confirmando', q, esperado: 'assumida' }])) }))
  try {
    const r = await plugin.request('kit.confirmar', { itens: qs.map((q) => ({ id: q.id, versao: q.versao })) })
    const ate = relogio.agora() + DESFAZER_MS
    const porId = new Map(qs.map((q) => [q.id, q]))
    update(feitos, (f) => {
      const n = { ...f }
      for (const id of r.confirmadas) n[id] = { tipo: 'confirmada', q: porId.get(id)!, esperado: 'assumida', versao: r.versoes[id], ate, lote }
      for (const x of r.recusadas) n[x.id] = { tipo: 'erro', q: porId.get(x.id)!, esperado: 'assumida', motivo: `Não confirmou: ${x.motivo}.` }
      return n
    })
    if (lote) {
      const texto = r.recusadas.length
        ? `${r.confirmadas.length} confirmadas. ${r.recusadas.length} mudaram depois da leitura e continuam na lista.`
        : `${plural(r.confirmadas.length, 'decisão confirmada', 'decisões confirmadas')}.`
      update(lotes, (x) => ({ ...x, [lote]: { texto, tom: r.recusadas.length ? 'warning' : 'success', itens: r.confirmadas.map((id) => ({ id, versao: r.versoes[id] })), ate } }))
    }
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

// ── Perguntas ────────────────────────────────────────────────────────────────────────────────────────────────────
function CartaoDaPergunta(props: { q: Pergunta }) {
  const l = read(leitura)
  const q = l?.abertas.find((x) => x.id === props.q.id) ?? props.q
  const f = read(feitos)[q.id]
  const agora = read(tique) || relogio.agora()
  if (f?.tipo === 'feito') return <Compacto q={q} texto={f.mostrar ?? `Você respondeu: ${f.texto}`} entrega={f.entrega} />
  if (f?.tipo === 'fora') return <Compacto q={q} nota="Já foi respondida fora desta aba." />
  const chave = `aberta:${q.id}`
  const aberto = read(campos)[chave]
  const meta = [q.projeto, `espera ${haQuanto(ms(q.atualizadoEm), agora)}`, q.id].filter(Boolean).join(' · ')
  // Com opções, um botão por opção (a recomendada primeiro); `outra` só libera o campo livre, como no pane do app.
  const botoes = (q.opcoes ?? []).filter((o) => o.id !== 'outra')
  const livre = !q.opcoes || q.opcoes.some((o) => o.id === 'outra')
  return (
    <Box key={`q-${q.id}`} background="card" border radius="lg" padding="md" gap="sm">
      <Text size="sm" weight="semibold">{q.titulo}</Text>
      <Text size="xs" muted>{meta}</Text>
      {q.caso ? <Text size="sm">{q.caso}</Text> : null}
      {q.seNaoDecidir ? <Text size="sm" muted>{`Se ninguém decidir: ${q.seNaoDecidir}`}</Text> : null}
      {q.recomendacao ? (
        <Box background="muted" border="accent" radius="md" padding="sm" gap="xs">
          <Text size="xs" weight="semibold" tone="accent">Recomendação</Text>
          <Text size="sm">{q.recomendacao}</Text>
        </Box>
      ) : null}
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

function SeloDaEntrega(props: { q: Pick<Pergunta, 'item' | 'titulo'>; entrega: EstadoDaEntrega }) {
  const e = props.entrega
  if (e.estado === 'entregue') return <Badge tone="success">{`Entregue a ${nomeDoDestino(props.q)}`}</Badge>
  if (e.estado === 'pendente') return <Badge tone="neutral">Entrega pendente</Badge>
  return <Badge tone="danger">A entrega falhou</Badge>
}

function Compacto(props: { q: Pergunta; texto?: string; nota?: string; entrega?: EstadoDaEntrega }) {
  const e = props.entrega
  return (
    <Box key={`q-${props.q.id}`} background="card" border radius="lg" padding="md" gap="xs">
      <Text size="sm" weight="semibold">{props.q.titulo}</Text>
      {props.texto ? <Text size="sm">{props.texto}</Text> : null}
      {props.nota ? <Text size="sm" muted>{props.nota}</Text> : null}
      {e ? <Row><SeloDaEntrega q={props.q} entrega={e} /></Row> : null}
      {e?.estado === 'pendente' ? <Text size="xs" muted>{SEM_ENDERECO}</Text> : null}
      {e?.estado === 'falhou' ? <Text size="xs" tone="danger">{`Gravada, mas não chegou a ${nomeDoDestino(props.q)}: ${e.motivo ?? 'sem motivo'}.`}</Text> : null}
    </Box>
  )
}

function CartaoPendente(props: { p: Pendente }) {
  const p = props.p
  const r = read(reentregas)[p.id]
  const entrega = r && r !== 'andando' ? r : p.entregaDaResposta
  return (
    <Box key={`p-${p.id}`} background="card" border radius="lg" padding="md" gap="xs">
      <Text size="sm" weight="semibold">{p.titulo}</Text>
      <Text size="sm">{`Você respondeu: ${p.resposta}`}</Text>
      <Row><SeloDaEntrega q={p} entrega={entrega} /></Row>
      {entrega.estado === 'falhou' ? <Text size="xs" tone="danger">{`Gravada, mas não chegou a ${nomeDoDestino(p)}: ${entrega.motivo ?? 'sem motivo'}.`}</Text> : null}
      {r === 'andando' ? <Spinner label={`Entregando a ${nomeDoDestino(p)}…`} />
        : entrega.estado !== 'entregue' && p.endereco ? <Row><Button variant="outline" onPress={() => void reentregar(p.id)}>Tentar entregar de novo</Button></Row> : null}
    </Box>
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
  const caixa = (filhos: unknown) => <Box key={`d-${q.id}`} border radius="md" padding="sm" gap="xs">{filhos}</Box>
  if (f?.tipo === 'confirmada') {
    return caixa(
      <Row justify="between" align="center" gap="sm">
        <Text size="sm" tone="success">{`Confirmada: ${q.titulo}`}</Text>
        {!f.lote && agora < f.ate ? <Button variant="ghost" size="sm" onPress={() => void desfazerConfirmacao([{ id: q.id, versao: f.versao }], null)}>Desfazer</Button> : null}
      </Row>,
    )
  }
  if (f?.tipo === 'confirmando') return caixa(<Spinner label={`Gravando: ${q.titulo}`} />)
  if (f?.tipo === 'feito') return caixa(<Box gap="xs"><Text size="sm">{`Você mudou: ${f.texto}`}</Text><Row><SeloDaEntrega q={q} entrega={f.entrega} /></Row></Box>)
  if (f?.tipo === 'fora') return caixa(<Text size="sm" muted>{`${q.titulo}: já foi respondida fora desta aba.`}</Text>)
  const chave = `assumida:${q.id}`
  const decidiu = q.recomendacao ?? q.caso ?? ''
  const { curto, cortou } = cortar(decidiu, CASO_CURTO)
  const inteiro = read(inteiros)[q.id]
  return caixa(
    <Box gap="xs">
      <Text size="sm" weight="semibold">{q.titulo}</Text>
      {decidiu ? <Text size="xs">{`Decidiu: ${inteiro ? decidiu : curto}`}</Text> : null}
      {inteiro && q.caso && q.caso !== decidiu ? <Text size="xs" muted>{q.caso}</Text> : null}
      <Row justify="between" align="center" gap="sm">
        <Text size="xs" muted>{`${q.id} · ${haQuanto(ms(q.atualizadoEm), agora)}`}</Text>
        {f?.tipo === 'andando' ? <Spinner label={q.endereco ? `Entregando a ${nomeDoDestino(q)}…` : 'Gravando…'} labelHidden /> : (
          <Row gap="xs">
            {cortou ? <IconButton variant="ghost" size="sm" icon={inteiro ? 'collapse' : 'expand'} label={inteiro ? 'Encolher' : 'Ler inteiro'} onPress={() => update(inteiros, (x) => ({ ...x, [q.id]: !inteiro }))} /> : null}
            <IconButton variant="ghost" size="sm" icon="edit" label="Discordar…" onPress={() => update(campos, (x) => ({ ...x, [chave]: true }))} />
            <IconButton variant="ghost" size="sm" icon="check" label={`Confirmar: ${q.titulo}`} tooltip="Só grava. Nenhuma sessão é acordada." onPress={() => void confirmar([q], null)} />
          </Row>
        )}
      </Row>
      {read(campos)[chave] && f?.tipo !== 'andando' ? (
        <Campo chave={chave} rotulo="O que deve mudar" linhas={3} enviar={q.endereco ? 'Enviar mudança' : 'Gravar mudança'} destino={destinoDaPergunta(q)} aoEnviar={(t) => void responder(q, 'assumida', t)} />
      ) : null}
      {f?.tipo === 'erro' ? <Text size="xs" tone="danger">{f.motivo}</Text> : null}
    </Box>,
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
      <Text size="xs" muted>Inclui as que você não abriu.</Text>
    </Box>
  )
}

/** "Confirmar as 12 do F435"; com uma só, "Confirmar a decisão do F435". */
const confirmarGrupo = (n: number, chave: string) => {
  const onde = chave === 'sem-item' ? 'sem item' : `do ${chave}`
  return n === 1 ? `Confirmar a decisão ${onde}` : `Confirmar as ${n} ${onde}`
}

function Decisoes(props: { l: Leitura }) {
  const lista = comFeitos(props.l.assumidas, 'assumida')
  if (!lista.length) return <EmptyState title="Nenhuma decisão para confirmar" description="Quando uma sessão decidir algo sozinha e seguir, aparece aqui." icon="check" />
  const gs = porItem(lista)
  const projetos = new Set(lista.map((q) => q.projeto).filter(Boolean))
  const abertos = read(grupos)
  const agora = read(tique) || relogio.agora()
  const livres = (qs: Pergunta[]) => qs.filter((q) => !read(feitos)[q.id] || read(feitos)[q.id].tipo === 'erro')
  return (
    <Box gap="sm">
      {gs.map((g, i) => {
        const pendentes = livres(g.itens)
        const titulo = g.chave === 'sem-item' ? 'Sem item' : g.titulo
        const descricao = [plural(g.itens.length, 'decisão', 'decisões'), haQuanto(g.ultimaMs, agora), projetos.size > 1 ? g.itens[0].projeto : null].filter(Boolean).join(' · ')
        const lote = read(lotes)[`grupo:${g.chave}`]
        return (
          <Collapsible key={g.chave} title={cortar(titulo, 26).curto} description={descricao} open={abertos[g.chave] ?? i === 0} onChange={(v: boolean) => update(grupos, (x) => ({ ...x, [g.chave]: v }))}>
            <Box gap="sm">
              <Box gap="xs">{g.itens.map((q) => <LinhaDaDecisao key={q.id} q={q} />)}</Box>
              {lote ? <DesfechoDoLote chave={`grupo:${g.chave}`} lote={lote} />
                : pendentes.length ? (
                  <Row>
                    <Button variant="solid" tone="neutral" tooltip="Só grava. Nenhuma sessão é acordada." onPress={() => void confirmar(pendentes, `grupo:${g.chave}`)}>
                      {confirmarGrupo(pendentes.length, g.chave)}
                    </Button>
                  </Row>
                ) : null}
            </Box>
          </Collapsible>
        )
      })}
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
          <Text size="sm" muted>{`Limpa: ${e.titulo}`}</Text>
          {agora < limpaAte ? <Button variant="ghost" size="sm" onPress={() => trazerDeVolta([e])}>Desfazer</Button> : null}
        </Row>
      </Box>
    )
  }
  const corpo = e.corpo ?? e.orca?.corpo ?? null
  const resultado = e.entrega?.resultado ?? (corpo ? cortar(corpo, ORCA_CURTO).curto : e.resultado ?? null)
  const meta = [horaSP(ms(e.em)), ...(e.prs ?? []).map((n) => `PR ${n}`), e.sessao].filter(Boolean).join(' · ')
  const detalhes = [e.entrega?.medido ? `Medido: ${e.entrega.medido}` : null, e.entrega?.proximos ? `Próximos: ${e.entrega.proximos}` : null].filter(Boolean) as string[]
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
      <Text size="sm" weight="semibold">{e.titulo}</Text>
      <Text size="xs" muted>{meta}</Text>
      {resultado ? <Text size="sm">{resultado}</Text> : null}
      {e.entrega?.naoMedido ? <Text size="sm">{`Não medido: ${e.entrega.naoMedido}`}</Text> : null}
      {detalhes.length || mensagemInteira ? (
        <Collapsible title="Detalhes">
          <Box gap="xs">
            {detalhes.map((d) => <Text key={d} size="sm">{d}</Text>)}
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
                  <Text size="sm">{e.titulo}</Text>
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

// ── Casca ────────────────────────────────────────────────────────────────────────────────────────────────────────
const SECOES: { id: Secao; nome: string; icone: string; rotulo: (l: Leitura | null) => string; numero: (l: Leitura | null) => number; tom: 'warning' | 'neutral' }[] = [
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
  return <Box gap="sm"><Skeleton shape="block" label="Lendo as entregas" /><Skeleton shape="block" label="Lendo as entregas" /><Skeleton shape="block" label="Lendo as entregas" /></Box>
}

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
        {corpo}
      </Box>
    </Box>
  )
}
