import React from 'react'
import { Input } from '../../../../shared/ui/ui/Input'
import { CustomSelect } from '../../../../shared/ui/ui/CustomSelect'
import { Icon } from '../../../../shared/ui/Icon'
import { Armchair, Check, Phone, Folder, Clock, Timer } from 'lucide-react'
import { TRATAMIENTOS_RAPIDOS, TRAMOS_DURACION } from '../constants/agendaConstants'
import type { Paciente } from '../../../../domains/clinical/patient/schemas/pacienteSchema'

export interface SillonDentalItem {
  id: string
  nombre: string
  especialidad?: string
}

export interface CamposFormularioCitaProps {
  pacientes: (Paciente & { apellido?: string; nombreCompleto?: string })[]
  sillonesDentales: readonly SillonDentalItem[] | SillonDentalItem[]
  prestaciones?: { id: string | number; nombre?: string; duracionEstimada?: number }[]
  prestacionSeleccionadaId?: string
  setPrestacionSeleccionadaId?: (id: string) => void
  esPacienteExpress: boolean
  pacienteSeleccionadoId: string | number
  pacienteNombre: string
  pacienteTelefono: string
  pacienteRut: string
  autoCrearFicha: boolean
  tratamiento: string
  boxAsignado: string
  fecha: string
  horaInicio: string
  horaFinCalculada: string
  duracionMinutos: number | string
  observaciones: string
  setPacienteSeleccionadoId: (id: string) => void
  setPacienteNombre: (nombre: string) => void
  setPacienteTelefono: (tel: string) => void
  setPacienteRut: (rut: string) => void
  setAutoCrearFicha: (auto: boolean) => void
  setTratamiento: (tratamiento: string) => void
  setBoxAsignado: (box: string) => void
  setFecha: (fecha: string) => void
  setHoraInicio: (hora: string) => void
  setDuracionMinutos: (duracion: number | string) => void
  setObservaciones: (obs: string) => void
  handleSelectPacienteChange: (e: { target: { value: string } }) => void
}

