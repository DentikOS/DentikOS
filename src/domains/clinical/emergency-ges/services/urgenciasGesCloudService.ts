import { useSesionStore } from '../../../../app/stores/sesionStore'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import {
  guardarComandoPendiente,
  obtenerComandosPendientes,
  registrarIntentoFallido,
  retirarComandoPendiente,
  validarContextoPendiente,
  type ComandoUrgenciaPendiente,
  type TipoComandoUrgencia
} from './urgenciasGesOfflineQueueService'
import type {
  ConfiguracionGesClinica,
  EventoUrgencia,
  FichaUrgencia,
  IngresoUrgencia,
  SnapshotUrgenciasGes,
  TriageUrgencia
} from './urgenciasGesTypes'

export class UrgenciasGesError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'UrgenciasGesError'
  }
}

type Contexto = { clinicaId: string; actorUserId: string }
type Creacion<T> = { estado: 'sincronizado'; registro: T } | { estado: 'pendiente'; comando: ComandoUrgenciaPendiente }

const COLUMNAS_INGRESO = 'id,clinica_id,paciente_id,estado_cola,created_at'
const COLUMNAS_TRIAGE = 'id,clinica_id,severidad,presion_sistolica,presion_diastolica,frecuencia_cardiaca,saturacion_oxigeno,temperatura_c,eva,patologia_sospechada_id,nota_triage,version,created_at,updated_at'
const COLUMNAS_FICHA = 'id,clinica_id,folio,patologia_id,codigo_fonasa,arancel_pactado_snapshot,descripcion_convenio_snapshot,previsiones_convenio_snapshot,diagnostico_clinico,diagnostico_cie10,piezas_afectadas,tratamiento_realizado,requiere_derivacion,centro_derivacion,motivo_derivacion,indicaciones_post,control_programado,profesional_id,estado,fecha_hora_atencion,fecha_hora_fin,version,created_at,updated_at'
const COLUMNAS_ENMIENDA = 'id,clinica_id,ingreso_id,motivo,detalle,created_by,created_at'
const COLUMNAS_EVENTO = 'id,clinica_id,ingreso_id,configuracion_id,actor_user_id,evento_tipo,datos,created_at'
const COLUMNAS_CONFIG = 'id,clinica_id,patologia_id,codigo_fonasa,descripcion_convenio,arancel_pactado,centro_costos,previsiones_convenio,version,created_by,updated_by,created_at,updated_at'

const nuevoUuid = (): string => {
  const value = globalThis.crypto?.randomUUID?.()
  if (!value) throw new UrgenciasGesError('uuid_unavailable', 'No se pudo generar un identificador seguro')
  return value
}

const obtenerContexto = async (): Promise<Contexto> => {
  if (!USE_SUPABASE || !supabase) {
    throw new UrgenciasGesError('supabase_unavailable', 'La sincronización de urgencias no está disponible')
  }
  const clinicaId = getClinicaActivaSync()
  const clinicaStore = useSesionStore.getState().clinicaActual
  if (!clinicaId || !clinicaStore || clinicaId !== clinicaStore) {
    throw new UrgenciasGesError('clinic_context', 'No hay una clínica activa verificada')
  }
  const { data, error } = await supabase.auth.getSession()
  const actorUserId = data.session?.user?.id
  if (error || !actorUserId) {
    throw new UrgenciasGesError('auth_required', 'Inicia sesión para registrar la urgencia')
  }
  return { clinicaId, actorUserId }
}

const mensajeError = (code?: string): UrgenciasGesError => {
  if (code === '42501') return new UrgenciasGesError('forbidden', 'Tu rol no puede realizar esta acción')
  if (code === '23503') return new UrgenciasGesError('reference', 'El paciente o ingreso ya no pertenece a la clínica activa')
  if (code === '40001') return new UrgenciasGesError('conflict', 'El registro cambió en otro dispositivo; recarga antes de continuar')
  if (code === '55000') return new UrgenciasGesError('closed', 'La ficha está cerrada y requiere una enmienda')
  return new UrgenciasGesError('database', 'No se pudo guardar la urgencia en el servidor')
}

