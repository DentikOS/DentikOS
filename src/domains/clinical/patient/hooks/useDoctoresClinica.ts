import { useState, useCallback, useEffect } from 'react'
import { listarMiembros } from '../../../../infrastructure/auth/authService'
import { useSesionStore, type UserProfileSession } from '../../../../app/stores/sesionStore'
import { isSupabaseConfigured } from '../../../../infrastructure/supabase/supabaseClient'
import type { DoctorClinica } from '../utils/formatearDoctor'

const obtenerDoctoresLocales = (
  userProfile: UserProfileSession | null,
  clinicaActual: string | null
): DoctorClinica[] => {
  if (
    userProfile &&
    (userProfile.rol === 'dentista' || userProfile.rol === 'admin') &&
    (!clinicaActual || userProfile.clinicaId === clinicaActual)
  ) {
    return [
      {
        id: (userProfile.id as string) || (userProfile.user_id as string) || userProfile.email,
        nombre: userProfile.nombreCompleto || userProfile.email,
        rol: userProfile.rol,
      },
    ]
  }
  return []
}

export const useDoctoresClinica = () => {
  const clinicaActual = useSesionStore((s) => s.clinicaActual)
  const userProfile = useSesionStore((s) => s.userProfile)
  const [doctores, setDoctores] = useState<DoctorClinica[]>(() =>
    obtenerDoctoresLocales(userProfile, clinicaActual)
  )
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const cargarDoctores = useCallback(async () => {
    console.log('[DEBUG] useDoctoresClinica: cargando doctores')

    if (!isSupabaseConfigured()) {
      console.log('[DEBUG] Supabase no configurado, usando datos locales')
      setDoctores(obtenerDoctoresLocales(userProfile, clinicaActual))
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const res = await listarMiembros()
      console.log('[DEBUG] listarMiembros respuesta:', {
        success: res.success,
        total: res.miembros?.length || 0,
      })

      if (res.success && Array.isArray(res.miembros) && res.miembros.length > 0) {
        const docs: DoctorClinica[] = res.miembros
          .filter((m) => m.activo !== false && (m.rol === 'dentista' || m.rol === 'admin'))
          .map((m) => ({
            id: m.user_id || m.id,
            nombre: m.nombre || m.email,
            rol: m.rol,
          }))

        console.log('[DEBUG] Doctores cargados:', {
          total: docs.length,
          primerDoctor: docs[0]
            ? {
                id: docs[0].id,
                nombre: docs[0].nombre,
              }
            : null,
        })

        setDoctores(docs)
      } else {
        console.log('[DEBUG] Sin miembros, usando datos locales')
        setDoctores(obtenerDoctoresLocales(userProfile, clinicaActual))
      }
      setLoading(false)
    } catch (err: unknown) {
      console.error('[DEBUG] Error cargando doctores:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setDoctores(obtenerDoctoresLocales(userProfile, clinicaActual))
      setLoading(false)
    }
  }, [userProfile, clinicaActual])

  const clinicaId = (clinicaActual as unknown as { id?: string })?.id ?? clinicaActual

  useEffect(() => {
    cargarDoctores()
  }, [userProfile?.id, clinicaId, cargarDoctores])

  return {
    doctores,
    loading,
    error,
    cargarDoctores,
    refrescar: cargarDoctores,
  }
}

