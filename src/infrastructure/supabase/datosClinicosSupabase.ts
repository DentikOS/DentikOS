/**
 * Servicio de lectura de datos clínicos desde Supabase (F4-02d-1).
 *
 * Estrategia:
 * - Mantiene una caché en memoria por paciente
 * - Proporciona método async para sincronizar un paciente desde Supabase
 * - Métodos síncronos de lectura consultan la caché
 * - Fallback a localStorage si Supabase falla o no está configurado
 *
 * Esto permite que los componentes sigan usando API síncrona mientras
 * los datos se leen desde Supabase en background.
 *
 * Flujo:
 * 1. Al abrir ficha de paciente, llamar sincronizarPaciente(pacienteId)
 * 2. Los métodos de lectura consultan la caché (síncrono)
 * 3. Si la caché está vacía, devuelve fallback (localStorage o valor por defecto)
 */
import { supabase, USE_SUPABASE } from './supabaseClient'
import { leerJSON } from '../storage/localStorageRepository'
import { esUuidValido } from './migrations/uuidUtils'
import { createLogger } from '../logging/logger'

const log = createLogger('datosClinicosSupabase')

// Caché en memoria: Map<pacienteId, Map<tipoDato, datos>>
const cache = new Map<string, Map<string, unknown>>()

// ---------------------------------------------------------------------------
// Tipos e Interfaces
// ---------------------------------------------------------------------------

export interface EvolucionNotaItem {
  id?: string | number
  fechaHora?: string
  fecha_hora?: string
  texto?: string
  tipo?: string
  tratamientoRef?: string
  tratamiento_ref?: string
  [key: string]: unknown
}

export interface EvolucionClinicaRow {
  id: string
  user_id: string
  paciente_id: string
  fecha_hora: string
  texto: string
  tipo: string
  tratamiento_ref?: string | null
  created_at?: string
  [key: string]: unknown
}

export interface CertificadoDatos {
  id?: string | number
  fechaEmision?: string
  tipo?: string
  eliminadoAt?: string | null
  eliminadoPor?: string | null
  eliminadoMotivo?: string | null
  [key: string]: unknown
}

export interface CertificadoRow {
  id: string
  user_id: string
  paciente_id: string
  fecha_emision: string
  tipo: string
  datos?: Record<string, unknown>
  eliminado_at?: string | null
  eliminado_por?: string | null
  eliminado_motivo?: string | null
  created_at?: string
  [key: string]: unknown
}

export interface OdontogramaRow {
  id: string
  user_id: string
  paciente_id: string
  tipo: string
  datos: unknown
  fecha_registro: string
  created_at?: string
  [key: string]: unknown
}

export interface PeriodontogramaRow {
  id: string
  user_id: string
  paciente_id: string
  tipo: string
  datos: unknown
  fecha_registro: string
  created_at?: string
  [key: string]: unknown
}

export interface PeriodontogramaHistorialRow {
  id: string
  user_id: string
  paciente_id: string
  controles: unknown
  created_at?: string
  [key: string]: unknown
}

/**
 * Sincroniza todos los datos clínicos de un paciente desde Supabase.
 * Debe llamarse al abrir la ficha de un paciente.
 *
 * @param pacienteId - UUID del paciente en Supabase
 */
