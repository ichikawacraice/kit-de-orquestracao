import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  algumasDas,
  apagarFiltros,
  chaveDoFiltro,
  gravarFiltros,
  igualAoPadrao,
  lerFiltros,
  sanearFiltros,
  umaDas,
  useFiltroLembrado,
  verdadeiroOuFalso,
  type DonoDoFiltro,
  type Esquema,
} from '@/registry/design-system/lib/filtro-lembrado'

// CONV-26: o filtro da Lista lembrado no navegador volta como a pessoa deixou.

const ESTADOS = ['aberto', 'feito', 'cancelado'] as const
const LUGARES = ['casa', 'loja'] as const

type Filtros = { estados: string[]; lugar: string; meus: boolean }
const PADRAO: Filtros = { estados: [], lugar: '', meus: false }
const ESQUEMA: Esquema<Filtros> = {
  estados: algumasDas(ESTADOS),
  lugar: umaDas(['', ...LUGARES]),
  meus: verdadeiroOuFalso,
}
const DONO: DonoDoFiltro = { app: 'app', tela: 'pedidos', versao: 1, pessoa: 'p1' }
const CHAVE = 'wicomm-filtros:app:pedidos:v1:p1'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('chaveDoFiltro', () => {
  it('tem prefixo, app, tela, versão, pessoa e o registro pai quando há', () => {
    expect(chaveDoFiltro(DONO)).toBe(CHAVE)
    expect(chaveDoFiltro({ ...DONO, registro: 'r9' })).toBe(`${CHAVE}:r9`)
  })

  it('escapa o separador dentro de cada pedaço', () => {
    expect(chaveDoFiltro({ ...DONO, pessoa: 'a:b' })).toBe('wicomm-filtros:app:pedidos:v1:a%3Ab')
  })

  it('sem como separar a pessoa, ou com pedaço inválido, não há chave', () => {
    expect(chaveDoFiltro({ ...DONO, pessoa: null })).toBeNull()
    expect(chaveDoFiltro({ ...DONO, pessoa: undefined })).toBeNull()
    expect(chaveDoFiltro({ ...DONO, pessoa: '' })).toBeNull()
    expect(chaveDoFiltro({ ...DONO, tela: '' })).toBeNull()
    expect(chaveDoFiltro({ ...DONO, registro: '' })).toBeNull()
    expect(chaveDoFiltro({ ...DONO, versao: 0 })).toBeNull()
    expect(chaveDoFiltro({ ...DONO, versao: 1.5 })).toBeNull()
  })
})

describe('os validadores', () => {
  it('umaDas aceita só a opção conhecida', () => {
    const v = umaDas(LUGARES)
    expect(v('casa')).toBe('casa')
    expect(v('praia')).toBeUndefined()
    expect(v(3)).toBeUndefined()
  })

  it('algumasDas fica com as válidas, sem repetir; vazia de propósito vale, esvaziada pelo saneamento não', () => {
    const v = algumasDas(ESTADOS)
    expect(v(['feito', 'feito', 'sumiu', 'aberto'])).toEqual(['feito', 'aberto'])
    expect(v([])).toEqual([])
    expect(v(['sumiu'])).toBeUndefined()
    expect(v('feito')).toBeUndefined()
  })

  it('verdadeiroOuFalso só aceita booleano', () => {
    expect(verdadeiroOuFalso(true)).toBe(true)
    expect(verdadeiroOuFalso(false)).toBe(false)
    expect(verdadeiroOuFalso('true')).toBeUndefined()
  })
})

describe('sanearFiltros', () => {
  it('o campo inválido volta ao padrão e os outros ficam', () => {
    expect(sanearFiltros({ estados: ['feito'], lugar: 'praia', meus: true }, PADRAO, ESQUEMA)).toEqual({
      estados: ['feito'],
      lugar: '',
      meus: true,
    })
  })

  it('campo fora do esquema não entra; campo que falta é o padrão', () => {
    expect(sanearFiltros({ busca: 'x', lugar: 'loja' }, PADRAO, ESQUEMA)).toEqual({ ...PADRAO, lugar: 'loja' })
  })

  it('o que não é objeto vira o padrão', () => {
    for (const ruim of [null, 3, 'x', ['a']]) expect(sanearFiltros(ruim, PADRAO, ESQUEMA)).toEqual(PADRAO)
  })
})

