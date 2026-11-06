// Worker da aba do kit no Orca (F436). Lê o painel do kit e a caixa do Orca, grava as respostas do operador e entrega
// o que precisa acordar uma sessão. Ler nunca aciona modelo: só arquivos e o CLI do Orca em modo leitura (`inbox`,
// `worker-list`). Só "responder", "discordar" e o seguimento de uma entrega abrem um terminal que envia uma mensagem.
// F460 (ADR 0032): a cada 10 min o worker roda a batida de leitura (`painel.mjs batida --leitura`), que deduz o estado
// dos itens, grava `batida/deduzido.json` e fecha o item mergeado (F472, ADR 0034); não acorda nem solta ninguém.
import type { OrcaWorkerApi } from 'orca/worker'
import { execFile } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  lerPerguntas, lerAcompanhadas, gravarResposta, confirmarTodas, desfazerConfirmacao, gravarEntregaDaResposta, RecusaDoPainel, textoDaEntrega, textoDaMudanca,
} from './nucleo/painel.mjs'
import { entregasDoPainel, entregasDoOrca, juntarEntregas } from './nucleo/entregas.mjs'
import { prepararEnvio, lerResultado, destinoValido, destinoDoSeguimento } from './nucleo/envio.mjs'
import { criarFilaDeEntrega } from './nucleo/fila-de-entrega.mjs'
import { sessoesDoKit } from './nucleo/sessoes.mjs'
import { precisaDaBatida, scriptDaBatida, ambienteDaBatida, TOQUE_MS } from './nucleo/batida.mjs'
import { lerInstalados, publicadoDoCache, cacheVale, paraBaixar, atualizarCache, cloneDoMarketplace } from './nucleo/atualizacao.mjs'
import { inicioDoDiaSP } from './vista'
import type { AtualizacaoDoKit, Concluida, ConcluidasLidas, DesfechoDoArquivar, Leitura, Resultado, Entrega, EstadoDaEntrega, VistaDasSessoes } from './protocol'
import { ESPERA_ENVIO_MS, JANELA_DA_ENTREGA_MS, LIMITE_DA_CAIXA } from './protocol'

const DIAS = 7
const CAIXA_MS = 60_000
const ORCA_APP = '/Applications/Orca.app/Contents/Resources/bin/orca'

const pasta = () => process.env.PAINEL_DIR || join(homedir(), '.claude', 'orquestracao', 'painel')
// O binário do Orca: o de teste (variável), o do app, ou o do PATH.
const orcaBin = () => process.env.PAINEL_DO_KIT_ORCA || (existsSync(ORCA_APP) ? ORCA_APP : 'orca')
// O início do dia em São Paulo (UTC−3, sem horário de verão desde 2019): a seção Sessões mostra só as entregas de hoje.
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))
// A janela do lote: a do contrato, ou a do teste (variável), que não espera 5 s por caso.
const janelaDaEntrega = () => {
  const v = Number(process.env.PAINEL_DO_KIT_JANELA_MS)
  return process.env.PAINEL_DO_KIT_JANELA_MS && Number.isFinite(v) && v >= 0 ? v : JANELA_DA_ENTREGA_MS
}

function rodarJson(args: string[]): Promise<unknown> {
  return new Promise((resolve, reject) =>
    execFile(orcaBin(), args, { timeout: 15_000, maxBuffer: 16 * 1024 * 1024 }, (err, so) => {
      if (err) return reject(new Error(String(err.message).split('\n')[0]))
      try { resolve(JSON.parse(so)) } catch { reject(new Error('o Orca devolveu algo que não é JSON')) }
    }))
}

