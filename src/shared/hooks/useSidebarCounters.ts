/**
 * useSidebarCounters — Contadores del Sidebar (Blueprint 02 §05)
 * Límite constitucional: ≤150 líneas
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { agendaStorageService } from '../../domains/operations/agenda/services/agendaStorageService'
import { inventarioStorageService } from '../../domains/operations/inventory/services/inventarioStorageService'
import { listarPacientesEliminados } from '../../domains/clinical/patient/services/pacientesSoftDeleteService'
import { obtenerFechaLocalISO } from '../utils/dateUtils'
import {
  contarCiclosEsterilizacionPendientes,
  contarMensajesNoLeidos,
  contarPagosVencidos,
} from '../utils/sidebarCounterUtils'
import { playCriticoSound } from '../utils/badgeSoundUtils'
import { REALTIME_EVENTS } from '../../infrastructure/realtime/realtimeEvents'

export interface SidebarCountersReturn {
  agenda: number
  agendaSinConfirmar: number
  esterilizacionPendiente: number
  inventario: number
  inventarioBajo: number
  mensajesNoLeidos: number
  pagosVencidos: number
  papelera: number
  refrescar: () => void
  refrescarPapelera: () => Promise<void>
  [key: string]: unknown
}

const contarCitasHoy = (): number => {
  try {
    const citas = (agendaStorageService?.obtenerCitas?.() || []) as { fecha?: string }[]
    const hoy = obtenerFechaLocalISO()
    return citas.filter((c) => c.fecha === hoy).length
  } catch {
    return 0
  }
}

const contarInventarioBajo = (): number => {
  try {
    const items = (inventarioStorageService?.obtenerItems?.() || []) as Record<string, unknown>[]
    return items.filter((item) => {
      const stock = parseFloat(String(item.cantidad ?? item.stockActual ?? 0)) || 0
      const minimo = parseFloat(String(item.minimoCritico ?? item.stockMinimo ?? 0)) || 0
      return minimo > 0 && stock < minimo
    }).length
  } catch {
    return 0
  }
}

export const useSidebarCounters = (): SidebarCountersReturn => {
  const [agenda, setAgenda] = useState<number>(0)
  const [esterilizacionPendiente, setEsterilizacionPendiente] = useState<number>(0)
  const [inventario, setInventario] = useState<number>(0)
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState<number>(0)
  const [pagosVencidos, setPagosVencidos] = useState<number>(0)
  const [papelera, setPapelera] = useState<number>(0)
  const criticoSonadoRef = useRef(false)

  const refrescar = useCallback((): void => {
    const inv = contarInventarioBajo()
    const pag = contarPagosVencidos()
    setAgenda(contarCitasHoy())
    setEsterilizacionPendiente(contarCiclosEsterilizacionPendientes())
    setInventario(inv)
    setMensajesNoLeidos(contarMensajesNoLeidos())
    setPagosVencidos(pag)

    if (!criticoSonadoRef.current && (inv > 0 || pag > 0)) {
      criticoSonadoRef.current = true
      playCriticoSound()
    }
  }, [])

  const refrescarPapelera = useCallback(async (): Promise<void> => {
    try {
      const eliminados = await listarPacientesEliminados()
      setPapelera(Array.isArray(eliminados) ? eliminados.length : 0)
    } catch {
      setPapelera(0)
    }
  }, [])

  useEffect(() => {
    refrescar()
    void refrescarPapelera()
  }, [refrescar, refrescarPapelera])

  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (!e.key || e.key.includes('agenda') || e.key.includes('pago') || e.key.includes('inventario')) {
        queueMicrotask(refrescar)
      }
    }
    const eventos = [
      'citas_actualizadas',
      'pagos_actualizados',
      'inventario_actualizado',
      'esterilizacion_actualizada',
      'comunicaciones_actualizadas',
      REALTIME_EVENTS.CITAS_CHANGED,
      REALTIME_EVENTS.PAGOS_CHANGED,
      REALTIME_EVENTS.INVENTARIO_CHANGED,
    ]
    const onPacientesActualizados = (): void => {
      queueMicrotask(() => { void refrescarPapelera() })
    }
    const onEvento = (): void => {
      queueMicrotask(refrescar)
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('pacientes_actualizados', onPacientesActualizados)
    eventos.forEach((ev) => window.addEventListener(ev, onEvento))

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('pacientes_actualizados', onPacientesActualizados)
      eventos.forEach((ev) => window.removeEventListener(ev, onEvento))
    }
  }, [refrescar, refrescarPapelera])

  return {
    agenda,
    agendaSinConfirmar: agenda,
    esterilizacionPendiente,
    inventario,
    inventarioBajo: inventario,
    mensajesNoLeidos,
    pagosVencidos,
    papelera,
    refrescar,
    refrescarPapelera,
  }
}
