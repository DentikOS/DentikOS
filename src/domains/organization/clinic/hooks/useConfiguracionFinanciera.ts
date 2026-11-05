import { useCallback, useEffect, useState } from 'react'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { clinicStorageService } from '../services/clinicStorageService'
import {
  crearConfiguracionFinancieraPredeterminada,
  leerConfiguracionFinanciera,
  type ConfiguracionFinanciera,
} from '../schemas/configuracionFinancieraSchema'

interface EstadoConfiguracionFinanciera {
  configuracion: ConfiguracionFinanciera
  cargando: boolean
  cargada: boolean
  guardando: boolean
  error: string | null
}

export interface UseConfiguracionFinancieraResult extends EstadoConfiguracionFinanciera {
  clinicaId: string | null
  esAdmin: boolean
  guardar: (configuracion: ConfiguracionFinanciera) => Promise<boolean>
}

export const useConfiguracionFinanciera = (): UseConfiguracionFinancieraResult => {
  const clinicaIdSesion = useSesionStore((state) => state.clinicaActual)
  const userProfile = useSesionStore((state) => state.userProfile)
  const clinicaId = clinicaIdSesion || userProfile?.clinicaId || null
  const esAdmin = userProfile?.rol === 'admin'
  const [estado, setEstado] = useState<EstadoConfiguracionFinanciera>(() => ({
    configuracion: crearConfiguracionFinancieraPredeterminada(),
    cargando: true,
    cargada: false,
    guardando: false,
    error: null,
  }))

  useEffect(() => {
    let vigente = true
    if (!clinicaId) {
      setEstado({ configuracion: crearConfiguracionFinancieraPredeterminada(), cargando: false, cargada: false, guardando: false, error: 'No se encontró una clínica activa.' })
      return () => { vigente = false }
    }

    setEstado((actual) => ({ ...actual, cargando: true, cargada: false, error: null }))
    clinicStorageService.cargarConfiguracionFinanciera(clinicaId).then((configuracion) => {
      if (vigente) setEstado((actual) => ({ ...actual, configuracion, cargando: false, cargada: true, error: null }))
    }).catch((error: unknown) => {
      if (!vigente) return
      const mensaje = error instanceof Error ? error.message : 'No se pudo cargar la configuración financiera compartida.'
      setEstado((actual) => ({ ...actual, cargando: false, cargada: false, error: mensaje }))
    })

    const recibirActualizacion = (evento: Event): void => {
      const detalle = (evento as CustomEvent<{ clinicaId?: string; datos?: { configuracionFinanciera?: unknown } }>).detail
      if (detalle?.clinicaId !== clinicaId || detalle.datos?.configuracionFinanciera === undefined) return
      const configuracion = leerConfiguracionFinanciera(detalle.datos.configuracionFinanciera)
      if (configuracion && vigente) setEstado((actual) => ({ ...actual, configuracion, cargando: false, cargada: true, error: null }))
    }

    window.addEventListener('clinica_actualizada', recibirActualizacion)
    return () => {
      vigente = false
      window.removeEventListener('clinica_actualizada', recibirActualizacion)
    }
  }, [clinicaId])

  const guardar = useCallback(async (configuracion: ConfiguracionFinanciera): Promise<boolean> => {
    if (!clinicaId || !esAdmin || estado.cargando || !estado.cargada || estado.guardando) return false
    setEstado((actual) => ({ ...actual, guardando: true, error: null }))
    const ok = await clinicStorageService.guardarConfiguracionFinanciera(clinicaId, configuracion)
    if (ok) {
      setEstado((actual) => ({ ...actual, configuracion, guardando: false, error: null }))
      return true
    }
    setEstado((actual) => ({
      ...actual,
      guardando: false,
      error: 'No se guardó la configuración. Verifica tu permiso de administrador y la conexión.',
    }))
    return false
  }, [clinicaId, esAdmin, estado.cargando, estado.cargada, estado.guardando])

  return { ...estado, clinicaId, esAdmin, guardar }
}
