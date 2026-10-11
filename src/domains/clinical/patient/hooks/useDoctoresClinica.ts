import { useState, useEffect, useCallback } from 'react'
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
    if (!isSupabaseConfigured()) {
      setDoctores(obtenerDoctoresLocales(userProfile, clinicaActual))
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const res = await listarMiembros()
      if (res.success && Array.isArray(res.miembros) && res.miembros.length > 0) {
        const docs: DoctorClinica[] = res.miembros
          .filter((m) => m.activo !== false && (m.rol === 'dentista' || m.rol === 'admin'))
          .map((m) => ({
            id: m.user_id || m.id,
            nombre: m.nombre || m.email,
            rol: m.rol,
          }))
        setDoctores(docs)
      } else {
        setDoctores(obtenerDoctoresLocales(userProfile, clinicaActual))
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar miembros')
      setDoctores(obtenerDoctoresLocales(userProfile, clinicaActual))
    } finally {
      setLoading(false)
    }
  }, [clinicaActual, userProfile])

  useEffect(() => {
    cargarDoctores()
  }, [cargarDoctores])

  return { doctores, loading, error, refrescar: cargarDoctores }
}
