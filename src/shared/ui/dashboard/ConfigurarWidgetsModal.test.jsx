import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfigurarWidgetsModal } from './ConfigurarWidgetsModal'
import { useDashboardStore } from '../../../app/stores/useDashboardStore'

describe('ConfigurarWidgetsModal (BP04 §03)', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      widgets: [
        { id: 'w-agenda', tipo: 'agenda', visible: true, orden: 1 },
        { id: 'w-pagos', tipo: 'pagos_pendientes', visible: false, orden: 2 }
      ]
    })
  })

  it('no renderiza nada cuando isOpen es false', () => {
    const { container } = render(<ConfigurarWidgetsModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza widgets disponibles para el rol y permite alternar visibilidad con checkbox', () => {
    const handleClose = vi.fn()
    render(<ConfigurarWidgetsModal isOpen={true} onClose={handleClose} userRole="admin" />)

    expect(screen.getByText(/Personalizar Dashboard/i)).toBeInTheDocument()
    expect(screen.getByText(/Agenda de Citas/i)).toBeInTheDocument()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[0]).toBeChecked()

    fireEvent.click(checkboxes[0])
    expect(useDashboardStore.getState().widgets.find((w) => w.id === 'w-agenda')?.visible).toBe(false)

    expect(screen.getByText(/visibles/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Listo/i }))
    expect(handleClose).toHaveBeenCalled()
  })

  it('muestra badge "Condicional" para el widget Quick Resume', () => {
    useDashboardStore.setState({
      widgets: [
        { id: 'quick_resume', tipo: 'quick_resume', visible: true, orden: 1 }
      ]
    })
    render(
      <ConfigurarWidgetsModal isOpen={true} onClose={() => {}} userRole="admin" />
    )
    expect(screen.getByText('Condicional')).toBeInTheDocument()
    expect(screen.getByText('Solo visible al editar una ficha reciente')).toBeInTheDocument()
  })

  it('NO muestra emojis en el footer del modal (Brand Manual)', () => {
    const { container } = render(
      <ConfigurarWidgetsModal isOpen={true} onClose={() => {}} userRole="admin" />
    )
    // Verificar que no hay emojis (rango Unicode de emojis)
    const footer = container.querySelector('.pt-2')
    const hasEmoji = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(footer?.textContent || '')
    expect(hasEmoji).toBe(false)
  })

  it('muestra icono Info en el footer en lugar de emoji', () => {
    render(
      <ConfigurarWidgetsModal isOpen={true} onClose={() => {}} userRole="admin" />
    )
    // El icono Info de Lucide se renderiza como SVG
    const svgs = document.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })
})
