import React, { memo } from 'react'
import { FileText, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { Badge } from '../../../../../shared/ui/ui/Badge'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import type { Paciente } from '../../schemas/pacienteSchema'

interface VistaTablaProps {
  pacientes: Paciente[]
  alSeleccionarPaciente: (paciente: Paciente) => void
  alEliminarPaciente: (id: string | number) => void
}

export const VistaTabla: React.FC<VistaTablaProps> = memo(({
  pacientes,
  alSeleccionarPaciente,
  alEliminarPaciente,
}) => {
  const seleccion = usePacientesStore((s) => s.seleccion)
  const toggleSeleccion = usePacientesStore((s) => s.toggleSeleccion)
  const seleccionarTodos = usePacientesStore((s) => s.seleccionarTodos)
  const limpiarSeleccion = usePacientesStore((s) => s.limpiarSeleccion)

  const todosSeleccionados =
    pacientes.length > 0 && pacientes.every((p) => seleccion.includes(String(p.id)))

  const handleToggleTodos = () => {
    if (todosSeleccionados) {
      limpiarSeleccion()
    } else {
      seleccionarTodos()
    }
  }

  return (
    <div
      className="overflow-x-auto border border-surface rounded-xl bg-surface/90 shadow-xs"
      data-testid="vista-tabla-container"
    >
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-surface-hover/70 text-graphite-600 dark:text-graphite-400 font-semibold border-b border-surface">
          <tr>
            <th className="p-3 w-10 text-center">
              <input
                type="checkbox"
                checked={todosSeleccionados}
                onChange={handleToggleTodos}
                aria-label="Seleccionar todos los pacientes"
                className="w-4 h-4 rounded border-graphite-300 text-primary focus:ring-primary cursor-pointer"
              />
            </th>
            <th className="p-3">Paciente / RUT</th>
            <th className="p-3">Contacto</th>
            <th className="p-3">Previsión</th>
            <th className="p-3">Alertas Médicas</th>
            <th className="p-3">Estado</th>
            <th className="p-3">Última Visita</th>
            <th className="p-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface">
          {pacientes.map((p) => {
            const idStr = String(p.id)
            const isSelected = seleccion.includes(idStr)
            const nombre = p.nombre || p.nombreCompleto || 'Sin nombre'
            const tieneAlergias = Array.isArray(p.alergias)
              ? p.alergias.length > 0
              : Boolean(p.alergias)
            const tieneSeveras =
              Array.isArray(p.alergiasSeveras) && p.alergiasSeveras.length > 0
            const estado = p.estado || 'activo'

            return (
              <tr
                key={idStr}
                data-testid={`paciente-card-${p.id}`}
                className={`transition-colors hover:bg-surface-hover/60 ${
                  isSelected ? 'bg-primary/5' : ''
                }`}
              >
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSeleccion(idStr)}
                    aria-label={`Seleccionar ${nombre}`}
                    className="w-4 h-4 rounded border-graphite-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </td>
                <td
                  className="p-3 cursor-pointer"
                  onClick={() => alSeleccionarPaciente(p)}
                >
                  <p className="font-bold text-graphite-900 dark:text-graphite-50 hover:text-primary transition-colors">
                    {nombre}
                  </p>
                  <p className="text-graphite-500 font-mono text-[11px]">{p.rut}</p>
                </td>
                <td className="p-3 text-graphite-600 dark:text-graphite-300">
                  <p>{p.telefono ? String(p.telefono) : '—'}</p>
                  <p className="text-graphite-400 text-[11px]">{p.email || '—'}</p>
                </td>
                <td className="p-3">
                  <span className="uppercase text-[11px] font-medium text-graphite-600 dark:text-graphite-400">
                    {p.prevision || 'Particular'}
                  </span>
                </td>
                <td className="p-3">
                  {tieneSeveras ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-semibold border border-rose-500/20">
                      <AlertCircle className="w-3 h-3" /> Severa
                    </span>
                  ) : tieneAlergias ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium border border-amber-500/20">
                      Alergias
                    </span>
                  ) : (
                    <span className="text-graphite-400 text-[11px]">Ninguna</span>
                  )}
                </td>
                <td className="p-3">
                  <Badge
                    size="sm"
                    variant={
                      estado === 'activo'
                        ? 'success'
                        : estado === 'nuevo'
                        ? 'info'
                        : estado === 'bloqueado'
                        ? 'danger'
                        : 'neutral'
                    }
                  >
                    {estado}
                  </Badge>
                </td>
                <td className="p-3 text-graphite-500">
                  {p.fechaUltimaVisita
                    ? new Date(p.fechaUltimaVisita).toLocaleDateString()
                    : '—'}
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      data-testid={`btn-ficha-${p.id}`}
                      onClick={() => alSeleccionarPaciente(p)}
                      size="sm"
                      variant="ghost"
                      icon={FileText}
                      title="Ver ficha"
                    />
                    <Button
                      data-testid={`btn-eliminar-${p.id}`}
                      onClick={() => alEliminarPaciente(p.id)}
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      className="text-clinical-error hover:bg-clinical-error/10"
                      aria-label="Eliminar paciente"
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})

VistaTabla.displayName = 'VistaTabla'