export const sincronizarPaciente = async (pacienteId: string | number): Promise<void> => {
  if (!USE_SUPABASE || !supabase || !pacienteId) {
    return
  }

  const pIdStr = String(pacienteId)

  try {
    const datosPaciente = new Map<string, unknown>()

    // 1. Evoluciones clínicas
    const { data: evoluciones } = await supabase
      .from('evoluciones_clinicas')
      .select('*')
      .eq('paciente_id', pIdStr)
      .order('fecha_hora', { ascending: false })

    if (evoluciones) {
      const evolucionesTransformadas = evoluciones.map((e: {
        id: string
        fecha_hora?: string
        texto?: string
        tipo?: string
      }) => ({
        id: e.id,
        fechaHora: e.fecha_hora,
        texto: e.texto,
        tipo: e.tipo || 'evolucion'
      }))
      datosPaciente.set('evoluciones_notas', evolucionesTransformadas)
    }

    // Cargar certificados
    const { data: certificados } = await supabase
      .from('certificados')
      .select('*')
      .eq('paciente_id', pIdStr)
      .order('fecha_emision', { ascending: false })

    if (certificados) {
      const certificadosTransformados = certificados.map((c: {
        id: string
        datos?: Record<string, unknown>
      }) => ({
        ...(c.datos || {}),
        id: c.id
      }))
      datosPaciente.set('certificados', certificadosTransformados)
    }

    // 2. Odontograma inicial
    const { data: odontoInicial } = await supabase
      .from('odontogramas')
      .select('*')
      .eq('paciente_id', pIdStr)
      .eq('tipo', 'inicial')
      .maybeSingle()

    if (odontoInicial) {
      datosPaciente.set('odonto_inicial', (odontoInicial as { datos?: unknown }).datos || {})
    }

    // 4. Odontograma evolución
    const { data: odontoEvolucion } = await supabase
      .from('odontogramas')
      .select('*')
      .eq('paciente_id', pIdStr)
      .eq('tipo', 'evolucion')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (odontoEvolucion) {
      datosPaciente.set('odonto_evolucion', (odontoEvolucion as { datos?: unknown }).datos || {})
    }

    // 5. Periodontograma inicial
    const { data: periodontoInicial } = await supabase
      .from('periodontogramas')
      .select('*')
      .eq('paciente_id', pIdStr)
      .eq('tipo', 'inicial')
      .maybeSingle()

    if (periodontoInicial) {
      datosPaciente.set('periodontograma', (periodontoInicial as { datos?: unknown }).datos || {})
    }

    // 6. Periodontograma control
    const { data: periodontoControl } = await supabase
      .from('periodontogramas')
      .select('*')
      .eq('paciente_id', pIdStr)
      .eq('tipo', 'control')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (periodontoControl) {
      datosPaciente.set('periodontograma_control', (periodontoControl as { datos?: unknown }).datos || {})
    }

    // 7. Historial periodontal
    const { data: periodontoHistorial } = await supabase
      .from('periodontogramas_historial')
      .select('*')
      .eq('paciente_id', pIdStr)
      .maybeSingle()

    if (periodontoHistorial) {
      datosPaciente.set('periodonto_historial', (periodontoHistorial as { datos?: unknown }).datos || {})
    }

    // 8. DSD config
    const { data: dsdConfig } = await supabase
      .from('dsd_configs')
      .select('*')
      .eq('paciente_id', pIdStr)
      .maybeSingle()

    if (dsdConfig) {
      datosPaciente.set('dsd_config', (dsdConfig as { config?: unknown }).config || {})
    }

    // 9. Odontopediatría
    const { data: pediatria } = await supabase
      .from('odontopediatria')
      .select('*')
      .eq('paciente_id', pIdStr)
      .maybeSingle()

    if (pediatria) {
      datosPaciente.set('pediatria', (pediatria as { datos?: unknown }).datos || {})
    }

    // 10. Quirúrgico implantes
    const { data: implantes } = await supabase
      .from('quirurgico_implantes')
      .select('*')
      .eq('paciente_id', pIdStr)
      .maybeSingle()

    if (implantes) {
      datosPaciente.set('quirurgico_implantes', (implantes as { datos?: unknown }).datos || [])
    }

    // 11. Quirúrgico endodoncia
    const { data: endodoncia } = await supabase
      .from('quirurgico_endodoncia')
      .select('*')
      .eq('paciente_id', pIdStr)
      .maybeSingle()

    if (endodoncia) {
      datosPaciente.set('quirurgico_endodoncia', (endodoncia as { datos?: unknown }).datos || [])
    }

    // Guardar en caché
    cache.set(pIdStr, datosPaciente)
    log.info(`Paciente ${pIdStr} sincronizado desde Supabase`)
  } catch (error: unknown) {
    log.error(`Error al sincronizar paciente ${pacienteId}:`, error)
  }
}

/**
 * Lee un tipo de dato clínico de la caché.
 * Si no está en caché, hace fallback a localStorage.
 *
 * @param pacienteId - UUID del paciente
 * @param tipoDato - Tipo de dato ('evoluciones_notas', 'recetas', etc.)
 * @param fallback - Valor por defecto si no hay datos
 * @returns Los datos o el fallback
 */
export const obtenerDatoClinico = <T = unknown>(
  pacienteId: string | number | null | undefined,
  tipoDato: string,
  fallback: T | null = null
): T | null => {
  if (!pacienteId) return fallback

  const pIdStr = String(pacienteId)

  // Intentar leer de caché primero
  const cachePaciente = cache.get(pIdStr)
  if (cachePaciente) {
    const dato = cachePaciente.get(tipoDato)
    if (dato !== undefined) {
      return dato as T
    }
  }

  // Fallback a localStorage
  const localStorageKey = `${tipoDato}_${pIdStr}`
  return leerJSON<T>(localStorageKey, fallback as T)
}

