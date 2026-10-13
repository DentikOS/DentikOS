/**
 * Funciones de transformación de datos de pacientes
 * Extraído de pacientesStorageService.js para respetar límite arquitectónico
 */
import type { Paciente } from '../schemas/pacienteSchema'

/**
 * Mapeo de campos snake_case (Supabase) a camelCase (JS)
 */
export const SNAKE_TO_CAMEL_MAP: Readonly<Record<string, string>> = {
  contacto_emergencia: 'contactoEmergencia',
  examen_extraoral: 'examenExtraoral',
  examen_intraoral: 'examenIntraoral',
  presion_arterial: 'presionArterial',
  riesgo_cariogenico: 'riesgoCariogenico',
  riesgo_periodontal: 'riesgoPeriodontal',
  motivo_consulta: 'motivoConsulta',
  anamnesis_proxima: 'anamnesisProxima',
  fecha_ingreso: 'fechaIngreso',
  user_id: 'userId',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  doctor_tratante_id: 'doctorTratanteId',
  motivo_bloqueo: 'motivoBloqueo',
  fecha_ultima_visita: 'fechaUltimaVisita',
  fecha_creacion: 'fechaCreacion'
}

/**
 * Mapeo inverso: camelCase (JS) a snake_case (Supabase)
 */
export const CAMEL_TO_SNAKE_MAP: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SNAKE_TO_CAMEL_MAP).map(([snake, camel]) => [camel, snake])
)

/**
 * Transforma un paciente desde formato Supabase (snake_case) a JS (camelCase)
 */
export const transformarDesdeSupabase = <T extends Record<string, unknown> = Paciente>(
  pacienteDb: Record<string, unknown> | null | undefined
): T | null => {
  if (!pacienteDb) return null
  const resultado: Record<string, unknown> = {}
  for (const [claveDb, valor] of Object.entries(pacienteDb)) {
    const claveJs = SNAKE_TO_CAMEL_MAP[claveDb] || claveDb
    resultado[claveJs] = valor
  }
  return resultado as T
}

/**
 * Transforma un paciente desde formato JS (camelCase) a Supabase (snake_case)
 */
export const transformarParaSupabase = (
  pacienteJs: Record<string, unknown> | null | undefined
): Record<string, unknown> | null => {
  if (!pacienteJs) return null
  const resultado: Record<string, unknown> = {}
  for (const [claveJs, valor] of Object.entries(pacienteJs)) {
    if (claveJs === 'createdAt' || claveJs === 'updatedAt' || claveJs === 'userId') {
      continue
    }
    const claveDb = CAMEL_TO_SNAKE_MAP[claveJs] || claveJs
    if (valor === '' && claveJs !== 'notas') {
      resultado[claveDb] = null
    } else if (valor !== undefined) {
      resultado[claveDb] = valor
    }
  }
  return resultado
}
