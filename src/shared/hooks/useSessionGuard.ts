import { useCallback } from 'react'
import { useSessionTimeout } from './useSessionTimeout'
import { useAuthStateListener } from './useAuthStateListener'
import { notificationService } from '../../infrastructure/notification/notificationService'

export interface UseSessionGuardOptions {
  userProfile: Record<string, unknown> | null | undefined
  logout?: () => void | Promise<void>
}

export interface UseSessionGuardReturn {
  activo: boolean
  authErrorHandler: (error: unknown) => boolean
}

/**
 * Hook orquestador de seguridad de sesión (F6-H).
 * 
 * Combina los tres mecanismos de protección de sesión:
 * - Timeout por inactividad (30 min sin actividad del usuario)
 * - Sincronización entre pestañas (logout en todas si se cierra en una)
 * - Manejo de errores de autenticación (logout forzado si JWT expira)
 * 
 * @param options Opciones de guardia de sesión
 * @param options.userProfile - Perfil del usuario autenticado
 * @param options.logout - Función de logout (sesionStore.logout)
 */
export const useSessionGuard = ({ userProfile, logout }: UseSessionGuardOptions): UseSessionGuardReturn => {
  const activo = !!userProfile

  // Callback cuando el timeout está por expirar (2 min antes)
  const handleWarning = useCallback((): void => {
    notificationService.warning(
      'Tu sesión expirará en 2 minutos por inactividad. Mueve el mouse o presiona una tecla para mantenerla activa.',
      { titulo: 'Sesión por expirar', duracion: 120000 }
    )
  }, [])

  // Callback cuando el timeout expira (logout forzado)
  const handleTimeout = useCallback(async (): Promise<void> => {
    notificationService.error(
      'Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.',
      { titulo: 'Sesión expirada', duracion: 7000 }
    )
    if (logout) await logout()
  }, [logout])

  // Callback cuando se detecta logout desde otra pestaña
  const handleLogoutFromOtherTab = useCallback(async (): Promise<void> => {
    notificationService.warning(
      'Se ha cerrado sesión desde otra pestaña o tu cuenta fue desactivada por un administrador.',
      { titulo: 'Sesión cerrada', duracion: 5000 }
    )
    if (logout) await logout()
  }, [logout])

  // Hook 1: Timeout por inactividad (30 min)
  useSessionTimeout({
    activo,
    timeoutMs: 30 * 60 * 1000, // 30 minutos
    warnMs: 2 * 60 * 1000,     // Advertencia 2 min antes
    onWarning: handleWarning,
    onTimeout: handleTimeout
  })

  // Hook 2: Listener de cambios de autenticación (sincronización entre pestañas)
  useAuthStateListener({
    activo,
    onLogout: handleLogoutFromOtherTab
  })

  // Retornar authErrorHandler para uso manual en queries críticas
  return {
    activo,
    authErrorHandler: (error: unknown): boolean => {
      const err = error as { status?: number } | null | undefined
      if (err?.status === 401 || err?.status === 403) {
        notificationService.error(
          'Error de autenticación. Cerrando sesión por seguridad.',
          { titulo: 'Error de sesión' }
        )
        if (logout) logout()
        return true
      }
      return false
    }
  }
}
