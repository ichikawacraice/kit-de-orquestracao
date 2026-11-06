// Worker da aba do kit (F436), rodado como o Orca o roda (`orca plugin test`). O terminal do mock executa o comando num
// shell de verdade, com um `orca` falso: prova o envio byte a byte e conta as chamadas que acordam alguém.
import { assert, mountWorker, mockHost, test } from 'orca/testing'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import * as main from './worker'
import { ESPERA_ENVIO_MS, JANELA_DA_ENTREGA_MS, PRAZO_DO_ENVIO_MS, LIMITE_DA_CAIXA } from './protocol'

const PERIGOSO = `sim, "aspas" 'simples' $(touch /tmp/f436-w-pwned) \`id\` $HOME; exit 3`

type Ws = { id: string; kind: 'worktree' | 'folder'; name: string; path: string; branch: string | null; hostId: string | null }
// `janelaMs`: a janela do lote de respostas (F448); 0 entrega na hora, para os casos que não medem o lote.
// `batida`: liga a batida de leitura (F460) com um `painel.mjs` falso que grava o deduzido; sem ela, a batida fica desligada
// (nenhum teste roda o painel.mjs instalado nem toca o ~/.claude real).
function ambiente(opcoes: { workspaces?: (raiz: string) => Ws[]; mensagens?: object[]; janelaMs?: number; workers?: object[]; batida?: boolean } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'f436-worker-'))
  const painel = join(raiz, 'painel')
  mkdirSync(join(painel, 'perguntas'), { recursive: true })
  mkdirSync(join(painel, 'fila'), { recursive: true })
  const log = join(raiz, 'chamadas.log')
  const args = join(raiz, 'args.json')
  const orca = join(raiz, 'orca')
  const mensagens = opcoes.mensagens ?? [{ id: 'msg_1', type: 'worker_done', run_id: 'run_a', subject: 'F9 · PR 1 pronto', body: 'feito', payload: '{"dispatchId":"ctx_1","outcome":"succeeded"}', created_at: new Date().toISOString() }]
  const caixa = join(raiz, 'caixa.json')
  writeFileSync(caixa, JSON.stringify(mensagens))
  const workers = join(raiz, 'workers.json')
  writeFileSync(workers, JSON.stringify({ result: { workers: opcoes.workers ?? [] } }))
  writeFileSync(orca, `#!/usr/bin/env node
const fs = require('fs'); const a = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, a[1] + '\\n');
if (a[1] === 'inbox') { const m = JSON.parse(fs.readFileSync(${JSON.stringify(caixa)}, 'utf8')); const i = a.indexOf('--limit'); console.log(JSON.stringify({ result: { messages: i < 0 ? m : m.slice(0, Number(a[i + 1])) } })); }
else if (a[1] === 'worker-list') console.log(fs.readFileSync(${JSON.stringify(workers)}, 'utf8'));
else if (a[1] === 'send') { fs.writeFileSync(${JSON.stringify(args)}, JSON.stringify(a)); fs.appendFileSync(${JSON.stringify(args)} + 'l', JSON.stringify(a) + '\\n'); console.log('{"ok":true,"result":{"messageId":"msg_x"}}'); }
`)
  chmodSync(orca, 0o755)
  process.env.PAINEL_DIR = painel
  process.env.HOME = raiz // nenhum teste lê o ~/.claude real nem faz git fetch no clone dele
  process.env.PAINEL_DO_KIT_ORCA = orca
  process.env.PAINEL_DO_KIT_JANELA_MS = String(opcoes.janelaMs ?? 0)
  const logDaBatida = join(raiz, 'batida.log')
  const script = join(raiz, 'painel-falso.cjs')
  writeFileSync(script, `const fs = require('fs'); const path = require('path');
fs.appendFileSync(${JSON.stringify(logDaBatida)}, JSON.stringify({ argv: process.argv.slice(2), base: process.env.HOOKS_CREWAI_BASE, electron: process.env.ELECTRON_RUN_AS_NODE }) + '\\n');
if (process.argv[2] === 'orquestradora') { // F469: o arquivar --concluidas; a resposta do cenário está em arquivar.json
  const r = JSON.parse(fs.readFileSync(path.join(path.dirname(${JSON.stringify(log)}), 'arquivar.json'), 'utf8'));
  const x = process.argv.includes('--seco') ? r.seco : r.real;
  if (r.uso) { process.stderr.write('uso: painel.mjs orquestradora arquivar <ctx_…>'); process.exitCode = 1; return; }
  process.stdout.write(JSON.stringify(x)); process.exitCode = x.recusadas && x.recusadas.length ? 1 : 0; return;
}
const d = path.join(process.env.HOOKS_CREWAI_BASE, 'batida'); fs.mkdirSync(d, { recursive: true });
fs.writeFileSync(path.join(d, 'deduzido.json'), JSON.stringify({ em: new Date().toISOString(), fonte: 'leitura', itens: {} }));
console.log(JSON.stringify({ gravado: true }));
`)
  process.env.PAINEL_DO_KIT_SCRIPT = script
  process.env.PAINEL_DO_KIT_BATIDA = opcoes.batida ? '' : 'off'
  delete process.env.HOOKS_CREWAI_BASE
  const pergunta = (id: string, data: object, version = 1) =>
    writeFileSync(join(painel, 'perguntas', `${id}.json`), JSON.stringify({ id, version, data }))
  const doc = (id: string) => JSON.parse(readFileSync(join(painel, 'perguntas', `${id}.json`), 'utf8'))
  const chamadas = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [])
  // O terminal do Orca roda o comando num shell; aqui, o mesmo comando sem o `exit` final.
  const host = mockHost({
    results: {
      'workspace.list': { workspaces: opcoes.workspaces?.(raiz) ?? [{ id: 'ws1', kind: 'worktree', name: 'kit', path: raiz, branch: 'main', hostId: null }], truncated: false },
      'terminal.create': (p: { command: string }) => {
        execFileSync('/bin/zsh', ['-c', p.command.replace(/; exit$/, '')], { timeout: 10_000, killSignal: 'SIGKILL' })
        return { terminalId: 't1' }
      },
    },
  })
  const respostaDoArquivar = (r: object) => writeFileSync(join(raiz, 'arquivar.json'), JSON.stringify(r))
  const todosEnviados = () => (existsSync(args + 'l') ? readFileSync(args + 'l', 'utf8').trim().split('\n').map((l) => JSON.parse(l) as string[]) : [])
  const batidas = () => (existsSync(logDaBatida) ? readFileSync(logDaBatida, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { argv: string[]; base: string; electron: string }) : [])
  return { painel, host, pergunta, doc, chamadas, enviados: () => JSON.parse(readFileSync(args, 'utf8')), todosEnviados, batidas, respostaDoArquivar }
}

