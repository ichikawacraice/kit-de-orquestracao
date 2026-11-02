// O contraste dos tokens de tema, calculado a partir da FONTE resolvida (COR-12).
//
// Portado de `os-tokens-pagam-o-piso` do produto de origem. Ele cobre a parte
// que é aritmética pura — a razão entre dois tokens opacos, e entre um token e a
// tinta composta por alfa fixado — e que falha calada: mexer num fundo move todos
// os pares dele sem uma linha de código mudar. O que só se mede no navegador
// (fundo composto sob o texto real) continua sendo do ateliê (MED-01).
//
// Ficaram na origem, e vão para o pacote de guardas (F261.6), os casos que leem
// código de componente (o mapa de pontos do idioma de cor, as varreduras de
// `.tsx`); e não vêm os de domínio (etapas do percurso, o tema de campanha).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { hsl, luminancia, razao, sobre } from '../lib/contraste.mjs'
import { lerFonte, variaveis } from '../lib/ler.mjs'

const PISO_TEXTO = 4.5
const PISO_GRAFICO = 3

/**
 * A cor da marca da Wicomm, escrita à mão de propósito (MARCA-01). Derivá-la da
 * fonte faria o teste comparar a fonte consigo mesma e aprovar qualquer troca —
 * inclusive a troca por contraste, que é exatamente o que a regra proíbe.
 */
const MARCA = '#F30B42'

const VARS = variaveis(lerFonte())

/** Um token de cor do tema, em hex maiúsculo; token que não existe é erro, não `undefined`. */
function token(nome, tema) {
  const v = VARS[tema][nome]
  if (v === undefined) throw new Error(`token ${nome} não existe no tema ${tema}`)
  return String(v).toUpperCase()
}

/** As quatro superfícies em que qualquer texto pode cair. */
const FUNDOS = ['--card', '--background', '--muted', '--accent']

/** A paleta fixa das vozes (COR-01): não é token de tema, então mora aqui. Valores do Tailwind. */
const PALETA = {
  'emerald-300': '#6EE7B7', 'emerald-400': '#34D399', 'emerald-500': '#10B981', 'emerald-600': '#059669', 'emerald-700': '#047857', 'emerald-800': '#065F46',
  'amber-400': '#FBBF24', 'amber-500': '#F59E0B', 'amber-600': '#D97706', 'amber-800': '#92400E',
  'rose-300': '#FDA4AF', 'rose-400': '#FB7185', 'rose-500': '#F43F5E', 'rose-700': '#BE123C', 'rose-800': '#9F1239',
  'violet-300': '#DDD6FE', 'violet-400': '#A78BFA', 'violet-500': '#8B5CF6', 'violet-700': '#6D28D9', 'violet-800': '#5B21B6',
}

/** COR-06: o degrau de texto pequeno de cada voz (`COR_DO_TOM_DENSO`), por tema. */
const DENSO = {
  claro: { ok: 'emerald-700', espera: 'amber-800', ruim: 'rose-700', alheio: 'violet-700' },
  escuro: { ok: 'emerald-400', espera: 'amber-400', ruim: 'rose-400', alheio: 'violet-400' },
}

const pior = (cor, tema) => Math.min(...FUNDOS.map((f) => razao(cor, token(f, tema))))

