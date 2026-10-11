import React, { useState, useEffect, useRef } from 'react'
import { Camera, Image as ImageIcon, Upload, Calendar, Trash2, Eye, Filter, Sparkles, X } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import { fichasClinicasStorageService } from '../../../services/fichasClinicasStorageService'
import type { Paciente } from '../../../schemas/pacienteSchema'

export type TipoAdjunto = 'intraoral' | 'extraoral' | 'periapical' | 'panoramica' | 'cbct'

export interface AdjuntoItem {
  id: string
  titulo: string
  tipo: TipoAdjunto
  fecha: string
  dataUrl: string
  notas?: string
}

const TIPOS_LABELS: Record<TipoAdjunto, string> = {
  intraoral: 'Foto Intraoral',
  extraoral: 'Foto Extraoral',
  periapical: 'RX Periapical',
  panoramica: 'RX Panorámica',
  cbct: 'Tomografía CBCT',
}

interface AdjuntosSectionProps {
  paciente: Paciente
  pacienteId?: string
}

export const AdjuntosSection: React.FC<AdjuntosSectionProps> = ({ paciente, pacienteId }) => {
  const pId = String(pacienteId || paciente.id || '')
  const [adjuntos, setAdjuntos] = useState<AdjuntoItem[]>([])
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoAdjunto>('intraoral')
  const [titulo, setTitulo] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [previewItem, setPreviewItem] = useState<AdjuntoItem | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!pId) return
    fichasClinicasStorageService.obtenerFichaClinica(pId).then((ficha) => {
      if (ficha?.adjuntos && Array.isArray(ficha.adjuntos)) {
        setAdjuntos(ficha.adjuntos as AdjuntoItem[])
      }
    })
  }, [pId])

  const comprimirArchivo = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new window.Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ratio = Math.min(1, 1000 / Math.max(img.width, img.height))
          canvas.width = Math.round(img.width * ratio)
          canvas.height = Math.round(img.height * ratio)
          canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.8))
        }
        img.onerror = () => resolve((e.target?.result as string) || '')
        img.src = (e.target?.result as string) || ''
      }
      reader.readAsDataURL(file)
    })

  const handleSubirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const dataUrl = await comprimirArchivo(file)
    const nuevo: AdjuntoItem = {
      id: crypto.randomUUID(),
      titulo: titulo.trim() || `${TIPOS_LABELS[tipoSeleccionado]} - ${new Date().toLocaleDateString()}`,
      tipo: tipoSeleccionado,
      fecha: new Date().toISOString(),
      dataUrl,
    }

    const nuevos = [nuevo, ...adjuntos]
    setAdjuntos(nuevos)
    setTitulo('')
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (pId) {
      await fichasClinicasStorageService.guardarSeccionFicha(pId, 'adjuntos', nuevos)
    }
  }

  const handleEliminar = async (id: string) => {
    const filtrados = adjuntos.filter((a) => a.id !== id)
    setAdjuntos(filtrados)
    if (pId) {
      await fichasClinicasStorageService.guardarSeccionFicha(pId, 'adjuntos', filtrados)
    }
  }

  const itemsVisibles = filtroTipo === 'todos' ? adjuntos : adjuntos.filter((a) => a.tipo === filtroTipo)

  return (
    <div className="space-y-6" data-testid="adjuntos-section">
      <div className="p-5 bg-surface/90 border border-surface rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
              Módulo de Fotografías & Radiografías Clínicas (BP06 §07)
            </h3>
          </div>
          <span className="text-[11px] text-graphite-500 font-medium flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Compresión Automática & Vault Seguro
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-graphite-700 dark:text-graphite-300 mb-1">
              Categoría Clínica
            </label>
            <select
              value={tipoSeleccionado}
              onChange={(e) => setTipoSeleccionado(e.target.value as TipoAdjunto)}
              className="w-full p-2 bg-surface border border-surface rounded-xl text-xs"
              data-testid="select-tipo-adjunto"
            >
              {(Object.keys(TIPOS_LABELS) as TipoAdjunto[]).map((k) => (
                <option key={k} value={k}>{TIPOS_LABELS[k]}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-5">
            <label className="block text-xs font-semibold text-graphite-700 dark:text-graphite-300 mb-1">
              Descripción / Piezas
            </label>
            <input
              type="text"
              placeholder="Ej: Control post-exodoncia 4.8 o Bite-wing"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full p-2 bg-surface border border-surface rounded-xl text-xs"
              data-testid="input-titulo-adjunto"
            />
          </div>

          <div className="sm:col-span-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleSubirArchivo}
              accept="image/*"
              className="hidden"
              data-testid="file-input-adjunto"
            />
            <Button
              type="button"
              variant="primary"
              icon={Upload}
              className="w-full justify-center"
              onClick={() => fileInputRef.current?.click()}
            >
              Subir Imagen
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h4 className="text-xs font-bold text-graphite-500 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-4 h-4" /> Timeline de Adjuntos ({itemsVisibles.length})
        </h4>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
          <span className="text-graphite-400 text-[11px] flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" /> Filtrar:
          </span>
          {['todos', 'intraoral', 'extraoral', 'periapical', 'panoramica', 'cbct'].map((f) => (
            <button
              key={f}
              onClick={() => setFiltroTipo(f)}
              className={`px-2.5 py-1 rounded-lg text-xs capitalize whitespace-nowrap transition-all ${
                filtroTipo === f ? 'bg-primary text-white font-semibold' : 'bg-surface hover:bg-surface-hover text-graphite-600'
              }`}
            >
              {f === 'todos' ? 'Todos' : f}
            </button>
          ))}
        </div>
      </div>

      {itemsVisibles.length === 0 ? (
        <div className="p-8 text-center bg-surface/50 border border-dashed border-graphite-300 dark:border-graphite-700 rounded-2xl">
          <ImageIcon className="w-8 h-8 text-graphite-400 mx-auto mb-2 opacity-50" />
          <p className="text-xs text-graphite-500">No hay imágenes ni radiografías registradas en este filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="galeria-adjuntos">
          {itemsVisibles.map((item) => (
            <div key={item.id} className="group bg-surface border border-surface rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col">
              <div className="aspect-square bg-graphite-100 dark:bg-graphite-800 relative overflow-hidden">
                <img src={item.dataUrl} alt={item.titulo} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => setPreviewItem(item)} className="p-1.5 bg-white/90 text-graphite-900 rounded-lg hover:bg-white" title="Ver detalle">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleEliminar(item.id)} className="p-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600" title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-2.5 flex-1 flex flex-col justify-between">
                <span className="text-xs font-semibold text-graphite-900 dark:text-graphite-100 truncate block">{item.titulo}</span>
                <div className="flex items-center justify-between text-[10px] text-graphite-400 mt-1">
                  <span className="font-medium text-primary">{TIPOS_LABELS[item.tipo]}</span>
                  <span>{new Date(item.fecha).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-3xl w-full bg-surface rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-3 bg-surface border-b border-surface flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-graphite-900 dark:text-graphite-50">{previewItem.titulo}</h4>
                <p className="text-[10px] text-graphite-400">{TIPOS_LABELS[previewItem.tipo]} &bull; {new Date(previewItem.fecha).toLocaleString()}</p>
              </div>
              <button onClick={() => setPreviewItem(null)} className="p-1 rounded-lg hover:bg-surface-hover" aria-label="Cerrar vista previa">
                <X className="w-5 h-5 text-graphite-500" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[70vh] bg-black/20">
              <img src={previewItem.dataUrl} alt={previewItem.titulo} className="max-h-[65vh] max-w-full object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
