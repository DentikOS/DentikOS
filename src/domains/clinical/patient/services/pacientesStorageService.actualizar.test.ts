import { describe, it, expect, beforeEach, vi } from 'vitest'
import { actualizarPaciente, pacientesStorageService } from './pacientesStorageService'
import type { Paciente } from '../schemas/pacienteSchema'

describe('actualizarPaciente (pacientesStorageService)', () => {
  beforeEach(() => {
    pacientesStorageService.resetCache()
  })

  it('retorna false si el paciente no existe', async () => {
    vi.spyOn(pacientesStorageService, 'obtenerPacientes').mockReturnValue([])
    const resultado = await actualizarPaciente('pac-inexistente', { estado: 'inactivo' })
    expect(resultado).toBe(false)
  })

  it('actualiza campos parciales de un paciente existente', async () => {
    const pacienteMock: Paciente = {
      id: 'pac-123',
      nombre: 'Juan Pérez',
      rut: '12.345.678-5',
      estado: 'activo',
    } as Paciente

    await pacientesStorageService.guardarPacientes([pacienteMock])

    const resultado = await pacientesStorageService.actualizarPaciente('pac-123', {
      estado: 'bloqueado',
      motivoBloqueo: 'Inasistencia',
    })

    expect(resultado).toBe(true)
    const listado = pacientesStorageService.obtenerPacientes()
    const actualizado = listado.find((p) => p.id === 'pac-123')
    expect(actualizado?.estado).toBe('bloqueado')
    expect(actualizado?.motivoBloqueo).toBe('Inasistencia')
  })
})