describe('os tokens do tema pagam o piso de contraste', () => {
  it('a conta enxerga — acusa um par sabidamente ruim e aprova um bom', () => {
    // Sem esta prova o verde abaixo diria "a conta devolveu algo", não "o par passa".
    assert.equal(razao('#FFFFFF', '#000000'), 21)
    assert.ok(razao('#777777', '#808080') < 1.2)
    assert.ok(razao('#565D70', '#FFFFFF') > PISO_TEXTO)
    assert.ok(luminancia(sobre('#10B981', 0.15, '#FFFFFF')) > 0.7)
  })

  it('os tokens saem da fonte de verdade, e o tema certo de cada um', () => {
    assert.notEqual(token('--card', 'claro'), token('--card', 'escuro'))
    assert.throws(() => token('--nao-existe', 'claro'))
  })

  for (const tema of ['claro', 'escuro']) {
    describe(`tema ${tema}`, () => {
      it('COR-12 · a rampa de tinta passa 4,5:1 no pior dos quatro fundos, com os pisos de cada degrau', () => {
        const pisos = { '--foreground': 14, '--foreground-2': 5.9, '--muted-foreground': 4.6 }
        for (const [t, piso] of Object.entries(pisos)) {
          assert.ok(pior(token(t, tema), tema) >= PISO_TEXTO, `${t}`)
          assert.ok(pior(token(t, tema), tema) >= piso, `${t}: ${pior(token(t, tema), tema)} < ${piso}`)
        }
      })

      it('COR-11 · o contorno de CONTROLE paga 3:1 no pior dos quatro fundos', () => {
        // `input` é contorno de componente (WCAG 1.4.11); `border` é decorativo e não deve nada.
        assert.ok(pior(token('--input', tema), tema) >= PISO_GRAFICO)
      })

      it('MARCA-05 · a frase de erro (`destructive`) passa 4,5:1 — ela escreve', () => {
        assert.ok(pior(token('--destructive', tema), tema) >= PISO_TEXTO)
      })

      it('MARCA-01 · o preenchimento primário É a cor da marca, e ela não cede a contraste', () => {
        assert.equal(token('--primary', tema), MARCA)
        assert.equal(token('--marca-viva', tema), MARCA)
        assert.equal(token('--ring', tema), MARCA)
        // O número, medido e registrado — não um piso a cumprir.
        assert.equal(razao('#FFFFFF', token('--primary', tema)), 4.25)
      })

      it('MARCA-01 · o hover é o MESMO matiz da marca, e só a luz se move', () => {
        const [hm] = hsl(MARCA)
        const [hh] = hsl(token('--primary-hover', tema))
        assert.ok(Math.abs(hh - hm) < 4, `matiz do hover: ${hh.toFixed(1)}° contra ${hm.toFixed(1)}°`)
        assert.ok(razao(MARCA, token('--primary-hover', tema)) > 1.1, 'hover indistinguível da marca')
      })

      it('MARCA-02 · a marca que desenha paga 3:1 nas superfícies em que desenha', () => {
        const superficies = ['--card', '--accent', '--marca-tinta']
        const razoes = superficies.map((f) => razao(token('--marca-viva', tema), token(f, tema)))
        // O vazio não atravessa: `Math.min(...[])` é `Infinity`.
        assert.equal(razoes.length, 3)
        assert.ok(Math.min(...razoes) >= PISO_GRAFICO)
        assert.equal(Math.min(...razoes), tema === 'claro' ? 3.66 : 3.7)
      })

      it('MARCA-02 · a marca e o vermelho da falha NÃO se separam por cor — o número está aqui', () => {
        // É isto que obriga a forma a fazer o trabalho (link sublinhado, destrutivo em contorno).
        assert.equal(razao(PALETA['rose-500'], token('--marca-viva', tema)), 1.16)
      })

      it('MARCA-03 · as pontas do gradiente da marca ficam a pelo menos 2:1 uma da outra', () => {
        assert.ok(razao(token('--primary-gradient-start', tema), token('--primary-gradient-end', tema)) >= 2)
      })

      it('CTRL-09 · a escrita de IA paga 4,5:1 em todo ponto do ciclo violeta → azul → violeta', () => {
        // Entre matizes diferentes o meio do trecho pode ter luminância abaixo das
        // pontas: amostram-se 101 pontos de cada trecho, em sRGB, contra o cartão e o realce.
        const violeta = token('--ia-violeta', tema)
        const azul = token('--ia-azul', tema)
        assert.match(violeta, /^#[0-9A-F]{6}$/)
        assert.match(azul, /^#[0-9A-F]{6}$/)
        const canais = (hex) => hex.replace('#', '').match(/../g).map((c) => parseInt(c, 16) / 255)
        const mistura = (de, para, t) => {
          const [a, b] = [canais(de), canais(para)]
          return '#' + a.map((x, i) => Math.round((x + (b[i] - x) * t) * 255).toString(16).padStart(2, '0')).join('')
        }
        let amostras = 0
        for (const [de, para] of [[violeta, azul], [azul, violeta]]) {
          for (let i = 0; i <= 100; i++) {
            const cor = mistura(de, para, i / 100)
            for (const fundo of ['--card', '--accent']) {
              amostras++
              assert.ok(razao(cor, token(fundo, tema)) >= PISO_TEXTO, `${cor} contra ${fundo}`)
            }
          }
        }
        assert.equal(amostras, 404)
      })

      it('COR-06 · o texto do carimbo passa 4,5:1 sobre a tinta da própria voz', () => {
        const degrau = tema === 'claro' ? '800' : '300'
        for (const voz of ['emerald', 'rose', 'violet']) {
          const tinta = sobre(PALETA[`${voz}-500`], 0.15, token('--card', tema))
          assert.ok(razao(PALETA[`${voz}-${degrau}`], tinta) >= PISO_TEXTO, voz)
        }
        // O âmbar é a exceção da escada: no escuro a família só tem o 400 aqui.
        const tintaAmbar = sobre(PALETA['amber-500'], 0.15, token('--card', tema))
        assert.ok(razao(tema === 'claro' ? PALETA['amber-800'] : PALETA['amber-400'], tintaAmbar) >= PISO_TEXTO)
      })

      it('COR-06 · o número denso de cada voz paga 3:1 sobre o degrau `muted`', () => {
        const fundo = token('--muted', tema)
        const vozes = Object.entries(DENSO[tema])
        assert.equal(vozes.length, 4)
        for (const [voz, cor] of vozes) assert.ok(razao(PALETA[cor], fundo) >= PISO_GRAFICO, `${voz} (${cor})`)
        assert.ok(razao(token('--muted-foreground', tema), fundo) >= PISO_GRAFICO, 'neutro')
        // E o 600 do âmbar, que a regra recusa, de fato não passaria no claro.
        if (tema === 'claro') assert.ok(razao(PALETA['amber-600'], fundo) < PISO_GRAFICO)
      })

      it('COR-07 · o carimbo NEUTRO passa 4,5:1 com a tinta a 7% — o par que já caiu uma vez', () => {
        const tinta = sobre(token('--foreground', tema), 0.07, token('--card', tema))
        const texto = tema === 'claro' ? token('--muted-foreground', tema) : token('--foreground-2', tema)
        assert.ok(razao(texto, tinta) >= PISO_TEXTO)
      })

      it('COR-06 · texto de conteúdo sobre degrau tingido de voz passa 4,5:1 — e o `muted` não passaria', () => {
        for (const voz of ['emerald', 'amber', 'rose', 'violet']) {
          const tinta = sobre(PALETA[`${voz}-500`], 0.15, token('--card', tema))
          assert.ok(razao(token('--foreground-2', tema), tinta) >= PISO_TEXTO, voz)
        }
        // A metade que dá sentido à regra: no escuro o degrau de baixo reprova.
        if (tema === 'escuro') {
          const tintaOk = sobre(PALETA['emerald-500'], 0.15, token('--card', tema))
          assert.ok(razao(token('--muted-foreground', tema), tintaOk) < PISO_TEXTO)
        }
      })
    })
  }
})

describe('COR-15 · o terminal paga o piso nos dois temas', () => {
  const ALFA = 0.95

  it('o fundo e o texto são os mesmos nos dois temas, e o fundo é escuro', () => {
    for (const t of ['--terminal', '--terminal-foreground']) assert.equal(token(t, 'escuro'), token(t, 'claro'), t)
    assert.ok(luminancia(token('--terminal', 'claro')) < 0.02)
  })

  for (const tema of ['claro', 'escuro']) {
    it(`o texto passa 4,5:1 sobre o terminal a 95% em cada fundo do tema ${tema}`, () => {
      const razoes = FUNDOS.map((f) => razao(token('--terminal-foreground', tema), sobre(token('--terminal', tema), ALFA, token(f, tema))))
      assert.equal(razoes.length, FUNDOS.length)
      assert.ok(Math.min(...razoes) >= PISO_TEXTO)
    })
  }

  it('a conta enxerga: o texto do tema claro sobre o terminal reprova', () => {
    const composto = sobre(token('--terminal', 'claro'), ALFA, token('--card', 'claro'))
    assert.ok(razao(token('--foreground', 'claro'), composto) < PISO_TEXTO)
  })
})

describe('COR-11 · a utilitária do anel de controle gasta o token do controle', () => {
  const V4 = readFileSync(join(import.meta.dirname, '..', 'dist', 'tailwind-v4.css'), 'utf8')
  const regra = /@utility anel-de-controle\s*\{([^}]*)\}/.exec(V4)?.[1]

  it('a regra existe na saída v4 — sem ela o resto não examina nada', () => {
    assert.ok(regra, '`anel-de-controle` sumiu da saída v4')
    assert.match(regra, /box-shadow/)
  })

  it('ela desenha com `--input`, e não com um token decorativo', () => {
    assert.ok(regra.includes('var(--input)'))
    for (const decorativo of ['--anel', '--border', '--ring']) assert.ok(!regra.includes(`var(${decorativo})`), decorativo)
  })

  it('a leitura enxerga — prova nos dois sentidos', () => {
    const comoEra = /@utility anel-de-controle\s*\{([^}]*)\}/.exec('@utility anel-de-controle { box-shadow: inset 0 0 0 1px var(--anel); }')?.[1]
    assert.ok(comoEra.includes('var(--anel)'))
    assert.ok(!comoEra.includes('var(--input)'))
  })
})

