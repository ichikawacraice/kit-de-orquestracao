import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { EscolhaNaCelula } from '@/registry/design-system/ui/escolha-na-celula'
import { IntervaloDeCampos } from '@/registry/design-system/ui/intervalo-de-campos'
import { Label } from '@/registry/design-system/ui/label'
import { EsperaDosGrupos, LinhaDoGrupo } from '@/registry/design-system/ui/linha-do-grupo'
import { Popover, PopoverContent, PopoverTrigger } from '@/registry/design-system/ui/popover'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/registry/design-system/ui/table'

const classes = (el: Element) => el.className.split(/\s+/)

function Aberto(props: React.ComponentProps<typeof PopoverContent>) {
  return (
    <Popover open>
      <PopoverTrigger>Abrir</PopoverTrigger>
      <PopoverContent aria-label="Detalhe" {...props}>
        conteúdo
      </PopoverContent>
    </Popover>
  )
}
const conteudo = () => document.querySelector('[data-slot=popover-content]') as HTMLElement

describe('K1 · a largura do Popover', () => {
  it('sem largura é w-72, com o teto pela janela e o corte lateral', () => {
    render(<Aberto />)
    const c = classes(conteudo())
    expect(c).toContain('w-72')
    expect(c).toContain('max-w-(--radix-popover-content-available-width)')
    expect(c).toContain('overflow-x-hidden')
  })

  it('larga é w-80 e conteudo é w-auto, nenhuma com o w-72 do padrão', () => {
    const { unmount } = render(<Aberto largura="larga" />)
    expect(classes(conteudo())).toContain('w-80')
    expect(classes(conteudo())).not.toContain('w-72')
    expect(classes(conteudo())).toContain('max-w-(--radix-popover-content-available-width)')
    unmount()
    render(<Aberto largura="conteudo" />)
    expect(classes(conteudo())).toContain('w-auto')
    expect(classes(conteudo())).not.toContain('w-72')
  })

  it('a EscolhaNaCelula abre o popover na largura do conteúdo', () => {
    render(
      <EscolhaNaCelula valor={<span>24 jul</span>} rotulo="Prazo" variante="popover" aoSalvar={() => {}}>
        <input aria-label="Nova data" />
      </EscolhaNaCelula>
    )
    fireEvent.click(screen.getByRole('button', { name: /^Prazo:\s*24 jul$/ }))
    expect(classes(conteudo())).toContain('w-auto')
    expect(classes(conteudo())).not.toContain('w-72')
  })
})

describe('K2 · o Label em três vozes', () => {
  it('coluna troca a classe, não empilha', () => {
    render(
      <>
        <Label>Rótulo</Label>
        <Label voz="coluna">Coluna</Label>
      </>
    )
    expect(classes(screen.getByText('Rótulo'))).toContain('t-rotulo')
    const coluna = classes(screen.getByText('Coluna'))
    expect(coluna).toContain('t-coluna')
    expect(coluna).not.toContain('t-rotulo')
  })
})

