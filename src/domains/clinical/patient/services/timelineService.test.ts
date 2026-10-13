import { describe, it, expect, beforeEach } from 'vitest'
import { timelineService, type EventoTimeline } from './timelineService'

describe('timelineService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('agrega evento de cambio_estado y lo recupera en obtenerTimeline', async () => {
    const evento: EventoTimeline = {
      tipo: 'cambio_estado',
      fecha: new Date().toISOString(),
      titulo: 'Estado cambiado de activo a inactivo',
      detalles: 'Motivo: Inactividad prolongada',
      usuario: 'Dra. Administradora',
    }

    await timelineService.agregarEvento('p-test-1', evento)

    const eventos = timelineService.obtenerTimeline('p-test-1')
    expect(eventos.length).toBeGreaterThan(0)
    const encontrado = eventos.find((e) => e.titulo === 'Estado cambiado de activo a inactivo')
    expect(encontrado).toBeDefined()
    expect(encontrado?.tipo).toBe('cambio_estado')
    expect(encontrado?.detalles).toBe('Motivo: Inactividad prolongada')
  })

  it('persiste el evento en localStorage bajo timeline_{pacienteId}', async () => {
    const evento: EventoTimeline = {
      tipo: 'cambio_estado',
      fecha: new Date().toISOString(),
      titulo: 'Paciente bloqueado por Admin',
      detalles: 'Motivo: No show recurrente',
      usuario: 'Admin',
    }

    await timelineService.agregarEvento('p-test-2', evento)

    const raw = localStorage.getItem('timeline_p-test-2')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed[0].titulo).toBe('Paciente bloqueado por Admin')
  })
})
