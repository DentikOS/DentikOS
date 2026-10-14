/**
 * useProfileSync — Sincronización bidireccional de perfil (Blueprint 03 §06)
 * 
 * - Al montar: carga perfil desde Supabase
 * - Al actualizar: guarda en Supabase + actualiza sesionStore
 * - Al recargar: reconstruye userProfile desde Supabase
 */
import { useEffect } from 'react'
import { useSesionStore } from '../../app/stores/sesionStore'
import { profileService, type ProfileUpdateParams, type UserProfile } from '../../infrastructure/auth/profileService'
import { createLogger } from '../../infrastructure/logging/logger'

const log = createLogger('useProfileSync')

export interface ProfileSyncResult {
  actualizar: (params: ProfileUpdateParams) => Promise<{ success: boolean; perfil?: UserProfile }>
  subirFoto: (file: File) => Promise<{ success: boolean; fotoUrl?: string }>
}

export const useProfileSync = (): ProfileSyncResult => {
  const userProfile = useSesionStore((s) => s.userProfile)
  const actualizarPerfil = useSesionStore((s) => s.actualizarPerfil)

  // Cargar perfil desde Supabase al montar (solo si hay sesión)
  useEffect(() => {
    if (!userProfile?.email) return

    const cargarPerfil = async () => {
      const perfil = await profileService.obtenerPerfil()
      if (perfil) {
        // FIX: preservar campos críticos al sincronizar
        actualizarPerfil({
          nombreCompleto: perfil.fullName || userProfile.nombreCompleto,
          especialidad: perfil.especialidad || userProfile.especialidad,
          telefono: perfil.telefono || userProfile.telefono,
          rut: perfil.rut || userProfile.rut,
          fotoUrl: perfil.fotoUrl ?? undefined,
          // Preservar campos críticos
          rol: userProfile.rol,
          clinicaId: userProfile.clinicaId,
          email: userProfile.email || perfil.email,
        })
        log.info('Perfil sincronizado desde Supabase (rol preservado)')
      }
    }

    void cargarPerfil()
  }, [userProfile?.email, actualizarPerfil])

  return {
    /**
     * Actualizar perfil en Supabase + localStorage
     */
    actualizar: async (params: ProfileUpdateParams) => {
      const perfil = await profileService.actualizarPerfil(params)

      if (perfil) {
        // FIX: preservar rol, clinicaId y email del perfil actual
        // para evitar que sesionStore los degrade por defecto
        actualizarPerfil({
          nombreCompleto: perfil.fullName ?? undefined,
          especialidad: perfil.especialidad ?? undefined,
          telefono: perfil.telefono ?? undefined,
          rut: perfil.rut ?? undefined,
          fotoUrl: perfil.fotoUrl ?? undefined,
          // Preservar campos críticos del perfil actual
          rol: userProfile?.rol,
          clinicaId: userProfile?.clinicaId,
          email: userProfile?.email || perfil.email,
        })
        log.info('Perfil actualizado en Supabase (rol preservado)')
        return { success: true, perfil }
      }

      return { success: false }
    },

    /**
     * Subir foto de perfil
     */
    subirFoto: async (file: File) => {
      const fotoUrl = await profileService.subirFoto(file)
      if (fotoUrl) {
        await profileService.actualizarPerfil({ fotoUrl })
        actualizarPerfil({ fotoUrl })
        return { success: true, fotoUrl }
      }
      return { success: false }
    },
  }
}
