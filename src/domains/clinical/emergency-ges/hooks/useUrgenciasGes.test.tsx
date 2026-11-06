import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUrgenciasGes } from './useUrgenciasGes'
import type { FichaUrgencia, IngresoUrgencia, SnapshotUrgenciasGes, TriageUrgencia } from '../services/urgenciasGesTypes'

const mocks = vi.hoisted(() => ({
  session: { clinicaActual: 'a0000000-0000-4000-8000-000000000001', userProfile: { rol: 'dentista' } },
  listarSnapshot: vi.fn(),
  listarPendientesLocal: vi.fn(),
  crearFicha: vi.fn(),
  agregarEvento: vi.fn(),
  realtime: {} as Record<string, () => void>
}))

vi.mock('../../../../app/stores/sesionStore', () => {
  const useSesionStore = (selector: (state: typeof mocks.session) => unknown) => selector(mocks.session)
  Object.assign(useSesionStore, { getState: () => mocks.session })
  return { useSesionStore }
})

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({ USE_SUPABASE: true }))
vi.mock('../../../../shared/hooks/useRealtimeSubscription', () => ({
  useRealtimeSubscription: (table: string, callback: () => void) => { mocks.realtime[table] = callback }
}))
vi.mock('../services/urgenciasGesStorageService', () => ({
  urgenciasGesStorageService: { obtenerAtenciones: () => [] }
}))
vi.mock('../services/urgenciasGesCloudService', () => ({
  UrgenciasGesError: class UrgenciasGesError extends Error {},
  urgenciasGesCloudService: {
    listarSnapshot: mocks.listarSnapshot,
    listarPendientesLocal: mocks.listarPendientesLocal,
    crearFicha: mocks.crearFicha,
    sincronizarPendientes: vi.fn(),
    crearIngreso: vi.fn(), crearTriage: vi.fn(), actualizarFicha: vi.fn(),
    agregarEnmienda: vi.fn(), guardarConfiguracion: vi.fn()
  }
}))
vi.mock('../../patient/services/timelineService', () => ({ timelineService: { agregarEvento: mocks.agregarEvento } }))

const ID_INGRESO = '8fc89af5-30a2-4ee9-a8c0-61ef5ae93ac2'
const ID_CLINICA = 'a0000000-0000-4000-8000-000000000001'
const ID_PACIENTE = 'c0000000-0000-4000-8000-000000000001'
const FECHA = '2026-11-06T12:00:00.000Z'

const ingreso: IngresoUrgencia = {
  id: ID_INGRESO, clinica_id: ID_CLINICA, paciente_id: ID_PACIENTE,
  estado_cola: 'en_atencion', created_at: FECHA
}

const triage: TriageUrgencia = {
  id: ID_INGRESO, clinica_id: ID_CLINICA, severidad: 'moderada',
  presion_sistolica: null, presion_diastolica: null, frecuencia_cardiaca: null,
  saturacion_oxigeno: null, temperatura_c: null, eva: null,
  patologia_sospechada_id: null, nota_triage: null,
  version: 1, created_at: FECHA, updated_at: FECHA
}

const ficha: FichaUrgencia = {
  id: ID_INGRESO, clinica_id: ID_CLINICA, folio: 'URG-2026-00000005', patologia_id: 'pulpitis',
  codigo_fonasa: null, arancel_pactado_snapshot: null, descripcion_convenio_snapshot: null,
  previsiones_convenio_snapshot: [], diagnostico_clinico: 'E2E sintético', diagnostico_cie10: null,
  piezas_afectadas: [], tratamiento_realizado: [], requiere_derivacion: false,
  centro_derivacion: null, motivo_derivacion: null, indicaciones_post: 'E2E',
  control_programado: null, profesional_id: 'd0000000-0000-4000-8000-000000000001',
  estado: 'en_atencion', fecha_hora_atencion: FECHA, fecha_hora_fin: null,
  version: 1, created_at: FECHA, updated_at: FECHA
}

const snapshotInicial: SnapshotUrgenciasGes = {
  ingresos: [ingreso], triajes: [triage], fichas: [], eventos: [], configuraciones: []
}
const snapshotConFicha: SnapshotUrgenciasGes = { ...snapshotInicial, fichas: [ficha] }

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('useUrgenciasGes timeline sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.session = { clinicaActual: ID_CLINICA, userProfile: { rol: 'dentista' } }
    mocks.realtime = {}
    mocks.listarPendientesLocal.mockResolvedValue([])
    mocks.agregarEvento.mockResolvedValue(true)
    mocks.listarSnapshot.mockResolvedValueOnce(snapshotInicial)
  })

  it('vincula la ficha al paciente aunque Realtime invalide el refresh posterior a crearla', async () => {
    const refreshDeCreacion = deferred<SnapshotUrgenciasGes>()
    const refreshRealtime = deferred<SnapshotUrgenciasGes>()
    mocks.listarSnapshot
      .mockImplementationOnce(() => refreshDeCreacion.promise)
      .mockImplementationOnce(() => refreshRealtime.promise)
    mocks.crearFicha.mockResolvedValue({ estado: 'sincronizado', registro: ficha })

    const { result } = renderHook(() => useUrgenciasGes())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let guardar!: Promise<unknown>
    act(() => {
      guardar = result.current.crearFicha(ID_INGRESO, {
        patologia_id: 'pulpitis', diagnostico_clinico: 'E2E sintético',
        diagnostico_cie10: null, piezas_afectadas: [], tratamiento_realizado: [],
        requiere_derivacion: false, centro_derivacion: null, motivo_derivacion: null,
        indicaciones_post: 'E2E', control_programado: null
      })
    })
    await waitFor(() => expect(mocks.listarSnapshot).toHaveBeenCalledTimes(2))
    act(() => mocks.realtime.urgencias_ges())
    await waitFor(() => expect(mocks.listarSnapshot).toHaveBeenCalledTimes(3))

    await act(async () => {
      refreshDeCreacion.resolve(snapshotConFicha)
      await guardar
    })
    await act(async () => { refreshRealtime.resolve(snapshotConFicha) })

    expect(mocks.agregarEvento).toHaveBeenCalledWith(ID_PACIENTE, expect.objectContaining({
      id: ID_INGRESO, tipo: 'urgencia_ges', metadata: { urgencia_id: ID_INGRESO, clinica_id: ID_CLINICA }
    }))
    expect(result.current.error).toBeNull()
  })
})
