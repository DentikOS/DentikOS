/**
 * usePermissions — Hook que filtra módulos del Sidebar según permisos del usuario.
 * Blueprint 02 §08: Implementa la "Regla de oro": lo que NO puedes hacer, NO aparece.
 */
import { useMemo } from 'react'
import { useSesionStore } from '../../app/stores/sesionStore'
import { useRBAC } from './useRBAC'
import { SECCIONES_SIDEBAR, type SidebarSeccion } from '../../constants/sidebarConstants'
import type { PermisoValue } from '../../constants/rbacConstants'

export interface UsePermissionsReturn {
  seccionesFiltradas: SidebarSeccion[]
  rol: string
  isAdmin: boolean
  puede: (permiso: string) => boolean
}

export const usePermissions = (): UsePermissionsReturn => {
  const { rol: rbacRol, puede, esAdmin } = useRBAC()
  const userProfile = useSesionStore((s) => s.userProfile)
  const user = (useSesionStore.getState() as unknown as { user?: { id?: string; app_metadata?: { role?: string; permisos?: string[] } } })?.user

  const rol = (user?.app_metadata?.role as string) || (userProfile?.rol as string) || rbacRol || 'recepcion'
  const isAdmin = rol === 'admin' || esAdmin

  const seccionesFiltradas = useMemo((): SidebarSeccion[] => {
    const metadataPermisos = (user?.app_metadata?.permisos as string[] | undefined) ||
      (userProfile?.permisos as string[] | undefined)

    return SECCIONES_SIDEBAR.map((seccion: SidebarSeccion) => ({
      ...seccion,
      items: seccion.items.filter((item) => {
        // Si no tiene permiso requerido, es visible para todos
        if (!item.permisoRequerido) return true

        // Si existen permisos explícitos en metadata o perfil
        if (metadataPermisos && metadataPermisos.length > 0) {
          return metadataPermisos.includes(item.permisoRequerido as PermisoValue)
        }

        // Delegar a la matriz central de RBAC
        return puede(item.permisoRequerido)
      }),
    })).filter((seccion) => seccion.items.length > 0) // Eliminar categorías sin items visibles
  }, [user, userProfile, puede])

  return {
    seccionesFiltradas,
    rol,
    isAdmin,
    puede,
  }
}
