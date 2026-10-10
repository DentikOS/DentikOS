import React from 'react'
import { Calendar, Clock, ChevronRight } from 'lucide-react'

export interface DashboardSaludoProps {
  userProfile?: {
    nombreCompleto?: string
    especialidad?: string
    rol?: string
  } | null
  citasHoyCount?: number
  enEsperaCount?: number
  proximaCita?: {
    pacienteNombre: string
    hora: string
    box?: string
    pacienteId?: string | number
  } | null
  onVerFicha?: (pacienteId: string | number) => void
  onAbrirConfig?: () => void
}

const obtenerSaludo = (hora: number): string => {
  if (hora >= 6 && hora < 12) return 'Buenos días'
  if (hora >= 12 && hora < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

const formatearFechaEspanol = (date: Date): string => {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]
  const diaSemana = dias[date.getDay()]
  const dia = date.getDate()
  const mes = meses[date.getMonth()]
  return `${diaSemana} ${dia} de ${mes}`
}

export const DashboardSaludo: React.FC<DashboardSaludoProps> = ({
  userProfile,
  citasHoyCount = 0,
  enEsperaCount = 0,
  proximaCita,
  onVerFicha,
  onAbrirConfig
}) => {
  const now = new Date()
  const saludo = obtenerSaludo(now.getHours())
  const fechaStr = formatearFechaEspanol(now)

  let nombreMostrado = userProfile?.nombreCompleto || 'Doctor(a)'
  if (userProfile?.nombreCompleto) {
    const limpio = userProfile.nombreCompleto.replace(/^(Dr\.|Dra\.)\s*/i, '').trim()
    const partes = limpio.split(/\s+/)
    const apellido = partes.length > 1 ? partes[partes.length - 1] : partes[0]
    const esDra = /^(Dra\.)/i.test(userProfile.nombreCompleto)
    nombreMostrado = `${esDra ? 'Dra.' : 'Dr.'} ${apellido}`
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-surface-border">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-[#475569] dark:text-slate-400 mb-1">
          <Calendar className="w-3.5 h-3.5 text-[#B88E3A]" />
          <span>{fechaStr}</span>
          <span className="text-surface-border">·</span>
          <span>{userProfile?.especialidad || 'Práctica Odontológica'}</span>
        </div>
        <h1 className="text-[28px] sm:text-[32px] font-bold text-[#0F172A] dark:text-white tracking-tight leading-tight">
          {saludo}, <span className="text-[#B88E3A]">{nombreMostrado}</span>
        </h1>
        <p className="text-sm text-[#475569] dark:text-slate-300 mt-1 flex items-center gap-2">
          <span className="font-semibold text-[#0F172A] dark:text-white">{citasHoyCount} citas hoy</span>
          <span>·</span>
          <span className="text-[#B88E3A] font-semibold">{enEsperaCount} en sala de espera</span>
        </p>
      </div>

      <div className="flex items-center gap-3">
        {proximaCita && (
          <div
            onClick={() => proximaCita.pacienteId && onVerFicha?.(proximaCita.pacienteId)}
            role={proximaCita.pacienteId ? 'button' : undefined}
            tabIndex={proximaCita.pacienteId ? 0 : undefined}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface border border-surface-border shadow-xs transition-all ${
              proximaCita.pacienteId ? 'hover:border-[#B88E3A] cursor-pointer group' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-[#B88E3A]/10 text-[#B88E3A] flex items-center justify-center font-bold text-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-left text-xs">
              <p className="text-[11px] text-[#475569] dark:text-slate-400 font-medium">Próxima cita</p>
              <p className="font-semibold text-[#0F172A] dark:text-white group-hover:text-[#B88E3A] transition-colors">
                {proximaCita.pacienteNombre} <span className="text-[#B88E3A]">{proximaCita.hora}</span>
                {proximaCita.box ? ` — ${proximaCita.box}` : ''}
              </p>
            </div>
            {proximaCita.pacienteId && (
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-[#B88E3A] transition-all" />
            )}
          </div>
        )}

        {onAbrirConfig && (
          <button
            type="button"
            onClick={onAbrirConfig}
            className="p-2.5 rounded-xl border border-surface-border text-slate-500 hover:text-[#B88E3A] hover:bg-surface transition-all cursor-pointer"
            title="Personalizar Dashboard"
            aria-label="Personalizar Dashboard"
          >
            ⚙️
          </button>
        )}
      </div>
    </div>
  )
}
