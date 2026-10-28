import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'
import {
  AVISO_VALE_MS,
  ESPERE_MAX_MS,
  GLIFO_REINICIO,
  PODE_MAX_MS,
  PRIMEIRA_CONFERENCIA_MS,
  PROPRIA_TRABALHANDO,
  estadoDoReinicio,
  faixaDaBarra,
  larguraDaFaixa,
  pecasDaBarra,
  proximoDaVigia,
  vigiaSumiu,
} from '../hooks/barra.js'
import type { ArquivoDeReinicio, AvisoDeReinicio, EstadoBarra } from '../hooks/barra.js'
import { BOTAO_DO_KIT, MOTIVOS_NO_BLOCO, contagemDoReinicio, fraseDaAplicacao, fraseDoKit, kitSvg, reinicioSvg } from '../hooks/desenho.js'
import { motivoCurtoDoKit } from '../hooks/register.js'

const EU = 'local_eu'
const OUTRA = 'local_outra'
const HOME = '/home/teste'
const BATIDA = `${HOME}/.claude/orquestracao/batida`
const ARQ = `${BATIDA}/pode-reiniciar.json`
const AVISO = `${BATIDA}/aviso-de-reinicio.json`
const PASTA = `${HOME}/.claude/orquestracao/painel`
const INSTALADOS = `${HOME}/.claude/plugins/installed_plugins.json`
const AGORA = Date.UTC(2026, 9, 27, 12)
const MIN = 60_000
const iso = (ms: number) => new Date(ms).toISOString()

type Motivo = ArquivoDeReinicio['motivos'][number]
const sessao = (n: number, titulo = `E${n} · tela`): Motivo => ({ tipo: 'sessao', texto: `${titulo} trabalhando`, localId: `local_${n}` })
const teste: Motivo = { tipo: 'teste', texto: 'teste de alfa em apps-web (2 fichas)' }
const merge: Motivo = { tipo: 'merge', texto: 'merge/rebase no meio: gh pr merge 63 --squash' }
const arquivo = (motivos: Motivo[], idadeMin = 0, extra: Partial<ArquivoDeReinicio> = {}, agora = AGORA): ArquivoDeReinicio => ({
  pode: motivos.length === 0,
  motivos,
  sessoesDe: 'lista',
  em: iso(agora - idadeMin * MIN),
  listaEm: iso(agora - idadeMin * MIN),
  ...extra,
})
const aviso = (extra: Partial<AvisoDeReinicio> = {}, agora = AGORA): AvisoDeReinicio => ({ ligadoEm: iso(agora - 10 * MIN), vigia: EU, naoPodeSeguidos: 0, ...extra })
const estado = (a: ArquivoDeReinicio | null, av: AvisoDeReinicio | null, extra: Partial<Parameters<typeof estadoDoReinicio>[0]> = {}) =>
  estadoDoReinicio({ arquivo: a, aviso: av, eu: EU, trabalhandoEu: false, agora: AGORA, ...extra })

// ---- estadoDoReinicio: a régua de idade e a própria sessão ao vivo ----

test('estadoDoReinicio: "pode" só com arquivo e lista de até 2 min; "espere" vale até 15; fora disso, não sei', () => {
  expect(PODE_MAX_MS).toBe(2 * MIN)
  expect(ESPERE_MAX_MS).toBe(15 * MIN)
  expect(estado(arquivo([]), null).estado, 'agora').toBe('pode')
  expect(estado(arquivo([], 2), null).estado, 'exatamente 2 min').toBe('pode')
  expect(estado(arquivo([], 3), null).estado, 'com 3 min nunca "pode"').toBe('sem-dado')
  expect(estado(arquivo([], 0, { listaEm: iso(AGORA - 3 * MIN) }), null).estado, 'arquivo novo com a lista de 3 min: o "pode" mede a lista').toBe('sem-dado')
  expect(estado(arquivo([sessao(1)], 14), null).estado).toBe('espere')
  expect(estado(arquivo([sessao(1)], 15), null).estado, 'o limite').toBe('espere')
  const velho = estado(arquivo([sessao(1)], 16), null)
  expect(velho.estado).toBe('sem-dado')
  expect(velho.razao).toBe('a última conferência é de há 16 min')
  expect(estado(arquivo([], 0, { listaEm: undefined }), null).estado, 'sem listaEm vale o instante do arquivo').toBe('pode')
})

test('estadoDoReinicio: sem arquivo (ou com erro de comando) é não sei, com a razão', () => {
  expect(estado(null, null)).toMatchObject({ estado: 'sem-dado', razao: 'ainda não conferi', rodando: 0 })
  expect(estado(null, null, { erro: true }).razao).toBe('não consegui conferir agora')
  expect(estado(arquivo([sessao(1)], 30), null, { erro: true }).razao).toBe('não consegui conferir agora')
})

test('estadoDoReinicio: conferindo só do clique até a 1ª conferência (e só com o aviso ligado)', () => {
  const recem = aviso({ ligadoEm: iso(AGORA - 20_000) })
  expect(estado(null, recem).estado).toBe('conferindo')
  expect(estado(arquivo([], 5), recem).estado, 'arquivo de antes do clique ainda não vale').toBe('conferindo')
  expect(estado(arquivo([sessao(1)], 0), recem).estado, 'depois da conferência, o que ela diz').toBe('espere')
  expect(estado(null, aviso({ ligadoEm: iso(AGORA - PRIMEIRA_CONFERENCIA_MS - 1) })).estado, 'a vigia sumiu: não sei, nunca conferindo').toBe('sem-dado')
  expect(estado(null, null).estado, 'sem aviso nunca é conferindo').toBe('sem-dado')
})

test('estadoDoReinicio: a própria sessão é ao vivo (o motivo do arquivo sai, o de agora entra)', () => {
  const doArquivo = arquivo([{ tipo: 'sessao', texto: 'E3 · eu trabalhando', localId: EU }])
  expect(estado(doArquivo, null).estado, 'o arquivo diz que eu rodava, mas agora estou parada: pode').toBe('pode')
  const trabalhando = estado(arquivo([]), null, { trabalhandoEu: true })
  expect(trabalhando.estado, 'a sessão que trabalha nunca diz "pode"').toBe('espere')
  expect(trabalhando.motivos.map(m => m.texto)).toEqual([PROPRIA_TRABALHANDO])
  expect(trabalhando.rodando).toBe(1)
  const dois = estado(arquivo([sessao(7), { tipo: 'sessao', texto: 'E3 · eu trabalhando', localId: EU }]), null, { trabalhandoEu: true })
  expect(dois.rodando, 'a própria não conta em dobro').toBe(2)
})

test('estadoDoReinicio: motivos em ordem merge, teste, sessão; a própria sessão primeiro entre as sessões', () => {
  const r = estado(arquivo([sessao(7), teste, sessao(8), merge]), null, { trabalhandoEu: true })
  expect(r.motivos.map(m => m.tipo)).toEqual(['merge', 'teste', 'sessao', 'sessao', 'sessao'])
  expect(r.motivos[2]?.texto).toBe(PROPRIA_TRABALHANDO)
  expect(r.rodando).toBe(5)
  expect(r.conferidoEm).toBe(AGORA)
})

// ---- proximoDaVigia: notificar uma vez, rearmar, desligar ----

test('proximoDaVigia: notifica uma vez ao passar a poder, rearma com dois "não pode" seguidos e avisa de novo', () => {
  let a: AvisoDeReinicio | null = aviso()
  const passo = (e: 'pode' | 'espere' | 'sem-dado', t = AGORA) => {
    const r = proximoDaVigia({ aviso: a as AvisoDeReinicio, estado: e, agora: t })
    a = r.aviso

    return r.notificar
  }
  expect(passo('pode'), 'passou a poder: avisa').toBe(true)
  expect(a?.avisadoEm).toBe(iso(AGORA))
  expect(passo('pode', AGORA + MIN), 'segunda volta ainda pode: nada').toBe(false)
  expect(passo('espere', AGORA + 2 * MIN)).toBe(false)
  expect(a?.avisadoEm, 'um "não pode" só não rearma (não pisca)').toBeDefined()
  expect(passo('pode', AGORA + 3 * MIN), 'voltou a poder sem rearmar: nada').toBe(false)
  expect(passo('espere', AGORA + 4 * MIN)).toBe(false)
  expect(passo('espere', AGORA + 5 * MIN)).toBe(false)
  expect(a?.avisadoEm, 'dois seguidos rearmam').toBeUndefined()
  expect(passo('pode', AGORA + 6 * MIN), 'e avisa de novo').toBe(true)
})

