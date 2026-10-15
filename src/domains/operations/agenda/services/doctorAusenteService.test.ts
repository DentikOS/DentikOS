import { describe, it, expect, vi, beforeEach } from 'vitest'
import { procesarAusenciaDoctor } from './doctorAusenteService'
import type { Cita } from '../schemas/citaSchema'

vi.mock('../utils/auditoriaCita', () => ({
  registrarCambioEstado: vi.fn().mockResolvedValue(true)
}))

describe('doctorAusenteService (BP05 §09 Parte 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('procesa y marca citas del doctor ausente como pendientes de reasignación', async () => {
    const citas: Cita[] = [
      { id: 'c1', doctor: 'doc-1', fecha: '2026-10-20', horaInicio: '09:00', estado: 'Pendiente', pacienteNombre: 'Juan Perez' },
      { id: 'c2', doctor: 'doc-1', fecha: '2026-10-20', horaInicio: '10:00', estado: 'Confirmada', pacienteNombre: 'Maria Lopez' },
      { id: 'c3', doctor: 'doc-2', fecha: '2026-10-20', horaInicio: '09:00', estado: 'Pendiente', pacienteNombre: 'Carlos Ruiz' },
      { id: 'c4', doctor: 'doc-1', fecha: '2026-10-21', horaInicio: '09:00', estado: 'Pendiente', pacienteNombre: 'Ana Soto' },
      { id: 'c5', doctor: 'doc-1', fecha: '2026-10-20', horaInicio: '11:00', estado: 'Cancelada', pacienteNombre: 'Pedro Gomez' },
      { id: 'c6', doctor: 'doc-1', fecha: '2026-10-20', horaInicio: '12:00', estado: 'Completada', pacienteNombre: 'Rosa Diaz' },
    ]

    const resultado = await procesarAusenciaDoctor('doc-1', 'Dr. Martínez', '2026-10-20', citas)

    expect(resultado.totalCitas).toBe(2)
    expect(resultado.pendientesRevision).toBe(2)
    expect(resultado.detalles.length).toBe(2)
    expect(resultado.detalles[0].citaId).toBe('c1')
    expect(resultado.detalles[0].estado).toBe('pendiente')
    expect(resultado.detalles[1].citaId).toBe('c2')
  })

  it('retorna totalCitas 0 si el doctor no tiene citas activas en la fecha', async () => {
    const citas: Cita[] = [
      { id: 'c1', doctor: 'doc-2', fecha: '2026-10-20', horaInicio: '09:00', estado: 'Pendiente' },
    ]

    const resultado = await procesarAusenciaDoctor('doc-1', 'Dr. Martínez', '2026-10-20', citas)

    expect(resultado.totalCitas).toBe(0)
    expect(resultado.pendientesRevision).toBe(0)
    expect(resultado.detalles.length).toBe(0)
  })
})