test('ler não acorda ninguém: nenhum terminal, nenhum agente, nenhuma mensagem; só inbox e worker-list do CLI', async () => {
  const a = ambiente()
  a.pergunta('Q1', { estado: 'aberta', titulo: 'qual pasta', caso: 'c', recomendacao: 'r', endereco: { orca: 'dispatch:ctx_1' } })
  a.pergunta('Q2', { estado: 'assumida', titulo: 'fiz assim' })
  const w = await mountWorker(main, { host: a.host })
  const r = await w.request('kit.ler', { forcar: true })
  assert.deepEqual(r.abertas.map((q: { id: string }) => q.id), ['Q1'])
  assert.deepEqual(r.assumidas.map((q: { id: string }) => q.id), ['Q2'])
  assert.deepEqual(r.entregas.map((e: { chave: string }) => e.chave), ['orca:msg_1'])
  await w.request('kit.ler', {})
  assert.equal(a.host.callsOf('terminal.create').length, 0)
  assert.equal(a.host.callsOf('agent.launch').length, 0)
  assert.deepEqual(a.chamadas().sort(), ['inbox', 'worker-list'], 'a segunda leitura usa a caixa já lida (até 1 min)')
  assert.ok(a.host.callsOf('statusBar.update').length >= 1)
  assert.deepEqual(w.refusals, [])
  await w.deactivate()
})

// F463: o aviso de versão nova sai do cache da conferência do kit; a rede só é tocada quando o prazo (30 min) vence, e em segundo plano.
test('ler traz a atualização do kit: versão publicada mais nova que a instalada, lida do cache, sem esperar a rede', async () => {
  const a = ambiente()
  const casa = mkdtempSync(join(tmpdir(), 'f463-home-'))
  mkdirSync(join(casa, '.claude', 'plugins'), { recursive: true })
  writeFileSync(join(casa, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: {
    'orquestracao@ichikawa-kit': [{ scope: 'user', version: '0.1.108' }], 'painel-sessoes@ichikawa-kit': [{ scope: 'user', version: '0.9.20' }],
  } }))
  const cache = join(dirname(a.painel), 'batida', 'kit-publicado.json')
  mkdirSync(dirname(cache), { recursive: true })
  writeFileSync(cache, JSON.stringify({ em: new Date().toISOString(), publicado: { orquestracao: '0.1.109', 'painel-sessoes': '0.9.20' } }))
  const homeAntes = process.env.HOME
  process.env.HOME = casa
  try {
    const w = await mountWorker(main, { host: a.host })
    const r = await w.request('kit.ler', { forcar: true })
    assert.deepEqual(r.atualizacao, [{ nome: 'orquestracao', instalada: '0.1.108', publicada: '0.1.109' }])
    // em dia: a mesma leitura com o instalado já na publicada não traz nada
    writeFileSync(join(casa, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'orquestracao@ichikawa-kit': [{ scope: 'user', version: '0.1.109' }] } }))
    assert.deepEqual((await w.request('kit.ler', {})).atualizacao, [])
    await w.deactivate()
  } finally {
    if (homeAntes === undefined) delete process.env.HOME; else process.env.HOME = homeAntes
  }
})

