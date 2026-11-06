import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { useRealtimeSubscription } from '../../../../shared/hooks/useRealtimeSubscription'
import {
  urgenciasGesStorageService,
  type AtencionGes
} from '../services/urgenciasGesStorageService'
import { urgenciasGesCloudService, UrgenciasGesError } from '../services/urgenciasGesCloudService'
import { timelineService } from '../../patient/services/timelineService'
import type {
  ConfiguracionGesClinica,
  EstadoUrgencia,
  EventoUrgencia,
  FichaUrgencia,
  IngresoUrgencia,
  SnapshotUrgenciasGes,
  TriageUrgencia
} from '../services/urgenciasGesTypes'

const EMPTY_SNAPSHOT: SnapshotUrgenciasGes = {
  ingresos: [], triajes: [], fichas: [], eventos: [], configuraciones: []
}

export interface UseUrgenciasGesReturn {
  snapshot: SnapshotUrgenciasGes
  atencionesHistoricas: AtencionGes[]
  fichaSeleccionada: FichaUrgencia | null
  setFichaSeleccionada: (ficha: FichaUrgencia | null) => void
  atencionHistoricaSeleccionada: AtencionGes | null
  setAtencionHistoricaSeleccionada: (atencion: AtencionGes | null) => void
  loading: boolean
  error: string | null
  pendientesCount: number
  refresh: () => Promise<SnapshotUrgenciasGes>
  sincronizarPendientes: () => Promise<void>
  registrarIngreso: (pacienteId: string, requestId: string) => Promise<'sincronizado' | 'pendiente'>
  guardarTriage: (ingresoId: string, triage: Omit<TriageUrgencia, 'id' | 'clinica_id' | 'version' | 'created_at' | 'updated_at'>) => Promise<'sincronizado' | 'pendiente'>
  crearFicha: (ingresoId: string, ficha: Pick<FichaUrgencia,
    'patologia_id' | 'diagnostico_clinico' | 'diagnostico_cie10' | 'piezas_afectadas'
    | 'tratamiento_realizado' | 'requiere_derivacion' | 'centro_derivacion'
    | 'motivo_derivacion' | 'indicaciones_post' | 'control_programado'>) => Promise<'sincronizado' | 'pendiente'>
  actualizarEstadoFicha: (ficha: FichaUrgencia, estado: Extract<EstadoUrgencia, 'cerrada' | 'rechazada' | 'derivada'>) => Promise<void>
  guardarCambiosFicha: (ficha: FichaUrgencia, cambios: Partial<Pick<FichaUrgencia,
    'patologia_id' | 'diagnostico_clinico' | 'diagnostico_cie10' | 'piezas_afectadas'
    | 'tratamiento_realizado' | 'requiere_derivacion' | 'centro_derivacion'
    | 'motivo_derivacion' | 'indicaciones_post' | 'control_programado'>>) => Promise<void>
  agregarEnmienda: (ingresoId: string, motivo: string, detalle: Record<string, unknown>) => Promise<'sincronizado' | 'pendiente'>
  guardarConfiguracion: (patologiaId: string, input: Pick<ConfiguracionGesClinica,
    'codigo_fonasa' | 'descripcion_convenio' | 'arancel_pactado' | 'centro_costos' | 'previsiones_convenio'>,
  version: number | null) => Promise<void>
}

const mensajeSeguro = (error: unknown): string => error instanceof UrgenciasGesError
  ? error.message
  : 'No se pudo completar la operación. Revisa la conexión y vuelve a intentarlo.'