test('proximoDaVigia: sem dado não muda nada; 30 min depois do aviso, ainda podendo, desliga sem notificar', () => {
  const a = aviso({ avisadoEm: iso(AGORA - 10 * MIN), naoPodeSeguidos: 1 })
  expect(proximoDaVigia({ aviso: a, estado: 'sem-dado', agora: AGORA })).toEqual({ aviso: a, notificar: false })
  expect(proximoDaVigia({ aviso: { ...a, avisadoEm: iso(AGORA - AVISO_VALE_MS) }, estado: 'pode', agora: AGORA })).toEqual({ aviso: null, notificar: false })
  expect(proximoDaVigia({ aviso: { ...a, avisadoEm: iso(AGORA - AVISO_VALE_MS + MIN) }, estado: 'pode', agora: AGORA }).aviso, 'um minuto antes ainda vale').not.toBeNull()
})

test('vigiaSumiu mede a conferência DA VIGIA (vigiaEm), não o arquivo que qualquer pane renova (M2)', () => {
  const velha = aviso({ ligadoEm: iso(AGORA - 30 * MIN), vigiaEm: iso(AGORA - 20 * MIN) })
  expect(vigiaSumiu({ aviso: velha, agora: AGORA }), 'vigiaEm de 20 min: assume').toBe(true)
  expect(vigiaSumiu({ aviso: aviso({ ligadoEm: iso(AGORA - 30 * MIN), vigiaEm: iso(AGORA - 2 * MIN) }), agora: AGORA }), 'vigiaEm de 2 min: viva').toBe(false)
  expect(vigiaSumiu({ aviso: aviso({ ligadoEm: iso(AGORA - 30 * MIN), vigiaEm: iso(AGORA - 3 * MIN) }), agora: AGORA }), 'exatamente 3 min').toBe(true)
  expect(vigiaSumiu({ aviso: aviso({ ligadoEm: iso(AGORA - 10 * MIN) }), agora: AGORA }), 'sem vigiaEm vale o clique').toBe(true)
  expect(vigiaSumiu({ aviso: aviso({ ligadoEm: iso(AGORA - MIN) }), agora: AGORA }), 'acabou de ligar').toBe(false)
})

// ---- a peça da barra: texto, glifo, largura reservada e nunca cai ----

const REF: EstadoBarra = {
  relogio: '47:12', bloco: false, tokens: 142_000, janela: 600_000, regua: { aviso: 200_000, teto: 300_000 }, item: 'F52 · design', donas: 'donas 2',
  abertas: 3, modo: 'ausente', trocando: false, painelAberto: true, moldura: false, ehOrquestradora: false, limpando: false,
}
const ORQ: EstadoBarra = { ...REF, tokens: 198_000, regua: { aviso: 150_000, teto: 150_000 }, item: null, modo: 'presente', painelAberto: false, ehOrquestradora: true }

test('a peça do reinício: o texto de cada estado, no começo do grupo da direita, e sem aviso não há peça', () => {
  const peca = (reinicio: EstadoBarra['reinicio'], rodando = 0) => pecasDaBarra({ ...REF, reinicio, rodando }, 0).dir[0]
  expect(peca('esperando', 3)).toEqual({ k: 'reinicio', t: '⏻ 3 rodando' })
  expect(peca('esperando', 1)?.t).toBe('⏻ 1 rodando')
  expect(peca('pode')?.t).toBe('⏻ Pode reiniciar')
  expect(peca('conferindo')?.t).toBe('⏻ conferindo')
  expect(peca('sem-dado')?.t).toBe('⏻ não sei')
  expect(pecasDaBarra(REF, 0).dir.some(p => p.k === 'reinicio'), 'sem aviso, nada').toBe(false)
  expect(pecasDaBarra({ ...REF, reinicio: null }, 0).dir.some(p => p.k === 'reinicio')).toBe(false)
  expect(GLIFO_REINICIO.g).toBe('⏻')
  expect(peca('pode')?.t[0], 'o glifo do texto e o da constante concordam').toBe(GLIFO_REINICIO.g)
  expect(pecasDaBarra({ ...REF, reinicio: 'pode' }, 0).dir.map(p => p.k)).toEqual(['reinicio', 'perguntas', 'modo', 'painel'])
})

test('a peça do reinício nunca cai: está em todas as faixas', () => {
  for (const f of [0, 1, 2] as const) {
    expect(pecasDaBarra({ ...REF, reinicio: 'esperando', rodando: 2 }, f).dir[0]?.k, `faixa ${f}`).toBe('reinicio')
    expect(pecasDaBarra({ ...ORQ, reinicio: 'esperando', rodando: 2 }, f).dir[0]?.k, `orquestradora, faixa ${f}`).toBe('reinicio')
  }
})

test('larguraDaFaixa: a peça soma 17 (16 do ⏻ Pode reiniciar + 1 de vão) em toda faixa, em qualquer estado', () => {
  for (const f of [0, 1, 2] as const) {
    const sem = larguraDaFaixa(ORQ, f)
    for (const [reinicio, rodando] of [['esperando', 3], ['pode', 0], ['conferindo', 0], ['sem-dado', 0]] as const) {
      expect(larguraDaFaixa({ ...ORQ, reinicio, rodando }, f), `${reinicio}, faixa ${f}`).toBe(sem + 17)
    }
  }
  expect([0, 1, 2].map(f => larguraDaFaixa({ ...ORQ, reinicio: 'pode' }, f as 0 | 1 | 2)), 'a orquestradora da base (123/105/62) + 17').toEqual([140, 122, 79])
  expect(larguraDaFaixa({ ...REF, reinicio: 'esperando', rodando: 12 }, 0), 'a largura não muda com o número').toBe(larguraDaFaixa({ ...REF, reinicio: 'pode' }, 0))
})

test('faixaDaBarra: com o aviso ligado a orquestradora no limpar cai da faixa 1 para a 2 a 114 colunas; sem ele fica na 1', () => {
  expect(faixaDaBarra(114, ORQ)).toBe(1)
  expect(faixaDaBarra(114, { ...ORQ, reinicio: 'esperando', rodando: 2 }), 'a faixa 1 soma 122').toBe(2)
  expect(faixaDaBarra(122, { ...ORQ, reinicio: 'esperando', rodando: 2 })).toBe(1)
  expect(faixaDaBarra(142, { ...ORQ, reinicio: 'pode' })).toBe(0)
})

// ---- reinicioSvg ----

const motivos5: Motivo[] = [merge, teste, sessao(1), sessao(2), sessao(3)]
const desenho = (estadoDe: 'pode' | 'espere' | 'conferindo' | 'sem-dado', ms: Motivo[], avisoDe: { avisadoEm?: string } | null, razao?: string) =>
  reinicioSvg(288, { estado: estadoDe, rodando: ms.length, motivos: ms, conferidoEm: AGORA, razao, aviso: avisoDe })

test('reinicioSvg sem aviso: UMA linha de 20 px, e o alt traz a contagem por tipo no plural certo', () => {
  const espere = desenho('espere', [teste, sessao(1), sessao(2), sessao(3), sessao(4)], null)
  expect(espere.height).toBe(20)
  expect(espere.source).toContain('Reiniciar: espere · 5 rodando')
  expect(espere.alt).toBe('Reiniciar o app: espere, 5 rodando — 4 sessões trabalhando, 1 teste.')
  expect(desenho('espere', [sessao(1), merge], null).alt).toBe('Reiniciar o app: espere, 2 rodando — 1 sessão trabalhando, 1 merge.')
  expect(contagemDoReinicio([merge, merge, teste, teste])).toBe('2 testes, 2 merges')
  const pode = desenho('pode', [], null)
  expect(pode.height).toBe(20)
  expect(pode.source).toContain('Pode reiniciar o app')
  expect(pode.source).toContain('· conferido às ')
  const naoSei = desenho('sem-dado', [], null, 'a última conferência é de há 16 min')
  expect(naoSei.height).toBe(20)
  expect(naoSei.source).toContain('Reiniciar: não sei')
  expect(naoSei.alt, 'a razão vai no alt').toContain('a última conferência é de há 16 min')
  expect(espere.source, 'sem aviso os motivos não aparecem').not.toContain('merge/rebase')
})

