import React, { memo } from 'react'
import { FileText, Trash2, AlertCircle, Phone, Mail } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { Badge } from '../../../../../shared/ui/ui/Badge'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import type { Paciente } from '../../schemas/pacienteSchema'

interface VistaListaProps {
  pacientes: Paciente[]
  alSeleccionarPaciente: (paciente: Paciente) => void
  alEliminarPaciente: (id: string | number) => void
}

export const VistaLista: React.FC<VistaListaProps> = memo(({
  pacientes,
  alSeleccionarPaciente,
  alEliminarPaciente,
}) => {
  const seleccion = usePacientesStore((s) => s.seleccion)
  const toggleSeleccion = usePacientesStore((s) => s.toggleSeleccion)

  return (
    <div className="space-y-2.5" data-testid="vista-lista-container">
      {pacientes.map((p) => {
        const idStr = String(p.id)
        const isSelected = seleccion.includes(idStr)
        const nombre = p.nombre || p.nombreCompleto || 'Sin nombre'
        const tieneAlergias = Array.isArray(p.alergias)
          ? p.alergias.length > 0
          : Boolean(p.alergias)
        const tieneSeveras = Array.isArray(p.alergiasSeveras) && p.alergiasSeveras.length > 0
        const estado = p.estado || 'activo'

        return (
          <div
            key={idStr}
            data-testid={`paciente-card-${p.id}`}
            className={`p-4 border rounded-xl transition-all duration-150 flex items-center justify-between gap-4 group ${
              isSelected
                ? 'bg-primary/5 border-primary/40'
                : 'bg-surface/90 border-surface hover:border-primary/30 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSeleccion(idStr)}
                aria-label={`Seleccionar ${nombre}`}
                className="w-4 h-4 rounded border-graphite-300 text-primary focus:ring-primary cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              />

              <div
                onClick={() => alSeleccionarPaciente(p)}
                className="cursor-pointer min-w-0 flex-1"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-graphite-900 dark:text-graphite-50 group-hover:text-primary transition-colors text-sm">
                    {nombre}
                  </span>
                  <span className="text-xs text-graphite-500 font-mono">
                    {p.rut}
                  </span>

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
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-hover text-graphite-600 dark:text-graphite-300 uppercase font-medium">
                      {p.prevision}
                    </span>
                  )}

                  {(tieneAlergias || tieneSeveras) && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20">
                      <AlertCircle className="w-3 h-3" />
                      {tieneSeveras ? 'Alerta Severa' : 'Alergias'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-graphite-500 mt-1 flex-wrap">
                  {p.telefono && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {String(p.telefono)}
                    </span>
                  )}
                  {p.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {p.email}
                    </span>
                  )}
                  {p.fechaUltimaVisita && (
                    <span className="text-graphite-400">
                      Última visita: {new Date(p.fechaUltimaVisita).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                data-testid={`btn-ficha-${p.id}`}
                onClick={() => alSeleccionarPaciente(p)}
                size="sm"
                variant="secondary"
                icon={FileText}
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

VistaLista.displayName = 'VistaLista'
