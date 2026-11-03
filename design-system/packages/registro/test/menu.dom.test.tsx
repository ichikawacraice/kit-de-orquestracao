import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/registry/design-system/ui/button'
import {
  AncoraDoMenu,
  ConteudoDoMenu,
  GatilhoDoMenu,
  GrupoDeEscolhaDoMenu,
  GrupoDoMenu,
  ItemDeEscolhaDoMenu,
  ItemDoMenu,
  LINHA_DO_MENU,
  Menu,
  RotuloDoMenu,
  SubmenuDoMenu,
} from '@/registry/design-system/ui/menu'

// O Radix mede o gatilho com `ResizeObserver`, que o jsdom não tem.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

afterEach(cleanup)

/** O Radix abre no `pointerdown` com `button: 0`; o `click` sozinho não abre — a tecla abre. */
function abrir(nome = 'Abrir menu') {
  const gatilho = screen.getByRole('button', { name: nome })
  fireEvent.keyDown(gatilho, { key: 'Enter' })
  return gatilho
}

function Montado({ children }: { children: React.ReactNode }) {
  return (
    <Menu>
      <GatilhoDoMenu asChild>
        <Button>Abrir menu</Button>
      </GatilhoDoMenu>
      <ConteudoDoMenu>{children}</ConteudoDoMenu>
    </Menu>
  )
}

describe('LINHA_DO_MENU e a estrutura do menu', () => {
  it('a linha comum tem 30 px de piso e 13 px de texto, sem `h-8` nem `duration-150`', () => {
    expect(LINHA_DO_MENU.length).toBeGreaterThan(0)
    expect(LINHA_DO_MENU).toContain('min-h-[30px]')
    expect(LINHA_DO_MENU).toContain('text-[13px]')
    expect(LINHA_DO_MENU).not.toMatch(/(^|\s)h-8(\s|$)/)
    expect(LINHA_DO_MENU).not.toContain('duration-150')
    render(
      <Montado>
        <GrupoDoMenu>
          <ItemDoMenu onEscolher={() => {}}>Renomear</ItemDoMenu>
        </GrupoDoMenu>
      </Montado>,
    )
    abrir()
    const item = screen.getByRole('menuitem', { name: 'Renomear' })
    expect(item.className).toContain('min-h-[30px]')
    expect(item.className).toContain('text-[13px]')
    expect(item.className).not.toMatch(/(^|\s)h-8(\s|$)/)
    expect(item.className).not.toContain('duration-150')
  })

  it('aberto, o menu não tem filete: os grupos se separam pelo ar', () => {
    render(
      <Montado>
        <GrupoDoMenu>
          <ItemDoMenu onEscolher={() => {}}>Um</ItemDoMenu>
        </GrupoDoMenu>
        <GrupoDoMenu>
          <ItemDoMenu onEscolher={() => {}}>Dois</ItemDoMenu>
        </GrupoDoMenu>
      </Montado>,
    )
    abrir()
    const menu = screen.getByRole('menu')
    expect(menu.querySelectorAll('[role="group"]').length).toBeGreaterThanOrEqual(2)
    expect(menu.querySelector('hr')).toBeNull()
    expect(menu.querySelector('[role="separator"]')).toBeNull()
  })
})

describe('ItemDoMenu bloqueado', () => {
  function bloqueado(extra: { detalhe?: string; onEscolher?: () => void } = {}) {
    const onEscolher = extra.onEscolher ?? vi.fn()
    render(
      <Montado>
        <GrupoDoMenu>
          <ItemDoMenu onEscolher={() => {}}>Antes</ItemDoMenu>
          <ItemDoMenu onEscolher={onEscolher} bloqueado="Espere a publicação terminar." detalhe={extra.detalhe}>
            Publicar
          </ItemDoMenu>
        </GrupoDoMenu>
      </Montado>,
    )
    abrir()
    return { onEscolher, item: screen.getByRole('menuitem', { name: /Publicar/ }) }
  }

  it('diz o motivo na própria linha, logo depois do rótulo, sem `ml-auto` nem coluna', () => {
    const { item } = bloqueado()
    expect(item.getAttribute('aria-disabled')).toBe('true')
    const id = item.getAttribute('aria-describedby')
    expect(id).toBeTruthy()
    const motivo = document.getElementById(id!)
    expect(motivo).not.toBeNull()
    expect(motivo!.textContent).toBe('Espere a publicação terminar.')
    expect(item.contains(motivo)).toBe(true)
    expect(motivo!.className).not.toContain('ml-auto')
    const rotulo = motivo!.previousElementSibling as HTMLElement
    expect(rotulo.textContent).toBe('Publicar')
    expect(item.querySelector('.flex-col')).toBeNull()
  })

  it('com `detalhe` e `bloqueado`, o detalhe não aparece', () => {
    const { item } = bloqueado({ detalhe: 'vale por mais 10 h' })
    expect(item.textContent).toContain('Espere a publicação terminar.')
    expect(item.textContent).not.toContain('vale por mais 10 h')
  })

  it('a seta chega nele, e Enter não escolhe nem fecha o menu', async () => {
    const { item, onEscolher } = bloqueado()
    const menu = screen.getByRole('menu')
    const antes = screen.getByRole('menuitem', { name: 'Antes' })
    antes.focus()
    fireEvent.keyDown(antes, { key: 'ArrowDown' })
    // O foco por seta é do `RovingFocusGroup` e roda num `setTimeout`.
    await waitFor(() => expect(document.activeElement).toBe(item))
    fireEvent.keyDown(item, { key: 'Enter' })
    expect(onEscolher).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBe(menu)
  })
})

