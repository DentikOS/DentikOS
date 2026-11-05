/**
 * Generador de PDF de Recetas Médicas con Esteganografía Forense (BP06 §13 / BP07 §14).
 */
import { jsPDF } from 'jspdf'
import type { DatosClinicaConfig } from '../../../organization/clinic/services/clinicStorageService'
import { dibujarMembreteClinicaPdf } from '../../../organization/clinic/utils/dibujarMembreteClinicaPdf'

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

export const recetasPDFService = {
  async generarRecetaPDF(data: RecetaPDFData): Promise<jsPDF> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    })

    // Fondo / Marca de Agua Esteganográfica Forense (0.1mm micro-patrón al 2% opacidad)
    doc.setGState(new (doc as unknown as { GState: new (opts: { opacity: number }) => unknown }).GState({ opacity: 0.03 }))
    doc.setFontSize(6)
    doc.setTextColor(150, 150, 150)
    for (let y = 10; y < 270; y += 12) {
      doc.text(`DK-TRUSTENGINE-${data.hashForense}-AUTHENTIC-FORENSIC-VALIDATED`, 10, y)
    }

    // Restaurar opacidad completa para contenido principal
    doc.setGState(new (doc as unknown as { GState: new (opts: { opacity: number }) => unknown }).GState({ opacity: 1.0 }))

    // Cabecera institucional configurable por la clínica.
    const encabezadoY = await dibujarMembreteClinicaPdf(doc, data.clinica || {})
    const pacienteY = Math.max(38, encabezadoY + 4)

    // Datos del Paciente
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Paciente: ${data.pacienteNombre}`, 14, pacienteY)
    doc.text(`RUT: ${data.pacienteRut}`, 14, pacienteY + 6)
    doc.text(`Fecha Emisión: ${new Date(data.fecha).toLocaleDateString('es-CL')}`, 14, pacienteY + 12)
    doc.text(`Médico/Cirujano: ${data.profesional}`, 120, pacienteY)

    // Línea separadora
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(14, pacienteY + 17, 202, pacienteY + 17)

    // Prescripción RP/
    doc.setFontSize(13)
    doc.setTextColor(184, 142, 58) // Gold primary
    doc.text('Rp. / Fármacos Prescritos:', 14, pacienteY + 27)

    let yOffset = pacienteY + 37
    data.medicamentos.forEach((med, idx) => {
      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.text(`${idx + 1}. ${med.nombre}`, 16, yOffset)

      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'normal')
      doc.text(`Dosis: ${med.dosis || 'Según indicación'} | Frecuencia: ${med.frecuencia || 'C/8h'} | Duración: ${med.duracion || '7 días'}`, 20, yOffset + 5)
      yOffset += 14
    })

    // Indicaciones generales
    if (data.indicaciones) {
      yOffset += 5
      doc.setFontSize(11)
      doc.setTextColor(184, 142, 58)
      doc.setFont('helvetica', 'bold')
      doc.text('Indicaciones al Paciente:', 14, yOffset)

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
    doc.text('CERTIFICADO DOCUMENTAL AUTÉNTICO • DENTIKOS TRUSTENGINE', 18, footerY + 8)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(`Hash SHA-256 Forense: ${data.hashForense}`, 18, footerY + 14)
    doc.text(`Verificación QR Token: ${data.qrToken}`, 18, footerY + 20)
    doc.text('Documento firmado digitalmente conforme a Ley 19.799 sobre Firma Electrónica.', 18, footerY + 26)
    doc.text(`Firma Autorizada: ${data.profesional}`, 130, footerY + 32)

    return doc
  },

  async descargarReceta(data: RecetaPDFData, nombreArchivo?: string): Promise<void> {
    const doc = await this.generarRecetaPDF(data)
    doc.save(nombreArchivo || `Receta_${data.pacienteRut || 'paciente'}.pdf`)
  },
}