/**
 * Limpia la caché de un paciente específico.
 *
 * @param pacienteId - UUID del paciente
 */
export const limpiarCachePaciente = (pacienteId: string | number): void => {
  cache.delete(String(pacienteId))
}

/**
 * Obtiene las evoluciones clínicas de un paciente directamente desde Supabase.
 *
 * @param pacienteId - UUID del paciente
 * @returns Lista de evoluciones remotas
 */
export const obtenerEvolucionesRemotas = async (
  pacienteId: string | number
): Promise<Record<string, unknown>[]> => {
  if (!USE_SUPABASE || !supabase || !pacienteId) {
    return []
  }
  const pIdStr = String(pacienteId)
  try {
    const { data, error } = await supabase
      .from('evoluciones_clinicas')
      .select('*')
      .eq('paciente_id', pIdStr)
      .order('fecha_hora', { ascending: false })

    if (error) throw error
    return (data || []) as Record<string, unknown>[]
  } catch (error: unknown) {
    log.error('Error al obtener evoluciones remotas desde Supabase:', error)
    return []
  }
}

/**
 * Busca la nota de cierre idempotente asociada a un procedimiento del plan.
 * Los filtros incluyen paciente y clínica para mantener el alcance por tenant.
 */
export const obtenerEvolucionTratamientoRealizado = async (
  pacienteId: string | number,
  tratamientoRef: string,
  clinicaId: string
): Promise<EvolucionClinicaRow | null> => {
  if (!USE_SUPABASE || !supabase || !pacienteId || !tratamientoRef || !clinicaId) {
    throw new Error('No hay contexto sincronizado para consultar el cierre del tratamiento.')
  }
  const { data, error } = await supabase
    .from('evoluciones_clinicas')
    .select('*')
    .eq('paciente_id', String(pacienteId))
    .eq('clinica_id', clinicaId)
    .eq('tipo', 'tratamiento_realizado')
    .eq('tratamiento_ref', tratamientoRef)
    .maybeSingle()

  if (error) throw error
  return data as EvolucionClinicaRow | null
}

// ═══════════════════════════════════════════════════════════════════
// MÉTODOS DE ESCRITURA (F4-02d-2)
// ═══════════════════════════════════════════════════════════════════

/**
 * Guarda una evolución clínica en Supabase.
 *
 * @param pacienteId - UUID del paciente
 * @param evolucion - Datos de la evolución
 * @returns La evolución guardada con UUID o null si falla
 */
export const guardarEvolucionClinica = async (
  pacienteId: string | number,
  evolucion: EvolucionNotaItem
): Promise<EvolucionClinicaRow | null> => {
  if (!USE_SUPABASE || !supabase || !pacienteId) {
    return null
  }

  const pIdStr = String(pacienteId)

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const evolucionSupabase = {
      user_id: user.id,
      paciente_id: pIdStr,
      fecha_hora: evolucion.fechaHora || new Date().toISOString(),
      texto: evolucion.texto || '',
      tipo: evolucion.tipo || 'evolucion',
      ...(evolucion.tipo === 'tratamiento_realizado'
        ? { tratamiento_ref: String(evolucion.tratamientoRef || evolucion.tratamiento_ref || '') }
        : {})
    }

    // Si tiene ID y es UUID válido, actualizar; si no, insertar
    if (esUuidValido(evolucion.id)) {
      const { data, error } = await supabase
        .from('evoluciones_clinicas')
        .update(evolucionSupabase)
        .eq('id', evolucion.id)
        .select()
        .maybeSingle()

      if (error) throw error
      return data as EvolucionClinicaRow | null
    } else {
      const { data, error } = await supabase
        .from('evoluciones_clinicas')
        .insert(evolucionSupabase)
        .select()
        .maybeSingle()

      if (error) throw error
      return data as EvolucionClinicaRow | null
    }
  } catch (error: unknown) {
    log.error('Error al guardar evolución:', error)
    return null
  }
}

/**
 * Normaliza fecha de formato chileno (DD-MM-YYYY) a ISO (YYYY-MM-DD)
 */
