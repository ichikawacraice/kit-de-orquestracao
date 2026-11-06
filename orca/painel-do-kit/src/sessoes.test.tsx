// A seção Sessões da aba do kit (F452), montada com o runtime de verdade do Orca (`orca plugin test`). A conta do
// estado, da ordem e das bolinhas é do núcleo (`test/sessoes.test.mjs`); aqui, o que o painel desenha com a vista pronta.
import { assert, mount, mockHost, test } from 'orca/testing'
import * as painel from './panel'
import { SELOS, chaveDoSelo } from './panel'
import { ORDEM_DOS_ESTADOS } from './nucleo/sessoes.mjs'
import type { GrupoDeSessoes, Leitura, Pergunta, Sessao, VistaDasSessoes } from './protocol'
import { inicioDoDiaSP, tempoDaSessao } from './vista'

const AGORA = Date.now()
const MIN = 60_000
const iso = (msAtras: number) => new Date(AGORA - msAtras).toISOString()

const sessao = (item: string, extra: Partial<Sessao> = {}): Sessao => ({
  item, titulo: `título do ${item}`, nome: `${item} · título do ${item}`, projeto: 'kit', etapa: 'execucao', estado: 'trabalhando',
  subEtapa: 'execucao', tipoDeParada: null, motivo: null, prNaFila: null, posicaoNaFila: null, foraDaFila: false, desdeEm: iso(12 * MIN),
  agora: null, notaEm: null, rodando: false, perguntas: [], prs: { abertos: [], mergeados: [] }, fatia: null, todasFeitas: false,
  etapas: [], feitasJuntas: 0, maisBolinhas: 0, dependeDe: [], tipoDeEspera: null, ...extra,
})
const grupo = (projeto: string | null, sessoes: Sessao[], extra: Partial<GrupoDeSessoes> = {}): GrupoDeSessoes => ({ projeto, filaIlegivel: false, sessoes, ...extra })
const vista = (projetos: GrupoDeSessoes[], extra: Partial<VistaDasSessoes> = {}): VistaDasSessoes =>
  ({ projetos, paradas: 0, ilegiveis: 0, batidaEm: iso(MIN), erro: null, lidoEm: AGORA, ...extra })
const leitura = (sessoes: VistaDasSessoes, l: Partial<Leitura> = {}): Leitura =>
  ({ abertas: [], assumidas: [], pendentes: [], ilegiveis: 0, entregas: [], erroDaCaixa: null, caixaAte: null, sessoes, atualizacao: [], lidoEm: AGORA, ...l })
const pergunta = (id: string, item: string): Pergunta => ({
  id, versao: 1, estado: 'aberta', titulo: `${item} · pergunta ${id}`, caso: null, seNaoDecidir: null, recomendacao: null,
  item, projeto: 'kit', sessaoId: null, atualizadoEm: iso(MIN), endereco: null, opcoes: null,
})

