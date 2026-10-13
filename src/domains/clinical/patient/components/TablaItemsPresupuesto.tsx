import React, { memo } from 'react'
import { formatearCLP } from '../../../../shared/utils/formatoMoneda'
import { Button } from '../../../../shared/ui/ui/Button'
import { X } from 'lucide-react'
import type { ItemPresupuesto } from '../hooks/usePresupuesto'
import type { Paciente } from '../schemas/pacienteSchema'

export interface UserProfilePresupuestoRef {
  nombreCompleto?: string
  especialidad?: string
  rut?: string
  [key: string]: unknown
}

export interface TablaItemsPresupuestoProps {
  itemsPresupuesto: ItemPresupuesto[]
  paciente: Partial<Paciente> & { nombre: string; prevision?: string | null; [key: string]: unknown }
  totalPresupuesto: number
  totalAbonado: number
  saldoPendiente: number
  userProfile?: UserProfilePresupuestoRef
  handleCambiarEstadoItem: (id: string | number, nuevoEstado: string) => void
  handleEliminarItem: (id: string | number) => void
}

export const TablaItemsPresupuesto: React.FC<TablaItemsPresupuestoProps> = memo(({
  itemsPresupuesto,
  paciente,
  totalPresupuesto,
  totalAbonado,
  saldoPendiente,
  userProfile,
  handleCambiarEstadoItem,
  handleEliminarItem
}) => {
  if (itemsPresupuesto.length === 0) {
    return (
      <p className="text-xs text-graphite-500 dark:text-graphite-400 py-6 text-center">
        No has agregado prestaciones al presupuesto de este paciente.
      </p>
    )
  }

  return (
    <div>
      <table className="w-full text-left text-xs mb-6 border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300 dark:border-graphite-600 bg-gray-100 dark:bg-graphite-800 text-graphite-800 dark:text-graphite-100 print:bg-gray-50">
            <th className="p-3">Pieza</th>
            <th className="p-3">Prestación Definida</th>
            <th className="p-3">Convenio</th>
            <th className="p-3 text-center">Estado</th>
            <th className="p-3 text-right">Valor</th>
            <th className="p-3 text-right print:hidden">Acción</th>
          </tr>
        </thead>
        <tbody>
          {itemsPresupuesto.map((item) => (
            <tr key={item.id} className="border-b border-gray-200 dark:border-graphite-700">
              <td className="p-3 font-bold text-graphite-900 dark:text-graphite-100">{item.pieza}</td>
              <td className="p-3 text-graphite-700 dark:text-graphite-300">{item.prestacion}</td>
              <td className="p-3 text-emerald-800 dark:text-emerald-300 font-semibold">
                {item.convenio || paciente.prevision || 'Particular'} {Number(item.descuentoPct || 0) > 0 && `(-${item.descuentoPct}%)`}
              </td>
              <td className="p-3 text-center">
                <select
                  value={item.estado || 'Pendiente'}
                  onChange={(e) => handleCambiarEstadoItem(item.id, e.target.value)}
                  className={`text-[11px] rounded-lg px-2.5 py-1 font-bold border transition-all cursor-pointer print:border-none print:bg-transparent ${
                    item.estado === 'Realizado'
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                      : item.estado === 'En Proceso'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                  }`}
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="Realizado">Realizado</option>
                </select>
              </td>
              <td className="p-3 text-right font-medium text-graphite-900 dark:text-graphite-100">
                {formatearCLP(item.valor)}
              </td>
              <td className="p-3 text-right print:hidden">
                <Button
                  onClick={() => handleEliminarItem(item.id)}
                  variant="ghost"
                  size="sm"
                  className="text-clinical-error hover:text-red-700 cursor-pointer"
                  aria-label="Eliminar item"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t-2 border-black dark:border-graphite-300 pt-4 space-y-1 text-right text-xs">
        <p>
          <span className="text-graphite-600 dark:text-graphite-400">Total Tratamiento:</span>{' '}
          <span className="font-bold dark:text-graphite-100">{formatearCLP(totalPresupuesto)}</span>
        </p>
        <p>
          <span className="text-green-700 dark:text-green-400">Total Abonado:</span>{' '}
          <span className="font-bold text-green-700 dark:text-green-400">-{formatearCLP(totalAbonado)}</span>
        </p>
        <p className="text-sm pt-2">
          <span className="font-bold text-graphite-900 dark:text-graphite-100">Saldo Pendiente:</span>{' '}
          <span className="font-extrabold text-clinical-error">{formatearCLP(saldoPendiente)}</span>
        </p>
      </div>

      <div className="hidden print:block mt-20 pt-10 border-t border-gray-300 dark:border-graphite-600 text-center">
        <div className="w-64 mx-auto border-t border-black pt-2">
          <p className="font-bold text-xs">{userProfile?.nombreCompleto || 'Dr. Miguel Díaz Rodríguez'}</p>
          <p className="text-[10px] text-graphite-600">{userProfile?.especialidad || 'Cirujano Dentista'}</p>
        </div>
      </div>
    </div>
  )
})

TablaItemsPresupuesto.displayName = 'TablaItemsPresupuesto'