const esErrorDeRed = (error: unknown): boolean => {
  const value = error as { code?: string; status?: number; message?: string } | null
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return value?.status === 0
    || ['FETCH_ERROR', 'NETWORK_ERROR', 'TIMEOUT'].includes(value?.code || '')
    || /failed to fetch|network error|networkerror|request timeout/i.test(value?.message || '')
}

const canonizar = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonizar)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonizar(item)]))
  }
  return value
}

export const coincideConPayload = (row: Record<string, unknown>, payload: Record<string, unknown>): boolean =>
  Object.entries(payload).every(([key, value]) => {
    const actual = row[key]
    if (typeof value === 'number' && typeof actual === 'string' && actual.trim() !== '' && Number(actual) === value) {
      return true
    }
    return JSON.stringify(canonizar(actual)) === JSON.stringify(canonizar(value))
  })

const tablaPorTipo: Record<TipoComandoUrgencia, string> = {
  ingreso: 'urgencias_ges_ingresos',
  triage: 'urgencias_ges_triage',
  ficha: 'urgencias_ges',
  enmienda: 'urgencias_ges_enmiendas'
}

const columnasPorTipo: Record<TipoComandoUrgencia, string> = {
  ingreso: 'id,clinica_id,paciente_id,hora_llegada_local,estado_cola,created_by,created_at',
  triage: 'id,clinica_id,severidad,presion_sistolica,presion_diastolica,frecuencia_cardiaca,saturacion_oxigeno,temperatura_c,eva,patologia_sospechada_id,nota_triage,created_by,updated_by,created_at,updated_at,version',
  ficha: 'id,clinica_id,folio,patologia_id,codigo_fonasa,arancel_pactado_snapshot,descripcion_convenio_snapshot,previsiones_convenio_snapshot,diagnostico_clinico,diagnostico_cie10,piezas_afectadas,tratamiento_realizado,requiere_derivacion,centro_derivacion,motivo_derivacion,indicaciones_post,control_programado,profesional_id,estado,fecha_hora_atencion,fecha_hora_fin,created_by,updated_by,created_at,updated_at,version',
  enmienda: COLUMNAS_ENMIENDA
}

const insertarIdempotente = async (
  tipo: TipoComandoUrgencia,
  payload: Record<string, unknown> & { id: string; clinica_id: string }
): Promise<Record<string, unknown>> => {
  if (!supabase) throw new UrgenciasGesError('supabase_unavailable', 'La sincronización de urgencias no está disponible')
  const tabla = tablaPorTipo[tipo]
  const columnas = columnasPorTipo[tipo]
  const insercion = await supabase.from(tabla).insert(payload).select(columnas).single()
  if (!insercion.error && insercion.data) return insercion.data as unknown as Record<string, unknown>

  // A timeout may arrive after PostgreSQL committed. Reuse the row's UUID and
  // verify the payload before declaring the command synchronized.
  const recuperacion = await supabase.from(tabla).select(columnas)
    .eq('id', payload.id).eq('clinica_id', payload.clinica_id).maybeSingle()
  if (!recuperacion.error && recuperacion.data && coincideConPayload(recuperacion.data as unknown as Record<string, unknown>, payload)) {
    return recuperacion.data as unknown as Record<string, unknown>
  }

  const errorOriginal = insercion.error || recuperacion.error
  if (esErrorDeRed(errorOriginal)) {
    throw new UrgenciasGesError('network', 'No se confirmó la conexión; el registro queda pendiente de sincronización')
  }
  throw mensajeError(insercion.error?.code || recuperacion.error?.code)
}

const crearComando = (
  tipo: TipoComandoUrgencia,
  contexto: Contexto,
  payload: Record<string, unknown> & { id: string; clinica_id: string }
): ComandoUrgenciaPendiente => ({
  id: nuevoUuid(),
  recordId: payload.id,
  clinicaId: contexto.clinicaId,
  actorUserId: contexto.actorUserId,
  createdAtLocal: new Date().toISOString(),
  kind: tipo,
  payload,
  attempts: 0
})

