import { useState, useEffect, useCallback } from 'react'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { sedesService } from '../services/sedesService'
import { type Sede } from '../schemas/sedeSchema'

const SIN_SEDES: Sede[] = []

const tenantSigueActivo = (clinicaId: string | null): boolean => {
  const sesion = useSesionStore.getState()
  const clinicaSesion = sesion.clinicaActual || sesion.userProfile?.clinicaId || null
  return clinicaSesion === clinicaId && getClinicaActivaSync() === clinicaId
}

export interface UseSedesReturn {
  sedes: Sede[]
  sedeActiva: Sede | null
  sedeActivaId: string | null
  cargando: boolean
  errorSincronizacion: string | null
  cambiarSede: (sedeId: string) => void
  agregarSede: (sede: Omit<Sede, 'id'>) => Promise<Sede>
  editarSede: (id: string, updates: Partial<Sede>) => Promise<Sede>
  eliminarSede: (id: string) => Promise<boolean>
  recargar: () => void
}

export const useSedes = (): UseSedesReturn => {
  const clinicaId = useSesionStore((state) => state.clinicaActual || state.userProfile?.clinicaId || null)
  const [snapshot, setSnapshot] = useState(() => ({
    clinicaId,
    sedes: tenantSigueActivo(clinicaId) ? sedesService.obtenerSedes() : [],
    sedeActivaId: tenantSigueActivo(clinicaId) ? sedesService.obtenerSedeActiva() : null,
  }))
  const [cargando, setCargando] = useState(false)
  const [errorSincronizacion, setErrorSincronizacion] = useState<string | null>(null)
  const tenantCoincide = snapshot.clinicaId === clinicaId && tenantSigueActivo(clinicaId)
  const sedes = tenantCoincide ? snapshot.sedes : SIN_SEDES
  const sedeActivaId = tenantCoincide ? snapshot.sedeActivaId : null

  const recargar = useCallback(() => {
    if (!tenantSigueActivo(clinicaId)) return
    setSnapshot({
      clinicaId,
      sedes: sedesService.obtenerSedes(),
      sedeActivaId: sedesService.obtenerSedeActiva(),
    })
  }, [clinicaId])

  useEffect(() => {
    let montado = true
    recargar()

    const sincronizar = async () => {
      if (!clinicaId) return
      setCargando(true)
      try {
        await sedesService.sincronizarSedesDesdeSupabase(clinicaId)
        if (montado) {
          recargar()
          setErrorSincronizacion(null)
        }
      } catch (error: unknown) {
        if (montado) {
          recargar()
          setErrorSincronizacion(error instanceof Error ? error.message : 'No se pudieron sincronizar las sucursales.')
        }
      } finally {
        if (montado) setCargando(false)
      }
    }

    const unsubscribeRealtime = clinicaId
      ? sedesService.suscribirCambios(clinicaId, () => { void sincronizar() })
      : () => {}
    const handleLocalChange = () => recargar()
    const handleTenantChange = (event: Event) => {
      const eventClinicId = (event as CustomEvent<{ clinicaId?: string }>).detail?.clinicaId
      if (!eventClinicId || eventClinicId === clinicaId) recargar()
    }
    const handleFocus = () => { void sincronizar() }
    window.addEventListener('storage', handleLocalChange)
    window.addEventListener('sucursales_actualizadas', handleTenantChange)
    window.addEventListener('focus', handleFocus)
    void sincronizar()

    return () => {
      montado = false
      unsubscribeRealtime()
      window.removeEventListener('storage', handleLocalChange)
      window.removeEventListener('sucursales_actualizadas', handleTenantChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [clinicaId, recargar])

  const cambiarSede = useCallback((id: string) => {
    if (!tenantSigueActivo(clinicaId)) return
    const sedeDisponible = sedes.some((sede) => sede.id === id && sede.estado === 'activa')
    if (!sedeDisponible) return
    sedesService.establecerSedeActiva(id)
    setSnapshot((prev) => prev.clinicaId === clinicaId ? { ...prev, sedeActivaId: id } : prev)
  }, [clinicaId, sedes])

  const agregarSede = useCallback(async (datos: Omit<Sede, 'id'>): Promise<Sede> => {
    if (!tenantSigueActivo(clinicaId)) {
      throw new Error('La clínica activa cambió. Vuelve a cargar antes de crear la sucursal.')
    }
    const creada = await sedesService.crearSedeSincronizada(datos)
    if (tenantSigueActivo(clinicaId)) {
      recargar()
      setErrorSincronizacion(null)
    }
    return creada
  }, [clinicaId, recargar])

  const editarSede = useCallback(async (id: string, updates: Partial<Sede>): Promise<Sede> => {
    if (!tenantSigueActivo(clinicaId)) {
      throw new Error('La clínica activa cambió. Vuelve a cargar antes de modificar la sucursal.')
    }
    const actualizada = await sedesService.actualizarSedeSincronizada(id, updates)
    if (tenantSigueActivo(clinicaId)) {
      recargar()
      setErrorSincronizacion(null)
    }
    return actualizada
  }, [clinicaId, recargar])

  const eliminarSede = useCallback(async (id: string): Promise<boolean> => {
    if (!tenantSigueActivo(clinicaId)) return false
    try {
      await sedesService.desactivarSedeSincronizada(id)
      if (tenantSigueActivo(clinicaId)) {
        recargar()
        setErrorSincronizacion(null)
      }
      return true
    } catch (error: unknown) {
      if (tenantSigueActivo(clinicaId)) {
        setErrorSincronizacion(error instanceof Error ? error.message : 'No se pudo desactivar la sucursal.')
      }
      return false
    }
  }, [clinicaId, recargar])

  const sedeActiva = sedes.find((sede) => sede.id === sedeActivaId && sede.estado === 'activa')
    || sedes.find((sede) => sede.estado === 'activa')
    || null

  return {
    sedes,
    sedeActiva,
    sedeActivaId: sedeActiva?.id || null,
    cargando,
    errorSincronizacion,
    cambiarSede,
    agregarSede,
    editarSede,
    eliminarSede,
    recargar,
  }
}
