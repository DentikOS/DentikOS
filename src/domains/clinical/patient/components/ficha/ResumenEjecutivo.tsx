import React from 'react'
import { Clock, Layers, DollarSign, Calendar, ShieldAlert, HeartPulse, ChevronRight, CheckCircle2 } from 'lucide-react'
import { useProximaCita } from '../../hooks/useProximaCita'
import { useDoctorTratante } from '../../hooks/useDoctorTratante'
import type { Paciente } from '../../schemas/pacienteSchema'
import type { PestanaFicha } from '../../services/contextualRouter'

interface ResumenEjecutivoProps {
  paciente: Paciente
  onNavegar: (pestana: PestanaFicha) => void
}

export const ResumenEjecutivo: React.FC<ResumenEjecutivoProps> = ({ paciente, onNavegar }) => {
  const proximaCita = useProximaCita(paciente.id)
  const { texto: doctorTexto } = useDoctorTratante(paciente.doctorTratanteId, paciente.doctorTratante)
  const fechaUltima = paciente.fechaUltimaVisita || (paciente as unknown as Record<string, unknown>).ultimaVisita

  const alergias =
    Array.isArray(paciente.alergiasSeveras) && paciente.alergiasSeveras.length > 0
      ? paciente.alergiasSeveras.join(', ')
      : typeof paciente.alergias === 'string' && paciente.alergias.trim()
      ? paciente.alergias
      : null

  const tratamientoTexto = (paciente.tratamientoActivo || (paciente as unknown as Record<string, unknown>).tratamiento) as string | undefined

  return (
    <div className="space-y-4" data-testid="resumen-ejecutivo-panel">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Última Atención */}
        <div
          onClick={() => onNavegar('evoluciones')}
          className="p-4 rounded-2xl bg-surface border border-surface hover:border-primary/40 transition-micro cursor-pointer group shadow-xs"
          data-testid="card-ultima-atencion"
        >
          <div className="flex items-center justify-between pb-2 border-b border-surface">
            <div className="flex items-center gap-2 text-xs font-bold text-graphite-700 dark:text-graphite-200">
              <Clock className="w-4 h-4 text-primary" />
              <span>Última Atención</span>
            </div>
            <ChevronRight className="w-4 h-4 text-graphite-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold text-graphite-900 dark:text-graphite-50">
              {fechaUltima ? (
                new Date(String(fechaUltima)).toLocaleDateString('es-CL')
              ) : (
                <span className="text-graphite-400 italic">Sin visitas registradas</span>
              )}
            </p>
            {doctorTexto ? (
              <p className="text-xs text-graphite-500">{doctorTexto}</p>
            ) : (
              <p className="text-xs text-graphite-400 italic">Sin doctor asignado</p>
            )}
            {paciente.motivoConsulta ? (
              <p className="text-[11px] text-graphite-400 italic">Motivo: {paciente.motivoConsulta}</p>
            ) : null}
          </div>
        </div>

        {/* 2. Tratamientos Activos */}
        <div
          onClick={() => onNavegar('presupuestos')}
          className="p-4 rounded-2xl bg-surface border border-surface hover:border-primary/40 transition-micro cursor-pointer group shadow-xs"
          data-testid="card-tratamientos-activos"
        >
          <div className="flex items-center justify-between pb-2 border-b border-surface">
            <div className="flex items-center gap-2 text-xs font-bold text-graphite-700 dark:text-graphite-200">
              <Layers className="w-4 h-4 text-primary" />
              <span>Tratamientos Activos</span>
            </div>
            <ChevronRight className="w-4 h-4 text-graphite-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="mt-3 space-y-1">
            {tratamientoTexto ? (
              <div className="flex items-center gap-1.5 text-xs text-graphite-800 dark:text-graphite-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>{tratamientoTexto}</span>
              </div>
            ) : (
              <p className="text-xs text-graphite-400 italic">Sin tratamiento activo registrado</p>
            )}
          </div>
        </div>

        {/* 3. Presupuesto Activo */}
        <div
          onClick={() => onNavegar('presupuestos')}
          className="p-4 rounded-2xl bg-surface border border-surface hover:border-primary/40 transition-micro cursor-pointer group shadow-xs"
          data-testid="card-presupuesto-activo"
        >
          <div className="flex items-center justify-between pb-2 border-b border-surface">
            <div className="flex items-center gap-2 text-xs font-bold text-graphite-700 dark:text-graphite-200">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span>Presupuesto</span>
            </div>
            <ChevronRight className="w-4 h-4 text-graphite-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-xs text-graphite-500">Gestión de presupuestos y aranceles</p>
            <p className="text-[11px] text-graphite-400">Haga clic para ver o generar presupuestos</p>
          </div>
        </div>

        {/* 4. Próxima Cita */}
        <div
          onClick={() => onNavegar('datos')}
          className="p-4 rounded-2xl bg-surface border border-surface hover:border-primary/40 transition-micro cursor-pointer group shadow-xs"
          data-testid="card-proxima-cita"
        >
          <div className="flex items-center justify-between pb-2 border-b border-surface">
            <div className="flex items-center gap-2 text-xs font-bold text-graphite-700 dark:text-graphite-200">
              <Calendar className="w-4 h-4 text-primary" />
              <span>Próxima Cita</span>
            </div>
            <ChevronRight className="w-4 h-4 text-graphite-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold text-graphite-900 dark:text-graphite-50">
              {proximaCita ? (
                `${proximaCita.fecha} ${proximaCita.horaInicio || ''}`.trim()
              ) : paciente.proximaCita ? (
                String(paciente.proximaCita)
              ) : (
                <span className="text-graphite-400 italic">Sin cita programada</span>
              )}
            </p>
            {proximaCita?.boxAsignado || proximaCita?.box ? (
              <p className="text-[11px] text-graphite-500">Box: {String(proximaCita.boxAsignado || proximaCita.box)}</p>
            ) : null}
          </div>
        </div>

        {/* 5. Alertas Críticas */}
        <div
          onClick={() => onNavegar('datos')}
          className="p-4 rounded-2xl bg-surface border border-surface hover:border-rose-500/40 transition-micro cursor-pointer group shadow-xs md:col-span-2"
          data-testid="card-alertas-criticas"
        >
          <div className="flex items-center justify-between pb-2 border-b border-surface">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-4 h-4" />
              <span>Condiciones Críticas Registradas</span>
            </div>
            <ChevronRight className="w-4 h-4 text-graphite-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {alergias ? (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#E11D48]/15 text-[#E11D48] border border-[#E11D48]/30">
                ALERGIA: {alergias}
              </span>
            ) : (
              <span className="text-xs text-graphite-400">Sin alergias severas registradas</span>
            )}
            {paciente.anticoagulantes && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <HeartPulse className="w-3.5 h-3.5" /> Anticoagulantes
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