const mapearPendientes = (
  snapshot: SnapshotUrgenciasGes,
  comandos: Awaited<ReturnType<typeof urgenciasGesCloudService.listarPendientesLocal>>,
  rol: string
): { snapshot: SnapshotUrgenciasGes; count: number } => {
  const puedeTriage = ['admin', 'dentista', 'asistente'].includes(rol)
  const puedeFicha = ['admin', 'dentista'].includes(rol)
  const visibles = comandos.filter((comando) => comando.kind === 'ingreso'
    || (comando.kind === 'triage' && puedeTriage)
    || (['ficha', 'enmienda'].includes(comando.kind) && puedeFicha))

  const ingresosRemotos = new Set(snapshot.ingresos.map((ingreso) => ingreso.id))
  const triajesRemotos = new Set(snapshot.triajes.map((triage) => triage.id))
  const fichasRemotas = new Set(snapshot.fichas.map((ficha) => ficha.id))
  const ingresosPendientes: IngresoUrgencia[] = []
  const triajesPendientes: TriageUrgencia[] = []
  const fichasPendientes: FichaUrgencia[] = []
  const eventosPendientes: EventoUrgencia[] = []

  for (const comando of visibles) {
    const payload = comando.payload
    if (comando.kind === 'ingreso' && !ingresosRemotos.has(comando.recordId)) {
      ingresosPendientes.push({
        id: comando.recordId, clinica_id: comando.clinicaId,
        paciente_id: String(payload.paciente_id), estado_cola: 'en_espera', created_at: '',
        estado_sincronizacion: 'pendiente', hora_local_pendiente: comando.createdAtLocal
      })
    }
    if (comando.kind === 'triage' && !triajesRemotos.has(comando.recordId)) {
      triajesPendientes.push({
        id: comando.recordId, clinica_id: comando.clinicaId,
        severidad: payload.severidad as TriageUrgencia['severidad'],
        presion_sistolica: payload.presion_sistolica as number | null,
        presion_diastolica: payload.presion_diastolica as number | null,
        frecuencia_cardiaca: payload.frecuencia_cardiaca as number | null,
        saturacion_oxigeno: payload.saturacion_oxigeno as number | null,
        temperatura_c: payload.temperatura_c as number | null,
        eva: payload.eva as number | null,
        patologia_sospechada_id: payload.patologia_sospechada_id as string | null,
        nota_triage: payload.nota_triage as string | null,
        version: 1, created_at: '', updated_at: '', estado_sincronizacion: 'pendiente'
      })
    }
    if (comando.kind === 'ficha' && !fichasRemotas.has(comando.recordId)) {
      fichasPendientes.push({
        id: comando.recordId, clinica_id: comando.clinicaId,
        folio: 'Pendiente de confirmación del servidor', patologia_id: String(payload.patologia_id),
        codigo_fonasa: null, arancel_pactado_snapshot: null, descripcion_convenio_snapshot: null,
        previsiones_convenio_snapshot: [], diagnostico_clinico: String(payload.diagnostico_clinico),
        diagnostico_cie10: payload.diagnostico_cie10 as string | null,
        piezas_afectadas: payload.piezas_afectadas as string[],
        tratamiento_realizado: payload.tratamiento_realizado as unknown[],
        requiere_derivacion: Boolean(payload.requiere_derivacion),
        centro_derivacion: payload.centro_derivacion as string | null,
        motivo_derivacion: payload.motivo_derivacion as string | null,
        indicaciones_post: payload.indicaciones_post as string | null,
        control_programado: payload.control_programado as string | null,
        profesional_id: comando.actorUserId, estado: 'en_atencion', fecha_hora_atencion: '',
        fecha_hora_fin: null, version: 1, created_at: '', updated_at: '', estado_sincronizacion: 'pendiente'
      })
    }
    if (comando.kind === 'enmienda') {
      eventosPendientes.push({
        id: comando.id, clinica_id: comando.clinicaId,
        ingreso_id: String(payload.ingreso_id), configuracion_id: null,
        actor_user_id: comando.actorUserId, evento_tipo: 'enmienda_agregada',
        datos: { despues: payload }, created_at: comando.createdAtLocal,
        estado_sincronizacion: 'pendiente'
      })
    }
  }

  return {
    snapshot: {
      ...snapshot,
      ingresos: [...ingresosPendientes, ...snapshot.ingresos],
      triajes: [...triajesPendientes, ...snapshot.triajes],
      fichas: [...fichasPendientes, ...snapshot.fichas],
      eventos: [...eventosPendientes, ...snapshot.eventos]
    },
    count: visibles.length
  }
}

