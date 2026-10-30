// O diálogo que bloqueia (DialogLongo `bloqueia`) e a conta de véus.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Dialog, DialogLateral, DialogLongo } from '@/registry/wicomm/ui/dialog'

/** O diálogo preso: sem saída por Esc, clique fora nem X, e a saída declarada no rodapé. */
function Preso({ aoMudar = () => {} }: { aoMudar?: (aberto: boolean) => void }) {
  return (
    <Dialog open onOpenChange={aoMudar}>
      <DialogLongo bloqueia largura="sm:max-w-lg" titulo="A sessão expirou" descricao="Entregue um novo." rodape={<button type="button">Sair da conta</button>}>
        <input aria-label="campo do corpo" />
      </DialogLongo>
    </Dialog>
  )
}

function Solto({ aoMudar = () => {} }: { aoMudar?: (aberto: boolean) => void }) {
  return (
    <Dialog open onOpenChange={aoMudar}>
      <DialogLongo largura="sm:max-w-lg" titulo="Um diálogo comum" descricao="Fecha por todos os caminhos.">
        <p>corpo</p>
      </DialogLongo>
    </Dialog>
  )
}

const overlays = () => [...document.querySelectorAll('[data-overlay]')]

/** O clique de verdade, inteiro: o jsdom não tem `PointerEvent`, e só o `pointerdown` sozinho não chega ao Radix. */
const clicar = (el: Element) => {
  fireEvent.pointerDown(el, { button: 0, ctrlKey: false })
  fireEvent.mouseDown(el, { button: 0 })
  fireEvent.mouseUp(el, { button: 0 })
  fireEvent.click(el, { button: 0 })
}

