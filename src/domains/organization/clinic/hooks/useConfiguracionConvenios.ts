import { useCallback, useEffect, useState } from 'react'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { clinicStorageService } from '../services/clinicStorageService'
import {
  crearConfiguracionConveniosVacia,
  leerConfiguracionConvenios,
  type ConfiguracionConvenios,
} from '../schemas/configuracionConveniosSchema'

interface EstadoConfiguracionConvenios {
  configuracion: ConfiguracionConvenios
  cargando: boolean
  cargada: boolean
  guardando: boolean
  error: string | null
}

export interface UseConfiguracionConveniosResult extends EstadoConfiguracionConvenios {
  clinicaId: string | null
  esAdmin: boolean
  guardar: (configuracion: ConfiguracionConvenios) => Promise<boolean>
}

export const useConfiguracionConvenios = (): UseConfiguracionConveniosResult => {
  const clinicaIdSesion = useSesionStore((state) => state.clinicaActual)
  const userProfile = useSesionStore((state) => state.userProfile)
  const clinicaId = clinicaIdSesion || userProfile?.clinicaId || null
  const esAdmin = userProfile?.rol === 'admin'
  const [estado, setEstado] = useState<EstadoConfiguracionConvenios>(() => ({
    configuracion: crearConfiguracionConveniosVacia(),
    cargando: true,
    cargada: false,
    guardando: false,
    error: null,
  }))

  useEffect(() => {
    let vigente = true
    if (!clinicaId) {
      setEstado({ configuracion: crearConfiguracionConveniosVacia(), cargando: false, cargada: false, guardando: false, error: 'No se encontró una clínica activa.' })
      return () => { vigente = false }
    }

    setEstado((actual) => ({ ...actual, cargando: true, cargada: false, error: null }))
    clinicStorageService.cargarConfiguracionConvenios(clinicaId).then((configuracion) => {
      if (vigente) setEstado((actual) => ({ ...actual, configuracion, cargando: false, cargada: true, error: null }))
    }).catch((error: unknown) => {
      if (!vigente) return
      const mensaje = error instanceof Error ? error.message : 'No se pudo cargar la configuración compartida.'
      setEstado((actual) => ({ ...actual, cargando: false, cargada: false, error: mensaje }))
    })

    const recibirActualizacion = (evento: Event): void => {
      const detalle = (evento as CustomEvent<{ clinicaId?: string; datos?: { configuracionConvenios?: unknown } }>).detail
      if (detalle?.clinicaId !== clinicaId || detalle.datos?.configuracionConvenios === undefined) return
      const configuracion = leerConfiguracionConvenios(detalle.datos.configuracionConvenios)
      if (configuracion && vigente) setEstado((actual) => ({ ...actual, configuracion, cargando: false, cargada: true, error: null }))
    }

    window.addEventListener('clinica_actualizada', recibirActualizacion)
    return () => {
      vigente = false
      window.removeEventListener('clinica_actualizada', recibirActualizacion)
    }
  }, [clinicaId])

  const guardar = useCallback(async (configuracion: ConfiguracionConvenios): Promise<boolean> => {
    if (!clinicaId || !esAdmin || estado.cargando || !estado.cargada || estado.guardando) return false
    setEstado((actual) => ({ ...actual, guardando: true, error: null }))
    const ok = await clinicStorageService.guardarConfiguracionConvenios(clinicaId, configuracion)
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
