import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DashboardWidgetsGrid } from './DashboardWidgetsGrid'

describe('DashboardWidgetsGrid (BP04 §03)', () => {
  const mockWidgets = [
    { id: 'w1', tipo: 'agenda', visible: true, orden: 1 },
    { id: 'w2', tipo: 'pacientes_recientes', visible: true, orden: 2 },
    { id: 'w3', tipo: 'pagos_pendientes', visible: false, orden: 3 }
  ]
  const mockOrder = ['w1', 'w2', 'w3']
  const mockCitas = [
    { id: 'c1', pacienteNombre: 'Juan Perez', horaInicio: '11:00', estado: 'Agendado' }
  ]

  it('renderiza solo widgets visibles respetando el orden', () => {
    render(
      <DashboardWidgetsGrid
        widgets={mockWidgets}
        widgetOrder={mockOrder}
        citas={mockCitas}
        pacientes={[]}
      />
    )

    expect(screen.getByText(/Próximas Citas/i)).toBeInTheDocument()
    expect(screen.getByText('Pacientes Recientes')).toBeInTheDocument()
    expect(screen.queryByText(/Pagos & Flujo de Caja/i)).not.toBeInTheDocument()
  })

  it('permite navegación hacia secciones desde widgets hijos', () => {
    const handleNavegar = vi.fn()
    render(
      <DashboardWidgetsGrid
        widgets={mockWidgets}
        widgetOrder={mockOrder}
        citas={mockCitas}
        pacientes={[]}
        onNavegarSeccion={handleNavegar}
      />
    )

    fireEvent.click(screen.getByText(/Ver agenda completa/i))
    expect(handleNavegar).toHaveBeenCalledWith('Agenda')
  })
})
