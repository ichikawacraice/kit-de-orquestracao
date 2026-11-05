import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AutorDaConversa, BalaoDaConversa, Conversa, DiaDaConversa, TextoComLinks } from '@/registry/design-system/ui/conversa'
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

  it('o Monograma com chave troca a tinta neutra pela opaca da pessoa; chave null, vazia ou só espaços segue neutro', () => {
    const cor = corDaPessoa('pessoa-ana')
    const { container } = render(
      <>
        <Monograma nome="Ana Souza" chave="pessoa-ana" />
        <Monograma nome="Bruno Lima" chave={null} />
        <Monograma nome="Carla Dias" chave="" />
        <Monograma nome="Davi Melo" chave="  " />
      </>
    )
    const [comCor, ...neutros] = Array.from(container.children) as HTMLElement[]
    // A presença seria detectada: o monograma com chave tem a cor e o data-cor.
    expect(comCor!.className).toContain(MONOGRAMA_DA_PESSOA[cor])
    expect(comCor!.className).not.toContain('bg-foreground/[0.07]')
    expect(comCor!.dataset.cor).toBe(cor)
    expect(neutros).toHaveLength(3)
    for (const n of neutros) {
      expect(n.className).toContain('bg-foreground/[0.07]')
      expect(n.className).not.toMatch(/bg-(?:lime|teal|cyan|sky|blue|indigo|purple|fuchsia)-/)
      expect(n.hasAttribute('data-cor')).toBe(false)
    }
  })

  it('a Pessoa e a PilhaDePessoas tiram a cor do id; sem id, neutro', () => {
    const { container } = render(
      <>
        <Pessoa pessoa={{ id: 'pessoa-ana', nome: 'Ana Souza' }} />
        <PilhaDePessoas pessoas={[{ id: 'pessoa-bruno', nome: 'Bruno Lima' }, { id: null, nome: 'Carla Dias' }]} />
      </>
    )
    const monogramas = Array.from(container.querySelectorAll('[data-slot=monograma]')) as HTMLElement[]
    expect(monogramas).toHaveLength(3)
    expect(monogramas[0]!.className).toContain(MONOGRAMA_DA_PESSOA[corDaPessoa('pessoa-ana')])
    expect(monogramas[1]!.className).toContain(MONOGRAMA_DA_PESSOA[corDaPessoa('pessoa-bruno')])
    expect(monogramas[2]!.className).toContain('bg-foreground/[0.07]')
  })

  it('o id sem nome mostra o ? na cor do id e Pessoa sem nome', () => {
    const { container } = render(<Pessoa pessoa={{ id: 'pessoa-ana', nome: null }} />)
    const m = container.querySelector('[data-slot=monograma]') as HTMLElement
    expect(m.textContent).toBe('?')
    expect(m.className).toContain(MONOGRAMA_DA_PESSOA[corDaPessoa('pessoa-ana')])
    expect(screen.getByText('Pessoa sem nome')).toBeTruthy()
    expect(container.textContent).not.toContain('pessoa-ana')
  })

  it('a chave é obrigatória: esquecer não compila', () => {
    // @ts-expect-error sem chave, o neutro seria esquecimento, não escolha
    const semChave = <Monograma nome="A" />
    expect(semChave).toBeTruthy()
  })
})

describe('A pilha decorativa', () => {
  it('não é alvo nem imagem: aria-hidden, sem tabIndex e sem dica', () => {
    const pessoas = [{ id: 'pessoa-ana', nome: 'Ana Souza' }, { id: 'pessoa-bruno', nome: 'Bruno Lima' }]
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
    render(<PilhaDePessoas pessoas={[{ id: 'pessoa-ana', nome: 'Ana Souza' }]} />)
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
        {props.children ?? 'Pode revisar?'}
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
        <Balao lado="outro" primeira autor={<AutorDaConversa nome="Ana Souza" chave="pessoa-ana" />} />
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

  it('o autor e o dia são enfeite (aria-hidden); o nome leva a cor da pessoa quando há id', () => {
    const { container } = render(
      <Conversa rotulo="Mensagens">
        <DiaDaConversa>Hoje</DiaDaConversa>
        <BalaoDaConversa
          lado="outro"
          primeira
          autor={<AutorDaConversa nome="Ana Souza" selo="Cliente" chave="pessoa-ana" />}
          paraLeitor="Ana Souza, cliente, hoje às 14:32:"
          hora="14:32"
          instante="2026-11-04T17:32:00.000Z"
        >
          Oi
        </BalaoDaConversa>
        <BalaoDaConversa
          lado="outro"
          primeira
          autor={<AutorDaConversa nome="Bruno Lima" chave={null} />}
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
    expect(screen.getByText('Ana Souza').className).toContain(NOME_DA_PESSOA[corDaPessoa('pessoa-ana')])
    expect(screen.getByText('Bruno Lima').className).toContain('text-foreground-2')
    expect(screen.getByText('Cliente').dataset.slot).toBe('badge')
  })
})

describe('TextoComLinks', () => {
  it('o http(s) do corpo vira link em nova aba, com o aviso para o leitor; o resto segue texto', () => {
    const { container } = render(
      <Balao lado="meu">
        <TextoComLinks texto={'veja https://loja.example/p/1. e javascript:alert(1)'} />
      </Balao>
    )
    expect(screen.getAllByRole('link')).toHaveLength(1)
    const link = screen.getByRole('link', { name: /^https:\/\/loja\.example\/p\/1\s*\(abre em nova aba\)$/ })
    expect(link.getAttribute('href')).toBe('https://loja.example/p/1')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.closest('p')).toBeTruthy()
    expect(container.querySelector('p')?.textContent).toContain('. e javascript:alert(1)')
  })

  it('o sublinhado é da tinta, e o respiro do anel tem a cor do balão', () => {
    render(<TextoComLinks texto="https://a.example" />)
    const link = screen.getByRole('link')
    for (const c of ['sublinhado-de-link', 'box-decoration-clone', 'focus-visible:ring-offset-2']) {
      expect(link.className).toContain(c)
    }
    expect(link.className).toContain('in-data-[lado=meu]:focus-visible:ring-offset-marca-tinta')
    expect(link.className).toContain('in-data-[lado=outro]:focus-visible:ring-offset-muted')
    expect(link.className).not.toMatch(/text-(?:primary|marca)/)
  })
})
