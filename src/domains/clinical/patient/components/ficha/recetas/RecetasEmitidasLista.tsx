import React from 'react'
import { QrCode } from 'lucide-react'

export interface RecetaEmitidaItem {
  id: string
  fecha: string
  profesional: string
  medicamentos: Array<{ nombre: string; dosis: string }>
  hashForense: string
  qrToken: string
}

interface RecetasEmitidasListaProps {
  recetas: RecetaEmitidaItem[]
}

export const RecetasEmitidasLista: React.FC<RecetasEmitidasListaProps> = ({ recetas }) => {
  if (recetas.length === 0) return null

  return (
    <div className="space-y-3" data-testid="recetas-emitidas-lista">
      <h4 className="text-xs font-bold text-graphite-500 uppercase tracking-wider">
        Recetas Electrónicas Emitidas ({recetas.length})
      </h4>
      {recetas.map((rx) => (
        <div
          key={rx.id}
          className="p-4 bg-surface/90 border border-surface rounded-2xl flex items-center justify-between gap-4 shadow-xs"
        >
          <div>
            <span className="text-xs font-bold text-graphite-900 dark:text-graphite-50">
              {rx.medicamentos.map((m) => `${m.nombre} ${m.dosis}`).join(', ')}
            </span>
            <p className="text-[11px] text-graphite-500 mt-1">
              Emitida por: {rx.profesional} &bull; {new Date(rx.fecha).toLocaleDateString()}
            </p>
            <p className="text-[10px] font-mono text-primary mt-0.5">
              Forense: {rx.hashForense}
            </p>
          </div>

          <div className="p-2 rounded-xl bg-surface-hover border border-surface flex items-center gap-2">
            <QrCode className="w-7 h-7 text-graphite-700 dark:text-graphite-200" />
          </div>
        </div>
      ))}
    </div>
  )
}
