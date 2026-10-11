import React from 'react'
import { Plus, Pill, Trash2 } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import type { Medicamento } from '../../../../../../app/stores/vademecumStore'

export interface MedicamentoItem { nombre: string; dosis: string; frecuencia: string; duracion: string }

interface RecetaMedicamentosFormProps {
  medicamentos: MedicamentoItem[]
  sugerencias: { idx: number; items: Medicamento[] } | null
  onAgregar: () => void
  onEliminar: (idx: number) => void
  onUpdate: (idx: number, campo: keyof MedicamentoItem, valor: string) => void
  onBuscar: (query: string, idx: number) => void
  onSeleccionarSugerencia: (idx: number, m: Medicamento) => void
}

export const RecetaMedicamentosForm: React.FC<RecetaMedicamentosFormProps> = ({
  medicamentos,
  sugerencias,
  onAgregar,
  onEliminar,
  onUpdate,
  onBuscar,
  onSeleccionarSugerencia,
}) => {
  return (
    <>
      <div className="flex items-center justify-between pb-2 border-b border-surface">
        <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50 flex items-center gap-2">
          <Pill className="w-4 h-4 text-primary" /> Prescripción Médica Electrónica con Vademécum
        </h3>
        <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={onAgregar}>
          Agregar Fármaco
        </Button>
      </div>

      <div className="space-y-3">
        {medicamentos.map((med, idx) => (
          <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 rounded-xl bg-surface border border-surface">
            <div className="sm:col-span-4 relative">
              <input
                type="text"
                placeholder="Buscar fármaco en Vademécum..."
                value={med.nombre}
                onChange={(e) => {
                  onUpdate(idx, 'nombre', e.target.value)
                  onBuscar(e.target.value, idx)
                }}
                className="w-full p-2 bg-surface border border-surface rounded-lg text-xs"
                data-testid="input-medicamento-vademecum"
                required
              />
              {sugerencias?.idx === idx && sugerencias.items.length > 0 && (
                <div className="absolute z-20 left-0 right-0 bg-surface border border-surface rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {sugerencias.items.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => onSeleccionarSugerencia(idx, m)}
                      className="p-2 hover:bg-surface-hover text-xs cursor-pointer border-b border-surface/50 last:border-0"
                      data-testid="item-sugerencia-vademecum"
                    >
                      <span className="font-semibold text-graphite-900 dark:text-graphite-100">{m.nombre}</span>
                      {m.presentacion && <span className="text-[11px] text-graphite-400 block">{m.presentacion}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <input type="text" placeholder="Dosis" value={med.dosis} onChange={(e) => onUpdate(idx, 'dosis', e.target.value)} className="w-full p-2 bg-surface border border-surface rounded-lg text-xs" />
            </div>
            <div className="sm:col-span-3">
              <input type="text" placeholder="Frecuencia" value={med.frecuencia} onChange={(e) => onUpdate(idx, 'frecuencia', e.target.value)} className="w-full p-2 bg-surface border border-surface rounded-lg text-xs" />
            </div>
            <div className="sm:col-span-2">
              <input type="text" placeholder="Duración" value={med.duracion} onChange={(e) => onUpdate(idx, 'duracion', e.target.value)} className="w-full p-2 bg-surface border border-surface rounded-lg text-xs" />
            </div>
            <div className="sm:col-span-1 text-center">
              <button type="button" onClick={() => onEliminar(idx)} className="text-graphite-400 hover:text-rose-500" aria-label="Eliminar fármaco">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