describe('ItemDoMenu com confirmação', () => {
  function comConfirmacao(props: { destrutivo?: boolean; bloqueado?: string } = {}) {
    const onEscolher = vi.fn()
    render(
      <Montado>
        <GrupoDoMenu>
          <ItemDoMenu
            icone={Trash2}
            onEscolher={onEscolher}
            destrutivo={props.destrutivo}
            bloqueado={props.bloqueado}
            confirmacao={{ titulo: 'Descartar as edições?', confirmar: 'Descartar' }}
          >
            Descartar edições
          </ItemDoMenu>
        </GrupoDoMenu>
      </Montado>,
    )
    abrir()
    return { onEscolher }
  }

  it('escolher abre o diálogo; Cancelar não roda; confirmar roda uma vez', async () => {
    const { onEscolher } = comConfirmacao()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Descartar edições' }), { key: 'Enter' })
    expect(await screen.findByText('Descartar as edições?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByText('Descartar as edições?')).toBeNull())
    expect(onEscolher).not.toHaveBeenCalled()

    abrir()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Descartar edições' }), { key: 'Enter' })
    await screen.findByText('Descartar as edições?')
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(onEscolher).toHaveBeenCalledTimes(1))
  })

  it('ao desistir do diálogo, o foco volta ao gatilho', async () => {
    comConfirmacao({ destrutivo: true })
    const gatilho = screen.getByText('Abrir menu')
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Descartar edições' }), { key: 'Enter' })
    expect(await screen.findByText('Descartar as edições?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByText('Descartar as edições?')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(gatilho))
  })

  it('com `aria-label` no conteúdo (o menu do cartão), ao desistir do diálogo o foco volta ao gatilho', async () => {
    render(
      <Menu>
        <GatilhoDoMenu asChild>
          <Button>Abrir menu</Button>
        </GatilhoDoMenu>
        <ConteudoDoMenu aria-label="Ações do item">
          <GrupoDoMenu>
            <ItemDoMenu destrutivo onEscolher={() => {}} confirmacao={{ titulo: 'Descartar as edições?', confirmar: 'Descartar' }}>
              Descartar edições
            </ItemDoMenu>
          </GrupoDoMenu>
        </ConteudoDoMenu>
      </Menu>,
    )
    abrir()
    const gatilho = screen.getByText('Abrir menu')
    expect(screen.getByRole('menu').getAttribute('aria-labelledby')).toBeNull()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Descartar edições' }), { key: 'Enter' })
    expect(await screen.findByText('Descartar as edições?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByText('Descartar as edições?')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(gatilho))
  })

  it('ao confirmar com uma ação que não move o foco, o foco volta ao gatilho', async () => {
    const { onEscolher } = comConfirmacao({ destrutivo: true })
    const gatilho = screen.getByText('Abrir menu')
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Descartar edições' }), { key: 'Enter' })
    expect(await screen.findByText('Descartar as edições?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(screen.queryByText('Descartar as edições?')).toBeNull())
    expect(onEscolher).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.activeElement).toBe(gatilho))
  })

  it('o foco que a ação moveu para outro lugar não é roubado', async () => {
    const outro = document.createElement('input')
    document.body.appendChild(outro)
    const onEscolher = vi.fn(() => outro.focus())
    render(
      <Montado>
        <GrupoDoMenu>
          <ItemDoMenu onEscolher={onEscolher} confirmacao={{ titulo: 'Descartar as edições?', confirmar: 'Descartar' }}>
            Descartar edições
          </ItemDoMenu>
        </GrupoDoMenu>
      </Montado>,
    )
    abrir()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Descartar edições' }), { key: 'Enter' })
    await screen.findByText('Descartar as edições?')
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(onEscolher).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('Descartar as edições?')).toBeNull())
    expect(document.activeElement).toBe(outro)
    outro.remove()
  })

  it('com `destrutivo`, o botão de confirmar do diálogo é o `destructive`', async () => {
    comConfirmacao({ destrutivo: true })
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Descartar edições' }), { key: 'Enter' })
    await screen.findByText('Descartar as edições?')
    const confirmar = screen.getByRole('button', { name: 'Descartar' })
    expect(confirmar.className).toContain('bg-destructive')
  })

  it('sem `destrutivo`, o botão de confirmar não é o `destructive`', async () => {
    comConfirmacao()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Descartar edições' }), { key: 'Enter' })
    await screen.findByText('Descartar as edições?')
    expect(screen.getByRole('button', { name: 'Descartar' }).className).not.toContain('bg-destructive')
  })

  it('destrutivo SEM confirmação: roda direto, sem diálogo, e o rótulo é destrutivo', () => {
    const onEscolher = vi.fn()
    render(
      <Montado>
        <GrupoDoMenu>
          <ItemDoMenu destrutivo onEscolher={onEscolher}>
            Remover
          </ItemDoMenu>
        </GrupoDoMenu>
      </Montado>,
    )
    abrir()
    const item = screen.getByRole('menuitem', { name: 'Remover' })
    expect(item.className).toContain('text-destructive')
    fireEvent.keyDown(item, { key: 'Enter' })
    expect(onEscolher).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('destrutivo com confirmação e bloqueado: não abre diálogo e não chama nada', () => {
    const { onEscolher } = comConfirmacao({ destrutivo: true, bloqueado: 'Nada para descartar.' })
    fireEvent.keyDown(screen.getByRole('menuitem', { name: /Descartar edições/ }), { key: 'Enter' })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(onEscolher).not.toHaveBeenCalled()
  })
})

describe('GrupoDeEscolhaDoMenu', () => {
  function escolha(bloqueada = false) {
    const onTrocar = vi.fn()
    render(
      <Montado>
        <GrupoDoMenu>
          <RotuloDoMenu>Ajuda</RotuloDoMenu>
          <ItemDoMenu icone={Pencil} onEscolher={() => {}}>
            Renomear
          </ItemDoMenu>
        </GrupoDoMenu>
        <GrupoDeEscolhaDoMenu valor="main" onTrocar={onTrocar} rotulo="Branch">
          <ItemDeEscolhaDoMenu valor="main">main</ItemDeEscolhaDoMenu>
          <ItemDeEscolhaDoMenu valor="site" detalhe="a padrão">
            site
          </ItemDeEscolhaDoMenu>
          <ItemDeEscolhaDoMenu valor="velha" bloqueado={bloqueada ? 'Sem acesso.' : null}>
            velha
          </ItemDeEscolhaDoMenu>
        </GrupoDeEscolhaDoMenu>
      </Montado>,
    )
    abrir()
    return { onTrocar }
  }

  it('marca o valor atual, com a marca à esquerda, e o rótulo do grupo alinha com o texto', () => {
    escolha()
    const atual = screen.getByRole('menuitemradio', { name: 'main' })
    expect(atual.getAttribute('aria-checked')).toBe('true')
    expect(atual.className).toContain('pl-8')
    const marca = atual.querySelector('svg')!.closest('span.absolute') as HTMLElement
    expect(marca).not.toBeNull()
    expect(marca.className).toContain('absolute')
    expect(marca.className).toContain('left-2')
    expect(screen.getByRole('menuitemradio', { name: /site/ }).getAttribute('aria-checked')).toBe('false')
    const rotuloDoGrupo = screen.getByText('Branch')
    expect(rotuloDoGrupo.className).toContain('pl-8')
    const rotuloSolto = screen.getByText('Ajuda')
    expect(rotuloSolto.className).toContain('px-2')
    expect(rotuloSolto.className).not.toContain('pl-8')
  })

  it('escolher outro chama `onTrocar` com o valor', () => {
    const { onTrocar } = escolha()
    fireEvent.keyDown(screen.getByRole('menuitemradio', { name: /site/ }), { key: 'Enter' })
    expect(onTrocar).toHaveBeenCalledWith('site')
  })

  it('o item bloqueado não chama', () => {
    const { onTrocar } = escolha(true)
    const velha = screen.getByRole('menuitemradio', { name: /velha/ })
    expect(velha.getAttribute('aria-disabled')).toBe('true')
    fireEvent.keyDown(velha, { key: 'Enter' })
    expect(onTrocar).not.toHaveBeenCalled()
  })
})

describe('ItemDoMenu fora de um Menu', () => {
  it('com `confirmacao` lança; destrutivo sem `confirmacao` não lança', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() =>
        render(
          <DropdownMenuPrimitive.Root open>
            <DropdownMenuPrimitive.Trigger>t</DropdownMenuPrimitive.Trigger>
            <DropdownMenuPrimitive.Content>
              <ItemDoMenu onEscolher={() => {}} confirmacao={{ titulo: 'x' }}>
                Apagar
              </ItemDoMenu>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Root>,
        ),
      ).toThrow('ItemDoMenu com confirmação precisa estar dentro de um Menu')
    } finally {
      erro.mockRestore()
    }
    cleanup()
    render(
      <DropdownMenuPrimitive.Root open>
        <DropdownMenuPrimitive.Trigger>t</DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Content>
          <ItemDoMenu destrutivo onEscolher={() => {}}>
            Apagar
          </ItemDoMenu>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Root>,
    )
    expect(screen.getByRole('menuitem', { name: 'Apagar' })).toBeTruthy()
  })
})

describe('AncoraDoMenu', () => {
  it('é um gatilho invisível no `body`, na posição do retângulo, e o menu abre', () => {
    const ui = (x: number) => (
      <Menu open onOpenChange={() => {}}>
        <AncoraDoMenu retangulo={{ x, y: 60, width: 200, height: 100 }} />
        <ConteudoDoMenu>
          <GrupoDoMenu>
            <ItemDoMenu onEscolher={() => {}}>Duplicar</ItemDoMenu>
          </GrupoDoMenu>
        </ConteudoDoMenu>
      </Menu>
    )
    const { rerender } = render(ui(40))
    const ancora = document.querySelector('[data-slot="ancora-do-menu"]') as HTMLElement
    expect(ancora).not.toBeNull()
    expect(ancora.parentElement).toBe(document.body)
    expect(ancora.getAttribute('aria-hidden')).toBe('true')
    expect(ancora.tabIndex).toBe(-1)
    expect(ancora.style.left).toBe('40px')
    expect(ancora.style.top).toBe('60px')
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
    rerender(ui(300))
    const mesma = document.querySelector('[data-slot="ancora-do-menu"]') as HTMLElement
    expect(mesma).toBe(ancora)
    expect(mesma.style.left).toBe('300px')
  })
})

describe('o gatilho sem Trigger', () => {
  it('no `AncoraDoMenu` com confirmação, nada é focado e nada quebra', async () => {
    const onEscolher = vi.fn()
    render(
      <Menu open onOpenChange={() => {}}>
        <AncoraDoMenu retangulo={{ x: 0, y: 0, width: 10, height: 10 }} />
        <ConteudoDoMenu>
          <GrupoDoMenu>
            <ItemDoMenu onEscolher={onEscolher} confirmacao={{ titulo: 'Excluir?', confirmar: 'Excluir' }}>
              Excluir
            </ItemDoMenu>
          </GrupoDoMenu>
        </ConteudoDoMenu>
      </Menu>,
    )
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Excluir' }), { key: 'Enter' })
    await screen.findByText('Excluir?')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByText('Excluir?')).toBeNull())
    expect(onEscolher).not.toHaveBeenCalled()
    const ancora = document.querySelector('[data-slot="ancora-do-menu"]')
    expect(document.activeElement).not.toBe(ancora)
  })
})

