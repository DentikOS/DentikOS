/**
 * Utilidades puras para el Módulo de Laboratorio y Tarifarios
 */

export interface TarifaLab {
  trabajo?: string
  precio?: number | string
}

export interface LaboratorioConTarifas {
  id?: number | string
  tarifas?: readonly TarifaLab[] | TarifaLab[]
}

export interface OrdenLabCalc {
  etapa?: string
}

export interface ResumenLaboratorio {
  totalOrdenes: number
  enProcesoCount: number
  listosInstalarCount: number
  repeticionesCount: number
}

export const generarCodigoOrdenLab = (): string => {
  const anio = new Date().getFullYear()
  const random = Math.floor(100 + Math.random() * 900)
  return `LAB-${anio}-${random}`
}

export const buscarTarifaSugerida = (
  laboratorios: readonly LaboratorioConTarifas[] | LaboratorioConTarifas[] = [],
  labId: number | string,
  trabajoNombre: string
): number => {
  const lab = laboratorios.find(l => l.id === parseInt(String(labId), 10) || l.id === labId)
  if (!lab?.tarifas) return 0
  const tarifaObj = lab.tarifas.find(t => t.trabajo === trabajoNombre)
  return tarifaObj ? parseFloat(String(tarifaObj.precio)) || 0 : 0
}

export const calcularResumenLaboratorio = (ordenes: OrdenLabCalc[] = []): ResumenLaboratorio => {
  let enProcesoCount = 0, listosInstalarCount = 0, repeticionesCount = 0

  ordenes.forEach(o => {
    if (o.etapa !== 'entrega') enProcesoCount++
    if (o.etapa === 'entrega') listosInstalarCount++
    if (o.etapa === 'ajustes') repeticionesCount++
  })

  return {
    totalOrdenes: ordenes.length,
    enProcesoCount,
    listosInstalarCount,
    repeticionesCount
  }
}
