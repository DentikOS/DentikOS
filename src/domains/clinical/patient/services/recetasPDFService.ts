/** Generador de PDF de receta; este documento no incorpora firma electrónica. */
import { jsPDF } from 'jspdf'
import type { DatosClinicaConfig } from '../../../organization/clinic/services/clinicStorageService'
import { dibujarMembreteClinicaPdf } from '../../../organization/clinic/utils/dibujarMembreteClinicaPdf'
import { resolverIdiomaDocumento, traducirEtiquetaDocumento } from '../../../../shared/utils/formatoDocumento'

export interface RecetaPDFData {
  pacienteNombre: string
  pacienteRut: string
  profesional: string
  medicamentos: Array<{ nombre: string; dosis: string; frecuencia: string; duracion: string }>
  indicaciones: string
  fecha: string
  hashForense: string
  qrToken: string
  clinica?: DatosClinicaConfig
}

const formatearFechaReceta = (fecha: string, idioma: string): string => {
  const dateOnly = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12)
    : new Date(fecha)
  return Number.isNaN(parsed.getTime()) ? fecha : parsed.toLocaleDateString(idioma)
}

export const recetasPDFService = {
  async generarRecetaPDF(data: RecetaPDFData): Promise<jsPDF> {
    const posologiaIncompleta = data.medicamentos.length === 0 || data.medicamentos.some((med) =>
      !med.nombre.trim() || !med.dosis.trim() || !med.frecuencia.trim() || !med.duracion.trim()
    )
    if (posologiaIncompleta) {
      throw new Error('Cada medicamento debe incluir dosis, frecuencia y duración para generar la receta.')
    }

    const idioma = resolverIdiomaDocumento(data.clinica?.idiomaDocumentos)
    const etiqueta = (clave: Parameters<typeof traducirEtiquetaDocumento>[1]) => traducirEtiquetaDocumento(idioma, clave)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    })

    // Cabecera institucional configurable por la clínica.
    const encabezadoY = await dibujarMembreteClinicaPdf(doc, data.clinica || {})
    const pacienteY = Math.max(38, encabezadoY + 4)

    // Datos del Paciente
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`${etiqueta('patient')}: ${data.pacienteNombre}`, 14, pacienteY)
    doc.text(`${etiqueta('rut')}: ${data.pacienteRut}`, 14, pacienteY + 6)
    doc.text(`${etiqueta('issueDate')}: ${formatearFechaReceta(data.fecha, idioma)}`, 14, pacienteY + 12)
    doc.text(`${etiqueta('professional')}: ${data.profesional}`, 120, pacienteY)

    // Línea separadora
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(14, pacienteY + 17, 202, pacienteY + 17)

    // Prescripción RP/
    doc.setFontSize(13)
    doc.setTextColor(184, 142, 58) // Gold primary
    doc.text(`${etiqueta('prescription')}:`, 14, pacienteY + 27)

    let yOffset = pacienteY + 37
    data.medicamentos.forEach((med, idx) => {
      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.text(`${idx + 1}. ${med.nombre}`, 16, yOffset)

      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'normal')
      doc.text(`${etiqueta('dosage')}: ${med.dosis} | ${etiqueta('frequency')}: ${med.frecuencia} | ${etiqueta('duration')}: ${med.duracion}`, 20, yOffset + 5)
      yOffset += 14
    })

    // Indicaciones generales
    if (data.indicaciones) {
      yOffset += 5
      doc.setFontSize(11)
      doc.setTextColor(184, 142, 58)
      doc.setFont('helvetica', 'bold')
      doc.text(`${etiqueta('instructions')}:`, 14, yOffset)

      doc.setFontSize(9)
      doc.setTextColor(51, 65, 85)
      doc.setFont('helvetica', 'normal')
      const lineas = doc.splitTextToSize(data.indicaciones, 180)
      doc.text(lineas, 16, yOffset + 6)
      yOffset += lineas.length * 6 + 10
    }

    // Bloque de Firma y Seguridad Forense
    const footerY = 230
    doc.setDrawColor(203, 213, 225)
    doc.rect(14, footerY, 188, 38, 'S')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text('REGISTRO DE RECETA • DENTIKOS', 18, footerY + 8)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(`Identificador de trazabilidad: ${data.hashForense}`, 18, footerY + 14)
    doc.text('Este archivo no incluye firma electrónica ni código QR verificable.', 18, footerY + 22)
    doc.text(`Profesional emisor: ${data.profesional}`, 18, footerY + 30)

    return doc
  },

  async descargarReceta(data: RecetaPDFData, nombreArchivo?: string): Promise<void> {
    const doc = await this.generarRecetaPDF(data)
    doc.save(nombreArchivo || `Receta_${data.pacienteRut || 'paciente'}.pdf`)
  },
}
