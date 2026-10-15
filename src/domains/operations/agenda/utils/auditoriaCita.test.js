import { describe, it, expect, beforeEach } from 'vitest'
import { registrarCambioEstado } from './auditoriaCita'

describe('auditoriaCita (BP05 §03)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('registra cambios de estado en localStorage bajo la clave de historial de la cita', async () => {
    const entrada = await registrarCambioEstado('cita-100', 'Pendiente', 'Confirmada', 'user-1', 'Confirmado por WhatsApp')

    expect(entrada.citaId).toBe('cita-100')
    expect(entrada.estadoAnterior).toBe('Pendiente')
    expect(entrada.estadoNuevo).toBe('Confirmada')
    expect(entrada.motivo).toBe('Confirmado por WhatsApp')

    const almacenado = JSON.parse(localStorage.getItem('cita_cita-100_historial') || '[]')
    expect(almacenado).toHaveLength(1)
    expect(almacenado[0].estadoNuevo).toBe('Confirmada')
  })

  it('incluye clinicaId cuando existe en el store de sesión', async () => {
    const entrada = await registrarCambioEstado('cita-101', 'Confirmada', 'EnEspera', 'user-2')
    expect(entrada.citaId).toBe('cita-101')
    expect(entrada.timestamp).toBeDefined()
  })
})