describe('SubmenuDoMenu', () => {
  function sub(props: Partial<React.ComponentProps<typeof SubmenuDoMenu>>) {
    const onAbrir = vi.fn()
    render(
      <Montado>
        <GrupoDoMenu>
          <SubmenuDoMenu rotuloDaEspera="As outras branches" onAbrir={onAbrir} {...props}>
            Abrir outra branch
          </SubmenuDoMenu>
        </GrupoDoMenu>
      </Montado>,
    )
    abrir()
    const linha = screen.getByRole('menuitem', { name: /Abrir outra branch/ })
    return { linha, onAbrir }
  }

  it('carregando: abre por seta, chama `onAbrir` uma vez e mostra a espera sem itens de escolha', async () => {
    const { linha, onAbrir } = sub({ carregando: true })
    linha.focus()
    fireEvent.keyDown(linha, { key: 'ArrowRight' })
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).not.toBeNull())
    expect(onAbrir).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[role="menuitemradio"]')).toBeNull()
  })

  it('vazio e sem lista: a frase aparece e não é um item', async () => {
    const { linha } = sub({ vazio: 'Nenhuma outra branch.' })
    linha.focus()
    fireEvent.keyDown(linha, { key: 'ArrowRight' })
    const frase = await screen.findByText('Nenhuma outra branch.')
    expect(frase.getAttribute('role')).not.toBe('menuitem')
    expect(frase.closest('[role="menuitem"]')).toBeNull()
    expect(document.querySelector('[data-forma]')).toBeNull()
  })

  it('erro: o ponto `ruim` vem antes do texto e o `Tentar de novo` chama a função', async () => {
    const onTentarDeNovo = vi.fn()
    const { linha } = sub({ erro: { texto: 'Não deu para listar.', onTentarDeNovo } })
    linha.focus()
    fireEvent.keyDown(linha, { key: 'ArrowRight' })
    const texto = await screen.findByText('Não deu para listar.')
    const ponto = document.querySelector('[data-slot="ponto"][data-tom="ruim"]')
    expect(ponto).not.toBeNull()
    // O texto é a frase inteira (o `<p>`), e o ponto é o primeiro filho dela: vem antes das palavras.
    expect(texto.contains(ponto)).toBe(true)
    expect(texto.firstElementChild).toBe(ponto)
    const de_novo = screen.getByRole('menuitem', { name: 'Tentar de novo' })
    fireEvent.keyDown(de_novo, { key: 'Enter' })
    expect(onTentarDeNovo).toHaveBeenCalledTimes(1)
  })

  it('bloqueado: a linha tem `aria-disabled`, a seta não abre e `onAbrir` não roda', () => {
    const { linha, onAbrir } = sub({ bloqueado: 'Sem acesso ao repositório.', vazio: 'Nenhuma.' })
    expect(linha.getAttribute('aria-disabled')).toBe('true')
    linha.focus()
    fireEvent.keyDown(linha, { key: 'ArrowRight' })
    expect(screen.queryByText('Nenhuma.')).toBeNull()
    expect(onAbrir).not.toHaveBeenCalled()
  })
})

