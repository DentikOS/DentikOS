import { describe, it, expect } from 'vitest'
import { citaSchema, listaCitasSchema, validarListaCitas } from './citaSchema'

describe('citaSchema (F2-04b)', () => {
  describe('Cita válida con campos mínimos', () => {
    it('acepta cita con solo los 4 campos obligatorios', () => {
      const cita = {
        id: 1,
        fecha: '2026-08-12',
        horaInicio: '10:00',
        estado: 'Agendado'
      }
      const result = citaSchema.safeParse(cita)
      expect(result.success).toBe(true)
    })

    it('acepta cita con id string (ej: "express_timestamp")', () => {
      const cita = {
        id: 'express_1723468800000',
        fecha: '2026-08-12',
        horaInicio: '10:00',
        estado: 'Agendado'
      }
      const result = citaSchema.safeParse(cita)
      expect(result.success).toBe(true)
    })
  })

  describe('Cita válida con todos los campos', () => {
    it('acepta cita completa con todos los campos opcionales', () => {
      const cita = {
        id: 1,
        fecha: '2026-08-12',
        horaInicio: '10:00',
        estado: 'Confirmado',
        pacienteId: 42,
        pacienteNombre: 'Juan Pérez',
        pacienteTelefono: '+56912345678',
        pacienteRut: '12.345.678-9',
        trataMiento: 'Control preventivo',
        boxAsignado: 'Box 1',
        horaInicioAtencion: '2026-08-12T10:05:00.000Z'
      }
      const result = citaSchema.safeParse(cita)
      expect(result.success).toBe(true)
    })

    it('acepta cita con paciente exprés (pacienteId = "express_xxx")', () => {
      const cita = {
        id: 100,
        fecha: '2026-08-12',
        horaInicio: '14:30',
        estado: 'Agendado',
        pacienteId: 'express_1723468800000',
        pacienteNombre: 'Paciente Express',
        pacienteTelefono: '912345678',
        pacienteRut: '',
        trataMiento: 'Agendado desde Agenda Multi-Box'
      }
      const result = citaSchema.safeParse(cita)
      expect(result.success).toBe(true)
    })
  })

  describe('Validación de estados', () => {
    const citaBase = { id: 1, fecha: '2026-08-12', horaInicio: '10:00' }

    it.each([
      'Agendado',
      'Confirmado',
      'En Sillón',
      'Atendido',
      'Cancelado',
      'Bloqueado',
      'Agendada'
    ])('acepta estado "%s"', (estado) => {
      const result = citaSchema.safeParse({ ...citaBase, estado })
      expect(result.success).toBe(true)
    })
  })

  describe('Citas inválidas (campos obligatorios ausentes)', () => {
    it('rechaza cita sin id', () => {
      const cita = { fecha: '2026-08-12', horaInicio: '10:00', estado: 'Agendado' }
      const result = citaSchema.safeParse(cita)
      expect(result.success).toBe(false)
    })

    it('rechaza cita sin fecha', () => {
      const cita = { id: 1, horaInicio: '10:00', estado: 'Agendado' }
      const result = citaSchema.safeParse(cita)
      expect(result.success).toBe(false)
    })

    it('rechaza cita sin horaInicio', () => {
      const cita = { id: 1, fecha: '2026-08-12', estado: 'Agendado' }
      const result = citaSchema.safeParse(cita)
      expect(result.success).toBe(false)
    })

    it('rechaza cita sin estado', () => {
      const cita = { id: 1, fecha: '2026-08-12', horaInicio: '10:00' }
      const result = citaSchema.safeParse(cita)
      expect(result.success).toBe(false)
    })

    it('rechaza cita con fecha vacía (string vacío)', () => {
      const cita = { id: 1, fecha: '', horaInicio: '10:00', estado: 'Agendado' }
      const result = citaSchema.safeParse(cita)
      expect(result.success).toBe(false)
    })
  })

  describe('Passthrough (permite campos adicionales)', () => {
    it('acepta cita con campos no catalogados sin fallar', () => {
      const cita = {
        id: 1,
        fecha: '2026-08-12',
        horaInicio: '10:00',
        estado: 'Agendado',
        notasProfesional: 'Paciente llega tarde',
        recordatorioEnviado: true,
        campoFuturo: { anidado: 'valor' }
      }
      const result = citaSchema.safeParse(cita)
      expect(result.success).toBe(true)
      expect(result.data.notasProfesional).toBe('Paciente llega tarde')
    })
  })
})

