// O critério de pronto da F261.6, metade da catraca: reprova violação nova,
// reprova descida sem a base regravada, e `--atualizar` grava a descida. E o
// que mantém a catraca só para a frente: subida reprova, `--atualizar` não
// grava subida, `--iniciar` não sobrescreve base que existe, a conferência
// nunca escreve a base.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { verificar } from '../lib/index.mjs'
import { apagar, escrever, ler, montar } from './_apoio.mjs'

const BASE = 'design/guardas.base.json'
const VIDRO = 'src/telas/Vidro.tsx'
const vidro = (n) => `export const V = () => <div>${Array.from({ length: n }, () => '<i className="backdrop-blur-sm" />').join('\n')}</div>\n`
const so = ['nada-de-vidro']
const pastas = []
const projeto = (camada) => {
  const r = montar(camada)
  pastas.push(r)
  return r
}
after(() => pastas.forEach(apagar))

test('reprova violação nova (projeto sem base é base zero)', () => {
  const raiz = projeto({ [VIDRO]: vidro(1) })
  const r = verificar({ raiz, so })
  assert.equal(r.ok, false)
  assert.deepEqual(r.comparacao.novas, [{ guarda: 'nada-de-vidro', arquivo: VIDRO, antes: 0, agora: 1 }])
  assert.match(r.relatorio, /violação nova/)
  assert.equal(existsSync(join(raiz, BASE)), false, 'conferir nunca escreve a base')
})

test('reprova a contagem que desce sem a base regravada, e não a regrava sozinha', () => {
  const raiz = projeto({ [VIDRO]: vidro(2) })
  verificar({ raiz, modo: 'iniciar' })
  const gravada = ler(raiz, BASE)
  assert.equal(JSON.parse(gravada).guardas['nada-de-vidro'][VIDRO], 2)
  assert.equal(verificar({ raiz, so }).ok, true, 'com a base do dia, a catraca passa')

  escrever(raiz, VIDRO, vidro(1))
  const r = verificar({ raiz, so })
  assert.equal(r.ok, false)
  assert.deepEqual(r.comparacao.desceram, [{ guarda: 'nada-de-vidro', arquivo: VIDRO, antes: 2, agora: 1 }])
  assert.match(r.relatorio, /--atualizar/)
  assert.equal(ler(raiz, BASE), gravada, 'a conferência não mexe na base')
})

test('--atualizar grava a descida, e a conferência seguinte passa', () => {
  const raiz = projeto({ [VIDRO]: vidro(2) })
  verificar({ raiz, modo: 'iniciar' })
  escrever(raiz, VIDRO, vidro(1))
  const r = verificar({ raiz, modo: 'atualizar' })
  assert.equal(r.gravou, BASE)
  assert.equal(JSON.parse(ler(raiz, BASE)).guardas['nada-de-vidro'][VIDRO], 1)
  assert.equal(verificar({ raiz }).ok, true)

  // Consertou tudo: a entrada sai da base.
  escrever(raiz, VIDRO, 'export const V = () => <div className="superficie" data-superficie />\n')
  verificar({ raiz, modo: 'atualizar' })
  assert.deepEqual(JSON.parse(ler(raiz, BASE)).guardas, {})
})

test('a contagem que sobe reprova, e --atualizar não a grava', () => {
  const raiz = projeto({ [VIDRO]: vidro(1) })
  verificar({ raiz, modo: 'iniciar' })
  escrever(raiz, VIDRO, vidro(3))
  escrever(raiz, 'src/telas/Outro.tsx', vidro(1))
  const r = verificar({ raiz, modo: 'atualizar' })
  assert.equal(r.ok, false)
  assert.deepEqual(r.comparacao.subiram.map((i) => [i.arquivo, i.antes, i.agora]), [[VIDRO, 1, 3]])
  assert.deepEqual(r.comparacao.novas.map((i) => i.arquivo), ['src/telas/Outro.tsx'])
  assert.deepEqual(JSON.parse(ler(raiz, BASE)).guardas, { 'nada-de-vidro': { [VIDRO]: 1 } })
})

test('--iniciar recusa sobrescrever a base que existe', () => {
  const raiz = projeto({ [VIDRO]: vidro(1) })
  verificar({ raiz, modo: 'iniciar' })
  assert.throws(() => verificar({ raiz, modo: 'iniciar' }), /já existe/)
})

test('a linha de comando sai 1 quando a catraca reprova, 0 quando passa, e grava com --iniciar', () => {
  const raiz = projeto({ [VIDRO]: vidro(1) })
  const bin = join(import.meta.dirname, '..', 'bin', 'wicomm-guardas.mjs')
  const rodar = (...a) => spawnSync(process.execPath, [bin, '--raiz', raiz, ...a], { encoding: 'utf8' })
  const reprova = rodar()
  assert.equal(reprova.status, 1, reprova.stderr)
  assert.match(reprova.stdout, /nada-de-vidro \(SUP-02\) · src\/telas\/Vidro\.tsx: 1/)
  assert.equal(rodar('--iniciar').status, 0)
  assert.equal(rodar().status, 0)
  assert.equal(rodar('--so', 'nao-existe').status, 2)
})

test('não grava a base com guarda em erro, nem com caminho de configuração que não existe', () => {
  const raiz = projeto({ [VIDRO]: vidro(2) })
  verificar({ raiz, modo: 'iniciar' })
  const gravada = ler(raiz, BASE)
  const cfg = JSON.parse(ler(raiz, 'design/wicomm.json'))
  cfg.guardas.regras['nada-de-vidro'] = { em: ['src/pasta-que-nao-existe'] }
  escrever(raiz, 'design/wicomm.json', JSON.stringify(cfg))
  assert.throws(() => verificar({ raiz, modo: 'atualizar' }), /guarda em erro: nada-de-vidro/)
  assert.equal(ler(raiz, BASE), gravada)
})
