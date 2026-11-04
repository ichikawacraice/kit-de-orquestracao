import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AutorDaConversa, BalaoDaConversa, Conversa, DiaDaConversa } from '@/registry/design-system/ui/conversa'
import {
  CORES_DA_PESSOA,
  MONOGRAMA_DA_PESSOA,
  Monograma,
  NOME_DA_PESSOA,
  corDaPessoa,
} from '@/registry/design-system/ui/monograma'
import { Pessoa, PilhaDePessoas } from '@/registry/design-system/ui/pessoa'

/** As vozes (COR-04) e o vermelho/laranja da prioridade: a cor da pessoa nunca as empresta. */
const EMPRESTADA = /\b(?:bg|text)-(?:red|rose|orange|amber|yellow|emerald|green|violet)-/

describe('A cor da pessoa', () => {
  it('são 8 famílias sem dono, e os dois mapas cobrem as 8', () => {
    expect(CORES_DA_PESSOA).toHaveLength(8)
    for (const cor of CORES_DA_PESSOA) {
      expect(NOME_DA_PESSOA[cor]).toMatch(new RegExp(`text-${cor}-\\d+ dark:text-${cor}-\\d+`))
      expect(MONOGRAMA_DA_PESSOA[cor]).toMatch(new RegExp(`bg-${cor}-100 text-${cor}-800 dark:bg-${cor}-900 dark:text-${cor}-200`))
      expect(NOME_DA_PESSOA[cor] + MONOGRAMA_DA_PESSOA[cor]).not.toMatch(EMPRESTADA)
    }
  })

  it('a mesma chave dá sempre a mesma cor, e chaves diferentes espalham pelas 8', () => {
    const chaves = Array.from({ length: 200 }, (_, i) => `pessoa-${i}`)
    expect(chaves.map(corDaPessoa)).toEqual(chaves.map(corDaPessoa))
    const usadas = new Set(chaves.map(corDaPessoa))
    expect(usadas.size).toBe(8)
    for (const cor of usadas) expect(CORES_DA_PESSOA).toContain(cor)
  })

  it('o Monograma com cor troca a tinta neutra pela opaca da pessoa; sem cor, segue neutro', () => {
    const { container } = render(
      <>
        <Monograma nome="Ana Souza" cor="teal" />
        <Monograma nome="Bruno Lima" />
      </>
    )
    const [comCor, neutro] = Array.from(container.children) as [HTMLElement, HTMLElement]
    expect(comCor.className).toContain('bg-teal-100')
    expect(comCor.className).toContain('text-teal-800')
    expect(comCor.className).not.toContain('bg-foreground/[0.07]')
    expect(neutro.className).toContain('bg-foreground/[0.07]')
    expect(neutro.className).not.toMatch(/bg-(?:lime|teal|cyan|sky|blue|indigo|purple|fuchsia)-/)
  })

  it('a Pessoa e a PilhaDePessoas passam a cor ao monograma', () => {
    const { container } = render(
      <>
        <Pessoa pessoa={{ nome: 'Ana Souza', cor: 'indigo' }} />
        <PilhaDePessoas pessoas={[{ nome: 'Bruno Lima', cor: 'fuchsia' }, { nome: 'Carla Dias' }]} />
      </>
    )
    const monogramas = Array.from(container.querySelectorAll('[data-slot=monograma]')) as HTMLElement[]
    expect(monogramas).toHaveLength(3)
    expect(monogramas[0]!.className).toContain('bg-indigo-100')
    expect(monogramas[1]!.className).toContain('bg-fuchsia-100')
    expect(monogramas[2]!.className).toContain('bg-foreground/[0.07]')
  })
})

