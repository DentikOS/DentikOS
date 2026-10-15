import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { createLogger } from '../../../../infrastructure/logging/logger'

const log = createLogger('clinicConfigService')

export interface ClinicAgendaConfig {
  id: string
  clinicaId: string
  horarioInicioDefault: string
  horarioFinDefault: string
  duracionBloqueDefault: number
  tiempoMinimoAnticipacion: number
  tiempoMaximoAnticipacion: number
  permitirSobrecupos: boolean
  maxSobrecupos: number
  recepcionistaPuedeEditar: boolean
  recepcionistaPuedeCancelar: boolean
  recepcionistaPuedeDragdrop: boolean
  diasLaborables: number[]
  updatedAt: string
}

export interface ClinicHoliday {
  id: string
  clinicaId: string
  fecha: string // YYYY-MM-DD
  nombre: string
  tipo: 'nacional' | 'clinica' | 'regional'
  recurrente: boolean
  createdAt: string
}

const mapConfigRow = (row: any): ClinicAgendaConfig => ({
  id: row.id,
  clinicaId: row.clinica_id,
  horarioInicioDefault: row.horario_inicio_default,
  horarioFinDefault: row.horario_fin_default,
  duracionBloqueDefault: row.duracion_bloque_default,
  tiempoMinimoAnticipacion: row.tiempo_minimo_anticipacion,
  tiempoMaximoAnticipacion: row.tiempo_maximo_anticipacion,
  permitirSobrecupos: row.permitir_sobrecupos,
  maxSobrecupos: row.max_sobrecupos,
  recepcionistaPuedeEditar: row.recepcionista_puede_editar,
  recepcionistaPuedeCancelar: row.recepcionista_puede_cancelar,
  recepcionistaPuedeDragdrop: row.recepcionista_puede_dragdrop,
  diasLaborables: row.dias_laborables || [1, 2, 3, 4, 5],
  updatedAt: row.updated_at,
})

const mapHolidayRow = (row: any): ClinicHoliday => ({
  id: row.id,
  clinicaId: row.clinica_id,
  fecha: row.fecha,
  nombre: row.nombre,
  tipo: row.tipo,
  recurrente: row.recurrente,
  createdAt: row.created_at,
})

