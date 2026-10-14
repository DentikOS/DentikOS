import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetComunicaciones } from './WidgetComunicaciones'

describe('WidgetComunicaciones (BP04 §03)', () => {
  it('renderiza contadores de WhatsApp y confirmaciones', () => {
    render(<WidgetComunicaciones sinLeerWhatsapp={7} porConfirmar={4} />)

    expect(screen.getByText(/Comunicaciones & Recall/i)).toBeInTheDocument()
    expect(screen.getByText(/7 pendientes/i)).toBeInTheDocument()
    expect(screen.getByText(/4 por enviar/i)).toBeInTheDocument()
    expect(screen.getByText(/WhatsApp activo/i)).toBeInTheDocument()
  })

  it('navega a comunicaciones al hacer click', () => {
    const handleIr = vi.fn()
    render(<WidgetComunicaciones onIrComunicaciones={handleIr} />)

    fireEvent.click(screen.getByText(/Centro de Mensajes y Confirmaciones/i))
    expect(handleIr).toHaveBeenCalled()
  })

  it('renderiza métricas reales (no valores por defecto)', () => {
    render(<WidgetComunicaciones sinLeerWhatsapp={2} porConfirmar={3} />)

    expect(screen.getByText('2 pendientes')).toBeInTheDocument()
    expect(screen.getByText('3 por enviar')).toBeInTheDocument()
    expect(screen.queryByText('5 por enviar')).not.toBeInTheDocument()
  })
})
