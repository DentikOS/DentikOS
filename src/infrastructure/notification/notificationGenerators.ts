/**
 * notificationGenerators — Catálogo de generadores de notificaciones clínicas
 * Blueprint 03 §05: Cada evento clínico relevante dispara una notificación
 * con severidad, sonido y expiración apropiados.
 * 
 * Severidades:
 * - CRÍTICA: Alergias, pagos vencidos (220Hz, nunca expira)
 * - OPERATIVA: Stock, citas, esterilización (850Hz, expira 24h)
 * - INFORMATIVA: Cumpleaños, recordatorios (silencio, expira 48h)
 */
import { notificationRepository } from './notificationRepository'
import { createLogger } from '../logging/logger'

const log = createLogger('notificationGenerators')

const DEDUPLICATION_KEY = 'dentikos_notif_dedup'
const DEDUPLICATION_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

export interface GeneradorResult {
  id: string | null
  deduplicado: boolean
}

const fueGeneradoRecientemente = (clave: string): boolean => {
  if (typeof localStorage === 'undefined') return false
  try {
    const raw = localStorage.getItem(DEDUPLICATION_KEY)
    if (!raw) return false
    const registro = JSON.parse(raw) as Record<string, number>
    return Boolean(registro[clave] && Date.now() - registro[clave] < DEDUPLICATION_TTL_MS)
  } catch {
    return false
  }
}

const registrarGeneracion = (clave: string): void => {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(DEDUPLICATION_KEY)
    const registro = raw ? JSON.parse(raw) : {}
    registro[clave] = Date.now()
    const ahora = Date.now()
    Object.keys(registro).forEach((k) => {
      if (ahora - registro[k] > 7 * DEDUPLICATION_TTL_MS) delete registro[k]
    })
    localStorage.setItem(DEDUPLICATION_KEY, JSON.stringify(registro))
  } catch {}
}

const ejecutarConDedup = async (
  clave: string,
  params: Parameters<typeof notificationRepository.crear>[0],
  logMsg: string
): Promise<GeneradorResult> => {
  if (fueGeneradoRecientemente(clave)) return { id: null, deduplicado: true }
  const id = await notificationRepository.crear(params)
  if (id) registrarGeneracion(clave)
  log.info(logMsg)
  return { id, deduplicado: false }
}

// ============================================================
// GENERADORES CRÍTICOS (220Hz, nunca expiran)
// ============================================================

export const alergiaDetectada = async (params: {
  userId: string; clinicId: string; pacienteId: string; pacienteNombre: string; alergeno: string; gravedad: 'leve' | 'moderada' | 'severa'
}): Promise<GeneradorResult> => ejecutarConDedup(
  `alergia-${params.pacienteId}-${params.alergeno}`,
  {
    userId: params.userId,
    clinicId: params.clinicId,
    severity: 'critical',
    title: `⚠️ Alergia ${params.gravedad}: ${params.alergeno}`,
    message: `${params.pacienteNombre} tiene alergia registrada a ${params.alergeno}. Verificar antes de cualquier procedimiento.`,
    actionLabel: 'Ver Ficha Clínica',
    actionUrl: `/pacientes/${params.pacienteId}`,
    actionPayload: { pacienteId: params.pacienteId, alergeno: params.alergeno },
    expiresInHours: null,
  },
  `Alergia crítica notificada: ${params.alergeno} → ${params.pacienteNombre}`
)

export const pagoVencido = async (params: {
  userId: string; clinicId: string; pacienteId: string; pacienteNombre: string; monto: number; diasVencido: number; facturaId: string
}): Promise<GeneradorResult> => ejecutarConDedup(
  `pago-vencido-${params.facturaId}`,
  {
    userId: params.userId,
    clinicId: params.clinicId,
    severity: 'critical',
    title: `💰 Pago vencido: $${params.monto.toLocaleString('es-CL')}`,
    message: `${params.pacienteNombre} tiene ${params.diasVencido} días de atraso. Contactar para regularizar.`,
    actionLabel: 'Ver Factura',
    actionUrl: `/pagos/${params.facturaId}`,
    actionPayload: { facturaId: params.facturaId, pacienteId: params.pacienteId },
    expiresInHours: null,
  },
  `Pago vencido notificado: ${params.pacienteNombre} (${params.diasVencido} días)`
)

// ============================================================
// GENERADORES OPERATIVOS (850Hz, expiran en 24h)
// ============================================================

