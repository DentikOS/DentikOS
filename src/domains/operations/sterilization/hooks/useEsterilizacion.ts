import { useCallback, useEffect, useState } from 'react'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { REALTIME_EVENTS } from '../../../../infrastructure/realtime/realtimeEvents'
import { esterilizacionCloudService, type EsterilizacionCloudSnapshot } from '../services/esterilizacionCloudService'

const SNAPSHOT_VACIO: EsterilizacionCloudSnapshot = {
  zonaHoraria: 'America/Santiago',
  programas: [],
  equipos: [],
  inventario: [],
  ubicaciones: [],
  ciclos: [],
  instrumentos: [],
  pasos: [],
  pruebas: [],
  insumosConfig: [],
}

export const useEsterilizacion = () => {
  const rol = useSesionStore((state: { userProfile?: { rol?: string } | null }) => state.userProfile?.rol)
  const clinicaSession = useSesionStore((state: { clinicaActual?: unknown }) => state.clinicaActual)
  const clinicaId = getClinicaActivaSync()
  const esAdmin = rol === 'admin'
  const puedeEntrar = esAdmin || rol === 'asistente'
  const [snapshot, setSnapshot] = useState<EsterilizacionCloudSnapshot>(SNAPSHOT_VACIO)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const refrescar = useCallback(async () => {
    if (!clinicaId) {
      setSnapshot(SNAPSHOT_VACIO)
      setError('Selecciona una clínica activa para consultar esterilización.')
      setCargando(false)
      return
    }
    if (!puedeEntrar) {
      setSnapshot(SNAPSHOT_VACIO)
      setError('Este módulo está disponible para administración y asistentes autorizados.')
      setCargando(false)
      return
    }
    setCargando(true)
    try {
      const actual = await esterilizacionCloudService.cargar(clinicaId, esAdmin)
      if (getClinicaActivaSync() !== clinicaId) return
      setSnapshot(actual)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo sincronizar esterilización con DentikOS.')
    } finally {
      if (getClinicaActivaSync() === clinicaId) setCargando(false)
    }
  }, [clinicaId, esAdmin, puedeEntrar])

  useEffect(() => {
    void refrescar()
  }, [refrescar, clinicaSession])

  useEffect(() => {
    const handler = () => { void refrescar() }
    window.addEventListener(REALTIME_EVENTS.ESTERILIZACION_CHANGED, handler)
    return () => window.removeEventListener(REALTIME_EVENTS.ESTERILIZACION_CHANGED, handler)
  }, [refrescar])

  return { snapshot, cargando, error, refrescar, clinicaId, esAdmin, puedeEntrar }
}