type Desenhado = { type?: string; key?: string | null; props?: Record<string, unknown>; children?: unknown }
function acharPelaChave(no: unknown, chave: string): Desenhado | null {
  if (Array.isArray(no)) {
    for (const f of no) { const a = acharPelaChave(f, chave); if (a) return a }
    return null
  }
  if (!no || typeof no !== 'object') return null
  const d = no as Desenhado
  if (typeof d.key === 'string' && d.key.endsWith(chave)) return d
  return acharPelaChave(d.children ?? d.props?.children, chave)
}
type No = { type: string; text?: string; label?: string; props: Record<string, unknown>; path: string }
/** Monta a aba já em Sessões, com o worker devolvendo `ler()` a cada leitura. */
const montadas: { unmount: () => Promise<void> }[] = []
/** Como `test`, mas desmonta tudo o que o teste montou mesmo quando uma asserção falha: aba montada segura o processo. */
const teste = (nome: string, corpo: () => Promise<void>) => test(nome, async () => {
  try { await corpo() } finally { for (const v of montadas.splice(0)) await v.unmount() }
})
async function montar(ler: () => Leitura) {
  const v = await mount(painel, { host: mockHost({ requests: { 'kit.ler': () => ler(), 'kit.concluidas': () => ({ aptas: [], erro: null, lidoEm: Date.now() }) } }), })
  montadas.push(v)
  const nos = (q: Record<string, unknown>) => v.findAll(q) as No[]
  /** O `Box` do cartão do item (chave `s-<item>`), achado na árvore desenhada: o `find` só devolve o nó mais fundo. */
  const caixaDo = (item: string) => acharPelaChave(v.drawnTree(), `.s-${item}:s-${item}`)
  /** Os nós dentro do cartão do item: a chave entra no caminho do nó como `.s-<item>:s-<item>`. */
  const doCartao = (item: string, q: Record<string, unknown>) => {
    assert.ok(caixaDo(item), `o cartão do ${item} existe`)
    return nos(q).filter((n) => n.path.includes(`.s-${item}:s-${item}/`))
  }
  return { v, nos, doCartao, caixaDo }
}
/** O selo do cartão: a pílula (Box) com a bolinha ● e o texto do estado. `tom` é o do Text da bolinha; `forma` é o caminho dela sem a chave do cartão. */
const BOLINHA = '●'
/** O Text não tem o tom `neutral`: o selo neutro usa `muted`. */
const TOM_DO_TEXTO: Record<string, string> = { neutral: 'muted', accent: 'accent', success: 'success', warning: 'warning', danger: 'danger' }
function seloDoCartao(doCartao: (item: string, q: Record<string, unknown>) => No[], item: string) {
  const bolinhas = doCartao(item, { type: 'Text', text: BOLINHA })
  assert.equal(bolinhas.length, 1, `${item}: uma bolinha no selo`)
  const { tone, muted, ...bolinha } = bolinhas[0].props
  // A pílula é o Box mais fundo que contém a bolinha; o rótulo é o Text do estado ao lado dela.
  const caixas = doCartao(item, { type: 'Box' }).filter((b) => bolinhas[0].path.startsWith(`${b.path}/`))
  const pilula = caixas.sort((a, b) => b.path.length - a.path.length)[0]
  assert.ok(pilula, `${item}: a bolinha está dentro de uma pílula`)
  const rotulo = doCartao(item, { type: 'Text' }).find((t) => t.text !== BOLINHA && t.path.startsWith(pilula.path.replace(/\/[^/]*$/, '')) && t.path.startsWith(`${pilula.path}/`))
  assert.ok(rotulo, `${item}: o rótulo está dentro da pílula`)
  const props = JSON.stringify({ pilula: pilula.props, bolinha, rotulo: rotulo.props })
  return { tom: muted ? 'muted' : tone ?? null, props, forma: bolinhas[0].path.replace(`.s-${item}:s-${item}`, '') }
}
const semErros = (v: { errors: unknown[]; warnings: unknown[]; refusals: unknown[] }) => {
  assert.deepEqual(v.errors, [])
  assert.deepEqual(v.warnings, [])
  assert.deepEqual(v.refusals, [])
}

teste('o trilho ganha Sessões com o ícone activity; o número e o rótulo seguem as paradas', async () => {
  let paradas = 2
  const { v, nos } = await montar(() => leitura(vista([grupo('kit', [sessao('F1')])], { paradas })))
  const botao = v.find({ label: 'Sessões · 2 paradas' }) as No | null
  assert.ok(botao)
  assert.equal(botao.props.icon, 'activity')
  assert.deepEqual(nos({ type: 'Badge', text: '2' }).length, 1, 'com 2 paradas o selo aparece')
  paradas = 0
  await v.press({ label: 'Reler agora' })
  assert.ok(v.find({ label: 'Sessões · nenhuma parada' }))
  assert.equal(nos({ type: 'Badge', text: '0' }).length, 0)
  assert.equal(nos({ type: 'Badge', text: '2' }).length, 0, 'com 0 o selo some')
  semErros(v)
})

teste('com pergunta aberta a aba abre em Sessões: a faixa avisa e o cartão diz o Q-ID', async () => {
  const s = sessao('F2', { estado: 'esperando', perguntas: [{ id: 'Q5', titulo: 'F2 · pergunta Q5' }] })
  const { v } = await montar(() => leitura(vista([grupo('kit', [s])]), { abertas: [pergunta('Q5', 'F2')] }))
  assert.ok(v.find({ role: 'heading', text: 'Sessões' }))
  assert.ok(v.find({ text: '1 pergunta esperando você' }))
  assert.ok(v.find({ text: 'Q5 · pergunta Q5' }), 'a frase tira o item do título da pergunta')
  semErros(v)
})

teste('os grupos vêm na ordem dada pelo núcleo; o cabeçalho conta só as vivas; o projeto não se repete no cartão', async () => {
  const hoje = sessao('F9', { estado: 'entregue', desdeEm: iso(30 * MIN), prs: { abertos: [], mergeados: [168] } })
  const { v, nos, doCartao } = await montar(() => leitura(vista([
    grupo('izanagi', [sessao('F7', { estado: 'parada', tipoDeParada: 'gate-vermelho', motivo: 'gate vermelho no PR 1716' })]),
    grupo('kit', [sessao('F3', { estado: 'validando' }), sessao('F4'), hoje]),
  ])))
  const cabecalhos = nos({ type: 'Heading' }).map((n) => n.text)
  assert.deepEqual(cabecalhos.filter((t) => t !== 'Sessões'), ['izanagi · 1', 'kit · 2'])
  const cartoes = nos({ type: 'Text' }).filter((n) => /^F\d · título/.test(n.text ?? '') && n.props.weight === 'semibold').map((n) => n.text)
  assert.deepEqual(cartoes, ['F7 · título do F7', 'F3 · título do F3', 'F4 · título do F4'])
  assert.equal(doCartao('F3', { text: /kit/ }).length, 0)
  semErros(v)
})