describe('DialogLongo com `bloqueia`', () => {
  it('o diálogo é um alertdialog modal', () => {
    render(<Preso />)
    const d = screen.getByRole('alertdialog')
    expect(d.getAttribute('aria-modal')).toBe('true')
  })

  it('o Esc não fecha (e no diálogo comum fecha: a guarda não é vazia)', () => {
    const preso = vi.fn()
    const { unmount } = render(<Preso aoMudar={preso} />)
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(preso).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    unmount()

    const solto = vi.fn()
    render(<Solto aoMudar={solto} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(solto).toHaveBeenCalledWith(false)
  })

  // O Radix só ouve o `pointerdown` de fora depois de um `setTimeout(0)`: sem esperar, o controle passaria por nada.
  const proximoTique = () => new Promise((r) => setTimeout(r, 20))

  it('o clique no overlay não fecha (e no diálogo comum fecha)', async () => {
    const preso = vi.fn()
    const { unmount } = render(<Preso aoMudar={preso} />)
    expect(overlays().length).toBe(1)
    await proximoTique()
    clicar(overlays()[0]!)
    expect(preso).not.toHaveBeenCalled()
    unmount()

    const solto = vi.fn()
    render(<Solto aoMudar={solto} />)
    await proximoTique()
    clicar(overlays()[0]!)
    expect(solto).toHaveBeenCalledWith(false)
  })

  it('não existe o botão fechar (e o diálogo comum o tem)', () => {
    const { unmount } = render(<Preso />)
    expect(screen.queryByRole('button', { name: /fechar/i })).toBeNull()
    unmount()
    render(<Solto />)
    expect(screen.getByRole('button', { name: /fechar/i })).toBeTruthy()
  })

  it('o rodapé com a saída está presente', () => {
    render(<Preso />)
    const rodape = document.querySelector('[data-slot="rodape-do-dialogo"]')
    expect(rodape).not.toBeNull()
    expect(rodape!.textContent).toContain('Sair da conta')
  })

  it('o foco começa dentro do diálogo', () => {
    render(<Preso />)
    const d = screen.getByRole('alertdialog')
    expect(d.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(document.body)
  })

  it('o cabeçalho usa pr-6, sem a folga do botão de fechar', () => {
    render(<Preso />)
    const cab = screen.getByRole('alertdialog').querySelector('header, [class*="px-6"]')
    expect(cab).not.toBeNull()
    expect(cab!.className).toContain('pr-6')
    expect(cab!.className).not.toContain('pr-14')
  })

  it('quem monta não sobrescreve as guardas de fechar', () => {
    const preso = vi.fn()
    render(
      <Dialog open onOpenChange={preso}>
        <DialogLongo
          bloqueia
          titulo="t"
          rodape={<button type="button">Sair</button>}
          onEscapeKeyDown={() => {}}
          onPointerDownOutside={() => {}}
          onInteractOutside={() => {}}
        >
          x
        </DialogLongo>
      </Dialog>,
    )
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    clicar(overlays()[0]!)
    expect(preso).not.toHaveBeenCalled()
  })

  it('o tipo exige o rodapé quando bloqueia', () => {
    // Só compila se a união discriminada recusar `bloqueia` sem `rodape`.
    const _naoRenderiza = () => (
      // @ts-expect-error — `bloqueia` sem `rodape` não compila
      <DialogLongo bloqueia titulo="t">x</DialogLongo>
    )
    expect(_naoRenderiza).toBeTypeOf('function')
  })
})

describe('a conta de overlays do `bloqueia`', () => {
  const proximoTique = () => new Promise((r) => setTimeout(r, 20))
  // A sessão expira com outro diálogo já aberto: o de baixo abre antes. Montar os dois no mesmo
  // commit faria o `aria-hidden` do primeiro esconder o segundo, o que não acontece de verdade.
  function Sobre({ base, baseAberta = true, bloqueiaAberto = true, aoMudarBase }: { base: 'longo' | 'lateral'; baseAberta?: boolean; bloqueiaAberto?: boolean; aoMudarBase?: (aberto: boolean) => void }) {
    return (
      <>
        {base === 'longo' ? (
          <Dialog open={baseAberta} onOpenChange={aoMudarBase}>
            <DialogLongo titulo="Agendar" largura="sm:max-w-lg">
              datas
            </DialogLongo>
          </Dialog>
        ) : (
          <Dialog open={baseAberta} modal={false}>
            <DialogLateral titulo="Mudanças">lista</DialogLateral>
          </Dialog>
        )}
        <Dialog open={bloqueiaAberto}>
          <DialogLongo bloqueia titulo="A sessão expirou" rodape={<button type="button">Sair</button>}>
            corpo
          </DialogLongo>
        </Dialog>
      </>
    )
  }

  it('sobre um DialogLongo comum, existe um overlay só (o de baixo)', async () => {
    const { rerender } = render(<Sobre base="longo" bloqueiaAberto={false} />)
    rerender(<Sobre base="longo" />)
    await waitFor(() => expect(screen.getAllByRole('alertdialog').length).toBe(1))
    expect(overlays().length).toBe(1)
    expect(overlays()[0]!.getAttribute('data-overlay')).not.toBe('bloqueia')
  })

  it('sobre um DialogLateral, que não tem overlay, desenha o seu', async () => {
    const { rerender } = render(<Sobre base="lateral" bloqueiaAberto={false} />)
    rerender(<Sobre base="lateral" />)
    await waitFor(() => expect(screen.getAllByRole('alertdialog').length).toBe(1))
    expect(overlays().length).toBe(1)
    expect(overlays()[0]!.getAttribute('data-overlay')).toBe('bloqueia')
  })

  it('quando o de baixo fecha, o overlay do bloqueia aparece', async () => {
    const { rerender } = render(<Sobre base="longo" bloqueiaAberto={false} />)
    rerender(<Sobre base="longo" />)
    await waitFor(() => expect(screen.getAllByRole('alertdialog').length).toBe(1))
    expect(overlays().length).toBe(1)
    expect(overlays()[0]!.getAttribute('data-overlay')).not.toBe('bloqueia')
    rerender(<Sobre base="longo" baseAberta={false} />)
    await waitFor(() => {
      expect(overlays().length).toBe(1)
      expect(overlays()[0]!.getAttribute('data-overlay')).toBe('bloqueia')
    })
  })

  it('o de baixo (com o que a pessoa digitou) não fecha com Esc nem com clique dentro do bloqueia', async () => {
    const base = vi.fn()
    const { rerender } = render(<Sobre base="longo" bloqueiaAberto={false} aoMudarBase={base} />)
    rerender(<Sobre base="longo" aoMudarBase={base} />)
    await waitFor(() => expect(screen.getAllByRole('alertdialog').length).toBe(1))
    await proximoTique()
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    clicar(screen.getByRole('button', { name: 'Sair' }))
    clicar(screen.getByRole('alertdialog'))
    expect(base).not.toHaveBeenCalled()
  })
})
