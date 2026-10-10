import { z } from 'zod'

/**
 * Esquema de validación de presupuesto (F2-04e / BP07 Completeness).
 * Soporta contratos legacy (id, folio, pacienteNombre, estado) y las nuevas
 * extensiones BP07 (items por fases, descuentos, planes de pago, versiones).
 */
export const itemPresupuestoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  codigoPrestacion: z.string().optional(),
  nombrePrestacion: z.string(),
  piezaDental: z.union([z.number(), z.string()]).optional(),
  cantidad: z.number().default(1),
  precioUnitario: z.number(),
  descuento: z.number().default(0),
  subtotal: z.number(),
  faseClinica: z.enum(['urgencias', 'estabilizacion', 'rehabilitacion', 'estetica']).optional(),
  notas: z.string().optional(),
}).passthrough()

export type ItemPresupuesto = z.infer<typeof itemPresupuestoSchema>

export const descuentoPresupuestoSchema = z.object({
  tipo: z.enum(['por-item', 'global', 'convenio']),
  valor: z.number(),
  motivo: z.string(),
  autorizadoPor: z.string(),
})

export type DescuentoPresupuesto = z.infer<typeof descuentoPresupuestoSchema>

export const planPagoSchema = z.object({
  modalidad: z.enum(['pago-unico', 'cuotas-sin-interes']),
  numeroCuotas: z.number().optional(),
  valorCuota: z.number().optional(),
  calendario: z.array(z.object({
    numero: z.number(),
    fechaVencimiento: z.string(),
    monto: z.number(),
    estado: z.enum(['pendiente', 'pagado', 'vencido']).default('pendiente'),
    fechaPago: z.string().optional(),
  })).optional(),
}).optional()

export type PlanPago = z.infer<typeof planPagoSchema>

export const pagoSchema = z.object({
  id: z.string(),
  presupuestoId: z.union([z.string(), z.number()]),
  clinicaId: z.string().optional(),
  monto: z.number(),
  metodoPago: z.enum(['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cheque']).or(z.string()),
  fechaPago: z.string(),
  referencia: z.string().optional(),
  recibidoPor: z.string().optional(),
  numeroCuota: z.number().optional(),
  comprobanteUrl: z.string().optional(),
  boletaNumero: z.string().optional(),
  facturaNumero: z.string().optional(),
  createdAt: z.string().optional(),
}).passthrough()

export type Pago = z.infer<typeof pagoSchema>

export const presupuestoSchema = z.object({
  id: z.union([z.number(), z.string()]),
  folio: z.string().trim().min(1, 'El folio del presupuesto es obligatorio'),
  pacienteNombre: z.string().trim().min(1, 'El nombre del paciente es obligatorio'),
  estado: z.string().trim().min(1, 'El estado del presupuesto es obligatorio'),

  // Campos opcionales
  pacienteId: z.union([z.number(), z.string()]).optional(),
  pacienteRut: z.string().optional(),
  fechaEmision: z.string().optional(),
  fechaCreacion: z.string().optional(),
  fechaEnvio: z.string().optional(),
  fechaAprobacion: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  convenio: z.string().optional(),
  montoTotal: z.number().optional(),
  total: z.number().optional(),
  totalBruto: z.number().optional(),
  totalDescuentos: z.number().optional(),
  totalAPagar: z.number().optional(),
  montoAbonado: z.number().optional(),
  items: z.array(z.any()).optional(),
  descuentos: z.array(descuentoPresupuestoSchema).optional(),
  planPago: planPagoSchema,
  observacion: z.string().optional(),
  versiones: z.array(z.any()).optional(),
  presupuestoComparativo: z.any().optional(),
  planTratamientoId: z.string().optional(),
  version: z.number().optional(),
}).passthrough()

export type Presupuesto = z.infer<typeof presupuestoSchema>

export const listaPresupuestosSchema = z.array(presupuestoSchema)

export type ValidacionListaPresupuestos = {
  valido: boolean
  datos: Presupuesto[] | null
  error: z.ZodError | null
}

export const validarListaPresupuestos = (presupuestos: unknown): ValidacionListaPresupuestos => {
  const resultado = listaPresupuestosSchema.safeParse(presupuestos)
  if (resultado.success) {
    return { valido: true, datos: resultado.data, error: null }
  }
  return { valido: false, datos: null, error: resultado.error }
}
