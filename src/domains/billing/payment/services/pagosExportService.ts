/**
 * Servicio de exportación de auditoría de pagos a XLSX (Commit C).
 *
 * Genera archivo Excel con TODOS los pagos (vigentes + anulados) para
 * respaldo y auditoría del administrador. Decisión 2B: incluir ambos
 * estados para trazabilidad completa.
 *
 * Usa exceljs (misma dependencia que exportService de reportes) para
 * que abra directamente en Excel en macOS/Windows, sin depender de
 * la asociación de archivos del sistema.
 */
import ExcelJS from 'exceljs'
import { createLogger } from '../../../../infrastructure/logging/logger'

const log = createLogger('pagosExportService')

export interface ColumnaAuditoriaPago {
  header: string
  key: string
  width: number
}

export interface PagoAuditoriaItem {
  id?: string | number
  folioComprobante?: string
  folioDTE?: string
  fecha?: string
  hora?: string
  pacienteNombre?: string
  pacienteRut?: string
  monto?: number | string
  moneda?: string
  metodoPago?: string
  concepto?: string
  estado?: string
  motivoAnulacion?: string
  fechaAnulacion?: string
  emitidoPor?: string
  observacion?: string
  motivoPurga?: string
  fechaPurga?: string
  purgadoPor?: string
  [key: string]: unknown
}

export interface ExportarAuditoriaPagosResult {
  ok: boolean
  total: number
  nombreArchivo: string
}

export const COLUMNAS: readonly ColumnaAuditoriaPago[] = [
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Folio Comprobante', key: 'folioComprobante', width: 18 },
  { header: 'Folio DTE', key: 'folioDTE', width: 15 },
  { header: 'Fecha', key: 'fecha', width: 12 },
  { header: 'Hora', key: 'hora', width: 10 },
  { header: 'Paciente', key: 'pacienteNombre', width: 28 },
  { header: 'RUT', key: 'pacienteRut', width: 15 },
  { header: 'Monto', key: 'monto', width: 14 },
  { header: 'Moneda', key: 'moneda', width: 10 },
  { header: 'Método de Pago', key: 'metodoPago', width: 18 },
  { header: 'Concepto', key: 'concepto', width: 25 },
  { header: 'Estado', key: 'estado', width: 12 },
  { header: 'Motivo Anulación', key: 'motivoAnulacion', width: 30 },
  { header: 'Fecha Anulación', key: 'fechaAnulacion', width: 15 },
  { header: 'Emitido por', key: 'emitidoPor', width: 22 },
  { header: 'Observación', key: 'observacion', width: 40 },
  { header: 'Motivo Purga', key: 'motivoPurga', width: 35 },
  { header: 'Fecha Purga', key: 'fechaPurga', width: 15 },
  { header: 'Purgado por', key: 'purgadoPor', width: 25 }
]

const generarTimestamp = (): string => {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
}

const estilizarEncabezado = (hoja: ExcelJS.Worksheet): void => {
  const fila = hoja.getRow(1)
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  fila.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2F5233' }
  }
  fila.alignment = { horizontal: 'center', vertical: 'middle' }
  fila.height = 22
}

const formatearFilas = (hoja: ExcelJS.Worksheet): void => {
  hoja.eachRow((fila, numFila) => {
    if (numFila === 1) return
    const estado = fila.getCell(11).value
    if (estado === 'Purgado') {
      fila.font = { color: { argb: 'FF4B5563' }, italic: true, strike: true }
      fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
    } else if (estado === 'Anulado') {
      fila.font = { color: { argb: 'FF991B1B' }, italic: true }
      fila.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' }
      }
    }
    // Columna Monto con formato numérico
    const celdaMonto = fila.getCell(8)
    celdaMonto.numFmt = '$#,##0'
    celdaMonto.alignment = { horizontal: 'right' }
  })
}

/**
 * Exporta todos los pagos a XLSX y dispara la descarga del archivo.
 * @param pagos - Array de pagos (vigentes + anulados)
 * @returns resultado de la exportación
 */
export const exportarAuditoriaPagosXLSX = async (
  pagos: unknown = []
): Promise<ExportarAuditoriaPagosResult> => {
  try {
    if (!Array.isArray(pagos)) {
      log.error('exportarAuditoriaPagosXLSX: pagos no es array')
      return { ok: false, total: 0, nombreArchivo: '' }
    }
    const listaPagos = pagos as PagoAuditoriaItem[]
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'DentikOS'
    workbook.created = new Date()
    const hoja = workbook.addWorksheet('Auditoría Pagos')
    hoja.columns = COLUMNAS as ExcelJS.Column[]
    listaPagos.forEach(p => hoja.addRow(p))
    estilizarEncabezado(hoja)
    formatearFilas(hoja)
    // Auto-filtrar por encabezado
    hoja.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, listaPagos.length + 1), column: COLUMNAS.length }
    }
    const buffer = await workbook.xlsx.writeBuffer()
    const nombreArchivo = `auditoria_pagos_${generarTimestamp()}.xlsx`
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
    log.info(`Auditoría exportada: ${listaPagos.length} pagos → ${nombreArchivo}`)
    return { ok: true, total: listaPagos.length, nombreArchivo }
  } catch (e: unknown) {
    log.error('Error al exportar auditoría XLSX:', e)
    return { ok: false, total: 0, nombreArchivo: '' }
  }
}
