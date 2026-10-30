import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = vi.hoisted(() => ({ agregarEvento: vi.fn(), cargarTimeline: vi.fn() }))
vi.mock('../../../services/timelineService', () => ({ timelineService: estado }))

import { derivacionesService } from './derivacionesService'

describe('derivacionesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    estado.agregarEvento.mockResolvedValue(true)
    estado.cargarTimeline.mockResolvedValue([])
  })

  it('persiste la derivación con motivo y prioridad en el timeline del paciente', async () => {
    const derivacion = await derivacionesService.emitir('paciente-1', {
      especialidad: 'Endodoncia', especialista: 'Dra. R', motivo: 'Hallazgo revisado', prioridad: 'urgente',
    })
    expect(estado.agregarEvento).toHaveBeenCalledWith('paciente-1', expect.objectContaining({
      id: derivacion.id,
      tipo: 'derivacion',
      metadata: expect.objectContaining({ motivo: 'Hallazgo revisado', prioridad: 'urgente' }),
    }))
  })

  it('rechaza emisión sin persistencia confirmada', async () => {
    estado.agregarEvento.mockResolvedValue(false)
    await expect(derivacionesService.emitir('paciente-1', {
      especialidad: 'Endodoncia', especialista: '', motivo: 'Hallazgo', prioridad: 'normal',
    })).rejects.toThrow('No se pudo guardar')
  })

  it('recupera solo derivaciones válidas del historial', async () => {
    estado.cargarTimeline.mockResolvedValue([
      { id: 'd-1', tipo: 'derivacion', fecha: '2026-10-30T10:00:00Z', metadata: {
        especialidad: 'Endodoncia', especialista: '', motivo: 'Hallazgo', prioridad: 'normal',
      } },
      { id: 'x-1', tipo: 'pago', fecha: '2026-10-30T11:00:00Z', metadata: {} },
    ])
    expect(await derivacionesService.listar('paciente-1')).toEqual([expect.objectContaining({ id: 'd-1', motivo: 'Hallazgo' })])
  })
})
