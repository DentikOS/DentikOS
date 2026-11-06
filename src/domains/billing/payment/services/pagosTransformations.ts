/**
 * Transformaciones de datos para pagos (Supabase <-> JavaScript)
 *
 * Extraído de pagosStorageService.js para respetar límites arquitectónicos.
 *
 * Responsabilidad:
 * - Mapeo entre snake_case (DB) y camelCase (JS)
 * - Transformación de objetos para lectura/escritura en Supabase
 * - Commit K1: allowlist ajustada a schema REAL de Supabase
 */
import { migrationStorageService } from '../../../../infrastructure/persistence/migrationStorageService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'

// MAPEO DE CLAVES: DB (snake_case) <-> JS (camelCase)
export const SNAKE_TO_CAMEL_MAP: Readonly<Record<string, string>> = {
  paciente_id: 'pacienteId',
  metodo_pago: 'metodoPago',
  moneda: 'moneda',
  user_id: 'userId',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  motivo_anulacion: 'motivoAnulacion',
  fecha_anulacion: 'fechaAnulacion',
  clinica_id: 'clinicaId',
  folio: 'folioComprobante',
  motivo_purga: 'motivoPurga',
  fecha_purga: 'fechaPurga',
  purgado_por: 'purgadoPor'
}

export const CAMEL_TO_SNAKE_MAP: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SNAKE_TO_CAMEL_MAP).map(([snake, camel]) => [camel, snake])
)

/**
 * Convierte formato chileno DD/MM/YYYY o DD-MM-YYYY a ISO YYYY-MM-DD.
 * Retorna null si no matchea (fallback seguro para evitar error 400).
 */
const convertirFechaAISO = (valor: unknown): string | null => {
  if (!valor || typeof valor !== 'string') return null
  const match = valor.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

// ALLOWLIST DE COLUMNAS VALIDAS EN SUPABASE (Commit K1)
const COLUMNAS_SUPABASE_VALIDAS: ReadonlySet<string> = new Set([
  'id', 'user_id', 'paciente_id', 'clinica_id',
  'folio', 'monto', 'metodo_pago', 'fecha',
  'moneda',
  'concepto', 'estado',
  'motivo_anulacion', 'fecha_anulacion',
  'motivo_purga', 'fecha_purga', 'purgado_por',
  'created_at', 'updated_at'
])

/**
 * Transforma un pago desde Supabase (snake_case) a JavaScript (camelCase)
 */
export const transformarDesdeSupabase = <T extends Record<string, unknown> = Record<string, unknown>>(
  pagoDb: Record<string, unknown> | null | undefined
): T | null => {
  if (!pagoDb) return null
  const resultado: Record<string, unknown> = {}
  for (const [claveDb, valor] of Object.entries(pagoDb)) {
    const claveJs = SNAKE_TO_CAMEL_MAP[claveDb] || claveDb
    resultado[claveJs] = valor
  }
  return resultado as T
}

/**
 * Transforma un pago desde JavaScript (camelCase) a Supabase (snake_case).
 * Omite columnas que no existen en Supabase (Commit K1).
 */
export const transformarParaSupabase = (
  pagoJs: Record<string, unknown> | null | undefined
): Record<string, unknown> | null => {
  if (!pagoJs) return null
  const filtrado: Record<string, unknown> = {}
  for (const [claveJs, valor] of Object.entries(pagoJs)) {
    if (claveJs === 'createdAt' || claveJs === 'updatedAt' || claveJs === 'userId') {
      continue
    }
    const claveDb = CAMEL_TO_SNAKE_MAP[claveJs] || claveJs

    // Commit K1: filtrar columnas que no existen en Supabase
    if (!COLUMNAS_SUPABASE_VALIDAS.has(claveDb)) continue

    if (claveJs === 'pacienteId') {
      if (typeof valor === 'string' && esUuidValido(valor)) {
        filtrado.paciente_id = valor
      } else if (valor !== null && valor !== undefined) {
        const pacienteUuid = migrationStorageService.obtenerSupabaseId(String(valor))
        filtrado.paciente_id = pacienteUuid || null
      } else {
        filtrado.paciente_id = null
      }
    } else if (claveDb === 'fecha' || claveDb === 'fecha_purga' || claveDb === 'fecha_anulacion') {
      // Commit L1/K7: convertir DD/MM/YYYY a YYYY-MM-DD para Supabase
      const fechaISO = convertirFechaAISO(valor)
      filtrado[claveDb] = fechaISO || null
    } else if (valor === '' || valor === null || valor === undefined) {
      filtrado[claveDb] = null
    } else {
      filtrado[claveDb] = valor
    }
  }
  return filtrado
}

// Campos que NO viven en Supabase y deben preservarse desde localStorage
const CAMPOS_SOLO_LOCALES: readonly string[] = [
  'pacienteNombre', 'pacienteRut',
  'motivoPurga', 'fechaPurga', 'purgadoPor',
  'emitidoPor', 'prestacionesImputadas',
  'tipoDTE', 'folioDTE', 'hora'
]

/**
 * Merge de campos locales al sincronizar desde Supabase (Commit K2).
 * Toma el pago de Supabase como base y rellena los campos que Supabase
 * no almacena desde la copia local previa (match por id).
 */
export const mergeCamposLocales = <T extends Record<string, unknown>>(
  pagosSupabase: T[],
  pagosPrevios: Record<string, unknown>[] = []
): T[] => {
  const previosMap = new Map(pagosPrevios.map(p => [String(p.id), p]))
  return pagosSupabase.map(pago => {
    const previo = previosMap.get(String(pago.id))
    if (!previo) return pago
    const out = { ...pago } as Record<string, unknown>
    CAMPOS_SOLO_LOCALES.forEach(k => {
      if ((out[k] === null || out[k] === undefined) && previo[k] !== null && previo[k] !== undefined) {
        out[k] = previo[k]
      }
    })
    return out as T
  })
}
