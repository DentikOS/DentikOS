export type EstadoPresupuesto =
  | 'borrador'
  | 'enviado'
  | 'aprobado'
  | 'en-curso'
  | 'completado'
  | 'rechazado'
  | 'vencido'

export const TRANSICIONES_VALIDAS: Record<EstadoPresupuesto, EstadoPresupuesto[]> = {
  borrador: ['enviado', 'rechazado'],
  enviado: ['aprobado', 'rechazado', 'vencido'],
  aprobado: ['en-curso', 'rechazado'],
  'en-curso': ['completado', 'rechazado'],
  completado: [],
  rechazado: ['borrador'],
  vencido: ['borrador'],
}

export function puedeTransicionar(actual: EstadoPresupuesto, nuevo: EstadoPresupuesto): boolean {
  return TRANSICIONES_VALIDAS[actual]?.includes(nuevo) ?? false
}

export function verificarVencimiento(fechaVencimiento?: string): boolean {
  if (!fechaVencimiento) return false
  return new Date(fechaVencimiento).getTime() < Date.now()
}

export function transicionPorPago(total: number, abonado: number): 'en-curso' | 'completado' {
  return abonado >= total ? 'completado' : 'en-curso'
}
