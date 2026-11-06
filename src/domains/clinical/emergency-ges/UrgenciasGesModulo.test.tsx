import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { UrgenciasGesModulo } from './UrgenciasGesModulo'

const mocks = vi.hoisted(() => ({
  role: 'recepcion' as string,
  refresh: vi.fn(),
  sync: vi.fn(),
  cargarPacientes: vi.fn(),
  pacientes: [] as Array<{ id: string; nombre: string; nombreCompleto: string; rut: string; clinicaId: string }>,
  snapshot: { ingresos: [] as any[], triajes: [] as any[], fichas: [] as any[], eventos: [] as any[], configuraciones: [] as any[] },
  fichaSeleccionada: null as any
}))

vi.mock('./hooks/useUrgenciasGes', () => ({
  useUrgenciasGes: () => ({
    snapshot: mocks.snapshot,
    atencionesHistoricas: [], fichaSeleccionada: mocks.fichaSeleccionada, setFichaSeleccionada: vi.fn(),
    atencionHistoricaSeleccionada: null, setAtencionHistoricaSeleccionada: vi.fn(),
    loading: false, error: null, pendientesCount: 0,
    refresh: mocks.refresh, sincronizarPendientes: mocks.sync,
    registrarIngreso: vi.fn(), guardarTriage: vi.fn(), crearFicha: vi.fn(),
    actualizarEstadoFicha: vi.fn(), guardarCambiosFicha: vi.fn(), agregarEnmienda: vi.fn(),
    guardarConfiguracion: vi.fn()
  })
}))

vi.mock('../../../shared/hooks/useRBAC', () => ({
  useRBAC: () => ({
    rol: mocks.role,
    puede: (permission: string) => {
      if (permission === 'ver_cola_urgencia') return ['recepcion', 'asistente', 'dentista', 'admin'].includes(mocks.role)
      if (permission === 'gestionar_triage_urgencia') return ['asistente', 'dentista', 'admin'].includes(mocks.role)
      if (permission === 'ver_urgencias_ges') return ['dentista', 'admin'].includes(mocks.role)
      return permission === 'configurar_ges_clinica' && mocks.role === 'admin'
    }
  })
}))

vi.mock('../../../app/stores/pacientesStore', () => ({
  usePacientesStore: (selector: (state: { pacientes: typeof mocks.pacientes; cargarPacientes: () => Promise<void> }) => unknown) => selector({ pacientes: mocks.pacientes, cargarPacientes: mocks.cargarPacientes })
}))

vi.mock('../../../app/stores/sesionStore', () => ({
  useSesionStore: (selector: (state: { clinicaActual: string; userProfile: null }) => unknown) => selector({ clinicaActual: 'a0000000-0000-4000-8000-000000000001', userProfile: null })
}))

vi.mock('../../../infrastructure/supabase/supabaseClient', () => ({ USE_SUPABASE: true }))
vi.mock('./components/FichaUrgenciaDetalle', () => ({ FichaUrgenciaDetalle: () => 'Detalle clínico' }))

beforeEach(() => {
  mocks.role = 'recepcion'
  mocks.pacientes = []
  mocks.snapshot = { ingresos: [], triajes: [], fichas: [], eventos: [], configuraciones: [] }
  mocks.fichaSeleccionada = null
  vi.clearAllMocks()
})

describe('UrgenciasGesModulo por rol', () => {
  it('sincroniza el directorio del tenant activo al abrir Urgencias GES', () => {
    render(<UrgenciasGesModulo onAbrirFichaPaciente={vi.fn()} />)

    expect(mocks.cargarPacientes).toHaveBeenCalledOnce()
  })

  it('recepción ve la cola mínima, sin triage, ficha ni protocolos', () => {
    render(<UrgenciasGesModulo onAbrirFichaPaciente={vi.fn()} />)

    expect(screen.getByText(/Cola de llegadas/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar llegada' })).toBeInTheDocument()
    expect(screen.queryByText('Triage inicial')).not.toBeInTheDocument()
    expect(screen.queryByText('Ficha clínica de urgencia')).not.toBeInTheDocument()
    expect(screen.queryByText(/BORRADOR CLÍNICO/)).not.toBeInTheDocument()
  })

  it('asistente puede gestionar triage, pero no ve ficha clínica ni eventos completos', () => {
    mocks.role = 'asistente'
    render(<UrgenciasGesModulo onAbrirFichaPaciente={vi.fn()} />)

    expect(screen.getByText('Triage inicial')).toBeInTheDocument()
    expect(screen.queryByText('Ficha clínica de urgencia')).not.toBeInTheDocument()
    expect(screen.queryByText(/Registros clínicos/)).not.toBeInTheDocument()
    expect(screen.queryByText(/BORRADOR CLÍNICO/)).not.toBeInTheDocument()
  })

  it('abre presupuesto y recetas desde la ficha de urgencia usando nombres claros', () => {
    mocks.role = 'dentista'
    const patientId = 'c0000000-0000-4000-8000-000000000001'
    const clinicId = 'a0000000-0000-4000-8000-000000000001'
    const ingresoId = '8fc89af5-30a2-4ee9-a8c0-61ef5ae93ac2'
    mocks.pacientes = [{ id: patientId, nombre: 'Paciente de prueba', nombreCompleto: 'Paciente de prueba', rut: '1-9', clinicaId: clinicId }]
    mocks.snapshot = {
      ingresos: [{ id: ingresoId, clinica_id: clinicId, paciente_id: patientId, estado_cola: 'en_atencion', created_at: '2026-11-05T10:00:00.000Z' }],
      triajes: [],
      fichas: [],
      eventos: [],
      configuraciones: []
    }
    mocks.fichaSeleccionada = { id: ingresoId }
    const onAbrirFichaPaciente = vi.fn()

    render(<UrgenciasGesModulo onAbrirFichaPaciente={onAbrirFichaPaciente} />)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir plan del paciente' }))
    expect(onAbrirFichaPaciente).toHaveBeenLastCalledWith(patientId, 'presupuestos')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir recetas' }))
    expect(onAbrirFichaPaciente).toHaveBeenLastCalledWith(patientId, 'recetas-consentimientos')
    expect(screen.queryByText(/BP0?7|BP11/)).not.toBeInTheDocument()
  })
})