export const stockCritico = async (params: {
  userId: string; clinicId: string; productoId: string; productoNombre: string; stockActual: number; stockMinimo: number
}): Promise<GeneradorResult> => ejecutarConDedup(
  `stock-${params.productoId}`,
  {
    userId: params.userId,
    clinicId: params.clinicId,
    severity: 'operational',
    title: `📦 Stock crítico: ${params.productoNombre}`,
    message: `Quedan ${params.stockActual} unidades (mínimo: ${params.stockMinimo}). Solicitar reposición.`,
    actionLabel: 'Ver Inventario',
    actionUrl: `/inventario/${params.productoId}`,
    actionPayload: { productoId: params.productoId },
    expiresInHours: 24,
  },
  `Stock crítico notificado: ${params.productoNombre}`
)

export const citaConfirmada = async (params: {
  userId: string; clinicId: string; citaId: string; pacienteNombre: string; fecha: string; hora: string; motivo?: string
}): Promise<GeneradorResult> => ejecutarConDedup(
  `cita-conf-${params.citaId}`,
  {
    userId: params.userId,
    clinicId: params.clinicId,
    severity: 'operational',
    title: '✅ Cita confirmada',
    message: `${params.pacienteNombre} confirmó su cita del ${params.fecha} a las ${params.hora}${params.motivo ? ` (${params.motivo})` : ''}.`,
    actionLabel: 'Ver Agenda',
    actionUrl: `/agenda?cita=${params.citaId}`,
    actionPayload: { citaId: params.citaId },
    expiresInHours: 24,
  },
  `Cita confirmada notificada: ${params.pacienteNombre}`
)

export const cicloEsterilizacion = async (params: {
  userId: string; clinicId: string; cicloId: string; autoclaveNombre: string; instrumentosCount: number; duracion: string
}): Promise<GeneradorResult> => ejecutarConDedup(
  `esterilizacion-${params.cicloId}`,
  {
    userId: params.userId,
    clinicId: params.clinicId,
    severity: 'operational',
    title: '🧪 Esterilización completada',
    message: `${params.autoclaveNombre}: ${params.instrumentosCount} instrumentos listos (${params.duracion}). Validar en libro SEREMI.`,
    actionLabel: 'Validar Ciclo',
    actionUrl: `/esterilizacion/${params.cicloId}`,
    actionPayload: { cicloId: params.cicloId },
    expiresInHours: 24,
  },
  `Ciclo esterilización notificado: ${params.autoclaveNombre}`
)

// ============================================================
// GENERADORES INFORMATIVOS (silencio, expiran en 48h)
// ============================================================

export const cumpleanosPaciente = async (params: {
  userId: string; clinicId: string; pacienteId: string; pacienteNombre: string; edad: number
}): Promise<GeneradorResult> => ejecutarConDedup(
  `cumple-${params.pacienteId}-${new Date().toISOString().split('T')[0]}`,
  {
    userId: params.userId,
    clinicId: params.clinicId,
    severity: 'informational',
    title: '🎂 Cumpleaños hoy',
    message: `${params.pacienteNombre} cumple ${params.edad} años. Enviar saludo personalizado.`,
    actionLabel: 'Enviar Saludo',
    actionUrl: `/comunicaciones?paciente=${params.pacienteId}&tipo=cumpleanos`,
    actionPayload: { pacienteId: params.pacienteId },
    expiresInHours: 48,
  },
  `Cumpleaños notificado: ${params.pacienteNombre}`
)

export const recordatorioCita = async (params: {
  userId: string; clinicId: string; citaId: string; pacienteNombre: string; fecha: string; hora: string
}): Promise<GeneradorResult> => ejecutarConDedup(
  `recordatorio-${params.citaId}`,
  {
    userId: params.userId,
    clinicId: params.clinicId,
    severity: 'informational',
    title: '📅 Cita sin confirmar (mañana)',
    message: `${params.pacienteNombre} tiene cita el ${params.fecha} a las ${params.hora}. Contactar para confirmar.`,
    actionLabel: 'Confirmar Cita',
    actionUrl: `/agenda?cita=${params.citaId}&accion=confirmar`,
    actionPayload: { citaId: params.citaId },
    expiresInHours: 48,
  },
  `Recordatorio de cita notificado: ${params.pacienteNombre}`
)

// ============================================================
// API PÚBLICA UNIFICADA
// ============================================================

export const notificationGenerators = {
  // Críticas
  alergiaDetectada,
  pagoVencido,
  // Operativas
  stockCritico,
  citaConfirmada,
  cicloEsterilizacion,
  // Informativas
  cumpleanosPaciente,
  recordatorioCita,
} as const

export type NotificationGeneratorName = keyof typeof notificationGenerators
