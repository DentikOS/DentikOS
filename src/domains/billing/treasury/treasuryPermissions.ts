export const AREAS_BP15 = [
  'caja', 'conciliacion', 'cartera', 'gastos', 'bonos', 'libros', 'flujo', 'reportes'
] as const

export type AreaBP15 = typeof AREAS_BP15[number]

export function obtenerAreasBP15(rol: string | null | undefined): AreaBP15[] {
  if (rol === 'admin') return [...AREAS_BP15]
  if (rol === 'recepcion') return ['caja']
  return []
}
