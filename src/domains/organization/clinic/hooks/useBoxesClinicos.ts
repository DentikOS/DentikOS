import { useCallback, useEffect, useState } from 'react'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import type { BoxClinico } from '../schemas/boxSchema'
import { boxesClinicosService } from '../services/boxesClinicosService'

const SIN_BOXES: BoxClinico[] = []

const tenantSigueActivo = (clinicaId: string | null): boolean => {
  const sesion = useSesionStore.getState()
  const clinicaSesion = sesion.clinicaActual || sesion.userProfile?.clinicaId || null
  return clinicaSesion === clinicaId && getClinicaActivaSync() === clinicaId
}

export interface UseBoxesClinicosReturn {
  boxes: BoxClinico[]
  cargando: boolean
  error: string | null
  recargar: () => void
  crear: (datos: Omit<BoxClinico, 'id' | 'clinicaId' | 'sucursalId'>) => Promise<BoxClinico>
  actualizar: (id: string, cambios: Partial<BoxClinico>) => Promise<BoxClinico>
}

export const useBoxesClinicos = (sucursalId: string | null): UseBoxesClinicosReturn => {
  const clinicaId = useSesionStore((state) => state.clinicaActual || state.userProfile?.clinicaId || null)
  const [snapshot, setSnapshot] = useState({ clinicaId, sucursalId, boxes: SIN_BOXES })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const coincide = snapshot.clinicaId === clinicaId && snapshot.sucursalId === sucursalId && tenantSigueActivo(clinicaId)
  const boxes = coincide ? snapshot.boxes : SIN_BOXES

  const recargar = useCallback(() => {
    if (!sucursalId || !tenantSigueActivo(clinicaId)) return
    setSnapshot({ clinicaId, sucursalId, boxes: boxesClinicosService.obtenerBoxes(sucursalId) })
  }, [clinicaId, sucursalId])

  useEffect(() => {
    let montado = true
    if (!clinicaId || !sucursalId || !tenantSigueActivo(clinicaId)) {
      setSnapshot({ clinicaId, sucursalId, boxes: SIN_BOXES })
      setCargando(false)
      setError(null)
      return
    }

    const sincronizar = async () => {
      setCargando(true)
      try {
        await boxesClinicosService.sincronizarDesdeSupabase()
        if (montado && tenantSigueActivo(clinicaId)) {
          recargar()
          setError(null)
        }
      } catch (cause: unknown) {
        if (montado && tenantSigueActivo(clinicaId)) {
          recargar()
          setError(cause instanceof Error ? cause.message : 'No se pudieron sincronizar los boxes.')
        }
      } finally {
        if (montado) setCargando(false)
      }
    }

    recargar()
    const unsubscribe = boxesClinicosService.suscribirCambios(clinicaId, () => { void sincronizar() })
    const actualizarLocal = (event: Event) => {
      const eventClinicId = (event as CustomEvent<{ clinicaId?: string }>).detail?.clinicaId
      if (!eventClinicId || eventClinicId === clinicaId) recargar()
    }
    const sincronizarAlVolver = () => { void sincronizar() }
    window.addEventListener('storage', recargar)
    window.addEventListener('boxes_clinicos_actualizados', actualizarLocal)
    window.addEventListener('focus', sincronizarAlVolver)
    void sincronizar()

    return () => {
      montado = false
      unsubscribe()
      window.removeEventListener('storage', recargar)
      window.removeEventListener('boxes_clinicos_actualizados', actualizarLocal)
      window.removeEventListener('focus', sincronizarAlVolver)
    }
  }, [clinicaId, sucursalId, recargar])

  const crear = useCallback(async (datos: Omit<BoxClinico, 'id' | 'clinicaId' | 'sucursalId'>) => {
    if (!sucursalId || !tenantSigueActivo(clinicaId)) throw new Error('La clínica o sucursal activa cambió. Vuelve a cargar antes de crear el box.')
    const creado = await boxesClinicosService.crear(sucursalId, datos)
    if (tenantSigueActivo(clinicaId)) {
      recargar()
      setError(null)
    }
    return creado
  }, [clinicaId, recargar, sucursalId])

  const actualizar = useCallback(async (id: string, cambios: Partial<BoxClinico>) => {
    if (!sucursalId || !tenantSigueActivo(clinicaId)) throw new Error('La clínica o sucursal activa cambió. Vuelve a cargar antes de editar el box.')
    const actualizado = await boxesClinicosService.actualizar(id, cambios)
    if (tenantSigueActivo(clinicaId)) {
      recargar()
      setError(null)
    }
    return actualizado
  }, [clinicaId, recargar, sucursalId])

  return { boxes, cargando, error, recargar, crear, actualizar }
}
