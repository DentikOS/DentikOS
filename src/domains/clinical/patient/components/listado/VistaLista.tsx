import React, { memo } from 'react'
import { User } from 'lucide-react'
import { Badge } from '../../../../../shared/ui/ui/Badge'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import { AccionesFilaPaciente } from './AccionesFilaPaciente'
import { formatearDoctorTratante } from '../../utils/formatearDoctor'
import { useProximasCitasMap } from '../../hooks/useProximaCita'
import type { Paciente } from '../../schemas/pacienteSchema'

interface VistaListaProps {
  pacientes: Paciente[]
  alSeleccionarPaciente: (paciente: Paciente) => void
  alEliminarPaciente?: (id: string | number) => void
  onDesactivarPaciente?: (paciente: Paciente) => void
  onBloquearPaciente?: (paciente: Paciente) => void
  onAgendarCita?: (paciente: Paciente) => void
}

export const VistaLista: React.FC<VistaListaProps> = memo(({
  pacientes,
  alSeleccionarPaciente,
  onDesactivarPaciente,
  onBloquearPaciente,
  onAgendarCita,
}) => {
  const seleccion = usePacientesStore((s) => s.seleccion)
  const toggleSeleccion = usePacientesStore((s) => s.toggleSeleccion)
  const proximasCitasMap = useProximasCitasMap()
  const modoSeleccionActivo = seleccion.length > 0

  return (
    <div className="space-y-2" data-testid="vista-lista-container">
      {pacientes.map((p) => {
        const idStr = String(p.id)
        const isSelected = seleccion.includes(idStr)
        const nombre = p.nombre || p.nombreCompleto || 'Sin nombre'
        const estado = p.estado || 'activo'
        const edadTexto = p.edad ? `${p.edad} años` : 'Edad s/r'
        const ultimaVisitaTexto = p.fechaUltimaVisita
          ? new Date(p.fechaUltimaVisita).toLocaleDateString('es-CL')
          : (p.ultimaVisita ? String(p.ultimaVisita) : '—')
        const proximaCita = proximasCitasMap.get(idStr)
        const proximaCitaTexto = proximaCita
          ? `${proximaCita.fecha} ${proximaCita.horaInicio || ''}`.trim()
          : (p.proximaCita ? String(p.proximaCita) : 'Sin cita próxima')
        const { texto: docTexto, asignado: docAsignado } = formatearDoctorTratante(p.doctorTratante, p.doctorTratanteId)

        return (
          <div
            key={idStr}
            data-testid={`paciente-card-${p.id}`}
            className={`min-h-[58px] p-3 border rounded-xl transition-all duration-150 flex items-center justify-between gap-3 group ${
              isSelected
                ? 'bg-primary/5 border-primary/40'
                : 'bg-surface/90 border-surface hover:border-primary/30 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSeleccion(idStr)}
                aria-label={`Seleccionar ${nombre}`}
                className={`w-4 h-4 rounded border-graphite-300 text-primary focus:ring-primary cursor-pointer shrink-0 transition-opacity ${
                  modoSeleccionActivo || isSelected
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                }`}
                onClick={(e) => e.stopPropagation()}
              />

              <div
                onClick={() => alSeleccionarPaciente(p)}
                className="cursor-pointer min-w-0 flex-1 space-y-0.5"
              >
                {/* Línea 1: Nombre completo · Edad · Última · Próxima */}
                <div className="flex items-center gap-2 text-xs truncate">
                  <span className="font-bold text-graphite-900 dark:text-graphite-50 group-hover:text-primary transition-colors truncate flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-graphite-400 shrink-0" />
                    <span>{nombre}</span>
                  </span>
                  <span className="text-graphite-400">·</span>
                  <span className="text-graphite-600 dark:text-graphite-300 shrink-0">{edadTexto}</span>
                  <span className="text-graphite-400">·</span>
                  <span className="text-graphite-500 shrink-0">Última: {ultimaVisitaTexto}</span>
                  <span className="text-graphite-400">·</span>
                  <span className="text-primary font-medium shrink-0">Próxima: {proximaCitaTexto}</span>
                </div>

                {/* Línea 2: pill de estado · Dr. tratante */}
                <div className="flex items-center gap-2 text-[11px] text-graphite-500">
                  <Badge
                    size="sm"
                    variant={
                      estado === 'activo'
                        ? 'success'
                        : estado === 'nuevo'
                        ? 'info'
                        : estado === 'bloqueado'
                        ? 'danger'
                        : estado === 'desactivado'
                        ? 'neutral'
                        : 'neutral'
                    }
                  >
                    {estado}
                  </Badge>
                  <span className="text-graphite-400">·</span>
                  <span className={docAsignado ? 'text-graphite-600 dark:text-graphite-300' : 'text-[#94A3B8] italic'}>
                    {docTexto}
                  </span>
                </div>
              </div>
            </div>

            {/* Derecha: exactamente los 4 iconos rápidos */}
            <AccionesFilaPaciente
              paciente={p}
              alSeleccionarPaciente={alSeleccionarPaciente}
              onDesactivar={onDesactivarPaciente}
              onBloquear={onBloquearPaciente}
              onAgendarCita={onAgendarCita}
            />
          </div>
        )
      })}
    </div>
  )
})

VistaLista.displayName = 'VistaLista'
