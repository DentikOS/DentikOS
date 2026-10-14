/**
 * useNotificationTriggers — Orquestador de notificaciones clínicas
 * Blueprint 03 §05: Conecta eventos de dominio con generadores de notificaciones
 *
 * Se monta en App.tsx junto a useNotificationsRealtime.
 * Observa stores existentes sin acoplarse a hooks de dominio.
 *
 * Triggers implementados:
 * - Paciente con alergias activo → alergiaDetectada (crítica)
 * - Stock bajo en inventario → stockCritico (operativa)
 * - Cumpleaños de pacientes hoy → cumpleanosPaciente (informativa)
 * - Citas sin confirmar en 24h → recordatorioCita (informativa)
 * - Facturas vencidas >30d → pagoVencido (crítica)
 */
import { useEffect, useRef } from 'react'
import { usePacientesStore } from '../../app/stores/usePacientesStore'
import { useSesionStore } from '../../app/stores/sesionStore'
import { notificationGenerators } from '../../infrastructure/notification/notificationGenerators'
import { createLogger } from '../../infrastructure/logging/logger'
import { useSidebarCounters } from './useSidebarCounters'
import { inventarioStorageService } from '../../domains/operations/inventory/services/inventarioStorageService'
import { finanzasStorageService } from '../../domains/billing/cash-register/services/finanzasStorageService'
import { agendaStorageService } from '../../domains/operations/agenda/services/agendaStorageService'
import { obtenerFechaLocalISO } from '../utils/dateUtils'

const log = createLogger('useNotificationTriggers')
const TRIGGERS_KEY = 'dentikos_notif_triggers_state'

interface TriggersState {
  lastAlergiaCheck: string | null
  lastCumpleCheck: string | null
  lastPagoCheck: string | null
}

const getTriggersState = (): TriggersState => {
  if (typeof localStorage === 'undefined') return { lastAlergiaCheck: null, lastCumpleCheck: null, lastPagoCheck: null }
  try {
    const raw = localStorage.getItem(TRIGGERS_KEY)
    return raw ? JSON.parse(raw) : { lastAlergiaCheck: null, lastCumpleCheck: null, lastPagoCheck: null }
  } catch {
    return { lastAlergiaCheck: null, lastCumpleCheck: null, lastPagoCheck: null }
  }
}

const setTriggersState = (state: TriggersState): void => {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(TRIGGERS_KEY, JSON.stringify(state)) } catch {}
}

const hoyISO = (): string => obtenerFechaLocalISO()

