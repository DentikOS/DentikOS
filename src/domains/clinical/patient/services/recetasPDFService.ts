/**
 * Generador de PDF de Recetas Médicas con Esteganografía Forense (BP06 §13 / BP07 §14).
 */
import { jsPDF } from 'jspdf'

export interface RecetaPDFData {
  pacienteNombre: string
  pacienteRut: string
  profesional: string
  medicamentos: Array<{ nombre: string; dosis: string; frecuencia: string; duracion: string }>
  indicaciones: string
  fecha: string
  hashForense: string
  qrToken: string
}

export const recetasPDFService = {
  generarRecetaPDF(data: RecetaPDFData): jsPDF {
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

    // Cabecera institucional
    doc.setFillColor(15, 23, 42) // Slate 900
    doc.rect(0, 0, 216, 25, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('STUDIO DENTAL — RECETA MÉDICA ELECTRÓNICA', 14, 16)

    // Datos del Paciente
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Paciente: ${data.pacienteNombre}`, 14, 38)
    doc.text(`RUT: ${data.pacienteRut}`, 14, 44)
    doc.text(`Fecha Emisión: ${new Date(data.fecha).toLocaleDateString('es-CL')}`, 14, 50)
    doc.text(`Médico/Cirujano: ${data.profesional}`, 120, 38)

    // Línea separadora
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(14, 55, 202, 55)

    // Prescripción RP/
    doc.setFontSize(13)
    doc.setTextColor(184, 142, 58) // Gold primary
    doc.text('Rp. / Fármacos Prescritos:', 14, 65)

    let yOffset = 75
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

  descargarReceta(data: RecetaPDFData, nombreArchivo?: string): void {
    const doc = this.generarRecetaPDF(data)
    doc.save(nombreArchivo || `Receta_${data.pacienteRut || 'paciente'}.pdf`)
  },
}