export const useUrgenciasGes = (): UseUrgenciasGesReturn => {
  const clinicId = useSesionStore((state) => state.clinicaActual)
  const rol = useSesionStore((state) => state.userProfile?.rol || 'recepcion')
  const [snapshot, setSnapshot] = useState<SnapshotUrgenciasGes>(EMPTY_SNAPSHOT)
  const [atencionesHistoricas, setAtencionesHistoricas] = useState<AtencionGes[]>(() =>
    ['admin', 'dentista'].includes(rol) ? urgenciasGesStorageService.obtenerAtenciones() : [])
  const [fichaSeleccionada, setFichaSeleccionada] = useState<FichaUrgencia | null>(null)
  const [atencionHistoricaSeleccionada, setAtencionHistoricaSeleccionada] = useState<AtencionGes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendientesCount, setPendientesCount] = useState(0)
  const refreshSequence = useRef(0)

  const registrarTimelineFicha = useCallback(async (ficha: FichaUrgencia, ingreso: IngresoUrgencia | undefined): Promise<boolean> => {
    if (!ingreso
      || ficha.clinica_id !== ingreso.clinica_id
      || ficha.clinica_id !== useSesionStore.getState().clinicaActual) return false
    return timelineService.agregarEvento(ingreso.paciente_id, {
      id: ficha.id,
      tipo: 'urgencia_ges',
      fecha: ficha.fecha_hora_atencion,
      titulo: `Atención de urgencia GES · ${ficha.folio}`,
      detalles: 'Registro clínico confirmado en Urgencias GES.',
      metadata: { urgencia_id: ficha.id, clinica_id: ficha.clinica_id }
    })
  }, [])

  const refresh = useCallback(async (): Promise<SnapshotUrgenciasGes> => {
    const sequence = ++refreshSequence.current
    setLoading(true)
    setError(null)
    try {
      const remote = await urgenciasGesCloudService.listarSnapshot()
      const pending = await urgenciasGesCloudService.listarPendientesLocal()
      const merged = mapearPendientes(remote, pending, rol)
      if (useSesionStore.getState().clinicaActual !== clinicId) return EMPTY_SNAPSHOT
      // A superseded refresh must not update shared state, but its same-tenant read
      // is still valid for a caller completing a dependent write (e.g. timeline link).
      if (sequence !== refreshSequence.current) return merged.snapshot
      setSnapshot(merged.snapshot)
      setPendientesCount(merged.count)
      setFichaSeleccionada((current) => current
        ? merged.snapshot.fichas.find((ficha) => ficha.id === current.id) || current
        : null)
      return merged.snapshot
    } catch (cause) {
      if (sequence === refreshSequence.current && useSesionStore.getState().clinicaActual === clinicId) {
        setError(mensajeSeguro(cause))
        try {
          const pending = await urgenciasGesCloudService.listarPendientesLocal()
          const local = mapearPendientes(EMPTY_SNAPSHOT, pending, rol)
          setSnapshot(local.snapshot)
          setPendientesCount(local.count)
          return local.snapshot
        } catch {
          setSnapshot(EMPTY_SNAPSHOT)
          setPendientesCount(0)
        }
      }
      return EMPTY_SNAPSHOT
    } finally {
      if (sequence === refreshSequence.current) setLoading(false)
    }
  }, [clinicId, rol])

  const sincronizarPendientes = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      const pendientesAntes = await urgenciasGesCloudService.listarPendientesLocal()
      await urgenciasGesCloudService.sincronizarPendientes()
      const actual = await refresh()
      for (const comando of pendientesAntes.filter((item) => item.kind === 'ficha')) {
        const ficha = actual.fichas.find((item) => item.id === comando.recordId)
        const ingreso = actual.ingresos.find((item) => item.id === comando.recordId)
        if (ficha && ficha.estado_sincronizacion !== 'pendiente') {
          const agregado = await registrarTimelineFicha(ficha, ingreso)
          if (!agregado) setError('Urgencia sincronizada; el timeline del paciente aún no confirmó el vínculo.')
        }
      }
    } catch (cause) {
      setError(mensajeSeguro(cause))
    }
  }, [refresh, registrarTimelineFicha])

  useEffect(() => {
    setSnapshot(EMPTY_SNAPSHOT)
    setAtencionesHistoricas(['admin', 'dentista'].includes(rol) ? urgenciasGesStorageService.obtenerAtenciones() : [])
    setFichaSeleccionada(null)
    setAtencionHistoricaSeleccionada(null)
    setLoading(true)
    void refresh()
  }, [clinicId, refresh, rol])

  const onRealtime = useCallback(() => { void refresh() }, [refresh])
  const realtimeEnabled = Boolean(clinicId && USE_SUPABASE)
  const clinicFilter = useMemo(() => clinicId
    ? { columna: 'clinica_id', valor: clinicId }
    : undefined, [clinicId])

  useRealtimeSubscription('urgencias_ges_ingresos', onRealtime, { enabled: realtimeEnabled, filtro: clinicFilter })
  useRealtimeSubscription('urgencias_ges_triage', onRealtime, {
    enabled: realtimeEnabled && ['admin', 'dentista', 'asistente'].includes(rol), filtro: clinicFilter
  })
  useRealtimeSubscription('urgencias_ges', onRealtime, {
    enabled: realtimeEnabled && ['admin', 'dentista'].includes(rol), filtro: clinicFilter
  })
  useRealtimeSubscription('urgencias_ges_enmiendas', onRealtime, {
    enabled: realtimeEnabled && ['admin', 'dentista'].includes(rol), filtro: clinicFilter
  })
  useRealtimeSubscription('urgencias_ges_eventos', onRealtime, {
    enabled: realtimeEnabled && ['admin', 'dentista'].includes(rol), filtro: clinicFilter
  })
  useRealtimeSubscription('urgencias_ges_configuracion_clinica', onRealtime, {
    enabled: realtimeEnabled && ['admin', 'dentista'].includes(rol), filtro: clinicFilter
  })

  useEffect(() => {
    const handleOnline = (): void => { void sincronizarPendientes() }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [sincronizarPendientes])

  const registrarIngreso = useCallback(async (pacienteId: string, requestId: string) => {
    setError(null)
    try {
      const result = await urgenciasGesCloudService.crearIngreso(pacienteId, requestId)
      await refresh()
      return result.estado
    } catch (cause) {
      setError(mensajeSeguro(cause))
      throw cause
    }
  }, [refresh])

  const guardarTriage = useCallback(async (
    ingresoId: string,
    triage: Omit<TriageUrgencia, 'id' | 'clinica_id' | 'version' | 'created_at' | 'updated_at'>
  ) => {
    setError(null)
    try {
      const result = await urgenciasGesCloudService.crearTriage(ingresoId, triage)
      await refresh()
      return result.estado
    } catch (cause) {
      setError(mensajeSeguro(cause))
      throw cause
    }
  }, [refresh])

  const crearFicha = useCallback(async (
    ingresoId: string,
    ficha: Pick<FichaUrgencia,
      'patologia_id' | 'diagnostico_clinico' | 'diagnostico_cie10' | 'piezas_afectadas'
      | 'tratamiento_realizado' | 'requiere_derivacion' | 'centro_derivacion'
      | 'motivo_derivacion' | 'indicaciones_post' | 'control_programado'>
  ) => {
    setError(null)
    try {
      const result = await urgenciasGesCloudService.crearFicha(ingresoId, ficha)
      const actual = await refresh()
      if (result.estado === 'sincronizado') {
        const registrada = result.registro
        const ingreso = actual.ingresos.find((item) => item.id === ingresoId)
          || snapshot.ingresos.find((item) => item.id === ingresoId)
        const agregado = await registrarTimelineFicha(registrada, ingreso)
        if (!agregado) setError('Ficha sincronizada; el timeline del paciente aún no confirmó el vínculo.')
      }
      return result.estado
    } catch (cause) {
      setError(mensajeSeguro(cause))
      throw cause
    }
  }, [refresh, registrarTimelineFicha, snapshot.ingresos])

  const actualizarEstadoFicha = useCallback(async (
    ficha: FichaUrgencia,
    estado: Extract<EstadoUrgencia, 'cerrada' | 'rechazada' | 'derivada'>
  ) => {
    setError(null)
    try {
      await urgenciasGesCloudService.actualizarFicha(ficha.id, ficha.version, { estado })
      await refresh()
    } catch (cause) {
      setError(mensajeSeguro(cause))
      throw cause
    }
  }, [refresh])

  const guardarCambiosFicha = useCallback(async (
    ficha: FichaUrgencia,
    cambios: Partial<Pick<FichaUrgencia,
      'patologia_id' | 'diagnostico_clinico' | 'diagnostico_cie10' | 'piezas_afectadas'
      | 'tratamiento_realizado' | 'requiere_derivacion' | 'centro_derivacion'
      | 'motivo_derivacion' | 'indicaciones_post' | 'control_programado'>>
  ) => {
    setError(null)
    try {
      await urgenciasGesCloudService.actualizarFicha(ficha.id, ficha.version, cambios)
      await refresh()
    } catch (cause) {
      setError(mensajeSeguro(cause))
      throw cause
    }
  }, [refresh])

  const agregarEnmienda = useCallback(async (ingresoId: string, motivo: string, detalle: Record<string, unknown>) => {
    setError(null)
    try {
      const result = await urgenciasGesCloudService.agregarEnmienda(ingresoId, motivo, detalle)
      await refresh()
      return result.estado
    } catch (cause) {
      setError(mensajeSeguro(cause))
      throw cause
    }
  }, [refresh])

  const guardarConfiguracion = useCallback(async (
    patologiaId: string,
    input: Pick<ConfiguracionGesClinica,
      'codigo_fonasa' | 'descripcion_convenio' | 'arancel_pactado' | 'centro_costos' | 'previsiones_convenio'>,
    version: number | null
  ) => {
    setError(null)
    try {
      await urgenciasGesCloudService.guardarConfiguracion(patologiaId, input, version)
      await refresh()
    } catch (cause) {
      setError(mensajeSeguro(cause))
      throw cause
    }
  }, [refresh])

  return {
    snapshot, atencionesHistoricas, fichaSeleccionada, setFichaSeleccionada,
    atencionHistoricaSeleccionada, setAtencionHistoricaSeleccionada,
    loading, error, pendientesCount, refresh, sincronizarPendientes,
    registrarIngreso, guardarTriage, crearFicha, actualizarEstadoFicha, guardarCambiosFicha, agregarEnmienda,
    guardarConfiguracion
  }
}
