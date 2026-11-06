import React, { memo } from 'react'
import { ETAPAS_LABORATORIO, type OrdenLaboratorio } from '../constants/laboratorioConstants'
import { FileText } from 'lucide-react'

export interface TablaOrdenesLaboratorioProps {
  ordenes: OrdenLaboratorio[]
  onActualizarEtapa: (idOrden: number | string, nuevaEtapa: string) => void | Promise<void>
  onSeleccionarImprimir: (orden: OrdenLaboratorio) => void
  onSeleccionarDetalle: (orden: OrdenLaboratorio) => void
  puedeCambiarEtapa: boolean
}

export const TablaOrdenesLaboratorio: React.FC<TablaOrdenesLaboratorioProps> = memo(({
  ordenes,
  onActualizarEtapa,
  onSeleccionarImprimir,
  onSeleccionarDetalle,
  puedeCambiarEtapa
}) => {
  if (ordenes.length === 0) {
    return (
      <div className="p-10 text-center text-xs text-gray-400 dark:text-graphite-500 bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl">
        No se encontraron trabajos de laboratorio registrados con los criterios seleccionados.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-surface rounded-2xl overflow-x-auto shadow-xs text-xs">
      <table className="w-full min-w-[920px] text-left border-collapse">
        <thead>
          <tr className="bg-graphite-50 dark:bg-graphite-950  border-b border-surface text-gray-700 dark:text-graphite-300  font-bold uppercase text-[10px]">
            <th className="p-3">Código / Paciente</th>
            <th className="p-3">Trabajo / Pieza</th>
            <th className="p-3">Laboratorio Proveedor</th>
            <th className="p-3">Fechas (Envío / Promesa)</th>
            <th className="p-3 text-center">Etapa Actual</th>
            <th className="p-3 text-right print:hidden">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-graphite-800">
          {ordenes.map((o) => {
            const etapaConfig =
              ETAPAS_LABORATORIO.find((e) => e.id === o.etapa) || ETAPAS_LABORATORIO[0]

            return (
              <tr
                key={o.id}
                className="hover:bg-gray-50 dark:hover:bg-graphite-800  transition-colors"
              >
                <td className="p-3">
                  <span className="bg-graphite-50 dark:bg-graphite-950  text-gray-900 dark:text-graphite-50  px-2 py-0.5 rounded border border-surface font-mono text-[11px] font-bold block w-max tabular-nums">
                    {o.codigoOrden}
                  </span>
                  {o.esReposicion && <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">Reposición</span>}
                  <span className="font-extrabold text-gray-900 dark:text-graphite-50  block mt-1">
                    {o.pacienteNombre}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-graphite-400  tabular-nums">
                    RUT: {o.pacienteRut}
                  </span>
                </td>

                <td className="p-3">
                  <span className="font-bold text-gray-900 dark:text-graphite-50  block">
                    {o.tipoTrabajo}
                  </span>
                  <span className="text-[11px] font-semibold text-blue-900 dark:text-sky-300  block">
                    {o.piezaDientaria}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-graphite-400 ">
                    Color: {o.colorGuia || 'N/I'}
                  </span>
                </td>

                <td className="p-3 font-semibold text-gray-800 dark:text-graphite-100 ">
                  {o.laboratorioNombre}
                </td>

                <td className="p-3 tabular-nums">
                  <span className="text-gray-600 dark:text-graphite-300  block">
                    <strong className="text-gray-800 dark:text-graphite-100 ">
                      Envío:
                    </strong>{' '}
                    {o.fechaEnvio}
                  </span>
                  <span className="text-gray-600 dark:text-graphite-400  block">
                    <strong className="text-emerald-800 dark:text-emerald-300 ">
                      Promesa:
                    </strong>{' '}
                    {o.fechaEntregaPrometida}
                  </span>
                </td>

                <td className="p-3 text-center">
                  <select
                    aria-label={`Etapa de ${o.codigoOrden}`}
                    value={o.etapa}
                    disabled={!puedeCambiarEtapa || o.etapa === 'entrega'}
                    onChange={(e) => void onActualizarEtapa(o.id, e.target.value)}
                    className={`px-2.5 py-1 rounded-xl font-extrabold text-[11px] border bg-white dark:bg-surface   border-surface ${etapaConfig.colorText}`}
                  >
                    {ETAPAS_LABORATORIO.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-3 text-right print:hidden space-x-1">
                  <button
                    type="button"
                    onClick={() => onSeleccionarDetalle(o)}
                    className="p-1.5 border border-surface text-[10px] font-bold rounded-lg hover:bg-surface-hover"
                    title="Ver documentos y garantías"
                  >
                    Ficha
                  </button>
                  <button
                    type="button"
                    onClick={() => onSeleccionarImprimir(o)}
                    className="p-1.5 bg-black text-white text-[10px] font-bold rounded-lg hover:bg-gray-800"
                    title="Imprimir Orden de Trabajo"
                  >
                    <span className="inline-flex items-center gap-1">
                      <FileText size={10} />
                      Orden
                    </span>
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})

TablaOrdenesLaboratorio.displayName = 'TablaOrdenesLaboratorio'
