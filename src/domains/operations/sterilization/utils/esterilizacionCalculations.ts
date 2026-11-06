/**
 * Utilidades puras para el cálculo de trazabilidad, vencimientos y bioseguridad
 */

export interface CargaEsterilizacion {
  fecha?: string
  estado?: string
  indicadorQuimico?: string
}

export interface BiologicoEsterilizacion {
  resultado?: string
}

export interface TestDiarioEsterilizacion {
  fecha?: string
  equipo?: string
  resultado?: string
}

export interface ResumenEsterilizacion {
  totalCargas: number
  cargasHoy: number
  conformes: number
  rechazadas: number
  biologicosPendientes: number
  testBowieDickHoy: number
}

export const generarCodigoLoteEsterilizacion = (): string => {
  const hoy = new Date()
  const yyyy = hoy.getFullYear()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('El navegador no permite crear un identificador seguro para el lote.')
  }
  return `LOTE-${yyyy}${mm}${dd}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

export const calcularResumenEsterilizacion = (
  cargas: CargaEsterilizacion[] = [],
  biologicos: BiologicoEsterilizacion[] = [],
  testDiarios: TestDiarioEsterilizacion[] = []
): ResumenEsterilizacion => {
  const hoyStr = new Date().toLocaleDateString('es-CL')

  let cargasHoy = 0
  let conformes = 0
  let rechazadas = 0

  cargas.forEach(c => {
    if (c.fecha === hoyStr) cargasHoy++
    if (c.estado === 'Liberado' || c.estado === 'Conforme') conformes++
    if (c.estado === 'Rechazado' || (c.indicadorQuimico && c.indicadorQuimico.includes('Fallo'))) rechazadas++
  })

  const biologicosPendientes = biologicos.filter(b => b.resultado === 'Pendiente').length
  const testBowieDickHoy = new Set(testDiarios
    .filter(t => t.fecha === hoyStr && t.resultado === 'Aprobado')
    .map(t => t.equipo || 'equipo-sin-identificar')).size

  return {
    totalCargas: cargas.length,
    cargasHoy,
    conformes,
    rechazadas,
    biologicosPendientes,
    testBowieDickHoy
  }
}
