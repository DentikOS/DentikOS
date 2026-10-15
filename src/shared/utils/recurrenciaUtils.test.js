import { describe, it, expect } from 'vitest'
import {
  calcularProximaFechaRecurrencia,
  generarCitasRecurrencia,
  validarConflictosRecurrencia,
} from './recurrenciaUtils'

describe('recurrenciaUtils (BP05 §07)', () => {
  describe('calcularProximaFechaRecurrencia', () => {
    it('retorna null si no hay recurrencia', () => {
      const cita = { fecha: '2026-09-24', recurrencia: 'ninguna' }
      expect(calcularProximaFechaRecurrencia(cita)).toBeNull()
    })

    it('calcula próxima fecha diaria', () => {
      const cita = { fecha: '2026-10-20', recurrencia: 'diario', frecuencia: 1 }
      expect(calcularProximaFechaRecurrencia(cita)).toBe('2026-10-21')
    })

    it('calcula próxima fecha semanal', () => {
      const cita = { fecha: '2026-09-24', recurrencia: 'semanal', frecuencia: 1 }
      expect(calcularProximaFechaRecurrencia(cita)).toBe('2026-10-01')
    })

    it('calcula próxima fecha quincenal', () => {
      const cita = { fecha: '2026-10-20', recurrencia: 'quincenal', frecuencia: 1 }
      expect(calcularProximaFechaRecurrencia(cita)).toBe('2026-11-03')
    })

    it('calcula próxima fecha mensual', () => {
      const cita = { fecha: '2026-09-24', recurrencia: 'mensual', frecuencia: 1 }
      expect(calcularProximaFechaRecurrencia(cita)).toBe('2026-10-24')
    })

    it('calcula próxima fecha para personalizado', () => {
      const cita = {
        fecha: '2026-10-20',
        recurrencia: 'personalizado',
        frecuencia: 10,
      }
      const proxima = calcularProximaFechaRecurrencia(cita)
      expect(proxima).toBe('2026-10-30')
    })
  })

  describe('generarCitasRecurrencia', () => {
    it('genera citas diarias', () => {
      const citaBase = {
        id: '1',
        fecha: '2026-10-20',
        recurrencia: 'diario',
        frecuencia: 1,
      }

      const citas = generarCitasRecurrencia(citaBase, 5)

      expect(citas).toHaveLength(4)
      expect(citas[0].fecha).toBe('2026-10-21')
      expect(citas[1].fecha).toBe('2026-10-22')
    })

    it('genera citas quincenales', () => {
      const citaBase = {
        id: '1',
        fecha: '2026-10-20',
        recurrencia: 'quincenal',
        frecuencia: 1,
      }

      const citas = generarCitasRecurrencia(citaBase, 4)

      expect(citas).toHaveLength(3)
      expect(citas[0].fecha).toBe('2026-11-03')
      expect(citas[1].fecha).toBe('2026-11-17')
    })

    it('respeta límite de 100 citas por serie', () => {
      const citaBase = {
        id: '1',
        fecha: '2026-10-20',
        recurrencia: 'diario',
        frecuencia: 1,
      }

      const citas = generarCitasRecurrencia(citaBase, 150)
      expect(citas.length).toBeLessThanOrEqual(99)
    })

    it('retorna array vacío si no hay recurrencia', () => {
      const citaBase = { id: 'cita_1', fecha: '2026-09-24', recurrencia: 'ninguna' }
      const citas = generarCitasRecurrencia(citaBase, 5)
      expect(citas).toHaveLength(0)
    })

    it('detiene generación al alcanzar fechaFin', () => {
      const citaBase = {
        id: 'cita_1',
        fecha: '2026-09-24',
        recurrencia: 'semanal',
        frecuencia: 1,
        fechaFin: '2026-10-10',
      }
      const citas = generarCitasRecurrencia(citaBase, 10)
      expect(citas).toHaveLength(2)
    })
  })

  describe('validarConflictosRecurrencia', () => {
    it('retorna valido: true si no hay conflictos', () => {
      const nuevaCita = { id: 'nueva', fecha: '2026-09-25', horaInicio: '10:00', boxAsignado: 'Box 1' }
      const citasExistentes = [{ id: 'existente', fecha: '2026-09-25', horaInicio: '11:00', boxAsignado: 'Box 1' }]
      const resultado = validarConflictosRecurrencia(nuevaCita, citasExistentes)
      expect(resultado.valido).toBe(true)
      expect(resultado.conflictos).toHaveLength(0)
    })

    it('detecta conflicto de horario', () => {
      const nuevaCita = { id: 'nueva', fecha: '2026-09-25', horaInicio: '10:00', boxAsignado: 'Box 1' }
      const citasExistentes = [{ id: 'existente', fecha: '2026-09-25', horaInicio: '10:00', boxAsignado: 'Box 1' }]
      const resultado = validarConflictosRecurrencia(nuevaCita, citasExistentes)
      expect(resultado.valido).toBe(false)
      expect(resultado.conflictos).toHaveLength(1)
    })
  })
})