test('reinicioSvg: o plugin do kit esperando o reinício vira uma linha azul a mais, sem e com aviso; sem ela a altura não muda (F209)', () => {
  const um = [{ nome: 'orquestracao', versao: '0.1.41' }]
  const sem = reinicioSvg(288, { estado: 'espere', rodando: 1, motivos: [teste], conferidoEm: AGORA, aviso: null })
  expect(sem.source).not.toContain('aplicar')
  const com = reinicioSvg(288, { estado: 'espere', rodando: 1, motivos: [teste], conferidoEm: AGORA, aviso: null, paraAplicar: um })
  expect(com.height).toBe(sem.height + 18)
  expect(com.source).toContain('↑ Pronta para aplicar · orquestracao 0.1.41<')
  expect(com.alt).toContain('Pronta para aplicar ao reiniciar o app: orquestracao 0.1.41.')
  const comAviso = reinicioSvg(288, { estado: 'pode', rodando: 0, motivos: [], conferidoEm: AGORA, aviso: {}, paraAplicar: um })
  const semAviso = reinicioSvg(288, { estado: 'pode', rodando: 0, motivos: [], conferidoEm: AGORA, aviso: {} })
  expect(comAviso.height).toBe(semAviso.height + 16)
  expect(comAviso.source, 'na moldura estreita sai a instrução, nunca a versão').toContain('↑ Pronta para aplicar · orquestracao 0.1.41<')
  expect(fraseDaAplicacao(um, 235), 'mais estreito ainda, encolhem as palavras').toBe('↑ Para aplicar · orquestracao 0.1.41')
  const largo = reinicioSvg(600, { estado: 'pode', rodando: 0, motivos: [], conferidoEm: AGORA, aviso: {}, paraAplicar: um })
  expect(largo.source, 'com espaço a instrução volta').toContain('orquestracao 0.1.41 · reinicie o app<')
  for (const r of [com, comAviso, largo]) expect(r.source, 'o texto velho saiu').not.toMatch(/baixada|instalar|app 3|motor/)
})

test('reinicioSvg: vários plugins do kit viram "kit (N plugins)"; o alt traz todos (F209)', () => {
  const dois = [{ nome: 'orquestracao', versao: '0.1.41' }, { nome: 'painel-sessoes', versao: '0.9.5' }]
  const r = reinicioSvg(288, { estado: 'pode', rodando: 0, motivos: [], conferidoEm: AGORA, aviso: {}, paraAplicar: dois })
  expect(r.source).toContain('kit (2 plugins)')
  expect(r.alt).toContain('Pronta para aplicar ao reiniciar o app: orquestracao 0.1.41, painel-sessoes 0.9.5.')
  expect(fraseDaAplicacao(dois)).toBe('↑ Pronta para aplicar · kit (2 plugins) · reinicie o app')
  expect(fraseDaAplicacao(null)).toBeNull()
  expect(fraseDaAplicacao([])).toBeNull()
})

test('kitSvg: a frase que cabe, 20 px; a falha em 38 px com o motivo curto; o alt traz de/para (F209)', () => {
  const um = [{ nome: 'orquestracao', instalada: '0.1.40', publicada: '0.1.41' }]
  const dois = [...um, { nome: 'painel-sessoes', instalada: '0.9.4', publicada: '0.9.5' }]
  const estreito = kitSvg(288 - BOTAO_DO_KIT, { paraBaixar: um, falhou: null, atualizando: false })
  expect(estreito.height).toBe(20)
  expect(estreito.source, 'a 168 px só a frase').toContain('↓ Atualização do kit<')
  expect(estreito.source).not.toContain('orquestracao')
  expect(estreito.alt).toBe('Atualização do kit disponível: orquestracao 0.1.40 para 0.1.41.')
  expect(kitSvg(360 - BOTAO_DO_KIT, { paraBaixar: dois, falhou: null, atualizando: false }).source, 'a 240 px cabe "· 2 plugins"').toContain('· 2 plugins<')
  expect(fraseDoKit(um)).toBe('↓ Atualização do kit · orquestracao 0.1.41')
  expect(kitSvg(168, { paraBaixar: um, falhou: null, atualizando: true }).alt).toMatch(/^Atualizando o kit: /)
  const falhou = kitSvg(168, { paraBaixar: um, falhou: 'ficou na versão antiga', atualizando: false })
  expect(falhou.height).toBe(38)
  expect(falhou.source).toContain('class="er">↓ Não atualizou o kit<')
  expect(falhou.source).toContain('ficou na versão antiga')
  expect(falhou.alt).toBe('O kit não atualizou: ficou na versão antiga. Falta: orquestracao 0.1.40 para 0.1.41.')
  for (const r of [estreito, falhou]) expect(r.source, 'sem citar comando ou item').not.toMatch(/atualizar-plugins|F\d{3}|painel /)
})

test('motivoCurtoDoKit: o texto cru vira uma frase da tabela', () => {
  expect(motivoCurtoDoKit('orquestracao: não pegou (instalada ficou em 0.1.40, publicada 0.1.41)')).toBe('ficou na versão antiga')
  expect(motivoCurtoDoKit('git ls-remote falhou: fatal: unable to access')).toBe('sem acesso ao repositório')
  expect(motivoCurtoDoKit('claude plugin marketplace update não respondeu em 180 s')).toBe('demorou demais')
  expect(motivoCurtoDoKit('claude não encontrado no PATH')).toBe('não achei o Claude Code')
  expect(motivoCurtoDoKit('algo estranho')).toBe('erro inesperado')
})

test('reinicioSvg com aviso: até 4 motivos, o resto vira "+ N mais" na linha da hora, e o alt lê todos inteiros', () => {
  expect(MOTIVOS_NO_BLOCO).toBe(4)
  const e = desenho('espere', motivos5, { })
  expect(e.source).toContain('Espere · 5 rodando')
  expect(e.source).toContain('· merge/rebase no meio')
  expect(e.source).not.toContain('E3 · tela trabalhando')
  expect(e.source).toMatch(/\+ 1 mais · conferido às \d\d:\d\d · aviso ligado/)
  expect(e.height, 'título + 4 motivos + linha da hora').toBe(24 + 16 * 5 + 10)
  for (const m of motivos5) expect(e.alt, 'o alt lê o motivo inteiro').toContain(m.texto)
  expect(desenho('espere', motivos5.slice(0, 2), {}).source).toMatch(/conferido às \d\d:\d\d · aviso ligado/)
  expect(desenho('espere', motivos5.slice(0, 2), {}).source).not.toContain('mais ·')
})

test('reinicioSvg com aviso: pode (moldura verde, avisei às), conferindo e não sei (moldura cinza), cada um com a sua altura', () => {
  const pode = desenho('pode', [], { avisadoEm: iso(AGORA) })
  expect(pode.source).toContain('class="oks"')
  expect(pode.source).toContain('Pode reiniciar o app')
  expect(pode.source).toContain('nada rodando · conferido às')
  expect(pode.source).toMatch(/avisei às \d\d:\d\d/)
  expect(pode.height).toBe(24 + 16 * 2 + 10)
  expect(desenho('pode', [], {}).height, 'sem avisadoEm não há a linha "avisei"').toBe(24 + 16 + 10)
  const conferindo = desenho('conferindo', [], {})
  expect(conferindo.source).toContain('class="ms"')
  expect(conferindo.source).toContain('Aviso ligado · conferindo')
  expect(conferindo.source).toContain('a primeira conferência sai em instantes')
  const naoSei = desenho('sem-dado', [], {}, 'não consegui conferir agora')
  expect(naoSei.source).toContain('class="ms"')
  expect(naoSei.source).toContain('Não sei · aviso ligado')
  expect(naoSei.source).toContain('não consegui conferir agora')
  expect(desenho('espere', motivos5, {}).source).toContain('class="ans"')
  for (const r of [pode, conferindo, naoSei]) {
    expect(r.source, 'sem citar item, revisão ou comando').not.toMatch(/painel pode-reiniciar|F\d{3}|ADR/)
  }
})

// ---- o mod, pelo motor ----

type Opc = {
  /** O conteúdo de `pode-reiniciar.json` no início; `null` = ausente. */
  arquivo?: ArquivoDeReinicio | null
  aviso?: AvisoDeReinicio | null
  /** O que o comando `pode-reiniciar` grava a cada conferência. */
  motivos?: Motivo[]
  semPlugin?: boolean
  comandoFalha?: boolean
  rmFalha?: boolean
  gravarAvisoFalha?: string
  notificacaoFalha?: boolean
  /** O instante de início do processo do app que o `ps` mostra; `null` = o `ps` não traz a linha do app; omitido = a mesma manhã. */
  appInicio?: string | null
  /** F209: os plugins do kit que o comando grava como esperando reinício; omitido = um (o reinício aparece); `null` = nada. */
  paraAplicar?: ArquivoDeReinicio['paraAplicar'] | null
  /** F209: o kit com versão para baixar que o comando grava. */
  paraBaixar?: ArquivoDeReinicio['paraBaixar']
  /** F209: o que `atualizar-plugins --json` devolve (exit e saída); omitido = atualiza o orquestracao para 0.1.41. */
  atualizar?: { exitCode: number; stdout?: string; stderr?: string }
  /** F209: o `atualizar-plugins` só responde quando o teste chama `soltar()`. */
  segurarAtualizar?: boolean
  /** F209: a conferência logo depois do `atualizar-plugins` só responde quando o teste chama `soltarConferencia()`. */
  segurarReconferencia?: boolean
}

const ABRIR = { command: 'painel', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const
const BARRA = { plugin: 'painel-sessoes', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 140, scroll: { offset: 0, bodyRows: 20 }, view: {} } } as const
const PANE = { plugin: 'painel-sessoes', component: 'Pane', requestId: 'painel-sessoes', props: { title: 'Sessões', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } } as const