describe('K2 · IntervaloDeCampos', () => {
  const vazio = { de: '', ate: '' }

  it('vazio: o grupo pela legenda, cada campo pelo seu rótulo, sem limite cruzado', () => {
    render(<IntervaloDeCampos legenda="Prazo" tipo="date" valor={vazio} aoMudar={() => {}} />)
    const grupo = screen.getByRole('group', { name: 'Prazo' })
    expect(grupo.tagName).toBe('FIELDSET')
    expect(classes(grupo)).toContain('min-w-0')
    const de = within(grupo).getByLabelText('De') as HTMLInputElement
    const ate = within(grupo).getByLabelText('Até') as HTMLInputElement
    expect(de.type).toBe('date')
    expect(ate.type).toBe('date')
    expect(de.hasAttribute('max')).toBe(false)
    expect(ate.hasAttribute('min')).toBe(false)
  })

  it('um lado preenchido amarra o outro; sem ele, valem os limites de fora', () => {
    const { rerender } = render(
      <IntervaloDeCampos legenda="Prazo" tipo="date" valor={{ de: '2026-11-02', ate: '' }} aoMudar={() => {}} />
    )
    expect(screen.getByLabelText('Até').getAttribute('min')).toBe('2026-11-02')
    rerender(<IntervaloDeCampos legenda="Prazo" tipo="date" valor={{ de: '', ate: '2026-12-31' }} aoMudar={() => {}} />)
    expect(screen.getByLabelText('De').getAttribute('max')).toBe('2026-12-31')
    rerender(
      <IntervaloDeCampos legenda="Prazo" tipo="date" valor={vazio} min="2026-01-01" max="2026-12-31" aoMudar={() => {}} />
    )
    expect(screen.getByLabelText('Até').getAttribute('min')).toBe('2026-01-01')
    expect(screen.getByLabelText('De').getAttribute('max')).toBe('2026-12-31')
  })

  it('os rótulos se trocam', () => {
    render(
      <IntervaloDeCampos
        legenda="Prazo"
        tipo="date"
        valor={vazio}
        aoMudar={() => {}}
        rotulos={{ de: 'Início', ate: 'Término' }}
      />
    )
    expect(screen.getByLabelText('Início')).toBeTruthy()
    expect(screen.getByLabelText('Término')).toBeTruthy()
    expect(screen.queryByLabelText('De')).toBeNull()
  })

  it('o erro de um lado: aria-invalid e a frase abaixo do campo; sem texto, nenhuma linha', () => {
    const { rerender } = render(
      <IntervaloDeCampos
        legenda="Prazo"
        tipo="date"
        valor={vazio}
        aoMudar={() => {}}
        erro={{ lado: 'ate', texto: 'A data final vem antes da inicial' }}
      />
    )
    const ate = screen.getByLabelText('Até')
    expect(ate.getAttribute('aria-invalid')).toBe('true')
    const frase = screen.getByText('A data final vem antes da inicial')
    expect(frase.tagName).toBe('P')
    expect(ate.getAttribute('aria-describedby')).toBe(frase.id)
    expect(frase.className).toContain('text-rose-700')
    expect(screen.getByLabelText('De').hasAttribute('aria-invalid')).toBe(false)
    rerender(<IntervaloDeCampos legenda="Prazo" tipo="date" valor={vazio} aoMudar={() => {}} erro={{ lado: 'de' }} />)
    expect(screen.getByLabelText('De').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('group').querySelector('p')).toBeNull()
  })

  it('aoMudar recebe o lado e o valor', () => {
    const mudar = vi.fn()
    render(<IntervaloDeCampos legenda="Valor (R$)" tipo="number" valor={vazio} aoMudar={mudar} />)
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '120' } })
    expect(mudar).toHaveBeenCalledWith('ate', '120')
  })

  it('as vozes: instrumento t-rotulo + t-coluna; site t-campo + t-campo; a densidade vem da Table', () => {
    const legenda = () => screen.getByRole('group').querySelector('legend') as HTMLElement
    const { unmount } = render(<IntervaloDeCampos legenda="Prazo" tipo="date" valor={vazio} aoMudar={() => {}} />)
    expect(classes(legenda())).toContain('t-rotulo')
    expect(classes(screen.getByText('De'))).toContain('t-coluna')
    unmount()
    const r = render(
      <IntervaloDeCampos legenda="Prazo" tipo="date" valor={vazio} aoMudar={() => {}} densidade="site" />
    )
    expect(classes(legenda())).toContain('t-campo')
    expect(classes(legenda())).not.toContain('t-rotulo')
    expect(classes(screen.getByText('De'))).toContain('t-campo')
    r.unmount()
    render(
      <Table densidade="site">
        <tbody>
          <tr>
            <td>
              <IntervaloDeCampos legenda="Prazo" tipo="date" valor={vazio} aoMudar={() => {}} />
            </td>
          </tr>
        </tbody>
      </Table>
    )
    expect(classes(legenda())).toContain('t-campo')
  })
})

function Grupo(props: Partial<React.ComponentProps<typeof LinhaDoGrupo>> & { linhas?: string[] }) {
  const { linhas = ['Entrega A'], ...resto } = props
  return (
    <Table>
      <LinhaDoGrupo nome="2 a 8 de nov" colunas={2} {...resto}>
        {linhas.map((l) => (
          <TableRow key={l}>
            <TableCell>{l}</TableCell>
            <TableCell />
          </TableRow>
        ))}
      </LinhaDoGrupo>
    </Table>
  )
}
const unidade = { um: 'entrega', varios: 'entregas' }
const fim = () => document.querySelector('[data-slot=fim-da-linha-do-grupo]') as HTMLElement

