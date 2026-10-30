import React from 'react'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { PlanTratamiento } from './PlanTratamiento'
import { useOdontogramaStore } from '../../../../../../app/stores/odontogramaStore'
import { fichasClinicasStorageService } from '../../../services/fichasClinicasStorageService'

vi.mock('../../../services/fichasClinicasStorageService', () => ({
  fichasClinicasStorageService: {
    obtenerFichaClinica: vi.fn().mockResolvedValue(null),
    guardarSeccionFicha: vi.fn().mockResolvedValue(true),
  },
}))

vi.mock('../../../../../organization/prestations/services/prestacionesStorageService', () => ({
  prestacionesStorageService: {
    obtenerPrestaciones: vi.fn(() => [{
      id: 'prest-1', nombre: 'Restauración clínica configurada', especialidad: 'Operatoria',
      precioParticular: 42000, precioFonasa: 42000, codigoFonasa: '01-02-010',
    }]),
  },
}))

const pacienteId = 'pac-test'

describe('PlanTratamiento BP06', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fichasClinicasStorageService.obtenerFichaClinica).mockResolvedValue(null)
    vi.mocked(fichasClinicasStorageService.guardarSeccionFicha).mockResolvedValue(true)
    act(() => useOdontogramaStore.getState().setOdontograma(null, pacienteId))
  })

  it('muestra cuatro fases y ningún tratamiento inventado para un odontograma vacío', () => {
    render(<PlanTratamiento pacienteId={pacienteId} nombrePaciente="María Valenzuela" />)
    expect(screen.getByText(/Fase 1: Urgencias/i)).toBeInTheDocument()
    expect(screen.getByText(/Fase 4: Estética/i)).toBeInTheDocument()
    expect(screen.getByText('No hay patologías registradas')).toBeInTheDocument()
    expect(screen.queryByText(/Profilaxis y control preventivo/i)).not.toBeInTheDocument()
  })

  it('deja hallazgos sin precio y exige prestación y fase revisadas', async () => {
    act(() => useOdontogramaStore.getState().setOdontograma({ piezas: [
      { numero: '1.6', estado: 'patologia', tipoPatologia: 'caries' },
    ] }, pacienteId))
    render(<PlanTratamiento pacienteId={pacienteId} nombrePaciente="María Valenzuela" />)
    expect(screen.getByText('Sin precio · revisión clínica')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-generar-presupuesto-plan'))
    expect(screen.queryByTestId('modal-nuevo-presupuesto')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('resuelve cada hallazgo')

    fireEvent.change(screen.getByLabelText('Prestación para pieza 1.6'), { target: { value: 'prest-1' } })
    fireEvent.change(screen.getByLabelText('Fase para pieza 1.6'), { target: { value: 'estabilizacion' } })
    expect(screen.getAllByText('$42.000').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId('btn-guardar-plan'))
    await waitFor(() => expect(fichasClinicasStorageService.guardarSeccionFicha).toHaveBeenCalledWith(
      pacienteId, 'plan_tratamiento', expect.objectContaining({ fases: expect.any(Array) })
    ))
    await waitFor(() => expect(screen.getByText('Plan guardado')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('btn-generar-presupuesto-plan'))
    expect(screen.getByTestId('modal-nuevo-presupuesto')).toBeInTheDocument()
  })

  it('no muestra hallazgos guardados de otro paciente', () => {
    act(() => useOdontogramaStore.getState().setOdontograma({ piezas: [
      { numero: '2.4', estado: 'patologia', tipoPatologia: 'fractura' },
    ] }, 'otro-paciente'))
    render(<PlanTratamiento pacienteId={pacienteId} />)
    expect(screen.queryByText(/Hallazgo fractura/i)).not.toBeInTheDocument()
  })

  it('conserva un plan guardado al cargarse el odontograma del mismo paciente', async () => {
    const actualizadoAt = '2026-10-30T12:00:00Z'
    vi.mocked(fichasClinicasStorageService.obtenerFichaClinica).mockResolvedValue({
      odontograma: { actualizadoAt, piezas: [{ numero: '1.6', estado: 'patologia', tipoPatologia: 'caries' }] },
      plan_tratamiento: { odontogramaActualizadoAt: actualizadoAt, fases: [
        { id: 'fase-urgencias', nombre: 'Fase 1: Urgencias', subtitulo: 'Asignación clínica', procedimientos: [{
          id: 'hallazgo-1.6-0', descripcion: 'Prestación revisada (P.1.6)', pieza: '1.6',
          hallazgo: 'caries', prestacionId: 'prest-1', faseAsignada: 'urgencias', costo: 42000,
          requiereRevision: false, estado: 'pendiente',
        }] },
      ] },
    } as any)
    render(<PlanTratamiento pacienteId={pacienteId} />)
    await waitFor(() => expect(screen.getByText('Prestación revisada (P.1.6)')).toBeInTheDocument())
    act(() => useOdontogramaStore.getState().setOdontograma({
      actualizadoAt, piezas: [{ numero: '1.6', estado: 'patologia', tipoPatologia: 'caries' }],
    }, pacienteId))
    expect(screen.getByText('Prestación revisada (P.1.6)')).toBeInTheDocument()
    expect(screen.getByText('Plan guardado')).toBeInTheDocument()
  })

  it('no convierte una pieza sana en patología al leer la ficha', async () => {
    vi.mocked(fichasClinicasStorageService.obtenerFichaClinica).mockResolvedValue({
      odontograma: { piezasData: { '1.6': { estadoGeneral: 'sano', caras: { oclusal: 'sano' } } } },
    } as any)
    render(<PlanTratamiento pacienteId={pacienteId} />)
    await waitFor(() => expect(fichasClinicasStorageService.obtenerFichaClinica).toHaveBeenCalledWith(pacienteId))
    expect(screen.getByText('No hay patologías registradas')).toBeInTheDocument()
  })
})
