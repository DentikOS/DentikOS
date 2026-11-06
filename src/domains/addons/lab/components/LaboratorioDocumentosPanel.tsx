import React, { useCallback, useEffect, useState } from 'react'
import { Download, Eye, FileText, RefreshCw, Upload } from 'lucide-react'
import { laboratorioTraceabilityService, ETIQUETAS_DOCUMENTO_LABORATORIO, TIPOS_DOCUMENTO_LABORATORIO, type ArchivoLaboratorio, type TipoDocumentoLaboratorio } from '../services/laboratorioTraceabilityService'
import type { OrdenLaboratorio } from '../constants/laboratorioConstants'

export interface LaboratorioDocumentosPanelProps {
  orden: OrdenLaboratorio
  puedeSubir: boolean
  onCambio?: () => void | Promise<void>
}

const tamanoLegible = (bytes: number | null | undefined): string => {
  if (!bytes || bytes < 0) return 'Tamaño no disponible'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const LaboratorioDocumentosPanel: React.FC<LaboratorioDocumentosPanelProps> = ({ orden, puedeSubir, onCambio }) => {
  const [documentos, setDocumentos] = useState<ArchivoLaboratorio[]>([])
  const [tipo, setTipo] = useState<TipoDocumentoLaboratorio>('foto_diseno')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async (): Promise<void> => {
    if (typeof orden.id !== 'string') {
      setDocumentos([])
      setCargando(false)
      return
    }
    setCargando(true)
    setError(null)
    try {
      setDocumentos(await laboratorioTraceabilityService.listarDocumentos(orden.id))
    } catch {
      setError('No se pudieron sincronizar los documentos de esta orden.')
    } finally {
      setCargando(false)
    }
  }, [orden.id])

  useEffect(() => { void recargar() }, [recargar])

  const subir = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!archivo || typeof orden.id !== 'string' || typeof orden.pacienteId !== 'string') return
    setSubiendo(true)
    setError(null)
    try {
      await laboratorioTraceabilityService.subirDocumento({
        ordenId: orden.id,
        pacienteId: orden.pacienteId,
        file: archivo,
        tipoDocumento: tipo,
      })
      setArchivo(null)
      await recargar()
      await onCambio?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo subir el documento.')
    } finally {
      setSubiendo(false)
    }
  }

  const abrir = async (doc: ArchivoLaboratorio): Promise<void> => {
    try {
      await laboratorioTraceabilityService.abrirDocumento(doc)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir el documento.')
    }
  }

  const descargar = async (doc: ArchivoLaboratorio): Promise<void> => {
    try {
      await laboratorioTraceabilityService.descargarDocumento(doc)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo descargar el documento.')
    }
  }

  return (
    <section className="rounded-2xl border border-surface bg-surface p-4 space-y-4" aria-label={`Documentos de ${orden.codigoOrden}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold inline-flex items-center gap-2"><FileText size={16} />Documentos de la orden</h3>
          <p className="mt-1 text-xs text-muted-foreground">Los archivos clínicos se guardan en R2 y se enlazan al paciente y a esta orden.</p>
        </div>
        <button type="button" onClick={() => void recargar()} disabled={cargando} className="rounded-lg border border-surface p-2 disabled:opacity-50" aria-label="Actualizar documentos">
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {puedeSubir && (
        <form onSubmit={(event) => void subir(event)} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-end">
          <label className="space-y-1 text-xs font-medium">
            <span>Tipo de documento</span>
            <select value={tipo} onChange={event => setTipo(event.target.value as TipoDocumentoLaboratorio)} className="w-full min-h-10 rounded-lg border border-surface bg-background px-3">
              {TIPOS_DOCUMENTO_LABORATORIO.map(item => <option value={item} key={item}>{ETIQUETAS_DOCUMENTO_LABORATORIO[item]}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>Archivo</span>
            <input
              type="file"
              accept="application/pdf,image/*,.doc,.docx,.stl"
              onChange={event => setArchivo(event.target.files?.[0] || null)}
              className="block w-full min-h-10 rounded-lg border border-surface bg-background p-2 text-xs"
              required
            />
          </label>
          <button type="submit" disabled={!archivo || subiendo} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            <Upload size={14} />{subiendo ? 'Subiendo…' : 'Subir'}
          </button>
        </form>
      )}

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">{error}</p>}
      {cargando ? <p className="text-xs text-muted-foreground" role="status">Cargando documentos…</p> : documentos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-surface p-5 text-center text-xs text-muted-foreground">Esta orden aún no tiene documentos activos.</p>
      ) : (
        <ul className="divide-y divide-surface">
          {documentos.map(doc => {
            const tipoDocumento = doc.metadata?.tipo_documento
            const label = tipoDocumento ? ETIQUETAS_DOCUMENTO_LABORATORIO[tipoDocumento] : 'Documento'
            return (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{doc.nombre_archivo}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {label} · {tamanoLegible(doc.tamano_bytes)}{doc.created_at ? ` · ${new Date(doc.created_at).toLocaleDateString('es-CL')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => void abrir(doc)} className="inline-flex items-center gap-1 rounded-lg border border-surface px-2.5 py-2 text-[11px] font-medium hover:bg-surface-hover">
                    <Eye size={13} />Ver
                  </button>
                  <button type="button" onClick={() => void descargar(doc)} className="inline-flex items-center gap-1 rounded-lg border border-surface px-2.5 py-2 text-[11px] font-medium hover:bg-surface-hover">
                    <Download size={13} />Descargar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
