import { describe, expect, it } from 'vitest'
import { resumirVentasInternas } from './librosCalculations'

describe('resumirVentasInternas', () => {
  it('excluye pagos no confirmados, separa monedas y expone metadatos DTE ausentes sin declarar oficialidad', () => {
    const resumen = resumirVentasInternas([
      { id: 'pago-clp', montoMenor: 10_000, moneda: 'CLP', estado: 'confirmado', tipoDTE: null, folioDTE: null },
      { id: 'borrador', montoMenor: 50_000, moneda: 'CLP', estado: 'pendiente', tipoDTE: '39', folioDTE: '100' },
      { id: 'pago-usd', montoMenor: 1_000, moneda: 'USD', estado: 'confirmado', tipoDTE: '39', folioDTE: '200' },
    ])

    expect(resumen.porMoneda.CLP).toMatchObject({ totalMenor: 10_000, documentosDteFaltantes: 1 })
    expect(resumen.porMoneda.USD).toMatchObject({ totalMenor: 1_000, documentosDteFaltantes: 0 })
    expect(resumen.esOficial).toBe(false)
    expect(resumen.advertencias).toContain('vista_interna_no_verificada')
  })
})