test('ler sem plugin do kit instalado ou sem cache não quebra a leitura: atualizacao vazia', async () => {
  const a = ambiente()
  const casa = mkdtempSync(join(tmpdir(), 'f463-vazia-'))
  const homeAntes = process.env.HOME
  process.env.HOME = casa
  try {
    const w = await mountWorker(main, { host: a.host })
    const r = await w.request('kit.ler', { forcar: true })
    assert.deepEqual(r.atualizacao, [])
    assert.deepEqual(w.refusals, [])
    await w.deactivate()
  } finally {
    if (homeAntes === undefined) delete process.env.HOME; else process.env.HOME = homeAntes
  }
})

// F450: a aba que não viu a resposta do `kit.responder` voltar pede o estado gravado das perguntas em voo.
test('ler com acompanhar devolve o estado gravado de cada id pedido; sem acompanhar, o campo não vem', async () => {
  const a = ambiente()
  a.pergunta('Q1', { estado: 'aberta', titulo: 'qual pasta', endereco: { orca: 'dispatch:ctx_1' } }, 4)
  const w = await mountWorker(main, { host: a.host })
  const r = await w.request('kit.responder', { id: 'Q1', versao: 4, esperado: 'aberta', resposta: 'sim' })
  assert.equal(r.gravou, true)
  const l = await w.request('kit.ler', { acompanhar: ['Q1', 'Q99'] })
  assert.ok(l.acompanhadas, 'a leitura trouxe as acompanhadas')
  assert.equal(l.acompanhadas.Q1.estado, 'respondida')
  assert.equal(l.acompanhadas.Q1.resposta, 'sim')
  assert.equal(l.acompanhadas.Q1.respondidaPor, 'operador-orca')
  assert.deepEqual(l.acompanhadas.Q1.entregaDaResposta, a.doc('Q1').data.entregaDaResposta)
  assert.equal(l.acompanhadas.Q99, null)
  assert.equal('acompanhadas' in (await w.request('kit.ler', {})), false)
  await w.deactivate()
})

test('responder com endereço grava a prova do clique e entrega o texto byte a byte à sessão que perguntou', async () => {
  const a = ambiente()
  a.pergunta('Q1', { estado: 'aberta', titulo: 'qual pasta', caso: 'o caso', endereco: { orca: 'dispatch:ctx_1' } }, 4)
  const w = await mountWorker(main, { host: a.host })
  const r = await w.request('kit.responder', { id: 'Q1', versao: 4, esperado: 'aberta', resposta: PERIGOSO })
  assert.equal(r.gravou, true)
  assert.equal(r.entrega.estado, 'entregue')
  const d = a.doc('Q1')
  assert.equal(d.data.resposta, PERIGOSO)
  assert.equal(d.data.respondidaPor, 'operador-orca')
  assert.equal(d.data.entregaDaResposta.estado, 'entregue')
  assert.equal(d.data.entregaDaResposta.destino, 'dispatch:ctx_1')
  assert.equal(d.version, 6)
  const enviados = a.enviados()
  assert.equal(enviados[3], 'dispatch:ctx_1')
  assert.ok(enviados[9].includes(PERIGOSO), `o corpo não trouxe a resposta inteira: ${enviados[9]}`)
  assert.ok(!existsSync('/tmp/f436-w-pwned'))
  const cmd = a.host.callsOf('terminal.create')[0].command as string
  assert.ok(!cmd.includes('aspas') && !cmd.includes('pwned'), cmd)
  assert.equal(a.host.callsOf('agent.launch').length, 0)
  assert.deepEqual(w.refusals, [])
  await w.deactivate()
})

test('responder sem endereço grava e deixa a entrega pendente, sem abrir terminal', async () => {
  const a = ambiente()
  a.pergunta('Q1', { estado: 'aberta', titulo: 't' })
  const w = await mountWorker(main, { host: a.host })
  const r = await w.request('kit.responder', { id: 'Q1', versao: 1, esperado: 'aberta', resposta: 'sim' })
  assert.equal(r.entrega.estado, 'pendente')
  assert.equal(a.doc('Q1').data.entregaDaResposta.estado, 'pendente')
  assert.equal(a.host.callsOf('terminal.create').length, 0)
  await w.deactivate()
})

