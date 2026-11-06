import { z } from 'zod'

/**
 * Esquema de validación de movimiento financiero (F2-04c / Migración TypeScript).
 * Sigue el patrón establecido en `pacienteSchema.js` (F2-04) y `citaSchema.js` (F2-04b).
 */
export const movimientoFinancieroSchema = z.object({
  // Campos obligatorios
  id: z.union([z.number(), z.string()]),
  fecha: z.string().trim().min(1, 'La fecha del movimiento es obligatoria'),
  tipo: z.string().trim().min(1, 'El tipo de movimiento es obligatorio'),
  categoria: z.string().trim().min(1, 'La categoría es obligatoria'),
  monto: z.number({ message: 'El monto es obligatorio' }),
  metodoPago: z.string().trim().min(1, 'El método de pago es obligatorio'),

  // Campos opcionales
  pacienteNombre: z.string().optional(),
  origen: z.string().optional(),
}).passthrough()

export type MovimientoFinanciero = z.infer<typeof movimientoFinancieroSchema> & {
  moneda?: string
  ordenLaboratorioId?: string | null
}

export const listaMovimientosSchema = z.array(movimientoFinancieroSchema)

export type ListaMovimientos = z.infer<typeof listaMovimientosSchema>

export interface ValidacionListaMovimientosResultado {
  valido: boolean
  datos: MovimientoFinanciero[] | null
  error: z.ZodError | null
}

/**
 * Valida un arreglo de movimientos financieros. No lanza excepción — retorna
 * un resultado explícito para que el llamador decida qué hacer.
 */
export const validarListaMovimientos = (movimientos: unknown): ValidacionListaMovimientosResultado => {
  const resultado = listaMovimientosSchema.safeParse(movimientos)
  if (resultado.success) {
    return { valido: true, datos: resultado.data, error: null }
  }
  return { valido: false, datos: null, error: resultado.error }
}
