import { useEffect, useState } from 'react'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { clinicStorageService, type DatosClinicaConfig } from '../services/clinicStorageService'

interface EstadoClinicaDocumento {
  clinicaId: string | null
  datos: DatosClinicaConfig
}

const obtenerClinicaIdActual = (): string | null => {
  const sesion = useSesionStore.getState()
  return sesion.clinicaActual || sesion.userProfile?.clinicaId || null
}

export const useClinicaDocumento = (): DatosClinicaConfig => {
  const clinicaId = useSesionStore((state) => state.clinicaActual || state.userProfile?.clinicaId || null)
  const [estado, setEstado] = useState<EstadoClinicaDocumento>(() => ({
    clinicaId,
    datos: clinicaId ? clinicStorageService.obtenerClinica() || {} : {},
  }))

  useEffect(() => {
    let activo = true
    setEstado({ clinicaId, datos: clinicaId ? clinicStorageService.obtenerClinica() || {} : {} })
    if (clinicaId) {
      void clinicStorageService.sincronizarClinicaDesdeSupabase(clinicaId).then((datos) => {
        if (activo && datos && obtenerClinicaIdActual() === clinicaId) setEstado({ clinicaId, datos })
      })
    }
    return () => { activo = false }
  }, [clinicaId])

  useEffect(() => {
    const actualizarDesdeEvento = (event: Event) => {
      const detalle = (event as CustomEvent<{ clinicaId?: string; datos?: DatosClinicaConfig }>).detail
      if (detalle?.datos && detalle.clinicaId === clinicaId) setEstado({ clinicaId, datos: detalle.datos })
    }
    window.addEventListener('clinica_actualizada', actualizarDesdeEvento)
    return () => window.removeEventListener('clinica_actualizada', actualizarDesdeEvento)
  }, [clinicaId])

  return estado.clinicaId === clinicaId ? estado.datos : {}
}