function engine(on: On, opc: Opc = {}) {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('tool.register', () => ({ value: { tool: 'x' } }))
  let aberto = false
  on('ui.open', () => {
    aberto = true

    return { value: { isPlaced: true } }
  })
  on('ui.panes', () => ({ value: aberto ? [{ id: 'painel-sessoes', title: 'Sessões', isShown: true, isFocused: false, isPlaced: true }] : [] }))
  on('ui.close', () => {
    aberto = false

    return { value: undefined }
  })
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(String((e as unknown as { message?: string; text?: string }).message ?? (e as unknown as { text?: string }).text))

    return { value: undefined }
  })
  const logs: string[] = []
  on('ui.log', (_, e) => {
    logs.push(String((e as unknown as { text?: string }).text))

    return { value: undefined }
  })
  const relogio = mock.clock(on, { now: AGORA })
  mock.env(on, { HOME, CLAUDE_CODE_HOST_SESSION_ID: EU, BATIDA: 'off' })
  mock.store(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('session.cwd', () => ({ value: '/work/kit' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 1_000_000 }, rateLimits: [] } }))
  const arquivos = new Map<string, string>()
  arquivos.set(`${PASTA}/temas.json`, JSON.stringify([{ id: 'geral', rotulo: 'Geral' }]))
  if (!opc.semPlugin) arquivos.set(INSTALADOS, JSON.stringify({ version: 2, plugins: { 'orquestracao@kit-de-orquestracao': [{ scope: 'user', installPath: '/cache/orquestracao/1' }] } }))
  if (opc.arquivo) arquivos.set(ARQ, JSON.stringify(opc.arquivo))
  if (opc.aviso) arquivos.set(AVISO, JSON.stringify(opc.aviso))
  const estado = {
    motivos: opc.motivos ?? [] as Motivo[],
    appInicio: opc.appInicio === undefined ? 'Mon Oct 27 08:00:00 2026' : opc.appInicio,
    paraAplicar: opc.paraAplicar === undefined ? [{ nome: 'painel-sessoes', versao: '0.9.5' }] : opc.paraAplicar,
    paraBaixar: opc.paraBaixar,
  }
  /** O relógio do teste: o que o mock do motor diz, para o comando falso gravar `em` na mesma hora. */
  const tempo = { agora: AGORA }
  on('fs.list', (_, e) => {
    const prefixo = `${e.path}/`

    return { value: [...arquivos.keys()].filter(k => k.startsWith(prefixo) && !k.slice(prefixo.length).includes('/')).map(k => ({ name: k.slice(prefixo.length), kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) }
  })
  on('fs.read', (_, e) => {
    const t = arquivos.get(e.path)
    if (t === undefined) throw new Error(`ENOENT ${e.path}`)

    return { value: t }
  })
  const escritasDoAviso: AvisoDeReinicio[] = []
  on('fs.write', (_, e) => {
    if (e.path === AVISO) {
      if (opc.gravarAvisoFalha) throw new Error(opc.gravarAvisoFalha)
      escritasDoAviso.push(JSON.parse(e.text) as AvisoDeReinicio)
    }
    arquivos.set(e.path, e.text)

    return { value: undefined }
  })
  const execucoes: string[][] = []
  const envs: (Record<string, string> | undefined)[] = []
  const segurado: { soltar: () => void; soltarConferencia: () => void; segurarProxima: boolean; conferenciaFalha: boolean } = { soltar: () => {}, soltarConferencia: () => {}, segurarProxima: false, conferenciaFalha: false }
  on('process.run', async (_, e) => {
    const argv = [...e.argv]
    execucoes.push(argv)
    if (argv[0] === 'ps') envs.push((e.init as { env?: Record<string, string> } | undefined)?.env)
    const ok = { exitCode: 0, stdout: '{}', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
    if (argv.includes('pode-reiniciar')) {
      if (segurado.segurarProxima) {
        segurado.segurarProxima = false
        await new Promise<void>(res => { segurado.soltarConferencia = res })
      }
      if (opc.comandoFalha || segurado.conferenciaFalha) return { value: { ...ok, exitCode: 1, stderr: 'quebrou' } }
      // o comando de verdade grava o arquivo; aqui o teste o imita com o que ele julgaria
      const extra = { ...(estado.paraAplicar?.length ? { paraAplicar: estado.paraAplicar } : {}), ...(estado.paraBaixar?.length ? { paraBaixar: estado.paraBaixar } : {}) }
      arquivos.set(ARQ, JSON.stringify(arquivo(estado.motivos, 0, extra, tempo.agora)))
    }
    if (argv[1]?.endsWith('atualizar-plugins.mjs')) {
      if (opc.segurarAtualizar) await new Promise<void>(res => { segurado.soltar = res })
      const r = opc.atualizar ?? { exitCode: 0, stdout: JSON.stringify({ plugins: [{ id: 'orquestracao@kit-de-orquestracao', antes: '0.1.40', publicado: '0.1.41', depois: '0.1.41', acao: 'atualizado' }], reiniciar: true }) }
      if (r.exitCode === 0) {
        // o kit ficou em dia: a próxima conferência não traz mais o que baixar, e o plugin novo espera o reinício
        estado.paraBaixar = undefined
        estado.paraAplicar = [{ nome: 'orquestracao', versao: '0.1.41' }]
        if (opc.segurarReconferencia) segurado.segurarProxima = true
      }

      return { value: { ...ok, stdout: r.stdout ?? '', stderr: r.stderr ?? '', exitCode: r.exitCode } }
    }
    if (argv[0] === 'ps') {
      const app = estado.appInicio === null ? '' : `  4242 ${estado.appInicio} /Applications/Claude.app/Contents/MacOS/Claude\n`

      return { value: { ...ok, stdout: `    1 Sat Oct 25 07:00:00 2026 /sbin/launchd\n  777 Mon Oct 27 09:00:00 2026 /Applications/Claude.app/Contents/MacOS/Claude --type=renderer\n${app}` } }
    }
    if (argv[0] === 'rm') {
      if (opc.rmFalha) return { value: { ...ok, exitCode: 1, stderr: 'sem permissão' } }
      arquivos.delete(argv[2] ?? '')
    }

    return { value: ok }
  })
  const chamadas: string[] = []
  const notificacoes: string[] = []
  on('tool.call', (_, e) => {
    chamadas.push(e.tool)
    const entrada = e as unknown as Record<string, unknown>
    if (e.tool === 'PushNotification') {
      if (opc.notificacaoFalha) return { result: {}, text: 'não entregue', isError: true }
      notificacoes.push(String(entrada.message))

      return { result: {}, text: 'ok' }
    }
    if (e.tool === 'mcp__ccd_session_mgmt__get_session') return { result: {}, text: JSON.stringify({ sessionId: EU, title: 'E3 · eu', isRunning: false }) }
    if (e.tool === 'mcp__ccd_session_mgmt__list_sessions') return { result: {}, text: '[]' }

    return { result: {}, text: '[]' }
  })

  return { segurado, relogio, tempo, arquivos, estado, escritasDoAviso, execucoes, envs, toasts, logs, chamadas, notificacoes, avisoNoDisco: () => (arquivos.has(AVISO) ? (JSON.parse(arquivos.get(AVISO) ?? '{}') as AvisoDeReinicio) : null) }
}

async function iniciar($: Parameters<TestBody>[0], on: On, opc: Opc = {}) {
  const m = engine(on, opc)
  await $.session.start({ cwd: '/work/kit', surface: 'desktop', isInteractive: true })
  await m.relogio.settle()

  return m
}
const lido = async (ui: { findAll: (q: object) => Promise<Array<{ text: string; props: Record<string, unknown> }>> }) => (await ui.findAll({})).map(el => `${el.text} ${typeof el.props.alt === 'string' ? el.props.alt : ''}`).join('\n')
const barra = ($: Parameters<TestBody>[0], props: Record<string, unknown> = {}) => $.ui.mount({ ...BARRA, surface: 'terminal', props: { ...BARRA.props, ...props } })
async function abrirPane($: Parameters<TestBody>[0], m: Awaited<ReturnType<typeof iniciar>>, surface: 'terminal' | 'desktop') {
  await $.command.run(ABRIR)
  await m.relogio.settle()

  return $.ui.mount({ ...PANE, surface })
}
const avancar = async (m: Awaited<ReturnType<typeof iniciar>>, ms: number) => {
  await m.relogio.advance(ms)
  m.tempo.agora += ms
  await m.relogio.settle()
}
const minuto = async (m: Awaited<ReturnType<typeof iniciar>>, n = 1) => {
  for (let i = 0; i < n; i += 1) await avancar(m, MIN)
}

test('barra: sem o aviso ligada nada do reinício aparece, mesmo com o arquivo fresco (nos dois estados)', async ($, on) => {
  const pode = await iniciar($, on, { arquivo: arquivo([]) })
  const ui = await barra($)
  expect(await lido(ui)).not.toContain('⏻')
  await ui.unmount()
  expect(pode.chamadas.filter(c => c.endsWith('__list_sessions')), 'a barra não chama list_sessions').toEqual([])
})

test('barra com o aviso ligado: espere N rodando, pode, não sei (arquivo velho) e conferindo (recém ligado)', async ($, on) => {
  const m = await iniciar($, on, { arquivo: arquivo([sessao(7), teste, merge]), aviso: aviso({ vigia: OUTRA }) })
  let ui = await barra($)
  expect(await lido(ui)).toContain('⏻ 3 rodando')
  await ui.unmount()
  m.arquivos.set(ARQ, JSON.stringify(arquivo([], 0, {}, m.tempo.agora)))
  await avancar(m, 30_000)
  m.arquivos.set(ARQ, JSON.stringify(arquivo([], 0, {}, m.tempo.agora)))
  await avancar(m, 30_000)
  m.arquivos.set(ARQ, JSON.stringify(arquivo([], 0, {}, m.tempo.agora)))
  ui = await barra($)
  expect(await lido(ui)).toContain('⏻ Pode reiniciar')
  await ui.unmount()
  m.arquivos.set(ARQ, JSON.stringify(arquivo([], 20, {}, m.tempo.agora)))
  await avancar(m, 30_000)
  ui = await barra($)
  expect(await lido(ui), 'arquivo de 20 min: não sei, nunca "pode"').toContain('⏻ não sei')
  expect(await lido(ui)).not.toContain('Pode reiniciar')
  await ui.unmount()
})

test('barra: a peça tem o ⏻ colorido (subtle esperando, success no pode) e o texto em negrito só no pode', async ($, on) => {
  await iniciar($, on, { arquivo: arquivo([]), aviso: aviso({ vigia: OUTRA }) })
  const ui = await barra($)
  const textos = await ui.findAll({ type: 'Text' })
  const glifo = textos.find(t => t.text === GLIFO_REINICIO.g)
  expect(glifo?.props.color).toBe('success')
  expect(textos.find(t => t.text === ' Pode reiniciar')?.props.bold, 'o texto do pode em negrito').toBe(true)
  await ui.unmount()
})

test('barra: esperando o ⏻ é subtle e o texto apagado', async ($, on) => {
  await iniciar($, on, { arquivo: arquivo([sessao(1)]), aviso: aviso({ vigia: OUTRA }) })
  const ui = await barra($)
  const textos = await ui.findAll({ type: 'Text' })
  expect(textos.find(t => t.text === GLIFO_REINICIO.g)?.props.color).toBe('subtle')
  const resto = textos.find(t => t.text === ' 1 rodando')
  expect(resto?.props.dimColor, 'o texto do esperando é apagado').toBe(true)
  expect(resto?.props.bold).toBeUndefined()
  await ui.unmount()
})

test('barra: a sessão que trabalha nunca diz "pode" (a própria entra ao vivo), e parada diz o que o arquivo diz', async ($, on) => {
  await iniciar($, on, { arquivo: arquivo([]), aviso: aviso({ vigia: OUTRA }) })
  const trabalhando = await barra($, { isWorking: true })
  expect(await lido(trabalhando)).toContain('⏻ 1 rodando')
  expect(await lido(trabalhando)).not.toContain('Pode reiniciar')
  await trabalhando.unmount()
  const parada = await barra($, { isWorking: false })
  expect(await lido(parada)).toContain('⏻ Pode reiniciar')
  await parada.unmount()
})

test('barra: recém ligado, sem conferência, diz conferindo; ligado há 5 min e sem arquivo, não sei', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ vigia: OUTRA, ligadoEm: iso(AGORA - 20_000) }) })
  const ui = await barra($)
  expect(await lido(ui)).toContain('⏻ conferindo')
  await ui.unmount()
  await avancar(m, 120_000)
  const u2 = await barra($)
  expect(await lido(u2)).toContain('⏻ não sei')
  await u2.unmount()
})

