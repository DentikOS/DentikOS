import React from 'react'

export interface EstadoOdontogramaDef {
  id: string
  nombre: string
  color: string
  alcance: 'cara' | 'pieza'
}

export const ESTADOS_ODONTOGRAMA: EstadoOdontogramaDef[] = [
  { id: 'sano', nombre: 'Sano / Normal', color: '#FFFFFF', alcance: 'cara' },
  { id: 'caries', nombre: 'Caries Dental', color: '#EF4444', alcance: 'cara' },
  { id: 'obturacion_resina', nombre: 'Obturación Resina', color: '#3B82F6', alcance: 'cara' },
  { id: 'obturacion_amalgama', nombre: 'Obturación Amalgama', color: '#64748B', alcance: 'cara' },
  { id: 'corona', nombre: 'Corona Definitiva', color: '#EAB308', alcance: 'pieza' },
  { id: 'corona_provisoria', nombre: 'Corona Provisoria', color: '#FCD34D', alcance: 'pieza' },
  { id: 'endodoncia', nombre: 'Endodoncia Realizada', color: '#8B5CF6', alcance: 'pieza' },
  { id: 'endodoncia_indicada', nombre: 'Endodoncia Indicada', color: '#C084FC', alcance: 'pieza' },
  { id: 'implante', nombre: 'Implante Oseointegrado', color: '#10B981', alcance: 'pieza' },
  { id: 'ausente', nombre: 'Ausente / Exodoncia', color: '#000000', alcance: 'pieza' },
  { id: 'exodoncia_indicada', nombre: 'Exodoncia Indicada', color: '#DC2626', alcance: 'pieza' },
  { id: 'protesis_fija', nombre: 'Prótesis Fija', color: '#D97706', alcance: 'pieza' },
  { id: 'protesis_removible', nombre: 'Prótesis Removible', color: '#B45309', alcance: 'pieza' },
  { id: 'sellante', nombre: 'Sellante Preventivo', color: '#06B6D4', alcance: 'cara' },
  { id: 'fractura', nombre: 'Fractura Coronaria', color: '#F97316', alcance: 'cara' },
  { id: 'diente_incluido', nombre: 'Diente Incluido', color: '#6B7280', alcance: 'pieza' },
  { id: 'diastema', nombre: 'Diastema', color: '#A855F7', alcance: 'pieza' },
]

interface OdontogramaPanelProps {
  estadoSeleccionado: string
  onSeleccionarEstado: (estadoId: string) => void
}

export const OdontogramaPanel: React.FC<OdontogramaPanelProps> = ({
  estadoSeleccionado,
  onSeleccionarEstado,
}) => {
  return (
    <div
      className="p-3 bg-surface/80 border border-surface rounded-2xl"
      data-testid="odontograma-panel-estados"
    >
      <p className="text-xs font-bold text-graphite-700 dark:text-graphite-300 mb-2">
        17 Estados Clínicos Unificados
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {ESTADOS_ODONTOGRAMA.map((est) => {
          const isActivo = estadoSeleccionado === est.id
          return (
            <button
              key={est.id}
              type="button"
              onClick={() => onSeleccionarEstado(est.id)}
              className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs transition-all border ${
                isActivo
                  ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                  : 'bg-surface border-surface hover:bg-surface-hover text-graphite-700 dark:text-graphite-300'
              }`}
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-graphite-300 shrink-0"
                style={{ backgroundColor: est.color }}
              />
              <span className="truncate">{est.nombre}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
