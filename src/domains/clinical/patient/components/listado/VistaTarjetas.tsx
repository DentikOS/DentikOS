import React, { memo } from 'react'
import { FileText, Trash2, AlertCircle, Phone, Mail } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { Badge } from '../../../../../shared/ui/ui/Badge'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import type { Paciente } from '../../schemas/pacienteSchema'

interface VistaTarjetasProps {
  pacientes: Paciente[]
  alSeleccionarPaciente: (paciente: Paciente) => void
  alEliminarPaciente: (id: string | number) => void
}

export const VistaTarjetas: React.FC<VistaTarjetasProps> = memo(({
  pacientes,
  alSeleccionarPaciente,
  alEliminarPaciente,
}) => {
  const seleccion = usePacientesStore((s) => s.seleccion)
  const toggleSeleccion = usePacientesStore((s) => s.toggleSeleccion)

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      data-testid="vista-tarjetas-container"
    >
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
        const iniciales = nombre
          .split(' ')
          .slice(0, 2)
          .map((n) => n[0])
          .join('')
          .toUpperCase()

        return (
          <div
            key={idStr}
            data-testid={`paciente-card-${p.id}`}
            className={`relative p-5 border rounded-2xl transition-all duration-150 flex flex-col justify-between group overflow-hidden ${
              isSelected
                ? 'bg-primary/5 border-primary/40 shadow-sm'
                : 'bg-surface/90 border-surface hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20">
                    {iniciales}
                  </div>
                  <div>
                    <h3
                      onClick={() => alSeleccionarPaciente(p)}
                      className="font-bold text-graphite-900 dark:text-graphite-50 text-sm group-hover:text-primary transition-colors cursor-pointer"
                    >
                      {nombre}
                    </h3>
                    <p className="text-xs text-graphite-500 font-mono">{p.rut}</p>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSeleccion(idStr)}
                  aria-label={`Seleccionar ${nombre}`}
                  className="w-4 h-4 rounded border-graphite-300 text-primary focus:ring-primary cursor-pointer mt-1"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
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

                {p.prevision && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-hover text-graphite-600 dark:text-graphite-300 uppercase font-medium">
                    {p.prevision}
                  </span>
                )}

                {(tieneAlergias || tieneSeveras) && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-semibold border border-rose-500/20">
                    <AlertCircle className="w-3 h-3" />
                    {tieneSeveras ? 'Alerta Severa' : 'Alergias'}
                  </span>
                )}
              </div>

              <div className="space-y-1 text-xs text-graphite-500 mb-4">
                <p className="flex items-center gap-1.5 truncate">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{p.telefono ? String(p.telefono) : 'Sin teléfono'}</span>
                </p>
                {p.email && (
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{p.email}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-surface flex items-center justify-between gap-2">
              <Button
                data-testid={`btn-ficha-${p.id}`}
                onClick={() => alSeleccionarPaciente(p)}
                size="sm"
                variant="secondary"
                icon={FileText}
                className="flex-1"
              >
                Ver ficha
              </Button>
              <Button
                data-testid={`btn-eliminar-${p.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  alEliminarPaciente(p.id)
                }}
                size="sm"
                variant="ghost"
                icon={Trash2}
                className="text-clinical-error hover:bg-clinical-error/10"
                aria-label="Eliminar paciente"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
})

VistaTarjetas.displayName = 'VistaTarjetas'
