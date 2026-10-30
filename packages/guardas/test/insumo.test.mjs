// CONV-14 e as listas que não envelhecem: guarda que não achou o que examinar
// é erro, não verde; exceção sem motivo, exceção velha e desligamento sem
// motivo também.
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { verificar } from '../lib/index.mjs'
import { apagar, escrever, ler, montar } from './_apoio.mjs'

const pastas = []
after(() => pastas.forEach(apagar))

const comRegras = (raiz, regras) => {
  const cfg = JSON.parse(ler(raiz, 'design/wicomm.json'))
  cfg.guardas.regras = { ...cfg.guardas.regras, ...regras }
  escrever(raiz, 'design/wicomm.json', JSON.stringify(cfg))
}

test('num projeto vazio, nenhuma guarda passa: todas dizem que não acharam o que examinar', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'wicomm-guardas-vazio-'))
  pastas.push(raiz)
  const r = verificar({ raiz })
  assert.equal(r.ok, false)
  const verdes = r.resultados.filter((g) => g.estado !== 'erro').map((g) => g.id)
  assert.deepEqual(verdes, [])
})

test('exceção velha, exceção sem motivo e desligamento sem motivo são erro', () => {
  const raiz = montar()
  pastas.push(raiz)
  comRegras(raiz, {
    'nada-de-vidro': { excecoes: [{ arquivo: 'src/app/page.tsx', motivo: 'não tem vidro nenhum, a exceção envelheceu' }] },
    'um-menu-so': { excecoes: [{ arquivo: 'src/app/page.tsx' }] },
    'o-rotulo-tem-duas-vozes': false,
    'icone-de-uma-biblioteca': { desligada: 'curto' },
  })
  const r = verificar({ raiz })
  const erro = (id) => r.resultados.find((g) => g.id === id).erros.join(' ')
  assert.match(erro('nada-de-vidro'), /exceção velha/)
  assert.match(erro('um-menu-so'), /sem motivo/)
  assert.match(erro('o-rotulo-tem-duas-vozes'), /desligar pede motivo/)
  assert.match(erro('icone-de-uma-biblioteca'), /sem motivo/)
  assert.equal(r.ok, false)
})

test('a exceção com motivo tira o arquivo da conta, e o desligamento com motivo aparece no relatório', () => {
  const raiz = montar({ 'src/telas/Legado.tsx': 'export const V = () => <div className="backdrop-blur-sm" />\n' })
  pastas.push(raiz)
  comRegras(raiz, {
    'nada-de-vidro': { excecoes: [{ arquivo: 'src/telas/Legado.tsx', motivo: 'tela de terceiros embutida, com fundo próprio' }] },
    'icone-de-uma-biblioteca': { desligada: 'o projeto ainda não tem ícone nenhum, e a guarda volta com o primeiro' },
  })
  const r = verificar({ raiz })
  assert.equal(r.ok, true, r.relatorio)
  assert.match(r.relatorio, /icone-de-uma-biblioteca desligada/)
})

test('configuração que cita guarda que não existe é erro, e não silêncio', () => {
  const raiz = montar()
  pastas.push(raiz)
  comRegras(raiz, { 'guarda-inventada': {} })
  assert.throws(() => verificar({ raiz }), /não existe: guarda-inventada/)
})

test('a guarda que exige configuração diz o que falta', () => {
  const raiz = montar()
  pastas.push(raiz)
  comRegras(raiz, { 'a-tela-de-entrada-tem-o-botao-grande': { telas: [] } })
  const r = verificar({ raiz, so: ['a-tela-de-entrada-tem-o-botao-grande'] })
  assert.match(r.resultados[0].erros.join(' '), /falta configurar "telas"/)
})
