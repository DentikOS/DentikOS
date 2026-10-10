import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetQuickResume } from './WidgetQuickResume'

describe('WidgetQuickResume (BP04 §03)', () => {
  it('no renderiza nada si no hay data o si pasaron más de 30 minutos', () => {
    const { container, rerender } = render(<WidgetQuickResume data={null} />)
    expect(container.firstChild).toBeNull()

    const dataVieja = {
      pacienteId: 'p1',
      pacienteNombre: 'Paciente Antiguo',
      timestamp: Date.now() - 40 * 60 * 1000 // 40 minutos atrás
    }
    rerender(<WidgetQuickResume data={dataVieja} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza cuando la sesión es menor a 30 minutos y ejecuta onRetomar', () => {
    const handleRetomar = vi.fn()
    const dataReciente = {
      pacienteId: 'p1',
      pacienteNombre: 'Constanza Ríos',
      tabActiva: 'Odontograma',
      timestamp: Date.now() - 5 * 60 * 1000 // 5 minutos atrás
    }

    render(<WidgetQuickResume data={dataReciente} onRetomar={handleRetomar} />)

    expect(screen.getByText(/Quick Resume/i)).toBeInTheDocument()
    expect(screen.getByText('Constanza Ríos')).toBeInTheDocument()
    expect(screen.getByText('Odontograma')).toBeInTheDocument()
    expect(screen.getByText(/Editado hace 5 min/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/Retomar atención/i))
    expect(handleRetomar).toHaveBeenCalledWith(dataReciente)
  })
})
