import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetAlertasClinicas } from './WidgetAlertasClinicas'

describe('WidgetAlertasClinicas (BP04 §03)', () => {
  const mockAlertas = [
    {
      id: 'a1',
      pacienteNombre: 'Elena Naranjo',
      tipo: 'alergia',
      mensaje: 'Alergia severa a Penicilina',
      severidad: 'critica'
    },
    {
      id: 'a2',
      pacienteNombre: 'Pedro Pascal',
      tipo: 'precaucion',
      mensaje: 'Hipertensión arterial no controlada',
      severidad: 'precaucion'
    }
  ]

  it('renderiza alertas con severidades diferenciadas (crítica vs precaución)', () => {
    const { rerender } = render(<WidgetAlertasClinicas alertas={[]} />)
    expect(screen.getByText(/Alertas Clínicas del Día/i)).toBeInTheDocument()
    expect(screen.getByText(/No hay alertas clínicas registradas/i)).toBeInTheDocument()

    rerender(<WidgetAlertasClinicas alertas={mockAlertas} />)
    expect(screen.getByText('Elena Naranjo')).toBeInTheDocument()
    expect(screen.getByText('Pedro Pascal')).toBeInTheDocument()
    expect(screen.getByText(/Alergia severa a Penicilina/i)).toBeInTheDocument()
    expect(screen.getByText(/Hipertensión arterial no controlada/i)).toBeInTheDocument()
    expect(screen.getByText(/2 alertas/i)).toBeInTheDocument()
  })

  it('llama onVerAlerta con los datos correctos al hacer click', () => {
    const handleVerAlerta = vi.fn()
    render(
      <WidgetAlertasClinicas
        alertas={mockAlertas}
        onVerAlerta={handleVerAlerta}
      />
    )

    fireEvent.click(screen.getByText(/Alergia severa a Penicilina/i))
    expect(handleVerAlerta).toHaveBeenCalledWith(mockAlertas[0])
  })

  it('renderiza estilo de precaución cuando no existen alertas críticas', () => {
    const soloPrecaucion = [
      { id: 'a2', pacienteNombre: 'Pedro Pascal', tipo: 'precaucion', mensaje: 'Control PA', severidad: 'precaucion' }
    ]
    render(<WidgetAlertasClinicas alertas={soloPrecaucion} />)
    expect(screen.getByText('1 alertas')).toBeInTheDocument()
    expect(screen.getByText('Pedro Pascal')).toBeInTheDocument()
  })
})
