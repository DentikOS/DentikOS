/**
 * Constantes y Estados para el Módulo de Presupuestos Avanzado
 */

export interface EstadoPresupuestoConfig {
  id: string
  nombre: string
  colorBg: string
  colorText: string
  colorBorder: string
}

export interface OpcionCuota {
  cuotas: number
  nombre: string
}

export const ESTADOS_PRESUPUESTO: readonly EstadoPresupuestoConfig[] = [
  { id: 'borrador', nombre: 'Borrador', colorBg: 'bg-gray-100', colorText: 'text-gray-800', colorBorder: 'border-gray-300' },
  { id: 'enviado', nombre: 'Enviado', colorBg: 'bg-blue-50', colorText: 'text-blue-800', colorBorder: 'border-blue-300' },
  { id: 'aprobado', nombre: 'Aprobado', colorBg: 'bg-emerald-50', colorText: 'text-emerald-800', colorBorder: 'border-emerald-300' },
  { id: 'en-curso', nombre: 'En curso', colorBg: 'bg-purple-50', colorText: 'text-purple-800', colorBorder: 'border-purple-300' },
  { id: 'completado', nombre: 'Pago completado', colorBg: 'bg-emerald-50', colorText: 'text-emerald-800', colorBorder: 'border-emerald-300' },
  { id: 'rechazado', nombre: 'Rechazado', colorBg: 'bg-red-50', colorText: 'text-red-800', colorBorder: 'border-red-300' },
  { id: 'vencido', nombre: 'Vencido', colorBg: 'bg-red-50', colorText: 'text-red-800', colorBorder: 'border-red-300' },
  { id: 'archivado', nombre: 'Archivado', colorBg: 'bg-gray-100', colorText: 'text-gray-800', colorBorder: 'border-gray-300' },
  { id: 'Borrador', nombre: 'Borrador', colorBg: 'bg-gray-100', colorText: 'text-gray-800', colorBorder: 'border-gray-300' },
  { id: 'Emitido', nombre: 'Emitido / Entregado', colorBg: 'bg-blue-50', colorText: 'text-blue-800', colorBorder: 'border-blue-300' },
  { id: 'Aprobado', nombre: 'Aprobado por Paciente', colorBg: 'bg-emerald-50', colorText: 'text-emerald-800', colorBorder: 'border-emerald-300' },
  { id: 'EnTratamiento', nombre: 'En Tratamiento', colorBg: 'bg-purple-50', colorText: 'text-purple-800', colorBorder: 'border-purple-300' },
  { id: 'Rechazado', nombre: 'Rechazado / Vencido', colorBg: 'bg-red-50', colorText: 'text-red-800', colorBorder: 'border-red-300' }
]

// Transiciones que se pueden registrar manualmente en el CORE. El envío real y los
// estados asociados a pagos quedan a cargo de sus flujos respectivos.
export const TRANSICIONES_MANUALES_PRESUPUESTO: Readonly<Record<string, readonly string[]>> = {
  borrador: ['aprobado', 'rechazado'],
  Borrador: ['Aprobado', 'Rechazado'],
  enviado: ['aprobado', 'rechazado'],
  Emitido: ['Aprobado', 'Rechazado'],
  Pendiente: ['Aprobado', 'Rechazado'],
  vencido: ['rechazado'],
}

export const OPCIONES_CUOTAS: readonly OpcionCuota[] = [
  { cuotas: 1, nombre: 'Pago Contado (1 Cuota)' },
  { cuotas: 3, nombre: '3 Cuotas Precio Contado' },
  { cuotas: 6, nombre: '6 Cuotas Mensuales' },
  { cuotas: 12, nombre: '12 Cuotas Mensuales' }
]
