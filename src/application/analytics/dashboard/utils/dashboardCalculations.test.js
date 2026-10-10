import { describe, it, expect } from 'vitest'
import { calcularMetricasAgenda, calcularTendenciasCitas } from './agendaCalculations'
import { calcularMetricasFinanzas } from './finanzasCalculations'
import { calcularMetricasClinicas } from './clinicasCalculations'

describe('Dashboard Calculations Utils (BP04 §03)', () => {
  it('calcularMetricasAgenda calcula ocupación y citas del día', () => {
    const citas = [
      { id: '1', fecha: '2026-10-10', estado: 'Agendado' },
      { id: '2', fecha: '2026-10-10', estado: 'En Espera' },
      { id: '3', fecha: '2026-10-09', estado: 'Completado' }
    ]
    const res = calcularMetricasAgenda(citas, '2026-10-10')
    expect(res.citasHoy.length).toBe(2)
    expect(res.enEspera.length).toBe(1)
    expect(res.tasaOcupacionAgenda).toBeGreaterThan(0)
  })

  it('calcularTendenciasCitas retorna series de días solicitados', () => {
    const citas = [{ id: '1', fecha: new Date().toISOString().split('T')[0] }]
    const res = calcularTendenciasCitas(citas, 7)
    expect(res.length).toBe(7)
  })

  it('calcularMetricasFinanzas calcula recaudación y conversión', () => {
    const pagos = [{ id: 'p1', fecha: '2026-10-10', monto: 100000, estado: 'Completado' }]
    const presupuestos = [
      { id: 'pr1', total: 200000, estado: 'Aceptado' },
      { id: 'pr2', total: 100000, estado: 'Borrador' }
    ]
    const res = calcularMetricasFinanzas(pagos, presupuestos, '2026-10-10')
    expect(res.recaudacionHoy).toBe(100000)
    expect(res.montoTotalCotizado).toBe(300000)
    expect(res.montoTotalAceptado).toBe(200000)
    expect(res.tasaConversionPresupuestos).toBe(50)
  })

  it('calcularMetricasClinicas retorna alertas y tareas', () => {
    const res = calcularMetricasClinicas([], [], [], [], [], [])
    expect(res).toHaveProperty('alertas')
    expect(res).toHaveProperty('tareas')
  })
})
