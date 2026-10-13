import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAgendaStore } from '../../../../app/stores/useAgendaStore'
import { useProximaCita, useProximasCitasMap } from './useProximaCita'
import type { Cita } from '../../../operations/agenda/schemas/citaSchema'

describe('useProximaCita', () => {
  beforeEach(() => {
    useAgendaStore.getState().setCitas([])
  })

  it('retorna null si el paciente no tiene citas futuras', () => {
    const { result } = renderHook(() => useProximaCita('p1'))
    expect(result.current).toBeNull()
  })

  it('retorna la cita futura más próxima para el paciente', () => {
    const manana = new Date()
    manana.setDate(manana.getDate() + 1)
    const fechaManana = manana.toISOString().split('T')[0]

    const enDosDias = new Date()
    enDosDias.setDate(enDosDias.getDate() + 2)
    const fechaDosDias = enDosDias.toISOString().split('T')[0]

    const citaLejana: Cita = {
      id: 'c2',
      fecha: fechaDosDias,
      horaInicio: '10:00',
      estado: 'Agendado',
      pacienteId: 'p1',
    }

    const citaCercana: Cita = {
      id: 'c1',
      fecha: fechaManana,
      horaInicio: '09:00',
      estado: 'Agendado',
      pacienteId: 'p1',
    }

    useAgendaStore.getState().setCitas([citaLejana, citaCercana])

    const { result } = renderHook(() => useProximaCita('p1'))
    expect(result.current?.id).toBe('c1')
  })

  it('ignora citas canceladas o anuladas', () => {
    const manana = new Date()
    manana.setDate(manana.getDate() + 1)
    const fechaManana = manana.toISOString().split('T')[0]

    const enDosDias = new Date()
    enDosDias.setDate(enDosDias.getDate() + 2)
    const fechaDosDias = enDosDias.toISOString().split('T')[0]

    const citaCancelada: Cita = {
      id: 'c1',
      fecha: fechaManana,
      horaInicio: '09:00',
      estado: 'Cancelada',
      pacienteId: 'p1',
    }

    const citaValida: Cita = {
      id: 'c2',
      fecha: fechaDosDias,
      horaInicio: '11:00',
      estado: 'Agendado',
      pacienteId: 'p1',
    }

    useAgendaStore.getState().setCitas([citaCancelada, citaValida])

    const { result } = renderHook(() => useProximaCita('p1'))
    expect(result.current?.id).toBe('c2')
  })

  it('useProximasCitasMap mapea correctamente múltiples pacientes', () => {
    const manana = new Date()
    manana.setDate(manana.getDate() + 1)
    const fechaManana = manana.toISOString().split('T')[0]

    useAgendaStore.getState().setCitas([
      { id: 'c1', fecha: fechaManana, horaInicio: '09:00', estado: 'Agendado', pacienteId: '10' },
      { id: 'c2', fecha: fechaManana, horaInicio: '10:00', estado: 'Agendado', pacienteId: '20' },
    ])

    const { result } = renderHook(() => useProximasCitasMap())
    expect(result.current.get('10')?.id).toBe('c1')
    expect(result.current.get('20')?.id).toBe('c2')
  })
})
