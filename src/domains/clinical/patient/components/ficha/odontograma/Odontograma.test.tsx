import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Odontograma } from './Odontograma'
import { fichasClinicasStorageService } from '../../../services/fichasClinicasStorageService'

vi.mock('../../../services/fichasClinicasStorageService', () => ({
  fichasClinicasStorageService: {
    obtenerFichaClinica: vi.fn().mockResolvedValue(null),
    guardarSeccionFicha: vi.fn().mockResolvedValue(true),
  },
}))

describe('Odontograma BP06', () => {
  it('renderiza arcadas superior e inferior con 32 piezas', () => {
    render(<Odontograma />)
    expect(screen.getByTestId('odontograma-completo-bp06')).toBeInTheDocument()
    expect(screen.getByTestId('pieza-dental-1.1')).toBeInTheDocument()
    expect(screen.getByTestId('pieza-dental-4.8')).toBeInTheDocument()
    expect(screen.queryByTestId('odontograma-panel-estados')).not.toBeInTheDocument()
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

  it('llama a onGuardar solo después de persistir los datos del paciente', async () => {
    vi.mocked(fichasClinicasStorageService.obtenerFichaClinica).mockResolvedValue(null)
    vi.mocked(fichasClinicasStorageService.guardarSeccionFicha).mockResolvedValue(true)
    const onGuardar = vi.fn()
    render(<Odontograma pacienteId="paciente-1" onGuardar={onGuardar} />)

    const btnGuardar = screen.getByText('Guardar Odontograma')
    fireEvent.click(btnGuardar)

    await waitFor(() => expect(onGuardar).toHaveBeenCalled())
    expect(fichasClinicasStorageService.guardarSeccionFicha).toHaveBeenCalledWith(
      'paciente-1', 'odontograma', expect.objectContaining({ piezasData: expect.any(Object) })
    )
  })

  it('abre el panel lateral al hacer click en una pieza dental con sus 5 caras', () => {
    render(<Odontograma />)
    const btnPieza11 = screen.getByTitle('Pieza 1.1')
    fireEvent.click(btnPieza11)

    // Panel lateral visible
    expect(screen.getByTestId('odontograma-panel-lateral')).toBeInTheDocument()
    expect(screen.getByText('Pieza 1.1')).toBeInTheDocument()
    expect(screen.getByText('Vestibular')).toBeInTheDocument()
    expect(screen.getByText('Oclusal / Incisal')).toBeInTheDocument()
    expect(screen.getByText('Lingual / Palatino')).toBeInTheDocument()
    expect(screen.getByText('Mesial')).toBeInTheDocument()
    expect(screen.getByText('Distal')).toBeInTheDocument()

    // Cerrar panel
    const btnListo = screen.getByText('Listo')
    fireEvent.click(btnListo)
    expect(screen.queryByTestId('odontograma-panel-lateral')).not.toBeInTheDocument()
  })
})
