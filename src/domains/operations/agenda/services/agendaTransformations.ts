/**
 * Funciones de transformación y mapeo de datos de agenda (citas)
 * Extraído de agendaStorageService.js para respetar límite arquitectónico
 */
import { migrationStorageService } from '../../../../infrastructure/persistence/migrationStorageService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { normalizarEstado } from '../utils/normalizarCita'
import type { Cita } from '../schemas/citaSchema'

export const ESTADO_CORE_A_SUPABASE: Record<string, string> = {
  'Pendiente': 'Agendada',
  'Confirmada': 'Confirmada',
  'En sala de espera': 'EnEspera',
  'En atención': 'EnAtencion',
  'Completada': 'Completada',
  'Cancelada': 'Cancelada',
  'No-show': 'NoShow',
  'Reagendada': 'Reagendada',
  'Bloqueado': 'Bloqueado',
}

export const ESTADO_SUPABASE_A_CORE: Record<string, string> = {
  'Agendada': 'Pendiente',
  'Agendado': 'Pendiente',
  'Pendiente': 'Pendiente',
  'Confirmada': 'Confirmada',
  'Confirmado': 'Confirmada',
  'EnEspera': 'En sala de espera',
  'En Espera': 'En sala de espera',
  'EnAtencion': 'En atención',
  'En atención': 'En atención',
  'En Curso': 'En atención',
  'Completada': 'Completada',
  'Completado': 'Completada',
  'Atendido': 'Completada',
  'Cancelada': 'Cancelada',
  'Cancelado': 'Cancelada',
  'NoShow': 'No-show',
  'No-show': 'No-show',
  'No Asistió': 'No-show',
  'Reagendada': 'Reagendada',
  'Bloqueado': 'Bloqueado',
}

export const ESTADO_CODIGO_A_SUPABASE = ESTADO_CORE_A_SUPABASE
export const ESTADO_SUPABASE_A_CODIGO = ESTADO_SUPABASE_A_CORE

export const normalizarEstadoParaSupabase = (estado: unknown): string => {
  if (typeof estado !== 'string') return 'Agendada'
  const core = normalizarEstado(estado) // de utils/normalizarCita (legacy→core)
  return ESTADO_CORE_A_SUPABASE[core] || 'Agendada'
}

export const desnormalizarEstadoParaCodigo = (estado: unknown): string => {
  if (typeof estado !== 'string') return 'Pendiente'
  return ESTADO_SUPABASE_A_CORE[estado] || normalizarEstado(estado)
}

export const SNAKE_TO_CAMEL_MAP: Readonly<Record<string, string>> = {
  paciente_id: 'pacienteId',
  paciente_nombre: 'pacienteNombre',
  paciente_telefono: 'pacienteTelefono',
  paciente_rut: 'pacienteRut',
  hora_inicio: 'horaInicio',
  hora_fin: 'horaFin',
  box_asignado: 'boxAsignado',
  hora_inicio_atencion: 'horaInicioAtencion',
  user_id: 'userId',
  created_at: 'createdAt',
  updated_at: 'updatedAt'
}

export const CAMEL_TO_SNAKE_MAP: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SNAKE_TO_CAMEL_MAP).map(([snake, camel]) => [camel, snake])
)

/**
 * Transforma una fila o array de filas desde Supabase al schema de Cita.
 */
