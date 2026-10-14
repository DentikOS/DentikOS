/**
 * Hook para Contextual Intelligence en TopBar (BP03 §08 Parte 2)
 */
import { useEffect, useState, useCallback } from 'react'
import { agendaStorageService } from '../../domains/operations/agenda/services/agendaStorageService'
import { finanzasStorageService } from '../../domains/billing/cash-register/services/finanzasStorageService'
import { useTopBarStore } from '../../app/stores/useTopBarStore'
import { getClinicaActivaSync } from '../../infrastructure/auth/authService'
import type { Paciente } from '../../domains/clinical/patient/schemas/pacienteSchema'

export const calcularMensajeContextual = (paciente?: Paciente | null): string | null => {
  if (paciente?.nombre) return `${paciente.nombre} — Ficha activa`
  if (!getClinicaActivaSync()) return null

  const now = new Date()
  const hour = now.getHours()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowHHMM = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  try {
    const citas = (agendaStorageService.obtenerCitas() || []).filter(
      (c) => c.fecha === todayStr && c.estado !== 'Cancelado'
    )

    if (hour >= 8 && hour < 12) {
      return `Agenda — ${citas.length} citas hoy`
    }

    if (hour >= 12 && hour < 18) {
      const restantes = citas.filter((c) => c.estado !== 'Completado')
      const retrasos = restantes.filter(
        (c) => c.horaInicio && c.horaInicio < nowHHMM && c.estado !== 'En Sillón'
      )
      const sufijo = retrasos.length > 0 ? ' · 1 retraso' : ''
      return `${restantes.length} citas restantes${sufijo}`
    }

    if (hour >= 18) {
      const movimientos = finanzasStorageService.obtenerMovimientos?.() || []
      const monto = movimientos
        .filter((m) => m.fecha === todayStr && m.tipo === 'ingreso')
        .reduce((sum, m) => sum + (Number(m.monto) || 0), 0)
      if (monto > 0) return `Cierre de caja — $${monto.toLocaleString('es-CL')} por cuadrar`
    }
  } catch {}

  return null
}

export const useContextualIntelligence = (paciente?: Paciente | null): string | null => {
  const activeModule = useTopBarStore((s) => s.activeModule)
  const setContextualMessage = useTopBarStore((s) => s.setContextualMessage)
  const [mensaje, setMensaje] = useState<string | null>(() => calcularMensajeContextual(paciente))

  const refrescar = useCallback(() => {
    const msg = calcularMensajeContextual(paciente)
    setMensaje(msg)
    setContextualMessage(msg || '')
  }, [paciente, setContextualMessage])

  useEffect(() => {
    refrescar()
    // BP04 §06: Actualización cada 5 minutos según especificación
    const timer = setInterval(refrescar, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [refrescar, activeModule])

  return mensaje
}