const revisarDependenciasOffline = (tipo: TipoComandoUrgencia, id: string, contexto: Contexto): void => {
  const pendientes = obtenerComandosPendientes(contexto.clinicaId)
    .filter((item) => item.actorUserId === contexto.actorUserId)
  if (tipo === 'triage' && !pendientes.some((item) => item.kind === 'ingreso' && item.recordId === id)) {
    throw new UrgenciasGesError('offline_dependency', 'El triage de un ingreso existente requiere conexión para verificarlo')
  }
  if (tipo === 'ficha' && (!pendientes.some((item) => item.kind === 'ingreso' && item.recordId === id)
    || !pendientes.some((item) => item.kind === 'triage' && item.recordId === id))) {
    throw new UrgenciasGesError('offline_dependency', 'La ficha clínica requiere un ingreso y un triage pendientes del mismo dispositivo')
  }
}

const crearRegistro = async <T>(
  tipo: TipoComandoUrgencia,
  payload: Record<string, unknown> & { id: string; clinica_id: string }
): Promise<Creacion<T>> => {
  const contexto = await obtenerContexto()
  if (payload.clinica_id !== contexto.clinicaId) {
    throw new UrgenciasGesError('clinic_context', 'El registro no coincide con la clínica activa')
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    revisarDependenciasOffline(tipo, payload.id, contexto)
    const comando = guardarComandoPendiente(crearComando(tipo, contexto, payload), contexto.actorUserId)
    return { estado: 'pendiente', comando }
  }
  try {
    const registro = await insertarIdempotente(tipo, payload)
    return { estado: 'sincronizado', registro: registro as unknown as T }
  } catch (error) {
    if (!(error instanceof UrgenciasGesError) || error.code !== 'network') throw error
    revisarDependenciasOffline(tipo, payload.id, contexto)
    const comando = guardarComandoPendiente(crearComando(tipo, contexto, payload), contexto.actorUserId)
    return { estado: 'pendiente', comando }
  }
}

const requireUuid = (id: string | number): string => {
  const value = String(id)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new UrgenciasGesError('invalid_id', 'El identificador del paciente o ingreso no es válido')
  }
  return value
}

