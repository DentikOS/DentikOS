import { describe, it, expect } from 'vitest'
import {
  verificarDisponibilidadBox,
  calcularResumenAgenda
} from './agendaCalculations'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'

describe('agendaCalculations', () => {
  it('detecta disponibilidad de box cuando no hay solapamiento', () => {
    const citas = [
      { id: 1, boxId: 'box_1', fechaIso: '2026-10-01', horaInicio: '09:00', horaFin: '10:00' }
    ]
    expect(verificarDisponibilidadBox(citas, 'box_1', '2026-10-01', '10:00')).toBe(true)
    expect(verificarDisponibilidadBox(citas, 'box_1', '2026-10-01', '09:30')).toBe(false)
    expect(verificarDisponibilidadBox(citas, 'box_1', '2026-10-01', '09:30', 1)).toBe(true)
  })

  it('calcula resumen de agenda correctamente', () => {
    const res = calcularResumenAgenda([])
    expect(res.totalHoy).toBe(0)
    expect(res.agendadosCount).toBe(0)
  })

  it('cuenta citas en estado Pendiente para agendadosCount (BP05 §02)', () => {
    const hoyIso = obtenerFechaLocalISO()
    const citas = [
      { id: 1, fechaIso: hoyIso, estado: 'Pendiente' },
      { id: 2, fechaIso: hoyIso, estado: 'En sala de espera' },
      { id: 3, fechaIso: hoyIso, estado: 'En atención' },
      { id: 4, fechaIso: hoyIso, estado: 'Completada' }
    ]
    const res = calcularResumenAgenda(citas)
    expect(res.totalHoy).toBe(4)
    expect(res.agendadosCount).toBe(1)
    expect(res.enEsperaCount).toBe(1)
    expect(res.enSillonCount).toBe(1)
    expect(res.finalizadosCount).toBe(1)
  })
})
