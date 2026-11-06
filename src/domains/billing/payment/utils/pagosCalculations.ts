/**
 * Cálculos tributarios, comisiones bancarias e imputaciones
 */

export interface PagoParaResumen {
  monto?: number | string
  estado?: string
  fecha?: string
  tipoDTE?: string
  metodoPago?: string
  [key: string]: unknown
}

export interface ResumenRecaudacion {
  totalTransacciones: number
  recaudadoHoy: number
  totalRecaudado: number
  totalBoletasHonorarios: number
  totalBonoIMed: number
  totalTarjetasPOS: number
  totalAnulados: number
}

export const generarFolioRecibo = (): string => {
  const anio = new Date().getFullYear()
  const random = Math.floor(1000 + Math.random() * 9000)
  return `REC-${anio}-${random}`
}

export const calcularResumenRecaudacion = (pagos: PagoParaResumen[] = []): ResumenRecaudacion => {
  const hoyStr = new Date().toLocaleDateString('es-CL')
  let recaudadoHoy = 0, totalRecaudado = 0, totalBoletasHonorarios = 0
  let totalBonoIMed = 0, totalTarjetasPOS = 0, totalAnulados = 0

  pagos.forEach(p => {
    const monto = parseFloat(String(p.monto)) || 0
    if (p.estado === 'Borrador sin confirmar') return
    if (p.estado === 'Purgado') return
    if (p.estado === 'Anulado') {
      totalAnulados += monto
      return
    }
    totalRecaudado += monto
    if (p.fecha === hoyStr) recaudadoHoy += monto
    if (p.tipoDTE === 'boleta_honorarios') totalBoletasHonorarios += monto
    if (p.tipoDTE === 'bono_imed') totalBonoIMed += monto
    if (p.metodoPago === 'Débito' || p.metodoPago === 'Crédito') totalTarjetasPOS += monto
  })

  return {
    totalTransacciones: pagos.filter(p => p.estado !== 'Purgado' && p.estado !== 'Borrador sin confirmar').length,
    recaudadoHoy, totalRecaudado, totalBoletasHonorarios, totalBonoIMed, totalTarjetasPOS, totalAnulados
  }
}
