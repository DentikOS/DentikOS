import { describe, expect, it } from 'vitest'
import { sugerirCoincidenciasBancarias } from './conciliacionCalculations'

describe('sugerirCoincidenciasBancarias', () => {
  it('ordena sugerencias por monto, referencia y cercanía de fecha sin confirmar ni alterar fuentes', () => {
    const fuentes = [
      { id: 'por-fecha', montoMenor: 10_000, moneda: 'CLP', fecha: '2026-11-05', referencia: 'OTRA' },
      { id: 'mejor', montoMenor: 10_000, moneda: 'CLP', fecha: '2026-11-04', referencia: 'ABC-123' },
      { id: 'otra-moneda', montoMenor: 10_000, moneda: 'USD', fecha: '2026-11-04', referencia: 'ABC-123' },
    ]
    const antes = structuredClone(fuentes)
    const sugerencias = sugerirCoincidenciasBancarias({
      movimiento: { montoMenor: 10_000, moneda: 'CLP', fecha: '2026-11-04', referencia: 'ABC 123' },
      fuentes,
      toleranciaMontoMenor: 100,
      ventanaDias: 5,
      limite: 5,
    })

    expect(sugerencias[0]).toMatchObject({ fuenteId: 'mejor', estado: 'sugerida' })
    expect(sugerencias.map(({ fuenteId }) => fuenteId)).toEqual(['mejor', 'por-fecha'])
    expect(fuentes).toEqual(antes)
    expect(sugerencias.every(({ estado }) => estado !== 'conciliada')).toBe(true)
  })

  it('rechaza fechas inválidas y nunca sugiere una diferencia mayor a la tolerancia', () => {
    const base = {
      movimiento: { montoMenor: 10_000, moneda: 'CLP', fecha: '2026-11-04', referencia: '' },
      fuentes: [{ id: 'fuente', montoMenor: 10_101, moneda: 'CLP', fecha: '2026-11-04', referencia: '' }],
      toleranciaMontoMenor: 100,
      ventanaDias: 0,
      limite: 10,
    }
    expect(sugerirCoincidenciasBancarias(base)).toEqual([])
    expect(() => sugerirCoincidenciasBancarias({ ...base, movimiento: { ...base.movimiento, fecha: 'ayer' } }))
      .toThrow(/fecha/i)
  })
})
