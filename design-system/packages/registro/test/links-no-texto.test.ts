import { describe, expect, it } from 'vitest'

import { trechosComLinks } from '@/registry/design-system/lib/links-no-texto'

describe('trechosComLinks', () => {
  it('texto sem link volta inteiro, num trecho só', () => {
    expect(trechosComLinks('oi, tudo certo?')).toEqual([{ tipo: 'texto', texto: 'oi, tudo certo?' }])
  })

  it('texto vazio não vira trecho nenhum', () => {
    expect(trechosComLinks('')).toEqual([])
  })

  it('link no meio da frase separa antes, link e depois', () => {
    expect(trechosComLinks('veja em https://loja.example/produto/1 e me diga')).toEqual([
      { tipo: 'texto', texto: 'veja em ' },
      { tipo: 'link', texto: 'https://loja.example/produto/1', href: 'https://loja.example/produto/1' },
      { tipo: 'texto', texto: ' e me diga' },
    ])
  })

  it('pontuação no fim fica com a frase', () => {
    const trechos = trechosComLinks('Está em http://a.example/x?y=1.')
    expect(trechos).toHaveLength(3)
    expect(trechos[1]).toMatchObject({ tipo: 'link', texto: 'http://a.example/x?y=1' })
    expect(trechos[2]).toEqual({ tipo: 'texto', texto: '.' })
  })

  it('o parêntese que envolve o link fica fora; o do próprio link fica', () => {
    expect(trechosComLinks('(https://a.example/x)')[1]).toMatchObject({ tipo: 'link', texto: 'https://a.example/x' })
    expect(trechosComLinks('https://w.example/wiki/Teste_(x)')[0]).toMatchObject({
      tipo: 'link',
      texto: 'https://w.example/wiki/Teste_(x)',
    })
  })

  it('a quebra de linha encerra o link e o texto guarda a quebra', () => {
    const trechos = trechosComLinks('url:\nhttps://a.example\nobrigada')
    expect(trechos.map((t) => t.tipo)).toEqual(['texto', 'link', 'texto'])
    expect(trechos[2]).toEqual({ tipo: 'texto', texto: '\nobrigada' })
  })

  it('só http(s) vira link: javascript:, www. sem esquema e esquema vazio, não', () => {
    // Prova antes que um http(s) de verdade vira link, para a ausência medir alguma coisa.
    expect(trechosComLinks('https://a.example').some((t) => t.tipo === 'link')).toBe(true)
    for (const texto of ['javascript:alert(1)', 'www.loja.example', 'https://', 'http://.', 'ftp://a.example']) {
      expect(trechosComLinks(texto).every((t) => t.tipo === 'texto'), texto).toBe(true)
    }
  })

  it('dois links na mesma mensagem, e o texto todo se recompõe', () => {
    const texto = 'antes https://a.example depois https://b.example'
    const trechos = trechosComLinks(texto)
    expect(trechos.filter((t) => t.tipo === 'link').map((l) => l.texto)).toEqual(['https://a.example', 'https://b.example'])
    expect(trechos.map((t) => t.texto).join('')).toBe(texto)
  })
})