/** O que o script diz de cada condição que faltou, em palavras de quem usa a aba; o texto cru vai ao log do plugin. */
export function motivoCurto(faltam: string[]): string {
  const curtos = faltam.map((f) => {
    if (/worker não está parado/.test(f)) return 'a sessão ainda está rodando'
    if (/não está limpa/.test(f)) return 'tem arquivo sem commit na worktree'
    if (/commit sem push/.test(f)) return 'tem commit sem push'
    const aberto = /PR #(\d+) está aberto/.exec(f)
    if (aberto) return `o PR #${aberto[1]} ainda está aberto`
    if (/fechado sem merge/.test(f)) return 'tem PR fechado sem merge'
    if (/commit\(s\) fora|commit depois do PR/.test(f)) return 'tem trabalho fora de PR mergeado'
    const pergunta = /pergunta aberta do (F\d+): (.+)/.exec(f)
    if (pergunta) return `tem pergunta aberta (${pergunta[2]})`
    if (/falhou:/.test(f) && /orca /.test(f)) return 'o Orca recusou a ação; veja o log do plugin'
    return 'não deu para conferir; veja o log do plugin'
  })
  return [...new Set(curtos)].join('; ') || 'não passou nas condições'
}

export default function activate(orca: OrcaWorkerApi): void {
  // A caixa do Orca é lida no máximo uma vez por minuto (ou quando a pessoa pede "Atualizar").
  // Os workers do Orca ficam com a caixa: a seção Sessões os usa para dizer a sessão que falhou (F452).
  let caixa: { em: number; orca: Entrega[]; erro: string | null; ate: string | null; workers: unknown[] | null } = { em: 0, orca: [], erro: null, ate: null, workers: null }
  const lerCaixa = async (forcar: boolean) => {
    if (!forcar && Date.now() - caixa.em < CAIXA_MS) return caixa
    const desdeMs = Date.now() - DIAS * 86_400_000
    try {
      const [inbox, workers] = await Promise.all([
        rodarJson(['orchestration', 'inbox', '--limit', String(LIMITE_DA_CAIXA), '--full', '--json']),
        rodarJson(['orchestration', 'worker-list', '--json']).catch(() => null),
      ])
      // A caixa vem da mais nova para a mais velha: no limite, as entregas do Orca só vão até a última que entrou.
      const msgs = (inbox as { result?: { messages?: { created_at?: string }[] } })?.result?.messages
      const ultima = Array.isArray(msgs) && msgs.length >= LIMITE_DA_CAIXA ? msgs[msgs.length - 1]?.created_at : undefined
      const ate = ultima && Date.parse(ultima) > desdeMs ? ultima : null // cortou antes dos 7 dias: só aí falta algo
      const lista = (workers as { result?: { workers?: unknown[] } } | null)?.result?.workers
      caixa = { em: Date.now(), orca: entregasDoOrca(inbox, workers, { desdeMs }) as Entrega[], erro: null, ate, workers: Array.isArray(lista) ? lista : caixa.workers }
    } catch (e) {
      caixa = { em: Date.now(), orca: caixa.orca, erro: `não consegui ler a caixa do Orca (${msg(e)})`, ate: caixa.ate, workers: caixa.workers }
    }
    return caixa
  }

  // Versão nova do kit (F463): lida do cache da conferência do kit; vencido o prazo (30 min), a conferência (`git fetch`) roda em
  // segundo plano e a aba é avisada quando ela termina. Ler nunca espera a rede.
  let conferindo = false
  const lerAtualizacao = (): AtualizacaoDoKit[] => {
    try {
      const home = homedir()
      const cache = join(dirname(pasta()), 'batida', 'kit-publicado.json')
      const instalados = lerInstalados(home) as { nome: string; versao: string }[]
      if (instalados.length && !conferindo && !cacheVale(cache)) {
        conferindo = true
        atualizarCache({ clone: cloneDoMarketplace(home), cache })
          .then(() => orca.panels.post('kit.mudou', { em: Date.now() }))
          .catch((e: unknown) => orca.log(`atualização: ${msg(e)}`))
          .finally(() => { conferindo = false })
      }
      return paraBaixar(instalados, publicadoDoCache(cache)) as AtualizacaoDoKit[]
    } catch (e) {
      orca.log(`atualização: ${msg(e)}`)
      return []
    }
  }

  let ultimoTotal = -1
  const atualizarBarra = async () => {
    try {
      const { abertas, assumidas } = lerPerguntas(pasta())
      const total = abertas.length
      const texto = total ? `Kit: ${total} pergunta${total > 1 ? 's' : ''}` : assumidas.length ? `Kit: ${assumidas.length} a confirmar` : 'Kit: em dia'
      await orca.host.call('statusBar.update', {
        id: 'kit', text: texto, tone: total ? 'warning' : 'neutral',
        tooltip: `${total} pergunta(s) aberta(s) · ${assumidas.length} decisão(ões) assumida(s) a confirmar`,
      })
      if (ultimoTotal >= 0 && total > ultimoTotal) await orca.host.call('notifications.show', { title: 'Pergunta nova do kit', body: `${total} aberta(s) esperando você` })
      ultimoTotal = total
    } catch (e) { orca.log(`barra: ${msg(e)}`) }
  }
  void atualizarBarra()
  const relogio = setInterval(atualizarBarra, 30_000)
  relogio.unref?.() // o relógio da barra não segura o processo do worker (nem o do teste) aberto

  const avisarPaineis = () => { void atualizarBarra(); orca.panels.post('kit.mudou', { em: Date.now() }) }

  // A batida de leitura (F460): ao ativar e, conferindo a cada minuto, quando o deduzido tem 10 min ou mais (o app desktop pode estar
  // rodando a dele); uma por vez. O binário do Orca roda o painel.mjs como Node. Falhar só vai ao log: a seção Sessões
  // segue avisando que o estado está velho.
  let batendo = false
  const rodarBatida = async () => {
    if (batendo || process.env.PAINEL_DO_KIT_BATIDA === 'off' || !precisaDaBatida(pasta(), Date.now())) return
    const script = scriptDaBatida()
    if (!script) { orca.log('batida: o plugin orquestracao não está instalado no escopo do usuário'); return }
    batendo = true
    try {
      const saida = await new Promise<string>((resolve, reject) =>
        execFile(process.env.PAINEL_DO_KIT_NODE || process.execPath, [script, 'batida', '--leitura'],
          { env: ambienteDaBatida(process.env), timeout: 60_000, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024 },
          (err, so, se) => (err ? reject(new Error(`${String(err.message).split('\n')[0]}${se ? ` · ${String(se).trim().split('\n').pop()}` : ''}`)) : resolve(so))))
      const r = JSON.parse(saida) as { gravado?: boolean; pulou?: string }
      if (r.gravado) avisarPaineis()
      else if (r.pulou) orca.log(`batida: pulou (${r.pulou})`)
    } catch (e) {
      orca.log(`batida: ${msg(e)}`)
    } finally { batendo = false }
  }
  void rodarBatida()
  const relogioDaBatida = setInterval(() => { void rodarBatida() }, TOQUE_MS)
  relogioDaBatida.unref?.()

  // Arquivar as concluídas (F469): quem decide é o `painel.mjs orquestradora arquivar --concluidas` do plugin orquestracao, o mesmo
  // código das condições do `arquivar <ctx_…>` (PR mergeado, worker parado, worktree limpa e empurrada, sem pergunta aberta).
  // O worker só o chama: o seco (a contagem do botão) não muda nada; o arquivar vai com --remover-worktree (a sessão some da barra lateral), nunca --force. A conferência faz git e gh
  // por concluída, então fica em cache de 2 min e uma por vez.
  const chamarPainel = (args: string[], prazoMs: number) => new Promise<{ json: Record<string, unknown> | null; erro: string | null }>((resolve) => {
    const script = scriptDaBatida()
    if (!script) return resolve({ json: null, erro: 'o plugin orquestracao não está instalado no escopo do usuário' })
    execFile(process.env.PAINEL_DO_KIT_NODE || process.execPath, [script, ...args],
      { env: ambienteDaBatida(process.env), timeout: prazoMs, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024 },
      (err, so, se) => {
        // `recusadas` sai com exit 1 e o JSON inteiro: vale o JSON, não o código.
        try { const j = JSON.parse(so); if (j && typeof j === 'object') return resolve({ json: j as Record<string, unknown>, erro: null }) } catch { /* sem JSON: erro de uso ou de execução */ }
        // O texto cru vai ao log do plugin; a tela recebe só o motivo curto.
        const ultima = String(se || err?.message || 'sem resposta').trim().split('\n').pop() ?? ''
        console.warn(`[kit] painel ${args.slice(0, 3).join(' ')}: ${ultima.slice(0, 300)}`)
        resolve({ json: null, erro: err?.killed ? 'demorou demais; confira o que ainda falta arquivar' : 'o script do painel falhou; veja o log do plugin' })
      })
  })
  const dadosDa = (x: unknown): Concluida[] => (Array.isArray(x) ? x : []).filter((c): c is Concluida => typeof c?.item === 'string' && /^F\d+$/.test(c.item)).map((c) => ({ item: c.item, titulo: String(c.titulo ?? c.item) }))
  const CONCLUIDAS_MS = 120_000
  let concluidasCache: ConcluidasLidas | null = null
  let conferindoConcluidas: Promise<ConcluidasLidas> | null = null
  const lerConcluidas = (forcar: boolean): Promise<ConcluidasLidas> => {
    if (!forcar && concluidasCache && Date.now() - concluidasCache.lidoEm < CONCLUIDAS_MS) return Promise.resolve(concluidasCache)
    conferindoConcluidas ??= chamarPainel(['orquestradora', 'arquivar', '--concluidas', '--seco'], 100_000).then(({ json, erro }) => {
      const motivo = erro ?? (typeof json?.erro === 'string' ? json.erro : null)
      concluidasCache = { aptas: motivo ? [] : dadosDa(json?.aptas), erro: motivo, lidoEm: Date.now() }
      if (motivo) orca.log(`concluídas: ${motivo}`)
      return concluidasCache
    }).finally(() => { conferindoConcluidas = null })
    return conferindoConcluidas
  }
  orca.panels.handle('kit.concluidas', async (input?: { forcar?: boolean }): Promise<ConcluidasLidas> => lerConcluidas(Boolean(input?.forcar)))

  // Só os itens que a pessoa viu e confirmou vão ao script, que confere tudo de novo na hora e recusa o que deixou de valer.
  orca.panels.handle('kit.arquivar', async (input: { itens: string[] }): Promise<DesfechoDoArquivar> => {
    const itens = Array.isArray(input?.itens) ? input.itens : []
    if (!itens.length || itens.some((i) => typeof i !== 'string' || !/^F\d+$/.test(i))) return { arquivadas: [], recusadas: [], erro: 'a lista de itens a arquivar é inválida' }
    const { json, erro } = await chamarPainel(['orquestradora', 'arquivar', '--concluidas', '--itens', itens.join(','), '--remover-worktree'], 110_000)
    concluidasCache = null // o que arquivou sai da lista na próxima conferência
    if (!json) return { arquivadas: [], recusadas: [], erro: erro ?? 'o painel não respondeu' }
    const recusadas = (Array.isArray(json.recusadas) ? json.recusadas : []).flatMap((r: { item?: string; titulo?: string; faltam?: unknown }) => {
      const [c] = dadosDa([r])
      const faltam = (Array.isArray(r.faltam) ? r.faltam : []).map(String)
      if (faltam.length) console.warn(`[kit] ${r.item} não arquivada: ${faltam.join(' | ')}`)
      return c ? [{ ...c, motivo: motivoCurto(faltam) }] : []
    })
    return { arquivadas: dadosDa(json.arquivadas), recusadas, erro: typeof json.erro === 'string' ? json.erro : null }
  })

  // Envio por terminal criado pelo worker: o worker do plugin não tem remetente próprio (`no_active_sender_terminal`).
  async function enviar(destino: string, assunto: string, corpo: string): Promise<{ ok: boolean; motivo?: string }> {
    let dir: string | null = null
    try {
      const preparado = prepararEnvio({ destino, assunto, corpo, orca: orcaBin() })
      dir = preparado.dir
      const { workspaces } = await orca.host.call('workspace.list', {})
      // O terminal lê o texto de um arquivo desta máquina: workspace de host remoto (SSH) não serve.
      // Pasta local vem sem hostId (antigo) ou com hostId "local" (Orca atual, F449).
      const locais = workspaces.filter((w) => !w.hostId || w.hostId === 'local')
      const ws = locais.find((w) => w.kind === 'worktree') ?? locais[0]
      if (!ws) return { ok: false, motivo: 'nenhum workspace aberto nesta máquina para criar o terminal de envio' }
      await orca.host.call('terminal.create', { workspaceId: ws.id, title: 'Kit · enviando resposta', command: preparado.comando })
      const limite = Date.now() + ESPERA_ENVIO_MS
      while (Date.now() < limite) {
        const r = lerResultado(dir)
        if (r.pronto) return r.ok ? { ok: true } : { ok: false, motivo: r.motivo }
        await esperar(400)
      }
      return { ok: false, motivo: `o envio não respondeu em ${ESPERA_ENVIO_MS / 1000} s` }
    } catch (e) {
      return { ok: false, motivo: msg(e) }
    } finally {
      if (dir) rmSync(dir, { recursive: true, force: true })
    }
  }

  // Respostas ao mesmo destino a poucos segundos uma da outra saem numa mensagem só (cada mensagem custa um turno).
  const filaDeEntrega = criarFilaDeEntrega({
    janelaMs: janelaDaEntrega(),
    enviarLote: (destino: string, lote: { assunto: string; corpo: string }) => enviar(destino, lote.assunto, lote.corpo),
  })

  orca.panels.handle('kit.ler', async (input?: { forcar?: boolean; acompanhar?: string[] }): Promise<Leitura> => {
    const p = pasta()
    const perguntas = lerPerguntas(p)
    const c = await lerCaixa(Boolean(input?.forcar))
    const painel = entregasDoPainel(p, { desdeMs: Date.now() - DIAS * 86_400_000 })
    // O destino do "Responder…" de cada entrega sai daqui: o painel não importa o núcleo (que usa `node:fs`).
    const entregas = (juntarEntregas(painel, c.orca) as Entrega[]).map((e) => ({ ...e, seguimento: destinoDoSeguimento(e) }))
    // O que a aba mandou responder e ainda não viu o desfecho (F450): o arquivo diz, mesmo se a resposta deste pedido se perdeu.
    const acompanhadas = Array.isArray(input?.acompanhar) && input.acompanhar.length ? { acompanhadas: lerAcompanhadas(p, input.acompanhar) } : {}
    const agoraMs = Date.now()
    let sessoes: VistaDasSessoes
    try {
      sessoes = sessoesDoKit(p, { agoraMs, desdeMs: inicioDoDiaSP(agoraMs), abertas: perguntas.abertas, workers: c.workers }) as VistaDasSessoes
    } catch (e) {
      // A seção cai sozinha: as perguntas e as entregas seguem.
      orca.log(`sessões: ${msg(e)}`)
      sessoes = { projetos: [], paradas: 0, ilegiveis: 0, batidaEm: null, erro: msg(e), lidoEm: agoraMs }
    }
    return { ...perguntas, entregas, erroDaCaixa: c.erro, caixaAte: c.ate, sessoes, atualizacao: lerAtualizacao(), lidoEm: agoraMs, ...acompanhadas } as Leitura
  })

  // Responder uma aberta ou discordar de uma assumida: grava a prova do clique e entrega a quem perguntou, se há endereço.
  orca.panels.handle('kit.responder', async (input: { id: string; versao: number; esperado: 'aberta' | 'assumida'; resposta: string }): Promise<Resultado> => {
    const agora = new Date().toISOString()
    // A pergunta como o arquivo a tem antes da resposta: título, caso e endereço vêm dele, não do painel que pediu.
    const { abertas, assumidas } = lerPerguntas(pasta())
    const q = [...abertas, ...assumidas].find((x) => x.id === input.id) ?? { id: input.id, titulo: '', caso: null, endereco: null }
    let versao: number
    try {
      versao = gravarResposta(pasta(), { ...input, agora }).versao
    } catch (e) {
      return { gravou: false, motivo: msg(e), codigo: e instanceof RecusaDoPainel ? e.codigo : 'erro' }
    }
    avisarPaineis()
    const entrega = await entregarResposta(q, input.esperado, input.resposta.trim(), versao)
    return { gravou: true, entrega }
  })

  // Entrega à sessão a resposta já gravada e anota o desfecho na pergunta (presa à versão que a gravação deixou). O destino
  // é só o endereço gravado na pergunta (F448): nem o título da sessão nem a orquestradora ativa entram na rota.
  async function entregarResposta(q: { id: string; titulo: string; caso: string | null; endereco: string | null }, esperado: 'aberta' | 'assumida', resposta: string, versao: number): Promise<EstadoDaEntrega> {
    const destino = q.endereco
    const texto = esperado === 'assumida' ? textoDaMudanca(q, resposta) : textoDaEntrega(q, resposta)
    const r = destino ? await filaDeEntrega.entregar(destino, { id: q.id, texto }) : null
    const entrega: EstadoDaEntrega = destino
      ? { estado: r!.ok ? 'entregue' : 'falhou', via: 'orca', destino, em: new Date().toISOString(), ...(r!.ok ? {} : { motivo: r!.motivo }) }
      : { estado: 'pendente', via: 'orca', em: new Date().toISOString(), motivo: 'a pergunta não tem endereço no Orca' }
    try { gravarEntregaDaResposta(pasta(), { id: q.id, versao, entrega }) } catch (e) { orca.log(`entrega de ${q.id} não anotada: ${msg(e)}`) }
    avisarPaineis()
    return entrega
  }

  // "Tentar entregar de novo": só para a respondida por esta aba cuja entrega falhou ou ficou pendente.
  orca.panels.handle('kit.reentregar', async (input: { id: string }): Promise<EstadoDaEntrega> => {
    const q = lerPerguntas(pasta()).pendentes.find((x) => x.id === input.id)
    if (!q) return { estado: 'falhou', via: 'orca', em: new Date().toISOString(), motivo: `${input.id} não está esperando entrega; releia a aba` }
    return entregarResposta(q, q.estadoAnterior, q.resposta, q.versao)
  })

  orca.panels.handle('kit.confirmar', async (input: { itens: { id: string; versao: number }[] }) => {
    const r = confirmarTodas(pasta(), input.itens, new Date().toISOString())
    avisarPaineis()
    return r
  })

  // O "Desfazer" do confirmar: volta a assumida só o que esta aba confirmou e ninguém mexeu depois.
  orca.panels.handle('kit.desfazer', async (input: { itens: { id: string; versao: number }[] }) => {
    const r = desfazerConfirmacao(pasta(), input.itens)
    avisarPaineis()
    return r
  })

  // "Responder" numa entrega: a mensagem vai ao destino que a aba mostrou ao operador, validado de novo aqui.
  orca.panels.handle('kit.seguimento', async (input: { destino: string; titulo: string; texto: string }) => {
    if (!destinoValido(input.destino)) return { ok: false, motivo: 'destino inválido' }
    if (!input.texto?.trim()) return { ok: false, motivo: 'a mensagem está vazia' }
    const corpo = `Seguimento do operador sobre a entrega "${input.titulo}", pela aba do kit no Orca: ${input.texto.trim()}`
    return enviar(input.destino, `Seguimento · ${input.titulo}`.slice(0, 120), corpo)
  })

  pararRelogio = () => { clearInterval(relogio); clearInterval(relogioDaBatida) }
}

let pararRelogio = () => {}
export function deactivate(): void { pararRelogio() }
