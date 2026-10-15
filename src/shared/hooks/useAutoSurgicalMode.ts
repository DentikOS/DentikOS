import { useEffect, useRef } from 'react'
import { useThemeStore } from '../../app/stores/useThemeStore'
import { useAgendaStore } from '../../app/stores/useAgendaStore'
import { notificationService } from '../../infrastructure/notification/notificationService'

/**
 * BP05 §10: Activación automática del Modo Quirúrgico
 * 
 * Se activa automáticamente cuando:
 * 1. El doctor inicia atención de una cita con tag "🚨 Urgencia" (esUrgencia: true)
 * 2. El doctor inicia atención de una cita con tag "🦷 Procedimiento largo" (motivo incluye palabras clave)
 * 
 * Palabras clave de procedimiento largo:
 * - cirugía, extracción, implante, endodoncia, periodoncia, quirúrgico
 */
export const useAutoSurgicalMode = (): void => {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const citas = useAgendaStore((s) => s.citas)
  const activadoRef = useRef<string | null>(null) // ID de cita que activó el modo

  useEffect(() => {
    if (theme !== 'surgical') {
      activadoRef.current = null
    }
  }, [theme])

  useEffect(() => {
    // Buscar cita en atención con tag urgente/procedimiento largo
    const citaEnAtencion = citas.find(c => 
      c.estado === 'En atención' || c.estado === 'En Sillón'
    )

    if (!citaEnAtencion) return
    if (theme === 'surgical') return
    if (activadoRef.current === String(citaEnAtencion.id)) return

    const esUrgencia = (citaEnAtencion as { esUrgencia?: boolean }).esUrgencia === true
    const motivo = String(citaEnAtencion.motivo || (citaEnAtencion as { trataMiento?: string }).trataMiento || '').toLowerCase()
    
    const esProcedimientoLargo = 
      /cirug|extracc|implante|endodoncia|periodoncia|quirurg|muela del juicio|tercer molar/i.test(motivo)

    if (esUrgencia || esProcedimientoLargo) {
      // Auto-activar Modo Quirúrgico
      setTheme('surgical')
      activadoRef.current = String(citaEnAtencion.id)
      
      notificationService.success(
        `Modo Quirúrgico activado automáticamente para ${citaEnAtencion.pacienteNombre || 'paciente'}`,
        {
          duracion: 4000,
          titulo: esUrgencia ? '🚨 Urgencia detectada' : '🦷 Procedimiento largo',
        }
      )
    }
  }, [citas, theme, setTheme])
}