const normalizarFechaCertificado = (fecha?: string): string => {
  if (!fecha) return new Date().toISOString().split('T')[0]
  
  // Si ya está en formato ISO (YYYY-MM-DD), retornar tal cual
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha
  
  // Si está en formato chileno DD-MM-YYYY, convertir
  const match = fecha.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (match) {
    const [, dia, mes, anio] = match
    return `${anio}-${mes}-${dia}`
  }
  
  // Si está en formato DD/MM/YYYY, convertir
  const matchSlash = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (matchSlash) {
    const [, dia, mes, anio] = matchSlash
    return `${anio}-${mes}-${dia}`
  }
  
  // Fallback: usar fecha actual
  return new Date().toISOString().split('T')[0]
}

/**
 * Guarda un certificado médico en Supabase.
 *
 * @param pacienteId - UUID del paciente
 * @param certificado - Datos del certificado
 * @returns El certificado guardado con UUID o null si falla
 */
export const guardarCertificado = async (
  pacienteId: string | number,
  certificado: CertificadoDatos
): Promise<CertificadoRow | null> => {
  if (!USE_SUPABASE || !supabase || !pacienteId) {
    return null
  }

  const pIdStr = String(pacienteId)

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const certificadoSupabase = {
      user_id: user.id,
      paciente_id: pIdStr,
      fecha_emision: normalizarFechaCertificado(certificado.fechaEmision),
      tipo: certificado.tipo || 'asistencia',
      datos: certificado,
      // M3: columnas de papelera (incluir SIEMPRE con || null para que
      // restaurar setee NULL explícitamente en UPDATE)
      eliminado_at: certificado.eliminadoAt || null,
      eliminado_por: certificado.eliminadoPor || null,
      eliminado_motivo: certificado.eliminadoMotivo || null
    }

    if (esUuidValido(certificado.id)) {
      const { data, error } = await supabase
        .from('certificados')
        .update(certificadoSupabase)
        .eq('id', certificado.id)
        .select()
        .maybeSingle()

      if (error) throw error
      return data as CertificadoRow | null
    } else {
      const { data, error } = await supabase
        .from('certificados')
        .insert(certificadoSupabase)
        .select()
        .maybeSingle()

      if (error) throw error
      return data as CertificadoRow | null
    }
  } catch (error: unknown) {
    log.error('Error al guardar certificado:', error)
    return null
  }
}

/**
 * Guarda un odontograma en Supabase.
 *
 * @param pacienteId - UUID del paciente
 * @param odontograma - Datos del odontograma
 * @param tipo - 'inicial' o 'evolucion'
 * @returns El odontograma guardado o null si falla
 */
export const guardarOdontograma = async (
  pacienteId: string | number,
  odontograma: unknown,
  tipo: string = 'inicial'
): Promise<OdontogramaRow | null> => {
  if (!USE_SUPABASE || !supabase || !pacienteId) {
    return null
  }

  const pIdStr = String(pacienteId)

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const odontogramaSupabase = {
      user_id: user.id,
      paciente_id: pIdStr,
      tipo: tipo,
      datos: odontograma,
      fecha_registro: new Date().toISOString().split('T')[0]
    }

    // Buscar si ya existe un odontograma de este tipo para este paciente
    const { data: existente } = await supabase
      .from('odontogramas')
      .select('id')
      .eq('paciente_id', pIdStr)
      .eq('tipo', tipo)
      .maybeSingle()

    if (existente) {
      const { data, error } = await supabase
        .from('odontogramas')
        .update(odontogramaSupabase)
        .eq('id', (existente as { id: string }).id)
        .select()
        .maybeSingle()

      if (error) throw error
      return data as OdontogramaRow | null
    } else {
      const { data, error } = await supabase
        .from('odontogramas')
        .insert(odontogramaSupabase)
        .select()
        .maybeSingle()

      if (error) throw error
      return data as OdontogramaRow | null
    }
  } catch (error: unknown) {
    log.error('Error al guardar odontograma:', error)
    return null
  }
}

/**
 * Guarda un periodontograma en Supabase.
 *
 * @param pacienteId - UUID del paciente
 * @param periodontograma - Datos del periodontograma
 * @param tipo - 'inicial' o 'control'
 * @returns El periodontograma guardado o null si falla
 */
