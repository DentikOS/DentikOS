import React, { memo, useState, useEffect } from 'react'
import { Image, FileText, Paperclip, X } from 'lucide-react'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import type {
  ArchivoClinicoUI,
  ArchivoVisualizar,
  PermisosArchivos
} from '../hooks/useArchivosClinicos'
import type { ArchivoConId } from '../hooks/useThumbnailCache'

export interface ArchivoViewerProps {
  archivos: ArchivoClinicoUI[]
  cargando: boolean
  tipoArchivo: string
  permisos: PermisosArchivos
  archivoParaVer?: ArchivoVisualizar | null
  thumbnails: Record<string, string>
  cargarThumbnail: (archivo: ArchivoConId) => Promise<string | null>
  onVer: (archivoId: string, mimeType?: string | null, nombreArchivo?: string) => void
  onCerrarModal?: () => void
  onDescargar: (archivoId: string, nombreArchivo: string) => void
  onEliminar: (archivoId: string) => void
}

export const ArchivoViewer: React.FC<ArchivoViewerProps> = memo(({
  archivos,
  cargando,
  tipoArchivo,
  permisos,
  thumbnails,
  cargarThumbnail,
  onVer,
  onDescargar,
  onEliminar,
}) => {
  // Estado de archivos con thumbnail en progreso
  const [cargandoThumbnails, setCargandoThumbnails] = useState<Record<string, boolean>>({})
  const { confirm } = useAppDialog()
  const textosVacios: Record<string, string> = {
    foto: 'No hay fotografías clínicas cargadas todavía.',
    rx: 'No hay radiografías cargadas todavía.',
    consentimiento: 'No hay consentimientos informados cargados todavía.',
  }

  const getMimeType = (archivo: ArchivoClinicoUI): string => {
    return String(archivo.mime_type || archivo.tipo || '')
  }

  const getNombreArchivo = (archivo: ArchivoClinicoUI): string => {
    return String(archivo.nombre_archivo || archivo.nombre || '')
  }

  const getTamano = (archivo: ArchivoClinicoUI): number | undefined => {
    return typeof archivo.tamano_bytes === 'number'
      ? archivo.tamano_bytes
      : typeof archivo.tamano === 'number'
      ? archivo.tamano
      : undefined
  }

  const tituloIcono = (archivo: ArchivoClinicoUI): React.ReactNode => {
    const mime = getMimeType(archivo)
    if (mime.startsWith('image/')) return <Image size={16} className="inline" />
    if (mime === 'application/pdf') return <FileText size={16} className="inline" />
    return <Paperclip size={16} className="inline" />
  }

  const formatearTamano = (bytes?: number): string => {
    if (!bytes && bytes !== 0) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const formatearFecha = (fecha?: string | null): string => {
    if (!fecha) return ''
    try {
      return new Date(fecha).toLocaleDateString('es-CL')
    } catch {
      return ''
    }
  }

  const confirmarEliminar = async (archivo: ArchivoClinicoUI): Promise<void> => {
    const nombre = getNombreArchivo(archivo)
    const ok = await confirm({
      title: 'Eliminar archivo',
      description: `¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmText: 'Eliminar'
    })
    if (ok) {
      onEliminar(archivo.id)
    }
  }

  // Cargar thumbnails de imágenes al cambiar la lista de archivos
  useEffect(() => {
    archivos?.forEach((archivo) => {
      const mime = getMimeType(archivo)
      if (
        mime.startsWith('image/') &&
        !thumbnails[archivo.id] &&
        !cargandoThumbnails[archivo.id]
      ) {
        setCargandoThumbnails((prev) => ({ ...prev, [archivo.id]: true }))
        cargarThumbnail(archivo as unknown as ArchivoConId).finally(() => {
          setCargandoThumbnails((prev) => ({ ...prev, [archivo.id]: false }))
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivos])

  if (cargando) {
    return (
      <p className="text-xs text-gray-400 dark:text-graphite-500 text-center py-8">
        Cargando archivos clínicos…
      </p>
    )
  }

  if (!archivos || archivos.length === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-graphite-500 text-center py-8">
        {textosVacios[tipoArchivo] || 'No hay archivos cargados todavía.'}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {archivos.map((archivo) => {
        const mime = getMimeType(archivo)
        const nombre = getNombreArchivo(archivo)
        const tamano = getTamano(archivo)
        const fecha = archivo.created_at || archivo.fecha

        return (
          <div
            key={archivo.id}
            className="border rounded-xl overflow-hidden bg-gray-50 dark:bg-graphite-800 hover:shadow-md transition-shadow"
          >
            <div className="aspect-video bg-gray-100 dark:bg-graphite-800 flex items-center justify-center overflow-hidden">
              {thumbnails[archivo.id] && mime.startsWith('image/') ? (
                <img
                  src={thumbnails[archivo.id]}
                  alt={nombre}
                  className="w-full h-full object-cover cursor-pointer"
                  title="Click para ampliar"
                  onClick={() => onVer(archivo.id, mime, nombre)}
                />
              ) : (
                <span className="text-4xl" aria-hidden="true">
                  {tituloIcono(archivo)}
                </span>
              )}
            </div>

            <div className="p-3 space-y-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-800 dark:text-graphite-100 truncate" title={nombre}>
                  {nombre}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-graphite-500">
                  {formatearFecha(fecha)} · {formatearTamano(tamano)}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded">
                  R2 sincronizado
                </span>

                <div className="flex items-center gap-2">
                  {permisos?.puedeVer && (
                    <button
                      type="button"
                      onClick={() => onVer(archivo.id, mime, nombre)}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                      title="Ver archivo"
                    >
                      Ver
                    </button>
                  )}

                  {permisos?.puedeDescargar && (
                    <button
                      type="button"
                      onClick={() => onDescargar(archivo.id, nombre)}
                      className="text-xs font-semibold text-gray-700 dark:text-graphite-300 hover:text-black cursor-pointer"
                      title="Descargar archivo"
                    >
                      Descargar
                    </button>
                  )}

                  {permisos?.puedeEliminar && (
                    <button
                      type="button"
                      onClick={() => confirmarEliminar(archivo)}
                      className="text-xs font-bold text-gray-400 dark:text-graphite-500 hover:text-red-600 px-1 cursor-pointer"
                      title="Eliminar archivo"
                      aria-label="Eliminar archivo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
})

ArchivoViewer.displayName = 'ArchivoViewer'
