import React, { memo } from 'react'
import { Badge } from '../../../../../shared/ui/ui/Badge'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import { AccionesFilaPaciente } from './AccionesFilaPaciente'
import { useDoctoresClinica } from '../../hooks/useDoctoresClinica'
import { formatearDoctorTratante } from '../../utils/formatearDoctor'
import { useProximasCitasMap } from '../../hooks/useProximaCita'
import { destacarCoincidencias } from '../../../../../shared/utils/destacarCoincidencias'
import type { Paciente } from '../../schemas/pacienteSchema'

interface VistaTarjetasProps {
  pacientes: Paciente[]
  alSeleccionarPaciente: (paciente: Paciente) => void
  alEliminarPaciente?: (id: string | number) => void
  onDesactivarPaciente?: (paciente: Paciente) => void
  onBloquearPaciente?: (paciente: Paciente) => void
  onAgendarCita?: (paciente: Paciente) => void
  busqueda?: string
}

export const VistaTarjetas: React.FC<VistaTarjetasProps> = memo(({
  pacientes,
  alSeleccionarPaciente,
  onDesactivarPaciente,
  onBloquearPaciente,
  onAgendarCita,
  busqueda = '',
}) => {
  const seleccion = usePacientesStore((s) => s.seleccion)
  const toggleSeleccion = usePacientesStore((s) => s.toggleSeleccion)
  const proximasCitasMap = useProximasCitasMap()
  const { doctores } = useDoctoresClinica()

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5"
      data-testid="vista-tarjetas-container"
    >
      {pacientes.map((p) => {
        const idStr = String(p.id)
        const isSelected = seleccion.includes(idStr)
        const nombre = p.nombre || p.nombreCompleto || 'Sin nombre'
        const estado = p.estado || 'activo'
        const iniciales = nombre
          .split(' ')
          .slice(0, 2)
          .map((n) => n[0])
          .join('')
          .toUpperCase()
        const edadTexto = p.edad ? `${p.edad} años` : 'Edad s/r'
        const ultimaVisitaTexto = p.fechaUltimaVisita
          ? new Date(p.fechaUltimaVisita).toLocaleDateString('es-CL')
          : (p.ultimaVisita ? String(p.ultimaVisita) : '—')
        const proximaCita = proximasCitasMap.get(idStr)
        const proximaCitaTexto = proximaCita
          ? `${proximaCita.fecha} ${proximaCita.horaInicio || ''}`.trim()
          : (p.proximaCita ? String(p.proximaCita) : 'Sin próxima cita')
        const { texto: docTexto, asignado: docAsignado } = formatearDoctorTratante(p.doctorTratante, p.doctorTratanteId, doctores)

        return (
          <div
            key={idStr}
            data-testid={`paciente-card-${p.id}`}
            className={`min-h-[175px] p-4 border rounded-2xl transition-all duration-150 flex flex-col justify-between group overflow-hidden ${
              isSelected
                ? 'bg-primary/5 border-primary/40 shadow-xs'
                : 'bg-surface/90 border-surface hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2.5 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs border border-primary/20 shrink-0">
                    {iniciales}
                  </div>
                  <div className="min-w-0">
                    <h3
                      onClick={() => alSeleccionarPaciente(p)}
                      className="font-bold text-graphite-900 dark:text-graphite-50 text-xs truncate group-hover:text-primary transition-colors cursor-pointer"
                    >
                      {destacarCoincidencias(nombre, busqueda)} <span className="font-normal text-graphite-500">· {edadTexto}</span>
                    </h3>
                    <p className="text-[11px] text-graphite-500 font-mono">{p.rut}</p>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSeleccion(idStr)}
                  aria-label={`Seleccionar ${nombre}`}
                  className="w-4 h-4 rounded border-graphite-300 text-primary focus:ring-primary cursor-pointer shrink-0 mt-0.5"
                />
              </div>

              <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                <span className="text-[11px]">
                  <span className={docAsignado ? 'text-graphite-600 dark:text-graphite-300' : 'text-[#94A3B8] italic'}>
                    {docTexto}
                  </span>
                </span>
              </div>

              {Array.isArray(p.etiquetas) && p.etiquetas.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {p.etiquetas.map((etiq, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
                    >
                      {etiq}
                    </span>
                  ))}
                </div>
              )}

              <div className="text-[11px] text-graphite-500 space-y-0.5 mb-2">
                <p>Última: {ultimaVisitaTexto}</p>
                <p className="text-primary font-medium">Próxima: {proximaCitaTexto}</p>
              </div>
            </div>

            {/* Pie: los 4 iconos de WS-B */}
            <div className="pt-2.5 border-t border-surface flex items-center justify-between">
              <span className="text-[10px] text-graphite-400">Acciones rápidas</span>
              <AccionesFilaPaciente
                paciente={p}
                alSeleccionarPaciente={alSeleccionarPaciente}
                onDesactivar={onDesactivarPaciente}
                onBloquear={onBloquearPaciente}
                onAgendarCita={onAgendarCita}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
})

VistaTarjetas.displayName = 'VistaTarjetas'
