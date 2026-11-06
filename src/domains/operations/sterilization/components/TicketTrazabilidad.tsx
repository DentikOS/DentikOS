import React, { memo } from 'react'
import { Tag, Printer } from 'lucide-react'
import type { CargaEsterilizacion } from '../constants/esterilizacionConstants'

export interface TicketTrazabilidadProps {
  carga: CargaEsterilizacion | null
  alCerrar: () => void
}

export const TicketTrazabilidad = memo<TicketTrazabilidadProps>(({ carga, alCerrar }) => {
  if (!carga) return null

  return (
    <div className="bg-gray-50 dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-6 space-y-4 text-xs">
      <div className="flex justify-between items-center print:hidden border-b pb-3">
        <h4 className="font-bold text-sm text-gray-900 dark:text-graphite-50 inline-flex items-center gap-2">
          <Tag size={16} />Detalle de ciclo de esterilización
        </h4>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="bg-black text-white px-3 py-1.5 rounded-xl font-bold hover:bg-gray-800 transition-colors duration-150"
          >
            <span className="inline-flex items-center gap-1"><Printer size={12} />Imprimir detalle</span>
          </button>
          <button
            onClick={alCerrar}
            className="bg-gray-200 dark:bg-graphite-700 text-gray-800 dark:text-graphite-100 px-3 py-1.5 rounded-xl font-bold hover:bg-gray-300 transition-colors duration-150"
          >
            Cerrar
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-graphite-800 border-2 border-dashed border-black p-4 rounded-xl max-w-sm mx-auto space-y-2 font-mono text-[11px] text-gray-900 dark:text-graphite-50">
        <div className="text-center border-b border-black pb-2">
          <h2 className="font-black text-sm uppercase">DentikOS</h2>
          <p className="text-[9px] font-bold">REGISTRO SINCRONIZADO DE CICLO</p>
        </div>

        <div className="space-y-1 pt-1">
          <p><span className="font-black">CÓDIGO LOTE:</span> <strong className="bg-gray-100 dark:bg-graphite-800 px-1 border">{carga.lote}</strong></p>
          <p><span className="font-bold">FECHA:</span> {carga.fecha} - {carga.hora} hrs</p>
          <p><span className="font-bold">EQUIPO:</span> {carga.equipo}</p>
          <p><span className="font-bold">MEDICIONES OBSERVADAS:</span> {carga.temperatura === null ? 'Sin temperatura' : `${carga.temperatura} °C`} / {carga.tiempoMinutos === null ? 'Sin duración' : `${carga.tiempoMinutos} min`} / {carga.presion === null ? 'Sin presión' : `${carga.presion} Bar`}</p>
          <p><span className="font-bold">OPERADOR:</span> {carga.responsable}</p>
          <p><span className="font-bold">INDICADORES REGISTRADOS:</span> {carga.indicadorQuimico}</p>
          <p><span className="font-bold">CONTROL BIOLÓGICO:</span> {carga.indicadorBiologico}</p>
          <p><span className="font-bold">ESTADO:</span> <strong className="text-emerald-800">{carga.estado}</strong></p>
        </div>

        <div className="border-t border-black pt-2 text-[9px] text-center text-gray-600 dark:text-graphite-400">
          Copia informativa del registro sincronizado en DentikOS.
        </div>
      </div>
    </div>
  )
})

TicketTrazabilidad.displayName = 'TicketTrazabilidad'
