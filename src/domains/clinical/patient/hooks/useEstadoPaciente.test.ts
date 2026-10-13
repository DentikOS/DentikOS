import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEstadoPaciente } from './useEstadoPaciente'
import { usePacientesStore } from '../../../../app/stores/pacientesStore'
import type { Paciente } from '../schemas/pacienteSchema'

describe('useEstadoPaciente (solo lectura)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePacientesStore.setState({
      pacientes: [
        { id: 'p-1', nombre: 'Juan', rut: '11.111.111-1', estado: 'activo' } as Paciente,
        { id: 'p-2', nombre: 'Pedro', rut: '22.222.222-2', estado: 'bloqueado' } as Paciente,
      ],
    })
  })

  it('retorna null si el paciente es null', () => {
    const { result } = renderHook(() => useEstadoPaciente(null))
    expect(result.current).toBeNull()
  })

  it('no sobreescribe el estado en el store bajo ninguna circunstancia', () => {
    const paciente = { id: 'p-1', nombre: 'Juan', rut: '11.111.111-1', estado: 'activo' } as Paciente
    renderHook(() => useEstadoPaciente(paciente))
    const enStore = usePacientesStore.getState().pacientes.find((p) => p.id === 'p-1')
    expect(enStore?.estado).toBe('activo')
  })

  it('calcula "inactivo" si la última visita fue hace más de 12 meses sin alterar el store', () => {
    const hace400Dias = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
    const paciente = {
      id: 'p-1',
      nombre: 'Juan',
      rut: '11.111.111-1',
      estado: 'activo',
      fechaUltimaVisita: hace400Dias,
    } as Paciente

    const { result } = renderHook(() => useEstadoPaciente(paciente))
    expect(result.current).toBe('inactivo')

    // El store permanece intacto con el estado manual
    const enStore = usePacientesStore.getState().pacientes.find((p) => p.id === 'p-1')
    expect(enStore?.estado).toBe('activo')
  })

  it('calcula "nuevo" si no tiene fecha de última visita sin alterar el store', () => {
    const paciente = {
      id: 'p-1',
      nombre: 'Juan',
      rut: '11.111.111-1',
      estado: 'activo',
    } as Paciente

    const { result } = renderHook(() => useEstadoPaciente(paciente))
    expect(result.current).toBe('nuevo')

    const enStore = usePacientesStore.getState().pacientes.find((p) => p.id === 'p-1')
    expect(enStore?.estado).toBe('activo')
  })
})
