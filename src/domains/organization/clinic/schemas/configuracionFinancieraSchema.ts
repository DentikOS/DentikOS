import { z } from 'zod'

export const METODOS_PAGO_CLINICA = [
  'efectivo',
  'tarjeta_debito',
  'tarjeta_credito',
  'transferencia',
  'cheque',
] as const

const recordatoriosSchema = z.object({
  activados: z.boolean().default(true),
  presupuestoSinRespuesta: z.boolean().default(true),
  presupuestoPorVencer: z.boolean().default(true),
  presupuestoVencido: z.boolean().default(true),
  cuotasPendientes: z.boolean().default(true),
}).strict().default({
  activados: true,
  presupuestoSinRespuesta: true,
  presupuestoPorVencer: true,
  presupuestoVencido: true,
  cuotasPendientes: true,
})

export const configuracionFinancieraSchema = z.object({
  version: z.literal(1).default(1),
  validezPresupuestoDias: z.number().int().min(1).max(90).default(15),
  maximoCuotasSinInteres: z.number().int().min(1).max(12).default(6),
  frecuenciaCuotas: z.enum(['mensual', 'quincenal']).default('mensual'),
  descuentoMaximoPermitidoPct: z.number().min(0).max(100).default(50),
  requiereMotivoDescuento: z.boolean().default(true),
  firmaObligatoriaPresupuesto: z.boolean().default(false),
  abonoMinimoParaAprobarPct: z.number().min(0).max(100).default(0),
  mediosPagoAceptados: z.array(z.enum(METODOS_PAGO_CLINICA)).min(1).max(METODOS_PAGO_CLINICA.length).default([...METODOS_PAGO_CLINICA]),
  recordatorios: recordatoriosSchema,
}).strict()

export type ConfiguracionFinanciera = z.infer<typeof configuracionFinancieraSchema>

export const crearConfiguracionFinancieraPredeterminada = (): ConfiguracionFinanciera =>
  configuracionFinancieraSchema.parse({})

export const leerConfiguracionFinanciera = (entrada: unknown): ConfiguracionFinanciera | null => {
  const resultado = configuracionFinancieraSchema.safeParse(entrada)
  return resultado.success ? resultado.data : null
}