test('versão velha: recusa sem gravar e sem enviar', async () => {
  const a = ambiente()
  a.pergunta('Q1', { estado: 'aberta', titulo: 't', endereco: { orca: 'run:run_a' } }, 2)
  const w = await mountWorker(main, { host: a.host })
  const r = await w.request('kit.responder', { id: 'Q1', versao: 1, esperado: 'aberta', resposta: 'sim' })
  assert.equal(r.gravou, false)
  assert.equal(r.codigo, 'mudou')
  assert.equal(a.doc('Q1').version, 2)
  assert.equal(a.host.callsOf('terminal.create').length, 0)
  await w.deactivate()
})

test('confirmar todas só grava: nenhuma sessão é acordada', async () => {
  const a = ambiente()
  a.pergunta('Q1', { estado: 'assumida', titulo: 'a', endereco: { orca: 'run:run_a' } })
  a.pergunta('Q2', { estado: 'assumida', titulo: 'b' })
  const w = await mountWorker(main, { host: a.host })
  const r = await w.request('kit.confirmar', { itens: [{ id: 'Q1', versao: 1 }, { id: 'Q2', versao: 1 }] })
  assert.deepEqual(r.confirmadas, ['Q1', 'Q2'])
  assert.equal(a.host.callsOf('terminal.create').length, 0)
  assert.ok(w.posts.some((p: { event: string }) => p.event === 'kit.mudou'))
  await w.deactivate()
})

test('desfazer a confirmação volta a decisão a assumida, presa à versão que a confirmação deixou', async () => {
  const a = ambiente()
  a.pergunta('Q1', { estado: 'assumida', titulo: 'a' }, 3)
  const w = await mountWorker(main, { host: a.host })
  const c = await w.request('kit.confirmar', { itens: [{ id: 'Q1', versao: 3 }] })
  assert.deepEqual(c.versoes, { Q1: 4 })
  const antes = w.posts.length
  const r = await w.request('kit.desfazer', { itens: [{ id: 'Q1', versao: c.versoes.Q1 }] })
  assert.deepEqual(r.desfeitas, ['Q1'])
  assert.equal(a.doc('Q1').data.estado, 'assumida')
  assert.equal(a.doc('Q1').data.resposta, undefined)
  assert.ok(w.posts.length > antes, 'os painéis são avisados')
  const de_novo = await w.request('kit.desfazer', { itens: [{ id: 'Q1', versao: 4 }] })
  assert.equal(de_novo.recusadas.length, 1, 'versão velha não desfaz duas vezes')
  assert.equal(a.host.callsOf('terminal.create').length, 0)
  await w.deactivate()
})

test('seguimento recusa destino inventado e envia ao destino válido', async () => {
  const a = ambiente()
  const w = await mountWorker(main, { host: a.host })
  assert.equal((await w.request('kit.seguimento', { destino: "run:x'; rm", titulo: 'F9', texto: 'oi' })).ok, false)
  assert.equal(a.host.callsOf('terminal.create').length, 0)
  const r = await w.request('kit.seguimento', { destino: 'run:run_a', titulo: 'F9 · PR 1 pronto', texto: PERIGOSO })
  assert.equal(r.ok, true)
  assert.ok(a.enviados()[9].includes(PERIGOSO))
  await w.deactivate()
})

test('tentar entregar de novo: reenvia a resposta gravada com o texto do estado de antes e anota entregue', async () => {
  const a = ambiente()
  a.pergunta('Q1', { estado: 'respondida', titulo: 'fiz assim', respondidaPor: 'operador-orca', resposta: PERIGOSO, estadoAnterior: 'assumida', endereco: { orca: 'run:run_a' }, entregaDaResposta: { estado: 'falhou', via: 'orca', em: 'x', motivo: 'm' } }, 3)
  const w = await mountWorker(main, { host: a.host })
  const lido = await w.request('kit.ler', { forcar: true })
  assert.deepEqual(lido.pendentes.map((q: { id: string }) => q.id), ['Q1'])
  const r = await w.request('kit.reentregar', { id: 'Q1' })
  assert.equal(r.estado, 'entregue')
  assert.equal(a.doc('Q1').data.entregaDaResposta.estado, 'entregue')
  assert.equal(a.doc('Q1').version, 4)
  assert.ok(a.enviados()[9].includes('O operador mudou'), 'decisão assumida usa o texto da mudança')
  assert.ok(a.enviados()[9].includes(PERIGOSO))
  assert.equal((await w.request('kit.reentregar', { id: 'Q9' })).estado, 'falhou', 'pergunta que não está pendente não envia nada')
  assert.equal(a.host.callsOf('terminal.create').length, 1)
  await w.deactivate()
})

test('cada entrega já vem com o destino do "Responder…" (o painel não calcula destino)', async () => {
  const a = ambiente()
  const w = await mountWorker(main, { host: a.host })
  const r = await w.request('kit.ler', { forcar: true })
  assert.ok(r.entregas.length > 0)
  assert.deepEqual(r.entregas[0].seguimento, { destino: 'run:run_a', quem: 'coordenadora' })
  await w.deactivate()
})

