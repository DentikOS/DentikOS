import React, { memo } from 'react'
import { Ban, PlayCircle, Tag } from 'lucide-react'
import type { CargaEsterilizacion } from '../constants/esterilizacionConstants'

export interface TablaCargasEsterilizacionProps {
  cargas: CargaEsterilizacion[]
  onSeleccionarImprimir: (carga: CargaEsterilizacion) => void
  onCancelar: (id: number | string) => void
  onGestionar: (carga: CargaEsterilizacion) => void
}

export const TablaCargasEsterilizacion = memo<TablaCargasEsterilizacionProps>(({
  cargas,
  onSeleccionarImprimir,
  onCancelar,
  onGestionar
}) => {
  if (cargas.length === 0) {
    return (
      <div className="p-10 text-center text-xs text-gray-400 dark:text-graphite-500 bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl">
        No se encontraron registros de autoclave para los filtros seleccionados.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-surface rounded-2xl overflow-hidden shadow-xs text-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left border-collapse">
          <thead>
            <tr className="bg-graphite-50 dark:bg-graphite-950  border-b border-surface text-gray-700 dark:text-graphite-300  font-bold uppercase text-[10px]">
              <th className="p-3">Código Lote</th>
              <th className="p-3">Fecha / Hora</th>
              <th className="p-3">Equipo Autoclave</th>
              <th className="p-3">Parámetros</th>
              <th className="p-3">Contenido Carga</th>
              <th className="p-3">Indicador Químico</th>
              <th className="p-3 text-center">Estado</th>
              <th className="p-3 text-right print:hidden">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-graphite-800">
            {cargas.map((c) => {
              const esLiberado = c.estado === 'Liberado'
              const esRechazado = c.estado === 'Rechazado' || c.estado.startsWith('Retenido')

              return (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-graphite-800  transition-colors">
                  <td className="p-3 font-black text-gray-900 dark:text-graphite-50 ">
                    <span className="bg-graphite-50 dark:bg-graphite-950  text-gray-900 dark:text-graphite-50  px-2 py-0.5 rounded border border-surface font-mono text-[11px] tabular-nums">{c.lote}</span>
                    <span className="block text-[10px] text-gray-500 dark:text-graphite-400  font-normal mt-0.5">Resp: {c.responsable}</span>
                  </td>

                  <td className="p-3 font-semibold text-gray-700 dark:text-graphite-300  tabular-nums">
                    {c.fecha} <span className="text-gray-400 dark:text-graphite-500  font-normal block">{c.hora} hrs</span>
                  </td>

                  <td className="p-3 font-bold text-gray-800 dark:text-graphite-100 ">{c.equipo}</td>

                  <td className="p-3 tabular-nums">
                    <span className="font-bold text-blue-900 dark:text-sky-300  block">{c.temperatura === null ? '—' : `${c.temperatura}°C`} / {c.presion === null ? '—' : `${c.presion} Bar`}</span>
                    <span className="text-[10px] text-gray-500 dark:text-graphite-400 ">{c.tiempoMinutos === null ? 'Sin medición observada' : `${c.tiempoMinutos} min observados`}</span>
                  </td>

                  <td className="p-3 font-medium text-gray-700 dark:text-graphite-300  max-w-xs truncate" title={c.contenido}>
                    {c.contenido}
                  </td>

                  <td className="p-3">
                    <span className="font-semibold text-gray-800 dark:text-graphite-100 ">{c.indicadorQuimico}</span>
                    <span className="block text-[10px] text-gray-500 dark:text-graphite-400 ">{c.indicadorBiologico}</span>
                  </td>

                  <td className="p-3 text-center">
                    <span className={`px-2.5 py-1 rounded-lg font-extrabold text-[10px] ${
                      esLiberado
                        ? 'bg-clinical-success/15 text-clinical-success dark:text-emerald-300 border border-clinical-success/30'
                        : esRechazado
                          ? 'bg-clinical-error/15 text-clinical-error dark:text-red-300 border border-clinical-error/30'
                          : 'bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-100'
                    }`}>
                      {c.estado.toUpperCase()}
                    </span>
                  </td>

                  <td className="p-3 text-right print:hidden space-x-1">
                    {c.puedeGestionar && <button
                      onClick={() => onGestionar(c)}
                      className="p-1.5 text-primary hover:opacity-80 font-semibold rounded-lg"
                      title="Continuar flujo del ciclo"
                      aria-label={`Continuar ciclo ${c.lote}`}
                    >
                      <PlayCircle size={13} />
                    </button>}
                    <button
                      onClick={() => onSeleccionarImprimir(c)}
                      className="p-1.5 bg-slate-900 dark:bg-gold-solid  text-white dark:text-black  text-[10px] font-bold rounded-lg hover:opacity-90 transition-opacity"
                      title="Imprimir Tique de Trazabilidad"
                    >
                      <span className="inline-flex items-center gap-1"><Tag size={10} />Tique</span>
                    </button>
                    {c.puedeCancelar && <button
                      onClick={() => onCancelar(c.id)}
                      className="p-1.5 text-red-500 hover:text-red-700 font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                      title="Cancelar ciclo con justificación"
                      aria-label={`Cancelar ciclo ${c.lote}`}
                    >
                      <Ban size={12} />
                    </button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
})

TablaCargasEsterilizacion.displayName = 'TablaCargasEsterilizacion'
