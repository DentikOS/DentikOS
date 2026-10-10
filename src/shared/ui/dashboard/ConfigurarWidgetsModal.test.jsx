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

    fireEvent.click(screen.getByText(/Guardar y cerrar/i))
    expect(handleClose).toHaveBeenCalled()
  })
})
