// Os plugins deste repositório depois da separação do tema (F345): o `design-system` (o núcleo), o `tema-wicomm` (a
// marca, como dado) e o `wicomm` (o nome antigo, congelado até os projetos migrarem).
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const RAIZ = join(import.meta.dirname, '..')
const PLUGINS = join(RAIZ, 'plugins')

/**
 * O hash do conteúdo de uma pasta: caminho e bytes de cada arquivo que o git rastreia, em ordem. Arquivo não rastreado
 * (resultado de eval, `.DS_Store`, rascunho) fica fora: não dá vermelho falso. O byte é o do disco, então a edição
 * ainda não commitada conta.
 */
function hashDaPasta(pasta) {
  const h = createHash('sha256')
  const rastreados = execFileSync('git', ['-C', pasta, 'ls-files', '-z', '--', '.'], { encoding: 'utf-8' }).split('\0').filter(Boolean).sort()
  for (const rel of rastreados) h.update(`${rel}\0`).update(readFileSync(join(pasta, rel))).update('\0')
  return h.digest('hex')
}

/**
 * O `wicomm` como estava no merge da fatia 1 (313094f, wicomm 0.1.13). Correção nova entra no `design-system`; mudar
 * este hash é decisão (o `wicomm` só muda na fatia que o torna apontador, depois que os projetos migrarem).
 */
const WICOMM_CONGELADO = 'f667bccfa0ae592a7725aeb6c091924a661ef81e81623774e093c9dc0322175e'

describe('os plugins do repositório', () => {
  it('o wicomm está congelado: correção nova vai para o design-system', () => {
    assert.equal(hashDaPasta(join(PLUGINS, 'wicomm')), WICOMM_CONGELADO)
  })

  it('cada pasta de plugin tem o plugin.json com o nome da pasta', () => {
    for (const nome of readdirSync(PLUGINS)) {
      const manifesto = join(PLUGINS, nome, '.claude-plugin', 'plugin.json')
      assert.ok(existsSync(manifesto), `${nome} sem plugin.json`)
      assert.equal(JSON.parse(readFileSync(manifesto, 'utf8')).name, nome)
    }
  })

  it('o tema que vai no tema-wicomm é cópia do temas/wicomm/', () => {
    for (const f of ['tema.json', 'tema.tokens.json']) {
      assert.equal(readFileSync(join(PLUGINS, 'tema-wicomm', 'tema', f), 'utf8'), readFileSync(join(RAIZ, 'temas', 'wicomm', f), 'utf8'), f)
    }
    const desenhos = readdirSync(join(RAIZ, 'temas', 'wicomm', 'logotipo'))
    assert.ok(desenhos.length >= 2, 'o tema traz o desenho do logotipo')
    assert.deepEqual(readdirSync(join(PLUGINS, 'tema-wicomm', 'tema', 'logotipo')), desenhos)
    for (const f of desenhos) {
      assert.ok(readFileSync(join(PLUGINS, 'tema-wicomm', 'tema', 'logotipo', f)).equals(readFileSync(join(RAIZ, 'temas', 'wicomm', 'logotipo', f))), f)
    }
  })

  it('o marketplace deste repositório lista só o wicomm: o design-system e o tema moram no do kit (um marketplace por plugin)', () => {
    const m = JSON.parse(readFileSync(join(RAIZ, '.claude-plugin', 'marketplace.json'), 'utf8'))
    assert.deepEqual(m.plugins.map((p) => p.name), ['wicomm'])
  })

  it('toda pasta de testes de plugin está no `npm test` da raiz (glob sem arquivo sai 0 e esconderia a falta)', () => {
    const script = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).scripts.test
    for (const nome of readdirSync(PLUGINS)) {
      if (nome === 'wicomm') continue // congelado: o hash acima o confere
      for (const sub of ['hooks/tests', 'scripts/tests', 'tests']) {
        const dir = join(PLUGINS, nome, sub)
        if (!existsSync(dir) || !readdirSync(dir).some((f) => f.endsWith('.test.mjs'))) continue
        assert.ok(script.includes(`plugins/${nome}/${sub}/*.test.mjs`), `plugins/${nome}/${sub} fora do npm test`)
      }
    }
    for (const [, glob] of script.matchAll(/(plugins\/[^\s]+\.test\.mjs)/g)) {
      const dir = join(RAIZ, glob.replace('/*.test.mjs', ''))
      assert.ok(existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.test.mjs')), `${glob} não acha teste nenhum`)
    }
  })
})
