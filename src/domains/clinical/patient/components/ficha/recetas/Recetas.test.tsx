import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Recetas } from './Recetas'
import type { Paciente } from '../../../schemas/pacienteSchema'

const PACIENTE_MOCK: Paciente = {
  id: 'pac-1',
  nombre: 'Marta Pérez',
  rut: '12.345.678-9',
  alergias: 'Ninguna',
  estado: 'activo'
}

describe('Recetas con autocompletado Vademécum', () => {
  it('permite buscar y autocompletar fármacos desde el Vademécum', () => {
    render(<Recetas paciente={PACIENTE_MOCK} />)

    const input = screen.getByTestId('input-medicamento-vademecum')
    fireEvent.change(input, { target: { value: 'Amoxi' } })

    const sugerencias = screen.getAllByTestId('item-sugerencia-vademecum')
    expect(sugerencias.length).toBeGreaterThan(0)
    expect(sugerencias[0].textContent).toContain('Amoxicilina')

    fireEvent.click(sugerencias[0])
    expect((input as HTMLInputElement).value).toContain('Amoxicilina')
  })
})