test('a vigia não age sem aviso: nenhum list_sessions nem comando em minutos', async ($, on) => {
  const m = await iniciar($, on)
  await minuto(m, 3)
  expect(m.chamadas.filter(c => c.endsWith('__list_sessions')), 'sem a batida (BATIDA=off) ninguém lista as sessões').toEqual([])
  expect(m.execucoes.filter(a => a.includes('pode-reiniciar'))).toEqual([])
})

test('a vigia: pode → UMA notificação; segunda volta ainda pode → nenhuma; dois "não pode" e "pode" → mais uma', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ ligadoEm: iso(AGORA) }), motivos: [] })
  await minuto(m)
  expect(m.notificacoes.length, 'passou a poder: avisa').toBe(1)
  expect(m.notificacoes[0]).toMatch(/^Pode reiniciar o app\. Nenhuma sessão trabalhando, nenhum teste nem merge rodando \(\d\d:\d\d\)\.$/)
  expect(m.avisoNoDisco()?.avisadoEm, 'grava avisadoEm').toBeDefined()
  expect(m.chamadas.filter(c => c.endsWith('__list_sessions')).length, 'a vigia usou a lista fresca').toBeGreaterThan(0)
  await minuto(m)
  expect(m.notificacoes.length, 'segunda volta: nenhuma').toBe(1)
  m.estado.motivos = [sessao(7)]
  await minuto(m, 2)
  expect(m.avisoNoDisco()?.avisadoEm, 'dois "não pode" seguidos rearmam').toBeUndefined()
  expect(m.notificacoes.length).toBe(1)
  m.estado.motivos = []
  await minuto(m)
  expect(m.notificacoes.length, 'e avisa de novo').toBe(2)
})

test('a vigia: notificação recusada vira toast com o mesmo texto', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ ligadoEm: iso(AGORA) }), motivos: [], notificacaoFalha: true })
  await minuto(m)
  expect(m.toasts.some(t => t.startsWith('Pode reiniciar o app. Nenhuma sessão trabalhando'))).toBe(true)
})

test('a vigia: 30 min depois do aviso, ainda podendo, o aviso desliga sozinho sem nova notificação', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ ligadoEm: iso(AGORA - 40 * MIN), avisadoEm: iso(AGORA - 29 * MIN) }), motivos: [] })
  await minuto(m, 2)
  expect(m.avisoNoDisco(), 'passou de 30 min: apagado').toBeNull()
  expect(m.notificacoes.length).toBe(0)
})

test('vigia de outra sessão com conferência recente: esta não age', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ vigia: OUTRA, ligadoEm: iso(AGORA - 10 * MIN), vigiaEm: iso(AGORA - 30_000) }), arquivo: arquivo([sessao(7)], 0), motivos: [sessao(7)] })
  m.arquivos.set(ARQ, JSON.stringify(arquivo([sessao(7)], 0, {}, AGORA + MIN)))
  await minuto(m)
  expect(m.avisoNoDisco()?.vigia, 'a vigia conferiu há pouco: fica com ela').toBe(OUTRA)
  expect(m.execucoes.filter(a => a.includes('pode-reiniciar'))).toEqual([])
})

test('vigia de outra sessão que sumiu (sem conferência há 10 min): esta assume e confere', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ vigia: OUTRA, ligadoEm: iso(AGORA - 10 * MIN) }), arquivo: arquivo([sessao(7)], 10), motivos: [sessao(7)] })
  await minuto(m)
  expect(m.avisoNoDisco()?.vigia, 'sem conferência há 10 min: assume').toBe(EU)
  expect(m.execucoes.some(a => a.includes('pode-reiniciar')), 'e confere').toBe(true)
})

test('o app reiniciou: o aviso com avisadoEm de OUTRO boot do app é apagado ao carregar (M1)', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ avisadoEm: iso(AGORA - 5 * MIN), appInicio: 'Sun Oct 26 20:00:00 2026' }) })
  expect(m.execucoes.some(a => a[0] === 'ps'), 'prova: o início do app foi medido').toBe(true)
  expect(m.execucoes.some(a => a[0] === 'rm'), 'prova: o apagar acontece').toBe(true)
  expect(m.avisoNoDisco(), 'o reinício foi o fim natural do aviso').toBeNull()
})

test('F178: o ps do início do app roda com LC_ALL=C (lstart segue o idioma do sistema)', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ avisadoEm: iso(AGORA - 5 * MIN), appInicio: 'Sun Oct 26 20:00:00 2026' }) })
  expect(m.envs.length, 'prova: o ps rodou').toBeGreaterThan(0)
  for (const env of m.envs) expect(env?.LC_ALL).toBe('C')
})

