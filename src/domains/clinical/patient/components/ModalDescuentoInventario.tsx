import React, { memo, useState } from 'react'
import { AlertTriangle, Package, Lightbulb } from 'lucide-react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'

export interface MaterialInventarioDisponible {
  itemId: string | number
  nombreInsumo: string
  unidad: string
  stockActual: number
  cantidad: number | string
}

export interface MaterialSeleccionado {
  itemId: string | number
  nombreInsumo: string
  unidad: string
  stockActual: number
  cantidad: number
  seleccionado: boolean
}

export interface ItemTratamientoInventario {
  prestacion?: string
  pieza?: string | number
  [key: string]: unknown
}

export interface ModalDescuentoInventarioProps {
  item: ItemTratamientoInventario
  categoria: string
  materialesDisponibles: MaterialInventarioDisponible[]
  alConfirmar: (materialesSeleccionados: MaterialSeleccionado[]) => void
  alCancelar: () => void
}

export const ModalDescuentoInventario: React.FC<ModalDescuentoInventarioProps> = memo(({
  item,
  categoria,
  materialesDisponibles,
  alConfirmar,
  alCancelar
}) => {
  // Estado local: cada material con checkbox de selección y cantidad editable
  const [seleccion, setSeleccion] = useState<MaterialSeleccionado[]>(() => 
    materialesDisponibles.map(m => ({
      ...m,
      cantidad: typeof m.cantidad === 'number' ? m.cantidad : (parseFloat(String(m.cantidad)) || 0),
      seleccionado: true,
    }))
  )

  const handleToggleSeleccion = (index: number): void => {
    setSeleccion(prev => prev.map((s, i) => 
      i === index ? { ...s, seleccionado: !s.seleccionado } : s
    ))
  }

  const handleCambiarCantidad = (index: number, nuevaCantidad: string): void => {
    const cantidadValida = Math.max(0, parseFloat(nuevaCantidad) || 0)
    setSeleccion(prev => prev.map((s, i) => 
      i === index ? { ...s, cantidad: cantidadValida } : s
    ))
  }

  const materialesSeleccionados = seleccion.filter(s => s.seleccionado)
  const hayMaterialesSeleccionados = materialesSeleccionados.length > 0

  return (
    <Modal isOpen={true} onClose={alCancelar} title="Marcar Tratamiento como Realizado" size="xl">
      <div className="space-y-1 mb-4 text-xs">
        <p className="text-gray-700 dark:text-graphite-300">
          <strong>Tratamiento:</strong> {item.prestacion}
        </p>
        <p className="text-gray-700 dark:text-graphite-300">
          <strong>Pieza:</strong> {item.pieza}
        </p>
        <p className="text-gray-700 dark:text-graphite-300">
          <strong>Categoría detectada:</strong> {categoria}
        </p>
      </div>

      {materialesDisponibles.length === 0 ? (
        <div className="text-center py-8 bg-amber-50 rounded-xl border border-amber-200">
          <p className="text-amber-900 font-semibold">
            <span className="inline-flex items-center gap-1"><AlertTriangle size={14} />No hay materiales configurados para la categoría "{categoria}".</span>
          </p>
          <p className="text-amber-700 mt-2">
            Puedes configurar las asociaciones en el módulo Inventario → "Configurar Asociaciones Tratamiento-Material".
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <span className="font-bold text-gray-800 dark:text-graphite-100 text-xs uppercase block">
            <span className="inline-flex items-center gap-1"><Package size={14} />Selecciona los materiales utilizados en esta sesión:</span>
          </span>

          {seleccion.map((material, index) => {
            const stockDespues = Math.max(0, material.stockActual - material.cantidad)
            const descuentoExcedeStock = material.cantidad > material.stockActual

            return (
              <div
                key={index}
                className={`p-3 border rounded-xl transition-all ${
                  material.seleccionado 
                    ? 'bg-emerald-50 border-emerald-300' 
                    : 'bg-gray-50 dark:bg-graphite-800 border-gray-200 dark:border-graphite-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={material.seleccionado}
                    onChange={() => handleToggleSeleccion(index)}
                    className="mt-1 w-4 h-4 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-gray-900 dark:text-graphite-50 block">{material.nombreInsumo}</span>
                    <span className="text-gray-600 dark:text-graphite-400 text-[10px]">
                      Stock actual: {material.stockActual} {material.unidad} → Después: {stockDespues} {material.unidad}
                    </span>
                    
                    {descuentoExcedeStock && material.seleccionado && (
                      <span className="block text-red-600 font-bold text-[10px] mt-1">
                        <span className="inline-flex items-center gap-1"><AlertTriangle size={14} />La cantidad excede el stock disponible. Se descontará hasta 0.</span>
                      </span>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-gray-600 dark:text-graphite-400 font-semibold">Cantidad:</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={material.cantidad}
                        onChange={(e) => handleCambiarCantidad(index, e.target.value)}
                        disabled={!material.seleccionado}
                        className={`p-1.5 border rounded-lg w-24 font-bold ${
                          material.seleccionado 
                            ? 'bg-white dark:bg-graphite-800 border-gray-300 dark:border-graphite-600' 
                            : 'bg-gray-100 dark:bg-graphite-800 border-gray-200 dark:border-graphite-700 text-gray-400 dark:text-graphite-500'
                        }`}
                      />
                      <span className="text-gray-500 dark:text-graphite-400">{material.unidad}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          <div className="bg-gray-100 dark:bg-graphite-800 p-3 rounded-xl border">
            <span className="font-bold text-gray-800 dark:text-graphite-100 text-xs">
              Resumen: {materialesSeleccionados.length} material(es) seleccionado(s)
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-3 border-t">
        <Button
          onClick={alCancelar}
          variant="ghost"
          fullWidth
        >
          Cancelar Descuento (Marcar Realizado sin descontar)
        </Button>
        <Button
          onClick={() => alConfirmar(materialesSeleccionados)}
          disabled={!hayMaterialesSeleccionados}
          variant="primary"
          fullWidth
        >
          Confirmar y Descontar
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900">
        <strong className="inline-flex items-center gap-1"><Lightbulb size={12} />Tip:</strong> "Cancelar Descuento" marca el tratamiento como Realizado pero no descuenta stock. 
        Úsalo si los materiales ya estaban descontados o si prefieres ajustar el inventario manualmente.
      </div>
    </Modal>
  )
})

ModalDescuentoInventario.displayName = 'ModalDescuentoInventario'
