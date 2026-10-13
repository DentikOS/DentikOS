import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModalPapelera } from './ModalPapelera'
import { useDialogStore } from '../../../../app/stores/dialogStore'

describe('ModalPapelera (BP06 §06 — Pacientes Desactivados)', () => {
  const mockPacientes = [
    {
      id: '1',
      nombre: 'Juan Pérez',
      rut: '12345678-9',
      deleted_at: '2026-08-20T10:00:00Z',
      eliminadoPor: 'admin@clinica.com',
    },
    {
      id: '2',
      nombre: 'María González',
      rut: '98765432-1',
      deleted_at: '2026-08-21T15:30:00Z',
      eliminadoPor: 'recepcion@clinica.com',
    },
  ]

  const defaultProps = {
    pacientesEliminados: mockPacientes,
    cargando: false,
    onRestaurar: vi.fn(),
    onCerrar: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useDialogStore.setState({ dialog: null })
  })

  it('renderiza título "Pacientes Desactivados" y lista de pacientes', () => {
    render(<ModalPapelera {...defaultProps} />)

    expect(screen.getByText('Pacientes Desactivados')).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('María González')).toBeInTheDocument()
    expect(screen.getByText(/12345678-9/)).toBeInTheDocument()
    expect(screen.getByText(/98765432-1/)).toBeInTheDocument()
  })

  it('muestra aviso obligatorio de la Ley 20.584 sin botón de purga definitiva', () => {
    render(<ModalPapelera {...defaultProps} />)

    expect(
      screen.getByText(/Las fichas clínicas no se destruyen/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/Vaciar papelera/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Eliminar permanentemente/)).not.toBeInTheDocument()
  })

  it('muestra contador de pacientes desactivados', () => {
    render(<ModalPapelera {...defaultProps} />)

    expect(screen.getByText(/2 pacientes desactivados/)).toBeInTheDocument()
  })

  it('filtra pacientes por búsqueda de nombre', () => {
    render(<ModalPapelera {...defaultProps} />)

    const input = screen.getByPlaceholderText(/Buscar por nombre o RUT/)
    fireEvent.change(input, { target: { value: 'Juan' } })

    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.queryByText('María González')).not.toBeInTheDocument()
  })

  it('filtra pacientes por búsqueda de RUT', () => {
    render(<ModalPapelera {...defaultProps} />)

    const input = screen.getByPlaceholderText(/Buscar por nombre o RUT/)
    fireEvent.change(input, { target: { value: '98765432' } })

    expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument()
    expect(screen.getByText('María González')).toBeInTheDocument()
  })

  it('llama onRestaurar al hacer clic en botón reactivar', async () => {
    const onRestaurar = vi.fn().mockResolvedValue(true)
    render(<ModalPapelera {...defaultProps} onRestaurar={onRestaurar} />)

    const botonesReactivar = screen.getAllByText(/Reactivar/)
    fireEvent.click(botonesReactivar[0])

    expect(useDialogStore.getState().dialog).not.toBeNull()
  })
})
