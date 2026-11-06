// Painel da aba do kit (F436), montado com o runtime de verdade do Orca (`orca plugin test`). O worker é trocado por
// `requests` que anotam cada pedido: prova o que cada gesto pede e que ler não pede nada além de `kit.ler`.
import { assert, mount, mockHost, test } from 'orca/testing'
import * as painel from './panel'
import type { Entrega, Leitura, Pergunta } from './protocol'

const AGORA = Date.now()
const iso = (msAtras: number) => new Date(AGORA - msAtras).toISOString()

const pergunta = (id: string, extra: Partial<Pergunta> = {}): Pergunta => ({
  id, versao: 1, estado: 'aberta', titulo: `F435 · pergunta ${id}`, caso: `caso de ${id}`, seNaoDecidir: `sem decisão ${id}`,
  recomendacao: `recomendo ${id}`, item: 'F435', projeto: 'kit', sessaoId: null, atualizadoEm: iso(60_000), endereco: 'dispatch:ctx_1', opcoes: null, ...extra,
})
const decisao = (id: string, item: string, extra: Partial<Pergunta> = {}) =>
  pergunta(id, { estado: 'assumida', titulo: `decidi ${id}`, item, recomendacao: `fiz ${id}`, caso: null, seNaoDecidir: null, ...extra })
const entrega = (chave: string, extra: Partial<Entrega> = {}): Entrega => ({
  chave, chaves: [chave], origem: 'orca', item: 'F432', titulo: `F432 · entrega ${chave}`, projeto: 'kit', em: iso(3_600_000), sessao: 'dona-f432',
  corpo: `mensagem ${chave}`, seguimento: { destino: 'run:run_a', quem: 'sessao' }, ...extra,
})
const leitura = (l: Partial<Leitura> = {}): Leitura =>
  ({ abertas: [], assumidas: [], pendentes: [], ilegiveis: 0, entregas: [], erroDaCaixa: null, caixaAte: null, lidoEm: AGORA, ...l })

/** Um worker de mentira: devolve as respostas dadas e anota cada pedido, com a entrada. */
function worker(respostas: Record<string, unknown>) {
  const pedidos: { nome: string; input: unknown }[] = []
  const requests: Record<string, (input: unknown) => unknown> = {}
  for (const nome of ['kit.ler', 'kit.responder', 'kit.confirmar', 'kit.desfazer', 'kit.reentregar', 'kit.seguimento']) {
    requests[nome] = (input: unknown) => {
      pedidos.push({ nome, input })
      const r = respostas[nome]
      if (r === undefined) throw new Error(`pedido inesperado: ${nome}`)
      return typeof r === 'function' ? (r as (i: unknown) => unknown)(input) : r
    }
  }
  return { host: mockHost({ requests }), pedidos, nomes: () => pedidos.map((p) => p.nome) }
}

const semErros = (v: { errors: unknown[]; warnings: unknown[]; refusals: unknown[] }) => {
  assert.deepEqual(v.errors, [])
  assert.deepEqual(v.warnings, [])
  assert.deepEqual(v.refusals, [])
}

test('ler não pede nada além de kit.ler, com entrada sem undefined; a mais antiga primeiro; contagens no trilho', async () => {
  const w = worker({ 'kit.ler': leitura({ abertas: [pergunta('Q2', { atualizadoEm: iso(60_000) }), pergunta('Q1', { atualizadoEm: iso(600_000) })], assumidas: [decisao('Q7', 'F1')], entregas: [entrega('e1'), entrega('e2')] }) })
  const v = await mount(painel, { host: w.host })
  assert.ok(w.pedidos.length > 0)
  assert.deepEqual(w.nomes(), ['kit.ler'])
  assert.equal(JSON.stringify(w.pedidos[0].input).includes('undefined'), false)
  assert.deepEqual(w.pedidos[0].input, { forcar: false })
  const titulos = v.findAll({ text: /^F435 · pergunta Q\d$/ }).map((n: { text?: string }) => JSON.stringify(n))
  assert.equal(titulos.length, 2)
  assert.ok(titulos[0].includes('Q1') && titulos[1].includes('Q2'), 'a que espera há mais tempo vem primeiro')
  assert.ok(v.find({ label: 'Perguntas · 2 abertas' }))
  assert.ok(v.find({ label: 'Decisões · 1 a confirmar' }))
  assert.ok(v.find({ label: 'Entregas · 2 novas' }))
  assert.ok(v.find({ text: 'Recomendação' }))
  assert.ok(v.find({ text: 'Se ninguém decidir: sem decisão Q1' }))
  assert.ok(v.find({ text: 'Vai para F435 · acorda a sessão' }))
  semErros(v)
  await v.unmount()
})

