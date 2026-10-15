import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { createLogger } from '../../../../infrastructure/logging/logger'

const log = createLogger('auditoriaCita')

export interface EntradaAuditoriaCita {
  citaId: string | number
  estadoAnterior: string
  estadoNuevo: string
  usuarioId?: string
  motivo?: string
  timestamp: string
  clinicaId?: string
}

export const registrarCambioEstado = async (
  citaId: string | number, estadoAnterior: string, estadoNuevo: string,
  usuarioId: string = 'local-user', motivo?: string
): Promise<EntradaAuditoriaCita> => {
  const s = useSesionStore.getState()
  const clinicaId = (s.clinicaActual || s.userProfile?.clinicaId || (s as unknown as Record<string, unknown>).clinicaId) as string | undefined
  const timestamp = new Date().toISOString()
  const entrada: EntradaAuditoriaCita = { citaId, estadoAnterior, estadoNuevo, usuarioId, motivo, timestamp, clinicaId: clinicaId || undefined }

  try {
    const key = `cita_${citaId}_historial`
    const historial: EntradaAuditoriaCita[] = JSON.parse(localStorage.getItem(key) || '[]')
    historial.push(entrada)
    localStorage.setItem(key, JSON.stringify(historial))

    if (USE_SUPABASE && supabase) {
      const { error } = await supabase.from('appointment_audit_log').insert({
        cita_id: String(citaId), estado_anterior: estadoAnterior, estado_nuevo: estadoNuevo,
        usuario_id: usuarioId, motivo, timestamp, clinica_id: clinicaId || null,
      })
      if (error) log.error('Error insertando en appointment_audit_log:', error)
    }
  } catch (error) {
    log.warn('No se pudo persistir auditoría en Supabase o storage', error)
  }

  return entrada
}
