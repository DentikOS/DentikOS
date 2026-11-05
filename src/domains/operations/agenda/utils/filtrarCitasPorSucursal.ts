import type { Cita } from '../schemas/citaSchema'

/** Las citas históricas sin sucursal siguen visibles en cualquier filtro de sucursal. */
export const filtrarCitasPorSucursal = (citas: readonly Cita[], sucursalId: string): Cita[] =>
  sucursalId
    ? citas.filter((cita) => !cita.sedeId || cita.sedeId === sucursalId)
    : [...citas]