test('aceitar a recomendação responde à versão lida e vira o cartão compacto; o trilho desconta na hora', async () => {
  const w = worker({
    'kit.ler': leitura({ abertas: [pergunta('Q1', { versao: 4 })] }),
    'kit.responder': { gravou: true, entrega: { estado: 'entregue', via: 'orca', destino: 'dispatch:ctx_1', em: iso(0) } },
  })
  const v = await mount(painel, { host: w.host })
  await v.press({ role: 'button', text: 'Aceitar a recomendação' })
  const r = w.pedidos.find((p) => p.nome === 'kit.responder')
  assert.ok(r)
  assert.deepEqual(r.input, { id: 'Q1', versao: 4, esperado: 'aberta', resposta: 'sim (segue a recomendação)' }, 'a resposta do Sim do painel, que a sessão e a trava de limpeza reconhecem')
  assert.ok(v.find({ text: 'Você aceitou a recomendação.' }))
  assert.ok(v.find({ text: 'Entregue a F435' }))
  assert.ok(v.find({ label: 'Perguntas · nenhuma aberta' }))
  assert.equal(v.find({ role: 'button', text: 'Aceitar a recomendação' }), null)
  semErros(v)
  await v.unmount()
})

test('responder outra coisa: o texto vai byte a byte; o rascunho sobrevive à releitura; sem endereço o verbo é Gravar', async () => {
  const PERIGOSO = `sim, "aspas" 'simples' $(touch /tmp/x) \`id\`; exit 3`
  const w = worker({
    'kit.ler': leitura({ abertas: [pergunta('Q1', { endereco: null })] }),
    'kit.responder': { gravou: true, entrega: { estado: 'pendente', via: 'orca', em: iso(0), motivo: 'sem endereço' } },
  })
  const v = await mount(painel, { host: w.host })
  await v.press({ role: 'button', text: 'Responder outra coisa…' })
  await v.type({ label: 'Sua resposta' }, PERIGOSO)
  assert.ok(v.find({ text: 'Sem endereço no Orca: a resposta fica gravada, mas não acorda a sessão. Se ela espera você, abra-a e avise.' }))
  await v.press({ label: 'Reler agora' })
  assert.equal(v.valueOf(v.find({ label: 'Sua resposta' })), PERIGOSO, 'a releitura não apaga o rascunho')
  assert.deepEqual(w.pedidos.filter((p) => p.nome === 'kit.ler').at(-1)?.input, { forcar: true }, 'o reler manual relê a caixa do Orca')
  await v.press({ role: 'button', text: 'Gravar resposta' })
  assert.equal((w.pedidos.find((p) => p.nome === 'kit.responder')?.input as { resposta: string }).resposta, PERIGOSO)
  assert.ok(v.find({ text: 'Entrega pendente' }))
  semErros(v)
  await v.unmount()
})

test('recusa porque a pergunta mudou: diz o motivo, relê e mantém o rascunho; o número volta', async () => {
  let lidas = 0
  const w = worker({
    'kit.ler': () => leitura({ abertas: [pergunta('Q1', { versao: ++lidas })] }),
    'kit.responder': { gravou: false, codigo: 'mudou', motivo: 'Q1 mudou' },
  })
  const v = await mount(painel, { host: w.host })
  await v.press({ role: 'button', text: 'Responder outra coisa…' })
  await v.type({ label: 'Sua resposta' }, 'talvez')
  await v.press({ role: 'button', text: 'Enviar resposta' })
  assert.ok(v.find({ text: 'Não gravou: a pergunta mudou depois que a aba a leu. Ela foi relida acima; confira antes de responder de novo.' }))
  assert.equal(v.valueOf(v.find({ label: 'Sua resposta' })), 'talvez')
  assert.ok(v.find({ label: 'Perguntas · 1 aberta' }))
  await v.press({ role: 'button', text: 'Enviar resposta' })
  const respostas = w.pedidos.filter((p) => p.nome === 'kit.responder').map((p) => (p.input as { versao: number }).versao)
  assert.deepEqual(respostas, [1, 2], 'a segunda tentativa usa a versão relida')
  semErros(v)
  await v.unmount()
})

