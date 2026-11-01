import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { EscolhaNaCelula } from '@/registry/wicomm/ui/escolha-na-celula'
import { LinhaDoGrupo } from '@/registry/wicomm/ui/linha-do-grupo'
import { GrupoDeEscolhaDoMenu, ItemDeEscolhaDoMenu } from '@/registry/wicomm/ui/menu'
import { Monograma, MonogramaAusente, iniciais } from '@/registry/wicomm/ui/monograma'
import { Pessoa, PilhaDePessoas } from '@/registry/wicomm/ui/pessoa'
import { Prazo } from '@/registry/wicomm/ui/prazo'
import { LinkDaLinha, Table, TableCell, TableRow } from '@/registry/wicomm/ui/table'

function Grupo(props: Partial<React.ComponentProps<typeof LinhaDoGrupo>> & { linhas?: string[] }) {
  const { linhas = ['Briefing', 'Wireframes'], ...resto } = props
  return (
    <Table>
      <LinhaDoGrupo nome="Descoberta" colunas={3} contagem={{ feitas: 1, total: 2 }} {...resto}>
        {linhas.map((l) => (
          <TableRow key={l}>
            <TableCell>{l}</TableCell>
            <TableCell />
            <TableCell />
          </TableRow>
        ))}
      </LinhaDoGrupo>
    </Table>
  )
}

