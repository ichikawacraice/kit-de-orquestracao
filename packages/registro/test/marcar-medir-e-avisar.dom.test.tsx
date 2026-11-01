import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { Badge } from '@/registry/wicomm/ui/badge'
import { CarregandoPorCima } from '@/registry/wicomm/ui/carregando-por-cima'
import { Checkbox, OpcaoDeMarcar } from '@/registry/wicomm/ui/checkbox'
import { Faixa } from '@/registry/wicomm/ui/faixa'
import { Medidor } from '@/registry/wicomm/ui/medidor'
import { Progress } from '@/registry/wicomm/ui/progress'

describe('Checkbox', () => {
  it('marca no clique, no raio de marcação, e o indeterminado é mixed', () => {
    const { rerender } = render(<Checkbox aria-label="Marcar pedido 1042" />)
    const caixa = screen.getByRole('checkbox', { name: 'Marcar pedido 1042' })
    expect(caixa.className).toContain('rounded-marcacao')
    expect(caixa.className).toContain('border-input')
    expect(caixa.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(caixa)
    expect(caixa.getAttribute('aria-checked')).toBe('true')
    rerender(<Checkbox aria-label="Marcar todos" checked="indeterminate" />)
    expect(screen.getByRole('checkbox', { name: 'Marcar todos' }).getAttribute('aria-checked')).toBe('mixed')
  })

  it('a OpcaoDeMarcar liga o rótulo e a descrição à caixa, e o clique no texto marca', () => {
    render(<OpcaoDeMarcar rotulo="Avisar o cliente por e-mail" descricao="Sai uma mensagem com o novo prazo." />)
    const caixa = screen.getByRole('checkbox', { name: 'Avisar o cliente por e-mail' })
    const descricao = document.getElementById(caixa.getAttribute('aria-describedby')!)
    expect(descricao?.textContent).toBe('Sai uma mensagem com o novo prazo.')
    fireEvent.click(screen.getByText('Avisar o cliente por e-mail'))
    expect(caixa.getAttribute('aria-checked')).toBe('true')
  })
})

describe('Progress', () => {
  it('escreve o valor, é progressbar com o texto, e o gradiente se revela pela fração', () => {
    render(<Progress value={3} max={8} rotulo="Arquivos enviados" />)
    const barra = screen.getByRole('progressbar', { name: 'Arquivos enviados' })
    expect(barra.getAttribute('aria-valuetext')).toBe('3 de 8')
    expect(screen.getByText('3 de 8').className).toContain('t-medida')
    const preenchimento = document.querySelector('[data-slot=preenchimento-do-progresso]') as HTMLElement
    expect(preenchimento.style.width).toBe('37.5%')
    expect(preenchimento.className).toContain('bg-primary-gradient')
  })

  it('valor fora do intervalo é preso; número que não é finito não desenha a barra', () => {
    const { rerender } = render(<Progress value={12} max={8} rotulo="Etapas" />)
    expect(screen.getByText('8 de 8')).not.toBeNull()
    rerender(<Progress value={Number.NaN} max={8} rotulo="Etapas" />)
    expect(document.querySelector('[data-slot=trilha-do-progresso]')).toBeNull()
    expect(document.body.textContent).not.toMatch(/0 de|NaN/)
  })
})

describe('Medidor', () => {
  it('é meter, a voz pinta só o número e a barra é neutra; o teto ultrapassado enche a barra', () => {
    render(<Medidor valor={230} teto={200} rotulo="Horas do projeto" tom="ruim" formatar={(n) => `${n} h`} />)
    const medidor = screen.getByRole('meter', { name: 'Horas do projeto' })
    expect(medidor.getAttribute('aria-valuetext')).toBe('230 h de 200 h')
    expect(medidor.getAttribute('aria-valuenow')).toBe('200')
    expect(screen.getByText('230 h').className).toContain('text-rose-700')
    const preenchimento = medidor.querySelector('[data-slot=preenchimento-do-progresso]') as HTMLElement
    expect(preenchimento.className).toContain('bg-muted-foreground')
    expect(preenchimento.style.width).toBe('100%')
  })

  it('valor que não carregou diz só "—", nunca NaN', () => {
    render(<Medidor valor={Number.NaN} teto={200} rotulo="Horas do projeto" formatar={(n) => `${n} h`} />)
    expect(document.body.textContent).not.toContain('NaN')
    expect(screen.queryByRole('meter')).toBeNull()
    expect(document.body.textContent).toContain('—')
  })

  it('sem teto diz "de —", sem barra e sem papel de meter', () => {
    render(<Medidor valor={120} teto={null} rotulo="Horas do projeto" />)
    expect(screen.queryByRole('meter')).toBeNull()
    expect(document.body.textContent).toContain('120 de —')
    expect(document.querySelector('[data-slot=trilha-do-progresso]')).toBeNull()
  })
})

describe('Badge', () => {
  it('usa o casco do carimbo; neutro por padrão, marca explícita com texto em tinta; vazio não desenha', () => {
    const { rerender, container } = render(<Badge>Plano anual</Badge>)
    const valor = screen.getByText('Plano anual')
    expect(valor.className).toContain('rounded-md')
    expect(valor.className).toContain('bg-foreground/[0.07]')
    rerender(<Badge variant="marca">Recomendado</Badge>)
    const marca = screen.getByText('Recomendado')
    expect(marca.className).toContain('bg-marca-tinta')
    expect(marca.className).toContain('text-foreground')
    expect(marca.className).not.toContain('text-primary')
    rerender(<Badge>{''}</Badge>)
    expect(container.textContent).toBe('')
  })
})

describe('CarregandoPorCima', () => {
  it('a região fica inerte na hora, o véu e a frase só depois de 120ms, e sai seco', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(
        <CarregandoPorCima ativo frase="Abrindo a versão">
          <button type="button">Publicar</button>
        </CarregandoPorCima>
      )
      expect(screen.getByText('Publicar').closest('[inert]')).not.toBeNull()
      expect(document.querySelector('[data-slot=veu-de-carregamento]')).toBeNull()
      expect(screen.getByRole('status').textContent).toBe('')
      act(() => {
        vi.advanceTimersByTime(120)
      })
      expect(document.querySelector('[data-slot=veu-de-carregamento]')).not.toBeNull()
      expect(screen.getByRole('status').textContent).toBe('Abrindo a versão')
      rerender(
        <CarregandoPorCima ativo={false} frase="Abrindo a versão">
          <button type="button">Publicar</button>
        </CarregandoPorCima>
      )
      expect(document.querySelector('[data-slot=veu-de-carregamento]')).toBeNull()
      expect(screen.getByText('Publicar').closest('[inert]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('troca mais rápida que 120ms não mostra nada nem anuncia', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(
        <CarregandoPorCima ativo frase="Abrindo a versão">
          <p>conteúdo</p>
        </CarregandoPorCima>
      )
      act(() => {
        vi.advanceTimersByTime(80)
      })
      rerender(
        <CarregandoPorCima ativo={false} frase="Abrindo a versão">
          <p>conteúdo</p>
        </CarregandoPorCima>
      )
      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(document.querySelector('[data-slot=veu-de-carregamento]')).toBeNull()
      expect(screen.getByRole('status').textContent).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('o véu não tem desfoque e não é camada fixa', () => {
    vi.useFakeTimers()
    try {
      render(
        <CarregandoPorCima ativo frase="Abrindo a versão">
          <p>conteúdo</p>
        </CarregandoPorCima>
      )
      act(() => {
        vi.advanceTimersByTime(120)
      })
      const veu = document.querySelector('[data-slot=veu-de-carregamento]') as HTMLElement
      expect(veu.className).toContain('absolute')
      expect(veu.className).not.toMatch(/fixed|backdrop-blur/)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Faixa', () => {
  it('uma faixa só, as linhas na ordem da MSG-06, alert no ruim e status no resto', () => {
    render(
      <Faixa
        linhas={[
          { assunto: 'escopo', tom: 'neutro', frase: 'Você está vendo só a sua equipe.' },
          { assunto: 'versao', tom: 'espera', frase: 'Esta versão não está no ar.', saida: <button type="button">Voltar à versão no ar</button> },
          { assunto: 'erro', tom: 'ruim', frase: 'Não deu para publicar.', saida: <button type="button">Publicar</button> },
        ]}
      />
    )
    expect(document.querySelectorAll('[data-slot=faixa]')).toHaveLength(1)
    const assuntos = [...document.querySelectorAll('[data-slot=linha-da-faixa]')].map((l) => l.getAttribute('data-assunto'))
    expect(assuntos).toEqual(['erro', 'versao', 'escopo'])
    expect(screen.getByRole('alert').textContent).toContain('Não deu para publicar.')
    expect(screen.getAllByRole('status')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Voltar à versão no ar' })).not.toBeNull()
  })

  it('assunto repetido vira uma linha só, a da voz mais grave', () => {
    render(
      <Faixa
        linhas={[
          { assunto: 'conexao', tom: 'alheio', frase: 'A equipe de finanças resolve.' },
          { assunto: 'conexao', tom: 'ruim', frase: 'A conexão caiu.', saida: <button type="button">Reconectar</button> },
        ]}
      />
    )
    expect(document.querySelectorAll('[data-slot=linha-da-faixa]')).toHaveLength(1)
    expect(screen.getByRole('alert').textContent).toContain('A conexão caiu.')
  })

  it('sem linhas não desenha; a linha mora na tinta do carimbo, sem contorno nem vidro', () => {
    const { container, rerender } = render(<Faixa linhas={[]} />)
    expect(container.innerHTML).toBe('')
    rerender(<Faixa linhas={[{ assunto: 'conexao', tom: 'alheio', frase: 'O serviço de pagamentos está fora; a equipe de finanças resolve.' }]} />)
    const linha = document.querySelector('[data-slot=linha-da-faixa]') as HTMLElement
    expect(linha.className).toContain('bg-violet-500/15')
    expect(linha.className).not.toMatch(/border|backdrop-blur/)
  })
})
