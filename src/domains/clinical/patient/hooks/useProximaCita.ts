import { useMemo } from 'react'
import { useAgendaStore } from '../../../../app/stores/useAgendaStore'
import type { Cita } from '../../../operations/agenda/schemas/citaSchema'

const esCitaValidaYFutura = (c: Cita, hoy: Date): boolean => {
  const estado = (c.estado || '').toLowerCase()
  if (['cancelada', 'cancelado', 'anulado', 'anulada'].includes(estado)) return false
  const fechaCita = new Date(c.fecha + 'T' + (c.horaInicio || '00:00'))
  return !isNaN(fechaCita.getTime()) && fechaCita >= hoy
}

export const useProximasCitasMap = (): Map<string, Cita> => {
  const citas = useAgendaStore((s) => s.citas)

  return useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const map = new Map<string, Cita>()
    const sorted = [...citas]
      .filter((c) => Boolean(c.pacienteId) && esCitaValidaYFutura(c, hoy))
      .sort((a, b) => {
        const tA = new Date(a.fecha + 'T' + (a.horaInicio || '00:00')).getTime()
        const tB = new Date(b.fecha + 'T' + (b.horaInicio || '00:00')).getTime()
        return tA - tB
      })

    for (const c of sorted) {
      const pid = String(c.pacienteId)
      if (!map.has(pid)) map.set(pid, c)
    }
    return map
  }, [citas])
}

export const useProximaCita = (pacienteId?: string | number | null): Cita | null => {
  const map = useProximasCitasMap()
  if (!pacienteId) return null
  return map.get(String(pacienteId)) || null
}
