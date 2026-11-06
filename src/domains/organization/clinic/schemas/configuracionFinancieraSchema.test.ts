import { describe, expect, it } from 'vitest'
import {
  configuracionFinancieraSchema,
  crearConfiguracionFinancieraPredeterminada,
  leerConfiguracionFinanciera,
} from './configuracionFinancieraSchema'

describe('configuracionFinancieraSchema', () => {
  it('usa los defaults BP08 §11 al crear una configuración', () => {
    expect(crearConfiguracionFinancieraPredeterminada()).toEqual({
      version: 1,
      validezPresupuestoDias: 15,
      maximoCuotasSinInteres: 6,
      frecuenciaCuotas: 'mensual',
      descuentoMaximoPermitidoPct: 50,
      requiereMotivoDescuento: true,
      firmaObligatoriaPresupuesto: false,
      abonoMinimoParaAprobarPct: 0,
      mediosPagoAceptados: ['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cheque'],
      recordatorios: {
        activados: true,
        presupuestoSinRespuesta: true,
        presupuestoPorVencer: true,
        presupuestoVencido: true,
        cuotasPendientes: true,
      },
    })
  })

  it('rechaza valores fuera de los rangos del Blueprint', () => {
    expect(configuracionFinancieraSchema.safeParse({ validezPresupuestoDias: 91 }).success).toBe(false)
    expect(configuracionFinancieraSchema.safeParse({ maximoCuotasSinInteres: 13 }).success).toBe(false)
    expect(configuracionFinancieraSchema.safeParse({ descuentoMaximoPermitidoPct: 101 }).success).toBe(false)
    expect(configuracionFinancieraSchema.safeParse({ mediosPagoAceptados: [] }).success).toBe(false)
  })

  it('lee valores guardados y rechaza una configuración corrupta', () => {
    expect(leerConfiguracionFinanciera({ version: 1, validezPresupuestoDias: 30 })?.validezPresupuestoDias).toBe(30)
    expect(leerConfiguracionFinanciera({ version: 9 })).toBeNull()
  })
})
