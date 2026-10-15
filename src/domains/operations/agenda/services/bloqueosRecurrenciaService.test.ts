import { describe, it, expect } from 'vitest'
import { generarInstanciasBloqueo, tieneBloqueoRecurrente } from './bloqueosRecurrenciaService'
import type { Cita } from '../schemas/citaSchema'

describe('bloqueosRecurrenciaService (BP05 §06)', () => {
  it('genera instancias diarias Lun-Vie', () => {
    const bloqueoBase: Cita = {
      id: 'bloqueo-1',
      esBloqueo: true,
      fecha: '2026-10-19', // Lunes
      horaInicio: '13:00',
      horaFin: '14:00',
      estado: 'Bloqueado',
      motivoBloqueo: 'Horario de Almuerzo',
      bloqueoRecurrencia: 'diario',
      bloqueoFechaFin: '2026-10-23', // Viernes
    } as unknown as Cita

    const instancias = generarInstanciasBloqueo(bloqueoBase, '2026-10-19', '2026-10-23')

    // Debe generar 5 instancias (Lun-Vie)
    expect(instancias).toHaveLength(5)
    expect(instancias[0].fecha).toBe('2026-10-19')
    expect(instancias[4].fecha).toBe('2026-10-23')
  })

  it('genera instancias semanales en dias especificos', () => {
    const bloqueoBase: Cita = {
      id: 'bloqueo-2',
      esBloqueo: true,
      fecha: '2026-10-19', // Lunes
      horaInicio: '09:00',
      horaFin: '10:00',
      estado: 'Bloqueado',
      motivoBloqueo: 'Capacitacion',
      bloqueoRecurrencia: 'semanal',
      bloqueoDiasSemana: [1, 3], // Lunes y Miercoles
      bloqueoFechaFin: '2026-10-31',
    } as unknown as Cita

    const instancias = generarInstanciasBloqueo(bloqueoBase, '2026-10-19', '2026-10-31')

    expect(instancias.length).toBeGreaterThan(2)
    instancias.forEach((inst) => {
      const [y, m, d] = inst.fecha.split('-').map(Number)
      const dia = new Date(y, m - 1, d, 12).getDay()
      expect([1, 3]).toContain(dia)
    })
  })

  it('detecta bloqueo recurrente en fecha especifica', () => {
    const bloqueos: Cita[] = [
      {
        id: 'bloqueo-1',
        esBloqueo: true,
        fecha: '2026-10-19',
        horaInicio: '13:00',
        horaFin: '14:00',
        estado: 'Bloqueado',
        motivoBloqueo: 'Horario de Almuerzo',
        bloqueoRecurrencia: 'diario',
        bloqueoFechaFin: '2026-12-31',
      } as unknown as Cita,
    ]

    // 2026-11-16 es Lunes (dia 1)
    const bloqueo = tieneBloqueoRecurrente(bloqueos, '2026-11-16', '13:30')
    expect(bloqueo).not.toBeNull()
    expect(bloqueo?.motivoBloqueo).toBe('Horario de Almuerzo')

    // 2026-11-15 es Domingo (dia 0) -> no aplica diario Lun-Vie
    const bloqueoDomingo = tieneBloqueoRecurrente(bloqueos, '2026-11-15', '13:30')
    expect(bloqueoDomingo).toBeNull()
  })
})