teste('cada estado tem o seu selo, o seu tom e a sua frase; nenhum cartão tem borda colorida (o selo já diz a cor); só Mergeando tem Spinner', async () => {
  const casos: [Sessao, string, string, string | null][] = [
    [sessao('F1', { estado: 'esperando', perguntas: [{ id: 'Q1060', titulo: 'F1 · Mergear?' }], desdeEm: iso(5 * 60 * MIN) }), 'Espera você', 'warning', 'Q1060 · Mergear?'],
    [sessao('F2', { estado: 'esperando', motivo: 'pausado pelo operador para trocar de conta' }), 'Espera você', 'warning', 'pausado pelo operador para trocar de conta'],
    [sessao('F19', { estado: 'esperando', tipoDeEspera: 'item', motivo: 'aguarda o F462 mergear' }), 'Esperando', 'warning', 'aguarda o F462 mergear'],
    [sessao('F3', { estado: 'parada', tipoDeParada: 'conflito', motivo: 'conflito com a main' }), 'Travada', 'danger', 'conflito com a main'],
    [sessao('F4', { estado: 'parada', tipoDeParada: 'gate-vermelho', motivo: '2 testes vermelhos' }), 'Gate vermelho', 'danger', '2 testes vermelhos'],
    [sessao('F5', { estado: 'parada', tipoDeParada: 'sem-movimento', desdeEm: iso(45 * MIN) }), 'Parada', 'neutral', 'sem atividade'],
    [sessao('F6', { estado: 'parada', tipoDeParada: 'sem-movimento', dependeDe: ['F441'] }), 'Parada', 'neutral', 'depende de F441'],
    [sessao('F7', { estado: 'parada', tipoDeParada: 'falhou' }), 'Sessão falhou', 'danger', 'a sessão no Orca terminou com falha'],
    [sessao('F8', { estado: 'parada', tipoDeParada: 'sem-dona' }), 'Sem sessão', 'neutral', 'esperando a orquestradora abrir uma'],
    [sessao('F9', { estado: 'mergeando', prNaFila: 1716, desdeEm: iso(6 * MIN) }), 'Mergeando', 'accent', 'PR 1716 · gate rodando'],
    [sessao('F10', { estado: 'na-fila', prNaFila: 173, posicaoNaFila: 2 }), 'Aguardando merge', 'warning', 'PR 173 · 2º da fila'],
    [sessao('F11', { estado: 'na-fila', prNaFila: 174, foraDaFila: true }), 'PR aberto', 'warning', 'PR 174 · fora da fila de merge'],
    [sessao('F12', { estado: 'validando', agora: 'rodando o validador' }), 'Validando', 'accent', 'rodando o validador'],
    [sessao('F13', { subEtapa: 'planejamento', etapa: 'planejamento' }), 'Planejando', 'accent', null],
    [sessao('F14', { subEtapa: 'design', etapa: 'design' }), 'No design', 'accent', null],
    [sessao('F15', { fatia: { atual: 2, total: 4 }, agora: 'medindo a S6', rodando: true }), 'Executando', 'accent', 'fatia 2 de 4 · medindo a S6'],
    [sessao('F16', { fatia: { atual: 3, total: null } }), 'Executando', 'accent', 'fatia 3'],
    [sessao('F17', { estado: 'parada', tipoDeParada: 'conflito' }), 'Travada', 'danger', null],
    [sessao('F18'), 'Executando', 'accent', null],
  ]
  const { v, doCartao, caixaDo } = await montar(() => leitura(vista([grupo('kit', casos.map((c) => c[0]))])))
  for (const [s, texto, tom, frase] of casos) {
    assert.equal(doCartao(s.item, { type: 'Badge' }).length, 0, `${s.item}: o selo não é Badge (o Badge pinta cheio em 3 dos 5 tons)`)
    assert.equal(doCartao(s.item, { text: texto }).length, 1, `${s.item}: o texto do selo é só o estado, sem emoji`)
    assert.equal(seloDoCartao(doCartao, s.item).tom, TOM_DO_TEXTO[tom], `${s.item}: o tom da bolinha`)
    if (frase) assert.equal(doCartao(s.item, { text: frase }).length, 1, `${s.item}: a frase "${frase}"`)
    // Sem nota nem motivo, a frase não repete o selo: a linha fica só com o selo e o tempo.
    else assert.deepEqual(doCartao(s.item, { type: 'Text' }).map((t) => t.text), [s.nome, BOLINHA, texto, 'há 12 min'], `${s.item}: sem frase`)
    const caixa = caixaDo(s.item)
    assert.equal(caixa?.props?.border, true, `${s.item}: a borda é a comum: o selo já diz a cor`)
    assert.equal(doCartao(s.item, { type: 'Spinner' }).length, s.estado === 'mergeando' ? 1 : 0, `${s.item}: o Spinner`)
    const nome = doCartao(s.item, { text: s.nome })[0]
    assert.equal(nome.props.truncate, true, `${s.item}: o nome corta no fechado`)
  }
  assert.equal(doCartao('F9', { text: 'há 6 min' }).length, 1, 'Mergeando conta desde o início do gate')
  assert.equal(doCartao('F5', { text: 'há 45 min' }).length, 1, 'o selo já diz Parada')
  assert.equal(doCartao('F15', { text: 'agora' }).length, 1, 'a sessão do app rodando diz agora')
  assert.equal(doCartao('F12', { text: 'há 12 min' }).length, 1, 'sem rodando, o tempo')
  semErros(v)
})