test('o terminal de envio nasce num workspace desta máquina, nunca num host remoto', async () => {
  const remoto = (raiz: string): Ws => ({ id: 'remoto', kind: 'worktree', name: 'ssh', path: raiz, branch: 'main', hostId: 'host-ssh' })
  const a = ambiente({ workspaces: (raiz) => [remoto(raiz), { id: 'local', kind: 'folder', name: 'kit', path: raiz, branch: null, hostId: null }] })
  const w = await mountWorker(main, { host: a.host })
  try {
    assert.equal((await w.request('kit.seguimento', { destino: 'run:run_a', titulo: 'F9', texto: 'oi' })).ok, true)
    assert.deepEqual(a.host.callsOf('terminal.create').map((c: { workspaceId: string }) => c.workspaceId), ['local'])
  } finally { await w.deactivate() }
  const b = ambiente({ workspaces: (raiz) => [remoto(raiz)] })
  const w2 = await mountWorker(main, { host: b.host })
  try {
    const r = await w2.request('kit.seguimento', { destino: 'run:run_a', titulo: 'F9', texto: 'oi' })
    assert.equal(r.ok, false)
    assert.match(r.motivo, /nesta máquina/)
    assert.equal(b.host.callsOf('terminal.create').length, 0)
  } finally { await w2.deactivate() }
})

test('o Orca atual marca toda pasta local com hostId "local": o terminal de envio nasce nela (F449)', async () => {
  const a = ambiente({ workspaces: (raiz) => [
    { id: 'ssh', kind: 'worktree', name: 'ssh', path: raiz, branch: 'main', hostId: 'host-ssh' },
    { id: 'pasta', kind: 'folder', name: 'kit', path: raiz, branch: null, hostId: 'local' },
    { id: 'arvore', kind: 'worktree', name: 'kit', path: raiz, branch: 'main', hostId: 'local' },
  ] })
  const w = await mountWorker(main, { host: a.host })
  try {
    assert.equal((await w.request('kit.seguimento', { destino: 'run:run_a', titulo: 'F9', texto: 'oi' })).ok, true)
    assert.deepEqual(a.host.callsOf('terminal.create').map((c: { workspaceId: string }) => c.workspaceId), ['arvore'])
  } finally { await w.deactivate() }
})

test('caixa do Orca maior que o limite: a leitura diz até quando as entregas do Orca vão', async () => {
  const t0 = Date.now()
  const mensagens = Array.from({ length: LIMITE_DA_CAIXA + 5 }, (_, i) => ({ id: `msg_${i}`, type: 'status', subject: 's', body: 'b', created_at: new Date(t0 - i * 60_000).toISOString() }))
  const a = ambiente({ mensagens })
  const w = await mountWorker(main, { host: a.host })
  try {
    const r = await w.request('kit.ler', { forcar: true })
    assert.equal(r.caixaAte, (mensagens[LIMITE_DA_CAIXA - 1] as { created_at: string }).created_at)
  } finally { await w.deactivate() }
  const b = ambiente()
  const w2 = await mountWorker(main, { host: b.host })
  try {
    assert.equal((await w2.request('kit.ler', { forcar: true })).caixaAte, null, 'caixa dentro do limite: nada a avisar')
  } finally { await w2.deactivate() }
})

test('o painel espera o envio inteiro: o prazo dos pedidos que enviam passa da espera do worker, e os três o usam', () => {
  assert.ok(ESPERA_ENVIO_MS > 0)
  assert.ok(JANELA_DA_ENTREGA_MS > 0 && JANELA_DA_ENTREGA_MS <= 10_000, 'a janela do lote é de poucos segundos')
  assert.ok(PRAZO_DO_ENVIO_MS >= JANELA_DA_ENTREGA_MS + ESPERA_ENVIO_MS + 30_000, 'folga para a janela do lote, workspace.list, terminal.create e a gravação')
  assert.ok(PRAZO_DO_ENVIO_MS <= 120_000, 'o Orca não aceita mais que 120 s')
  const painel = readFileSync(new URL('./panel.tsx', import.meta.url), 'utf8')
  for (const nome of ['kit.responder', 'kit.reentregar', 'kit.seguimento']) {
    const linha = painel.split('\n').find((l) => l.includes(`plugin.request('${nome}'`)) ?? ''
    assert.ok(linha, `achei a chamada de ${nome}`)
    assert.ok(linha.includes('{ timeoutMs: PRAZO_DO_ENVIO_MS }'), `${nome} passa o prazo do envio`)
  }
})