export const urgenciasGesCloudService = {
  listarSnapshot: async (): Promise<SnapshotUrgenciasGes> => {
    const contexto = await obtenerContexto()
    const rol = useSesionStore.getState().userProfile?.rol || 'recepcion'
    if (!supabase) throw new UrgenciasGesError('supabase_unavailable', 'La sincronización de urgencias no está disponible')
    const base = supabase.from('urgencias_ges_ingresos').select(COLUMNAS_INGRESO)
      .eq('clinica_id', contexto.clinicaId).order('created_at', { ascending: false }).limit(500)
    const [ingresosResult, triageResult, fichaResult, eventoResult, configResult] = await Promise.all([
      base,
      ['admin', 'dentista', 'asistente'].includes(rol)
        ? supabase.from('urgencias_ges_triage').select(COLUMNAS_TRIAGE).eq('clinica_id', contexto.clinicaId).order('created_at', { ascending: false }).limit(500)
        : Promise.resolve({ data: [], error: null }),
      ['admin', 'dentista'].includes(rol)
        ? supabase.from('urgencias_ges').select(COLUMNAS_FICHA).eq('clinica_id', contexto.clinicaId).order('fecha_hora_atencion', { ascending: false }).limit(500)
        : Promise.resolve({ data: [], error: null }),
      ['admin', 'dentista'].includes(rol)
        ? supabase.from('urgencias_ges_eventos').select(COLUMNAS_EVENTO).eq('clinica_id', contexto.clinicaId).order('created_at', { ascending: false }).limit(1000)
        : Promise.resolve({ data: [], error: null }),
      ['admin', 'dentista'].includes(rol)
        ? supabase.from('urgencias_ges_configuracion_clinica').select(COLUMNAS_CONFIG).eq('clinica_id', contexto.clinicaId).order('patologia_id')
        : Promise.resolve({ data: [], error: null })
    ])
    const fallo = [ingresosResult, triageResult, fichaResult, eventoResult, configResult]
      .find((result) => result.error)
    if (fallo?.error) throw mensajeError(fallo.error.code)
    return {
      ingresos: (ingresosResult.data || []) as unknown as IngresoUrgencia[],
      triajes: (triageResult.data || []) as unknown as TriageUrgencia[],
      fichas: (fichaResult.data || []) as unknown as FichaUrgencia[],
      eventos: (eventoResult.data || []) as unknown as EventoUrgencia[],
      configuraciones: (configResult.data || []) as unknown as ConfiguracionGesClinica[]
    }
  },

  listarPendientesLocal: async (): Promise<ComandoUrgenciaPendiente[]> => {
    const contexto = await obtenerContexto()
    return obtenerComandosPendientes(contexto.clinicaId)
      .filter((item) => item.actorUserId === contexto.actorUserId)
  },

  crearIngreso: async (pacienteId: string | number, id = nuevoUuid()): Promise<Creacion<IngresoUrgencia>> => {
    const contexto = await obtenerContexto()
    const payload = { id: requireUuid(id), clinica_id: contexto.clinicaId, paciente_id: requireUuid(pacienteId) }
    return crearRegistro<IngresoUrgencia>('ingreso', payload)
  },

  crearTriage: async (ingresoId: string, input: Omit<TriageUrgencia, 'id' | 'clinica_id' | 'version' | 'created_at' | 'updated_at'>): Promise<Creacion<TriageUrgencia>> => {
    const contexto = await obtenerContexto()
    const payload = {
      id: requireUuid(ingresoId), clinica_id: contexto.clinicaId,
      severidad: input.severidad, presion_sistolica: input.presion_sistolica,
      presion_diastolica: input.presion_diastolica, frecuencia_cardiaca: input.frecuencia_cardiaca,
      saturacion_oxigeno: input.saturacion_oxigeno, temperatura_c: input.temperatura_c,
      eva: input.eva, patologia_sospechada_id: input.patologia_sospechada_id,
      nota_triage: input.nota_triage
    }
    return crearRegistro<TriageUrgencia>('triage', payload)
  },

  crearFicha: async (ingresoId: string, input: Pick<FichaUrgencia,
    'patologia_id' | 'diagnostico_clinico' | 'diagnostico_cie10' | 'piezas_afectadas'
    | 'tratamiento_realizado' | 'requiere_derivacion' | 'centro_derivacion'
    | 'motivo_derivacion' | 'indicaciones_post' | 'control_programado'>): Promise<Creacion<FichaUrgencia>> => {
    const contexto = await obtenerContexto()
    const payload = {
      id: requireUuid(ingresoId), clinica_id: contexto.clinicaId,
      patologia_id: input.patologia_id, diagnostico_clinico: input.diagnostico_clinico.trim(),
      diagnostico_cie10: input.diagnostico_cie10, piezas_afectadas: input.piezas_afectadas,
      tratamiento_realizado: input.tratamiento_realizado, requiere_derivacion: input.requiere_derivacion,
      centro_derivacion: input.centro_derivacion, motivo_derivacion: input.motivo_derivacion,
      indicaciones_post: input.indicaciones_post, control_programado: input.control_programado
    }
    if (!payload.diagnostico_clinico) throw new UrgenciasGesError('validation', 'El diagnóstico clínico es obligatorio')
    return crearRegistro<FichaUrgencia>('ficha', payload)
  },

  actualizarFicha: async (id: string, version: number, cambios: Partial<Pick<FichaUrgencia,
    'patologia_id' | 'diagnostico_clinico' | 'diagnostico_cie10' | 'piezas_afectadas'
    | 'tratamiento_realizado' | 'requiere_derivacion' | 'centro_derivacion'
    | 'motivo_derivacion' | 'indicaciones_post' | 'control_programado' | 'estado'>>): Promise<FichaUrgencia> => {
    const contexto = await obtenerContexto()
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new UrgenciasGesError('offline_update', 'Conéctate para editar una ficha; los cambios clínicos no se guardan sin confirmación')
    }
    if (!supabase) throw new UrgenciasGesError('supabase_unavailable', 'La sincronización de urgencias no está disponible')
    const permitidos = { ...cambios }
    const result = await supabase.from('urgencias_ges').update({ ...permitidos, version: version + 1 })
      .eq('id', requireUuid(id)).eq('clinica_id', contexto.clinicaId).eq('version', version)
      .eq('estado', 'en_atencion').select(COLUMNAS_FICHA).maybeSingle()
    if (result.error) throw mensajeError(result.error.code)
    if (!result.data) throw new UrgenciasGesError('conflict', 'La ficha cambió o fue cerrada en otro dispositivo')
    return result.data as unknown as FichaUrgencia
  },

  agregarEnmienda: async (ingresoId: string, motivo: string, detalle: Record<string, unknown>): Promise<Creacion<Record<string, unknown>>> => {
    const contexto = await obtenerContexto()
    const payload = {
      id: nuevoUuid(), clinica_id: contexto.clinicaId,
      ingreso_id: requireUuid(ingresoId), motivo: motivo.trim(), detalle
    }
    if (payload.motivo.length < 10) throw new UrgenciasGesError('validation', 'Indica un motivo de al menos 10 caracteres')
    return crearRegistro<Record<string, unknown>>('enmienda', payload)
  },

  guardarConfiguracion: async (patologiaId: string, input: Pick<ConfiguracionGesClinica,
    'codigo_fonasa' | 'descripcion_convenio' | 'arancel_pactado' | 'centro_costos' | 'previsiones_convenio'>,
  version: number | null): Promise<ConfiguracionGesClinica> => {
    const contexto = await obtenerContexto()
    if (!supabase) throw new UrgenciasGesError('supabase_unavailable', 'La sincronización de urgencias no está disponible')
    const select = supabase.from('urgencias_ges_configuracion_clinica')
      .select(COLUMNAS_CONFIG)
      .eq('clinica_id', contexto.clinicaId).eq('patologia_id', patologiaId)
    if (version === null) {
      const payload = { id: nuevoUuid(), clinica_id: contexto.clinicaId, patologia_id: patologiaId, ...input }
      const result = await supabase.from('urgencias_ges_configuracion_clinica').insert(payload).select(COLUMNAS_CONFIG).single()
      if (result.error) throw mensajeError(result.error.code)
      return result.data as unknown as ConfiguracionGesClinica
    }
    const actual = await select.maybeSingle()
    if (actual.error || !actual.data || actual.data.version !== version) {
      throw new UrgenciasGesError('conflict', 'La configuración cambió en otro dispositivo; recarga antes de guardar')
    }
    const result = await supabase.from('urgencias_ges_configuracion_clinica')
      .update({ ...input, version: version + 1 })
      .eq('id', actual.data.id).eq('clinica_id', contexto.clinicaId).eq('version', version)
      .select(COLUMNAS_CONFIG).maybeSingle()
    if (result.error) throw mensajeError(result.error.code)
    if (!result.data) throw new UrgenciasGesError('conflict', 'La configuración cambió en otro dispositivo')
    return result.data as unknown as ConfiguracionGesClinica
  },

  sincronizarPendientes: async (): Promise<{ sincronizados: number; pendientes: number }> => {
    const contexto = await obtenerContexto()
    const pendientes = obtenerComandosPendientes(contexto.clinicaId)
      .filter((item) => item.actorUserId === contexto.actorUserId)
    let sincronizados = 0
    for (const comando of pendientes) {
      try {
        validarContextoPendiente(comando, contexto.clinicaId, contexto.actorUserId)
        await insertarIdempotente(comando.kind, comando.payload)
        retirarComandoPendiente(comando.id)
        sincronizados += 1
      } catch (error) {
        const code = error instanceof UrgenciasGesError ? error.code : 'unknown'
        registrarIntentoFallido(comando.id, code)
        break
      }
    }
    return { sincronizados, pendientes: obtenerComandosPendientes(contexto.clinicaId)
      .filter((item) => item.actorUserId === contexto.actorUserId).length }
  }
}
