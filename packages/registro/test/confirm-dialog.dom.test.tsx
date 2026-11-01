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

describe('useConfirm com onConfirmar: a ação roda com o diálogo aberto', () => {
  function Assincrona({ opcoes }: { opcoes: Parameters<ReturnType<typeof useConfirm>[1]>[0] }) {
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

  /** Uma promessa que o teste cumpre ou rejeita quando quer. */
  function controlada() {
    let cumprir!: () => void
    let rejeitar!: (e: unknown) => void
    const promessa = new Promise<void>((c, r) => {
      cumprir = c
      rejeitar = r
    })
    return { promessa, cumprir, rejeitar }
  }

  it('rodando: o gerúndio no botão, que guarda o foco; Esc, Cancelar e X travados; o sucesso fecha e resolve true', async () => {
    const acao = controlada()
    let resolvido: boolean | null = null
    let rodadas = 0
    render(
      <Assincrona
        opcoes={{
          titulo: 'Excluir o projeto?',
          confirmar: 'Excluir',
          destrutivo: true,
          rotuloRodando: 'Excluindo',
          onConfirmar: () => {
            rodadas++
            return acao.promessa
          },
        }}
      />
    )
    fireEvent.click(screen.getByText('abrir'))
    const excluir = await screen.findByRole('button', { name: 'Excluir' })
    void resposta!.then((v) => (resolvido = v))
    excluir.focus()
    await act(async () => {
      fireEvent.click(excluir)
    })
    const rodando = screen.getByRole('button', { name: 'Excluindo' })
    expect(rodando).toBe(excluir)
    expect(rodando.getAttribute('aria-disabled')).toBe('true')
    expect((rodando as HTMLButtonElement).disabled).toBe(false)
    expect(document.activeElement).toBe(rodando)
    expect(screen.getByRole('status').textContent).toBe('Excluindo')
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Fechar' }) as HTMLButtonElement).disabled).toBe(true)
    // O segundo clique não roda de novo, e o Esc não fecha.
    await act(async () => {
      fireEvent.click(rodando)
      fireEvent.keyDown(rodando, { key: 'Enter', code: 'Enter' })
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' })
      fireEvent.pointerDown(document.body)
      fireEvent.mouseDown(document.body)
    })
    expect(rodadas).toBe(1)
    expect(screen.getByRole('dialog')).not.toBeNull()
    expect(resolvido).toBeNull()
    await act(async () => {
      acao.cumprir()
    })
    await expect(resposta).resolves.toBe(true)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('a falha fica no diálogo, na frase de quem usa e nunca o erro cru; tentar de novo e dar certo fecha', async () => {
    const erroDoConsole = console.error
    console.error = () => {}
    try {
      let vez = 0
      render(
        <Assincrona
          opcoes={{
            titulo: 'Excluir a tarefa?',
            confirmar: 'Excluir',
            rotuloRodando: 'Excluindo',
            onConfirmar: async () => {
              if (vez++ === 0) throw new Error('Request failed with status 409')
            },
            descreverErro: () => 'Outra pessoa mudou esta tarefa. Recarregue antes de excluir.',
          }}
        />
      )
      fireEvent.click(screen.getByText('abrir'))
      await act(async () => {
        fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
      })
      const alerta = await screen.findByRole('alert')
      expect(alerta.textContent).toBe('Outra pessoa mudou esta tarefa. Recarregue antes de excluir.')
      expect(document.body.textContent).not.toContain('409')
      // O erro mora no rodapé, acima dos botões, e o diálogo segue aberto e destravado.
      expect(document.querySelector('[data-slot=rodape-do-dialogo]')!.contains(alerta)).toBe(true)
      expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(false)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
      })
      await expect(resposta).resolves.toBe(true)
    } finally {
      console.error = erroDoConsole
    }
  })

  it('sem descreverErro, ou com ele lançando, vale a frase padrão; cancelar depois da falha resolve false', async () => {
    const erroDoConsole = console.error
    console.error = () => {}
    try {
      render(
        <Assincrona
          opcoes={{
            titulo: 'Publicar?',
            confirmar: 'Publicar',
            rotuloRodando: 'Publicando',
            onConfirmar: async () => {
              throw new Error('ECONNRESET')
            },
            descreverErro: () => {
              throw new Error('falhou de novo')
            },
          }}
        />
      )
      fireEvent.click(screen.getByText('abrir'))
      await act(async () => {
        fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }))
      })
      expect((await screen.findByRole('alert')).textContent).toBe('Não deu para concluir agora. Tente de novo.')
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      })
      await expect(resposta).resolves.toBe(false)
    } finally {
      console.error = erroDoConsole
    }
  })

  it('passada a espera máxima, tudo destrava e a linha pede para conferir; a resposta que chega depois ainda vale', async () => {
    const acao = controlada()
    render(
      <Assincrona
        opcoes={{ titulo: 'Excluir?', confirmar: 'Excluir', rotuloRodando: 'Excluindo', esperaMaxima: 30, onConfirmar: () => acao.promessa }}
      />
    )
    fireEvent.click(screen.getByText('abrir'))
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    })
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('demorando mais que o normal')
    expect(alerta.getAttribute('data-tom')).toBe('espera')
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(false)
    await act(async () => {
      acao.cumprir()
    })
    await expect(resposta).resolves.toBe(true)
  })

  it('o corpo fica inerte enquanto roda', async () => {
    const acao = controlada()
    render(
      <Assincrona
        opcoes={{ titulo: 'Recusar?', corpo: <textarea aria-label="motivo" />, rotuloRodando: 'Recusando', onConfirmar: () => acao.promessa }}
      />
    )
    fireEvent.click(screen.getByText('abrir'))
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }))
    })
    expect(screen.getByLabelText('motivo').closest('[inert]')).not.toBeNull()
    await act(async () => {
      acao.cumprir()
    })
  })
})
