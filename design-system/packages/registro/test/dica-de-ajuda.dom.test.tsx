// O ⓘ: o botão aponta o texto da dica para o leitor de tela, e o nome acessível respeita a sigla.
import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { userEvent as eventos } from '@testing-library/user-event'
import { DicaDeAjuda, rotuloSobre } from '@/registry/design-system/ui/dica-de-ajuda'

// Sem a espera de relógio entre teclas: o caso mede o gesto, não o tempo.
const userEvent = { setup: () => eventos.setup({ delay: null }) }

describe('o ⓘ de ajuda', () => {
  it('sem id, o botão ainda descreve a dica aberta (o Radix dá o aria-describedby)', async () => {
    render(<DicaDeAjuda texto="Vazio = ícone decorativo." rotulo="Sobre o texto alternativo" />)
    const botao = screen.getByRole('button', { name: 'Sobre o texto alternativo' })
    fireEvent.focus(botao)
    await screen.findByRole('tooltip')
    const id = botao.getAttribute('aria-describedby')
    expect(id).toBeTruthy()
    expect(document.getElementById(id!)?.textContent).toContain('Vazio = ícone decorativo.')
  })
  it('com id, o botão aponta o texto sr-only', () => {
    render(<DicaDeAjuda texto="Texto da dica." rotulo="Sobre x" id="dica-1" />)
    expect(screen.getByRole('button', { name: 'Sobre x' }).getAttribute('aria-describedby')).toContain('dica-1')
    expect(document.getElementById('dica-1')?.textContent).toBe('Texto da dica.')
  })
})

describe('o toque', () => {
  it('o clique abre e o segundo clique fecha', async () => {
    render(<DicaDeAjuda texto="Texto da dica." rotulo="Sobre x" />)
    const botao = screen.getByRole('button', { name: 'Sobre x' })
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.click(botao)
    await screen.findByRole('tooltip')
    fireEvent.click(botao)
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  })
  // O gesto real tem pointerdown + pointerup + click: o Radix fecha no pointerdown e o click reabria.
  it('o clique real abre e o segundo clique real fecha', async () => {
    const u = userEvent.setup()
    render(<DicaDeAjuda texto="Texto da dica." rotulo="Sobre x" />)
    const botao = screen.getByRole('button', { name: 'Sobre x' })
    await u.click(botao)
    await screen.findByRole('tooltip')
    await u.click(botao)
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  })
  it('o toque (pointerdown, pointerup, click) abre e o segundo toque fecha', async () => {
    render(<DicaDeAjuda texto="Texto da dica." rotulo="Sobre x" />)
    const botao = screen.getByRole('button', { name: 'Sobre x' })
    const toque = () => {
      fireEvent.pointerDown(botao, { pointerType: 'touch' })
      fireEvent.pointerUp(botao, { pointerType: 'touch' })
      fireEvent.click(botao)
    }
    toque()
    await screen.findByRole('tooltip')
    toque()
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  })
  // O toque de verdade: pointerup, mousedown, FOCUS, click. O focus do meio faz o Radix abrir (true) e o click,
  // que alterna sobre esse true, fechava a dica no primeiro toque. O jsdom não manda o focus sozinho.
  it('o toque com o focus no meio: o primeiro toque abre, o segundo fecha', async () => {
    render(<DicaDeAjuda texto="Texto da dica." rotulo="Sobre x" />)
    const botao = screen.getByRole('button', { name: 'Sobre x' })
    const toque = () => {
      fireEvent.pointerDown(botao, { pointerType: 'touch' })
      fireEvent.pointerUp(botao, { pointerType: 'touch' })
      fireEvent.mouseDown(botao)
      fireEvent.focus(botao)
      fireEvent.click(botao)
    }
    toque()
    await screen.findByRole('tooltip')
    // O que o Radix manda depois do click não pode derrubar a dica que o primeiro toque abriu.
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(screen.queryByRole('tooltip')).not.toBeNull()
    toque()
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  })
  it('o foco por teclado (sem ponteiro) abre a dica, e o Tab para fora fecha', async () => {
    const u = userEvent.setup()
    render(<><DicaDeAjuda texto="Texto da dica." rotulo="Sobre x" /><button type="button">depois</button></>)
    await u.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sobre x' }))
    await screen.findByRole('tooltip')
    await u.tab()
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  })
  it('o Esc fecha a dica aberta', async () => {
    render(<DicaDeAjuda texto="Texto da dica." rotulo="Sobre x" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sobre x' }))
    await screen.findByRole('tooltip')
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  })
})

describe('rotuloSobre', () => {
  it('mantém a sigla', () => {
    expect(rotuloSobre('URL da imagem')).toBe('Sobre URL da imagem')
    expect(rotuloSobre('SKU')).toBe('Sobre SKU')
  })
  it('desce só a primeira letra de palavra comum', () => {
    expect(rotuloSobre('Texto alternativo')).toBe('Sobre texto alternativo')
    expect(rotuloSobre('Álbum')).toBe('Sobre álbum')
  })
})
