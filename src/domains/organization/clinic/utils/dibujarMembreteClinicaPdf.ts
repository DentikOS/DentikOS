import type { jsPDF } from 'jspdf'
import type { DatosClinicaConfig } from '../services/clinicStorageService'
import { normalizarConfiguracionMembrete } from '../schemas/configuracionMembreteSchema'

type ImagenMembrete = { dataUrl: string; width: number; height: number }

const colorRgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]

const obtenerImagenMembrete = async (url?: string, monocromatico = false): Promise<ImagenMembrete | null> => {
  if (!url || typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return null

  let blob: Blob
  try {
    if (url.startsWith('data:image/')) {
      const respuesta = await fetch(url, { credentials: 'omit' })
      if (!respuesta.ok) return null
      blob = await respuesta.blob()
    } else {
      const urlSegura = new URL(url)
      if (urlSegura.protocol !== 'https:') return null
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 2500)
      try {
        const respuesta = await fetch(urlSegura.toString(), {
          mode: 'cors',
          credentials: 'omit',
          signal: controller.signal,
        })
        if (!respuesta.ok) return null
        const tipo = respuesta.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(tipo || '')) return null
        blob = await respuesta.blob()
      } finally {
        window.clearTimeout(timeout)
      }
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type.toLowerCase()) || blob.size === 0 || blob.size > 5 * 1024 * 1024) return null
    const imagen = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = imagen.width
    canvas.height = imagen.height
    const contexto = canvas.getContext('2d')
    if (!contexto) {
      imagen.close()
      return null
    }
    if (monocromatico) contexto.filter = 'grayscale(1)'
    contexto.drawImage(imagen, 0, 0)
    imagen.close()
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
  } catch {
    return null
  }
}

const agregarLogo = (doc: jsPDF, imagen: ImagenMembrete, x: number, y: number, maxW: number, maxH: number) => {
  const escala = Math.min(maxW / imagen.width, maxH / imagen.height)
  const ancho = imagen.width * escala
  const alto = imagen.height * escala
  doc.addImage(imagen.dataUrl, 'PNG', x + (maxW - ancho) / 2, y + (maxH - alto) / 2, ancho, alto)
}

/** Dibuja el mismo membrete configurable usado en las vistas imprimibles React. */
export const dibujarMembreteClinicaPdf = async (doc: jsPDF, clinica: DatosClinicaConfig): Promise<number> => {
  const configuracion = normalizarConfiguracionMembrete(clinica.configuracionMembrete)
  const anchoPagina = doc.internal.pageSize.getWidth()
  const margen = 14
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, anchoPagina, 40, 'F')
  const logoUrl = configuracion.mostrar.logo ? clinica.logoUrl : undefined
  const imagen = await obtenerImagenMembrete(logoUrl, configuracion.logoMonocromatico)
  const nombre = configuracion.mostrar.nombre ? clinica.nombreClinica?.trim() || '' : ''
  const datos = [
    configuracion.mostrar.rut ? clinica.rutClinica : '',
    configuracion.mostrar.direccion ? [clinica.direccion, clinica.comuna || clinica.ciudad, clinica.region].filter(Boolean).join(', ') : '',
    configuracion.mostrar.telefono ? clinica.telefono : '',
    configuracion.mostrar.email ? clinica.emailContacto : '',
    configuracion.mostrar.sitioWeb ? clinica.sitioWeb : '',
    configuracion.mostrar.registroSeremi ? clinica.registroSeremi : '',
    configuracion.mostrar.registroIsp ? clinica.registroIsp : '',
  ].map((dato) => dato?.trim()).filter((dato): dato is string => Boolean(dato))
  const colorTitulos = colorRgb(configuracion.colorTitulos)
  const colorPrincipal = colorRgb(configuracion.colorPrincipal)
  const colorSecundario = colorRgb(configuracion.colorTextoSecundario)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...colorTitulos)

  if (configuracion.diseno === 'minimalista') {
    const anchoLogo = 16
    if (imagen) agregarLogo(doc, imagen, anchoPagina / 2 - anchoLogo / 2, 4, anchoLogo, 16)
    if (nombre) doc.text(nombre, anchoPagina / 2, imagen ? 25 : 16, { align: 'center', maxWidth: anchoPagina - 2 * margen })
    return imagen || nombre ? 31 : 12
  }

  if (configuracion.diseno === 'moderno') {
    if (imagen) agregarLogo(doc, imagen, anchoPagina / 2 - 8, 3, 16, 15)
    if (nombre) doc.text(nombre, anchoPagina / 2, imagen ? 22 : 14, { align: 'center', maxWidth: anchoPagina - 2 * margen })
    if (datos.length) {
      const texto = doc.splitTextToSize(datos.join(' · '), anchoPagina - 2 * margen).slice(0, 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...colorSecundario)
      doc.text(texto, anchoPagina / 2, nombre ? (imagen ? 27 : 20) : 17, { align: 'center' })
    }
    doc.setDrawColor(...colorRgb(configuracion.colorLinea))
    doc.setLineWidth(0.7)
    doc.line(margen, 35, anchoPagina - margen, 35)
    return 40
  }

  const anchoMaximoTexto = anchoPagina - 2 * margen - (imagen ? 34 : 0)
  const xTexto = margen + (imagen ? 34 : 0)
  if (imagen) agregarLogo(doc, imagen, margen, 5, 27, 20)
  if (nombre) doc.text(nombre, xTexto, 11, { maxWidth: anchoMaximoTexto })
  if (datos.length) {
    const texto = doc.splitTextToSize(datos.join(' · '), anchoMaximoTexto).slice(0, 3)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...colorSecundario)
    doc.text(texto, xTexto, nombre ? 16 : 11)
  }
  doc.setDrawColor(...colorRgb(configuracion.colorLinea))
  doc.setLineWidth(0.7)
  doc.line(margen, 31, anchoPagina - margen, 31)
  doc.setTextColor(...colorPrincipal)
  return 36
}
