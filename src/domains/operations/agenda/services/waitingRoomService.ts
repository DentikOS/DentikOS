import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { registrarCambioEstado } from '../utils/auditoriaCita'

const log = createLogger('waitingRoomService')

export type WaitingRoomEventType =
  | 'check_in'
  | 'llamar_siguiente'
  | 'paciente_avisado'
  | 'iniciar_atencion'
  | 'reasignacion'
  | 'no_show'
  | 'llegada_temprana'

export interface WaitingRoomEvent {
  id: string
  appointmentId: string | number
  clinicaId: string
  tipo: WaitingRoomEventType
  doctorId?: string
  doctorNombre?: string
  boxAsignado?: string
  minutosEspera?: number
  nota?: string
  metadata?: Record<string, unknown>
  registradoPorId?: string
  registradoPorNombre?: string
  rolUsuario?: string
  createdAt: string
}

export const calcularEstadoFlujo = (eventos: WaitingRoomEvent[]): {
  enEspera: boolean
  llamada: boolean
  avisado: boolean
  enAtencion: boolean
  noShow: boolean
  minutosEspera: number
  ultimoEvento?: WaitingRoomEvent
} => {
  if (!eventos || eventos.length === 0) {
    return {
      enEspera: false,
      llamada: false,
      avisado: false,
      enAtencion: false,
      noShow: false,
      minutosEspera: 0,
    }
  }

  const ordenados = [...eventos].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const ultimo = ordenados[0]
  const checkIn = ordenados.find((e) => e.tipo === 'check_in')

  let minutosEspera = 0
  if (checkIn) {
    const checkInTime = new Date(checkIn.createdAt).getTime()
    minutosEspera = Math.max(0, Math.floor((Date.now() - checkInTime) / 60000))
  }

  return {
    enEspera:
      ordenados.some((e) => e.tipo === 'check_in') &&
      !ordenados.some((e) => ['iniciar_atencion', 'no_show'].includes(e.tipo)),
    llamada: ordenados.some((e) => e.tipo === 'llamar_siguiente'),
    avisado: ordenados.some((e) => e.tipo === 'paciente_avisado'),
    enAtencion: ordenados.some((e) => e.tipo === 'iniciar_atencion'),
    noShow: ultimo.tipo === 'no_show',
    minutosEspera,
    ultimoEvento: ultimo,
  }
}

const LOCAL_STORAGE_KEY = 'studio_dental_waiting_room_events'

const guardarEventoLocal = (evento: WaitingRoomEvent) => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    const eventos: WaitingRoomEvent[] = raw ? JSON.parse(raw) : []
    eventos.unshift(evento)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(eventos.slice(0, 500)))
  } catch (err) {
    log.warn('No se pudo guardar evento en storage local', err)
  }
}

const obtenerEventosLocales = (appointmentId?: string | number): WaitingRoomEvent[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    const eventos: WaitingRoomEvent[] = JSON.parse(raw)
    if (!appointmentId) return eventos
    return eventos.filter((e) => String(e.appointmentId) === String(appointmentId))
  } catch {
    return []
  }
}

