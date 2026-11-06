/**
 * Script de migración de datos clínicos de localStorage a Supabase (F4-02c-6).
 *
 * Estrategia:
 * 1. Itera sobre todos los pacientes migrados (con UUID en Supabase)
 * 2. Para cada paciente, lee las claves dinámicas de localStorage:
 *    - evoluciones_notas_${pacienteId}
 *    - odonto_inicial_${pacienteId}
 *    - odonto_evolucion_${pacienteId}
 *    - periodontograma_${pacienteId}
 *    - periodontograma_control_${pacienteId}
 *    - periodonto_historial_${pacienteId}
 *    - dsd_config_${pacienteId}
 *    - pediatria_${pacienteId}
 *    - quirurgico_implantes_${pacienteId}
 *    - quirurgico_endodoncia_${pacienteId}
 * 3. Transforma y sube las secciones heredadas que aún corresponden
 * 4. Retorna un resumen de la migración
 *
 * Nota: Este script NO modifica los componentes que usan estos datos.
 * Los componentes seguirán usando localStorage y se refactorizarán en F4-02d.
 * Las recetas no se migran desde localStorage: la fuente histórica conciliada
 * es fichas_clinicas.recetas y public.recetas es la fuente canónica vigente.
 */
import { supabase } from '../supabaseClient'
import { migrationStorageService } from '../../persistence/migrationStorageService'
import { leerJSON } from '../../storage/localStorageRepository'
import { createLogger } from '../../logging/logger'

const log = createLogger('migrateDatosClinicosToSupabase')

export interface MigrateDatosClinicosError {
  tipo: string
  id?: string | number
  pacienteId?: string | number
  error: string
}

export interface MigrateDatosClinicosResult {
  success: boolean
  evolucionesMigradas: number
  /** Compatibilidad del resultado histórico; permanece en cero desde BP11. */
  recetasMigradas: number
  otrosMigrados: number
  errores: Array<MigrateDatosClinicosError | string>
}

export interface VerificarDatosClinicosPendientesResult {
  totalPacientes: number
  conDatos: number
}

interface EvolucionLegacy {
  id?: string | number
  fechaHora?: string
  fecha?: string
  texto?: string
  nota?: string
  tipo?: string
  [key: string]: unknown
}

interface MigrarColeccionResult {
  migradas: number
  errores: MigrateDatosClinicosError[]
}

interface MigrarDatoSingularResult {
  migrado: boolean
  error: string | null
}

/**
 * Migraciones específicas para cada tipo de dato clínico.
 */
const migrarEvoluciones = async (
  pacienteUuid: string,
  userId: string,
  evoluciones: EvolucionLegacy[]
): Promise<MigrarColeccionResult> => {
  let migradas = 0
  const errores: MigrateDatosClinicosError[] = []

  if (!Array.isArray(evoluciones) || evoluciones.length === 0) {
    return { migradas: 0, errores: [] }
  }

  for (const evolucion of evoluciones) {
    try {
      // Generar un ID único para la evolución si no tiene
      const evolucionId = evolucion.id || `${pacienteUuid}_${Date.now()}_${Math.random()}`
      
      // Verificar si ya fue migrada
      if (migrationStorageService.yaFueMigrado(evolucionId)) continue

      const evolucionSupabase = {
        user_id: userId,
        paciente_id: pacienteUuid,
        fecha_hora: evolucion.fechaHora || evolucion.fecha || new Date().toISOString(),
        texto: evolucion.texto || evolucion.nota || '',
        tipo: evolucion.tipo || 'evolucion'
      }

      if (!supabase) throw new Error('Supabase no configurado')

      const { error } = await supabase
        .from('evoluciones_clinicas')
        .insert(evolucionSupabase)

      if (error) {
        errores.push({ tipo: 'evolucion', id: evolucionId, error: error.message })
        continue
      }

      migrationStorageService.registrarMapeo(evolucionId, `${pacienteUuid}_evolucion`)
      migradas++
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      errores.push({ tipo: 'evolucion', error: msg })
    }
  }

  return { migradas, errores }
}

const migrarOdontograma = async (
  pacienteUuid: string,
  userId: string,
  odontograma: Record<string, unknown>,
  tipo: string
): Promise<MigrarDatoSingularResult> => {
  try {
    if (!odontograma || Object.keys(odontograma).length === 0) {
      return { migrado: false, error: null }
    }

    const odontogramaSupabase = {
      user_id: userId,
      paciente_id: pacienteUuid,
      tipo,
      datos: odontograma,
      fecha_registro: new Date().toISOString().split('T')[0]
    }

    if (!supabase) throw new Error('Supabase no configurado')

    const { error } = await supabase
      .from('odontogramas')
      .insert(odontogramaSupabase)

    if (error) {
      return { migrado: false, error: error.message }
    }

    return { migrado: true, error: null }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { migrado: false, error: msg }
  }
}