export const guardarPeriodontograma = async (
  pacienteId: string | number,
  periodontograma: unknown,
  tipo: string = 'inicial'
): Promise<PeriodontogramaRow | null> => {
  if (!USE_SUPABASE || !supabase || !pacienteId) {
    return null
  }

  const pIdStr = String(pacienteId)

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const periodontogramaSupabase = {
      user_id: user.id,
      paciente_id: pIdStr,
      tipo: tipo,
      datos: periodontograma,
      fecha_registro: new Date().toISOString().split('T')[0]
    }

    const { data: existente } = await supabase
      .from('periodontogramas')
      .select('id')
      .eq('paciente_id', pIdStr)
      .eq('tipo', tipo)
      .maybeSingle()

    if (existente) {
      const { data, error } = await supabase
        .from('periodontogramas')
        .update(periodontogramaSupabase)
        .eq('id', (existente as { id: string }).id)
        .select()
        .maybeSingle()

      if (error) throw error
      return data as PeriodontogramaRow | null
    } else {
      const { data, error } = await supabase
        .from('periodontogramas')
        .insert(periodontogramaSupabase)
        .select()
        .maybeSingle()

      if (error) throw error
      return data as PeriodontogramaRow | null
    }
  } catch (error: unknown) {
    log.error('Error al guardar periodontograma:', error)
    return null
  }
}

/**
 * Guarda el historial de controles periodontales en Supabase (F6-D-3).
 *
 * La tabla periodontogramas_historial tiene estructura diferente a periodontogramas:
 * - Columna 'controles' (jsonb) en lugar de 'datos'
 * - Sin columnas 'tipo' ni 'fecha_registro'
 *
 * @param pacienteId - UUID del paciente
 * @param historial - Historial de controles periodontales
 * @returns El historial guardado o null si falla
 */
export const guardarPeriodontogramaHistorial = async (
  pacienteId: string | number,
  historial: unknown
): Promise<PeriodontogramaHistorialRow | null> => {
  if (!USE_SUPABASE || !supabase || !pacienteId) {
    return null
  }

  const pIdStr = String(pacienteId)

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const historialSupabase = {
      user_id: user.id,
      paciente_id: pIdStr,
      controles: historial
    }

    // Buscar si ya existe un historial para este paciente
    const { data: existente } = await supabase
      .from('periodontogramas_historial')
      .select('id')
      .eq('paciente_id', pIdStr)
      .maybeSingle()

    if (existente) {
      const { data, error } = await supabase
        .from('periodontogramas_historial')
        .update(historialSupabase)
        .eq('id', (existente as { id: string }).id)
        .select()
        .maybeSingle()

      if (error) throw error
      return data as PeriodontogramaHistorialRow | null
    } else {
      const { data, error } = await supabase
        .from('periodontogramas_historial')
        .insert(historialSupabase)
        .select()
        .maybeSingle()

      if (error) throw error
      return data as PeriodontogramaHistorialRow | null
    }
  } catch (error: unknown) {
    log.error('Error al guardar historial periodontal:', error)
    return null
  }
}

/**
 * Guarda datos genéricos en una tabla específica.
 *
 * @param pacienteId - UUID del paciente
 * @param tabla - Nombre de la tabla en Supabase
 * @param datos - Datos a guardar
 * @returns Los datos guardados o null si falla
 */
export const guardarDatoGenerico = async (
  pacienteId: string | number,
  tabla: string,
  datos: unknown
): Promise<Record<string, unknown> | null> => {
  if (!USE_SUPABASE || !supabase || !pacienteId) {
    return null
  }

  const pIdStr = String(pacienteId)

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const datosSupabase = {
      user_id: user.id,
      paciente_id: pIdStr,
      datos: datos
    }

    const { data: existente } = await supabase
      .from(tabla)
      .select('id')
      .eq('paciente_id', pIdStr)
      .maybeSingle()

    if (existente) {
      const { data, error } = await supabase
        .from(tabla)
        .update(datosSupabase)
        .eq('id', (existente as { id: string }).id)
        .select()
        .maybeSingle()

      if (error) throw error
      return data as Record<string, unknown> | null
    } else {
      const { data, error } = await supabase
        .from(tabla)
        .insert(datosSupabase)
        .select()
        .maybeSingle()

      if (error) throw error
      return data as Record<string, unknown> | null
    }
  } catch (error: unknown) {
    log.error(`Error al guardar dato en ${tabla}:`, error)
    return null
  }
}

/**
 * Limpia toda la caché.
 */
export const limpiarCacheCompleta = (): void => {
  cache.clear()
}
