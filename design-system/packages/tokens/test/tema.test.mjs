// O tema como dado: o que é da marca mora numa pasta de tema (`temas/<id>/`),
// fora do núcleo, e trocar a pasta troca a marca (F345, fatia 1).
//
// A prova: (1) gerar com o tema Wicomm dá exatamente o `dist/` publicado — o
// tema está completo e o padrão não mudou; (2) gerar com outro tema muda a marca
// e a fonte, e nada do núcleo; (3) o tema é conferido pelas regras que a base já
// manda (MARCA-01, MARCA-03), e o que as quebra reprova ao gerar.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { MARCA_PADRAO } from '../lib/ler.mjs'
import { saidas } from '../lib/saidas.mjs'
import { lerTema, TEMA_PADRAO, validarTema } from '../lib/tema.mjs'

const AQUI = import.meta.dirname
const DIST = join(AQUI, '..', 'dist')
const GERAR = join(AQUI, '..', 'scripts', 'gerar.mjs')
const OUTRO = join(AQUI, 'fixtures', 'temas', 'outro')
const TORTO = join(AQUI, 'fixtures', 'temas', 'hover-torto')

describe('o tema como dado', () => {
  it('o tema padrão é o Wicomm, na raiz do repositório', () => {
    const t = lerTema(TEMA_PADRAO)
    assert.equal(t.meta.id, 'wicomm')
    assert.equal(t.meta.nome, 'Wicomm')
  })

  it('o slot publicado (`fonte/marca.tokens.json`) é cópia byte a byte das cores do tema padrão', () => {
    // O pacote publica `fonte/`: a cópia fica para quem já lê o slot; a fonte de verdade é o tema.
    assert.equal(readFileSync(MARCA_PADRAO, 'utf8'), readFileSync(join(TEMA_PADRAO, 'tema.tokens.json'), 'utf8'))
  })

  it('gerar com o tema Wicomm dá exatamente o `dist/` de hoje', () => {
    const doTema = saidas({ tema: TEMA_PADRAO })
    for (const [nome, texto] of Object.entries(saidas())) {
      assert.equal(doTema[nome], texto, `${nome} difere entre o padrão e o tema Wicomm`)
      assert.equal(readFileSync(join(DIST, nome), 'utf8'), texto, `dist/${nome} velho`)
    }
  })

  it('outro tema troca a marca e a fonte nas saídas, e o nome da utilitária', () => {
    const s = saidas({ tema: OUTRO })
    assert.ok(s['tailwind-v4.css'].includes('#0057D9'), 'a marca nova chegou')
    assert.ok(!s['tailwind-v4.css'].includes('#F30B42'), 'a marca antiga saiu')
    assert.ok(s['tailwind-v4.css'].includes('var(--font-inter)'), 'a variável da fonte é a do tema')
    assert.ok(!s['tailwind-v4.css'].includes('--font-archivo'), 'a fonte antiga saiu')
    assert.match(s['tailwind-v4.css'], /@utility font-inter \{/)
    assert.doesNotMatch(s['tailwind-v4.css'], /@utility font-archivo/)
  })

  it('outro tema só muda o que é do tema: o resto da saída é igual', () => {
    // Tira das duas saídas o que o tema declara (as cores do slot e a fonte); o que sobra é o
    // núcleo, e tem de ser igual. O branco entra junto porque é `sobre` num tema e superfície no outro.
    const neutro = (css, pasta, fonte) => {
      const daMarca = new Set([...readFileSync(join(pasta, 'tema.tokens.json'), 'utf8').matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()))
      daMarca.add('#FFFFFF')
      return css.replace(/#[0-9A-Fa-f]{6}\b/g, (h) => (daMarca.has(h.toUpperCase()) ? '#MARCA' : h)).replaceAll(fonte, 'FONTE')
    }
    for (const nome of ['tokens.css', 'tailwind-v4.css']) {
      assert.equal(neutro(saidas({ tema: OUTRO })[nome], OUTRO, 'font-inter'), neutro(saidas()[nome], TEMA_PADRAO, 'font-archivo'), nome)
    }
  })

  it('`gerar --tema <pasta> --saida <pasta>` grava fora do pacote, e o `dist/` não se mexe', () => {
    const antes = Object.fromEntries(readdirSync(DIST).map((n) => [n, readFileSync(join(DIST, n), 'utf8')]))
    const saida = mkdtempSync(join(tmpdir(), 'tema-'))
    try {
      execFileSync(process.execPath, [GERAR, '--tema', OUTRO, '--saida', saida], { stdio: 'pipe' })
      assert.deepEqual(readdirSync(saida).sort(), Object.keys(antes).sort())
      assert.ok(readFileSync(join(saida, 'tailwind-v4.css'), 'utf8').includes('#0057D9'))
      for (const [n, texto] of Object.entries(antes)) assert.equal(readFileSync(join(DIST, n), 'utf8'), texto, `dist/${n} mudou`)
    } finally {
      rmSync(saida, { recursive: true, force: true })
    }
  })
})

describe('o tema é conferido pelas regras da base', () => {
  it('o tema Wicomm e o de teste passam', () => {
    assert.deepEqual(validarTema(lerTema(TEMA_PADRAO, { validar: false })), [])
    assert.deepEqual(validarTema(lerTema(OUTRO, { validar: false })), [])
  })

  it('o desenho do logotipo, quando declarado, é PNG que existe na pasta do tema', () => {
    const padrao = lerTema(TEMA_PADRAO, { validar: false })
    assert.ok(padrao.meta.logotipo.imagem?.sobreClaro, 'o tema Wicomm declara o desenho')
    const comImagem = (imagem) => {
      const t = lerTema(TEMA_PADRAO, { validar: false })
      t.meta.logotipo.imagem = imagem
      return validarTema(t)
    }
    assert.deepEqual(comImagem(padrao.meta.logotipo.imagem), [])
    const sumiu = comImagem({ ...padrao.meta.logotipo.imagem, sobreEscuro: 'logotipo/nao-existe.png' })
    assert.ok(sumiu.some((p) => /sobreEscuro/.test(p) && /não é um PNG/.test(p)), sumiu.join('\n'))
    const naoPng = comImagem({ ...padrao.meta.logotipo.imagem, sobreClaro: 'tema.json' })
    assert.ok(naoPng.some((p) => /sobreClaro/.test(p)), naoPng.join('\n'))
    const semOrigem = comImagem({ sobreClaro: padrao.meta.logotipo.imagem.sobreClaro, sobreEscuro: padrao.meta.logotipo.imagem.sobreEscuro })
    assert.ok(semOrigem.some((p) => /origem/.test(p)), semOrigem.join('\n'))
    // O tema sem desenho continua valendo: a peça escreve o nome.
    assert.equal(lerTema(OUTRO, { validar: false }).meta.logotipo.imagem, undefined)
  })

  it('MARCA-01 · hover em outra matiz reprova ao ler, com a regra no erro', () => {
    assert.throws(() => lerTema(TORTO), /MARCA-01/)
    const problemas = validarTema(lerTema(TORTO, { validar: false }))
    assert.ok(problemas.some((p) => /MARCA-01/.test(p) && /hover/.test(p)), problemas.join('\n'))
  })

  it('MARCA-01 · o hover torto só no escuro também reprova, dizendo o tema', () => {
    const t = lerTema(OUTRO, { validar: false })
    t.tokens.marca.hover.$extensions['com.wicomm'].escuro = '#00A86B'
    const problemas = validarTema(t)
    assert.ok(problemas.some((p) => /MARCA-01/.test(p) && /no escuro/.test(p)), problemas.join('\n'))
    assert.ok(!problemas.some((p) => /no claro/.test(p)), problemas.join('\n'))
  })

  it('MARCA-01 · a tolerância da matiz é a do arredondamento: ~1° passa, ~2° reprova', () => {
    // A marca de teste está em 215,9°; #0049BD fica a 0,9° dela, #0045BD a 2,2°.
    const comHover = (hex) => {
      const t = lerTema(OUTRO, { validar: false })
      t.tokens.marca.hover.$value = hex
      return validarTema(t)
    }
    assert.deepEqual(comHover('#0049BD'), [])
    assert.ok(comHover('#0045BD').some((p) => /MARCA-01/.test(p) && /no claro/.test(p)))
  })

  it('MARCA-01 · gerar com o tema torto sai com erro e não grava nada', () => {
    const saida = mkdtempSync(join(tmpdir(), 'tema-'))
    try {
      assert.throws(() => execFileSync(process.execPath, [GERAR, '--tema', TORTO, '--saida', saida], { stdio: 'pipe' }), /MARCA-01/)
      assert.deepEqual(readdirSync(saida), [])
    } finally {
      rmSync(saida, { recursive: true, force: true })
    }
  })

  it('MARCA-01 · a cor da marca é a mesma nos dois temas', () => {
    const t = lerTema(OUTRO, { validar: false })
    t.tokens.marca.cor.$extensions = { 'com.wicomm': { escuro: '#1F6FE5' } }
    assert.ok(validarTema(t).some((p) => /MARCA-01/.test(p) && /dois temas/.test(p)))
  })

  for (const tema of ['claro', 'escuro']) {
    it(`MARCA-03 · pontas do gradiente abaixo de 2:1 reprovam, no ${tema}`, () => {
      const t = lerTema(OUTRO, { validar: false })
      const { inicio, fim } = t.tokens.marca.gradiente
      if (tema === 'claro') fim.$value = inicio.$value
      else fim.$extensions['com.wicomm'].escuro = inicio.$extensions['com.wicomm'].escuro
      const problemas = validarTema(t)
      assert.ok(problemas.some((p) => /MARCA-03/.test(p) && p.includes(`no ${tema}`)), problemas.join('\n'))
      assert.equal(problemas.length, 1, problemas.join('\n'))
    })
  }

  it('o tema sem campo obrigatório reprova dizendo qual', () => {
    const t = lerTema(OUTRO, { validar: false })
    delete t.meta.fonte.variavel
    assert.ok(validarTema(t).some((p) => p.includes('fonte.variavel')))
  })

  it('o `id` e o prefixo do registro seguem o formato do schema', () => {
    const t = lerTema(OUTRO, { validar: false })
    t.meta.registro.prefixo = 'outro'
    assert.ok(validarTema(t).some((p) => p.includes('registro.prefixo')))
    const u = lerTema(OUTRO, { validar: false })
    u.meta.id = 'Outro Tema'
    assert.ok(validarTema(u).some((p) => p.includes('`id`') && /minúscula/.test(p)))
  })

  it('tema sem o eixo de largura gera com aviso: as vozes estreitas caem no peso', () => {
    const saida = mkdtempSync(join(tmpdir(), 'tema-'))
    try {
      const r = spawnSync(process.execPath, [GERAR, '--tema', OUTRO, '--saida', saida], { encoding: 'utf8' })
      assert.equal(r.status, 0, r.stderr)
      assert.match(r.stderr, /eixo de largura/)
      const w = spawnSync(process.execPath, [GERAR, '--tema', TEMA_PADRAO, '--saida', saida], { encoding: 'utf8' })
      assert.equal(w.stderr, '')
    } finally {
      rmSync(saida, { recursive: true, force: true })
    }
  })

  it('caminho relativo vale a partir de onde o comando foi chamado (`npm run -w` muda a pasta)', () => {
    const chamou = mkdtempSync(join(tmpdir(), 'tema-'))
    const rodar = (args, initCwd) =>
      spawnSync(process.execPath, [GERAR, ...args], { encoding: 'utf8', cwd: join(AQUI, '..'), env: { ...process.env, INIT_CWD: initCwd } })
    try {
      const tema = rodar(['--tema', 'outro', '--saida', chamou], join(AQUI, 'fixtures', 'temas'))
      assert.equal(tema.status, 0, tema.stderr)
      const saida = rodar(['--tema', OUTRO, '--saida', 'gerado'], chamou)
      assert.equal(saida.status, 0, saida.stderr)
      assert.ok(readFileSync(join(chamou, 'gerado', 'tailwind-v4.css'), 'utf8').includes('#0057D9'))
    } finally {
      rmSync(chamou, { recursive: true, force: true })
    }
  })

  it('o `id` do tema é o nome da pasta', () => {
    const t = lerTema(OUTRO, { validar: false })
    t.meta.id = 'outra-coisa'
    assert.ok(validarTema(t).some((p) => /id/.test(p) && /pasta/.test(p)))
  })
})
