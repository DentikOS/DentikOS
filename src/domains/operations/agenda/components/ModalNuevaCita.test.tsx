import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ModalNuevaCita } from './ModalNuevaCita'
import { usePacientesStore } from '../../../../app/stores/pacientesStore'
import { usePrestacionesStore } from '../../../../app/stores/prestacionesStore'
import type { Paciente } from '../../../../domains/clinical/patient/schemas/pacienteSchema'

describe('ModalNuevaCita — Validación de Paciente Bloqueado', () => {
  const pacienteActivo: Paciente = {
    id: 'pac-1',
    nombre: 'Ana María',
    apellido: 'Gómez',
    rut: '12.345.678-5',
    telefono: '+56911112222',
    estado: 'activo',
  } as Paciente

  const pacienteBloqueado: Paciente = {
    id: 'pac-2',
    nombre: 'Carlos',
    apellido: 'Mendoza',
    rut: '11.111.111-1',
    telefono: '+56933334444',
    estado: 'bloqueado',
    bloqueado: true,
    motivoBloqueo: 'Incomparecencia reiterada sin aviso',
  } as Paciente

  beforeEach(() => {
    usePacientesStore.setState({
      pacientes: [pacienteActivo, pacienteBloqueado],
    })
  })

  it('permite seleccionar un paciente activo sin alertas de bloqueo', () => {
    render(
      <ModalNuevaCita
        pacientes={[pacienteActivo, pacienteBloqueado]}
        alGuardar={vi.fn()}
        alCerrar={vi.fn()}
      />
    )

    const trigger = screen.getByRole('combobox', { name: /Seleccionar Paciente/i })
    fireEvent.click(trigger)
    const option = screen.getByRole('option', { name: /Ana María/i })
    fireEvent.click(option)

    expect(screen.queryByTestId('alerta-paciente-bloqueado')).not.toBeInTheDocument()
    const btnConfirmar = screen.getByTestId('btn-confirmar-cita')
    expect(btnConfirmar).not.toBeDisabled()
  })

  it('muestra alerta roja y deshabilita confirmar cita al seleccionar paciente bloqueado', () => {
    render(
      <ModalNuevaCita
        pacientes={[pacienteActivo, pacienteBloqueado]}
        alGuardar={vi.fn()}
        alCerrar={vi.fn()}
      />
    )

    const trigger = screen.getByRole('combobox', { name: /Seleccionar Paciente/i })
    fireEvent.click(trigger)
    const option = screen.getByRole('option', { name: /Carlos Mendoza/i })
    fireEvent.click(option)

    const alerta = screen.getByTestId('alerta-paciente-bloqueado')
    expect(alerta).toBeInTheDocument()
    expect(alerta.textContent).toContain('Incomparecencia reiterada sin aviso')

    const btnConfirmar = screen.getByTestId('btn-confirmar-cita')
    expect(btnConfirmar).toBeDisabled()
  })

  it('BP05 §02: precarga duración según prestación seleccionada', () => {
    usePrestacionesStore.setState({
      prestaciones: [
        { id: '1', nombre: 'Endodoncia', duracionEstimada: 90 },
        { id: '2', nombre: 'Limpieza dental', duracionEstimada: 30 },
      ] as any,
      prestacionesArancel: [
        { id: '1', nombre: 'Endodoncia', duracionEstimada: 90 },
        { id: '2', nombre: 'Limpieza dental', duracionEstimada: 30 },
      ] as any,
    })

    render(
      <ModalNuevaCita
        pacientes={[]}
        alGuardar={vi.fn()}
        alCerrar={vi.fn()}
      />
    )

    // Seleccionar prestación "Endodoncia"
    fireEvent.change(screen.getByLabelText(/prestación/i), { target: { value: '1' } })

    // Duración debe precargarse a 90 min
    const duracionSelect = screen.getByLabelText(/duración/i)
    expect(duracionSelect).toHaveValue('90')
  })

  it('BP05 §02: selector de duración solo muestra tramos oficiales [15,30,45,60,90,120]', () => {
    render(<ModalNuevaCita pacientes={[]} alGuardar={vi.fn()} alCerrar={vi.fn()} />)

    const duracionSelect = screen.getByLabelText(/duración/i)
    const options = within(duracionSelect).getAllByRole('option')
    const values = options.map(o => o.getAttribute('value'))

    expect(values).toEqual(['15', '30', '45', '60', '90', '120'])
    expect(values).not.toContain('20') // 20 min ya no es válido
  })
})
