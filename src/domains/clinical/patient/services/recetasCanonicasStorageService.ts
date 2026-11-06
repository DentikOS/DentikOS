import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'

export interface MedicamentoRecetaCanonica {
  nombre: string
  dosis: string
  frecuencia: string
  duracion: string
}

export interface NuevaRecetaCanonica {
  id: string
  paciente_id: string
  fecha: string
  profesional: string
  medicamentos: MedicamentoRecetaCanonica[]
  diagnostico: string | null
  indicaciones: string | null
  firma: string | null
  hash_forense: string
  qr_token: string
}

export interface RecetaCanonicaRow extends NuevaRecetaCanonica {
  user_id: string
  clinica_id: string
  created_at?: string | null
  updated_at?: string | null
}

const COLUMNAS_RECETA = 'id,user_id,paciente_id,clinica_id,fecha,profesional,medicamentos,diagnostico,indicaciones,firma,hash_forense,qr_token,created_at,updated_at'
const ERROR_GUARDADO = 'No se pudo confirmar el guardado de la receta en Supabase.'

const esFechaISO = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const tienePosologiaCompleta = (medicamento: MedicamentoRecetaCanonica): boolean =>
  Boolean(
    medicamento &&
    typeof medicamento.nombre === 'string' && medicamento.nombre.trim() &&
    typeof medicamento.dosis === 'string' && medicamento.dosis.trim() &&
    typeof medicamento.frecuencia === 'string' && medicamento.frecuencia.trim() &&
    typeof medicamento.duracion === 'string' && medicamento.duracion.trim()
  )