test('M1: sessão nova no MESMO boot do app não apaga o aviso (dois session.start seguidos)', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ avisadoEm: iso(AGORA - 5 * MIN), appInicio: 'Mon Oct 27 08:00:00 2026' }) })
  expect(m.execucoes.some(a => a[0] === 'ps'), 'prova: mediu').toBe(true)
  await $.session.start({ cwd: '/work/kit', surface: 'desktop', isInteractive: true })
  await m.relogio.settle()
  expect(m.execucoes.some(a => a[0] === 'rm')).toBe(false)
  expect(m.avisoNoDisco()?.avisadoEm, 'o aviso e o rearme seguem').toBeDefined()
})

test('M1: sem medir o início do app (o ps não traz a linha), o aviso não é apagado', async ($, on) => {
  const a = await iniciar($, on, { aviso: aviso({ avisadoEm: iso(AGORA - 5 * MIN), appInicio: 'Sun Oct 26 20:00:00 2026' }), appInicio: null })
  expect(a.execucoes.some(x => x[0] === 'ps'), 'prova: tentou medir').toBe(true)
  expect(a.avisoNoDisco(), 'medida ausente não apaga').not.toBeNull()
})

test('M1: aviso com avisadoEm mas sem appInicio gravado não é apagado', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ avisadoEm: iso(AGORA - 5 * MIN) }) })
  expect(m.avisoNoDisco()).not.toBeNull()
})

test('a vigia grava o início do app e a própria conferência (appInicio, vigiaEm) no aviso (M1, M2)', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ ligadoEm: iso(AGORA) }), motivos: [sessao(7)] })
  expect(m.avisoNoDisco()?.appInicio, 'antes da vigia: nada').toBeUndefined()
  await minuto(m)
  expect(m.avisoNoDisco()?.appInicio).toBe('Mon Oct 27 08:00:00 2026')
  const vigiaEm1 = m.avisoNoDisco()?.vigiaEm
  expect(vigiaEm1).toBeDefined()
  await minuto(m)
  expect(Date.parse(m.avisoNoDisco()?.vigiaEm ?? '') - Date.parse(vigiaEm1 ?? ''), 'a cada minuto, a hora da conferência anda').toBe(MIN)
})

test('M2: pane de outra sessão renovando o arquivo não segura a vigia sumida; vigiaEm velho → esta assume', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ vigia: OUTRA, ligadoEm: iso(AGORA - 30 * MIN), vigiaEm: iso(AGORA - 20 * MIN) }), arquivo: arquivo([sessao(7)], 0), motivos: [sessao(7)] })
  m.arquivos.set(ARQ, JSON.stringify(arquivo([sessao(7)], 0, {}, AGORA + MIN)))
  await minuto(m)
  expect(m.avisoNoDisco()?.vigia, 'o arquivo é fresco mas a conferência da vigia é velha: assume').toBe(EU)
  expect(m.execucoes.some(a => a.includes('pode-reiniciar'))).toBe(true)
})

test('o app reiniciou: sem avisadoEm o aviso ainda espera', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ vigia: OUTRA }) })
  expect(m.avisoNoDisco()).not.toBeNull()
})

// ---- o pane: a linha, o bloco e os gestos ----

test('pane sem aviso: a linha discreta diz espere · N rodando e o botão Me avise; no pode não há botão; sem arquivo diz não sei', async ($, on) => {
  const m = await iniciar($, on, { motivos: [sessao(7), sessao(8), teste] })
  const ui = await abrirPane($, m, 'terminal')
  const texto = await lido(ui)
  expect(texto).toContain('Reiniciar: espere · 3 rodando')
  expect((await ui.find({ key: 'reinicio' }))?.text).toBe('Me avise')
  expect(texto, 'sem aviso os motivos não aparecem').not.toContain('teste de alfa')
  m.estado.motivos = []
  await ui.press({ key: 'atualizar' })
  await m.relogio.settle()
  expect(await lido(ui)).toContain('Pode reiniciar o app')
  expect(await ui.find({ key: 'reinicio' }), 'no pode não há botão').toBeUndefined()
  await ui.unmount()
})

test('pane desktop sem aviso: o Svg de 20 px, com a contagem por tipo no alt e o botão ao lado', async ($, on) => {
  const m = await iniciar($, on, { motivos: [sessao(7), sessao(8), teste] })
  const ui = await abrirPane($, m, 'desktop')
  const texto = await lido(ui)
  expect(texto).toContain('Reiniciar o app: espere, 3 rodando — 2 sessões trabalhando, 1 teste.')
  expect((await ui.find({ key: 'reinicio' }))?.text).toBe('Me avise')
  await ui.unmount()
})

test('F209: o comando falha e nada se sabe pendente: o reinício não aparece, o motivo vai para Não consegui ler tudo', async ($, on) => {
  const m = await iniciar($, on, { comandoFalha: true })
  const ui = await abrirPane($, m, 'desktop')
  const texto = await lido(ui)
  expect(texto).toMatch(/reinício: painel pode-reiniciar saiu com 1/)
  expect(texto).not.toMatch(/[Rr]einiciar o app/)
  await ui.unmount()
})

test('o comando falha no pane com o aviso ligado: não sei, "não consegui conferir agora", o motivo vai para Não consegui ler tudo', async ($, on) => {
  // F209: o arquivo velho do disco (kit para baixar e plugin esperando) não aparece: sem conferência não se sabe; só o aviso ligado segue
  const velho = arquivo([], 30, { paraAplicar: [{ nome: 'painel-sessoes', versao: '0.9.5' }], paraBaixar: KIT })
  const m = await iniciar($, on, { comandoFalha: true, arquivo: velho, aviso: aviso({ ligadoEm: iso(AGORA - 10 * MIN) }) })
  const ui = await abrirPane($, m, 'desktop')
  const texto = await lido(ui)
  expect(texto).toContain('Aviso de reinício ligado: não sei — não consegui conferir agora.')
  expect(texto).toContain('Não consegui ler tudo')
  expect(texto).toMatch(/reinício: painel pode-reiniciar saiu com 1/)
  expect(texto, 'a linha do kit do arquivo velho não aparece').not.toMatch(/Atualização do kit/)
  expect(texto, 'nem a linha azul').not.toMatch(/Pronta para aplicar/)
  await ui.unmount()
})

test('F209 (validador 2): o comando falha sem aviso e o arquivo velho do disco diz que há o que fazer: o pane não mostra nada (prova: sem a falha, mostra)', async ($, on) => {
  const velho = arquivo([], 0, { paraAplicar: [{ nome: 'painel-sessoes', versao: '0.9.5' }], paraBaixar: KIT })
  const m = await iniciar($, on, { comandoFalha: true, arquivo: velho })
  const ui = await abrirPane($, m, 'terminal')
  const texto = await lido(ui)
  expect(texto).toMatch(/reinício: painel pode-reiniciar saiu com 1/)
  expect(texto).not.toMatch(/Atualização do kit|Reiniciar|Pode reiniciar|Pronta para aplicar|Me avise/)
  await ui.unmount()
})

test('F209 (validador 2, prova): o mesmo arquivo com a conferência funcionando mostra o kit e a linha azul', async ($, on) => {
  const m = await iniciar($, on, { paraAplicar: [{ nome: 'painel-sessoes', versao: '0.9.5' }], paraBaixar: KIT })
  const ui = await abrirPane($, m, 'terminal')
  const texto = await lido(ui)
  expect(texto).toMatch(/Atualização do kit/)
  expect(texto).toMatch(/Pronta para aplicar/)
  await ui.unmount()
})

test('aviso ilegível: sem aviso (silêncio na barra) e o erro vai para Não consegui ler tudo', async ($, on) => {
  const m = await iniciar($, on, { motivos: [sessao(7)] })
  m.arquivos.set(AVISO, '{não é json')
  const ui = await abrirPane($, m, 'terminal')
  expect(await lido(ui)).toMatch(/aviso-de-reinicio\.json/)
  expect((await ui.find({ key: 'reinicio' }))?.text, 'sem aviso: o botão volta a ser Me avise').toBe('Me avise')
  await ui.unmount()
  await avancar(m, 30_000)
  const b = await barra($)
  expect(await lido(b)).not.toContain('⏻')
  await b.unmount()
})

test('Me avise: grava o aviso com esta sessão como vigia, mostra o bloco, o toast, e confere já', async ($, on) => {
  const m = await iniciar($, on, { motivos: [sessao(7), merge] })
  const ui = await abrirPane($, m, 'terminal')
  await ui.press({ key: 'reinicio' })
  await m.relogio.settle()
  expect(m.escritasDoAviso.length, 'o clique grava e a conferência da vigia marca vigiaEm').toBe(2)
  expect(m.escritasDoAviso[0]).toMatchObject({ vigia: EU, naoPodeSeguidos: 0, ligadoEm: iso(AGORA), appInicio: 'Mon Oct 27 08:00:00 2026' })
  expect(m.escritasDoAviso[0].vigiaEm, 'o clique ainda não é conferência').toBeUndefined()
  expect(m.escritasDoAviso[1].vigiaEm).toBeDefined()
  expect(m.toasts).toContain('Aviso ligado. A notificação chega quando der para reiniciar o app.')
  expect(m.execucoes.some(a => a.includes('pode-reiniciar')), 'a vigia conferiu na hora').toBe(true)
  const texto = await lido(ui)
  expect(texto).toContain('Espere · 2 rodando')
  expect(texto).toContain('merge/rebase no meio')
  expect((await ui.find({ key: 'reinicio' }))?.text, 'o botão agora é Não avisar mais').toBe('Não avisar mais')
  await ui.unmount()
  await avancar(m, 30_000)
  const b = await barra($)
  expect(await lido(b), 'a barra de toda sessão passa a falar').toContain('⏻ 2 rodando')
  await b.unmount()
})