describe('K3 · a contagem da LinhaDoGrupo', () => {
  it('a quantidade com unidade: o número em t-medida, a palavra no singular e no plural', () => {
    const { unmount } = render(<Grupo contagem={{ total: 3, unidade }} />)
    expect(fim().textContent).toBe('3 entregas')
    expect(classes(screen.getByText('3'))).toContain('t-medida')
    unmount()
    render(<Grupo contagem={{ total: 1, unidade }} />)
    expect(fim().textContent).toBe('1 entrega')
  })

  it('a quantidade não tem trilha, mesmo com progresso (a fração tem)', () => {
    const { unmount } = render(<Grupo progresso contagem={{ feitas: 1, total: 2 }} />)
    expect(document.querySelector('[data-slot=trilha-do-progresso]')).toBeTruthy()
    unmount()
    render(<Grupo progresso contagem={{ total: 2, unidade }} />)
    expect(document.querySelector('[data-slot=trilha-do-progresso]')).toBeNull()
    expect(document.querySelector('[data-slot=lugar-da-trilha]')).toBeNull()
  })

  it('com total e sem linhas, a contagem fica (o total é de quem chama)', () => {
    render(<Grupo linhas={[]} contagem={{ total: 3, unidade }} />)
    expect(fim().textContent).toBe('3 entregas')
    expect(screen.queryByText('Sem linhas')).toBeNull()
  })

  it('vazio sem contagem diz o semLinhas, e o de quem chama quando passado', () => {
    const { unmount } = render(<Grupo linhas={[]} />)
    expect(screen.getByText('Sem linhas').className).toContain('t-denso')
    expect(within(screen.getByRole('rowheader')).queryByRole('button')).toBeNull()
    unmount()
    render(<Grupo linhas={[]} semLinhas="Nenhuma entrega" />)
    expect(fim().textContent).toBe('Nenhuma entrega')
  })

  it('com linhas e sem contagem, nada no fim', () => {
    render(<Grupo />)
    expect(screen.getByText('Entrega A')).toBeTruthy()
    expect(fim().textContent).toBe('')
  })
})

describe('K5 · EsperaDosGrupos', () => {
  it('declara a espera, um degrau por grupo e as linhas de cada um', () => {
    render(<EsperaDosGrupos grupos={[2, 1]} alturaDaLinha="h-10" rotulo="Carregando as entregas" />)
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.textContent).toContain('Carregando as entregas')
    expect(status.querySelectorAll('[data-slot=espera-do-degrau]')).toHaveLength(2)
    expect(status.querySelectorAll('[data-slot=espera-da-linha]')).toHaveLength(3)
    expect(status.querySelector('[data-slot=espera-do-cabecalho]')).toBeTruthy()
  })

  it('sem cabecalho, sem a faixa da régua', () => {
    render(<EsperaDosGrupos cabecalho={false} alturaDaLinha="h-10" rotulo="Carregando" />)
    expect(screen.getByRole('status').querySelector('[data-slot=espera-do-cabecalho]')).toBeNull()
    expect(screen.getByRole('status').querySelectorAll('[data-slot=espera-do-degrau]')).toHaveLength(3)
  })

  // As duas coisas que devem concordar: o degrau, o ar, o recuo e o vão da espera são os da peça real.
  it.each(['instrumento', 'site'] as const)('as medidas da espera são as da LinhaDoGrupo (%s)', (densidade) => {
    const real = render(
      <Table densidade={densidade}>
        <TableHeader>
          <TableRow>
            <TableHead>Entrega</TableHead>
          </TableRow>
        </TableHeader>
        <LinhaDoGrupo nome="A" colunas={1}>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </LinhaDoGrupo>
      </Table>
    )
    const th = screen.getByRole('rowheader')
    const doTh = (prefixo: string) => classes(th).find((c) => c.startsWith(prefixo))?.slice(prefixo.length)
    const medidasReais = {
      degrau: classes(th.firstElementChild!).find((c) => c.startsWith('min-h-')),
      primeiro: doTh('[thead+tbody_&]:'),
      vao: doTh('[tbody[data-aberto=true]+tbody_&]:'),
      ar: doTh('[tbody[data-aberto=true]_&]:'),
      recuo: classes(th.closest('tbody')!)
        .find((c) => c.startsWith('[&>tr[data-slot=table-row]>td:first-child]:border-l-['))
        ?.match(/\[(\d+px)\]$/)?.[1],
    }
    // Antes de comparar: as medidas existem e não são vazias.
    for (const v of Object.values(medidasReais)) expect(v).toBeTruthy()
    real.unmount()

    render(<EsperaDosGrupos densidade={densidade} grupos={[1, 1]} alturaDaLinha="h-10" rotulo="Carregando" />)
    const status = screen.getByRole('status')
    const [g1, g2] = [...status.querySelectorAll('[data-slot=espera-do-grupo]')]
    const degrau = g1!.querySelector('[data-slot=espera-do-degrau]')!
    const topo = degrau.parentElement!
    const linha = g1!.querySelector('[data-slot=espera-da-linha]')!
    expect({
      degrau: classes(degrau).find((c) => c.startsWith('min-h-')),
      primeiro: classes(g1!).find((c) => c.startsWith('pt-'))?.slice(0),
      vao: classes(g2!).find((c) => c.startsWith('pt-')),
      ar: classes(topo).find((c) => c.startsWith('pb-')),
      recuo: classes(linha).find((c) => c.startsWith('ml-['))?.match(/\[(\d+px)\]$/)?.[1],
    }).toEqual(medidasReais)
    expect(classes(linha)).toContain('h-10')
  })
})