export const clinicConfigService = {
  /**
   * Obtiene configuración de agenda de la clínica activa
   */
  obtenerConfig: async (): Promise<ClinicAgendaConfig | null> => {
    if (!USE_SUPABASE || !supabase) return null

    const userProfile = useSesionStore.getState().userProfile
    const clinicaId = (userProfile as { clinicaId?: string })?.clinicaId
    if (!clinicaId) return null

    try {
      const { data, error } = await supabase
        .from('clinic_agenda_config')
        .select('*')
        .eq('clinica_id', clinicaId)
        .single()

      if (error || !data) {
        log.warn('No se encontró config de agenda, usando defaults')
        return null
      }

      return mapConfigRow(data)
    } catch (e) {
      log.error('Error obteniendo config:', e)
      return null
    }
  },

  /**
   * Actualiza configuración (solo admin)
   */
  actualizarConfig: async (config: Partial<ClinicAgendaConfig>): Promise<boolean> => {
    if (!USE_SUPABASE || !supabase) return false

    const userProfile = useSesionStore.getState().userProfile
    const clinicaId = (userProfile as { clinicaId?: string })?.clinicaId
    const userId = (userProfile as { id?: string })?.id
    if (!clinicaId) return false

    try {
      const updates: Record<string, unknown> = { updated_by: userId }
      
      if (config.horarioInicioDefault !== undefined) updates.horario_inicio_default = config.horarioInicioDefault
      if (config.horarioFinDefault !== undefined) updates.horario_fin_default = config.horarioFinDefault
      if (config.duracionBloqueDefault !== undefined) updates.duracion_bloque_default = config.duracionBloqueDefault
      if (config.tiempoMinimoAnticipacion !== undefined) updates.tiempo_minimo_anticipacion = config.tiempoMinimoAnticipacion
      if (config.tiempoMaximoAnticipacion !== undefined) updates.tiempo_maximo_anticipacion = config.tiempoMaximoAnticipacion
      if (config.permitirSobrecupos !== undefined) updates.permitir_sobrecupos = config.permitirSobrecupos
      if (config.maxSobrecupos !== undefined) updates.max_sobrecupos = config.maxSobrecupos
      if (config.recepcionistaPuedeEditar !== undefined) updates.recepcionista_puede_editar = config.recepcionistaPuedeEditar
      if (config.recepcionistaPuedeCancelar !== undefined) updates.recepcionista_puede_cancelar = config.recepcionistaPuedeCancelar
      if (config.recepcionistaPuedeDragdrop !== undefined) updates.recepcionista_puede_dragdrop = config.recepcionistaPuedeDragdrop
      if (config.diasLaborables !== undefined) updates.dias_laborables = config.diasLaborables

      const { error } = await supabase
        .from('clinic_agenda_config')
        .update(updates)
        .eq('clinica_id', clinicaId)

      if (error) {
        log.error('Error actualizando config:', error)
        return false
      }
      return true
    } catch (e) {
      log.error('Error inesperado:', e)
      return false
    }
  },

  /**
   * Obtiene días festivos de la clínica
   */
  obtenerFestivos: async (): Promise<ClinicHoliday[]> => {
    if (!USE_SUPABASE || !supabase) return []

    const userProfile = useSesionStore.getState().userProfile
    const clinicaId = (userProfile as { clinicaId?: string })?.clinicaId
    if (!clinicaId) return []

    try {
      const { data, error } = await supabase
        .from('clinic_holidays')
        .select('*')
        .eq('clinica_id', clinicaId)
        .order('fecha', { ascending: true })

      if (error || !data) return []
      return data.map(mapHolidayRow)
    } catch (e) {
      log.error('Error obteniendo festivos:', e)
      return []
    }
  },

  /**
   * Verifica si una fecha es día festivo (considera recurrentes)
   */
  esDiaFestivo: async (fecha: string): Promise<{ esFestivo: boolean; nombre?: string; tipo?: string }> => {
    const festivos = await clinicConfigService.obtenerFestivos()
    
    // Match exacto
    const exacto = festivos.find(f => f.fecha === fecha)
    if (exacto) {
      return { esFestivo: true, nombre: exacto.nombre, tipo: exacto.tipo }
    }
    
    // Match recurrente (mismo mes/día en cualquier año)
    const partes = fecha.split('-')
    if (partes.length !== 3) return { esFestivo: false }
    const mes = partes[1]
    const dia = partes[2]
    
    const recurrente = festivos.find(f => {
      if (!f.recurrente) return false
      const fPartes = f.fecha.split('-')
      return fPartes[1] === mes && fPartes[2] === dia
    })
    
    if (recurrente) {
      return { esFestivo: true, nombre: recurrente.nombre, tipo: recurrente.tipo }
    }
    
    return { esFestivo: false }
  },

  /**
   * Agrega festivo (solo admin)
   */
  agregarFestivo: async (festivo: Omit<ClinicHoliday, 'id' | 'clinicaId' | 'createdAt'>): Promise<boolean> => {
    if (!USE_SUPABASE || !supabase) return false

    const userProfile = useSesionStore.getState().userProfile
    const clinicaId = (userProfile as { clinicaId?: string })?.clinicaId
    const userId = (userProfile as { id?: string })?.id
    if (!clinicaId) return false

    try {
      const { error } = await supabase
        .from('clinic_holidays')
        .insert({
          clinica_id: clinicaId,
          fecha: festivo.fecha,
          nombre: festivo.nombre,
          tipo: festivo.tipo,
          recurrente: festivo.recurrente,
          created_by: userId,
        })

      if (error) {
        log.error('Error agregando festivo:', error)
        return false
      }
      return true
    } catch (e) {
      log.error('Error inesperado:', e)
      return false
    }
  },

  /**
   * Elimina festivo (solo admin)
   */
  eliminarFestivo: async (festivoId: string): Promise<boolean> => {
    if (!USE_SUPABASE || !supabase) return false

    try {
      const { error } = await supabase
        .from('clinic_holidays')
        .delete()
        .eq('id', festivoId)

      if (error) {
        log.error('Error eliminando festivo:', error)
        return false
      }
      return true
    } catch (e) {
      log.error('Error inesperado:', e)
      return false
    }
  },
}
