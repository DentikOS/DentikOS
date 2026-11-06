import { jsPDF } from 'jspdf'
import { getClinicaActivaSync } from '../../../../../../infrastructure/auth/authService'
import { listaArchivosDePaciente } from '../../../../../../infrastructure/storage/r2ArchivosService'
import type { DatosClinicaConfig } from '../../../../../organization/clinic/services/clinicStorageService'
import { dibujarMembreteClinicaPdf } from '../../../../../organization/clinic/utils/dibujarMembreteClinicaPdf'
import { resolverIdiomaDocumento, traducirEtiquetaDocumento } from '../../../../../../shared/utils/formatoDocumento'
import type { DerivacionClinica } from './derivacionesService'

interface DatosDerivacionPDF {
  pacienteId: string
  pacienteNombre: string
  pacienteRut?: string
  derivacion: DerivacionClinica
  clinica?: DatosClinicaConfig
}

export const derivacionPDFService = {
  async generar({ pacienteId, pacienteNombre, pacienteRut, derivacion, clinica }: DatosDerivacionPDF): Promise<jsPDF> {
    const clinicaId = getClinicaActivaSync()
    if (!clinicaId || !pacienteId || !derivacion.id) throw new Error('No se puede generar la ficha sin clínica y paciente activos.')
    const ids = new Set(derivacion.archivoIds || [])
    const archivos = ids.size ? await listaArchivosDePaciente(pacienteId) : []
    const referenciados = archivos.filter((archivo) => archivo.clinica_id === clinicaId &&
      archivo.paciente_id === pacienteId && ids.has(archivo.id))
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const idioma = resolverIdiomaDocumento(clinica?.idiomaDocumentos)
    const etiqueta = (clave: Parameters<typeof traducirEtiquetaDocumento>[1]) => traducirEtiquetaDocumento(idioma, clave)
    const margen = 18
    let y = (await dibujarMembreteClinicaPdf(doc, clinica || {})) + 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(35, 45, 55)
    doc.text(etiqueta('referral'), margen, y)
    y += 10
    const nuevaPagina = (alto: number) => {
      if (y + alto < 273) return
      doc.addPage()
      y = 23
    }
    const linea = (nombreCampo: string, valor: string) => {
      const texto = doc.splitTextToSize(`${nombreCampo}: ${valor || etiqueta('notReported')}`, 174) as string[]
      doc.setFontSize(10)
      doc.setTextColor(35, 45, 55)
      for (const renglon of texto) {
        nuevaPagina(6)
        doc.text(renglon, margen, y)
        y += 5
      }
      y += 4
    }

    doc.setFont('helvetica', 'normal')
    linea(etiqueta('patient'), pacienteNombre)
    linea(etiqueta('rut'), pacienteRut || '')
    linea(etiqueta('issueDate'), new Date(derivacion.fecha).toLocaleString(idioma))
    linea(etiqueta('issuingProfessional'), derivacion.emisor || etiqueta('notReported'))
    linea(etiqueta('destinationSpecialty'), derivacion.especialidad)
    linea(etiqueta('specialistCenter'), derivacion.especialista)
    linea(etiqueta('priority'), derivacion.prioridad === 'urgente' ? etiqueta('urgent') : etiqueta('normal'))
    linea(etiqueta('diagnosis'), derivacion.diagnostico || '')
    linea(etiqueta('reasonFindings'), derivacion.motivo)
    y += 5
    nuevaPagina(14)
    doc.setFont('helvetica', 'bold')
    linea(etiqueta('referencedRecords'), etiqueta('checkCurrentChart'))
    doc.setFont('helvetica', 'normal')
    if (derivacion.incluirOdontograma) linea(etiqueta('section'), etiqueta('currentOdontogram'))
    if (derivacion.incluirEvoluciones) linea(etiqueta('section'), etiqueta('currentEvolutions'))
    for (const archivo of referenciados) linea(etiqueta('file'), `${archivo.categoria}: ${archivo.nombre_archivo}`)
    if (ids.size > referenciados.length) linea(etiqueta('unavailableFiles'), String(ids.size - referenciados.length))
    if (!ids.size && !derivacion.incluirOdontograma && !derivacion.incluirEvoluciones) linea(etiqueta('referencedRecords'), etiqueta('noReferences'))
    nuevaPagina(15)
    y += 6
    doc.setDrawColor(180, 190, 195)
    doc.line(margen, y, 192, y)
    y += 6
    doc.setFontSize(8)
    doc.setTextColor(90, 100, 108)
    doc.text(etiqueta('documentNotice'), margen, y)
    return doc
  },

  async descargar(datos: DatosDerivacionPDF): Promise<void> {
    const doc = await this.generar(datos)
    doc.save(`Derivacion_${datos.derivacion.id}.pdf`)
  },
}
