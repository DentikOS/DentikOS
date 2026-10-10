import React from 'react'
import { Package, AlertCircle, ChevronRight } from 'lucide-react'
import { WidgetBase } from './WidgetBase'

export interface ItemInventarioCritico {
  id: string | number
  nombre: string
  cantidad: number
  minimoCritico: number
  unidad?: string
}

export interface WidgetInventarioCriticoProps {
  items?: ItemInventarioCritico[]
  onIrInventario?: () => void
  dragHandle?: React.ReactNode
}

export const WidgetInventarioCritico: React.FC<WidgetInventarioCriticoProps> = ({
  items = [
    { id: '1', nombre: 'Anestesia Lidocaína 2%', cantidad: 4, minimoCritico: 10, unidad: 'tubos' },
    { id: '2', nombre: 'Guantes de Nitrilo (M)', cantidad: 1, minimoCritico: 5, unidad: 'cajas' },
    { id: '3', nombre: 'Agujas Cortas 30G', cantidad: 0, minimoCritico: 8, unidad: 'cajas' }
  ],
  onIrInventario,
  dragHandle
}) => {
  const hayAgotados = items.some((i) => i.cantidad <= 0)

  return (
    <WidgetBase
      titulo="Inventario Crítico"
      icono={<Package className={`w-4 h-4 ${hayAgotados ? 'text-[#E11D48]' : 'text-[#D97706]'}`} />}
      borderColor={hayAgotados ? '#E11D48' : '#D97706'}
      dragHandle={dragHandle}
      headerAction={
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            hayAgotados
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
          }`}
        >
          {items.length} en reposición
        </span>
      }
      footer={
        <button
          type="button"
          onClick={onIrInventario}
          className="w-full flex items-center justify-center gap-1 font-semibold text-[#B88E3A] hover:underline cursor-pointer"
        >
          Gestionar Stock e Insumos →
        </button>
      }
    >
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">Stock de insumos en niveles óptimos</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const agotado = item.cantidad <= 0
            return (
              <div
                key={item.id}
                onClick={onIrInventario}
                className="flex items-center justify-between p-2.5 rounded-xl bg-surface-muted/40 hover:bg-surface-muted border border-transparent hover:border-amber-500/40 transition-all cursor-pointer group"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate group-hover:text-[#B88E3A] transition-colors">
                    {item.nombre}
                  </p>
                  <p className="text-[11px] text-slate-500">Mínimo sugerido: {item.minimoCritico} {item.unidad || 'uds'}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      agotado
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}
                  >
                    <AlertCircle className="w-3 h-3" />
                    <span>{agotado ? 'Agotado' : `${item.cantidad} ${item.unidad || 'uds'}`}</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#B88E3A]" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </WidgetBase>
  )
}