export const CamposFormularioCita: React.FC<CamposFormularioCitaProps> = ({
  pacientes,
  sillonesDentales,
  prestaciones = [],
  prestacionSeleccionadaId = '',
  setPrestacionSeleccionadaId,
  esPacienteExpress,
  pacienteSeleccionadoId,
  pacienteNombre,
  pacienteTelefono,
  autoCrearFicha,
  tratamiento,
  boxAsignado,
  fecha,
  horaInicio,
  horaFinCalculada,
  duracionMinutos,
  observaciones,
  setPacienteNombre,
  setPacienteTelefono,
  setAutoCrearFicha,
  setTratamiento,
  setBoxAsignado,
  setFecha,
  setHoraInicio,
  setDuracionMinutos,
  setObservaciones,
  handleSelectPacienteChange
}) => {
  const handlePacienteChange = (value: string): void => {
    handleSelectPacienteChange({ target: { value } })
  }

  return (
    <>
      {/* Sección de paciente */}
      {!esPacienteExpress ? (
        <div>
          <CustomSelect
            label="Seleccionar Paciente de la Base de Datos *"
            options={pacientes.map(p => {
              const nombreFull = `${p.nombre || ''} ${p.apellido || ''}`.trim() || p.nombreCompleto || 'Sin Nombre'
              return { value: String(p.id), label: `${nombreFull} ${p.rut ? `(RUT: ${p.rut})` : ''} ${p.telefono ? `- Tel: ${p.telefono}` : ''}` }
            })}
            value={String(pacienteSeleccionadoId)}
            onChange={handlePacienteChange}
            placeholder="-- Despliega para elegir paciente registrado --"
          />

          {pacienteSeleccionadoId && (
            <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-extrabold text-[11px] flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Icon icon={Check} size="xs" />
                Paciente: <strong>{pacienteNombre}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Icon icon={Phone} size="xs" />
                {pacienteTelefono || 'Sin fono registrado'}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 bg-gray-50 dark:bg-graphite-800 p-3 rounded-2xl border border-gray-200 dark:border-graphite-700">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre Completo" type="text" value={pacienteNombre} onChange={(e) => setPacienteNombre(e.target.value)} placeholder="Ej. María González" required />
            <Input label="Teléfono / WhatsApp" type="text" value={pacienteTelefono} onChange={(e) => setPacienteTelefono(e.target.value)} placeholder="+56 9 1234 5678" />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="autoCrear" checked={autoCrearFicha} onChange={(e) => setAutoCrearFicha(e.target.checked)} className="w-4 h-4 rounded text-black dark:text-graphite-50 focus:ring-black cursor-pointer" />
            <label htmlFor="autoCrear" className="font-bold text-gray-800 dark:text-graphite-100 text-[11px] cursor-pointer flex items-center gap-1">
              <Icon icon={Folder} size="xs" />
              Crear automáticamente Ficha Clínica en el Módulo Pacientes
            </label>
          </div>
        </div>
      )}

      {/* Prestación + Box */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="prestacionSelect" className="font-extrabold text-gray-700 dark:text-graphite-300 block mb-1">Prestación</label>
          <select
            id="prestacionSelect"
            aria-label="Prestación"
            value={prestacionSeleccionadaId}
            onChange={(e) => setPrestacionSeleccionadaId?.(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 font-bold bg-gray-50 dark:bg-graphite-900 focus:bg-white dark:focus:bg-graphite-800 cursor-pointer dark:text-graphite-100"
          >
            <option value="">-- Seleccionar Prestación --</option>
            {prestaciones.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.nombre} {p.duracionEstimada ? `(${p.duracionEstimada} min)` : ''}
              </option>
            ))}
          </select>
        </div>

        <CustomSelect
          label="Sillón / Box Dental"
          options={sillonesDentales.map(s => ({ value: s.nombre, label: s.nombre, icon: Armchair }))}
          value={boxAsignado}
          onChange={(value) => setBoxAsignado(value)}
        />
      </div>

      {/* Tratamiento / Motivo */}
      <div>
        <label className="font-extrabold text-gray-700 dark:text-graphite-300 block mb-1">Tratamiento / Motivo *</label>
        <select
          value={tratamiento}
          onChange={(e) => setTratamiento(e.target.value)}
          className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 font-bold bg-gray-50 dark:bg-graphite-900 focus:bg-white dark:focus:bg-graphite-800 cursor-pointer dark:text-graphite-100"
        >
          {TRATAMIENTOS_RAPIDOS.map((t, idx) => (
            <option key={idx} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Fecha + Hora + Duración */}
      <div className="grid grid-cols-3 gap-3">
        <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        <Input label="Hora Inicio" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required />

        <div>
          <label htmlFor="duracionSelect" className="font-extrabold text-gray-700 dark:text-graphite-300 block mb-1">Duración</label>
          <select
            id="duracionSelect"
            aria-label="Duración"
            value={duracionMinutos}
            onChange={(e) => setDuracionMinutos(parseInt(e.target.value, 10))}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 font-bold bg-gray-50 dark:bg-graphite-900 cursor-pointer dark:text-graphite-100"
          >
            {TRAMOS_DURACION.map((duracion) => (
              <option key={duracion} value={String(duracion)}>
                {duracion} min
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Horario calculado */}
      <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex justify-between items-center text-[11px] font-extrabold text-blue-900 dark:text-blue-200">
        <span className="flex items-center gap-1">
          <Icon icon={Clock} size="xs" />
          Horario Asignado: {horaInicio} hrs a {horaFinCalculada} hrs
        </span>
        <span className="flex items-center gap-1">
          <Icon icon={Timer} size="xs" />
          {duracionMinutos} min
        </span>
      </div>

      {/* Observaciones */}
      <div>
        <label className="font-extrabold text-gray-700 dark:text-graphite-300 block mb-1">Observaciones / Notas Clínicas</label>
        <textarea
          rows={2}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Instrucciones previas, sensibilidad, paciente ansioso..."
          className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 font-bold bg-gray-50 dark:bg-graphite-900 focus:bg-white dark:focus:bg-graphite-800 resize-none dark:text-graphite-100"
        />
      </div>
    </>
  )
}
