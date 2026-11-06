interface CitaConBoxAgenda {
  sedeId?: unknown
  boxId?: unknown
  boxAsignado?: unknown
}

const textoNoVacio = (valor: unknown): string | null =>
  typeof valor === 'string' && valor.trim() ? valor.trim() : null

/** Conserva el criterio legado cuando falta algún vínculo de sucursal o box. */
export const citasCompartenBoxAgenda = (a: CitaConBoxAgenda, b: CitaConBoxAgenda): boolean => {
  const sedeA = textoNoVacio(a.sedeId)
  const sedeB = textoNoVacio(b.sedeId)
  if (sedeA && sedeB && sedeA !== sedeB) return false

  const boxA = textoNoVacio(a.boxId)
  const boxB = textoNoVacio(b.boxId)
  if (boxA && boxB) return boxA === boxB

  const nombreA = textoNoVacio(a.boxAsignado)
  const nombreB = textoNoVacio(b.boxAsignado)
  return Boolean(nombreA && nombreB && nombreA === nombreB)
}
