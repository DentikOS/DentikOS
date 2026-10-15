import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModalNuevoBloqueo } from './ModalNuevoBloqueo'

describe('ModalNuevoBloqueo (BP05 §06)', () => {
  it('muestra los 6 tipos oficiales de bloqueo (BP05 §06)', () => {
    render(<ModalNuevoBloqueo alGuardar={vi.fn()} alCerrar={vi.fn()} />)

    expect(screen.getByText('Horario de Almuerzo')).toBeInTheDocument()
    expect(screen.getByText('Procedimiento Largo')).toBeInTheDocument()
    expect(screen.getByText('Vacaciones / Ausencia')).toBeInTheDocument()
    expect(screen.getByText('Mantenimiento')).toBeInTheDocument()
    expect(screen.getByText('Capacitación')).toBeInTheDocument()
    expect(screen.getByText('Personalizado')).toBeInTheDocument()
  })

  it('muestra campo de recurrencia para tipos que la permiten', () => {
    render(<ModalNuevoBloqueo alGuardar={vi.fn()} alCerrar={vi.fn()} />)

    // Por defecto inicia en Horario de Almuerzo (permite recurrencia)
    expect(screen.getByLabelText(/Repetir/i)).toBeInTheDocument()

    // Cambiar a Mantenimiento (no permite recurrencia)
    fireEvent.click(screen.getByText('Mantenimiento'))
    expect(screen.queryByLabelText(/Repetir/i)).not.toBeInTheDocument()

    // Volver a Capacitación (permite recurrencia)
    fireEvent.click(screen.getByText('Capacitación'))
    expect(screen.getByLabelText(/Repetir/i)).toBeInTheDocument()
  })

  it('muestra rango de fechas para vacaciones y oculta horas fijas', () => {
    render(<ModalNuevoBloqueo alGuardar={vi.fn()} alCerrar={vi.fn()} />)

    // Seleccionar Vacaciones / Ausencia
    fireEvent.click(screen.getByText('Vacaciones / Ausencia'))

    expect(screen.getByLabelText(/Fecha Inicio/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Fecha Fin/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Hora Inicio/i)).not.toBeInTheDocument()
  })

  it('guarda bloqueo con datos correctos al enviar formulario', () => {
    const onGuardar = vi.fn()
    const onCerrar = vi.fn()

    render(<ModalNuevoBloqueo alGuardar={onGuardar} alCerrar={onCerrar} />)

    const btnSubmit = screen.getByRole('button', { name: /bloquear horario/i })
    fireEvent.click(btnSubmit)

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        esBloqueo: true,
        estado: 'Bloqueado',
        motivoBloqueo: 'Horario de Almuerzo',
        tipoBloqueoId: 'almuerzo',
        colorBloqueo: '#64748B',
      })
    )
    expect(onCerrar).toHaveBeenCalled()
  })
})
