import React from 'react'
import type { MedicamentoItem } from './RecetaMedicamentosForm'

export interface RecetaEmitidaItem {
  id: string
  fecha: string
  profesional: string
  medicamentos: MedicamentoItem[]
  diagnostico: string | null
  indicaciones: string | null
  firma: string | null
  hashForense: string
  qrToken: string
}

interface RecetasEmitidasListaProps {
  recetas: RecetaEmitidaItem[]
  onVerReceta?: (receta: RecetaEmitidaItem) => void
}

export const RecetasEmitidasLista: React.FC<RecetasEmitidasListaProps> = ({ recetas, onVerReceta }) => {
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
              Emitida por: {rx.profesional} &bull; {new Date(`${rx.fecha}T12:00:00`).toLocaleDateString('es-CL')}
            </p>
            <p className="text-[10px] font-mono text-primary mt-0.5">
              Trazabilidad: {rx.hashForense}
            </p>
            <p className="text-[10px] text-graphite-400 mt-0.5">Sin firma electrónica</p>
          </div>

          <div className="flex items-center gap-2">
            {onVerReceta && (
              <button
                type="button"
                onClick={() => onVerReceta(rx)}
                className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors cursor-pointer"
                data-testid={`btn-ver-receta-${rx.id}`}
              >
                Ver
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