export const waitingRoomService = {
  registrarEvento: async (data: {
    appointmentId: string | number
    tipo: WaitingRoomEventType
    doctorId?: string
    doctorNombre?: string
    boxAsignado?: string
    minutosEspera?: number
    nota?: string
    metadata?: Record<string, unknown>
    estadoAnterior?: string
  }): Promise<WaitingRoomEvent | null> => {
    const sesion = useSesionStore.getState()
    const userProfile = sesion.userProfile
    const clinicaId =
      (userProfile as { clinicaId?: string })?.clinicaId || sesion.clinicaActual || 'clinica-default'
    const userId = (userProfile as { id?: string })?.id || 'local-user'
    const userName = (userProfile as { nombreCompleto?: string })?.nombreCompleto || 'Usuario local'
    const userRol = (userProfile as { rol?: string })?.rol || 'unknown'

    const evento: WaitingRoomEvent = {
      id: `wr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      appointmentId: data.appointmentId,
      clinicaId,
      tipo: data.tipo,
      doctorId: data.doctorId,
      doctorNombre: data.doctorNombre,
      boxAsignado: data.boxAsignado,
      minutosEspera: data.minutosEspera,
      nota: data.nota,
      metadata: data.metadata || {},
      registradoPorId: userId,
      registradoPorNombre: userName,
      rolUsuario: userRol,
      createdAt: new Date().toISOString(),
    }

    guardarEventoLocal(evento)

    if (USE_SUPABASE && supabase) {
      try {
        const { error } = await supabase.from('waiting_room_events').insert({
          appointment_id: data.appointmentId,
          clinica_id: clinicaId,
          tipo: data.tipo,
          doctor_id: data.doctorId,
          doctor_nombre: data.doctorNombre,
          box_asignado: data.boxAsignado,
          minutos_espera: data.minutosEspera,
          nota: data.nota,
          metadata: data.metadata || {},
          registrado_por: userId.length === 36 ? userId : null,
          registrado_por_nombre: userName,
          rol_usuario: userRol,
        })

        if (error) {
          log.warn('Error guardando evento sala de espera en Supabase:', error.message)
        }
      } catch (e) {
        log.warn('Error inesperado guardando en Supabase:', e)
      }
    }

    const motivoMap: Record<WaitingRoomEventType, string> = {
      check_in: 'Paciente llego a recepcion (check-in)',
      llamar_siguiente: 'Doctor solicito siguiente paciente',
      paciente_avisado: 'Recepcionista confirmo aviso al paciente',
      iniciar_atencion: 'Atencion iniciada',
      reasignacion: `Reasignacion${data.nota ? `: ${data.nota}` : ''}`,
      no_show: `No-show${data.nota ? `: ${data.nota}` : ''}`,
      llegada_temprana: 'Paciente llego antes de su hora',
    }

    const nuevoEstado =
      data.tipo === 'iniciar_atencion'
        ? 'En atencion'
        : data.tipo === 'no_show'
        ? 'No-show'
        : data.tipo === 'check_in'
        ? 'En sala de espera'
        : 'En sala de espera'

    try {
      await registrarCambioEstado(
        data.appointmentId,
        data.estadoAnterior || 'Pendiente',
        nuevoEstado,
        userId,
        motivoMap[data.tipo]
      )
    } catch (e) {
      log.warn('No se pudo registrar cambio en auditoriaCita:', e)
    }

    return evento
  },

  obtenerHistorialCita: async (appointmentId: string | number): Promise<WaitingRoomEvent[]> => {
    if (USE_SUPABASE && supabase) {
      try {
        const { data, error } = await supabase
          .from('waiting_room_events')
          .select('*')
          .eq('appointment_id', appointmentId)
          .order('created_at', { ascending: false })

        if (!error && data && data.length > 0) {
          return data.map((row: any) => ({
            id: row.id,
            appointmentId: row.appointment_id,
            clinicaId: row.clinica_id,
            tipo: row.tipo,
            doctorId: row.doctor_id,
            doctorNombre: row.doctor_nombre,
            boxAsignado: row.box_asignado,
            minutosEspera: row.minutos_espera,
            nota: row.nota,
            metadata: row.metadata || {},
            registradoPorId: row.registrado_por,
            registradoPorNombre: row.registrado_por_nombre,
            rolUsuario: row.rol_usuario,
            createdAt: row.created_at,
          }))
        }
      } catch (e) {
        log.warn('Error obteniendo historial de Supabase, usando local:', e)
      }
    }

    return obtenerEventosLocales(appointmentId)
  },

  obtenerSalaEsperaActual: async (): Promise<WaitingRoomEvent[]> => {
    const sesion = useSesionStore.getState()
    const userProfile = sesion.userProfile
    const clinicaId =
      (userProfile as { clinicaId?: string })?.clinicaId || sesion.clinicaActual

    if (USE_SUPABASE && supabase && clinicaId) {
      try {
        const hoy = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
          .from('waiting_room_events')
          .select('*')
          .eq('clinica_id', clinicaId)
          .gte('created_at', `${hoy}T00:00:00`)
          .order('created_at', { ascending: false })

        if (!error && data && data.length > 0) {
          return data.map((row: any) => ({
            id: row.id,
            appointmentId: row.appointment_id,
            clinicaId: row.clinica_id,
            tipo: row.tipo,
            doctorId: row.doctor_id,
            doctorNombre: row.doctor_nombre,
            boxAsignado: row.box_asignado,
            minutosEspera: row.minutos_espera,
            nota: row.nota,
            metadata: row.metadata || {},
            registradoPorId: row.registrado_por,
            registradoPorNombre: row.registrado_por_nombre,
            rolUsuario: row.rol_usuario,
            createdAt: row.created_at,
          }))
        }
      } catch (e) {
        log.warn('Error obteniendo sala de espera de Supabase, usando local:', e)
      }
    }

    return obtenerEventosLocales()
  },

  obtenerEsperasCriticas: async (): Promise<WaitingRoomEvent[]> => {
    const eventos = await waitingRoomService.obtenerSalaEsperaActual()
    const agrupadosPorCita = new Map<string | number, WaitingRoomEvent[]>()

    eventos.forEach((e) => {
      const existentes = agrupadosPorCita.get(e.appointmentId) || []
      existentes.push(e)
      agrupadosPorCita.set(e.appointmentId, existentes)
    })

    const criticas: WaitingRoomEvent[] = []
    agrupadosPorCita.forEach((eventosCita) => {
      const estado = calcularEstadoFlujo(eventosCita)
      if (estado.enEspera && estado.minutosEspera > 30) {
        criticas.push(eventosCita[0])
      }
    })

    return criticas
  },
}
