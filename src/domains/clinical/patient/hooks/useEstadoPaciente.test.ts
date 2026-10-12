import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEstadoPaciente } from './useEstadoPaciente'
import { usePacientesStore } from '../../../../app/stores/pacientesStore'
import { pacientesStorageService } from '../services/pacientesStorageService'
import type { Paciente } from '../schemas/pacienteSchema'

describe('useEstadoPaciente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePacientesStore.setState({
      pacientes: [
        { id: 'p-1', nombre: 'Juan', rut: '11.111.111-1', estado: 'activo' } as Paciente,
        { id: 'p-2', nombre: 'Pedro', rut: '22.222.222-2', estado: 'bloqueado' } as Paciente,
      ],
    })
  })

  it('no sobreescribe estados administrativos como "bloqueado"', () => {
    const paciente = { id: 'p-2', nombre: 'Pedro', rut: '22.222.222-2', estado: 'bloqueado' } as Paciente
    renderHook(() => useEstadoPaciente(paciente))
    const enStore = usePacientesStore.getState().pacientes.find((p) => p.id === 'p-2')
    expect(enStore?.estado).toBe('bloqueado')
  })

  it('actualiza automáticamente a "inactivo" si no tiene visitas en 12+ meses', () => {
    const hace400Dias = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
    const paciente = {
      id: 'p-1',
      nombre: 'Juan',
      rut: '11.111.111-1',
      estado: 'activo',
      fechaUltimaVisita: hace400Dias,
    } as Paciente

    const spyActualizar = vi.spyOn(pacientesStorageService, 'actualizarPaciente').mockResolvedValue(true)

    renderHook(() => useEstadoPaciente(paciente))

    const enStore = usePacientesStore.getState().pacientes.find((p) => p.id === 'p-1')
    expect(enStore?.estado).toBe('inactivo')
    expect(spyActualizar).toHaveBeenCalledWith('p-1', { estado: 'inactivo' })
  })
})
