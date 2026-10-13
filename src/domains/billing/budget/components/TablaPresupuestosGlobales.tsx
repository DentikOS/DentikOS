import React, { memo } from 'react'
import { ESTADOS_PRESUPUESTO } from '../constants/presupuestosConstants'
import { FileText, Trash2, Users } from 'lucide-react'
import type { PresupuestoLocal, PresupuestoItemLocal } from '../services/presupuestosStorageService'

export interface TablaPresupuestosGlobalesProps {
  presupuestos: PresupuestoLocal[]
  onCambiarEstado: (presupuestoId: string | number, nuevoEstado: string) => void
  onVerFichaPaciente: (presupuesto: PresupuestoLocal) => void
  onVerDocumento: (presupuesto: PresupuestoLocal) => void
  onEliminar: (
    presupuestoId: string | number,
    pacienteId: string | number,
    items?: PresupuestoItemLocal[]
  ) => void
  onRegistrarPago?: (presupuesto: PresupuestoLocal) => void
}

export const TablaPresupuestosGlobales: React.FC<TablaPresupuestosGlobalesProps> = memo(({
  presupuestos,
  onCambiarEstado,
  onVerFichaPaciente,
  onVerDocumento,
  onEliminar,
  onRegistrarPago
}) => {
  if (presupuestos.length === 0) {
    return (
      <div className="p-10 text-center text-xs text-graphite-400 dark:text-graphite-500 surgical:text-black bg-surface border border-surface rounded-2xl">
        No hay presupuestos o cotizaciones registradas para el criterio seleccionado.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-surface rounded-2xl overflow-hidden shadow-xs text-xs">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-graphite-950 surgical:bg-graphite-200 border-b border-surface text-graphite-600 dark:text-graphite-300 surgical:text-black font-bold uppercase text-[10px]">
            <th className="p-3">Folio / Paciente</th>
            <th className="p-3">Emisión / Convenio</th>
            <th className="p-3 text-center">Estado Comercial</th>
            <th className="p-3 text-right">Monto Cotizado</th>
            <th className="p-3 text-right">Abonado</th>
            <th className="p-3 text-right">Saldo Pendiente</th>
            <th className="p-3 text-right print:hidden">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface">
          {presupuestos.map((p) => {
            const configEstado =
              ESTADOS_PRESUPUESTO.find((e) => e.id === p.estado) || ESTADOS_PRESUPUESTO[0]
            const montoTotal = parseFloat(String(p.montoTotal ?? 0)) || 0
            const montoAbonado = parseFloat(String(p.montoAbonado ?? 0)) || 0
            const saldo = Math.max(0, montoTotal - montoAbonado)

            return (
              <tr
                key={String(p.id)}
                className="hover:bg-slate-50 dark:hover:bg-graphite-800/50 surgical:hover:bg-graphite-200 transition-colors"
              >
                <td className="p-3">
                  <span className="bg-slate-100 dark:bg-graphite-800 surgical:bg-graphite-200 px-2 py-0.5 rounded border border-surface font-mono text-[11px] font-bold block w-max tabular-nums text-graphite-800 dark:text-graphite-200 surgical:text-black">
                    {p.folio}
                  </span>
                  <span className="font-extrabold text-graphite-900 dark:text-graphite-50 surgical:text-black block mt-1">
                    {p.pacienteNombre}
                  </span>
                  <span className="text-[10px] text-graphite-500 dark:text-graphite-400 surgical:text-black tabular-nums">
                    RUT: {p.pacienteRut}
                  </span>
                </td>

                <td className="p-3">
                  <span className="font-semibold text-graphite-800 dark:text-graphite-100 surgical:text-black block tabular-nums">
                    {p.fechaEmision}
                  </span>
                  <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 font-bold text-[10px] inline-block mt-0.5">
                    {p.convenio || 'Particular'}
                  </span>
                </td>

                <td className="p-3 text-center">
                  <select
                    value={p.estado}
                    onChange={(e) => onCambiarEstado(p.id, e.target.value)}
                    className={`px-2 py-1 rounded-lg font-bold text-[10px] border bg-surface cursor-pointer ${configEstado.colorText} ${configEstado.colorBorder}`}
                  >
                    {ESTADOS_PRESUPUESTO.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-3 text-right font-black text-graphite-900 dark:text-graphite-50 surgical:text-black tabular-nums">
                  ${montoTotal.toLocaleString('es-CL')} CLP
                </td>

                <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400 surgical:text-black tabular-nums">
                  ${montoAbonado.toLocaleString('es-CL')} CLP
                </td>

                <td className="p-3 text-right font-black text-red-600 dark:text-red-400 surgical:text-black tabular-nums">
                  ${saldo.toLocaleString('es-CL')} CLP
                </td>

                <td className="p-3 text-right print:hidden space-x-1 whitespace-nowrap">
                  {(p.estado === 'en-curso' || p.estado === 'EnTratamiento' || p.estado === 'Aprobado') && onRegistrarPago && (
                    <button
                      type="button"
                      onClick={() => onRegistrarPago(p)}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-micro cursor-pointer"
                      title="Registrar pago"
                      data-testid={`btn-registrar-pago-${p.id}`}
                    >
                      Registrar pago
                    </button>
                  )}
                  <button
                    onClick={() => onVerDocumento(p)}
                    className="p-1.5 bg-primary hover:bg-champagne-600 dark:bg-gold-satin dark:hover:bg-primary text-white dark:text-graphite-950 surgical:bg-black surgical:text-white text-[10px] font-bold rounded-lg transition-micro cursor-pointer"
                    title="Imprimir Documento Cotización"
                  >
                    <span className="inline-flex items-center gap-1">
                      <FileText size={10} />Ver PDF
                    </span>
                  </button>

                  <button
                    onClick={() => onVerFichaPaciente(p)}
                    className="p-1.5 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-bold rounded-lg hover:bg-sky-100 transition-micro cursor-pointer"
                    title="Ir a Ficha Clínica"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Users size={10} />Ficha
                    </span>
                  </button>

                  <button
                    onClick={() => p.pacienteId && onEliminar(p.id, p.pacienteId, p.items as PresupuestoItemLocal[] | undefined)}
                    className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-micro cursor-pointer"
                    title="Eliminar presupuesto"
                  >
                    <Trash2 size={12} />
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

TablaPresupuestosGlobales.displayName = 'TablaPresupuestosGlobales'
