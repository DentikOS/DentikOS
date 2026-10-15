import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ModalDiasFestivos } from './ModalDiasFestivos'
import { clinicConfigService } from '../services/clinicConfigService'

vi.mock('../services/clinicConfigService', () => ({
  clinicConfigService: {
    obtenerFestivos: vi.fn(),
    agregarFestivo: vi.fn(),
    eliminarFestivo: vi.fn(),
  }
}))

describe('ModalDiasFestivos (BP05 §09)', () => {
  beforeEach(() => {
    vi.mocked(clinicConfigService.obtenerFestivos).mockResolvedValue([
      { id: '1', fecha: '2026-12-25', nombre: 'Navidad', tipo: 'nacional', recurrente: true, createdAt: '2026-01-01' },
      { id: '2', fecha: '2026-09-18', nombre: 'Fiestas Patrias', tipo: 'nacional', recurrente: true, createdAt: '2026-01-01' },
    ])
    vi.mocked(clinicConfigService.agregarFestivo).mockResolvedValue(true)
    vi.mocked(clinicConfigService.eliminarFestivo).mockResolvedValue(true)
  })

  it('muestra lista de festivos precargados', async () => {
    render(<ModalDiasFestivos isOpen={true} alCerrar={() => {}} />)
    
    await waitFor(() => {
      expect(screen.getByText('Navidad')).toBeInTheDocument()
      expect(screen.getByText('Fiestas Patrias')).toBeInTheDocument()
    })
  })

  it('muestra botón para agregar nuevo festivo', async () => {
    render(<ModalDiasFestivos isOpen={true} alCerrar={() => {}} />)
    expect(screen.getByText(/Agregar día festivo/i)).toBeInTheDocument()
  })

  it('muestra aviso sobre festivos recurrentes', async () => {
    render(<ModalDiasFestivos isOpen={true} alCerrar={() => {}} />)
    expect(screen.getByText(/festivos recurrentes/i)).toBeInTheDocument()
  })
})