// F448 (fatia 9): duas respostas à mesma sessão a poucos segundos uma da outra saem numa mensagem; fora da janela, em duas.
test('duas respostas à mesma sessão dentro da janela saem numa mensagem só; fora dela, em duas', async () => {
  const a = ambiente({ janelaMs: 400 })
  a.pergunta('Q1', { estado: 'aberta', titulo: 'qual pasta', endereco: { orca: 'orca_session_id:dona-a' } })
  a.pergunta('Q2', { estado: 'assumida', titulo: 'usei a main', endereco: { orca: 'orca_session_id:dona-a' } })
  const w = await mountWorker(main, { host: a.host })
  try {
    const [r1, r2] = await Promise.all([
      w.request('kit.responder', { id: 'Q1', versao: 1, esperado: 'aberta', resposta: 'a pasta de cima' }),
      w.request('kit.responder', { id: 'Q2', versao: 1, esperado: 'assumida', resposta: 'use a develop' }),
    ])
    assert.equal(r1.entrega.estado, 'entregue')
    assert.equal(r2.entrega.estado, 'entregue')
    const enviados = a.todosEnviados()
    assert.equal(enviados.length, 1, 'uma mensagem só')
    assert.equal(enviados[0][3], 'orca_session_id:dona-a')
    assert.equal(enviados[0][7], 'Respostas Q1, Q2')
    assert.ok(enviados[0][9].includes('a pasta de cima') && enviados[0][9].includes('use a develop'), enviados[0][9])
    for (const id of ['Q1', 'Q2']) assert.equal(a.doc(id).data.entregaDaResposta.estado, 'entregue', id)
    assert.equal(a.host.callsOf('terminal.create').length, 1)
  } finally { await w.deactivate() }

  const b = ambiente({ janelaMs: 50 })
  b.pergunta('Q1', { estado: 'aberta', titulo: 'um', endereco: { orca: 'orca_session_id:dona-a' } })
  b.pergunta('Q2', { estado: 'aberta', titulo: 'dois', endereco: { orca: 'orca_session_id:dona-a' } })
  const w2 = await mountWorker(main, { host: b.host })
  try {
    await w2.request('kit.responder', { id: 'Q1', versao: 1, esperado: 'aberta', resposta: 'sim' })
    await new Promise((r) => setTimeout(r, 200))
    await w2.request('kit.responder', { id: 'Q2', versao: 1, esperado: 'aberta', resposta: 'não' })
    assert.deepEqual(b.todosEnviados().map((e) => e[7]), ['Resposta Q1', 'Resposta Q2'])
  } finally { await w2.deactivate() }
})

// A rota usa só o endereço gravado: a resposta à dona não vai à Run (coordenadora) nem à orquestradora, mesmo com o
// título de orquestradora na pergunta e uma orquestradora ativa marcada no painel.
test('a resposta à pergunta da dona vai só ao endereço dela; título e orquestradora ativa não mudam o destino', async () => {
  const a = ambiente({ janelaMs: 300 })
  mkdirSync(join(a.painel, '..', 'ativas'), { recursive: true })
  writeFileSync(join(a.painel, '..', 'ativas', 'cli-orq'), '/proj/.git\norca_session_id:claude_orq\n')
  a.pergunta('Q1', { estado: 'aberta', titulo: 'qual pasta', sessao: '🎛 orquestradora — proj', sessaoId: 'orca_session_id:dona-a', endereco: { orca: 'orca_session_id:dona-a' } })
  a.pergunta('Q2', { estado: 'aberta', titulo: 'outra coisa', sessao: 'F2 · outra', sessaoId: 'orca_session_id:dona-b', endereco: { orca: 'orca_session_id:dona-b' } })
  const w = await mountWorker(main, { host: a.host })
  try {
    await Promise.all([
      w.request('kit.responder', { id: 'Q1', versao: 1, esperado: 'aberta', resposta: 'para a dona A' }),
      w.request('kit.responder', { id: 'Q2', versao: 1, esperado: 'aberta', resposta: 'para a dona B' }),
    ])
    const enviados = a.todosEnviados()
    assert.deepEqual(enviados.map((e) => e[3]).sort(), ['orca_session_id:dona-a', 'orca_session_id:dona-b'], 'uma mensagem a cada dona, nenhuma à Run nem à orquestradora')
    const paraA = enviados.find((e) => e[3] === 'orca_session_id:dona-a')!
    assert.ok(paraA[9].includes('para a dona A') && !paraA[9].includes('para a dona B'), paraA[9])
  } finally { await w.deactivate() }
})