teste('o mapa selo × tom cobre todo estado do núcleo e usa só os 5 tons do Orca; a cor nunca é a única pista (todo selo tem texto)', () => {
  const TONS = ['neutral', 'accent', 'success', 'warning', 'danger']
  // Os estados do núcleo × cada subtipo que ele pode dar (parada, etapa, fila): a chave de cada combinação tem selo.
  const paradas = ['conflito', 'gate-vermelho', 'outra', 'sem-movimento', 'falhou', 'sem-dona']
  const combinacoes: Sessao[] = ORDEM_DOS_ESTADOS.flatMap((estado: Sessao['estado']) => {
    if (estado === 'parada') return paradas.map((tipoDeParada) => sessao('F1', { estado, tipoDeParada }))
    if (estado === 'trabalhando') return [null, 'planejamento', 'design', 'execucao'].map((subEtapa) => sessao('F1', { estado, subEtapa }))
    if (estado === 'na-fila') return [false, true].map((foraDaFila) => sessao('F1', { estado, foraDaFila }))
    if (estado === 'esperando') return [sessao('F1', { estado }), sessao('F1', { estado, tipoDeEspera: 'item' })]
    return [sessao('F1', { estado })]
  })
  assert.ok(ORDEM_DOS_ESTADOS.length === 7 && combinacoes.length >= 15, 'o núcleo dá os estados: sem eles o teste não mede nada')
  const usadas = new Set<string>()
  for (const s of combinacoes) {
    const chave = chaveDoSelo(s)
    usadas.add(chave)
    assert.ok(SELOS[chave], `${s.estado}/${s.tipoDeParada ?? s.subEtapa ?? s.foraDaFila}: sem selo (${chave})`)
  }
  assert.deepEqual([...Object.keys(SELOS)].filter((k) => !usadas.has(k)), [], 'selo que nenhum estado do núcleo produz')
  for (const [chave, { texto, tom }] of Object.entries(SELOS)) {
    assert.ok(texto.length > 0, `${chave}: o texto diz o estado, a cor só reforça`)
    assert.ok(TONS.includes(tom), `${chave}: tom fora dos 5 do Orca`)
  }
  // O mapa selo × tom: agrupado por sentido, só com os 5 tons do Orca; o texto diz o estado.
  const porTom = (t: string) => Object.entries(SELOS).filter(([, v]) => v.tom === t).map(([k]) => k).sort()
  assert.deepEqual(porTom('accent'), ['design', 'execucao', 'mergeando', 'planejamento', 'validando'])
  assert.deepEqual(porTom('warning'), ['espera-item', 'esperando', 'na-fila', 'pr-aberto'])
  assert.deepEqual(porTom('success'), ['entregue'])
  assert.deepEqual(porTom('danger'), ['falhou', 'gate-vermelho', 'travada'])
  assert.deepEqual(porTom('neutral'), ['sem-dona', 'sem-movimento'])
  assert.ok(Object.values(SELOS).every((v) => !/\p{Extended_Pictographic}/u.test(v.texto)), 'sem emoji no selo')
})