describe('listaCitasSchema (F2-04b)', () => {
  it('acepta array vacío', () => {
    const result = listaCitasSchema.safeParse([])
    expect(result.success).toBe(true)
  })

  it('acepta array con múltiples citas válidas', () => {
    const citas = [
      { id: 1, fecha: '2026-08-12', horaInicio: '10:00', estado: 'Agendado' },
      { id: 2, fecha: '2026-08-12', horaInicio: '11:00', estado: 'Confirmado' },
      { id: 3, fecha: '2026-08-13', horaInicio: '09:00', estado: 'Bloqueado' }
    ]
    const result = listaCitasSchema.safeParse(citas)
    expect(result.success).toBe(true)
  })

  it('rechaza array con al menos una cita inválida', () => {
    const citas = [
      { id: 1, fecha: '2026-08-12', horaInicio: '10:00', estado: 'Agendado' },
      { id: 2, fecha: '2026-08-12' } // inválida: faltan horaInicio y estado
    ]
    const result = listaCitasSchema.safeParse(citas)
    expect(result.success).toBe(false)
  })
})

describe('validarListaCitas (F2-04b)', () => {
  it('retorna valido: true y datos correctos para lista válida', () => {
    const citas = [
      { id: 1, fecha: '2026-08-12', horaInicio: '10:00', estado: 'Agendado' }
    ]
    const result = validarListaCitas(citas)
    expect(result.valido).toBe(true)
    expect(result.datos).toHaveLength(1)
    expect(result.error).toBeNull()
  })

  it('retorna valido: false y error para lista inválida', () => {
    const citas = [
      { id: 1, fecha: '2026-08-12' } // faltan horaInicio y estado
    ]
    const result = validarListaCitas(citas)
    expect(result.valido).toBe(false)
    expect(result.datos).toBeNull()
    expect(result.error).not.toBeNull()
  })

  it('maneja entrada null/undefined retornando valido: false', () => {
    expect(validarListaCitas(null).valido).toBe(false)
    expect(validarListaCitas(undefined).valido).toBe(false)
    expect(validarListaCitas('no es array').valido).toBe(false)
  })

  it('acepta los 5 patrones de recurrencia de BP05 y recurrence_group_id', () => {
    const patrones = ['diario', 'semanal', 'quincenal', 'mensual', 'personalizado']
    patrones.forEach((patron) => {
      const cita = {
        id: `rec-${patron}`,
        fecha: '2026-08-12',
        horaInicio: '10:00',
        estado: 'Pendiente',
        recurrencia: patron,
        recurrence_group_id: 'group-uuid-123'
      }
      const resultado = citaSchema.safeParse(cita)
      expect(resultado.success).toBe(true)
    })
  })

  describe('BP05 §02: 11 campos oficiales, enum confirmation_status y tramos de duracion', () => {
    it('acepta los 11 campos completos de BP05 §02', () => {
      const citaCompleta = {
        id: 'cita-11-campos',
        fecha: '2026-10-16',
        horaInicio: '09:00',
        horaFin: '09:45',
        duracionMinutos: 45,
        estado: 'Pendiente',
        pacienteId: 'pac-123',
        pacienteNombre: 'Juan Pérez',
        pacienteTelefono: '+56912345678',
        boxAsignado: 'Sillón 1',
        trataMiento: 'Endodoncia',
        motivo: 'Dolor agudo',
        observaciones: 'Paciente con fobia dental',
        presupuestoAsociado: 'pres-999',
        notasInternas: 'Nota confidencial según Ley 20.584',
        confirmation_status: 'confirmado'
      }
      const resultado = citaSchema.safeParse(citaCompleta)
      expect(resultado.success).toBe(true)
      if (resultado.success) {
        expect(resultado.data.presupuestoAsociado).toBe('pres-999')
        expect(resultado.data.notasInternas).toBe('Nota confidencial según Ley 20.584')
        expect(resultado.data.confirmation_status).toBe('confirmado')
      }
    })

    it('valida estrictamente los 4 valores del enum confirmation_status', () => {
      const validStatuses = ['pendiente', 'enviado', 'confirmado', 'no_confirmado']
      validStatuses.forEach((status) => {
        const res = citaSchema.safeParse({
          id: 1,
          fecha: '2026-10-16',
          horaInicio: '10:00',
          estado: 'Pendiente',
          confirmation_status: status
        })
        expect(res.success).toBe(true)
      })

      const resInvalido = citaSchema.safeParse({
        id: 1,
        fecha: '2026-10-16',
        horaInicio: '10:00',
        estado: 'Pendiente',
        confirmation_status: 'invalido_status'
      })
      expect(resInvalido.success).toBe(false)
    })

    it('acepta los tramos de duracion oficiales [15, 30, 45, 60, 90, 120]', () => {
      const tramos = [15, 30, 45, 60, 90, 120]
      tramos.forEach((duracion) => {
        const res = citaSchema.safeParse({
          id: 1,
          fecha: '2026-10-16',
          horaInicio: '10:00',
          estado: 'Pendiente',
          duracionMinutos: duracion
        })
        expect(res.success).toBe(true)
      })
    })
  })
})