test('F452: a leitura traz as sessões por projeto, só de arquivos e do worker-list que a caixa já lê', async () => {
  const a = ambiente({ workers: [{ terminal: 'structworker_f3', state: 'failed' }] })
  const fila = (id: string, data: object) => writeFileSync(join(a.painel, 'fila', `${id}.json`), JSON.stringify({ id, version: 1, data }))
  fila('F1', { titulo: 'Aba de sessões', projeto: 'kit', etapa: 'execucao', atualizadoEm: new Date().toISOString() })
  fila('F2', { titulo: 'Outra', projeto: 'kit', etapa: 'execucao' })
  fila('F3', { titulo: 'Caiu', projeto: 'kit', etapa: 'execucao', donoLocalId: 'orca_session_id:s-3' })
  fila('F4', { titulo: 'Velha', projeto: 'kit', etapa: 'feito', feitoEm: '2020-01-01T00:00:00Z' })
  const base = join(a.painel, '..')
  mkdirSync(join(base, 'orca-sessoes'), { recursive: true })
  writeFileSync(join(base, 'orca-sessoes', 's-3.json'), JSON.stringify({ terminal: 'structworker_f3' }))
  a.pergunta('Q5', { estado: 'aberta', titulo: 'qual cor', item: 'F2' })
  const w = await mountWorker(main, { host: a.host })
  try {
    const r = await w.request('kit.ler', { forcar: true })
    assert.ok(r.sessoes, 'a leitura tem sessoes')
    assert.equal(r.sessoes.erro, null)
    assert.deepEqual(r.sessoes.projetos.map((g: { projeto: string | null }) => g.projeto), ['kit'])
    const s = r.sessoes.projetos[0].sessoes
    assert.deepEqual(s.map((x: { item: string; estado: string }) => `${x.item}:${x.estado}`), ['F2:esperando', 'F3:parada', 'F1:trabalhando'])
    assert.deepEqual(s[0].perguntas, [{ id: 'Q5', titulo: 'qual cor' }])
    assert.equal(s[1].tipoDeParada, 'falhou', 'o worker do Orca que falhou chega à sessão')
    assert.equal(r.sessoes.paradas, 1, 'a espera com pergunta não conta: Perguntas já a conta')
    assert.deepEqual(a.chamadas().sort(), ['inbox', 'worker-list'])
  } finally { await w.deactivate() }
})

// F460 (ADR 0032): no Orca ninguém rodava a batida, e a seção Sessões avisava o tempo todo que o estado não se atualiza. O
// worker roda `painel.mjs batida --leitura` ao ativar e a cada 10 min, só quando o deduzido tem 10 min ou mais.
const deduzidoCom = (painel: string, emMs: number) => {
  mkdirSync(join(painel, '..', 'batida'), { recursive: true })
  writeFileSync(join(painel, '..', 'batida', 'deduzido.json'), JSON.stringify({ em: new Date(emMs).toISOString(), itens: {} }))
}
async function ate(cond: () => boolean, ms = 5000) {
  const fim = Date.now() + ms
  while (!cond() && Date.now() < fim) await new Promise((r) => setTimeout(r, 50))
  return cond()
}

test('F460: com o deduzido velho, a aba roda a batida de leitura ao ativar e a seção Sessões perde o aviso de estado velho', async () => {
  const a = ambiente({ batida: true })
  const velho = Date.now() - 30 * 60_000
  deduzidoCom(a.painel, velho)
  const w = await mountWorker(main, { host: a.host })
  try {
    assert.ok(await ate(() => a.batidas().length === 1), 'a batida não rodou')
    const b = a.batidas()[0]
    assert.deepEqual(b.argv, ['batida', '--leitura'])
    assert.equal(b.electron, '1', 'o binário do Orca precisa rodar como Node')
    assert.equal(b.base, join(a.painel, '..'), 'a batida grava ao lado da pasta do painel, onde a aba lê')
    assert.ok(await ate(() => { try { return Date.parse(JSON.parse(readFileSync(join(a.painel, '..', 'batida', 'deduzido.json'), 'utf8')).em) > velho } catch { return false } }))
    const r = await w.request('kit.ler', { forcar: true })
    assert.ok(r.sessoes.batidaEm, 'sem batidaEm na leitura')
    assert.ok(Date.now() - Date.parse(r.sessoes.batidaEm) < 5 * 60_000, `a batida ainda parece velha: ${r.sessoes.batidaEm}`)
  } finally { await w.deactivate() }
})

test('F460: com o deduzido fresco (menos de 10 min), a aba não roda a batida', async () => {
  const a = ambiente({ batida: true })
  deduzidoCom(a.painel, Date.now() - 2 * 60_000)
  const w = await mountWorker(main, { host: a.host })
  try {
    await new Promise((r) => setTimeout(r, 1000))
    assert.deepEqual(a.batidas(), [], 'rodou a batida com o deduzido fresco')
  } finally { await w.deactivate() }
})

test('F460: PAINEL_DO_KIT_BATIDA=off desliga a batida da aba', async () => {
  const a = ambiente({ batida: false })
  const w = await mountWorker(main, { host: a.host })
  try {
    await new Promise((r) => setTimeout(r, 1000))
    assert.deepEqual(a.batidas(), [])
  } finally { await w.deactivate() }
})

