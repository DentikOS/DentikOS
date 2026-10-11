import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import type { ItemPresupuesto } from '../../schemas/presupuestoSchema'

interface ModalPresupuestoItemsViewProps {
  vista: 'simplificada' | 'detallada'
  items: ItemPresupuesto[]
  onAgregarItem: (fase?: ItemPresupuesto['faseClinica']) => void
  onEliminarItem: (id: string | number) => void
  onUpdateItem: (id: string | number, campo: keyof ItemPresupuesto, valor: unknown) => void
}

export const ModalPresupuestoItemsView: React.FC<ModalPresupuestoItemsViewProps> = ({
  vista,
  items,
  onAgregarItem,
  onEliminarItem,
  onUpdateItem,
}) => {
  if (vista === 'simplificada') {
    return (
      <div className="space-y-3" data-testid="presupuesto-vista-simplificada">
        {(['urgencias', 'estabilizacion', 'rehabilitacion', 'estetica'] as const).map((fase) => {
          const itemsFase = items.filter((it) => it.faseClinica === fase)
          const subtotalFase = itemsFase.reduce((s, it) => s + it.subtotal, 0)
          return (
            <div key={fase} className="p-3.5 bg-surface-hover/50 border border-surface rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-graphite-700 dark:text-graphite-300">
                  Fase {fase} ({itemsFase.length} prestaciones)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-primary">${subtotalFase.toLocaleString('es-CL')}</span>
                  <button type="button" onClick={() => onAgregarItem(fase)} className="text-xs text-primary hover:underline font-semibold">+ Agregar</button>
                </div>
              </div>
              {itemsFase.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-xs py-1 text-graphite-600 dark:text-graphite-400">
                  <span>{it.nombrePrestacion}</span>
                  <span>${it.subtotal.toLocaleString('es-CL')}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-2.5" data-testid="presupuesto-vista-detallada">
      {items.map((it) => (
        <div key={it.id} className="grid grid-cols-12 gap-2 items-center p-2.5 bg-surface border border-surface rounded-xl text-xs">
          <div className="col-span-5">
            <input type="text" value={it.nombrePrestacion} onChange={(e) => onUpdateItem(it.id, 'nombrePrestacion', e.target.value)} className="w-full p-1.5 bg-surface border border-surface rounded-lg text-xs" />
          </div>
          <div className="col-span-2">
            <input type="number" value={it.precioUnitario} onChange={(e) => onUpdateItem(it.id, 'precioUnitario', Number(e.target.value))} className="w-full p-1.5 bg-surface border border-surface rounded-lg text-xs font-mono" />
          </div>
          <div className="col-span-2">
            <input type="number" value={it.cantidad} onChange={(e) => onUpdateItem(it.id, 'cantidad', Number(e.target.value))} className="w-full p-1.5 bg-surface border border-surface rounded-lg text-xs font-mono" />
          </div>
          <div className="col-span-2 text-right font-mono font-bold text-primary">${it.subtotal.toLocaleString('es-CL')}</div>
          <div className="col-span-1 text-center">
            <button type="button" onClick={() => onEliminarItem(it.id)} className="text-graphite-400 hover:text-rose-500" aria-label="Eliminar item">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={() => onAgregarItem()}>Agregar Item</Button>
    </div>
  )
}
