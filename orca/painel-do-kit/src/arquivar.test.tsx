// O botão "Arquivar concluídas" da seção Sessões (F469), montado com o runtime de verdade do Orca (`orca plugin test`). Quem decide
// o que passa nas condições é o `painel.mjs` (provado em hooks/tests/painel-orquestradora-orca.test.mjs); aqui, o que a aba desenha
// e o que ela manda ao worker.
import { assert, mount, mockHost, test } from 'orca/testing'
import * as painel from './panel'
import type { Concluida, ConcluidasLidas, DesfechoDoArquivar, Leitura } from './protocol'

const AGORA = Date.now()
const leitura = (): Leitura => ({
  abertas: [], assumidas: [], pendentes: [], ilegiveis: 0, entregas: [], erroDaCaixa: null, caixaAte: null, atualizacao: [], lidoEm: AGORA,
  sessoes: { projetos: [], paradas: 0, ilegiveis: 0, batidaEm: new Date(AGORA - 60_000).toISOString(), erro: null, lidoEm: AGORA },
})
const F7: Concluida = { item: 'F7', titulo: 'tema sete' }
const F8: Concluida = { item: 'F8', titulo: 'F8 · tema oito' }

const montadas: { unmount: () => Promise<void> }[] = []
const teste = (nome: string, corpo: () => Promise<void>) => test(nome, async () => {
  try { await corpo() } finally { for (const v of montadas.splice(0)) await v.unmount() }
})
/** `aptas` vale a cada `kit.concluidas`; `desfecho` é a resposta do `kit.arquivar` (pode ser uma promessa, para o teste segurá-la). */
async function montar(aptas: () => Concluida[] | 'quebra', desfecho: (itens: string[]) => Promise<DesfechoDoArquivar> | DesfechoDoArquivar = () => ({ arquivadas: [], recusadas: [], erro: null })) {
  const pedidos: { itens: string[] }[] = []
  const v = await mount(painel, {
    host: mockHost({
      requests: {
        'kit.ler': () => leitura(),
        'kit.contas': () => ({ contas: [], erro: null, lidoEm: Date.now() }),
        'kit.concluidas': (): ConcluidasLidas => { const a = aptas(); if (a === 'quebra') throw new Error('sem painel'); return { aptas: a, erro: null, lidoEm: Date.now() } },
        'kit.arquivar': (i: { itens: string[] }) => { pedidos.push(i); return desfecho(i.itens) },
      },
    }),
  })
  montadas.push(v)
  return { v, pedidos }
}

teste('sem concluída que passa nas condições, não há botão', async () => {
  const { v } = await montar(() => [])
  assert.ok(v.find({ role: 'heading', text: 'Sessões' }), 'prova: a seção está montada')
  assert.equal(v.find({ text: /Arquivar concluídas/ }), null)
})

teste('com o worker sem responder, não há botão e a aba segue de pé', async () => {
  const { v } = await montar(() => 'quebra')
  assert.equal(v.find({ text: /Arquivar concluídas/ }), null)
  assert.ok(v.find({ role: 'heading', text: 'Sessões' }))
})

teste('com concluídas aptas: "Arquivar concluídas (N)" abre a confirmação com a lista; Cancelar não arquiva', async () => {
  const { v, pedidos } = await montar(() => [F7, F8])
  assert.ok(v.find({ text: 'Arquivar concluídas (2)' }), 'o botão traz o N')
  await v.press({ text: 'Arquivar concluídas (2)' })
  assert.ok(v.find({ text: 'Arquivar 2 sessões concluídas?' }))
  assert.ok(v.find({ text: 'A pasta de cada uma é apagada (o que o git ignora, como .env, vai junto) e elas somem da barra lateral.' }))
  assert.ok(v.find({ text: 'F7 · tema sete' }))
  assert.ok(v.find({ text: 'F8 · tema oito' }), 'o prefixo do item não se repete')
  await v.press({ text: 'Cancelar' })
  assert.equal(pedidos.length, 0, 'cancelar não manda nada ao worker')
  assert.ok(v.find({ text: 'Arquivar concluídas (2)' }), 'o botão volta')
})