const canonizar = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonizar).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonizar(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

const coincideConSolicitud = (row: RecetaCanonicaRow, receta: NuevaRecetaCanonica, userId: string, clinicaId: string): boolean =>
  row.id === receta.id &&
  row.user_id === userId &&
  row.paciente_id === receta.paciente_id &&
  row.clinica_id === clinicaId &&
  row.fecha === receta.fecha &&
  row.profesional === receta.profesional &&
  canonizar(row.medicamentos) === canonizar(receta.medicamentos) &&
  row.diagnostico === receta.diagnostico &&
  row.indicaciones === receta.indicaciones &&
  row.firma === receta.firma &&
  row.hash_forense === receta.hash_forense &&
  row.qr_token === receta.qr_token

const validarReceta = (receta: NuevaRecetaCanonica): void => {
  if (!esUuidValido(receta.id) || !esUuidValido(receta.paciente_id)) {
    throw new Error('La receta o el paciente no tienen un identificador válido.')
  }
  if (!esFechaISO(receta.fecha)) throw new Error('La fecha de la receta no es válida.')
  if (!receta.profesional.trim()) throw new Error('No se pudo identificar al profesional que emite la receta.')
  if (!Array.isArray(receta.medicamentos) || receta.medicamentos.length === 0) {
    throw new Error('Agrega al menos un medicamento antes de emitir la receta.')
  }
  if (!receta.medicamentos.every(tienePosologiaCompleta)) {
    throw new Error('Cada medicamento debe incluir dosis, frecuencia y duración.')
  }
  if (!/^[a-f0-9]{64}$/i.test(receta.hash_forense)) throw new Error('El identificador de integridad de la receta no es válido.')
  if (!receta.qr_token.trim()) throw new Error('La receta no tiene un token de trazabilidad válido.')
}

const validarFila = (value: unknown, pacienteId: string, clinicaId: string): RecetaCanonicaRow => {
  const row = value as RecetaCanonicaRow | null
  if (
    !row ||
    row.paciente_id !== pacienteId ||
    row.clinica_id !== clinicaId ||
    !esUuidValido(row.id) ||
    !esUuidValido(row.user_id) ||
    !esFechaISO(row.fecha) ||
    typeof row.profesional !== 'string' ||
    !row.profesional.trim() ||
    !Array.isArray(row.medicamentos) ||
    row.medicamentos.length === 0 ||
    !row.medicamentos.every(tienePosologiaCompleta) ||
    typeof row.hash_forense !== 'string' ||
    !row.hash_forense.trim() ||
    typeof row.qr_token !== 'string' ||
    !row.qr_token.trim()
  ) {
    throw new Error('Supabase devolvió una receta fuera de la clínica activa.')
  }
  return row
}

const obtenerContexto = async (pacienteId: string): Promise<{ userId: string; clinicaId: string }> => {
  if (!USE_SUPABASE || !supabase) {
    throw new Error('La emisión de recetas requiere conexión con Supabase.')
  }
  if (!esUuidValido(pacienteId)) throw new Error('El paciente no tiene un identificador válido.')
  const clinicaId = getClinicaActivaSync()
  if (!esUuidValido(clinicaId)) throw new Error('No hay una clínica activa válida para emitir la receta.')

  let authResult: Awaited<ReturnType<typeof supabase.auth.getUser>>
  try {
    authResult = await supabase.auth.getUser()
  } catch {
    throw new Error('No se pudo verificar la sesión actual.')
  }
  const { data: { user }, error } = authResult
  if (error || !user || !esUuidValido(user.id)) throw new Error('La emisión requiere una sesión autenticada vigente.')
  if (getClinicaActivaSync() !== clinicaId) throw new Error('La clínica activa cambió. Vuelve a confirmar la receta.')
  return { userId: user.id, clinicaId }
}

export const recetasCanonicasStorageService = {
  async listar(pacienteId: string): Promise<RecetaCanonicaRow[]> {
    const { clinicaId } = await obtenerContexto(pacienteId)
    if (!supabase) throw new Error('La emisión de recetas requiere conexión con Supabase.')

    let response: Awaited<ReturnType<ReturnType<typeof supabase.from>['select']>>
    try {
      response = await supabase
        .from('recetas')
        .select(COLUMNAS_RECETA)
        .eq('paciente_id', pacienteId)
        .eq('clinica_id', clinicaId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
    } catch {
      throw new Error('No se pudieron cargar las recetas sincronizadas.')
    }

    const { data, error } = response
    if (error || !Array.isArray(data)) throw new Error('No se pudieron cargar las recetas sincronizadas.')
    if (getClinicaActivaSync() !== clinicaId) throw new Error('La clínica activa cambió durante la consulta de recetas.')
    return data.map((row) => validarFila(row, pacienteId, clinicaId))
  },

  async guardar(receta: NuevaRecetaCanonica): Promise<RecetaCanonicaRow> {
    validarReceta(receta)
    const { userId, clinicaId } = await obtenerContexto(receta.paciente_id)
    if (!supabase) throw new Error('La emisión de recetas requiere conexión con Supabase.')

    const fila = { ...receta, user_id: userId, clinica_id: clinicaId }
    let response: { data: unknown; error: { code?: string } | null }
    try {
      response = await supabase
        .from('recetas')
        .insert(fila)
        .select(COLUMNAS_RECETA)
        .single()
    } catch {
      throw new Error(ERROR_GUARDADO)
    }
    const { data, error } = response

    if (error?.code === '23505') {
      let verificacion: { data: unknown; error: { message?: string } | null }
      try {
        verificacion = await supabase
          .from('recetas')
          .select(COLUMNAS_RECETA)
          .eq('id', receta.id)
          .eq('paciente_id', receta.paciente_id)
          .eq('clinica_id', clinicaId)
          .maybeSingle()
      } catch {
        throw new Error(ERROR_GUARDADO)
      }
      const { data: existente, error: errorLectura } = verificacion

      if (!errorLectura && existente && coincideConSolicitud(existente as RecetaCanonicaRow, receta, userId, clinicaId)) {
        if (getClinicaActivaSync() !== clinicaId) throw new Error('La clínica activa cambió. Revisa la receta en la clínica donde se emitió.')
        return validarFila(existente, receta.paciente_id, clinicaId)
      }
      throw new Error(ERROR_GUARDADO)
    }

    if (error || !data) throw new Error(ERROR_GUARDADO)
    const guardada = validarFila(data, receta.paciente_id, clinicaId)
    if (guardada.user_id !== userId || guardada.id !== receta.id || getClinicaActivaSync() !== clinicaId) {
      throw new Error('Supabase no confirmó la receta con el usuario, identificador y clínica esperados.')
    }
    return guardada
  },
}