teste('todo selo passa pelo mesmo desenho: pílula com contorno, bolinha no tom do sentido e o texto; só o tom muda', async () => {
  const chaves = Object.keys(SELOS)
  const sessoes = chaves.map((chave, i) => {
    const base = { estado: 'trabalhando', subEtapa: null } as Partial<Sessao>
    const porChave: Record<string, Partial<Sessao>> = {
      esperando: { estado: 'parada', tipoDeParada: 'esperando' }, 'espera-item': { estado: 'esperando', tipoDeEspera: 'item' }, travada: { estado: 'parada', tipoDeParada: 'travada' },
      'gate-vermelho': { estado: 'parada', tipoDeParada: 'gate-vermelho' }, 'sem-movimento': { estado: 'parada', tipoDeParada: 'sem-movimento' },
      falhou: { estado: 'parada', tipoDeParada: 'falhou' }, 'sem-dona': { estado: 'parada', tipoDeParada: 'sem-dona' },
      mergeando: { estado: 'mergeando' }, 'na-fila': { estado: 'na-fila', foraDaFila: false }, 'pr-aberto': { estado: 'na-fila', foraDaFila: true },
      validando: { estado: 'validando' }, planejamento: { subEtapa: 'planejamento' }, design: { subEtapa: 'design' }, execucao: { subEtapa: 'execucao' },
      entregue: { estado: 'entregue' },
    }
    return sessao(`F${i + 1}`, { ...base, ...porChave[chave] })
  })
  assert.ok(chaves.length >= 14, 'o mapa tem os selos: sem eles o teste não mede nada')
  sessoes.forEach((s, i) => assert.equal(chaveDoSelo(s), chaves[i], `${s.item}: a sessão de teste cai no selo ${chaves[i]}`))
  const { v, doCartao } = await montar(() => leitura(vista([grupo('kit', sessoes)])))
  const formas = new Set<string>()
  const desenhos = new Set<string>()
  const tons = new Set<string>()
  chaves.forEach((chave, i) => {
    if (chave === 'entregue') return // o entregue mora na seção recolhida "Entregues hoje": não tem cartão aberto
    const item = sessoes[i].item
    const { tom, forma, props } = seloDoCartao(doCartao, item)
    formas.add(forma)
    desenhos.add(props)
    tons.add(String(tom))
    assert.equal(tom, TOM_DO_TEXTO[SELOS[chave].tom], `${chave}: a bolinha leva o tom do sentido`)
    assert.equal(doCartao(item, { type: 'Badge' }).length, 0, `${chave}: nenhum Badge no cartão`)
    assert.equal(doCartao(item, { text: SELOS[chave].texto }).length, 1, `${chave}: o texto diz o estado`)
  })
  assert.equal(formas.size, 1, `um desenho só: ${[...formas].join(' | ')}`)
  assert.deepEqual([...tons].sort(), ['accent', 'danger', 'muted', 'warning'], 'os sentidos dos cartões abertos aparecem (o verde é só do Entregue, recolhido)')
  assert.equal(desenhos.size, 1, `as props da pílula, da bolinha (sem o tom) e do rótulo são as mesmas em todo selo: ${[...desenhos].join(' | ')}`)
  const [{ pilula }] = [...desenhos].map((d) => JSON.parse(d))
  assert.equal(pilula.border, 'neutral', 'a pílula tem contorno')
  assert.equal(pilula.radius, 'full', 'a pílula tem cantos redondos')
  semErros(v)
})

teste('abrir mostra o nome inteiro e os blocos; continua aberto depois de uma releitura que muda o estado e a ordem', async () => {
  let estado: Sessao['estado'] = 'trabalhando'
  const ler = () => leitura(vista([grupo('kit', [
    sessao('F1'),
    sessao('F441', {
      estado, tipoDeParada: estado === 'parada' ? 'conflito' : null, motivo: estado === 'parada' ? 'conflito com a main no protocol.ts' : null,
      agora: 'medindo a S6', notaEm: iso(2 * 60 * MIN), dependeDe: ['F440'],
      prs: { abertos: [173], mergeados: [160, 165, 168, 150, 151] },
    }),
  ].sort(() => (estado === 'parada' ? -1 : 0)))]))
  const { v, doCartao } = await montar(ler)
  assert.equal(doCartao('F441', { text: 'Nota da sessão · há 2 h' }).length, 0, 'fechado não mostra a nota')
  await v.press({ label: 'Abrir F441' })
  assert.equal(doCartao('F441', { text: 'F441 · título do F441' })[0].props.truncate, false)
  assert.equal(doCartao('F441', { text: 'Nota da sessão · há 2 h' }).length, 1)
  assert.equal(doCartao('F441', { text: 'PR 173 aberto · PRs 168, 165, 160 e mais 2 mergeados' }).length, 1)
  assert.equal(doCartao('F441', { text: 'Depende de F440, ainda aberto.' }).length, 1)
  estado = 'parada'
  await v.press({ label: 'Reler agora' })
  assert.ok(v.find({ label: 'Fechar F441' }), 'continua aberto')
  assert.equal(doCartao('F441', { text: 'Motivo: conflito com a main no protocol.ts' }).length, 1)
  await v.press({ label: 'Fechar F441' })
  assert.ok(v.find({ label: 'Abrir F441' }))
  semErros(v)
})

teste('Responder em Perguntas troca a seção', async () => {
  const s = sessao('F2', { estado: 'esperando', perguntas: [{ id: 'Q5', titulo: 'F2 · pergunta Q5' }] })
  const { v } = await montar(() => leitura(vista([grupo('kit', [s])])))
  await v.press({ label: 'Abrir F2' })
  await v.press({ role: 'button', text: 'Responder em Perguntas' })
  assert.ok(v.find({ role: 'button', text: 'Aceitar a recomendação' }) || v.find({ role: 'heading', text: 'Perguntas' }))
  semErros(v)
})

