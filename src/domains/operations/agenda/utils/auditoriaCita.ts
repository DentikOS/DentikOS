import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { createLogger } from '../../../../infrastructure/logging/logger'

const log = createLogger('auditoriaCita')

export interface EntradaAuditoriaCita {
  citaId: string | number
  estadoAnterior: string
  estadoNuevo: string
  usuarioId?: string
  motivo?: string
  timestamp: string
}

export const registrarCambioEstado = async (
  citaId: string | number,
  estadoAnterior: string,
  estadoNuevo: string,
  usuarioId: string = 'local-user',
  motivo?: string
): Promise<EntradaAuditoriaCita> => {
  const entrada: EntradaAuditoriaCita = {
    citaId,
    estadoAnterior,
    estadoNuevo,
    usuarioId,
    motivo,
    timestamp: new Date().toISOString()
  }

  try {
    const key = `cita_${citaId}_historial`
    const historial: EntradaAuditoriaCita[] = JSON.parse(localStorage.getItem(key) || '[]')
    historial.push(entrada)
    localStorage.setItem(key, JSON.stringify(historial))

    if (USE_SUPABASE && supabase) {
      await supabase.from('appointment_audit_log').insert(entrada)
    }
  } catch (error) {
    log.warn('No se pudo persistir auditoría en Supabase o storage', error)
  }

  return entrada
}