test('respondida fora desta aba: depois da recusa a pergunta sumiu da leitura e o cartão diz isso', async () => {
  let n = 0
  const w = worker({
    'kit.ler': () => leitura({ abertas: n++ === 0 ? [pergunta('Q1')] : [] }),
    'kit.responder': { gravou: false, codigo: 'mudou', motivo: 'Q1 mudou' },
  })
  const v = await mount(painel, { host: w.host })
  await v.press({ role: 'button', text: 'Aceitar a recomendação' })
  assert.ok(v.find({ text: 'Já foi respondida fora desta aba.' }))
  semErros(v)
  await v.unmount()
})

test('decisões por item, o primeiro grupo aberto; confirmar uma e desfazer com a versão que a confirmação deixou', async () => {
  const w = worker({
    'kit.ler': leitura({ assumidas: [decisao('Q1', 'F2', { versao: 3, atualizadoEm: iso(1_000) }), decisao('Q2', 'F1', { atualizadoEm: iso(9_000_000) })] }),
    'kit.confirmar': { confirmadas: ['Q1'], recusadas: [], versoes: { Q1: 4 } },
    'kit.desfazer': { desfeitas: ['Q1'], recusadas: [] },
  })
  const v = await mount(painel, { host: w.host, persisted: { plugin: { secao: 'decisoes' } } })
  assert.ok(v.find({ text: 'Confirmar só grava; ninguém é acordado.' }))
  assert.ok(v.find({ text: 'decidi Q1' }), 'o grupo mais recente começa aberto')
  assert.equal(v.find({ text: 'decidi Q2' }), null, 'os outros começam fechados')
  assert.ok(v.find({ text: 'Decidiu: fiz Q1' }))
  await v.press({ label: 'Confirmar: decidi Q1' })
  assert.deepEqual(w.pedidos.find((p) => p.nome === 'kit.confirmar')?.input, { itens: [{ id: 'Q1', versao: 3 }] })
  assert.ok(v.find({ text: 'Confirmada: decidi Q1' }))
  assert.ok(v.find({ label: 'Decisões · 1 a confirmar' }))
  await v.press({ role: 'button', text: 'Desfazer' })
  assert.deepEqual(w.pedidos.find((p) => p.nome === 'kit.desfazer')?.input, { itens: [{ id: 'Q1', versao: 4 }] })
  semErros(v)
  await v.unmount()
})

test('confirmar o grupo manda só as do grupo; confirmar todas pede dois toques e ignora o segundo nos primeiros 500 ms', async () => {
  const w = worker({
    'kit.ler': leitura({ assumidas: [decisao('Q1', 'F2'), decisao('Q2', 'F2'), decisao('Q3', 'F1', { atualizadoEm: iso(9_000_000) })] }),
    'kit.confirmar': (input: { itens: { id: string; versao: number }[] }) => ({ confirmadas: input.itens.map((i) => i.id), recusadas: [], versoes: Object.fromEntries(input.itens.map((i) => [i.id, i.versao + 1])) }),
  })
  const v = await mount(painel, { host: w.host, persisted: { plugin: { secao: 'decisoes' } } })
  await v.press({ role: 'button', text: 'Confirmar as 2 do F2' })
  assert.deepEqual(w.pedidos.filter((p) => p.nome === 'kit.confirmar').map((p) => p.input), [{ itens: [{ id: 'Q1', versao: 1 }, { id: 'Q2', versao: 1 }] }])
  assert.ok(v.find({ text: '2 decisões confirmadas.' }))

  let agora = AGORA
  painel.relogio.agora = () => agora
  try {
    await v.press({ role: 'button', text: 'Confirmar todas (1)' })
    assert.ok(v.find({ text: 'Inclui as que você não abriu.' }))
    await v.press({ role: 'button', text: 'Confirmar agora' })
    assert.equal(w.pedidos.filter((p) => p.nome === 'kit.confirmar').length, 1, 'o toque nos primeiros 500 ms não confirma')
    agora += 600
    await v.press({ role: 'button', text: 'Confirmar agora' })
    assert.deepEqual(w.pedidos.filter((p) => p.nome === 'kit.confirmar').at(-1)?.input, { itens: [{ id: 'Q3', versao: 1 }] })
  } finally {
    painel.relogio.agora = () => Date.now()
  }
  assert.equal(w.nomes().filter((n) => n === 'kit.responder' || n === 'kit.seguimento').length, 0, 'confirmar não acorda ninguém')
  semErros(v)
  await v.unmount()
})

