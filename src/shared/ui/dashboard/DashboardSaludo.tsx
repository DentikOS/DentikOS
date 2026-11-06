import React from 'react'
import { Calendar, Clock, ChevronRight, Settings } from 'lucide-react'

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

  const userRole = (userProfile?.rol as string) || 'admin'

  let nombreMostrado = userProfile?.nombreCompleto || 'Usuario'

  if (userProfile?.nombreCompleto) {
    const limpio = userProfile.nombreCompleto.replace(/^(Dr\.|Dra\.)\s*/i, '').trim()
    const partes = limpio.split(/\s+/)
    const apellido = partes.length > 1 ? partes[partes.length - 1] : partes[0]
    const primerNombre = partes[0]

    // Roles clínicos: usar título profesional
    if (userRole === 'dentista' || userRole === 'admin') {
      const esDra = /^(Dra\.)/i.test(userProfile.nombreCompleto)
      nombreMostrado = `${esDra ? 'Dra.' : 'Dr.'} ${apellido}`
    } 
    // Roles no clínicos: usar solo el primer nombre (sin título)
    else if (userRole === 'asistente' || userRole === 'recepcion') {
      nombreMostrado = primerNombre
    }
  }

  return (
    <section className="relative isolate grid gap-5 overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#0B1120] via-[#111C2E] to-[#1D2B40] px-5 py-5 text-white shadow-[0_22px_52px_-28px_rgba(15,23,42,0.8)] sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.85fr)] lg:gap-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full bg-gold-satin/[0.16] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-[28%] h-64 w-64 rounded-full bg-sky-400/[0.07] blur-3xl" />

      <div className="relative z-10 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-[1.7rem] font-semibold leading-tight tracking-[-0.035em] text-white sm:text-4xl">
            {saludo}, <span className="text-gold-satin">{nombreMostrado}</span>
          </h1>

          {onAbrirConfig && (
            <button
              type="button"
              onClick={onAbrirConfig}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition-[background-color,color,transform] duration-150 hover:bg-white/10 hover:text-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-satin focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900"
              title="Personalizar widgets del Dashboard"
              aria-label="Personalizar widgets del Dashboard"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-300">
          <Calendar className="h-4 w-4 text-gold-satin" aria-hidden="true" />
          <span>{fechaStr}</span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span>
            {userRole === 'dentista' || userRole === 'admin'
              ? (userProfile?.especialidad || 'Práctica Odontológica')
              : userRole === 'asistente'
              ? 'Asistente Dental'
              : userRole === 'recepcion'
              ? 'Recepción'
              : (userProfile?.especialidad || 'Práctica Odontológica')}
          </span>
        </p>

        <div className="mt-6 grid max-w-md grid-cols-2 gap-2.5 border-t border-white/10 pt-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Agenda de hoy</p>
            <p className="mt-1 text-sm font-semibold text-white"><span className="text-lg tabular-nums">{citasHoyCount}</span> citas</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">En sala de espera</p>
            <p className="mt-1 text-sm font-semibold text-white"><span className="text-lg tabular-nums text-gold-satin">{enEsperaCount}</span> pacientes</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex min-w-0 items-center border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-inner shadow-white/[0.02] sm:p-5">
        {proximaCita ? (
          <button
            type="button"
            disabled={!proximaCita.pacienteId || !onVerFicha}
            onClick={() => proximaCita.pacienteId && onVerFicha?.(proximaCita.pacienteId)}
            className="group flex min-h-20 w-full min-w-0 items-center justify-between gap-4 rounded-xl text-left transition-colors hover:text-gold-satin disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-satin focus-visible:ring-offset-4 focus-visible:ring-offset-graphite-900"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-gold-satin">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Próxima cita
              </span>
              <span className="mt-2 block truncate text-base font-semibold text-white group-hover:text-gold-satin">
                {proximaCita.pacienteNombre}
              </span>
              {proximaCita.box && <span className="mt-1 block text-sm text-slate-300">{proximaCita.box}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2 rounded-xl border border-gold-satin/20 bg-gold-satin/10 px-3 py-2 text-lg font-semibold tabular-nums text-gold-satin">
              {proximaCita.hora}
              {proximaCita.pacienteId && <ChevronRight className="h-4 w-4 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-gold-satin" aria-hidden="true" />}
            </span>
          </button>
        ) : (
          <div className="flex min-h-20 items-center gap-3 py-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold-satin/20 bg-gold-satin/10">
              <Calendar className="h-5 w-5 text-gold-satin" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-white">Sin próxima cita</p>
              <p className="mt-1 text-sm text-slate-300">No hay citas programadas para hoy.</p>
            </div>
          </div>
        )}
        </div>
      </div>
    </section>
  )
}
