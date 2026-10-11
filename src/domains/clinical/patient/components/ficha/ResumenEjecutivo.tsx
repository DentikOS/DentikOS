import React from 'react'
import { Clock, Layers, DollarSign, Calendar, ShieldAlert, HeartPulse, ChevronRight, CheckCircle2 } from 'lucide-react'
import type { Paciente } from '../../schemas/pacienteSchema'
import type { PestanaFicha } from '../../services/contextualRouter'

interface ResumenEjecutivoProps {
  paciente: Paciente
  onNavegar: (pestana: PestanaFicha) => void
}

export const ResumenEjecutivo: React.FC<ResumenEjecutivoProps> = ({ paciente, onNavegar }) => {
  const alergias = Array.isArray(paciente.alergiasSeveras) && paciente.alergiasSeveras.length > 0
    ? paciente.alergiasSeveras.join(', ')
    : typeof paciente.alergias === 'string' && paciente.alergias.trim()
    ? paciente.alergias
    : null

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
              {String(paciente.ultimaVisita || '15 Sep 2026')}
            </p>
            <p className="text-xs text-graphite-500">Dr. {String(paciente.doctorTratante || 'Martínez')}</p>
            <p className="text-[11px] text-graphite-400 italic">Motivo: Control periodontal y limpieza</p>
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
            <div className="flex items-center gap-1.5 text-xs text-graphite-800 dark:text-graphite-100">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Rehabilitación Oral Fases 1 & 2</span>
            </div>
            <p className="text-[11px] text-graphite-500">2 fases en curso de 3 planificadas</p>
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
              <span>Presupuesto Activo</span>
            </div>
            <ChevronRight className="w-4 h-4 text-graphite-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-graphite-500">Total:</span>
              <span className="font-mono font-bold text-graphite-900 dark:text-graphite-100">$480.000</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-graphite-500">Saldo:</span>
              <span className="font-mono font-bold text-rose-500">$180.000</span>
            </div>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              En Curso
            </span>
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
              {String(paciente.proximaCita || '22 Oct 2026 10:00')}
            </p>
            <p className="text-[11px] text-graphite-500">Box 2 · Sillón Quirúrgico</p>
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
                ⚠️ ALERGIA: {alergias}
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
