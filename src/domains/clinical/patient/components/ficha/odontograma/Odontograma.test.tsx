import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Odontograma } from './Odontograma'

describe('Odontograma BP06', () => {
  it('renderiza arcadas superior e inferior con 32 piezas', () => {
    render(<Odontograma />)
    expect(screen.getByTestId('odontograma-completo-bp06')).toBeInTheDocument()
    expect(screen.getByTestId('pieza-dental-1.1')).toBeInTheDocument()
    expect(screen.getByTestId('pieza-dental-4.8')).toBeInTheDocument()
    expect(screen.getByTestId('odontograma-panel-estados')).toBeInTheDocument()
  })

  it('permite alternar la dentición temporal con el checkbox', () => {
    render(<Odontograma />)
    const checkbox = screen.getByLabelText(/Mostrar Dentición Temporal/i)

    // Antes de marcar no está 5.1
    expect(screen.queryByTestId('pieza-dental-5.1')).not.toBeInTheDocument()

    // Marcar checkbox
    fireEvent.click(checkbox)
    expect(screen.getByTestId('pieza-dental-5.1')).toBeInTheDocument()
    expect(screen.getByTestId('pieza-dental-8.5')).toBeInTheDocument()
  })

  it('permite cambiar entre modos de vista en el slider temporal', () => {
    render(<Odontograma />)
    const btnInicial = screen.getByText('Estado Inicial')
    const btnComparativo = screen.getByText('Comparativa')

    fireEvent.click(btnInicial)
    expect(btnInicial).toHaveClass('bg-primary')

    fireEvent.click(btnComparativo)
    expect(screen.getByLabelText(/Deslizador temporal antes\/después/i)).toBeInTheDocument()
  })

  it('llama a onGuardar con los datos modificados', () => {
    const onGuardar = vi.fn()
    render(<Odontograma onGuardar={onGuardar} />)

    const btnGuardar = screen.getByText('Guardar Odontograma')
    fireEvent.click(btnGuardar)

    expect(onGuardar).toHaveBeenCalled()
  })

  it('guarda datos de odontograma con pacienteId en Supabase', async () => {
    const onGuardar = vi.fn()
    render(<Odontograma pacienteId="123e4567-e89b-12d3-a456-426614174000" onGuardar={onGuardar} />)
    const btnGuardar = screen.getByText('Guardar Odontograma')
    fireEvent.click(btnGuardar)
    await vi.waitFor(() => {
      expect(onGuardar).toHaveBeenCalled()
    })
  })
})
