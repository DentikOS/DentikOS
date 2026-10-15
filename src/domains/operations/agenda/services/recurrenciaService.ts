import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { createLogger } from '../../../../infrastructure/logging/logger'
import type { Cita } from '../schemas/citaSchema'

const log = createLogger('recurrenciaService')

/**
 * Genera un identificador único para agrupar citas de una serie recurrente
 */
export const generarRecurrenceGroupId = (): string => {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Obtiene todas las citas de una serie recurrente por recurrence_group_id
 */
export const obtenerSerieCompleta = async (
  recurrenceGroupId: string
): Promise<Cita[]> => {
  if (!USE_SUPABASE || !supabase) {
    log.warn('Supabase no disponible')
    return []
  }

  try {
    const sesionState = useSesionStore.getState()
    const clinicaId = (sesionState.userProfile as { clinicaId?: string })?.clinicaId ||
      (sesionState as unknown as { clinicaId?: string })?.clinicaId
    if (!clinicaId) return []

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('clinica_id', clinicaId)
      .eq('recurrence_group_id', recurrenceGroupId)
      .order('start_time', { ascending: true })

    if (error) {
      log.error('Error obteniendo serie:', error)
      return []
    }

    return (data || []) as unknown as Cita[]
  } catch (e) {
    log.error('Error inesperado:', e)
    return []
  }
}

/**
 * Obtiene la posición de una cita dentro de su serie
 * @returns { actual: number, total: number }
 */
export const obtenerPosicionEnSerie = async (
  citaId: string | number
): Promise<{ actual: number; total: number } | null> => {
  if (!USE_SUPABASE || !supabase) return null

  try {
    const sesionState = useSesionStore.getState()
    const clinicaId = (sesionState.userProfile as { clinicaId?: string })?.clinicaId ||
      (sesionState as unknown as { clinicaId?: string })?.clinicaId
    if (!clinicaId) return null

    // Primero obtener la cita para saber su recurrence_group_id
    const { data: cita, error: errorCita } = await supabase
      .from('appointments')
      .select('recurrence_group_id, start_time')
      .eq('id', citaId)
      .eq('clinica_id', clinicaId)
      .single()

    if (errorCita || !cita?.recurrence_group_id) return null

    // Obtener todas las citas de la serie
    const { data: serie, error: errorSerie } = await supabase
      .from('appointments')
      .select('id, start_time')
      .eq('clinica_id', clinicaId)
      .eq('recurrence_group_id', cita.recurrence_group_id)
      .order('start_time', { ascending: true })

    if (errorSerie || !serie) return null

    const posicion = serie.findIndex(c => String(c.id) === String(citaId))
    if (posicion === -1) return null

    return {
      actual: posicion + 1,
      total: serie.length,
    }
  } catch (e) {
    log.error('Error obteniendo posición:', e)
    return null
  }
}

/**
 * Edita una cita recurrente con 3 opciones:
 * - 'solo_esta': Edita solo la cita actual, la desvincula de la serie
 * - 'esta_y_futuras': Edita esta y todas las citas futuras de la serie
 * - 'toda_la_serie': Edita todas las citas de la serie (pasadas y futuras)
 */
export const editarCitaRecurrencia = async (
  citaId: string | number,
  cambios: Partial<Cita>,
  alcance: 'solo_esta' | 'esta_y_futuras' | 'toda_la_serie'
): Promise<void> => {
  if (!USE_SUPABASE || !supabase) {
    log.warn('Supabase no disponible')
    return
  }

  try {
    const sesionState = useSesionStore.getState()
    const clinicaId = (sesionState.userProfile as { clinicaId?: string })?.clinicaId ||
      (sesionState as unknown as { clinicaId?: string })?.clinicaId
    if (!clinicaId) return

    const { data: citaActual } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', citaId)
      .eq('clinica_id', clinicaId)
      .single()

    if (!citaActual) return

    switch (alcance) {
      case 'solo_esta':
        // Desvincular de la serie (quitar recurrence_group_id)
        await supabase
          .from('appointments')
          .update({
            ...cambios,
            recurrence_group_id: null,
            cita_padre_id: null,
          })
          .eq('id', citaId)
        break

      case 'esta_y_futuras':
        // Editar esta y todas las futuras (start_time >= cita.start_time)
        await supabase
          .from('appointments')
          .update(cambios)
          .eq('clinica_id', clinicaId)
          .eq('recurrence_group_id', citaActual.recurrence_group_id)
          .gte('start_time', citaActual.start_time)
        break

      case 'toda_la_serie':
        // Editar todas las citas de la serie
        await supabase
          .from('appointments')
          .update(cambios)
          .eq('clinica_id', clinicaId)
          .eq('recurrence_group_id', citaActual.recurrence_group_id)
        break
    }

    log.info(`Cita editada con alcance: ${alcance}`)
  } catch (e) {
    log.error('Error editando cita:', e)
  }
}

/**
 * Cancela una cita recurrente con 3 opciones
 */
export const cancelarCitaRecurrencia = async (
  citaId: string | number,
  alcance: 'solo_esta' | 'esta_y_futuras' | 'toda_la_serie',
  motivo?: string
): Promise<void> => {
  await editarCitaRecurrencia(
    citaId,
    {
      estado: 'Cancelada',
      observaciones: motivo ? `[Cancelación de serie] ${motivo}` : '[Cancelación de serie]',
    },
    alcance
  )
}
