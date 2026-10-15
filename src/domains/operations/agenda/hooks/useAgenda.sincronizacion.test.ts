import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgenda } from './useAgenda'
import { useAgendaStore } from '../../../../app/stores/useAgendaStore'
import { agendaStorageService } from '../services/agendaStorageService'
import { usePacientesStore } from '../../../../app/stores/pacientesStore'
import type { Cita } from '../schemas/citaSchema'

describe('useAgenda - Sincronización reactiva con useAgendaStore (FIX-8)', () => {
  beforeEach(() => {
    usePacientesStore.setState({ pacientes: [] })
    useAgendaStore.setState({ citas: [] })
    agendaStorageService.resetCache()
    agendaStorageService.guardarCitas([])
    vi.restoreAllMocks()
  })

  it('guardarCita actualiza useAgendaStore inmediatamente (sin recargar)', async () => {
    const { result } = renderHook(() => useAgenda([]))

    const nuevaCita = {
      id: 'cita-sincro-1',
      fecha: '2026-10-15',
      horaInicio: '10:00',
      estado: 'Pendiente',
      pacienteNombre: 'Paciente Sincro',
    } as unknown as Cita

    await act(async () => {
      result.current.guardarCita(nuevaCita)
    })

    // Estado local actualizado
    expect(result.current.citas).toHaveLength(1)
    expect(result.current.citas[0].id).toBe('cita-sincro-1')

    // useAgendaStore global actualizado inmediatamente
    const citasEnStore = useAgendaStore.getState().citas
    expect(citasEnStore).toHaveLength(1)
    expect(citasEnStore[0].id).toBe('cita-sincro-1')
    expect(citasEnStore[0].pacienteNombre).toBe('Paciente Sincro')
  })

  it('eliminarCita actualiza useAgendaStore inmediatamente', async () => {
    const { result } = renderHook(() => useAgenda([]))

    const cita = {
      id: 'cita-sincro-2',
      fecha: '2026-10-15',
      horaInicio: '11:00',
      estado: 'Pendiente',
      pacienteNombre: 'Paciente Eliminar',
    } as unknown as Cita

    await act(async () => {
      result.current.guardarCita(cita)
    })
    expect(useAgendaStore.getState().citas).toHaveLength(1)

    await act(async () => {
      result.current.eliminarCita('cita-sincro-2')
    })

    expect(result.current.citas).toHaveLength(0)
    expect(useAgendaStore.getState().citas).toHaveLength(0)
  })

  it('cambiarEstadoCita actualiza useAgendaStore inmediatamente', async () => {
    const { result } = renderHook(() => useAgenda([]))

    const cita = {
      id: 'cita-sincro-3',
      fecha: '2026-10-15',
      horaInicio: '12:00',
      estado: 'Pendiente',
      pacienteNombre: 'Paciente Estado',
    } as unknown as Cita

    await act(async () => {
      result.current.guardarCita(cita)
    })

    await act(async () => {
      result.current.cambiarEstadoCita('cita-sincro-3', 'Confirmada')
    })

    expect(result.current.citas[0].estado).toBe('Confirmada')
    expect(useAgendaStore.getState().citas[0].estado).toBe('Confirmada')
  })
})
