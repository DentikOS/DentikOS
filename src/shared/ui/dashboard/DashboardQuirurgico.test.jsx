import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DashboardQuirurgico } from './DashboardQuirurgico'

describe('DashboardQuirurgico (BP04 §08)', () => {
  it('renderiza elementos visibles del modo quirúrgico y no renderiza widgets normales', () => {
    const handleSalir = vi.fn()
    render(
      <DashboardQuirurgico
        pacienteActual={{ id: 'p1', nombre: 'Juan Pérez' }}
        onSalir={handleSalir}
      />
    )

    expect(screen.getByText(/MODO QUIRÚRGICO CLÍNICO/i)).toBeInTheDocument()
    expect(screen.getByText(/Juan Pérez/i)).toBeInTheDocument()
    expect(screen.getByText(/Alertas Críticas/i)).toBeInTheDocument()
    expect(screen.getByText(/Salir del Quirófano/i)).toBeInTheDocument()

    // Ocultos por diseño
    expect(screen.queryByText(/Tu día en 30 segundos/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Acciones Rápidas/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Inventario Crítico/i)).not.toBeInTheDocument()
  })

  it('permite salir del modo quirúrgico al hacer click en el botón de salida', () => {
    const handleSalir = vi.fn()
    render(<DashboardQuirurgico onSalir={handleSalir} />)

    fireEvent.click(screen.getByText(/Salir del Quirófano/i))
    expect(handleSalir).toHaveBeenCalled()
  })
})
