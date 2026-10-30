import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useConfirm } from '@/registry/wicomm/ui/confirm-dialog'

let resposta: Promise<boolean> | null = null

function Chamador() {
  const [dialogo, pedir, definirPodeConfirmar] = useConfirm()
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          resposta = pedir({
            devolverFoco: e.currentTarget,
            titulo: 'Publicar agora?',
            descricao: 'Vai ao ar.',
            corpo: (
              <div>
                <p>lista longa</p>
                <button type="button" onClick={() => definirPodeConfirmar(false)}>
                  travar
                </button>
              </div>
            ),
            confirmar: 'Publicar agora',
          })
        }}
      >
        abrir
      </button>
      {dialogo}
    </>
  )
}

describe('useConfirm em janela baixa', () => {
  it('o corpo rola dentro do diálogo e os botões moram no rodapé fixo', async () => {
    render(<Chamador />)
    fireEvent.click(screen.getByText('abrir'))
    const corpo = await waitFor(() => {
      const el = document.querySelector('[data-slot=corpo-do-dialogo]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    const rodape = document.querySelector('[data-slot=rodape-do-dialogo]') as HTMLElement
    expect(rodape).not.toBeNull()
    expect(corpo.textContent).toContain('lista longa')
    expect(corpo.className).toContain('overflow-y-auto')
    expect(corpo.contains(screen.getByText('Cancelar'))).toBe(false)
    expect(rodape.contains(screen.getByText('Cancelar'))).toBe(true)
    expect(rodape.contains(screen.getByText('Publicar agora'))).toBe(true)
    expect(screen.getByRole('dialog').className).toContain('max-h-[85vh]')
  })

  it('o campo travado desabilita o confirmar, e cancelar resolve false', async () => {
    render(<Chamador />)
    fireEvent.click(screen.getByText('abrir'))
    await screen.findByText('Publicar agora')
    fireEvent.click(screen.getByText('travar'))
    expect((screen.getByText('Publicar agora') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => {
      fireEvent.click(screen.getByText('Cancelar'))
    })
    await expect(resposta).resolves.toBe(false)
  })

  it('o Esc resolve false e o foco volta ao gatilho', async () => {
    render(<Chamador />)
    const gatilho = screen.getByText('abrir')
    gatilho.focus()
    fireEvent.click(gatilho)
    const dialogo = await screen.findByRole('dialog')
    expect(dialogo).not.toBeNull()
    await act(async () => {
      fireEvent.keyDown(dialogo, { key: 'Escape', code: 'Escape' })
    })
    await expect(resposta).resolves.toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(gatilho))
  })
})

describe('useConfirm: destrutivo e alternativa', () => {
  function Pedido({ opcoes }: { opcoes: Parameters<ReturnType<typeof useConfirm>[1]>[0] }) {
    const [dialogo, pedir] = useConfirm()
    return (
      <>
        <button type="button" onClick={() => (resposta = pedir(opcoes))}>
          abrir
        </button>
        {dialogo}
      </>
    )
  }

  it('o destrutivo confirma com o botão em contorno, nunca preenchido (MARCA-05)', async () => {
    render(<Pedido opcoes={{ titulo: 'Excluir?', confirmar: 'Excluir', destrutivo: true }} />)
    fireEvent.click(screen.getByText('abrir'))
    const excluir = await screen.findByRole('button', { name: 'Excluir' })
    expect(excluir.className).toContain('text-destructive')
    expect(excluir.className).not.toMatch(/(^|\s)bg-destructive(\s|$)/)
    await act(async () => {
      fireEvent.click(excluir)
    })
    await expect(resposta).resolves.toBe(true)
  })

  it('a alternativa roda o gesto dela e resolve false', async () => {
    let arquivou = 0
    render(
      <Pedido
        opcoes={{ titulo: 'Excluir?', destrutivo: true, alternativa: { rotulo: 'Arquivar em vez disso', onEscolher: () => arquivou++ } }}
      />
    )
    fireEvent.click(screen.getByText('abrir'))
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Arquivar em vez disso' }))
    })
    await expect(resposta).resolves.toBe(false)
    expect(arquivou).toBe(1)
  })
})
