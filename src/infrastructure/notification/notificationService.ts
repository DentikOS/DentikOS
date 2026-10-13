/**
 * Servicio centralizado de notificaciones (F5-05).
 *
 * Gestiona toasts del sistema en memoria. Los componentes consumen vía
 * el hook useNotifications. El servicio es un singleton con estado mutable.
 *
 * API pública:
 * - mostrar(mensaje, opciones) → { id, dismiss }
 * - ocultar(id) → remueve notificación
 * - limpiar() → remueve todas
 * - listar() → retorna notificaciones actuales
 * - suscribir(callback) → recibe cambios de estado
 *
 * Tipos de toast:
 * - info (azul, 3s) - cambios de otros usuarios
 * - success (verde, 3s) - operaciones exitosas
 * - warning (amarillo, 5s) - advertencias
 * - error (rojo, 7s + requiere dismiss) - errores críticos
 *
 * Límite: máximo 3 toasts visibles simultáneamente.
 */

import { createLogger } from '../logging/logger'
import { playSound } from '../../shared/utils/soundEffects'

const log = createLogger('notificationService')
const MAX_VISIBLES = 3

export type NotificationType = 'info' | 'success' | 'warning' | 'error'
export type NotificationSeverity = 'critical' | 'operational' | 'informational'

export const DURACION_AUTO_DESCARTE: Record<NotificationSeverity, number> = {
  operational: 24 * 60 * 60 * 1000, // 24 horas en ms
  informational: 48 * 60 * 60 * 1000, // 48 horas en ms
  critical: 0, // Nunca se auto-descartan
}

export interface NotificationOptions {
  tipo?: NotificationType
  severity?: NotificationSeverity
  duracion?: number
  titulo?: string | null
  dismissable?: boolean
}

export interface NotificationItem {
  id: string
  tipo: NotificationType
  severity?: NotificationSeverity
  mensaje: string
  titulo: string | null
  dismissable: boolean
  timestamp: number
}

export interface ShowNotificationResult {
  id: string
  dismiss: () => void
}

export type NotificationListener = (notifications: NotificationItem[]) => void

// Estado interno
let notificaciones: NotificationItem[] = []
const listeners: Set<NotificationListener> = new Set()

// Duraciones por tipo (ms)
const DURACION_POR_TIPO: Record<NotificationType, number> = {
  info: 3000,
  success: 3000,
  warning: 5000,
  error: 7000
}

/**
 * Genera ID único para cada notificación.
 */
const generarId = (): string => {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Notifica a todos los suscriptores del cambio de estado.
 */
const notificar = (): void => {
  const copia = [...notificaciones]
  listeners.forEach((cb) => {
    try {
      cb(copia)
    } catch (e) {
      log.error('Error en listener:', e)
    }
  })
}

/**
 * Agrega una notificación al sistema.
 */
export const mostrar = (mensaje: string, opciones: NotificationOptions = {}): ShowNotificationResult => {
  const {
    tipo = 'info',
    severity,
    duracion = severity ? 0 : (DURACION_POR_TIPO[tipo] || 3000),
    titulo = null,
    dismissable = true
  } = opciones

  const id = generarId()

  const nuevaNotificacion: NotificationItem = {
    id,
    tipo,
    severity,
    mensaje,
    titulo,
    dismissable,
    timestamp: Date.now()
  }

  // Respetar máximo de visibles para toasts flotantes (sin severidad)
  if (!severity && notificaciones.filter((n) => !n.severity).length >= MAX_VISIBLES) {
    const primerToastIdx = notificaciones.findIndex((n) => !n.severity)
    if (primerToastIdx !== -1) {
      notificaciones = notificaciones.filter((_, idx) => idx !== primerToastIdx)
    }
  }

  notificaciones = [...notificaciones, nuevaNotificacion]
  notificar()

  // Reproducir sonido según severidad (Blueprint 03 §05)
  try {
    if (severity === 'critical') {
      playSound('criticalNotif') // 220Hz, 180ms
    } else if (severity === 'operational') {
      playSound('infoNotif') // 850Hz, 30ms
    }
    // Informativa: silencio (no se reproduce sonido)
  } catch {
    // Silencioso si audio no disponible
  }

  // Auto-dismiss si duración > 0
  if (duracion > 0) {
    setTimeout(() => {
      ocultar(id)
    }, duracion)
  }

  // Auto-descarte por severidad (centro de notificaciones)
  if (severity && DURACION_AUTO_DESCARTE[severity] > 0) {
    setTimeout(() => {
      ocultar(id)
    }, DURACION_AUTO_DESCARTE[severity])
  }

  return {
    id,
    dismiss: () => ocultar(id)
  }
}

/**
 * Remueve una notificación por ID.
 */
export const ocultar = (id: string): void => {
  const largoAntes = notificaciones.length
  notificaciones = notificaciones.filter((n) => n.id !== id)

  if (notificaciones.length !== largoAntes) {
    notificar()
  }
}

/**
 * Remueve todas las notificaciones.
 */
export const limpiar = (): void => {
  if (notificaciones.length > 0) {
    notificaciones = []
    notificar()
  }
}

/**
 * Retorna una copia de las notificaciones actuales (filtrando auto-descartadas).
 */
export const listar = (): NotificationItem[] => {
  const ahora = Date.now()
  const activas = notificaciones.filter((n) => {
    if (!n.severity) return true
    const limite = DURACION_AUTO_DESCARTE[n.severity]
    return !limite || ahora - n.timestamp < limite
  })
  if (activas.length !== notificaciones.length) {
    notificaciones = activas
  }
  return [...notificaciones]
}

/**
 * Suscribe un callback a cambios de estado.
 */
export const suscribir = (callback: NotificationListener): (() => void) => {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

/**
 * Atajos para tipos comunes.
 */
export const notificarInfo = (mensaje: string, opciones: NotificationOptions = {}): ShowNotificationResult =>
  mostrar(mensaje, { ...opciones, tipo: 'info' })

export const notificarExito = (mensaje: string, opciones: NotificationOptions = {}): ShowNotificationResult =>
  mostrar(mensaje, { ...opciones, tipo: 'success' })

export const notificarAdvertencia = (mensaje: string, opciones: NotificationOptions = {}): ShowNotificationResult =>
  mostrar(mensaje, { ...opciones, tipo: 'warning' })

export const notificarError = (mensaje: string, opciones: NotificationOptions = {}): ShowNotificationResult =>
  mostrar(mensaje, { ...opciones, tipo: 'error' })

/**
 * Servicio exportado como objeto para consistencia.
 */
export const notificationService = {
  mostrar,
  ocultar,
  limpiar,
  listar,
  suscribir,
  info: notificarInfo,
  success: notificarExito,
  warning: notificarAdvertencia,
  error: notificarError
}
