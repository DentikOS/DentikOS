/**
 * Tests completos de sincronización no destructiva y soft-delete para agendaStorageService (P0-1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agendaStorageService } from './agendaStorageService'
import { supabase } from '../../../../infrastructure/supabase/supabaseClient'

// Mock de Supabase Client
vi.mock('../../../../infrastructure/supabase/supabaseClient', () => {
  return {
    USE_SUPABASE: true,
    supabase: {
      auth: {
        getUser: vi.fn()
      },
      from: vi.fn()
    }
  }
})

describe('P0-1: Sincronización multi-usuario no destructiva y Soft-Delete en agendaStorageService', () => {
  const ID_CITA_USUARIO_A = '11111111-1111-4111-8111-111111111111'
  const ID_CITA_USUARIO_B = '22222222-2222-4222-8222-222222222222'

  const citaB = {
    id: ID_CITA_USUARIO_B,
    pacienteId: '33333333-3333-4333-8333-333333333333',
    pacienteNombre: 'Paciente de Doctor B',
    fecha: '2026-10-15',
    horaInicio: '10:00',
    horaFin: '11:00',
    estado: 'Agendado',
    motivo: 'Control'
  }

  let deleteMock
  let inMock
  let updateMock
  let eqMock
  let isMock
  let upsertMock
  let selectMock
  let orderMock

  beforeEach(() => {
    vi.clearAllMocks()
    agendaStorageService.resetCache()

    // Mock usuario autenticado
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-b-uuid', email: 'doctor_b@example.com' } }
    })
    localStorage.setItem('clinica_active_user', 'doctor_b@example.com')
    localStorage.setItem('profile_doctor_b@example.com', JSON.stringify({ clinicaId: 'clinica-multiuser-test' }))

    // Chain mocks para from('citas')
    inMock = vi.fn().mockResolvedValue({ error: null })
    deleteMock = vi.fn().mockReturnValue({ in: inMock })

    isMock = vi.fn().mockResolvedValue({ error: null, data: null })
    eqMock = vi.fn().mockReturnValue({ is: isMock })
    updateMock = vi.fn().mockReturnValue({ eq: eqMock })

    upsertMock = vi.fn().mockResolvedValue({ error: null })

    orderMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const isSelectMock = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ order: orderMock }) })

    selectMock = vi.fn().mockImplementation((campos) => {
      if (campos === '*') {
        return {
          is: isSelectMock,
          order: vi.fn().mockReturnValue({ order: orderMock })
        }
      }
      return {
        is: isSelectMock,
        order: vi.fn().mockReturnValue({ order: orderMock })
      }
    })

    supabase.from.mockImplementation((tabla) => {
      if (tabla === 'citas') {
        return {
          select: selectMock,
          upsert: upsertMock,
          delete: deleteMock,
          update: updateMock
        }
      }
      return {}
    })
  })

  it('NO debe eliminar la cita de Usuario A cuando Usuario B guarda su lista local', async () => {
    // Usuario B guarda su lista local (que contiene solo citaB, NO contiene la cita A)
    await agendaStorageService.guardarCitas([citaB])

    // VERIFICACIÓN CLAVE DE NO-REGRESIÓN:
    // La cita de Usuario A NUNCA debe haber sido enviada a borrar por in(idsAEliminar)
    expect(deleteMock).not.toHaveBeenCalled()
    expect(inMock).not.toHaveBeenCalled()

    // No debe actualizarse deleted_at para la cita A
    const idsActualizados = eqMock.mock.calls.map(call => call[1])
    expect(idsActualizados).not.toContain(ID_CITA_USUARIO_A)
  })

  it('eliminarCita ejecuta soft-delete remoto por intención explícita', async () => {
    // Inicializar con la cita B
    await agendaStorageService.guardarCitas([citaB])
    expect(agendaStorageService.obtenerCitas()).toHaveLength(1)

    // Eliminar explícitamente cita B
    const exito = await agendaStorageService.eliminarCita(ID_CITA_USUARIO_B)
    expect(exito).toBe(true)

    // Debe removerse de la memoria local
    expect(agendaStorageService.obtenerCitas()).toHaveLength(0)

    // Debe invocar update({ deleted_at: ... }) en Supabase con eq('id', ID_CITA_USUARIO_B)
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      deleted_at: expect.any(String)
    }))
    expect(eqMock).toHaveBeenCalledWith('id', ID_CITA_USUARIO_B)
    expect(isMock).toHaveBeenCalledWith('deleted_at', null)

    // La cola pendingDeletes debe quedar vacía al tener éxito remoto
    expect(agendaStorageService.obtenerPendingDeletes()).toEqual([])
  })

  it('si falla la red en eliminarCita, el ID queda en pendingDeletes y se reintenta en guardarCitas', async () => {
    // Forzar fallo de red en update
    isMock.mockResolvedValueOnce({ error: { message: 'Network error' } })

    await agendaStorageService.eliminarCita(ID_CITA_USUARIO_B)

    // Queda en cola pendingDeletes
    expect(agendaStorageService.obtenerPendingDeletes()).toContain(ID_CITA_USUARIO_B)

    // Al volver la red y llamar a guardarCitas, debe procesar la cola pendiente
    isMock.mockResolvedValueOnce({ error: null })
    await agendaStorageService.guardarCitas([])

    // Debe haberse aplicado el soft-delete pendiente
    expect(eqMock).toHaveBeenCalledWith('id', ID_CITA_USUARIO_B)
    expect(agendaStorageService.obtenerPendingDeletes()).toEqual([])
  })

  it('sincronizarDesdeSupabase filtra citas activas con .is("deleted_at", null)', async () => {
    await agendaStorageService.sincronizarDesdeSupabase()

    expect(selectMock).toHaveBeenCalledWith('*')
    // Verifica que el builder encadene .is('deleted_at', null)
    expect(selectMock.mock.results[0].value.is).toHaveBeenCalledWith('deleted_at', null)
  })
})