teste('espera sem pergunta: o cartão aberto diz o motivo e onde retomar', async () => {
  const s = sessao('F442', { estado: 'esperando', motivo: 'pausado pelo operador para trocar de conta' })
  const { v, doCartao } = await montar(() => leitura(vista([grupo('kit', [s])])))
  assert.equal(doCartao('F442', { text: 'Retome na sessão do F442.' }).length, 0, 'fechado não diz')
  await v.press({ label: 'Abrir F442' })
  assert.equal(doCartao('F442', { text: 'Motivo: pausado pelo operador para trocar de conta' }).length, 1)
  assert.equal(doCartao('F442', { text: 'Retome na sessão do F442.' }).length, 1)
  assert.equal(doCartao('F442', { role: 'button', text: 'Responder em Perguntas' }).length, 0)
  semErros(v)
})

teste('espera por item: o cartão aberto diz o motivo e não manda o operador retomar nada', async () => {
  const s = sessao('F442', { estado: 'esperando', tipoDeEspera: 'item', motivo: 'aguarda o F462 mergear' })
  const { v, doCartao } = await montar(() => leitura(vista([grupo('kit', [s])])))
  assert.equal(doCartao('F442', { text: 'Espera você' }).length, 0, 'o selo da pessoa não vale: quem espera é o item')
  assert.equal(doCartao('F442', { text: 'Esperando' }).length, 1)
  await v.press({ label: 'Abrir F442' })
  assert.equal(doCartao('F442', { text: 'Motivo: aguarda o F462 mergear' }).length, 1)
  assert.equal(doCartao('F442', { text: 'Retome na sessão do F442.' }).length, 0, 'não há nada a retomar: a sessão espera o outro item')
  semErros(v)
})

