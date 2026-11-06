import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { clinicStorageService } from './clinicStorageService'

export const suscribirRealtimeClinica = (
  clinicaId: string,
  cb: (nombre: string) => void
): (() => void) => {
  if (!USE_SUPABASE || !supabase || !clinicaId) return () => {}

  try {
    const canal = supabase
      .channel(`clinica_${clinicaId}_realtime`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clinicas',
          filter: `id=eq.${clinicaId}`,
        },
        () => {
          clinicStorageService.sincronizarClinicaDesdeSupabase(clinicaId)
            .then((datos) => {
              if (datos?.nombreClinica) cb(datos.nombreClinica)
            })
            .catch(() => {})
        }
      )
      .subscribe()

    const handleFocus = () => {
      clinicStorageService.sincronizarClinicaDesdeSupabase(clinicaId).then((datos) => {
        if (datos?.nombreClinica) cb(datos.nombreClinica)
      })
    }
    if (typeof window !== 'undefined') window.addEventListener('focus', handleFocus)

    return () => {
      try { supabase?.removeChannel(canal) } catch {}
      if (typeof window !== 'undefined') window.removeEventListener('focus', handleFocus)
    }
  } catch {
    return () => {}
  }
}
