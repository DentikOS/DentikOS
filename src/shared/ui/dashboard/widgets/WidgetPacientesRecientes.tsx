import React from 'react'
import { Users, ChevronRight } from 'lucide-react'
import { WidgetBase } from './WidgetBase'
import type { Paciente } from '../../../../domains/clinical/patient/schemas/pacienteSchema'

export interface WidgetPacientesRecientesProps {
  pacientes?: Paciente[]
  onVerFichaPaciente?: (paciente: Paciente) => void
  onVerTodos?: () => void
  dragHandle?: React.ReactNode
}

export const WidgetPacientesRecientes: React.FC<WidgetPacientesRecientesProps> = ({
  pacientes = [],
  onVerFichaPaciente,
  onVerTodos,
  dragHandle
}) => {
  const recientes = pacientes.slice(0, 5)

  return (
    <WidgetBase
      titulo="Pacientes Recientes"
      icono={<Users className="w-4 h-4 text-emerald-600" />}
      borderColor="#059669"
      dragHandle={dragHandle}
      footer={
        <button
          type="button"
          onClick={onVerTodos}
          className="w-full flex items-center justify-center gap-1 font-semibold text-emerald-600 hover:underline cursor-pointer"
        >
          Ver todos los pacientes →
        </button>
      }
    >
      {recientes.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No hay pacientes recientes</p>
      ) : (
        <div className="space-y-2">
          {recientes.map((paciente) => (
            <div
              key={paciente.id}
              onClick={() => onVerFichaPaciente?.(paciente)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-surface-muted/40 hover:bg-surface-muted border border-transparent hover:border-emerald-500/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                  {paciente.nombre?.slice(0, 2).toUpperCase() || 'PA'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate group-hover:text-emerald-600 transition-colors">
                    {paciente.nombre}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {paciente.rut ? `RUT: ${paciente.rut}` : 'Ficha activa'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </div>
          ))}
        </div>
      )}
    </WidgetBase>
  )
}