teste('uma só concluída: a confirmação fala no singular', async () => {
  const { v } = await montar(() => [F7])
  await v.press({ text: 'Arquivar concluídas (1)' })
  assert.ok(v.find({ text: 'Arquivar 1 sessão concluída?' }))
  assert.ok(v.find({ text: 'A pasta dela é apagada (o que o git ignora, como .env, vai junto) e ela some da barra lateral.' }))
})

teste('confirmar manda só os itens mostrados; enquanto arquiva mostra "Arquivando…", no fim "N arquivadas" e o botão some', async () => {
  let aptas = [F7, F8]
  let solta: (d: DesfechoDoArquivar) => void = () => {}
  const { v, pedidos } = await montar(() => aptas, () => new Promise<DesfechoDoArquivar>((r) => { solta = r }))
  await v.press({ text: 'Arquivar concluídas (2)' })
  const indo = v.press({ text: 'Arquivar as 2' })
  await new Promise((r) => setTimeout(r, 50))
  assert.deepEqual(pedidos, [{ itens: ['F7', 'F8'] }])
  assert.ok(v.find({ label: 'Arquivando 2 sessões…' }), 'carregando no lugar do clique')
  assert.equal(v.find({ text: /Arquivar concluídas/ }), null, 'o botão não fica clicável de novo')
  aptas = []
  solta({ arquivadas: [F7, F8], recusadas: [], erro: null })
  await indo
  await new Promise((r) => setTimeout(r, 50))
  assert.ok(v.find({ text: '2 sessões arquivadas.' }), 'feito')
  await v.press({ text: 'Fechar' })
  assert.equal(v.find({ text: /Arquivar concluídas/ }), null, 'sem concluída, sem botão')
})

teste('a recusa mostra qual ficou e por quê, e o botão volta com as que ainda passam', async () => {
  let aptas = [F7, F8]
  const { v } = await montar(() => aptas, () => {
    aptas = [F8]
    return { arquivadas: [F7], recusadas: [{ ...F8, motivo: 'pergunta aberta do F8: Q5' }], erro: null }
  })
  await v.press({ text: 'Arquivar concluídas (2)' })
  await v.press({ text: 'Arquivar as 2' })
  await new Promise((r) => setTimeout(r, 50))
  assert.ok(v.find({ text: '1 sessão arquivada.' }))
  const ficou = v.find({ text: 'F8 ficou: pergunta aberta do F8: Q5.' })
  assert.ok(ficou)
  assert.equal(ficou.props?.tone, 'warning', 'recusa parcial é aviso, não erro')
  await v.press({ text: 'Fechar' })
  assert.ok(v.find({ text: 'Arquivar concluídas (1)' }))
})

teste('falha do worker: diz que não arquivou e por quê', async () => {
  const { v } = await montar(() => [F7], () => ({ arquivadas: [], recusadas: [], erro: 'o plugin orquestracao não está instalado no escopo do usuário' }))
  await v.press({ text: 'Arquivar concluídas (1)' })
  await v.press({ text: 'Arquivar' })
  await new Promise((r) => setTimeout(r, 50))
  assert.ok(v.find({ text: 'Não arquivou: o plugin orquestracao não está instalado no escopo do usuário.' }))
})

teste('o desfecho de recusa parcial não é uma faixa vermelha e a falha do worker oferece "Tentar de novo"', async () => {
  const { v } = await montar(() => [F7], () => ({ arquivadas: [], recusadas: [], erro: 'o Orca não respondeu' }))
  await v.press({ text: 'Arquivar concluídas (1)' })
  await v.press({ text: 'Arquivar' })
  await new Promise((r) => setTimeout(r, 50))
  assert.ok(v.find({ text: 'Tentar de novo' }))
  await v.press({ text: 'Tentar de novo' })
  assert.ok(v.find({ text: 'Arquivar concluídas (1)' }), 'volta ao botão')
})