teste('as bolinhas: feita em verde, a de agora em destaque com o estado, a que falta só com contorno', async () => {
  const fatias = sessao('F1', {
    fatia: { atual: 2, total: 4 }, estado: 'validando',
    etapas: [{ nome: 'Contrato', estado: 'feito' }, { nome: 'Lista de sessões', estado: 'agora' }, { nome: 'Bolinhas', estado: 'falta' }, { nome: 'Dobra', estado: 'falta' }],
  })
  const esteira = sessao('F2', {
    subEtapa: 'design', etapa: 'design',
    etapas: ['planejamento', 'execução', 'validação', 'merge', 'entregue'].map((nome, i) => ({ nome, estado: i === 0 ? 'agora' : 'falta' })),
  })
  const muitas = sessao('F3', {
    fatia: { atual: 6, total: 12 }, feitasJuntas: 5, maisBolinhas: 1,
    etapas: [{ nome: 'F6', estado: 'agora' }, ...['a', 'b', 'c', 'd', 'e'].map((nome) => ({ nome, estado: 'falta' as const }))],
  })
  const tudo = sessao('F4', { fatia: { atual: 2, total: 2 }, todasFeitas: true, etapas: [{ nome: 'um', estado: 'feito' }, { nome: 'dois', estado: 'feito' }] })
  const travada = sessao('F5', { estado: 'parada', tipoDeParada: 'conflito', etapas: ['planejamento', 'execução'].map((nome, i) => ({ nome, estado: i === 0 ? 'feito' : 'agora' })) })
  const noMerge = () => ['planejamento', 'execução', 'validação', 'merge', 'entregue'].map((nome, k) => ({ nome, estado: k < 3 ? 'feito' as const : k === 3 ? 'agora' as const : 'falta' as const }))
  const naFila = sessao('F6', { estado: 'na-fila', etapa: 'merge', prNaFila: 173, posicaoNaFila: 2, etapas: noMerge() })
  const foraDaFila = sessao('F7', { estado: 'na-fila', etapa: 'merge', prNaFila: 174, foraDaFila: true, etapas: noMerge() })
  const mergeando = sessao('F8', { estado: 'mergeando', etapa: 'merge', prNaFila: 175, etapas: noMerge() })
  const { v, doCartao } = await montar(() => leitura(vista([grupo('kit', [fatias, esteira, muitas, tudo, travada, naFila, foraDaFila, mergeando])])))
  for (const item of ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8']) await v.press({ label: `Abrir ${item}` })
  const bolinhas = (item: string) => doCartao(item, { type: 'Box' }).filter((n) => n.props.width === 8)
  assert.deepEqual(bolinhas('F1').map((b) => [b.props.background ?? null, b.props.border ?? null]), [['success', null], ['accent', null], [null, 'neutral'], [null, 'neutral']])
  const rotulo = (item: string, t: string) => doCartao(item, { text: t })[0]
  assert.equal(rotulo('F1', 'Contrato').props.muted, true)
  assert.equal(rotulo('F1', 'Lista de sessões — validando').props.weight, 'semibold')
  assert.notEqual(rotulo('F1', 'Bolinhas').props.muted, true)
  assert.ok(rotulo('F2', 'planejamento · design'), 'design ocupa a bolinha de planejamento')
  assert.equal(bolinhas('F2').length, 5)
  assert.ok(rotulo('F3', 'Fatias 1 a 5 feitas'))
  assert.ok(rotulo('F3', 'e mais 1'))
  assert.equal(bolinhas('F3').length, 7, 'a das feitas juntas, a de agora e 5 que faltam')
  assert.ok(rotulo('F4', 'Todas as fatias têm PR mergeado; o item segue aberto.'))
  assert.ok(rotulo('F4', 'as 2 fatias mergeadas'), 'a 2ª linha não diz "fatia 2 de 2" quando todas entraram')
  assert.ok(rotulo('F5', 'execução · travada'))
  // Na bolinha do merge, o estado diz o que falta, não repete a etapa; a sigla PR não vira minúscula.
  assert.ok(rotulo('F6', 'merge · 2º da fila'))
  assert.ok(rotulo('F7', 'merge · fora da fila'))
  assert.ok(rotulo('F8', 'merge · gate rodando'))
  const textos = ['F6', 'F7', 'F8'].flatMap((i) => doCartao(i, { type: 'Text' }).map((t) => t.text ?? ''))
  assert.ok(textos.length > 0)
  assert.deepEqual(textos.filter((t) => /\bpr\b|merge · (mergeando|na fila)/.test(t)), [])
  semErros(v)
})

teste('entregues de hoje ficam na dobra do grupo, com a hora de SP e o PR; Ver em Entregas troca a seção', async () => {
  const s = sessao('F432', { estado: 'entregue', desdeEm: '2026-11-06T17:05:00Z', prs: { abertos: [], mergeados: [168] } })
  const { v, nos, caixaDo } = await montar(() => leitura(vista([grupo('kit', [s])])))
  assert.ok(v.find({ label: 'Nenhuma sessão trabalhando agora' }), 'sem viva, o vazio')
  assert.ok(v.find({ text: 'kit · 0' }))
  const dobra = nos({ type: 'Collapsible' })
  assert.equal(dobra.length, 1)
  assert.equal(dobra[0].props.title, 'Entregues hoje · 1')
  await v.toggle({ type: 'Collapsible' })
  assert.ok(v.find({ text: '14:05 · PR 168' }))
  assert.equal(caixaDo('F432'), null, 'a entregue não vira cartão')
  await v.press({ role: 'button', text: 'Ver em Entregas' })
  assert.ok(v.find({ role: 'heading', text: 'Entregas' }))
  semErros(v)
})

test('o início do dia é a meia-noite de SP: 22:30 de ontem fica fora, 00:10 de hoje entra', () => {
  const agora = Date.parse('2026-11-06T15:00:00Z')
  const desde = inicioDoDiaSP(agora)
  assert.equal(new Date(desde).toISOString(), '2026-11-06T03:00:00.000Z')
  assert.ok(Date.parse('2026-11-06T01:30:00Z') < desde, '22:30 de ontem em SP')
  assert.ok(Date.parse('2026-11-06T03:10:00Z') >= desde, '00:10 de hoje em SP')
  assert.equal(new Date(inicioDoDiaSP(Date.parse('2026-11-07T02:30:00Z'))).toISOString(), '2026-11-06T03:00:00.000Z', '23:30 em SP ainda é o dia 6')
  assert.equal(tempoDaSessao({ estado: 'trabalhando', desdeEm: null, rodando: false }, agora), '')
})

teste('sem nenhuma sessão: o vazio da seção', async () => {
  const { v } = await montar(() => leitura(vista([])))
  assert.ok(v.find({ label: 'Nenhuma sessão trabalhando agora' }))
  semErros(v)
})

teste('a faixa do estado velho: nada com 12 min (a batida é de 10 em 10), o aviso com 16 min, o texto do declarado com 30 min', async () => {
  let batida = 16 * MIN
  const { v, nos } = await montar(() => leitura(vista([grupo('kit', [sessao('F1')])], { batidaEm: iso(batida) })))
  const faixas = () => nos({ type: 'Callout' })
  assert.equal(faixas().length, 1, 'com 16 min a faixa aparece')
  assert.ok(v.find({ text: 'O estado das sessões não se atualiza há 16 min. Etapa, PRs e paradas podem estar atrasados; a fila e as perguntas estão em dia.' }))
  batida = 12 * MIN
  await v.press({ label: 'Reler agora' })
  assert.equal(faixas().length, 0, 'com 12 min, sem faixa')
  batida = 30 * MIN
  await v.press({ label: 'Reler agora' })
  assert.ok(v.find({ text: 'O estado das sessões não se atualiza há 30 min. As etapas abaixo são as que as sessões gravaram.' }))
  semErros(v)
})

teste('as sessões não lidas: a faixa de erro no lugar da lista, e as outras seções seguem', async () => {
  const { v } = await montar(() => leitura(vista([], { erro: 'o arquivo do item está corrompido' }), { entregas: [] }))
  assert.ok(v.find({ text: 'Não li as sessões: o arquivo do item está corrompido.' }))
  assert.ok(v.find({ role: 'button', text: 'Tentar de novo' }))
  assert.equal(v.find({ label: 'Nenhuma sessão trabalhando agora' }), null)
  await v.press({ label: 'Entregas · nenhuma nova' })
  assert.ok(v.find({ text: 'Nenhuma entrega nos últimos 7 dias' }))
  semErros(v)
})

teste('as sessões não lidas numa releitura: o trilho guarda as paradas da última leitura boa e diz que não leu', async () => {
  let erro: string | null = null
  const { v, nos } = await montar(() => leitura(vista([grupo('kit', [sessao('F1')])], erro ? { erro, paradas: 0, projetos: [] } : { paradas: 2 })))
  assert.equal(nos({ type: 'Badge', text: '2' }).length, 1)
  erro = 'o arquivo do item está corrompido'
  await v.press({ label: 'Reler agora' })
  assert.ok(v.find({ text: 'Não li as sessões: o arquivo do item está corrompido.' }), 'a releitura trouxe o erro')
  assert.equal(nos({ type: 'Badge', text: '2' }).length, 1, 'o número não cai a zero no erro')
  assert.ok(v.find({ label: 'Sessões · não li as sessões' }))
  assert.equal(v.find({ label: 'Sessões · nenhuma parada' }), null)
  semErros(v)
})

teste('a fila de merge ilegível num projeto: a linha sob o cabeçalho e o cartão como PR aberto', async () => {
  const s = sessao('F439', { estado: 'na-fila', prNaFila: 173, foraDaFila: true, etapa: 'merge' })
  const { v, doCartao } = await montar(() => leitura(vista([grupo('kit', [s], { filaIlegivel: true }), grupo('izanagi', [sessao('F1')])])))
  assert.equal(v.findAll({ text: 'Não li a fila de merge deste projeto.' }).length, 1)
  assert.equal(doCartao('F439', { text: 'PR aberto' }).length, 1)
  semErros(v)
})

teste('nenhum texto da seção cita SPEC, ADR, arquivo .md nem batida', async () => {
  const s = [
    sessao('F1', { estado: 'esperando', motivo: 'pausado', agora: 'nota', notaEm: iso(MIN), dependeDe: ['F2'], prs: { abertos: [1], mergeados: [2] }, etapas: [{ nome: 'execução', estado: 'agora' }] }),
    sessao('F3', { estado: 'entregue', desdeEm: iso(MIN), prs: { abertos: [], mergeados: [3] } }),
  ]
  const { v, nos } = await montar(() => leitura(vista([grupo('kit', s, { filaIlegivel: true })], { batidaEm: iso(30 * MIN) })))
  await v.press({ label: 'Abrir F1' })
  await v.toggle({ type: 'Collapsible' })
  const textos = nos({}).flatMap((n) => [n.text, n.label, n.props.title, n.props.description]).filter((t): t is string => typeof t === 'string' && t.length > 0)
  assert.ok(textos.length > 10, 'a lista de textos não está vazia')
  assert.deepEqual(textos.filter((t) => /SPEC|ADR|\.md\b|batida/i.test(t)), [])
  semErros(v)
})

teste('com muitas fatias todas mergeadas o cartão aberto mostra as feitas e o aviso; PR fora da fila sem número', async () => {
  const todas = sessao('F1', {
    fatia: { atual: 9, total: 9 }, todasFeitas: true, feitasJuntas: 8, etapas: [{ nome: 'fatia 9', estado: 'feito' }],
  })
  const semNumero = sessao('F2', { estado: 'na-fila', etapa: 'merge', prNaFila: null, foraDaFila: true })
  const { v, doCartao } = await montar(() => leitura(vista([grupo('kit', [todas, semNumero])])))
  await v.press({ label: 'Abrir F1' })
  const textos = (item: string) => doCartao(item, { type: 'Text' }).map((t) => t.text ?? '')
  assert.ok(textos('F1').includes('Fatias 1 a 8 feitas'), JSON.stringify(textos('F1')))
  assert.ok(textos('F1').includes('fatia 9'))
  assert.ok(textos('F1').includes('Todas as fatias têm PR mergeado; o item segue aberto.'))
  assert.ok(textos('F2').includes('fora da fila de merge'), JSON.stringify(textos('F2')))
  assert.deepEqual(textos('F2').filter((t) => /null|undefined/.test(t)), [])
  semErros(v)
})
