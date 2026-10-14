import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'

describe('KeyboardShortcutsModal (Blueprint 02 §07 Feature 02)', () => {
  it('no se renderiza cuando está cerrado', () => {
    const { container } = render(<KeyboardShortcutsModal isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza las 6 categorías de atajos en modo abierto', () => {
    render(<KeyboardShortcutsModal isOpen={true} />)

    expect(screen.getByText('Atajos de Teclado')).toBeInTheDocument()
    expect(screen.getByText('Navegación')).toBeInTheDocument()
    expect(screen.getByText('Creación')).toBeInTheDocument()
    expect(screen.getByText('Guardado')).toBeInTheDocument()
    expect(screen.getByText('Tema')).toBeInTheDocument()
    expect(screen.getByText('Vista')).toBeInTheDocument()
    expect(screen.getByText('Sesión')).toBeInTheDocument()
  })

  it('se abre al recibir evento open-shortcuts-modal y se cierra con botón cerrar', () => {
    render(<KeyboardShortcutsModal />)

    // Inicialmente cerrado
    expect(screen.queryByText('Atajos de Teclado')).not.toBeInTheDocument()

    // Disparar evento
    act(() => {
      window.dispatchEvent(new CustomEvent('open-shortcuts-modal'))
    })
    expect(screen.getByText('Atajos de Teclado')).toBeInTheDocument()

    // Cerrar con botón X
    const closeBtn = screen.getByLabelText('Cerrar')
    fireEvent.click(closeBtn)
    expect(screen.queryByText('Atajos de Teclado')).not.toBeInTheDocument()
  })
})
