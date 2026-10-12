import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SugerenciaCompletitud } from './SugerenciaCompletitud'
import type { Paciente } from '../../schemas/pacienteSchema'

describe('SugerenciaCompletitud', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('muestra banner suave si el paciente fue creado recientemente y le faltan datos', () => {
    const paciente = {
      id: 'p-1',
      nombre: 'Nuevo Paciente',
      fechaCreacion: new Date().toISOString(),
      email: '',
    } as Paciente

    render(<SugerenciaCompletitud paciente={paciente} />)
    expect(screen.getByTestId('sugerencia-completitud-banner')).toBeInTheDocument()
    expect(screen.getByText('Antecedentes incompletos')).toBeInTheDocument()
  })

  it('permite descartar la sugerencia con la X y persiste la decisión', () => {
    const paciente = {
      id: 'p-1',
      nombre: 'Nuevo Paciente',
      fechaCreacion: new Date().toISOString(),
      email: '',
    } as Paciente

    render(<SugerenciaCompletitud paciente={paciente} />)
    const btnCerrar = screen.getByRole('button', { name: /descartar sugerencia/i })
    fireEvent.click(btnCerrar)

    expect(screen.queryByTestId('sugerencia-completitud-banner')).not.toBeInTheDocument()
    expect(localStorage.getItem('sugerencia_completitud_descartada_p-1')).toBe('true')
  })

  it('llama onCompletar al hacer clic en "Completar ahora"', () => {
    const paciente = {
      id: 'p-1',
      nombre: 'Nuevo Paciente',
      fechaCreacion: new Date().toISOString(),
      email: '',
    } as Paciente

    const onCompletar = vi.fn()
    render(<SugerenciaCompletitud paciente={paciente} onCompletar={onCompletar} />)

    const btnCompletar = screen.getByRole('button', { name: /completar ahora/i })
    fireEvent.click(btnCompletar)

    expect(onCompletar).toHaveBeenCalled()
  })
})
