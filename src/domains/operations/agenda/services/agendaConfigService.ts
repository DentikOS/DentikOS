import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { COLORES_DOCTOR } from '../constants/doctorConstants'

export interface DoctorAgenda {
  userId: string
  nombreCompleto: string
  especialidad?: string
  email?: string
  telefono?: string
  rol: string
  colorIdentidad: string
  permiteSobrecupos: boolean
  maxSobrecupos: number
  horarios?: {
    diaSemana: number
    horaInicio: string
    horaFin: string
    duracionBloqueMinutos: number
  }[]
}

export const agendaConfigService = {
  /**
   * Obtiene doctores reales desde miembros_clinica + perfiles + user_agenda_config
   * Solo usuarios con rol dentista o admin de la clínica activa
   */
  obtenerDoctoresAgenda: async (): Promise<DoctorAgenda[]> => {
    if (!USE_SUPABASE || !supabase) {
      console.warn('Supabase no disponible, retornando array vacío')
      return []
    }

    try {
      const userProfile = useSesionStore.getState().userProfile
      const clinicaId = (userProfile as { clinicaId?: string })?.clinicaId

      if (!clinicaId) {
        console.warn('Sin clinicaId, retornando array vacío')
        return []
      }

      // 1. Obtener miembros con rol dentista o admin
      const { data: miembros, error: errMiembros } = await supabase
        .from('miembros_clinica')
        .select('user_id, rol')
        .eq('clinica_id', clinicaId)
        .eq('activo', true)
        .in('rol', ['dentista', 'admin'])

      if (errMiembros || !miembros || miembros.length === 0) {
        if (errMiembros) console.error('Error obteniendo miembros_clinica:', errMiembros)
        return []
      }

      const userIds = miembros.map((m: { user_id: string }) => m.user_id)

      // 2. Obtener en paralelo: perfiles, user_agenda_config y user_sede_horarios
      const [perfilesRes, configRes, horariosRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, especialidad, telefono')
          .in('id', userIds),
        supabase
          .from('user_agenda_config')
          .select('user_id, color_identidad, permite_sobrecupos, max_sobrecupos')
          .eq('clinica_id', clinicaId)
          .in('user_id', userIds),
        supabase
          .from('user_sede_horarios')
          .select('user_id, dia_semana, hora_inicio, hora_fin, duracion_bloque_minutos')
          .eq('clinica_id', clinicaId)
          .in('user_id', userIds),
      ])

      const perfilMap = new Map((perfilesRes.data || []).map((p: any) => [p.id, p]))
      const configMap = new Map((configRes.data || []).map((c: any) => [c.user_id, c]))
      
      const horariosMap = new Map<string, any[]>()
      ;(horariosRes.data || []).forEach((h: any) => {
        if (!horariosMap.has(h.user_id)) horariosMap.set(h.user_id, [])
        horariosMap.get(h.user_id)!.push({
          diaSemana: h.dia_semana,
          horaInicio: typeof h.hora_inicio === 'string' ? h.hora_inicio.slice(0, 5) : '09:00',
          horaFin: typeof h.hora_fin === 'string' ? h.hora_fin.slice(0, 5) : '18:00',
          duracionBloqueMinutos: h.duracion_bloque_minutos || 30,
        })
      })

      return miembros.map((m: { user_id: string; rol: string }, idx: number) => {
        const perfil = perfilMap.get(m.user_id)
        const config = configMap.get(m.user_id)
        const defaultColor = m.rol === 'admin' ? COLORES_DOCTOR[0] : COLORES_DOCTOR[(idx + 1) % COLORES_DOCTOR.length]

        const nombre = perfil?.full_name?.trim() || (m.rol === 'admin' ? 'Dr. Administrador' : 'Dr. Dentista')

        return {
          userId: m.user_id,
          nombreCompleto: nombre,
          especialidad: perfil?.especialidad || (m.rol === 'admin' ? 'Dirección Clínica' : 'Odontología'),
          email: perfil?.email || '',
          telefono: perfil?.telefono || '',
          rol: m.rol,
          colorIdentidad: config?.color_identidad || defaultColor,
          permiteSobrecupos: config?.permite_sobrecupos ?? true,
          maxSobrecupos: config?.max_sobrecupos ?? 2,
          horarios: horariosMap.get(m.user_id) || [],
        }
      })
    } catch (error) {
      console.error('Error inesperado obteniendo doctores de agenda:', error)
      return []
    }
  },

  /**
   * Actualiza configuración de agenda de un usuario en Supabase
   */
  actualizarConfigAgenda: async (
    userId: string,
    config: {
      permiteSobrecupos?: boolean
      maxSobrecupos?: number
      colorIdentidad?: string
    }
  ): Promise<void> => {
    if (!USE_SUPABASE || !supabase) return

    try {
      const userProfile = useSesionStore.getState().userProfile
      const clinicaId = (userProfile as { clinicaId?: string })?.clinicaId
      if (!clinicaId) return

      const { error } = await supabase
        .from('user_agenda_config')
        .upsert({
          user_id: userId,
          clinica_id: clinicaId,
          permite_sobrecupos: config.permiteSobrecupos,
          max_sobrecupos: config.maxSobrecupos,
          color_identidad: config.colorIdentidad,
        }, { onConflict: 'user_id,clinica_id' })

      if (error) console.error('Error actualizando config agenda:', error)
    } catch (error) {
      console.error('Error inesperado actualizando config agenda:', error)
    }
  },

  /**
   * Actualiza horarios de un usuario por sede en Supabase
   */
  actualizarHorariosUsuario: async (
    userId: string,
    sedeId: string,
    horarios: {
      diaSemana: number
      horaInicio: string
      horaFin: string
      duracionBloqueMinutos: number
    }[]
  ): Promise<void> => {
    if (!USE_SUPABASE || !supabase) return

    try {
      const userProfile = useSesionStore.getState().userProfile
      const clinicaId = (userProfile as { clinicaId?: string })?.clinicaId
      if (!clinicaId) return

      // Eliminar horarios anteriores para esta sede
      await supabase
        .from('user_sede_horarios')
        .delete()
        .eq('user_id', userId)
        .eq('sede_id', sedeId)

      if (horarios.length > 0) {
        const horariosInsert = horarios.map((h) => ({
          user_id: userId,
          clinica_id: clinicaId,
          sede_id: sedeId,
          dia_semana: h.diaSemana,
          hora_inicio: h.horaInicio,
          hora_fin: h.horaFin,
          duracion_bloque_minutos: h.duracionBloqueMinutos || 30,
        }))

        const { error } = await supabase
          .from('user_sede_horarios')
          .insert(horariosInsert)

        if (error) console.error('Error insertando horarios:', error)
      }
    } catch (error) {
      console.error('Error inesperado actualizando horarios:', error)
    }
  },
}
