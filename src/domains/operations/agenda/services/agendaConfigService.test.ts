import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agendaConfigService } from './agendaConfigService'
import { supabase } from '../../../../infrastructure/supabase/supabaseClient'
import { useSesionStore } from '../../../../app/stores/sesionStore'

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => {
  const fromMock = vi.fn()
  return {
    USE_SUPABASE: true,
    supabase: {
      from: fromMock,
    },
  }
})

vi.mock('../../../../app/stores/sesionStore', () => ({
  useSesionStore: {
    getState: vi.fn(),
  },
}))

describe('agendaConfigService', () => {
  const mockClinicaId = 'clinica-test-uuid'
  const mockUserId = 'user-test-uuid'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSesionStore.getState).mockReturnValue({
      userProfile: { clinicaId: mockClinicaId },
    } as any)
  })

  describe('obtenerDoctoresAgenda', () => {
    it('retorna array vacío si no hay clinicaId en la sesión', async () => {
      vi.mocked(useSesionStore.getState).mockReturnValue({
        userProfile: {},
      } as any)

      const result = await agendaConfigService.obtenerDoctoresAgenda()
      expect(result).toEqual([])
    })

    it('retorna array vacío si miembros_clinica no tiene resultados', async () => {
      const selectMiembros = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      })

      vi.mocked(supabase!.from).mockImplementation((table: string) => {
        if (table === 'miembros_clinica') return { select: selectMiembros } as any
        return { select: vi.fn() } as any
      })

      const result = await agendaConfigService.obtenerDoctoresAgenda()
      expect(result).toEqual([])
    })

    it('combina correctamente miembros_clinica con profiles, config y horarios', async () => {
      const mockMiembros = [{ user_id: mockUserId, rol: 'dentista' }]
      const mockProfiles = [{
        id: mockUserId,
        full_name: 'Dra. Ana López',
        email: 'ana@dentikos.cl',
        especialidad: 'Ortodoncia',
        telefono: '+56912345678',
      }]
      const mockConfig = [{
        user_id: mockUserId,
        color_identidad: '#0D9488',
        permite_sobrecupos: true,
        max_sobrecupos: 3,
      }]
      const mockHorarios = [{
        user_id: mockUserId,
        dia_semana: 1,
        hora_inicio: '09:00:00',
        hora_fin: '18:00:00',
        duracion_bloque_minutos: 30,
      }]

      vi.mocked(supabase!.from).mockImplementation((table: string) => {
        if (table === 'miembros_clinica') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: mockMiembros, error: null }),
                }),
              }),
            }),
          } as any
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
            }),
          } as any
        }
        if (table === 'user_agenda_config') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: mockConfig, error: null }),
              }),
            }),
          } as any
        }
        if (table === 'user_sede_horarios') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: mockHorarios, error: null }),
              }),
            }),
          } as any
        }
        return {} as any
      })

      const result = await agendaConfigService.obtenerDoctoresAgenda()

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        userId: mockUserId,
        nombreCompleto: 'Dra. Ana López',
        especialidad: 'Ortodoncia',
        email: 'ana@dentikos.cl',
        telefono: '+56912345678',
        rol: 'dentista',
        colorIdentidad: '#0D9488',
        permiteSobrecupos: true,
        maxSobrecupos: 3,
        horarios: [{
          diaSemana: 1,
          horaInicio: '09:00',
          horaFin: '18:00',
          duracionBloqueMinutos: 30,
        }],
      })
    })
  })

  describe('actualizarConfigAgenda', () => {
    it('ejecuta upsert en user_agenda_config con los datos del usuario', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null })
      vi.mocked(supabase!.from).mockReturnValue({
        upsert: upsertMock,
      } as any)

      await agendaConfigService.actualizarConfigAgenda(mockUserId, {
        permiteSobrecupos: false,
        maxSobrecupos: 1,
        colorIdentidad: '#B88E3A',
      })

      expect(upsertMock).toHaveBeenCalledWith(
        {
          user_id: mockUserId,
          clinica_id: mockClinicaId,
          permite_sobrecupos: false,
          max_sobrecupos: 1,
          color_identidad: '#B88E3A',
        },
        { onConflict: 'user_id,clinica_id' }
      )
    })
  })

  describe('actualizarHorariosUsuario', () => {
    it('elimina horarios previos e inserta nuevos registros', async () => {
      const deleteMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })
      const insertMock = vi.fn().mockResolvedValue({ error: null })

      vi.mocked(supabase!.from).mockImplementation((table: string) => {
        if (table === 'user_sede_horarios') {
          return {
            delete: deleteMock,
            insert: insertMock,
          } as any
        }
        return {} as any
      })

      await agendaConfigService.actualizarHorariosUsuario(mockUserId, 'sede-1', [
        { diaSemana: 1, horaInicio: '08:00', horaFin: '14:00', duracionBloqueMinutos: 30 },
      ])

      expect(deleteMock).toHaveBeenCalled()
      expect(insertMock).toHaveBeenCalledWith([
        {
          user_id: mockUserId,
          clinica_id: mockClinicaId,
          sede_id: 'sede-1',
          dia_semana: 1,
          hora_inicio: '08:00',
          hora_fin: '14:00',
          duracion_bloque_minutos: 30,
        },
      ])
    })
  })
})
