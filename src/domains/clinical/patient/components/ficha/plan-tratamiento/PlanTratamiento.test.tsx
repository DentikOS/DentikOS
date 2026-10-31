import React from 'react'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { PlanTratamiento } from './PlanTratamiento'
import { useOdontogramaStore } from '../../../../../../app/stores/odontogramaStore'
import { usePrestacionesStore } from '../../../../../../app/stores/prestacionesStore'
import { useSesionStore } from '../../../../../../app/stores/sesionStore'
import { usePacientesStore } from '../../../../../../app/stores/pacientesStore'
import { fichasClinicasStorageService } from '../../../services/fichasClinicasStorageService'
import { presupuestosStorageService } from '../../../../../billing/budget/services/presupuestosStorageService'
import { presupuestoPlanSyncService } from '../../../../../billing/budget/services/presupuestoPlanSyncService'
import { derivacionesService } from './derivacionesService'
import * as authService from '../../../../../../infrastructure/auth/authService'

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
    guardarPrestaciones: vi.fn(() => true),
  },
}))

const pacienteId = 'pac-test'

describe('PlanTratamiento BP06', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    useSesionStore.setState({ userProfile: null })
    vi.mocked(fichasClinicasStorageService.obtenerFichaClinica).mockResolvedValue(null)
    vi.mocked(fichasClinicasStorageService.guardarSeccionFicha).mockResolvedValue(true)
    vi.spyOn(presupuestosStorageService, 'sincronizarDesdeSupabase').mockResolvedValue([])
    usePrestacionesStore.setState({ prestacionesArancel: [{
      id: 'prest-1', nombre: 'Restauración clínica configurada', especialidad: 'Operatoria',
      precioParticular: 42000, precioFonasa: 42000, codigoFonasa: '01-02-010',
    }] })
    act(() => useOdontogramaStore.getState().setOdontograma(null, pacienteId))
  })

  it('muestra cuatro fases y ningún tratamiento inventado para un odontograma vacío', () => {
    render(<PlanTratamiento pacienteId={pacienteId} nombrePaciente="María Valenzuela" />)
    expect(screen.getByText(/Fase 1: Urgencias/i)).toBeInTheDocument()
    expect(screen.getByText(/Fase 4: Estética/i)).toBeInTheDocument()
    expect(screen.getByText('No hay patologías registradas')).toBeInTheDocument()
    expect(screen.queryByText(/Profilaxis y control preventivo/i)).not.toBeInTheDocument()
  })

  it('ofrece la emisión clínica solo a dentista o administración', () => {
    render(<PlanTratamiento pacienteId={pacienteId} />)
    expect(screen.queryByRole('button', { name: 'Ficha Derivación' })).not.toBeInTheDocument()
    act(() => useSesionStore.setState({ userProfile: { email: 'dentista@example.test', rol: 'dentista' } }))
    expect(screen.getByRole('button', { name: 'Ficha Derivación' })).toBeInTheDocument()
  })

  it('abre los antecedentes referenciados de una derivación desde la ficha', async () => {
    vi.spyOn(derivacionesService, 'listar').mockResolvedValue([{
      id: 'derivacion-1', fecha: '2026-10-30T10:00:00Z', especialidad: 'Endodoncia',
      especialista: 'Dra. R', motivo: 'Hallazgo revisado', prioridad: 'normal',
      archivoIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'], incluirOdontograma: true,
    }])
    render(<PlanTratamiento pacienteId={pacienteId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ver 1 archivo(s)' }))
    expect(usePacientesStore.getState().pestanaActiva).toBe('recetas-consentimientos')
    fireEvent.click(screen.getByRole('button', { name: 'Ver odontograma' }))
    expect(usePacientesStore.getState().pestanaActiva).toBe('odontograma')
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

  it('actualiza el selector cuando se agrega una prestación en otra sección de la app', () => {
    usePrestacionesStore.setState({ prestacionesArancel: [] })
    act(() => useOdontogramaStore.getState().setOdontograma({ piezas: [
      { numero: '1.6', estado: 'patologia', tipoPatologia: 'caries' },
    ] }, pacienteId))
    render(<PlanTratamiento pacienteId={pacienteId} />)
    expect(screen.queryByRole('option', { name: /Restauración clínica configurada/ })).not.toBeInTheDocument()
    act(() => usePrestacionesStore.getState().setPrestacionesArancel([{
      id: 'prest-1', nombre: 'Restauración clínica configurada', especialidad: 'Operatoria',
      precioParticular: 42000, precioFonasa: 42000, codigoFonasa: '01-02-010',
    }]))
    expect(screen.getByRole('option', { name: /Restauración clínica configurada/ })).toBeInTheDocument()
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

  it('muestra el plan completado al confirmarse el saldo y realizarse el tratamiento', async () => {
    vi.spyOn(authService, 'getClinicaActivaSync').mockReturnValue('aaaaaaaa-0000-4000-8000-000000000001')
    const presupuesto = {
      id: 'bbbbbbbb-1111-4222-8333-444444444444', folio: 'PRE-47', pacienteId, origenPlan: true,
      planRevision: 'revision-anterior', versionGrupoId: 'grupo-1', version: 1,
      montoTotal: 42000, montoAbonado: 0, estado: 'en-curso', sincronizado: true,
      items: [{ id: 'item-1', origenPlanProcedimientoId: 'proc-1', codigoPrestacion: 'prest-1', precioPlanOriginal: 42000 }],
    }
    const obtener = vi.spyOn(presupuestosStorageService, 'obtenerPresupuestos').mockReturnValue([presupuesto])
    vi.mocked(fichasClinicasStorageService.obtenerFichaClinica).mockResolvedValue({
      odontograma: { actualizadoAt: 'od-1', piezas: [] },
      plan_tratamiento: { actualizadoAt: 'revision-clinica-nueva', odontogramaActualizadoAt: 'od-1', fases: [{
        id: 'fase-urgencias', nombre: 'Urgencias', subtitulo: '', procedimientos: [{
          id: 'proc-1', descripcion: 'Control', prestacionId: 'prest-1', faseAsignada: 'urgencias',
          costo: 42000, requiereRevision: false, estado: 'realizado',
        }],
      }] },
    } as any)

    render(<PlanTratamiento pacienteId={pacienteId} />)
    await waitFor(() => expect(screen.getByTestId('estado-plan-tratamiento')).toHaveTextContent('saldo pendiente'))
    expect(screen.getByText('Aprobado en PRE-47 v1')).toBeInTheDocument()
    obtener.mockReturnValue([{ ...presupuesto, montoAbonado: 42000, estado: 'completado' }])
    act(() => window.dispatchEvent(new Event('presupuestos_actualizados')))
    await waitFor(() => expect(screen.getByTestId('estado-plan-tratamiento')).toHaveTextContent('Plan completado'))
  })

  it('conserva el plan clínico y bloquea el presupuesto cuando cambia el odontograma', async () => {
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
      actualizadoAt: '2026-10-30T13:00:00Z', piezas: [{ numero: '2.4', estado: 'patologia', tipoPatologia: 'fractura' }],
    }, pacienteId))
    expect(screen.getByText('Prestación revisada (P.1.6)')).toBeInTheDocument()
    expect(screen.getByText(/El odontograma cambió desde que se guardó este plan/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-generar-presupuesto-plan'))
    expect(screen.queryByTestId('modal-nuevo-presupuesto')).not.toBeInTheDocument()
    expect(screen.queryByText(/Hallazgo fractura/)).not.toBeInTheDocument()
  })

  it('no convierte una pieza sana en patología al leer la ficha', async () => {
    vi.mocked(fichasClinicasStorageService.obtenerFichaClinica).mockResolvedValue({
      odontograma: { piezasData: { '1.6': { estadoGeneral: 'sano', caras: { oclusal: 'sano' } } } },
    } as any)
    render(<PlanTratamiento pacienteId={pacienteId} />)
    await waitFor(() => expect(fichasClinicasStorageService.obtenerFichaClinica).toHaveBeenCalledWith(pacienteId))
    expect(screen.getByText('No hay patologías registradas')).toBeInTheDocument()
  })

  it('ofrece nueva versión sin alterar el presupuesto aprobado anterior', async () => {
    vi.mocked(fichasClinicasStorageService.obtenerFichaClinica).mockResolvedValue({
      odontograma: { piezas: [] },
      plan_tratamiento: { actualizadoAt: 'revision-nueva', fases: [{
        id: 'fase-urgencias', nombre: 'Fase 1: Urgencias', subtitulo: '', procedimientos: [{
          id: 'proc-1', descripcion: 'Tratamiento revisado', pieza: '1.6', hallazgo: 'caries',
          prestacionId: 'prest-1', faseAsignada: 'urgencias', costo: 42000, requiereRevision: false,
        }],
      }] },
    } as any)
    vi.mocked(presupuestosStorageService.sincronizarDesdeSupabase).mockResolvedValue([{
      id: '33333333-3333-4333-8333-333333333333', pacienteId, origenPlan: true,
      versionGrupoId: '44444444-4444-4444-8444-444444444444', version: 1,
      planRevision: 'revision-anterior', estado: 'aprobado', folio: 'PRE-1', items: [],
    }])
    const crear = vi.spyOn(presupuestoPlanSyncService, 'crearVersionDesdePlan').mockResolvedValue('55555555-5555-4555-8555-555555555555')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'prompt').mockReturnValue('Cambio clínico')
    render(<PlanTratamiento pacienteId={pacienteId} />)
    const boton = await screen.findByRole('button', { name: 'Crear nueva versión' })
    fireEvent.click(boton)
    await waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({ folio: 'PRE-1', estado: 'aprobado' }),
      pacienteId, 'revision-nueva', expect.any(Array), 'Cambio clínico'))
  })

  it('permite retomar la actualización de un borrador cuando se pospuso al guardar el plan', async () => {
    vi.mocked(fichasClinicasStorageService.obtenerFichaClinica).mockResolvedValue({
      odontograma: { piezas: [] },
      plan_tratamiento: { actualizadoAt: 'revision-nueva', fases: [{
        id: 'fase-urgencias', nombre: 'Fase 1: Urgencias', subtitulo: '', procedimientos: [{
          id: 'proc-1', descripcion: 'Tratamiento revisado', pieza: '1.6', hallazgo: 'caries',
          prestacionId: 'prest-1', faseAsignada: 'urgencias', costo: 42000, requiereRevision: false,
        }],
      }] },
    } as any)
    vi.mocked(presupuestosStorageService.sincronizarDesdeSupabase).mockResolvedValue([{
      id: '33333333-3333-4333-8333-333333333333', pacienteId, origenPlan: true,
      versionGrupoId: '44444444-4444-4444-8444-444444444444', version: 1,
      planRevision: 'revision-anterior', estado: 'borrador', folio: 'PRE-1', items: [],
    }])
    const actualizar = vi.spyOn(presupuestoPlanSyncService, 'actualizarBorrador').mockResolvedValue()
    vi.spyOn(window, 'prompt').mockReturnValue('Actualización de plan')
    render(<PlanTratamiento pacienteId={pacienteId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Actualizar borrador' }))
    await waitFor(() => expect(actualizar).toHaveBeenCalledWith(expect.objectContaining({ folio: 'PRE-1', estado: 'borrador' }),
      pacienteId, 'revision-nueva', expect.any(Array), 'Actualización de plan'))
    expect(screen.queryByRole('button', { name: 'Actualizar borrador' })).not.toBeInTheDocument()
  })
})