describe('SUP-03 · o degrau de tinta se vê contra o cartão nos dois temas', () => {
  const PISO_DEGRAU = 1.1

  for (const tema of ['claro', 'escuro']) {
    it(`no ${tema}, \`muted\` × \`card\` mede pelo menos ${PISO_DEGRAU}:1`, () => {
      const r = razao(token('--muted', tema), token('--card', tema))
      assert.ok(r >= PISO_DEGRAU, `${tema}: ${r.toFixed(3)}:1`)
    })
  }

  it('a conta enxerga: o degrau escuro antigo (#11141B) reprova', () => {
    assert.ok(razao('#11141B', token('--card', 'escuro')) < PISO_DEGRAU)
  })
})

describe('SUP-03 · o filete da tabela guia sem virar grade', () => {
  // Abaixo, a guia some; acima, o filete disputa com o degrau e a lista vira planilha.
  const FAIXA = [1.15, 1.3]

  for (const tema of ['claro', 'escuro']) {
    it(`no ${tema}, \`border\` × \`card\` fica entre ${FAIXA[0]} e ${FAIXA[1]}:1`, () => {
      const r = razao(token('--border', tema), token('--card', tema))
      assert.ok(r >= FAIXA[0] && r <= FAIXA[1], `${tema}: ${r.toFixed(3)}:1`)
    })
  }

  it('a conta enxerga: um border tão claro quanto o degrau (#F1F3F8) reprova', () => {
    assert.ok(razao('#F1F3F8', token('--card', 'claro')) < FAIXA[0])
  })
})