describe('o nome e o foco do ConteudoDoMenu', () => {
  it('com `aria-label`, o menu leva esse nome, e não o do gatilho', () => {
    render(
      <Menu>
        <GatilhoDoMenu asChild>
          <Button>Abrir menu</Button>
        </GatilhoDoMenu>
        <ConteudoDoMenu aria-label="Ações de Banner">
          <GrupoDoMenu>
            <ItemDoMenu onEscolher={() => {}}>Um</ItemDoMenu>
          </GrupoDoMenu>
        </ConteudoDoMenu>
      </Menu>,
    )
    abrir()
    expect(screen.getByRole('menu', { name: 'Ações de Banner' })).toBeTruthy()
    expect(screen.queryByRole('menu', { name: 'Abrir menu' })).toBeNull()
  })

  function ComSaida({ modal, adiado = false }: { modal: boolean; adiado?: boolean }) {
    const campo = React.useRef<HTMLInputElement>(null)
    return (
      <>
        <input ref={campo} aria-label="Campo de fora" />
        <Menu modal={modal}>
          <GatilhoDoMenu asChild>
            <Button>Abrir menu</Button>
          </GatilhoDoMenu>
          <ConteudoDoMenu>
            <GrupoDoMenu>
              <ItemDoMenu
                onEscolher={() => {
                  if (adiado) window.setTimeout(() => campo.current?.focus(), 0)
                  else campo.current?.focus()
                }}
              >
                Ir ao campo
              </ItemDoMenu>
              <ItemDoMenu onEscolher={() => {}}>Nada</ItemDoMenu>
            </GrupoDoMenu>
          </ConteudoDoMenu>
        </Menu>
      </>
    )
  }

  it('(a) sem modal, o foco movido ao escolher (com o menu fechando) fica onde foi, e não volta ao gatilho', async () => {
    render(<ComSaida modal={false} adiado />)
    abrir()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ir ao campo' }))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await new Promise((r) => setTimeout(r, 30))
    expect(document.activeElement).toBe(screen.getByLabelText('Campo de fora'))
  })

  it('(b) controle — sem foco movido, o foco volta ao gatilho', async () => {
    render(<ComSaida modal={false} />)
    const gatilho = abrir()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Nada' }))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(gatilho))
  })

  it('(c) no modal, o foco movido depois do fechamento fica no destino', async () => {
    render(<ComSaida modal adiado />)
    abrir()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ir ao campo' }))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await new Promise((r) => setTimeout(r, 30))
    expect(document.activeElement).toBe(screen.getByLabelText('Campo de fora'))
  })
})