describe('ler, gravar e apagar', () => {
  it('grava só os campos do padrão e lê de volta', () => {
    gravarFiltros(CHAVE, { ...PADRAO, lugar: 'loja', busca: 'não grava' } as Filtros, PADRAO)
    expect(JSON.parse(localStorage.getItem(CHAVE)!)).toEqual({ estados: [], lugar: 'loja', meus: false })
    expect(lerFiltros(CHAVE, PADRAO, ESQUEMA)).toEqual({ ...PADRAO, lugar: 'loja' })
  })

  it('o recorte igual ao padrão apaga a chave em vez de gravar', () => {
    localStorage.setItem(CHAVE, '{"lugar":"loja"}')
    gravarFiltros(CHAVE, PADRAO, PADRAO)
    expect(localStorage.getItem(CHAVE)).toBeNull()
  })

  it('o gravado ilegível é apagado e a tela abre no padrão', () => {
    for (const ruim of ['{quebrado', '[1,2]', '"texto"', 'null']) {
      localStorage.setItem(CHAVE, ruim)
      expect(lerFiltros(CHAVE, PADRAO, ESQUEMA), ruim).toEqual(PADRAO)
      expect(localStorage.getItem(CHAVE), ruim).toBeNull()
    }
  })

  it('o campo inválido no gravado não reescreve o gravado ao ler', () => {
    localStorage.setItem(CHAVE, '{"lugar":"praia","meus":true}')
    expect(lerFiltros(CHAVE, PADRAO, ESQUEMA)).toEqual({ ...PADRAO, meus: true })
    expect(localStorage.getItem(CHAVE)).toBe('{"lugar":"praia","meus":true}')
  })

  it('a cota cheia apaga o gravado antes, para o F5 não voltar a um recorte mais velho', () => {
    localStorage.setItem(CHAVE, '{"lugar":"casa"}')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    gravarFiltros(CHAVE, { ...PADRAO, lugar: 'loja' }, PADRAO)
    expect(localStorage.getItem(CHAVE)).toBeNull()
  })

  it('o padrão devolvido não divide as listas com o do chamador', () => {
    const lido = lerFiltros(CHAVE, PADRAO, ESQUEMA)
    expect(lido.estados).toEqual([])
    expect(lido.estados).not.toBe(PADRAO.estados)
  })

  it('sem armazenamento (aba privada, cota cheia), nada lança', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(lerFiltros(CHAVE, PADRAO, ESQUEMA)).toEqual(PADRAO)
    expect(() => gravarFiltros(CHAVE, { ...PADRAO, meus: true }, PADRAO)).not.toThrow()
    expect(() => apagarFiltros(CHAVE)).not.toThrow()
  })
})

describe('igualAoPadrao', () => {
  it('lista compara como conjunto; o resto, pelo valor', () => {
    const p = { estados: ['aberto', 'feito'], lugar: '', meus: false }
    expect(igualAoPadrao({ ...p, estados: ['feito', 'aberto'] }, p)).toBe(true)
    expect(igualAoPadrao({ ...p, estados: ['feito'] }, p)).toBe(false)
    expect(igualAoPadrao({ ...p, meus: true }, p)).toBe(false)
  })
})