describe('LinhaDoGrupo', () => {
  it('é um tbody com th scope=rowgroup, e o alternador abre e fecha as linhas', () => {
    render(<Grupo />)
    const th = screen.getByRole('rowheader')
    expect(th.getAttribute('scope')).toBe('rowgroup')
    expect(th.closest('tbody')?.dataset.slot).toBe('linha-do-grupo')
    const alternador = within(th).getByRole('button', { name: /Descoberta/ })
    expect(alternador.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Briefing')).toBeTruthy()
    fireEvent.click(alternador)
    expect(alternador.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Briefing')).toBeNull()
  })

  it('a contagem em medida, a trilha da marca pela contagem e o degrau de tinta com raio de agrupador', () => {
    render(<Grupo progresso />)
    expect(screen.getByText('1 de 2').className).toContain('t-medida')
    const preenchimento = document.querySelector('[data-slot=preenchimento-do-progresso]') as HTMLElement
    expect(preenchimento.style.width).toBe('50%')
    const degrau = screen.getByRole('rowheader').firstElementChild as HTMLElement
    expect(degrau.className).toContain('bg-muted')
    expect(degrau.className).toContain('rounded-l-xl')
    expect(degrau.className).toContain('rounded-r-xl')
    expect(degrau.className).toContain('h-10')
  })

  it('concluído troca a barra pelo carimbo ok; site tem 48px', () => {
    render(<Grupo progresso concluido densidade="site" />)
    expect(document.querySelector('[data-slot=trilha-do-progresso]')).toBeNull()
    expect(screen.getByText('Concluído').dataset.tom).toBe('ok')
    expect((screen.getByRole('rowheader').firstElementChild as HTMLElement).className).toContain('h-12')
  })

  it('vazio: sem botão, o chevron guarda o lugar invisível, sem opacidade', () => {
    render(<Grupo linhas={[]} />)
    const th = screen.getByRole('rowheader')
    expect(within(th).queryByRole('button')).toBeNull()
    expect(th.querySelector('svg')?.getAttribute('class')).toContain('invisible')
    expect(th.innerHTML).not.toContain('opacity')
  })

  it('as células alinhadas ocupam as últimas colunas, e o th fica com o resto', () => {
    render(<Grupo celulas={['24 jul']} acao={<button type="button">Ações do grupo</button>} colunas={4} />)
    expect(screen.getByRole('rowheader').getAttribute('colspan')).toBe('2')
    const linha = screen.getByRole('rowheader').parentElement!
    expect(linha.children).toHaveLength(3)
    expect((linha.lastElementChild!.firstElementChild as HTMLElement).className).toContain('rounded-r-xl')
    expect((screen.getByRole('rowheader').firstElementChild as HTMLElement).className).not.toContain('rounded-r-xl')
  })

  it('o vão antes do grupo é da peça, menos no primeiro', () => {
    render(<Grupo />)
    expect(screen.getByRole('rowheader').className).toContain('[tbody:not(:first-of-type)_&]:pt-1.5')
  })
})

describe('Monograma', () => {
  it('as iniciais, em tinta neutra e aria-hidden; a ausência é tracejada', () => {
    expect(iniciais('Ana Maria Souza')).toBe('AS')
    expect(iniciais('')).toBe('?')
    const { container } = render(
      <>
        <Monograma nome="Ana Souza" />
        <MonogramaAusente />
      </>
    )
    const [m, a] = Array.from(container.children) as [HTMLElement, HTMLElement]
    expect(m.textContent).toBe('AS')
    expect(m.getAttribute('aria-hidden')).toBe('true')
    expect(a.className).toContain('border-dashed')
  })

  it('segue exportado pelo menu da conta', async () => {
    const conta = await import('@/registry/wicomm/ui/menu-da-conta')
    expect(conta.Monograma).toBe(Monograma)
  })
})

describe('Pessoa e PilhaDePessoas', () => {
  it('com pessoa, sem pessoa (tracejado e o texto de quem chama) e sem nome', () => {
    const { rerender, container } = render(<Pessoa pessoa={{ nome: 'Ana Souza' }} papel="Gerente" />)
    expect(screen.getByText('Ana Souza').className).toContain('truncate')
    expect(screen.getByText('Gerente').className).toContain('text-muted-foreground')
    rerender(<Pessoa pessoa={null} semPessoa="Sem gerente" />)
    expect(screen.getByText('Sem gerente').className).toContain('text-muted-foreground')
    expect(container.querySelector('[data-slot=monograma-ausente]')).toBeTruthy()
    rerender(<Pessoa pessoa={{ nome: null }} />)
    expect(screen.getByText('Pessoa sem nome')).toBeTruthy()
    expect(container.querySelector('[data-slot=monograma]')?.textContent).toBe('?')
  })

  it('soMonograma é focável e leva o nome acessível; carregando é esqueleto', () => {
    const { rerender } = render(<Pessoa pessoa={{ nome: 'Ana Souza' }} soMonograma />)
    const alvo = screen.getByRole('img', { name: 'Ana Souza' })
    expect(alvo.tabIndex).toBe(0)
    rerender(<Pessoa pessoa={null} carregando />)
    expect(document.querySelector('[aria-busy=true]')?.querySelectorAll('[data-slot=skeleton]')).toHaveLength(2)
  })

  it('a pilha mostra até max, +N em medida, a frase inteira no nome acessível', () => {
    const pessoas = ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Davi Melo', 'Eva Reis'].map((nome) => ({ nome }))
    render(<PilhaDePessoas pessoas={pessoas} sobre="muted" />)
    const pilha = screen.getByRole('img', { name: 'Ana Souza, Bruno Lima, Carla Dias, Davi Melo e Eva Reis' })
    expect(pilha.querySelectorAll('[data-slot=monograma]')).toHaveLength(3)
    expect(screen.getByText('+2').className).toContain('t-medida')
    expect(pilha.querySelector('.ring-muted')).toBeTruthy()
    expect(pilha.innerHTML).not.toMatch(/bg-(rose|emerald|amber|violet|sky|blue)/)
  })

  it('um a mais que o limite mostra a pessoa, não +1; vazia não desenha', () => {
    const { rerender, container } = render(<PilhaDePessoas pessoas={['A B', 'C D', 'E F', 'G H'].map((nome) => ({ nome }))} />)
    expect(container.querySelectorAll('[data-slot=monograma]')).toHaveLength(4)
    expect(screen.queryByText('+1')).toBeNull()
    rerender(<PilhaDePessoas pessoas={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('Prazo', () => {
  const hoje = new Date('2026-07-12T15:00:00-03:00')

  it('a data em medida e a legenda neutra sem tom — nunca pinta', () => {
    render(<Prazo periodo="2026-07-24" hoje={hoje} />)
    expect(screen.getByText('24 jul').className).toContain('t-medida')
    const legenda = screen.getByText('em 12 dias')
    expect(legenda.className).toContain('text-muted-foreground')
    expect(document.querySelector('[data-slot=estado]')).toBeNull()
  })

  it('com tom, o verbo e o Estado; no passado, venceu; chip quando é o estado do objeto', () => {
    const { rerender } = render(<Prazo periodo="2026-07-14" tom="espera" hoje={hoje} />)
    expect(screen.getByText('vence em 2 dias').closest('[data-slot=estado]')?.getAttribute('data-tom')).toBe('espera')
    rerender(<Prazo periodo="2026-07-09" tom="ruim" hoje={hoje} />)
    expect(screen.getByText('venceu há 3 dias')).toBeTruthy()
    rerender(<Prazo periodo="2026-07-09" tom="ruim" forma="chip" hoje={hoje} />)
    expect(screen.getByText('venceu há 3 dias').dataset.slot).toBe('chip-de-estado')
  })

  it('intervalo, até, desde, e o ano só quando não é o corrente', () => {
    const { rerender } = render(<Prazo periodo={{ inicio: '2026-06-02', fim: '2026-07-24' }} hoje={hoje} />)
    expect(screen.getByText('2 jun → 24 jul')).toBeTruthy()
    rerender(<Prazo periodo={{ fim: '2027-01-10' }} hoje={hoje} />)
    expect(screen.getByText('até 10 jan 2027')).toBeTruthy()
    rerender(<Prazo periodo={{ inicio: '2026-06-02' }} hoje={hoje} />)
    expect(screen.getByText('desde 2 jun')).toBeTruthy()
    expect(document.querySelector('[data-slot=prazo]')!.children).toHaveLength(1)
  })

  it('o dia é o de São Paulo: 23h de SP não vira o dia seguinte', () => {
    render(<Prazo periodo={new Date('2026-07-24T23:30:00-03:00')} hoje={hoje} />)
    expect(screen.getByText('24 jul')).toBeTruthy()
  })

  it('sem data, proposta sem voz, concluído sem legenda, parcial com a frase', () => {
    const { rerender } = render(<Prazo periodo={null} hoje={hoje} />)
    expect(screen.getByText('Sem data').className).toContain('text-muted-foreground')
    rerender(<Prazo periodo="2026-07-14" tom="ruim" proposta hoje={hoje} />)
    expect(screen.getByText('proposta').className).toContain('text-muted-foreground')
    expect(document.querySelector('[data-tom]')).toBeNull()
    rerender(<Prazo periodo="2026-07-14" tom="espera" concluido hoje={hoje} />)
    expect(document.querySelector('[data-slot=prazo]')!.children).toHaveLength(1)
    rerender(<Prazo periodo="2026-07-24" parcial="Prazo de 4 de 20 tarefas" hoje={hoje} />)
    expect(screen.getByText(', Prazo de 4 de 20 tarefas').className).toContain('sr-only')
  })
})

describe('EscolhaNaCelula', () => {
  function Celula(props: Partial<React.ComponentProps<typeof EscolhaNaCelula>> & { aoTrocar?: (v: string) => void }) {
    const { aoTrocar = () => {}, ...resto } = props
    return (
      <EscolhaNaCelula valor={<span>Em curso</span>} rotulo="Etapa" {...resto}>
        <GrupoDeEscolhaDoMenu valor="curso" onTrocar={aoTrocar}>
          <ItemDeEscolhaDoMenu valor="curso">Em curso</ItemDeEscolhaDoMenu>
          <ItemDeEscolhaDoMenu valor="feito">Feito</ItemDeEscolhaDoMenu>
        </GrupoDeEscolhaDoMenu>
      </EscolhaNaCelula>
    )
  }

  it('o gatilho quieto diz o que se escolhe, com o chevron de 14px, e a escolha é a ação', () => {
    const aoTrocar = vi.fn()
    render(<Celula aoTrocar={aoTrocar} />)
    const gatilho = screen.getByRole('button', { name: /^Etapa:\s*Em curso$/ })
    // A linha da tabela acende em `accent`: o gatilho soma tinta por cima, para se ver sobre ela.
    expect(gatilho.className).toContain('hover:bg-foreground/[0.07]')
    expect(gatilho.className).not.toContain('hover:bg-accent')
    expect(gatilho.className).not.toMatch(/(^|\s)(border|anel-de-controle|bg-card)(\s|$)/)
    expect(gatilho.querySelector('svg')?.getAttribute('class')).toContain('size-3.5')
    fireEvent.keyDown(gatilho, { key: 'Enter' })
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Feito' }))
    expect(aoTrocar).toHaveBeenCalledWith('feito')
  })

  it('gravando: aria-busy e inerte; recusado: Não mudou e Tentar de novo', () => {
    const tentar = vi.fn()
    const { rerender } = render(<Celula gravando />)
    const gatilho = screen.getByRole('button', { name: /^Etapa:\s*Em curso$/ })
    expect(gatilho.getAttribute('aria-busy')).toBe('true')
    fireEvent.keyDown(gatilho, { key: 'Enter' })
    expect(screen.queryByRole('menu')).toBeNull()
    rerender(<Celula recusado aoTentarDeNovo={tentar} />)
    expect(screen.getByRole('alert').textContent).toContain('Não mudou.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(tentar).toHaveBeenCalled()
  })

  it('sem permissão, só a leitura, sem subir de camada', () => {
    render(
      <Table>
        <tbody>
          <TableRow>
            <TableCell>
              <LinkDaLinha href="/x">Pedido</LinkDaLinha>
            </TableCell>
            <TableCell>
              <Celula editavel={false} />
            </TableCell>
          </TableRow>
        </tbody>
      </Table>
    )
    expect(screen.queryByRole('button')).toBeNull()
    // Só a leitura não sobe de camada: não deixa área morta sobre o link da linha.
    expect(document.querySelector('[data-slot=escolha-na-celula]')!.className).not.toContain('z-[1]')
  })

  it('editável, a célula pinta por cima do link da linha', () => {
    render(<Celula />)
    const celula = document.querySelector('[data-slot=escolha-na-celula]')!
    expect(celula.className).toContain('relative')
    expect(celula.className).toContain('z-[1]')
  })

  it('popover: o formulário e o Salvar, que grava e fecha', () => {
    const salvar = vi.fn()
    render(
      <EscolhaNaCelula valor={<span>24 jul</span>} rotulo="Prazo" variante="popover" aoSalvar={salvar}>
        <input aria-label="Nova data" />
      </EscolhaNaCelula>
    )
    fireEvent.click(screen.getByRole('button', { name: /^Prazo:\s*24 jul$/ }))
    expect(screen.getByLabelText('Nova data')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(salvar).toHaveBeenCalled()
    expect(screen.queryByLabelText('Nova data')).toBeNull()
  })
})

describe('Prazo — o dia fora do navegador', () => {
  it('texto com hora e sem fuso é hora de São Paulo; hoje inválido cai no agora', () => {
    const hoje = new Date('2026-07-12T15:00:00-03:00')
    render(<Prazo periodo="2026-07-13T00:00:00" hoje={hoje} />)
    expect(screen.getByText('13 jul')).toBeTruthy()
    expect(screen.getByText('amanhã')).toBeTruthy()
    expect(() => render(<Prazo periodo="2026-07-13" hoje={new Date('x')} />)).not.toThrow()
  })
})