const migrarPeriodontograma = async (
  pacienteUuid: string,
  userId: string,
  periodontograma: Record<string, unknown>,
  tipo: string
): Promise<MigrarDatoSingularResult> => {
  try {
    if (!periodontograma || Object.keys(periodontograma).length === 0) {
      return { migrado: false, error: null }
    }

    const periodontogramaSupabase = {
      user_id: userId,
      paciente_id: pacienteUuid,
      tipo,
      datos: periodontograma,
      fecha_registro: new Date().toISOString().split('T')[0]
    }

    if (!supabase) throw new Error('Supabase no configurado')

    const { error } = await supabase
      .from('periodontogramas')
      .insert(periodontogramaSupabase)

    if (error) {
      return { migrado: false, error: error.message }
    }

    return { migrado: true, error: null }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { migrado: false, error: msg }
  }
}

const migrarDatosGenericos = async (
  pacienteUuid: string,
  userId: string,
  datos: unknown,
  tabla: string
): Promise<MigrarDatoSingularResult> => {
  try {
    if (!datos || (Array.isArray(datos) && datos.length === 0) || 
        (!Array.isArray(datos) && typeof datos === 'object' && Object.keys(datos as Record<string, unknown>).length === 0)) {
      return { migrado: false, error: null }
    }

    const datosSupabase = {
      user_id: userId,
      paciente_id: pacienteUuid,
      datos
    }

    if (!supabase) throw new Error('Supabase no configurado')

    const { error } = await supabase
      .from(tabla)
      .insert(datosSupabase)

    if (error) {
      return { migrado: false, error: error.message }
    }

    return { migrado: true, error: null }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { migrado: false, error: msg }
  }
}

/**
 * Ejecuta la migración de datos clínicos de localStorage a Supabase.
 *
 * @param userId - UUID del usuario autenticado en Supabase
 * @returns resumen de migración
 */
