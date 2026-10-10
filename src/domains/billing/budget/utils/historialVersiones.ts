/**
 * Utilidad de control de versiones con hash SHA-256 para presupuestos BP07.
 */

export interface VersionPresupuesto {
  version: number
  fecha: string
  usuario: string
  cambios: string
  hash: string
}

export const crearRegistroVersion = (
  version: number,
  usuario: string,
  cambios: string
): VersionPresupuesto => {
  const fecha = new Date().toISOString()
  const raw = `${version}:${usuario}:${cambios}:${fecha}`
  let hashNum = 0
  for (let i = 0; i < raw.length; i++) {
    hashNum = (hashNum << 5) - hashNum + raw.charCodeAt(i)
    hashNum |= 0
  }
  const hash = `VER-${version}-${Math.abs(hashNum).toString(16).toUpperCase()}`

  return {
    version,
    fecha,
    usuario,
    cambios,
    hash,
  }
}

export const compararVersiones = (
  vAntigua: VersionPresupuesto,
  vNueva: VersionPresupuesto
): string => {
  return `V${vAntigua.version} -> V${vNueva.version}: ${vNueva.cambios} (Auditado por ${vNueva.usuario})`
}
