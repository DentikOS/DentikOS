import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModalNuevoPaciente } from './ModalNuevoPaciente'
import type { Paciente } from '../schemas/pacienteSchema'

describe('ModalNuevoPaciente', () => {
  const mockPacientes: Paciente[] = [
    {
      id: 'p-1',
      nombre: 'Ana María',
      rut: '12.345.678-5',
      telefono: '+56911112222',
      estado: 'activo',
    } as Paciente,
  ]

  it('guarda un paciente nuevo con estado "nuevo" y fechaCreacion', () => {
    const alGuardar = vi.fn()
    const alCerrar = vi.fn()

    render(
      <ModalNuevoPaciente
        alGuardar={alGuardar}
        alCerrar={alCerrar}
        pacientes={mockPacientes}
      />
    )

    fireEvent.change(screen.getByTestId('paciente-nombre'), { target: { value: 'Carlos Mendoza' } })
    fireEvent.change(screen.getByTestId('paciente-rut'), { target: { value: '11.111.111-1' } })
    fireEvent.change(screen.getByTestId('paciente-telefono'), { target: { value: '+56 9 8765 4321' } })

    const btnCrear = screen.getByTestId('paciente-crear')
    fireEvent.click(btnCrear)

    expect(alGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Carlos Mendoza',
        estado: 'nuevo',
        fechaCreacion: expect.any(String),
      })
    )
  })

  it('detecta duplicado de RUT y ofrece botón "Ver ficha existente"', () => {
    const alGuardar = vi.fn()
    const alCerrar = vi.fn()
    const onVerFichaExistente = vi.fn()

    render(
      <ModalNuevoPaciente
        alGuardar={alGuardar}
        alCerrar={alCerrar}
        pacientes={mockPacientes}
        onVerFichaExistente={onVerFichaExistente}
      />
    )

    fireEvent.change(screen.getByTestId('paciente-rut'), { target: { value: '12.345.678-5' } })

    expect(screen.getByText('Este RUT ya está registrado')).toBeInTheDocument()
    const btnVerFicha = screen.getByTestId('btn-ver-ficha-existente')
    expect(btnVerFicha).toBeInTheDocument()

    fireEvent.click(btnVerFicha)
    expect(onVerFichaExistente).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-1', nombre: 'Ana María' })
    )
  })
})
