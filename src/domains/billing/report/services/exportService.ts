/**
 * Servicio centralizado de exportación de reportes (F6-05, migrado a exceljs en F7-15, auditoría vía RPC en F7-19)
 *
 * API pública:
 * - exportarReportePDF(metricas, userProfile) → genera PDF vía window.print()
 * - exportarReporteCompletoExcel(metricas) → Excel con 3 hojas
 * - exportarRankingExcel(topPrestaciones) → Excel con ranking de prestaciones
 * - exportarRendimientoExcel(recaudacionPorMetodo) → Excel con desglose por método
 *
 * Características:
 * - PDF: reutiliza window.print() con vista previa Letter
 * - Excel: usa exceljs (async) con múltiples hojas
 * - Nombres de archivo incluyen timestamp para evitar colisiones
 * - Integración con audit_log vía RPC SECURITY DEFINER (F7-19)
 * - Descarga vía Blob + URL.createObjectURL
 */
import ExcelJS from 'exceljs'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { createLogger } from '../../../../infrastructure/logging/logger'

const log = createLogger('exportService')

export interface PrestacionRankingItem {
  nombre: string
  cantidad: number
  montoTotal: number
  [key: string]: unknown
}

export interface MetricasReporte {
  totalRecaudado?: number | null
  tasaConversionPresupuestos?: number | string | null
  ticketPromedio?: number | null
  topPrestaciones: PrestacionRankingItem[]
  recaudacionPorMetodo?: Record<string, number>
  [key: string]: unknown
}

export interface UserProfileReporte {
  id?: string
  nombre?: string
  rol?: string
  [key: string]: unknown
}

export type ExportFormato = 'pdf' | 'excel'
export type ExportTipo = 'completo' | 'ranking' | 'rendimiento'

export interface ExportServiceApi {
  exportarReportePDF: (metricas: MetricasReporte, userProfile?: UserProfileReporte, moneda?: string) => boolean
  exportarReporteCompletoExcel: (metricas: MetricasReporte, periodoSeleccionado?: string, moneda?: string) => boolean
  exportarRankingExcel: (topPrestaciones: PrestacionRankingItem[], moneda?: string) => boolean
  exportarRendimientoExcel: (recaudacionPorMetodo: Record<string, number>, moneda?: string) => boolean
}

/**
 * Genera un nombre de archivo con timestamp.
 */