test('discordar de uma decisão responde como assumida, com o texto do campo', async () => {
  const w = worker({
    'kit.ler': leitura({ assumidas: [decisao('Q1', 'F2', { versao: 2 })] }),
    'kit.responder': { gravou: true, entrega: { estado: 'entregue', via: 'orca', destino: 'dispatch:ctx_1', em: iso(0) } },
  })
  const v = await mount(painel, { host: w.host, persisted: { plugin: { secao: 'decisoes' } } })
  await v.press({ label: 'Discordar…' })
  await v.type({ label: 'O que deve mudar' }, 'use a pasta plugins/')
  await v.press({ role: 'button', text: 'Enviar mudança' })
  assert.deepEqual(w.pedidos.find((p) => p.nome === 'kit.responder')?.input, { id: 'Q1', versao: 2, esperado: 'assumida', resposta: 'use a pasta plugins/' })
  assert.ok(v.find({ text: 'Você mudou: use a pasta plugins/' }))
  semErros(v)
  await v.unmount()
})

test('limpar uma entrega guarda as chaves no armazenamento do plugin, sem pedir nada ao worker; desfazer e ver as limpas', async () => {
  const w = worker({ 'kit.ler': leitura({ entregas: [entrega('e1', { chaves: ['e1', 'painel:F432'] }), entrega('e2')] }) })
  const v = await mount(painel, { host: w.host, persisted: { plugin: { secao: 'entregas' } } })
  assert.ok(v.find({ text: 'Últimos 7 dias. Limpar não apaga.' }))
  await v.press({ testId: 'limpar-e1' })
  const lidas = v.persisted.storage.lidas as Record<string, number>
  assert.ok(lidas && Object.keys(lidas).length > 0)
  assert.deepEqual(Object.keys(lidas).sort(), ['e1', 'painel:F432'])
  assert.ok(v.find({ text: 'Limpa: F432 · entrega e1' }), 'a linha fica no lugar até reler')
  assert.ok(v.find({ label: 'Entregas · 1 nova' }))
  await v.press({ role: 'button', text: 'Desfazer' })
  assert.deepEqual(v.persisted.storage.lidas, {})
  await v.press({ role: 'button', text: 'Limpar todas (2)' })
  await v.press({ label: 'Reler agora' })
  assert.ok(v.find({ text: 'Nada novo para ver' }))
  await v.press({ role: 'button', text: 'Ver as limpas (2)' })
  assert.ok(v.find({ text: 'F432 · entrega e2' }))
  assert.deepEqual([...new Set(w.nomes())], ['kit.ler'])
  semErros(v)
  await v.unmount()
})

test('responder a uma entrega vai ao destino que o worker calculou; sem rota o botão não aparece', async () => {
  const w = worker({
    'kit.ler': leitura({ entregas: [entrega('e1', { seguimento: { destino: 'run:run_a', quem: 'coordenadora' } }), entrega('e2', { seguimento: null, titulo: 'sem rota' })] }),
    'kit.seguimento': { ok: true },
  })
  const v = await mount(painel, { host: w.host, persisted: { plugin: { secao: 'entregas' } } })
  assert.equal(v.findAll({ role: 'button', text: 'Responder…' }).length, 1)
  await v.press({ role: 'button', text: 'Responder…' })
  assert.ok(v.find({ text: 'A sessão do F432 já fechou: vai para a orquestradora · acorda a orquestradora' }))
  await v.type({ label: 'O que você quer saber ou pedir' }, 'e o teste?')
  await v.press({ role: 'button', text: 'Enviar à orquestradora' })
  assert.deepEqual(w.pedidos.find((p) => p.nome === 'kit.seguimento')?.input, { destino: 'run:run_a', titulo: 'F432 · entrega e1', texto: 'e o teste?' })
  assert.ok(v.find({ text: 'Enviado à orquestradora.' }))
  semErros(v)
  await v.unmount()
})