test('Me avise: o bloco entra no mesmo render (antes da gravação), o clique repetido é ignorado', async ($, on) => {
  const m = await iniciar($, on, { motivos: [sessao(7)] })
  const ui = await abrirPane($, m, 'terminal')
  await ui.press({ key: 'reinicio' })
  await ui.press({ key: 'reinicio' })
  await m.relogio.settle()
  expect(m.escritasDoAviso.filter(a => a.vigiaEm === undefined).length, 'só uma gravação do clique').toBe(1)
  await ui.unmount()
})

test('Me avise falha: o bloco volta ao estado de antes, com toast e a faixa Ação não concluída', async ($, on) => {
  const m = await iniciar($, on, { motivos: [sessao(7)], gravarAvisoFalha: 'disco cheio' })
  const ui = await abrirPane($, m, 'terminal')
  await ui.press({ key: 'reinicio' })
  await m.relogio.settle()
  expect(m.toasts.some(x => x.startsWith('Não consegui ligar o aviso ('))).toBe(true)
  expect(m.avisoNoDisco()).toBeNull()
  expect((await ui.find({ key: 'reinicio' }))?.text, 'o botão voltou a ser Me avise').toBe('Me avise')
  expect(await lido(ui), 'a faixa de avisos do pane').toMatch(/⚠ Não consegui ligar o aviso \(/)
  expect(await lido(ui)).not.toContain('Aviso ligado')
  await ui.unmount()
})

test('Não avisar mais: o bloco volta à linha, apaga o arquivo e a barra volta ao silêncio', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso(), motivos: [sessao(7)], arquivo: arquivo([sessao(7)]) })
  const ui = await abrirPane($, m, 'terminal')
  expect((await ui.find({ key: 'reinicio' }))?.text).toBe('Não avisar mais')
  await ui.press({ key: 'reinicio' })
  await m.relogio.settle()
  expect(m.execucoes.some(a => a[0] === 'rm' && a.includes(AVISO)), 'apagou o arquivo').toBe(true)
  expect(m.avisoNoDisco()).toBeNull()
  expect((await ui.find({ key: 'reinicio' }))?.text, 'a linha volta com o Me avise').toBe('Me avise')
  await ui.unmount()
  await avancar(m, 30_000)
  const b = await barra($)
  expect(await lido(b)).not.toContain('⏻')
  await b.unmount()
})

test('Não avisar mais falha: o bloco volta, toast e a faixa Ação não concluída', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso(), motivos: [sessao(7)], arquivo: arquivo([sessao(7)]), rmFalha: true })
  const ui = await abrirPane($, m, 'terminal')
  await ui.press({ key: 'reinicio' })
  await m.relogio.settle()
  expect(m.toasts.some(t => t.startsWith('Não consegui desligar o aviso ('))).toBe(true)
  expect(m.avisoNoDisco(), 'o arquivo segue').not.toBeNull()
  expect((await ui.find({ key: 'reinicio' }))?.text).toBe('Não avisar mais')
  expect(await lido(ui), 'a faixa de avisos do pane').toMatch(/⚠ Não consegui desligar o aviso \(/)
  await ui.unmount()
})

test('pane com aviso: até 4 motivos, + N mais, e o desktop lê todos no alt', async ($, on) => {
  const m = await iniciar($, on, { aviso: aviso({ vigia: OUTRA }), motivos: motivos5 })
  const ui = await abrirPane($, m, 'terminal')
  const t = await lido(ui)
  expect(t).toContain('Espere · 5 rodando')
  expect(t).toMatch(/\+ 1 mais · conferido às \d\d:\d\d · aviso ligado/)
  await ui.unmount()
  const d = await abrirPane($, m, 'desktop')
  const td = await lido(d)
  for (const x of motivos5) expect(td).toContain(x.texto)
  await d.unmount()
})

// ---- F209: o reinício e o kit só aparecem quando há o que fazer ----

test('F209: nada esperando reinício e nada para baixar: o pane não mostra nada do reinício (as duas superfícies)', async ($, on) => {
  const m = await iniciar($, on, { paraAplicar: null, motivos: [sessao(7)] })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await abrirPane($, m, surface)
    const texto = await lido(ui)
    expect(texto, 'o pane foi lido').toMatch(/nada em andamento|Esperam você/)
    expect(texto).not.toMatch(/[Rr]einicia/)
    expect(await ui.find({ key: 'reinicio' }), 'sem Me avise').toBeUndefined()
    await ui.unmount()
  }
})

test('F209: com plugin do kit esperando o reinício ele aparece (prova de presença do teste acima), nas duas superfícies', async ($, on) => {
  const m = await iniciar($, on, { motivos: [sessao(7)] })
  let ui = await abrirPane($, m, 'terminal')
  expect(await lido(ui)).toContain('Reiniciar: espere · 1 rodando')
  await ui.unmount()
  m.estado.paraAplicar = [{ nome: 'orquestracao', versao: '0.1.41' }]
  ui = await abrirPane($, m, 'desktop')
  await ui.press({ key: 'atualizar' })
  await m.relogio.settle()
  expect(await lido(ui)).toContain('orquestracao 0.1.41')
  expect((await ui.find({ key: 'reinicio' }))?.text).toBe('Me avise')
  await ui.unmount()
})

test('F209: com o aviso ligado e nada pendente, o bloco do aviso fica', async ($, on) => {
  const m = await iniciar($, on, { paraAplicar: null, aviso: aviso({ ligadoEm: iso(AGORA - 5 * MIN) }), motivos: [sessao(7)] })
  const ui = await abrirPane($, m, 'terminal')
  expect(await lido(ui)).toContain('Espere · 1 rodando')
  expect((await ui.find({ key: 'reinicio' }))?.text).toBe('Não avisar mais')
  await ui.unmount()
})

const KIT = [{ nome: 'orquestracao', instalada: '0.1.40', publicada: '0.1.41' }]
const TRAVA = `${BATIDA}/atualizando-kit.json`