describe('useFiltroLembrado', () => {
  const usar = (extra: Partial<DonoDoFiltro> & { aguardar?: boolean } = {}) =>
    renderHook((props: Partial<DonoDoFiltro> & { aguardar?: boolean }) =>
      useFiltroLembrado({ ...DONO, padrao: PADRAO, esquema: ESQUEMA, ...props }),
    { initialProps: extra })

  it('volta como a pessoa deixou', () => {
    localStorage.setItem(CHAVE, JSON.stringify({ estados: ['feito'], lugar: 'casa', meus: true }))
    const { result } = usar()
    expect(result.current.lido).toBe(true)
    expect(result.current.filtros).toEqual({ estados: ['feito'], lugar: 'casa', meus: true })
    expect(result.current.foraDoPadrao).toBe(true)
  })

  it('ler o gravado não grava', () => {
    localStorage.setItem(CHAVE, '{"lugar":"praia","meus":true}')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = usar()
    expect(result.current.filtros).toEqual({ ...PADRAO, meus: true })
    expect(setItem).not.toHaveBeenCalled()
  })

  it('o gesto grava; o Limpar volta ao padrão e apaga a chave', () => {
    const { result } = usar()
    expect(result.current.foraDoPadrao).toBe(false)
    act(() => result.current.mudar({ lugar: 'loja' }))
    act(() => result.current.mudar({ meus: true }))
    expect(result.current.filtros).toEqual({ estados: [], lugar: 'loja', meus: true })
    expect(JSON.parse(localStorage.getItem(CHAVE)!)).toEqual({ estados: [], lugar: 'loja', meus: true })
    act(() => result.current.limpar())
    expect(result.current.filtros).toEqual(PADRAO)
    expect(result.current.foraDoPadrao).toBe(false)
    expect(localStorage.getItem(CHAVE)).toBeNull()
  })

  it('enquanto não se sabe quem vê, ou enquanto aguarda as opções, não lê e não está lido', () => {
    localStorage.setItem(CHAVE, '{"lugar":"casa"}')
    const { result, rerender } = usar({ pessoa: undefined })
    expect(result.current.lido).toBe(false)
    expect(result.current.filtros).toEqual(PADRAO)
    rerender({ aguardar: true })
    expect(result.current.lido).toBe(false)
    rerender({ aguardar: false })
    expect(result.current.lido).toBe(true)
    expect(result.current.filtros.lugar).toBe('casa')
  })

  it('sem como separar a pessoa, funciona só na memória', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = usar({ pessoa: null })
    expect(result.current.lido).toBe(true)
    act(() => result.current.mudar({ meus: true }))
    expect(result.current.filtros.meus).toBe(true)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('trocar de pessoa lê o recorte da outra, sem herdar o da primeira', () => {
    localStorage.setItem(CHAVE, '{"lugar":"casa"}')
    localStorage.setItem('wicomm-filtros:app:pedidos:v1:p2', '{"lugar":"loja"}')
    const { result, rerender } = usar()
    expect(result.current.filtros.lugar).toBe('casa')
    rerender({ pessoa: 'p2' })
    expect(result.current.lido).toBe(true)
    expect(result.current.filtros.lugar).toBe('loja')
    rerender({ pessoa: 'p3' })
    expect(result.current.filtros).toEqual(PADRAO)
  })

  it('o filtro do URL vence o lembrado, sem ler nem gravar; o gesto grava o recorte que a pessoa vê', () => {
    localStorage.setItem(CHAVE, '{"lugar":"casa","meus":true}')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() =>
      useFiltroLembrado({ ...DONO, padrao: PADRAO, esquema: ESQUEMA, doUrl: { estados: ['feito', 'sumiu'] } }),
    )
    expect(result.current.lido).toBe(true)
    expect(result.current.filtros).toEqual({ ...PADRAO, estados: ['feito'] })
    expect(setItem).not.toHaveBeenCalled()
    act(() => result.current.mudar({ lugar: 'loja' }))
    expect(JSON.parse(localStorage.getItem(CHAVE)!)).toEqual({ estados: ['feito'], lugar: 'loja', meus: false })
  })

  it('antes de ler, o gesto não vale', () => {
    const { result } = usar({ aguardar: true })
    act(() => result.current.mudar({ meus: true }))
    act(() => result.current.limpar())
    expect(result.current.filtros).toEqual(PADRAO)
    expect(localStorage.getItem(CHAVE)).toBeNull()
  })

  it('aguardar depois de lido relê ao voltar, sem desenhar o velho como lido', () => {
    const { result, rerender } = usar()
    act(() => result.current.mudar({ lugar: 'loja' }))
    rerender({ aguardar: true })
    expect(result.current.lido).toBe(false)
    localStorage.setItem(CHAVE, '{"lugar":"casa"}')
    rerender({ aguardar: false })
    expect(result.current.filtros.lugar).toBe('casa')
  })

  it('padrão e esquema recriados a cada desenho não releem nem desfazem o gesto', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const { result, rerender } = renderHook(() =>
      useFiltroLembrado({ ...DONO, padrao: { ...PADRAO }, esquema: { ...ESQUEMA } }),
    )
    act(() => result.current.mudar({ lugar: 'loja' }))
    rerender()
    rerender()
    expect(result.current.filtros.lugar).toBe('loja')
    expect(getItem).toHaveBeenCalledTimes(1)
  })
})