test('fora de Perguntas, a pergunta aberta aparece numa faixa que leva a ela', async () => {
  const w = worker({ 'kit.ler': leitura({ abertas: [pergunta('Q1')] }) })
  const v = await mount(painel, { host: w.host, persisted: { plugin: { secao: 'entregas' } } })
  // Com pergunta aberta, a aba abre em Perguntas; a faixa aparece quando a pessoa sai dela.
  assert.ok(v.find({ role: 'button', text: 'Aceitar a recomendação' }))
  await v.press({ label: 'Entregas · nenhuma nova' })
  assert.ok(v.find({ text: '1 pergunta esperando você' }))
  await v.press({ role: 'button', text: 'Ver' })
  assert.ok(v.find({ role: 'button', text: 'Aceitar a recomendação' }))
  assert.deepEqual(v.persisted.plugin.secao, 'perguntas')
  semErros(v)
  await v.unmount()
})

test('a primeira leitura falhou: o motivo em português no lugar da seção, sem o erro cru, e tentar de novo', async () => {
  let n = 0
  const w = worker({ 'kit.ler': () => { if (n++ === 0) throw new Error('input: Invalid input'); return leitura() } })
  const v = await mount(painel, { host: w.host })
  assert.ok(v.find({ text: /^Não li o painel do kit: / }))
  assert.equal(v.find({ text: /Invalid input/ }), null)
  await v.press({ role: 'button', text: 'Tentar de novo' })
  assert.ok(v.find({ text: 'Nenhuma pergunta esperando você' }))
  await v.unmount()
})

test('o worker avisa que mudou: a aba relê sozinha, sem forçar a caixa', async () => {
  let n = 0
  const w = worker({ 'kit.ler': () => leitura({ abertas: n++ === 0 ? [] : [pergunta('Q1')] }) })
  const v = await mount(painel, { host: w.host })
  await v.post('kit.mudou', { em: Date.now() })
  await v.settled()
  assert.ok(v.find({ label: 'Perguntas · 1 aberta' }))
  assert.deepEqual(w.pedidos.at(-1)?.input, { forcar: false })
  await v.unmount()
})

test('pergunta com opções: um botão por opção, a primeira em destaque; a resposta é o id; o campo livre só com "outra"', async () => {
  const opcoes = [{ id: 'gate', label: 'Rodar o gate' }, { id: 'esperar', label: 'Esperar o próximo' }]
  const w = worker({
    'kit.ler': leitura({ abertas: [pergunta('Q1', { opcoes }), pergunta('Q2', { opcoes: [...opcoes, { id: 'outra', label: 'Outra' }], atualizadoEm: iso(1000) })] }),
    'kit.responder': { gravou: true, entrega: { estado: 'entregue', via: 'orca', destino: 'dispatch:ctx_1', em: iso(0) } },
  })
  const v = await mount(painel, { host: w.host })
  assert.equal(v.find({ role: 'button', text: 'Aceitar a recomendação' }), null, 'com opções, não há o Sim genérico')
  assert.equal(v.findAll({ role: 'button', text: 'Rodar o gate' }).length, 2)
  assert.equal(v.findAll({ role: 'button', text: 'Responder outra coisa…' }).length, 1, 'só a pergunta com "outra" abre o campo livre')
  assert.equal(v.find({ role: 'button', text: 'Outra' }), null, '"outra" não vira botão próprio')
  await v.press({ role: 'button', text: 'Esperar o próximo' })
  const r = w.pedidos.find((p) => p.nome === 'kit.responder')
  assert.ok(r)
  assert.deepEqual(r.input, { id: 'Q1', versao: 1, esperado: 'aberta', resposta: 'esperar' })
  assert.ok(v.find({ text: 'Você escolheu: Esperar o próximo' }))
  semErros(v)
  await v.unmount()
})

test('caixa do Orca cortada no limite: Entregas diz até quando as do Orca vão', async () => {
  const w = worker({ 'kit.ler': leitura({ entregas: [entrega('e1')], caixaAte: iso(5 * 3_600_000) }) })
  const v = await mount(painel, { host: w.host, persisted: { plugin: { secao: 'entregas' } } })
  assert.ok(v.find({ text: /^As entregas do Orca vão só até .+: a caixa dele guarda as mensagens mais novas\.$/ }))
  semErros(v)
  await v.unmount()
})
