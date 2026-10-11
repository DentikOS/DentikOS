import React, { memo, useState, useEffect } from 'react'
import { Settings } from 'lucide-react'
import type { ConvenioConfig } from '../services/finanzasStorageService'

export interface ConveniosManagerProps {
  convenios: ConvenioConfig[]
  onActualizarDescuento: (convenioId: string | number, nuevoDescuento: string | number) => void
}

export const ConveniosManager = memo<ConveniosManagerProps>(({ convenios, onActualizarDescuento }) => {
  const [convenioRecienGuardado, setConvenioRecienGuardado] = useState<string | number | null>(null)

  const handleCambioDescuento = (convenioId: string | number, nuevoValor: string | number): void => {
    onActualizarDescuento(convenioId, nuevoValor)
    setConvenioRecienGuardado(convenioId)
  }

  useEffect(() => {
    if (convenioRecienGuardado) {
      const timer = setTimeout(() => setConvenioRecienGuardado(null), 1500)
      return () => clearTimeout(timer)
    }
  }, [convenioRecienGuardado])

  return (
    <div className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-6 shadow-xs space-y-4 text-xs">
      <div className="border-b pb-2">
        <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 uppercase tracking-wider">
          <span className="inline-flex items-center gap-1"><Settings size={14} />Configuración Global de Convenios & Descuentos</span>
        </h3>
        <p className="text-gray-500 dark:text-graphite-400 text-[11px]">
          Estos porcentajes se aplican automáticamente en el Plan de Tratamiento de la Ficha Clínica.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {convenios.map((c) => (
          <div key={c.id} className="p-4 bg-gray-50 dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-xl space-y-2 flex justify-between items-center">
            <div>
              <span className="font-extrabold text-gray-900 dark:text-graphite-50 text-xs block">{c.nombre}</span>
              <span className="text-[10px] text-gray-500 dark:text-graphite-400 block">{c.descripcion}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={c.descuentoDefecto}
                  onChange={(e) => handleCambioDescuento(c.id, e.target.value)}
                  className="w-16 p-2 border border-gray-300 dark:border-graphite-600 rounded-lg text-center font-black text-sm bg-white dark:bg-graphite-800"
                />
                <span className="font-bold text-gray-700 dark:text-graphite-300">%</span>
              </div>
              {convenioRecienGuardado === c.id && (
                <span className="text-emerald-600 font-bold text-[10px] animate-pulse">
                  Guardado
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

ConveniosManager.displayName = 'ConveniosManager'
