import React, { memo } from 'react'
import { exportService } from '../services/exportService'
import { CreditCard, FileSpreadsheet } from 'lucide-react'
import { formatearImporteDocumento } from '../../../../shared/utils/formatoDocumento'

export interface RendimientoProfesionalesProps {
  recaudacionPorMetodo?: Record<string, number>
  moneda?: string
}

export const RendimientoProfesionales: React.FC<RendimientoProfesionalesProps> = memo(({
  recaudacionPorMetodo = {},
  moneda = 'CLP',
}) => {
  const entradasMetodos = Object.entries(recaudacionPorMetodo)

  return (
    <div className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-5 shadow-xs text-xs space-y-3">
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-graphite-700 pb-2">
        <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 uppercase tracking-wider">
          <span className="inline-flex items-center gap-1">
            <CreditCard size={12} />
            Desglose por Medio de Pago & DTE
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 dark:text-graphite-400 font-semibold">
            Caja & Canales
          </span>
          <button
            onClick={() => exportService.exportarRendimientoExcel(recaudacionPorMetodo, moneda)}
            className="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded font-bold hover:bg-emerald-700 transition-colors"
            aria-label="Exportar rendimiento por método de pago a Excel"
            title="Descargar Excel con desglose por método de pago"
          >
            <span className="inline-flex items-center gap-1">
              <FileSpreadsheet size={14} />
              Excel
            </span>
          </button>
        </div>
      </div>

      {entradasMetodos.length === 0 ? (
        <p className="text-gray-400 dark:text-graphite-500 text-center py-6">
          No hay transacciones registradas.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {entradasMetodos.map(([metodo, monto]) => (
            <div
              key={metodo}
              className="p-3 bg-gray-50 dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-xl flex justify-between items-center"
            >
              <span className="font-bold text-gray-800 dark:text-graphite-100">{metodo}:</span>
              <span className="font-black text-emerald-900">
                {formatearImporteDocumento(monto, moneda)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

RendimientoProfesionales.displayName = 'RendimientoProfesionales'
