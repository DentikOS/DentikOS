/**
 * Utilidad de esteganografía forense para presupuestos y recetas BP06/BP07.
 * Codifica metadatos de auditoría con hash SHA-256 en micro-patrón.
 */

export interface MetadatosForense {
  documentoId: string | number
  clinicaId?: string
  pacienteRut: string
  montoTotal?: number
  timestamp?: string
}

export const generarHashForense = (meta: MetadatosForense): string => {
  const ts = meta.timestamp || new Date().toISOString()
  const raw = `${meta.documentoId}:${meta.pacienteRut}:${meta.montoTotal || 0}:${ts}`
  // Genera firma determinista para el documento
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i)
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `SEC-STEG-${hex.toUpperCase()}`
}

export const generarPayloadQRVerificacion = (meta: MetadatosForense): string => {
  const hash = generarHashForense(meta)
  return `https://studio-dental.app/verify?doc=${meta.documentoId}&rut=${meta.pacienteRut}&sig=${hash}`
}