export const migrateDatosClinicosToSupabase = async (userId: string): Promise<MigrateDatosClinicosResult> => {
  if (!supabase) {
    return {
      success: false,
      evolucionesMigradas: 0,
      recetasMigradas: 0,
      otrosMigrados: 0,
      errores: ['Supabase no configurado']
    }
  }

  if (!userId) {
    return {
      success: false,
      evolucionesMigradas: 0,
      recetasMigradas: 0,
      otrosMigrados: 0,
      errores: ['userId requerido para la migración']
    }
  }

  const resultado: MigrateDatosClinicosResult = {
    success: true,
    evolucionesMigradas: 0,
    recetasMigradas: 0,
    otrosMigrados: 0,
    errores: []
  }

  log.info('[migrateDatosClinicos] Iniciando migración de datos clínicos...')

  // Obtener todos los pacientes migrados
  const { data: pacientes } = await supabase
    .from('pacientes')
    .select('id')

  if (!Array.isArray(pacientes) || pacientes.length === 0) {
    log.info('[migrateDatosClinicos] No hay pacientes migrados, omitiendo')
    return resultado
  }

  for (const paciente of pacientes) {
    try {
      // Buscar el legacyId de este paciente
      const legacyId = migrationStorageService.obtenerLegacyId(paciente.id)
      if (!legacyId) continue

      log.info(`[migrateDatosClinicos] Migrando datos del paciente ${legacyId}...`)

      // 1. Evoluciones clínicas
      const evoluciones = leerJSON<EvolucionLegacy[]>(`evoluciones_notas_${legacyId}`, [])
      const resultadoEvoluciones = await migrarEvoluciones(paciente.id, userId, evoluciones)
      resultado.evolucionesMigradas += resultadoEvoluciones.migradas
      resultado.errores.push(...resultadoEvoluciones.errores)

      // 2. Odontograma inicial
      const odontoInicial = leerJSON<Record<string, unknown>>(`odonto_inicial_${legacyId}`, {})
      const resultadoOdontoInicial = await migrarOdontograma(paciente.id, userId, odontoInicial, 'inicial')
      if (resultadoOdontoInicial.migrado) resultado.otrosMigrados++
      if (resultadoOdontoInicial.error) resultado.errores.push({ tipo: 'odontograma_inicial', error: resultadoOdontoInicial.error })

      // 3. Odontograma evolución
      const odontoEvolucion = leerJSON<Record<string, unknown>>(`odonto_evolucion_${legacyId}`, {})
      const resultadoOdontoEvolucion = await migrarOdontograma(paciente.id, userId, odontoEvolucion, 'evolucion')
      if (resultadoOdontoEvolucion.migrado) resultado.otrosMigrados++
      if (resultadoOdontoEvolucion.error) resultado.errores.push({ tipo: 'odontograma_evolucion', error: resultadoOdontoEvolucion.error })

      // 4. Periodontograma inicial
      const periodontoInicial = leerJSON<Record<string, unknown>>(`periodontograma_${legacyId}`, {})
      const resultadoPeriodontoInicial = await migrarPeriodontograma(paciente.id, userId, periodontoInicial, 'inicial')
      if (resultadoPeriodontoInicial.migrado) resultado.otrosMigrados++
      if (resultadoPeriodontoInicial.error) resultado.errores.push({ tipo: 'periodontograma_inicial', error: resultadoPeriodontoInicial.error })

      // 5. Periodontograma control
      const periodontoControl = leerJSON<Record<string, unknown>>(`periodontograma_control_${legacyId}`, {})
      const resultadoPeriodontoControl = await migrarPeriodontograma(paciente.id, userId, periodontoControl, 'control')
      if (resultadoPeriodontoControl.migrado) resultado.otrosMigrados++
      if (resultadoPeriodontoControl.error) resultado.errores.push({ tipo: 'periodontograma_control', error: resultadoPeriodontoControl.error })

      // 6. Historial periodontal
      const periodontoHistorial = leerJSON<Record<string, unknown>>(`periodonto_historial_${legacyId}`, {})
      const resultadoPeriodontoHistorial = await migrarDatosGenericos(paciente.id, userId, periodontoHistorial, 'periodontogramas_historial')
      if (resultadoPeriodontoHistorial.migrado) resultado.otrosMigrados++
      if (resultadoPeriodontoHistorial.error) resultado.errores.push({ tipo: 'periodonto_historial', error: resultadoPeriodontoHistorial.error })

      // 7. DSD config
      const dsdConfig = leerJSON<Record<string, unknown>>(`dsd_config_${legacyId}`, {})
      const resultadoDsd = await migrarDatosGenericos(paciente.id, userId, dsdConfig, 'dsd_configs')
      if (resultadoDsd.migrado) resultado.otrosMigrados++
      if (resultadoDsd.error) resultado.errores.push({ tipo: 'dsd_config', error: resultadoDsd.error })

      // 8. Odontopediatría
      const pediatria = leerJSON<Record<string, unknown>>(`pediatria_${legacyId}`, {})
      const resultadoPediatria = await migrarDatosGenericos(paciente.id, userId, pediatria, 'odontopediatria')
      if (resultadoPediatria.migrado) resultado.otrosMigrados++
      if (resultadoPediatria.error) resultado.errores.push({ tipo: 'pediatria', error: resultadoPediatria.error })

      // 9. Quirúrgico implantes
      const implantes = leerJSON<unknown[]>(`quirurgico_implantes_${legacyId}`, [])
      const resultadoImplantes = await migrarDatosGenericos(paciente.id, userId, implantes, 'quirurgico_implantes')
      if (resultadoImplantes.migrado) resultado.otrosMigrados++
      if (resultadoImplantes.error) resultado.errores.push({ tipo: 'implantes', error: resultadoImplantes.error })

      // 10. Quirúrgico endodoncia
      const endodoncia = leerJSON<unknown[]>(`quirurgico_endodoncia_${legacyId}`, [])
      const resultadoEndodoncia = await migrarDatosGenericos(paciente.id, userId, endodoncia, 'quirurgico_endodoncia')
      if (resultadoEndodoncia.migrado) resultado.otrosMigrados++
      if (resultadoEndodoncia.error) resultado.errores.push({ tipo: 'endodoncia', error: resultadoEndodoncia.error })

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      log.error(`[migrateDatosClinicos] Error procesando paciente ${paciente.id}:`, msg)
      resultado.errores.push({ tipo: 'paciente', pacienteId: paciente.id, error: msg })
    }
  }

  return resultado
}

/**
 * Verifica si hay datos clínicos pendientes de migrar.
 */
export const verificarDatosClinicosPendientes = (): VerificarDatosClinicosPendientesResult => {
  const pacientesRaw = localStorage.getItem('studio_dental_pacientes_v3')
  let pacientes: Array<{ id: string | number }> = []
  try {
    pacientes = pacientesRaw ? (JSON.parse(pacientesRaw) as Array<{ id: string | number }>) : []
  } catch {
    pacientes = []
  }

  let conDatos = 0
  for (const paciente of pacientes) {
    const evoluciones = leerJSON<unknown[]>(`evoluciones_notas_${paciente.id}`, [])
    const odontoInicial = leerJSON<Record<string, unknown>>(`odonto_inicial_${paciente.id}`, {})
    
    if (evoluciones.length > 0 || Object.keys(odontoInicial).length > 0) {
      conDatos++
    }
  }

  return {
    totalPacientes: pacientes.length,
    conDatos
  }
}