// F469: o botão "Arquivar concluídas". O worker só chama o `painel.mjs orquestradora arquivar --concluidas` (as condições são as do
// script, provadas nos testes dele); aqui se prova o que o worker passa e o que devolve.
const APTAS = [{ item: 'F7', titulo: 'tema sete', dispatchId: 'ctx_a' }, { item: 'F8', titulo: 'tema oito', dispatchId: 'ctx_b' }]
const argsDoPainel = (a: ReturnType<typeof ambiente>) => a.batidas().filter((b) => b.argv[0] === 'orquestradora')

test('F469: kit.concluidas roda o arquivar --concluidas --seco, devolve as aptas e guarda em cache por 2 min', async () => {
  const a = ambiente()
  a.respostaDoArquivar({ seco: { seco: true, aptas: APTAS, arquivadas: [], recusadas: [] } })
  const w = await mountWorker(main, { host: a.host })
  try {
    const r = await w.request('kit.concluidas', {})
    assert.deepEqual(r.aptas, [{ item: 'F7', titulo: 'tema sete' }, { item: 'F8', titulo: 'tema oito' }], 'sem o dispatchId: a aba só conhece o item')
    assert.equal(r.erro, null)
    assert.deepEqual(argsDoPainel(a).map((b) => b.argv), [['orquestradora', 'arquivar', '--concluidas', '--seco']])
    await w.request('kit.concluidas', {})
    assert.equal(argsDoPainel(a).length, 1, 'cache')
    await w.request('kit.concluidas', { forcar: true })
    assert.equal(argsDoPainel(a).length, 2, 'forçar confere de novo')
  } finally { await w.dispose?.() }
})

test('F469: kit.arquivar manda só os itens confirmados, com --remover-worktree (nunca --force), e devolve o desfecho com o motivo da recusa', async () => {
  const a = ambiente()
  a.respostaDoArquivar({
    seco: { seco: true, aptas: APTAS, arquivadas: [], recusadas: [] },
    real: { seco: false, aptas: [], arquivadas: [APTAS[0]], recusadas: [{ item: 'F8', titulo: 'tema oito', dispatchId: 'ctx_b', faltam: ['pergunta aberta do F8: Q5', 'PR #13 está aberto'] }] },
  })
  const w = await mountWorker(main, { host: a.host })
  try {
    await w.request('kit.concluidas', {})
    const r = await w.request('kit.arquivar', { itens: ['F7', 'F8'] })
    assert.deepEqual(r.arquivadas, [{ item: 'F7', titulo: 'tema sete' }])
    assert.deepEqual(r.recusadas, [{ item: 'F8', titulo: 'tema oito', motivo: 'tem pergunta aberta (Q5); o PR #13 ainda está aberto' }])
    assert.equal(r.erro, null)
    const real = argsDoPainel(a).map((b) => b.argv).at(-1)
    assert.deepEqual(real, ['orquestradora', 'arquivar', '--concluidas', '--itens', 'F7,F8', '--remover-worktree'])
    assert.ok(!real!.includes('--force'))
    // arquivar invalida o cache: a próxima leitura confere de novo
    await w.request('kit.concluidas', {})
    assert.equal(argsDoPainel(a).length, 3)
  } finally { await w.dispose?.() }
})

test('F469: kit.arquivar recusa lista vazia ou item que não é F<n> sem chamar o painel (nada vira argumento de shell)', async () => {
  const a = ambiente()
  a.respostaDoArquivar({ seco: { aptas: [] }, real: { arquivadas: [], recusadas: [] } })
  const w = await mountWorker(main, { host: a.host })
  try {
    for (const itens of [[], ['F7; rm -rf /'], ['--remover-worktree'], ['F7,F8']]) {
      const r = await w.request('kit.arquivar', { itens })
      assert.match(r.erro ?? '', /inválida/, JSON.stringify(itens))
    }
    assert.deepEqual(argsDoPainel(a), [], 'o painel não foi chamado')
  } finally { await w.dispose?.() }
})

test('F469: painel.mjs antigo (sem --concluidas) ou ausente: sem aptas e com o motivo, sem derrubar a aba', async () => {
  const a = ambiente()
  a.respostaDoArquivar({ uso: true })
  const w = await mountWorker(main, { host: a.host })
  try {
    const r = await w.request('kit.concluidas', {})
    assert.deepEqual(r.aptas, [])
    assert.match(r.erro ?? '', /uso:/)
    const d = await w.request('kit.arquivar', { itens: ['F7'] })
    assert.deepEqual(d.arquivadas, [])
    assert.match(d.erro ?? '', /uso:/)
  } finally { await w.dispose?.() }
  process.env.PAINEL_DO_KIT_SCRIPT = ''
  process.env.HOME = join(tmpdir(), 'f469-sem-plugin-' + Date.now())
  const b = await mountWorker(main, { host: a.host })
  try {
    const r = await b.request('kit.concluidas', { forcar: true })
    assert.match(r.erro ?? '', /não está instalado/)
  } finally { await b.dispose?.() }
})
