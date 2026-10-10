import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MiniTour } from './MiniTour'

describe('MiniTour (BP04 §07)', () => {
  it('avanza por los 5 pasos y finaliza correctamente', () => {
    const handleClose = vi.fn()
    render(<MiniTour isOpen={true} onClose={handleClose} />)

    expect(screen.getByText(/Tour del Dashboard · Paso 1 de 5/i)).toBeInTheDocument()
    expect(screen.getByText(/Bienvenido a tu Consola Odontológica/i)).toBeInTheDocument()

    // Paso 2
    fireEvent.click(screen.getByText('Siguiente'))
    expect(screen.getByText(/Paso 2 de 5/i)).toBeInTheDocument()
    expect(screen.getByText(/Morning Brief Inteligente/i)).toBeInTheDocument()

    // Paso 3
    fireEvent.click(screen.getByText('Siguiente'))
    expect(screen.getByText(/Paso 3 de 5/i)).toBeInTheDocument()

    // Paso 4
    fireEvent.click(screen.getByText('Siguiente'))
    expect(screen.getByText(/Paso 4 de 5/i)).toBeInTheDocument()

    // Paso 5
    fireEvent.click(screen.getByText('Siguiente'))
    expect(screen.getByText(/Paso 5 de 5/i)).toBeInTheDocument()
    expect(screen.getByText('Finalizar')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Finalizar'))
    expect(handleClose).toHaveBeenCalled()
  })

  it('permite saltar el tour directamente', () => {
    const handleClose = vi.fn()
    render(<MiniTour isOpen={true} onClose={handleClose} />)

    fireEvent.click(screen.getByText(/Saltar tour/i))
    expect(handleClose).toHaveBeenCalled()
  })
})
