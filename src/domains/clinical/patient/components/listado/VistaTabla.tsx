import React, { memo, useState, useEffect } from 'react'
import { Settings2, AlertCircle } from 'lucide-react'
import { Badge } from '../../../../../shared/ui/ui/Badge'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import { BotonLlamarPopover } from './BotonLlamarPopover'
import { AccionesFilaPaciente } from './AccionesFilaPaciente'
import { SelectorColumnasTabla } from './SelectorColumnasTabla'
import { ejecutarClickToEmail } from '../../utils/clickToEmail'
import { formatearDoctorTratante } from '../../utils/formatearDoctor'
import type { Paciente } from '../../schemas/pacienteSchema'

interface VistaTablaProps {
  pacientes: Paciente[]
  alSeleccionarPaciente: (paciente: Paciente) => void
  alEliminarPaciente?: (id: string | number) => void
  onDesactivarPaciente?: (paciente: Paciente) => void
  onBloquearPaciente?: (paciente: Paciente) => void
  onAgendarCita?: (paciente: Paciente) => void
}

const STORAGE_KEY_COLUMNAS = 'columnas_tabla_pacientes'

export const VistaTabla: React.FC<VistaTablaProps> = memo(({
  pacientes,
  alSeleccionarPaciente,
  onDesactivarPaciente,
  onBloquearPaciente,
  onAgendarCita,
}) => {
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [columnasVisibles, setColumnasVisibles] = useState<Record<string, boolean>>(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY_COLUMNAS)
      return guardado ? JSON.parse(guardado) : { estado: true, doctorTratante: true }
    } catch {
      return { estado: true, doctorTratante: true }
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COLUMNAS, JSON.stringify(columnasVisibles))
    } catch {
      // localStorage no disponible en entorno restringido
    }
  }, [columnasVisibles])

  const toggleColumna = (id: string) => {
    setColumnasVisibles((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const seleccion = usePacientesStore((s) => s.seleccion)
  const toggleSeleccion = usePacientesStore((s) => s.toggleSeleccion)
  const seleccionarTodos = usePacientesStore((s) => s.seleccionarTodos)
  const limpiarSeleccion = usePacientesStore((s) => s.limpiarSeleccion)

  const todosSeleccionados =
    pacientes.length > 0 && pacientes.every((p) => seleccion.includes(String(p.id)))

  return (
    <div className="space-y-2" data-testid="vista-tabla-container">
      <div className="flex justify-end relative">
        <button
          type="button"
          onClick={() => setSelectorAbierto((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-surface border border-surface hover:bg-surface-hover rounded-xl text-graphite-600 dark:text-graphite-300 transition-colors cursor-pointer"
          data-testid="btn-configurar-columnas"
        >
          <Settings2 className="w-3.5 h-3.5 text-primary" />
          <span>⚙ Columnas</span>
        </button>
        <SelectorColumnasTabla
          columnasVisibles={columnasVisibles}
          onToggleColumna={toggleColumna}
          isOpen={selectorAbierto}
          onClose={() => setSelectorAbierto(false)}
        />
      </div>

      <div className="overflow-x-auto border border-surface rounded-xl bg-surface/90 shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-surface-hover/70 text-graphite-600 dark:text-graphite-400 font-semibold border-b border-surface">
            <tr className="h-10">
              <th className="p-2.5 w-10 text-center">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={() => (todosSeleccionados ? limpiarSeleccion() : seleccionarTodos())}
                  aria-label="Seleccionar todos los pacientes"
                  className="w-4 h-4 rounded border-graphite-300 text-primary focus:ring-primary cursor-pointer"
                />
              </th>
              {/* 6 Columnas Fijas Obligatorias */}
              <th className="p-2.5">Nombre completo</th>
              <th className="p-2.5">RUT</th>
              <th className="p-2.5">Edad</th>
              <th className="p-2.5">Teléfono</th>
              <th className="p-2.5">Última visita</th>
              <th className="p-2.5">Próxima cita</th>

              {/* Columnas Personalizables */}
              {columnasVisibles.doctorTratante && <th className="p-2.5">Doctor tratante</th>}
              {columnasVisibles.tratamientosActivos && <th className="p-2.5">Tratamientos activos</th>}
              {columnasVisibles.estado && <th className="p-2.5">Estado</th>}
              {columnasVisibles.saldoPendiente && <th className="p-2.5">Saldo pendiente</th>}
              {columnasVisibles.email && <th className="p-2.5">Email</th>}
              {columnasVisibles.etiquetas && <th className="p-2.5">Etiquetas</th>}
              {columnasVisibles.prevision && <th className="p-2.5">Previsión</th>}
              {columnasVisibles.alertasMedicas && <th className="p-2.5">Alertas Médicas</th>}

              <th className="p-2.5 text-right w-36">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface">
            {pacientes.map((p) => {
              const idStr = String(p.id)
              const isSelected = seleccion.includes(idStr)
              const nombre = p.nombre || p.nombreCompleto || 'Sin nombre'
              const estado = p.estado || 'activo'
              const edad = p.edad ? `${p.edad} años` : '—'
              const ultimaVisita = p.fechaUltimaVisita
                ? new Date(p.fechaUltimaVisita).toLocaleDateString('es-CL')
                : (p.ultimaVisita ? String(p.ultimaVisita) : '—')
              const proximaCita = p.proximaCita ? String(p.proximaCita) : '—'
              const tieneAlergias = Boolean(p.alergias || p.alergiasSeveras)
              const { texto: docTexto, asignado: docAsignado } = formatearDoctorTratante(p.doctorTratante, p.doctorTratanteId)

              return (
                <tr
                  key={idStr}
                  data-testid={`paciente-card-${p.id}`}
                  className={`h-11 transition-colors hover:bg-surface-hover/60 ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                >
                  <td className="p-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSeleccion(idStr)}
                      aria-label={`Seleccionar ${nombre}`}
                      className="w-4 h-4 rounded border-graphite-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </td>
                  {/* 1. Nombre completo */}
                  <td className="p-2.5 cursor-pointer font-bold text-graphite-900 dark:text-graphite-50 hover:text-primary" onClick={() => alSeleccionarPaciente(p)}>
                    {nombre}
                  </td>
                  {/* 2. RUT */}
                  <td className="p-2.5 font-mono text-[11px] text-graphite-600 dark:text-graphite-300">{p.rut || '—'}</td>
                  {/* 3. Edad */}
                  <td className="p-2.5 text-graphite-600 dark:text-graphite-300">{edad}</td>
                  {/* 4. Teléfono (Click-to-call) */}
                  <td className="p-2.5">
                    <BotonLlamarPopover paciente={p} telefono={p.telefono} esEnlaceTexto={true} />
                  </td>
                  {/* 5. Última visita */}
                  <td className="p-2.5 text-graphite-500">{ultimaVisita}</td>
                  {/* 6. Próxima cita */}
                  <td className="p-2.5 text-primary font-medium">{proximaCita}</td>

                  {/* Opcionales */}
                  {columnasVisibles.doctorTratante && (
                    <td className="p-2.5">
                      <span className={docAsignado ? 'text-graphite-600 dark:text-graphite-300' : 'text-[#94A3B8] italic'}>
                        {docTexto}
                      </span>
                    </td>
                  )}
                  {columnasVisibles.tratamientosActivos && (
                    <td className="p-2.5 text-graphite-600 dark:text-graphite-300">{p.tratamientosActivos ? String(p.tratamientosActivos) : 'Sin tratamientos'}</td>
                  )}
                  {columnasVisibles.estado && (
                    <td className="p-2.5">
                      <Badge size="sm" variant={estado === 'activo' ? 'success' : estado === 'nuevo' ? 'info' : estado === 'bloqueado' ? 'danger' : 'neutral'}>
                        {estado}
                      </Badge>
                    </td>
                  )}
                  {columnasVisibles.saldoPendiente && (
                    <td className="p-2.5 font-mono text-rose-500 font-semibold">{p.saldoPendiente ? String(p.saldoPendiente) : '$0'}</td>
                  )}
                  {columnasVisibles.email && (
                    <td className="p-2.5">
                      {p.email ? (
                        <button type="button" onClick={() => ejecutarClickToEmail(p.email, p.id)} className="text-primary hover:underline truncate max-w-[140px] block cursor-pointer">
                          {p.email}
                        </button>
                      ) : '—'}
                    </td>
                  )}
                  {columnasVisibles.etiquetas && (
                    <td className="p-2.5">
                      {Array.isArray(p.etiquetas) && p.etiquetas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {p.etiquetas.map((etiq, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
                            >
                              {etiq}
                            </span>
                          ))}
                        </div>
                      ) : p.etiquetas ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                          {String(p.etiquetas)}
                        </span>
                      ) : (
                        <span className="text-graphite-400">—</span>
                      )}
                    </td>
                  )}
                  {columnasVisibles.prevision && (
                    <td className="p-2.5 uppercase text-[11px]">{p.prevision || 'Particular'}</td>
                  )}
                  {columnasVisibles.alertasMedicas && (
                    <td className="p-2.5">
                      {tieneAlergias ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-500 font-bold">
                          <AlertCircle className="w-3.5 h-3.5" /> Alerta
                        </span>
                      ) : <span className="text-graphite-400">Sin alertas</span>}
                    </td>
                  )}

                  {/* Acciones Rápidas (4 iconos) */}
                  <td className="p-2.5 text-right">
                    <AccionesFilaPaciente
                      paciente={p}
                      alSeleccionarPaciente={alSeleccionarPaciente}
                      onDesactivar={onDesactivarPaciente}
                      onBloquear={onBloquearPaciente}
                      onAgendarCita={onAgendarCita}
                    />
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

VistaTabla.displayName = 'VistaTabla'
