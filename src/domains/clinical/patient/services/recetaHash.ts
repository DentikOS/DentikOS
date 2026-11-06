import type { MedicamentoRecetaCanonica } from './recetasCanonicasStorageService'

export interface ContenidoHashReceta {
  id: string
  paciente_id: string
  fecha: string
  profesional: string
  medicamentos: MedicamentoRecetaCanonica[]
  diagnostico: string | null
  indicaciones: string | null
  qr_token: string
}

const canonizar = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonizar).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonizar(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export const generarHashReceta = async (contenido: ContenidoHashReceta): Promise<string> => {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
    throw new Error('Este dispositivo no puede calcular el identificador de integridad de la receta.')
  }
  const bytes = new TextEncoder().encode(canonizar(contenido))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