describe('A pilha decorativa', () => {
  it('não é alvo nem imagem: aria-hidden, sem tabIndex e sem dica', () => {
    const pessoas = ['Ana Souza', 'Bruno Lima'].map((nome) => ({ nome }))
    const { container } = render(<PilhaDePessoas pessoas={pessoas} decorativa />)
    const pilha = container.querySelector('[data-slot=pilha-de-pessoas]') as HTMLElement
    expect(pilha).toBeTruthy()
    expect(pilha.getAttribute('aria-hidden')).toBe('true')
    expect(pilha.hasAttribute('tabindex')).toBe(false)
    expect(pilha.hasAttribute('role')).toBe(false)
    expect(pilha.hasAttribute('aria-label')).toBe(false)
    expect(pilha.querySelectorAll('[data-slot=monograma]')).toHaveLength(2)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('sem decorativa, segue a imagem focável de antes', () => {
    render(<PilhaDePessoas pessoas={[{ nome: 'Ana Souza' }]} />)
    expect(screen.getByRole('img', { name: 'Ana Souza' }).tabIndex).toBe(0)
  })
})

function Balao(props: Partial<React.ComponentProps<typeof BalaoDaConversa>>) {
  return (
    <Conversa rotulo="Mensagens do item">
      <BalaoDaConversa
        lado="outro"
        primeira={false}
        paraLeitor="Ana Souza, hoje às 14:32:"
        hora="14:32"
        instante="2026-11-04T17:32:00.000Z"
        {...props}
      >
        Pode revisar?
      </BalaoDaConversa>
    </Conversa>
  )
}

describe('Conversa', () => {
  it('é uma lista com o rótulo de quem chama', () => {
    render(<Balao />)
    const lista = screen.getByRole('list', { name: 'Mensagens do item' })
    expect(lista.tagName).toBe('OL')
    expect(lista.dataset.slot).toBe('conversa')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('o meu à direita na tinta da marca; o primeiro do grupo tem o canto de quem fala menos redondo', () => {
    render(<Balao lado="meu" primeira />)
    const li = screen.getByRole('listitem')
    expect(li.dataset.lado).toBe('meu')
    expect(li.hasAttribute('data-primeira')).toBe(true)
    expect(li.className).toContain('justify-end')
    const corpo = li.querySelector('div') as HTMLElement
    expect(corpo.className).toContain('bg-marca-tinta')
    expect(corpo.className).toContain('rounded-xl')
    expect(corpo.className).toContain('rounded-tr-md')
    expect(corpo.className).not.toContain('rounded-tl-md')
  })

  it('o do outro à esquerda no muted; fora do primeiro, todos os cantos iguais', () => {
    const { rerender } = render(<Balao lado="outro" primeira />)
    let corpo = screen.getByRole('listitem').querySelector('div') as HTMLElement
    expect(screen.getByRole('listitem').className).toContain('justify-start')
    expect(corpo.className).toContain('bg-muted')
    expect(corpo.className).toContain('rounded-tl-md')
    rerender(<Balao lado="outro" primeira={false} />)
    corpo = screen.getByRole('listitem').querySelector('div') as HTMLElement
    expect(corpo.className).not.toMatch(/rounded-t[lr]-md/)
    expect(screen.getByRole('listitem').hasAttribute('data-primeira')).toBe(false)
  })

  it('nenhum balão ganha tinta de voz', () => {
    const { container } = render(
      <>
        <Balao lado="meu" primeira />
        <Balao lado="outro" primeira autor={<AutorDaConversa nome="Ana Souza" cor="sky" />} />
      </>
    )
    const corpos = Array.from(container.querySelectorAll('[data-slot=balao-da-conversa] > div')) as HTMLElement[]
    expect(corpos).toHaveLength(2)
    expect(corpos[1]!.textContent).toContain('Ana Souza')
    for (const div of corpos) {
      expect(div.className).not.toMatch(/bg-(?:red|rose|orange|amber|emerald|violet|sky|lime|teal|cyan|blue|indigo|purple|fuchsia)-/)
    }
  })

  it('o leitor de tela ouve a frase inteira primeiro; a hora é um time escondido, com o lugar reservado', () => {
    render(<Balao />)
    const li = screen.getByRole('listitem')
    const frase = li.firstElementChild as HTMLElement
    expect(frase.className).toContain('sr-only')
    expect(frase.textContent).toContain('Ana Souza, hoje às 14:32:')
    const hora = li.querySelector('time') as HTMLElement
    expect(hora.getAttribute('dateTime')).toBe('2026-11-04T17:32:00.000Z')
    expect(hora.getAttribute('aria-hidden')).toBe('true')
    expect(hora.textContent).toBe('14:32')
    expect(hora.className).toContain('t-medida')
    expect(li.querySelector('p > span[aria-hidden=true]')?.className).toContain('w-11')
    expect(li.querySelector('p')?.className).toContain('whitespace-pre-wrap')
  })

  it('só o que chegou com a conversa aberta entra com o fade, e respeita o movimento reduzido', () => {
    const { rerender } = render(<Balao />)
    expect((screen.getByRole('listitem').querySelector('div') as HTMLElement).className).not.toContain('animate-in')
    rerender(<Balao chegou />)
    const corpo = screen.getByRole('listitem').querySelector('div') as HTMLElement
    expect(corpo.className).toContain('animate-in')
    expect(corpo.className).toContain('motion-reduce:animate-none')
  })

  it('o autor e o dia são enfeite (aria-hidden); o nome leva a cor da pessoa só quando ela vem', () => {
    const { container } = render(
      <Conversa rotulo="Mensagens">
        <DiaDaConversa>Hoje</DiaDaConversa>
        <BalaoDaConversa
          lado="outro"
          primeira
          autor={<AutorDaConversa nome="Ana Souza" selo="Cliente" cor="cyan" />}
          paraLeitor="Ana Souza, cliente, hoje às 14:32:"
          hora="14:32"
          instante="2026-11-04T17:32:00.000Z"
        >
          Oi
        </BalaoDaConversa>
        <BalaoDaConversa
          lado="outro"
          primeira
          autor={<AutorDaConversa nome="Bruno Lima" />}
          paraLeitor="Bruno Lima, hoje às 14:33:"
          hora="14:33"
          instante="2026-11-04T17:33:00.000Z"
        >
          Olá
        </BalaoDaConversa>
      </Conversa>
    )
    const dia = container.querySelector('[data-slot=dia-da-conversa]') as HTMLElement
    expect(dia.tagName).toBe('LI')
    expect(dia.getAttribute('aria-hidden')).toBe('true')
    const autores = Array.from(container.querySelectorAll('[data-slot=autor-da-conversa]')) as HTMLElement[]
    expect(autores).toHaveLength(2)
    for (const a of autores) expect(a.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText('Ana Souza').className).toContain(NOME_DA_PESSOA.cyan)
    expect(screen.getByText('Bruno Lima').className).toContain('text-foreground-2')
    expect(screen.getByText('Cliente').dataset.slot).toBe('badge')
  })
})