test('F209 estado 1 → 2: Atualizar mostra Atualizando… na hora; feito, a linha do kit sai, o reinício entra com o plugin, e o toast', async ($, on) => {
  const m = await iniciar($, on, { paraAplicar: null, paraBaixar: KIT, segurarAtualizar: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await abrirPane($, m, surface)
    const texto = await lido(ui)
    expect(texto).toMatch(/Atualização do kit/)
    expect(texto, 'estado 1 sem nada instalado esperando: sem reinício').not.toMatch(/[Rr]einiciar/)
    expect((await ui.find({ key: 'kit' }))?.text).toBe('Atualizar')
    await ui.unmount()
  }
  const ui = await abrirPane($, m, 'terminal')
  await ui.press({ key: 'kit' })
  await ui.press({ key: 'kit' })
  expect((await ui.find({ key: 'kit' }))?.text, 'no mesmo render').toBe('Atualizando…')
  expect(m.execucoes.filter(a => a[1]?.endsWith('atualizar-plugins.mjs')).length, 'o clique repetido é ignorado').toBe(1)
  m.segurado.soltar()
  await m.relogio.settle()
  expect(m.execucoes.some(a => a[1]?.endsWith('/skills/orquestradora/scripts/atualizar-plugins.mjs') && a[2] === '--json')).toBe(true)
  const depois = await lido(ui)
  expect(depois).not.toMatch(/Atualização do kit/)
  expect(await ui.find({ key: 'kit' })).toBeUndefined()
  expect(depois).toContain('↑ Pronta para aplicar · orquestracao 0.1.41 · reinicie o app')
  expect(depois, 'nada rodando: pode').toContain('Pode reiniciar o app')
  expect(m.toasts).toContain('Kit atualizado: orquestracao 0.1.41. Reinicie o app para aplicar.')
  expect(m.arquivos.has(TRAVA), 'a trava sai no fim').toBe(false)
  await ui.unmount()
})

test('F209 falhou: ↓ Não atualizou o kit com o motivo curto, Tentar de novo, toast e a faixa; a trava guarda a falha para os outros panes', async ($, on) => {
  const stdout = JSON.stringify({ plugins: [{ id: 'orquestracao@kit-de-orquestracao', antes: '0.1.40', depois: '0.1.40', acao: 'não pegou', mensagem: 'instalada ficou em 0.1.40, publicada 0.1.41' }] })
  const m = await iniciar($, on, { paraAplicar: null, paraBaixar: KIT, atualizar: { exitCode: 1, stdout } })
  const ui = await abrirPane($, m, 'terminal')
  await ui.press({ key: 'kit' })
  await m.relogio.settle()
  const texto = await lido(ui)
  expect(texto).toContain('↓ Não atualizou o kit')
  expect(texto).toContain('ficou na versão antiga')
  expect(texto, 'o texto cru não vai para a tela').not.toContain('publicada 0.1.41')
  expect((await ui.find({ key: 'kit' }))?.text).toBe('Tentar de novo')
  expect(m.toasts).toContain('Não consegui atualizar o kit (ficou na versão antiga).')
  expect(texto).toContain('Não consegui atualizar o kit (ficou na versão antiga).')
  const trava = JSON.parse(m.arquivos.get(TRAVA) ?? '{}') as { falhou?: { motivo: string; detalhe: string } }
  expect(trava.falhou?.motivo).toBe('ficou na versão antiga')
  expect(trava.falhou?.detalhe).toContain('não pegou')
  await ui.unmount()
  // outro pane (outra sessão, sem o clique) lê a falha da trava
  const desk = await abrirPane($, m, 'desktop')
  expect(await lido(desk)).toContain('O kit não atualizou: ficou na versão antiga.')
  await desk.unmount()
})

test('F209 outra sessão atualizando (trava fresca): Atualizando… inerte, o clique não roda nada; trava velha (11 min) volta Atualizar', async ($, on) => {
  const m = await iniciar($, on, { paraAplicar: null, paraBaixar: KIT })
  m.arquivos.set(TRAVA, JSON.stringify({ em: iso(AGORA - 2 * MIN), sessao: OUTRA }))
  let ui = await abrirPane($, m, 'terminal')
  expect((await ui.find({ key: 'kit' }))?.text).toBe('Atualizando…')
  await ui.press({ key: 'kit' })
  await m.relogio.settle()
  expect(m.execucoes.some(a => a[1]?.endsWith('atualizar-plugins.mjs')), 'nada roda').toBe(false)
  await ui.unmount()
  m.arquivos.set(TRAVA, JSON.stringify({ em: iso(AGORA - 11 * MIN), sessao: OUTRA }))
  ui = await abrirPane($, m, 'terminal')
  await ui.press({ key: 'atualizar' })
  await m.relogio.settle()
  expect((await ui.find({ key: 'kit' }))?.text).toBe('Atualizar')
  await ui.unmount()
})

test('F209 estados 1 e 2 juntos: a linha do kit vem antes do bloco do reinício', async ($, on) => {
  const m = await iniciar($, on, { paraBaixar: KIT })
  const ui = await abrirPane($, m, 'terminal')
  const texto = await lido(ui)
  const kit = texto.indexOf('Atualização do kit')
  const rein = texto.indexOf('Pronta para aplicar')
  expect(kit).toBeGreaterThan(-1)
  expect(rein).toBeGreaterThan(-1)
  expect(kit).toBeLessThan(rein)
  await ui.unmount()
})

test('F209 (crítica P2): até a reconferência gravar, a trava fica e uma leitura com o arquivo velho não traz a linha do kit de volta', async ($, on) => {
  const m = await iniciar($, on, { paraAplicar: null, paraBaixar: KIT, segurarReconferencia: true })
  const ui = await abrirPane($, m, 'terminal')
  await ui.press({ key: 'kit' })
  await m.relogio.settle()
  expect(m.toasts).toContain('Kit atualizado: orquestracao 0.1.41. Reinicie o app para aplicar.')
  expect(m.arquivos.has(TRAVA), 'a trava segura os outros panes até a reconferência').toBe(true)
  // a leitura periódica no meio grava o arquivo como estava antes do clique (o kit para baixar, nada a aplicar)
  const depois = { paraBaixar: m.estado.paraBaixar, paraAplicar: m.estado.paraAplicar }
  m.estado.paraBaixar = KIT
  m.estado.paraAplicar = null
  await ui.press({ key: 'atualizar' })
  await m.relogio.settle()
  const meio = await lido(ui)
  expect(meio, 'a linha do kit não volta').not.toMatch(/Atualização do kit/)
  expect(meio, 'e o kit segue na linha azul').toContain('Pronta para aplicar · orquestracao 0.1.41')
  Object.assign(m.estado, depois)
  m.segurado.soltarConferencia()
  await m.relogio.settle()
  expect(m.arquivos.has(TRAVA), 'a trava sai depois da reconferência').toBe(false)
  expect(await lido(ui)).not.toMatch(/Atualização do kit/)
  await ui.unmount()
})

test('F209 (crítica P3): outra sessão gravou a trava e este pane ainda não leu: toast neutro, sem faixa, e o botão vira Atualizando…', async ($, on) => {
  const m = await iniciar($, on, { paraAplicar: null, paraBaixar: KIT })
  const ui = await abrirPane($, m, 'terminal')
  expect((await ui.find({ key: 'kit' }))?.text).toBe('Atualizar')
  m.arquivos.set(TRAVA, JSON.stringify({ em: iso(m.tempo.agora - MIN), sessao: OUTRA }))
  await ui.press({ key: 'kit' })
  await m.relogio.settle()
  expect(m.execucoes.some(a => a[1]?.endsWith('atualizar-plugins.mjs')), 'nada roda').toBe(false)
  expect(m.toasts).toContain('Outra sessão já está atualizando o kit.')
  expect(await lido(ui), 'sem a faixa de falha').not.toMatch(/Não consegui atualizar/)
  expect((await ui.find({ key: 'kit' }))?.text).toBe('Atualizando…')
  await ui.unmount()
})

test('F209 (crítica P1): desktop com Me avise ao lado, a linha azul desce para a largura inteira e leva a versão', async ($, on) => {
  const m = await iniciar($, on, { motivos: [sessao(7)], paraAplicar: [{ nome: 'orquestracao', versao: '0.1.41' }] })
  const ui = await abrirPane($, m, 'desktop')
  expect((await ui.find({ key: 'reinicio' }))?.text).toBe('Me avise')
  const fontes = (await ui.findAll({})).map(el => String(el.props.source ?? '')).filter(x => x.includes('aplicar'))
  expect(fontes.length, 'achou a linha azul').toBe(1)
  expect(fontes[0]).toContain('orquestracao 0.1.41')
  const larg = (x: string) => Number(/width="(\d+)"/.exec(x)?.[1])
  const linhaDoReinicio = (await ui.findAll({})).map(el => String(el.props.source ?? '')).find(x => x.includes('Reiniciar: espere'))
  expect(linhaDoReinicio, 'a fileira do ⏻ existe').toBeDefined()
  expect(larg(fontes[0]!), 'a linha azul tem a largura inteira, 96 a mais que a fileira do botão').toBe(larg(linhaDoReinicio!) + 96)
  await ui.unmount()
})

test('F209 (validador 1): o kit e o reinício moram entre o botão do modo e os contadores, nas duas superfícies', async ($, on) => {
  const m = await iniciar($, on, { motivos: [sessao(7)], paraBaixar: KIT })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await abrirPane($, m, surface)
    const t = await lido(ui)
    const pos = ['Ficar ausente', 'Atualização do kit', surface === 'terminal' ? 'Reiniciar: espere' : 'Reiniciar o app: espere', surface === 'terminal' ? 'nada em andamento' : 'Esperam você'].map(x => t.indexOf(x))
    expect(pos.every(p => p > -1), `${surface}: achou as quatro peças ${pos.join(',')}`).toBe(true)
    expect([...pos].sort((a, b) => a - b), `${surface}: na ordem modo, kit, reinício, contadores`).toEqual(pos)
    await ui.unmount()
  }
})

test('F209 (2º validador M1): atualizou e a reconferência falhou — a tela otimista fica, a linha do kit não volta do arquivo velho', async ($, on) => {
  const m = await iniciar($, on, { paraAplicar: null, paraBaixar: KIT, segurarReconferencia: true })
  const ui = await abrirPane($, m, 'terminal')
  await ui.press({ key: 'kit' })
  await m.relogio.settle()
  m.segurado.conferenciaFalha = true
  m.segurado.soltarConferencia()
  await m.relogio.settle()
  const t = await lido(ui)
  expect(m.toasts).toContain('Kit atualizado: orquestracao 0.1.41. Reinicie o app para aplicar.')
  expect(t, 'a linha do kit não volta').not.toMatch(/Atualização do kit/)
  expect(t, 'o kit segue na linha azul').toContain('Pronta para aplicar · orquestracao 0.1.41')
  expect(m.arquivos.has(TRAVA), 'a trava sai: a atualização deu certo').toBe(false)
  await ui.unmount()
})
