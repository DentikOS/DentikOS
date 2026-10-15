import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgenda } from './useAgenda'
import { agendaStorageService } from '../services/agendaStorageService'
import { pacientesStorageService } from '../../../../domains/clinical/patient/services/pacientesStorageService'
import { usePacientesStore } from '../../../../app/stores/pacientesStore'
import { useDialogStore } from '../../../../app/stores/dialogStore'
import type { Cita } from '../schemas/citaSchema'

describe('useAgenda - Prevención de duplicados (FIX-5)', () => {
  beforeEach(() => {
    usePacientesStore.setState({ pacientes: [] })
    pacientesStorageService.resetCache()
    agendaStorageService.resetCache()
    agendaStorageService.guardarCitas([])
    vi.restoreAllMocks()
    useDialogStore.setState({ dialog: null })
  })
  it('NO duplica cita al guardar dos veces la misma cita', () => {
    const { result } = renderHook(() => useAgenda([]))

    const cita = {
      id: 'test-1',
      fecha: '2026-10-15',
      horaInicio: '10:00',
      estado: 'Pendiente',
      pacienteNombre: 'Test'
    } as unknown as Cita

    // Guardar dos veces la misma cita
    act(() => {
      result.current.guardarCita(cita)
    })
    
    act(() => {
      result.current.guardarCita(cita)
    })

    // Debe haber solo 1 cita, no 2
    expect(result.current.citas.filter(c => String(c.id) === 'test-1')).toHaveLength(1)
  })

  it('actualiza cita existente en lugar de duplicar', () => {
    const { result } = renderHook(() => useAgenda([]))

    const citaOriginal = {
      id: 'test-2',
      fecha: '2026-10-15',
      horaInicio: '10:00',
      estado: 'Pendiente',
      pacienteNombre: 'Original'
    } as unknown as Cita

    const citaActualizada = {
      ...citaOriginal,
      estado: 'Confirmada',
      pacienteNombre: 'Actualizado'
    } as unknown as Cita

    act(() => {
      result.current.guardarCita(citaOriginal)
    })
    
    act(() => {
      result.current.guardarCita(citaActualizada)
    })

    const citasId2 = result.current.citas.filter(c => String(c.id) === 'test-2')
    expect(citasId2).toHaveLength(1)
    expect(citasId2[0].estado).toBe('Confirmada')
    expect(citasId2[0].pacienteNombre).toBe('Actualizado')
  })
})