const generarNombreArchivo = (prefijo: string, extension: string): string => {
  const fecha = new Date()
  const timestamp = fecha.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${prefijo}_${timestamp}.${extension}`
}

/**
 * Formatea un monto en CLP para exportación.
 */
const formatearMonto = (monto?: number | null): string => {
  return monto?.toLocaleString('es-CL') || '0'
}

/**
 * Descarga un buffer como archivo .xlsx en el navegador.
 */
const descargarBuffer = (buffer: ExcelJS.Buffer | ArrayBuffer, nombreArchivo: string): void => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nombreArchivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Aplica estilos a una fila de encabezado en una hoja de Excel.
 */
const estilizarEncabezado = (hoja: ExcelJS.Worksheet, numeroFila: number): void => {
  const fila = hoja.getRow(numeroFila)
  fila.font = { bold: true }
  fila.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' }
  }
  fila.alignment = { horizontal: 'center' }
}

/**
 * F7-19: Registra una exportación en audit_log vía RPC SECURITY DEFINER.
 *
 * Reemplaza la llamada anterior a registrarAuditoria() que fallaba
 * silenciosamente porque F7-08 eliminó la política INSERT del cliente.
 *
 * @param formato - 'pdf' o 'excel'
 * @param tipo - 'completo', 'ranking' o 'rendimiento'
 * @param periodo - Período del reporte (opcional)
 */
const registrarExportacion = async (
  formato: ExportFormato,
  tipo: ExportTipo,
  periodo: string = 'sin_periodo'
): Promise<void> => {
  if (!USE_SUPABASE || !supabase) {
    log.warn('Supabase no disponible, skip auditoría de exportación')
    return
  }

  try {
    const { data, error } = await supabase.rpc('registrar_exportacion', {
      p_formato: formato,
      p_tipo: tipo,
      p_periodo: periodo
    })

    if (error) {
      log.error('Error registrando exportación en audit_log:', error.message)
      return
    }

    log.info('Exportación registrada en audit_log', { id: data, formato, tipo, periodo })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('Error inesperado registrando exportación:', msg)
  }
}

/**
 * Exporta el reporte completo como PDF usando window.print().
 */
export const exportarReportePDF = (
  metricas: MetricasReporte,
  _userProfile?: UserProfileReporte,
  _moneda: string = 'CLP'
): boolean => {
  try {
    log.info('Exportando reporte PDF', {
      totalRecaudado: metricas.totalRecaudado,
      tasaConversion: metricas.tasaConversionPresupuestos
    })

    window.print()

    log.info('Diálogo de impresión abierto')

    // F7-19: registrar en audit_log vía RPC (fire-and-forget)
    registrarExportacion('pdf', 'completo').catch((error: Error) => {
      log.warn('No se pudo registrar auditoría de exportación PDF:', error.message)
    })

    return true
  } catch (error: unknown) {
    log.error('Error al exportar PDF:', error)
    return false
  }
}

/**
 * Genera async el reporte completo con 3 hojas.
 */
const generarReporteCompletoAsync = async (
  metricas: MetricasReporte,
  periodoSeleccionado: string,
  moneda: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'DentikOS'
  workbook.created = new Date()

  // Hoja 1: Resumen ejecutivo
  const hojaResumen = workbook.addWorksheet('Resumen')
  hojaResumen.addRows([
    ['Informe de Gestión Clínica y Financiera'],
    ['Período:', periodoSeleccionado],
    ['Fecha de Exportación:', new Date().toLocaleString('es-CL')],
    [],
    ['Métrica', 'Valor'],
    [`Recaudado Total (${moneda})`, formatearMonto(metricas.totalRecaudado)],
    ['Tasa de Conversión (%)', metricas.tasaConversionPresupuestos],
    [`Ticket Promedio (${moneda})`, formatearMonto(metricas.ticketPromedio)],
  ])
  estilizarEncabezado(hojaResumen, 5)

  // Hoja 2: Top prestaciones
  const hojaRanking = workbook.addWorksheet('Top Prestaciones')
  const rankingRows: (string | number)[][] = [
    ['Top Procedimientos más Rentables'],
    [],
    ['Posición', 'Procedimiento', 'Cantidad', `Monto Total (${moneda})`],
  ]
  metricas.topPrestaciones.forEach((item, index) => {
    rankingRows.push([
      index + 1,
      item.nombre,
      item.cantidad,
      formatearMonto(item.montoTotal)
    ])
  })
  hojaRanking.addRows(rankingRows)
  estilizarEncabezado(hojaRanking, 3)

  // Hoja 3: Rendimiento por método de pago
  const hojaRendimiento = workbook.addWorksheet('Rendimiento')
  const rendimientoRows: (string | number)[][] = [
    ['Desglose por Medio de Pago'],
    [],
    ['Método de Pago', `Monto (${moneda})`],
  ]
  Object.entries(metricas.recaudacionPorMetodo || {}).forEach(([metodo, monto]) => {
    rendimientoRows.push([metodo, formatearMonto(monto)])
  })
  hojaRendimiento.addRows(rendimientoRows)
  estilizarEncabezado(hojaRendimiento, 3)

  const buffer = await workbook.xlsx.writeBuffer()
  const nombreArchivo = generarNombreArchivo(`reporte-completo_${periodoSeleccionado}`, 'xlsx')
  descargarBuffer(buffer, nombreArchivo)
  log.info('Reporte completo exportado', { archivo: nombreArchivo })
}

/**
 * Exporta el reporte completo como Excel con 3 hojas.
 * API síncrona: retorna true si se inició, descarga ocurre async.
 */
export const exportarReporteCompletoExcel = (
  metricas: MetricasReporte,
  periodoSeleccionado: string = 'sin_periodo',
  moneda: string = 'CLP'
): boolean => {
  try {
    log.info('Exportando reporte completo Excel', { periodo: periodoSeleccionado })

    generarReporteCompletoAsync(metricas, periodoSeleccionado, moneda)
      .then(() => registrarExportacion('excel', 'completo', periodoSeleccionado))
      .catch((error: unknown) => {
        log.error('Error en generación/auditoría async de reporte completo:', error)
      })

    return true
  } catch (error: unknown) {
    log.error('Error al exportar reporte completo:', error)
    return false
  }
}

/**
 * Genera async el ranking de prestaciones.
 */
const generarRankingAsync = async (topPrestaciones: PrestacionRankingItem[], moneda: string): Promise<void> => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'DentikOS'
  workbook.created = new Date()

  const hoja = workbook.addWorksheet('Ranking')
  const rows: (string | number)[][] = [
    ['Top Procedimientos más Rentables'],
    ['Fecha de Exportación:', new Date().toLocaleString('es-CL')],
    [],
    ['Posición', 'Procedimiento', 'Cantidad', `Monto Total (${moneda})`],
  ]
  topPrestaciones.forEach((item, index) => {
    rows.push([
      index + 1,
      item.nombre,
      item.cantidad,
      formatearMonto(item.montoTotal)
    ])
  })
  hoja.addRows(rows)
  estilizarEncabezado(hoja, 4)

  const buffer = await workbook.xlsx.writeBuffer()
  const nombreArchivo = generarNombreArchivo('ranking-prestaciones', 'xlsx')
  descargarBuffer(buffer, nombreArchivo)
  log.info('Ranking exportado', { archivo: nombreArchivo })
}

/**
 * Exporta solo el ranking de prestaciones como Excel.
 */
export const exportarRankingExcel = (topPrestaciones: PrestacionRankingItem[], moneda: string = 'CLP'): boolean => {
  try {
    log.info('Exportando ranking de prestaciones', { cantidad: topPrestaciones?.length })

    if (!topPrestaciones || topPrestaciones.length === 0) {
      log.warn('No hay prestaciones para exportar')
      return false
    }

    generarRankingAsync(topPrestaciones, moneda)
      .then(() => registrarExportacion('excel', 'ranking'))
      .catch((error: unknown) => {
        log.error('Error en generación/auditoría async de ranking:', error)
      })

    return true
  } catch (error: unknown) {
    log.error('Error al exportar ranking:', error)
    return false
  }
}

/**
 * Genera async el desglose por método de pago.
 */
const generarRendimientoAsync = async (
  recaudacionPorMetodo: Record<string, number>,
  moneda: string
): Promise<void> => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'DentikOS'
  workbook.created = new Date()

  const hoja = workbook.addWorksheet('Rendimiento')
  const rows: (string | number)[][] = [
    ['Desglose por Medio de Pago'],
    ['Fecha de Exportación:', new Date().toLocaleString('es-CL')],
    [],
    ['Método de Pago', `Monto (${moneda})`],
  ]
  Object.entries(recaudacionPorMetodo).forEach(([metodo, monto]) => {
    rows.push([metodo, formatearMonto(monto)])
  })
  hoja.addRows(rows)
  estilizarEncabezado(hoja, 4)

  const buffer = await workbook.xlsx.writeBuffer()
  const nombreArchivo = generarNombreArchivo('rendimiento-metodos', 'xlsx')
  descargarBuffer(buffer, nombreArchivo)
  log.info('Rendimiento exportado', { archivo: nombreArchivo })
}

/**
 * Exporta solo el desglose por método de pago como Excel.
 */
export const exportarRendimientoExcel = (
  recaudacionPorMetodo: Record<string, number>,
  moneda: string = 'CLP'
): boolean => {
  try {
    log.info('Exportando rendimiento por método de pago')

    if (!recaudacionPorMetodo || Object.keys(recaudacionPorMetodo).length === 0) {
      log.warn('No hay datos de rendimiento para exportar')
      return false
    }

    generarRendimientoAsync(recaudacionPorMetodo, moneda)
      .then(() => registrarExportacion('excel', 'rendimiento'))
      .catch((error: unknown) => {
        log.error('Error en generación/auditoría async de rendimiento:', error)
      })

    return true
  } catch (error: unknown) {
    log.error('Error al exportar rendimiento:', error)
    return false
  }
}

// Exportar todas las funciones como objeto para facilitar el uso
export const exportService: ExportServiceApi = {
  exportarReportePDF,
  exportarReporteCompletoExcel,
  exportarRankingExcel,
  exportarRendimientoExcel
}