export const useNotificationTriggers = (): void => {
  const userProfile = useSesionStore((s) => s.userProfile)
  const pacienteActivo = usePacientesStore((s) => s.pacienteActivo)
  const pacientes = usePacientesStore((s) => s.pacientes)
  const counters = useSidebarCounters()

  const userId = ((userProfile as any)?.id || (userProfile as any)?.userId) as string | undefined
  const clinicId = ((userProfile as any)?.clinicaId || (userProfile as any)?.clinicId) as string | undefined
  const stateRef = useRef<TriggersState>(getTriggersState())

  // TRIGGER 1: Alergia detectada en paciente activo
  useEffect(() => {
    if (!userId || !clinicId || !pacienteActivo?.id) return
    const pacienteIdStr = String(pacienteActivo.id)
    if (stateRef.current.lastAlergiaCheck === pacienteIdStr) return

    const rawAlergias = (pacienteActivo as any).alergias
    if (!rawAlergias) return
    const alergias = Array.isArray(rawAlergias) ? rawAlergias.join(', ') : String(rawAlergias)
    if (!alergias || alergias.toLowerCase() === 'ninguna' || alergias.trim() === '') return

    log.info(`Alergia detectada en ${pacienteActivo.nombre}: ${alergias}`)
    notificationGenerators.alergiaDetectada({
      userId,
      clinicId,
      pacienteId: pacienteIdStr,
      pacienteNombre: pacienteActivo.nombre,
      alergeno: alergias,
      gravedad: 'moderada',
    }).then((result) => {
      if (result.id) {
        stateRef.current = { ...stateRef.current, lastAlergiaCheck: pacienteIdStr }
        setTriggersState(stateRef.current)
      }
    }).catch((err) => log.error('Error en trigger alergia:', err))
  }, [pacienteActivo, userId, clinicId])

  // TRIGGER 2: Stock crítico (desde useSidebarCounters o inventarioStorageService)
  useEffect(() => {
    if (!userId || !clinicId) return
    const stockBajo = (counters as any).inventarioBajo as number | undefined
    if (!stockBajo || stockBajo <= 0) return

    let productos = (counters as any).productosBajoStock as Array<{
      id: string; nombre: string; stock: number; minimo: number
    }> | undefined

    if (!productos || productos.length === 0) {
      try {
        const items = (inventarioStorageService.obtenerItems?.() || []) as Record<string, unknown>[]
        productos = items
          .filter((item) => {
            const stock = parseFloat(String(item.cantidad ?? item.stockActual ?? 0)) || 0
            const minimo = parseFloat(String(item.minimoCritico ?? item.stockMinimo ?? 0)) || 0
            return minimo > 0 && stock < minimo
          })
          .map((item) => ({
            id: String(item.id || item.codigo || 'prod'),
            nombre: String(item.nombre || item.producto || 'Insumo'),
            stock: parseFloat(String(item.cantidad ?? item.stockActual ?? 0)) || 0,
            minimo: parseFloat(String(item.minimoCritico ?? item.stockMinimo ?? 0)) || 0,
          }))
      } catch (err) {
        log.warn('No se pudo verificar inventario para trigger:', err)
      }
    }

    if (!productos || productos.length === 0) return
    const productoCritico = productos[0]

    notificationGenerators.stockCritico({
      userId,
      clinicId,
      productoId: productoCritico.id,
      productoNombre: productoCritico.nombre,
      stockActual: productoCritico.stock,
      stockMinimo: productoCritico.minimo,
    }).catch((err) => log.error('Error en trigger stock:', err))
  }, [counters, userId, clinicId])

  // TRIGGER 3: Cumpleaños de pacientes (job diario)
  useEffect(() => {
    if (!userId || !clinicId || !pacientes || pacientes.length === 0) return
    const hoy = hoyISO()
    if (stateRef.current.lastCumpleCheck === hoy) return

    const monthDay = hoy.slice(5)
    const cumpleanerosHoy = pacientes.filter((p) => {
      const fn = (p as any).fechaNacimiento || (p as any).nacimiento
      if (!fn) return false
      const fnStr = typeof fn === 'string' ? fn : new Date(fn).toISOString()
      return fnStr.slice(5, 10) === monthDay
    })

    if (cumpleanerosHoy.length > 0) {
      const paciente = cumpleanerosHoy[0]
      const fn = (paciente as any).fechaNacimiento || (paciente as any).nacimiento
      const edad = new Date().getFullYear() - new Date(fn).getFullYear()

      notificationGenerators.cumpleanosPaciente({
        userId,
        clinicId,
        pacienteId: String(paciente.id),
        pacienteNombre: paciente.nombre,
        edad: isNaN(edad) ? 0 : edad,
      }).catch((err) => log.error('Error en trigger cumpleaños:', err))
    }

    stateRef.current = { ...stateRef.current, lastCumpleCheck: hoy }
    setTriggersState(stateRef.current)
  }, [pacientes, userId, clinicId])

  // TRIGGER 4: Pago vencido (job diario)
  useEffect(() => {
    if (!userId || !clinicId) return
    const hoy = hoyISO()
    if (stateRef.current.lastPagoCheck === hoy) return

    try {
      const movimientos = finanzasStorageService.obtenerMovimientos?.() || []
      const hoyDate = new Date()
      const pagosVencidos = movimientos.filter((m: any) => {
        if (m.tipo !== 'ingreso_pendiente' && m.estado !== 'pendiente') return false
        const fechaVenc = new Date(m.fechaVencimiento || m.fecha)
        const diasVencido = Math.floor((hoyDate.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24))
        return diasVencido > 30
      })

      if (pagosVencidos.length > 0) {
        const pago = pagosVencidos[0]
        const diasVencido = Math.floor(
          (hoyDate.getTime() - new Date(String(pago.fechaVencimiento || pago.fecha)).getTime()) / (1000 * 60 * 60 * 24)
        )
        notificationGenerators.pagoVencido({
          userId,
          clinicId,
          pacienteId: String(pago.pacienteId || 'desconocido'),
          pacienteNombre: pago.pacienteNombre || 'Paciente',
          monto: Number(pago.monto) || 0,
          diasVencido,
          facturaId: String(pago.id),
        }).catch((err) => log.error('Error en trigger pago vencido:', err))
      }
    } catch (err) {
      log.warn('No se pudo verificar pagos vencidos:', err)
    }

    stateRef.current = { ...stateRef.current, lastPagoCheck: hoy }
    setTriggersState(stateRef.current)
  }, [userId, clinicId])

  // TRIGGER 5: Recordatorio de cita (cada hora)
  useEffect(() => {
    if (!userId || !clinicId) return

    const checkRecordatorios = () => {
      try {
        const citas = agendaStorageService.obtenerCitas?.() || []
        const ahora = new Date()
        const en24h = new Date(ahora.getTime() + 24 * 60 * 60 * 1000)

        const citasSinConfirmar = citas.filter((c: any) => {
          if (c.estado === 'Confirmado' || c.estado === 'Completado' || c.estado === 'Cancelado') return false
          const fechaCita = new Date(`${c.fecha}T${c.horaInicio || c.hora}`)
          return fechaCita > ahora && fechaCita <= en24h
        })

        if (citasSinConfirmar.length > 0) {
          const cita = citasSinConfirmar[0]
          notificationGenerators.recordatorioCita({
            userId,
            clinicId,
            citaId: String(cita.id),
            pacienteNombre: cita.pacienteNombre || 'Paciente',
            fecha: String(cita.fecha),
            hora: String(cita.horaInicio || cita.hora || '09:00'),
          }).catch((err) => log.error('Error en trigger recordatorio:', err))
        }
      } catch (err) {
        log.warn('No se pudo verificar recordatorios:', err)
      }
    }

    checkRecordatorios()
    const interval = setInterval(checkRecordatorios, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [userId, clinicId])
}
