import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { EscolhaNaCelula } from '@/registry/wicomm/ui/escolha-na-celula'
import { LinhaDoGrupo } from '@/registry/wicomm/ui/linha-do-grupo'
import { GrupoDeEscolhaDoMenu, ItemDeEscolhaDoMenu } from '@/registry/wicomm/ui/menu'
import { Monograma, MonogramaAusente, iniciais } from '@/registry/wicomm/ui/monograma'
import { Pessoa, PilhaDePessoas } from '@/registry/wicomm/ui/pessoa'
import { Prazo } from '@/registry/wicomm/ui/prazo'
import { LinkDaLinha, Table, TableCell, TableHead, TableRow } from '@/registry/wicomm/ui/table'

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
    // Um degrau acima da linha de 40px: 48px no instrumento.
    expect(degrau.className).toContain('h-12')
  })

  it('concluído troca a barra pelo carimbo ok; site tem 56px', () => {
    render(<Grupo progresso concluido densidade="site" />)
    expect(document.querySelector('[data-slot=trilha-do-progresso]')).toBeNull()
    expect(screen.getByText('Concluído').dataset.tom).toBe('ok')
    expect((screen.getByRole('rowheader').firstElementChild as HTMLElement).className).toContain('h-14')
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

  it('as barras começam no mesmo x: o nome cede, e a contagem e a trilha encostam no fim em lugar fixo', () => {
    render(<Grupo progresso />)
    const degrau = screen.getByRole('rowheader').firstElementChild as HTMLElement
    const fim = degrau.querySelector('[data-slot=fim-da-linha-do-grupo]') as HTMLElement
    expect(fim.parentElement).toBe(degrau)
    expect(fim.className).toContain('@container')
    expect(fim.firstElementChild!.textContent).toBe('1 de 2')
    const lugar = fim.querySelector('[data-slot=lugar-da-trilha]') as HTMLElement
    expect(lugar.className).toMatch(/(^|\s)w-24(\s|$)/)
    // Sem medida, a trilha cede quando sobram menos de 10rem no fim do th; o nome tem piso.
    expect(lugar.className).toContain('@max-[10rem]:hidden')
    expect(screen.getByText('Descoberta').className).toContain('min-w-20')
  })

  it('o grupo sem linhas guarda o lugar da trilha; o carimbo do concluído mora nele', () => {
    const { unmount } = render(<Grupo progresso linhas={[]} contagem={{ feitas: 0, total: 0 }} />)
    expect((document.querySelector('[data-slot=lugar-da-trilha]') as HTMLElement).children).toHaveLength(0)
    unmount()
    render(<Grupo progresso concluido />)
    const carimbo = screen.getByText('Concluído').parentElement!
    expect(carimbo.className).toMatch(/(^|\s)w-24(\s|$)/)
    expect(carimbo.className).toContain('@max-[10rem]:hidden')
  })

  it('a célula sob a coluna que some no celular esvazia sem transbordar, e o raio passa à última que fica', () => {
    render(
      <Grupo
        colunas={4}
        celulas={['Ana', { conteudo: '24 jul', esconderNoCelular: true }]}
        acao={{ conteudo: <button type="button">Ações</button>, esconderNoCelular: true }}
      />
    )
    const [, pessoa, prazo, acao] = [...screen.getByRole('rowheader').parentElement!.children] as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ]
    expect(prazo.className).toContain('max-sm:[&>div]:hidden')
    expect(acao.className).toContain('max-sm:[&>div]:hidden')
    expect(pessoa.className).not.toContain('hidden')
    expect((pessoa.firstElementChild as HTMLElement).className).toContain('max-sm:rounded-r-xl')
    expect((acao.firstElementChild as HTMLElement).className).toContain('rounded-r-xl')
    expect(screen.getByText('24 jul')).toBeTruthy()
  })

  it('SUP-03: a célula guarda o ar e cresce com o conteúdo; o hover acende as células com o raio do foco, sem filete nem zebra', () => {
    render(
      <Table>
        <tbody>
          <TableRow>
            <TableCell>Briefing</TableCell>
            <TableCell>Ana</TableCell>
          </TableRow>
        </tbody>
      </Table>
    )
    const celula = screen.getByText('Briefing')
    expect(celula.className).toContain('h-10')
    expect(celula.className).toContain('py-1.5')
    expect(celula.className).toContain('first:rounded-l-md')
    expect(celula.className).toContain('last:rounded-r-md')
    const linha = celula.parentElement!
    expect(linha.className).toContain('[tbody_&]:hover:[&>td]:bg-accent')
    expect(linha.className).not.toMatch(/(^|\s)border|odd:|even:/)
    expect(linha.closest('table')!.className).toContain('border-separate')
  })

  it('a coluna que some no celular é prop da Table: largura zero, não hidden', () => {
    render(
      <Table>
        <thead>
          <TableRow>
            <TableHead>Tarefa</TableHead>
            <TableHead esconderNoCelular>Responsável</TableHead>
          </TableRow>
        </thead>
        <tbody>
          <TableRow>
            <TableCell>Briefing</TableCell>
            <TableCell esconderNoCelular>Ana</TableCell>
          </TableRow>
        </tbody>
      </Table>
    )
    for (const el of [screen.getByText('Responsável'), screen.getByText('Ana')]) {
      expect(el.className).toContain('max-sm:w-0')
      expect(el.className).toContain('max-sm:invisible')
      expect(el.className).not.toMatch(/max-sm:hidden/)
    }
    expect(screen.getByText('Briefing').className).not.toContain('max-sm:w-0')
    // A última que fica no celular leva o raio do hover; a escondida, não.
    expect(screen.getByText('Ana').dataset.someNoCelular).toBe('true')
    expect(screen.getByText('Briefing').matches(':not(:has(~td:not([data-some-no-celular])))')).toBe(true)
    expect(screen.getByText('Briefing').className).toContain('max-sm:[&:not(:has(~td:not([data-some-no-celular])))]:rounded-r-md')
  })

  it('o vão antes do grupo (menos no primeiro) é maior que o ar depois do topo, e os dois são da peça', () => {
    render(<Grupo />)
    const th = screen.getByRole('rowheader')
    expect(th.className).toContain('[tbody:not(:first-of-type)_&]:pt-4')
    expect(th.className).toContain('pb-1')
  })

  it('Pessoa e Prazo dentro de uma Table site medem por ela, sem repetir a prop', () => {
    render(
      <Table densidade="site">
        <tbody>
          <TableRow>
            <TableCell>
              <Pessoa pessoa={{ nome: 'Ana Souza' }} />
            </TableCell>
            <TableCell>
              <Prazo periodo="2026-07-24" hoje={new Date('2026-07-12T15:00:00-03:00')} />
            </TableCell>
          </TableRow>
        </tbody>
      </Table>
    )
    expect(screen.getByText('Ana Souza').className).toContain('text-sm')
    expect(screen.getByText('24 jul').className).toContain('text-sm')
  })

  it('a densidade vem da Table: degrau, vão e nome do site sem repetir a prop', () => {
    render(
      <Table densidade="site">
        <LinhaDoGrupo nome="Descoberta" colunas={1}>
          <TableRow>
            <TableCell>Briefing</TableCell>
          </TableRow>
        </LinhaDoGrupo>
      </Table>
    )
    const th = screen.getByRole('rowheader')
    expect((th.firstElementChild as HTMLElement).className).toContain('h-14')
    expect(th.className).toContain('[tbody:not(:first-of-type)_&]:pt-6')
    expect(screen.getByText('Descoberta').className).toContain('t-titulo')
    expect(screen.getByText('Briefing').className).toContain('text-sm')
  })

  it('as linhas recuam até o nome do grupo, a linha acesa começa no recuo, e o cabeçalho recua junto', () => {
    render(<Grupo />)
    const tbody = screen.getByRole('rowheader').closest('tbody')!
    // 20px de borda transparente + os 12px da célula = 32px, o x do nome do grupo; o fundo do hover fica dentro.
    expect(tbody.className).toContain('[&>tr[data-slot=table-row]>td:first-child]:border-l-[20px]')
    expect(tbody.className).toContain('[&>tr[data-slot=table-row]>td:first-child]:bg-clip-padding')
    expect(tbody.className).toContain('[&_[data-slot=link-da-linha]]:after:left-5')
    expect(tbody.closest('table')!.className).toContain('[&:has(>[data-slot=linha-do-grupo])>thead>tr>th:first-child]:pl-8')
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

  it('o intervalo de um dia só escreve o dia uma vez', () => {
    render(<Prazo periodo={{ inicio: '2026-07-27', fim: '2026-07-27T18:00:00' }} hoje={hoje} />)
    expect(screen.getByText('27 jul')).toBeTruthy()
    expect(screen.queryByText(/→/)).toBeNull()
  })

  it('relativo={false}: só a data, sem legenda e sem voz', () => {
    // @ts-expect-error — sem legenda não há onde pintar: o tipo recusa o tom.
    void (<Prazo periodo="2026-02-04" tom="ruim" relativo={false} />)
    render(<Prazo periodo="2026-02-04" relativo={false} hoje={hoje} />)
    const prazo = document.querySelector('[data-slot=prazo]')!
    expect(prazo.children).toHaveLength(1)
    expect(prazo.textContent).toBe('4 fev')
    expect(prazo.hasAttribute('data-tom')).toBe(false)
    expect(screen.queryByText(/venceu/)).toBeNull()
  })

  it('emLinha: a legenda ao lado da data', () => {
    render(<Prazo periodo="2026-07-24" emLinha hoje={hoje} />)
    const prazo = document.querySelector('[data-slot=prazo]')!
    expect(prazo.className).toContain('flex-row')
    expect(prazo.className).not.toContain('flex-col')
    expect(prazo.textContent).toBe('24 julem 12 dias')
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
  type DeTeste = Partial<Omit<React.ComponentProps<typeof EscolhaNaCelula>, 'valor'>>

  function Celula(props: DeTeste & { aoTrocar?: (v: string) => void }) {
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

  function DataNaCelula(props: DeTeste) {
    return (
      <EscolhaNaCelula valor={<span>24 jul</span>} rotulo="Prazo" variante="popover" {...props}>
        <input aria-label="Nova data" />
      </EscolhaNaCelula>
    )
  }
  const abrir = () => fireEvent.click(screen.getByRole('button', { name: /^Prazo:\s*24 jul$/ }))

  it('popover: os campos num form, e o Salvar grava e fecha', () => {
    const salvar = vi.fn()
    render(<DataNaCelula aoSalvar={salvar} />)
    abrir()
    expect(screen.getByLabelText('Nova data').closest('form')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(salvar).toHaveBeenCalled()
    expect(screen.queryByLabelText('Nova data')).toBeNull()
  })

  it('popover: o Enter grava (submit do form); o aoSalvar que devolve false deixa aberto', () => {
    const salvar = vi.fn(() => false as const)
    render(<DataNaCelula aoSalvar={salvar} />)
    abrir()
    fireEvent.submit(screen.getByLabelText('Nova data').closest('form')!)
    expect(salvar).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Nova data')).toBeTruthy()
  })

  it('popover: o submit não sobe ao form da tela (o portal não corta o evento do React)', () => {
    const salvar = vi.fn()
    const daTela = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={daTela}>
        <DataNaCelula aoSalvar={salvar} />
      </form>
    )
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(salvar).toHaveBeenCalledTimes(1)
    expect(daTela).not.toHaveBeenCalled()
  })

  it('popover: o Cancelar fecha sem gravar', () => {
    const salvar = vi.fn()
    render(<DataNaCelula aoSalvar={salvar} />)
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(salvar).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Nova data')).toBeNull()
  })

  it('popover: com motivo, a frase fica à vista no formulário, o Salvar desabilitado aponta para ela, e o Enter não grava', () => {
    const salvar = vi.fn()
    render(<DataNaCelula aoSalvar={salvar} motivoParaNaoSalvar="O término vem antes do início." />)
    abrir()
    const botao = screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement
    expect(botao.disabled).toBe(true)
    const frase = screen.getByText('O término vem antes do início.')
    expect(frase.closest('form')).toBeTruthy()
    expect(botao.getAttribute('aria-describedby')).toBe(frase.id)
    fireEvent.submit(screen.getByLabelText('Nova data').closest('form')!)
    expect(salvar).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Nova data')).toBeTruthy()
  })

  it('sem valor, o tipo recusa o nulo: a célula mostra a leitura vazia da peça', () => {
    const quem: string | null = null
    // @ts-expect-error — o chevron sozinho não diz nada à vista (EST-02).
    void (<EscolhaNaCelula rotulo="Responsável" valor={quem}>{null}</EscolhaNaCelula>)
    const ok = false as boolean
    // @ts-expect-error — `cond && <X/>` também vira o chevron sozinho.
    void (<EscolhaNaCelula rotulo="Responsável" valor={ok && <span />}>{null}</EscolhaNaCelula>)
    void (<EscolhaNaCelula rotulo="Prazo" variante="popover" aoSalvar={async () => {}} valor="24 jul">{null}</EscolhaNaCelula>)
    render(
      <EscolhaNaCelula rotulo="Prazo" valor={<Prazo periodo={null} />}>
        {null}
      </EscolhaNaCelula>
    )
    expect(screen.getByRole('button', { name: /^Prazo:\s*Sem data$/ })).toBeTruthy()
  })

  it('o aberto se lê no aria-expanded, e a peça repassa o ref ao gatilho', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<DataNaCelula ref={ref} />)
    expect(ref.current?.dataset.slot).toBe('gatilho-da-escolha')
    expect(ref.current?.className).toContain('aria-expanded:bg-foreground/[0.07]')
    expect(ref.current?.className).not.toContain('data-[state=open]')
    abrir()
    expect(ref.current?.getAttribute('aria-expanded')).toBe('true')
  })

  it('a frase da recusa é de quem chama', () => {
    render(<Celula recusado rotuloDaRecusa="Não mudou na origem." />)
    expect(screen.getByRole('alert').textContent).toContain('Não mudou na origem.')
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