export const transformarDesdeSupabase = (
  input: Record<string, unknown>[] | Record<string, unknown> | null | undefined
): any => {
  if (!input) return Array.isArray(input) ? [] : null

  const transformarFila = (row: Record<string, unknown>): Cita => {
    let meta: Record<string, unknown> = {}
    const notasRaw = typeof row.notas === 'string' ? row.notas : ''
    if (notasRaw.trim().startsWith('{')) {
      try {
        meta = JSON.parse(notasRaw)
      } catch {
        meta = {}
      }
    }

    const doctorFinal = String(meta.doctor || meta.doctorId || row.doctor_id || row.doctor || '')
    const boxFinal = String(meta.box || meta.boxAsignado || row.box_asignado || row.box || '')
    const duracionFinal = Number(meta.duracion || meta.duracionMinutos || row.duracion || 30)
    const prestacionFinal = String(meta.prestacion || meta.trataMiento || meta.tratamiento || row.prestacion || row.motivo || '')
    const notasTexto = String(meta.observaciones || meta.notas || (!notasRaw.trim().startsWith('{') ? notasRaw : ''))

    return {
      id: row.id as string | number,
      pacienteId: (row.paciente_id || meta.pacienteId) as string | number | undefined,
      doctorId: doctorFinal || undefined,
      doctor: doctorFinal || undefined,
      fecha: String(row.fecha || ''),
      horaInicio: String(row.hora_inicio || row.horaInicio || ''),
      horaFin: (row.hora_fin || row.horaFin || undefined) as string | undefined,
      duracionMinutos: duracionFinal,
      duracion: duracionFinal,
      boxAsignado: boxFinal || undefined,
      box: boxFinal || undefined,
      trataMiento: prestacionFinal || undefined,
      tratamiento: prestacionFinal || undefined,
      prestacion: prestacionFinal || undefined,
      estado: desnormalizarEstadoParaCodigo(row.estado),
      observaciones: notasTexto || undefined,
      notas: notasTexto || undefined,
      motivo: (row.motivo || meta.motivo || undefined) as string | undefined,
      pacienteNombre: (row.paciente_nombre || meta.pacienteNombre || undefined) as string | undefined,
      pacienteTelefono: (meta.pacienteTelefono || row.paciente_telefono || undefined) as string | number | undefined,
      pacienteRut: (meta.pacienteRut || row.paciente_rut || undefined) as string | undefined,
      esBloqueo: Boolean(meta.esBloqueo || row.es_bloqueo),
      motivoBloqueo: (meta.motivoBloqueo || row.motivo_bloqueo || undefined) as string | undefined,
      recurrencia: (meta.recurrencia || row.recurrencia || 'ninguna') as any,
      frecuencia: (meta.frecuencia || row.frecuencia || undefined) as number | undefined,
      diaSemana: (meta.diaSemana || row.dia_semana || undefined) as number | undefined,
      diaMes: (meta.diaMes || row.dia_mes || undefined) as number | undefined,
      fechaFin: (meta.fechaFin || row.fecha_fin || undefined) as string | undefined,
    } as Cita
  }

  if (Array.isArray(input)) {
    return input.map(transformarFila)
  }

  return transformarFila(input)
}

/**
 * Convierte una cita de formato JS (camelCase) a Supabase (snake_case).
 */
export const transformarParaSupabase = (
  citaJs: Record<string, unknown> | null | undefined
): Record<string, unknown> | null => {
  if (!citaJs) return null

  const c = citaJs
  const doctorVal = c.doctorId || c.doctor || null
  const boxVal = c.boxAsignado || c.box || null
  const duracionVal = c.duracionMinutos ? Number(c.duracionMinutos) : (c.duracion ? Number(c.duracion) : 30)
  const prestacionVal = c.trataMiento || c.tratamiento || c.prestacion || null
  const notasTexto = (c.observaciones || c.notas || '') as string

  const metaExtra = {
    doctor: doctorVal,
    doctorId: doctorVal,
    box: boxVal,
    boxAsignado: boxVal,
    duracion: duracionVal,
    duracionMinutos: duracionVal,
    prestacion: prestacionVal,
    tratamiento: prestacionVal,
    trataMiento: prestacionVal,
    observaciones: notasTexto,
    notas: notasTexto,
    motivo: c.motivo || null,
    esBloqueo: Boolean(c.esBloqueo),
    motivoBloqueo: c.motivoBloqueo || null,
    recurrencia: c.recurrencia || 'ninguna',
    frecuencia: c.frecuencia || null,
    diaSemana: c.diaSemana || null,
    diaMes: c.diaMes || null,
    fechaFin: c.fechaFin || null,
    pacienteTelefono: c.pacienteTelefono || null,
    pacienteRut: c.pacienteRut || null,
  }

  const resultado: Record<string, unknown> = {
    fecha: c.fecha,
    hora_inicio: c.horaInicio || c.hora_inicio,
    hora_fin: c.horaFin || c.hora_fin || null,
    estado: normalizarEstadoParaSupabase(c.estado),
    motivo: (c.motivo || prestacionVal || null) as string | null,
    paciente_nombre: (c.pacienteNombre || c.paciente_nombre || null) as string | null,
    notas: JSON.stringify(metaExtra),
    // Aliases para compatibilidad con tests unitarios
    box_asignado: boxVal,
    doctor_id: doctorVal ? String(doctorVal) : null,
  }

  if (c.pacienteId || c.paciente_id) {
    const pId = String(c.pacienteId || c.paciente_id)
    if (esUuidValido(pId)) {
      resultado.paciente_id = pId
    } else {
      const mapeado = migrationStorageService.obtenerSupabaseId(pId)
      resultado.paciente_id = mapeado || null
    }
  } else {
    resultado.paciente_id = null
  }

  if (esUuidValido(c.id as string | number | undefined)) {
    resultado.id = String(c.id)
  }

  return resultado
}
