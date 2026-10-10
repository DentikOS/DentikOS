import React, { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Clock, AlertTriangle, FileText, XCircle, ChevronRight, Activity } from 'lucide-react'
import { useThemeStore } from '../../../../app/stores/useThemeStore'
import type { Cita } from '../schemas/citaSchema'

export interface AgendaQuirurgicaProps {
  citas?: Cita[]
  onAbrirFicha?: (cita: Cita) => void
  onSalir?: () => void
}

export const AgendaQuirurgica: React.FC<AgendaQuirurgicaProps> = memo(({
  citas = [],
  onAbrirFicha,
  onSalir
}) => {
  const setTheme = useThemeStore((state) => state.setTheme)
  const [segundos, setSegundos] = useState<number>(0)

  useEffect(() => {
    const timer = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleSalir = useCallback(() => {
    if (onSalir) onSalir()
    else setTheme('light')
  }, [onSalir, setTheme])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSalir()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSalir])

  const { pacienteActual, proximaCita, totales, completadas, restantes } = useMemo(() => {
    const enAtencion = citas.find((c) => c.estado === 'En atención' || c.estado === 'En Sillón')
    const actual = enAtencion || citas[0] || null

    const siguientes = citas.filter(
      (c) => c.id !== actual?.id && (c.estado === 'Confirmada' || c.estado === 'Confirmado' || c.estado === 'Pendiente')
    )
    const proxima = siguientes[0] || null

    const comp = citas.filter((c) => c.estado === 'Completada' || c.estado === 'Atendido').length
    const rest = citas.filter((c) => c.estado !== 'Completada' && c.estado !== 'Atendido' && c.estado !== 'Cancelada').length

    return {
      pacienteActual: actual,
      proximaCita: proxima,
      totales: citas.length,
      completadas: comp,
      restantes: rest
    }
  }, [citas])

  const minutos = Math.floor(segundos / 60)
  const segs = segundos % 60
  const tiempoFormateado = `${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`

  const nombrePaciente = pacienteActual?.pacienteNombre || 'Sin paciente en box'
  const boxActual = pacienteActual?.boxAsignado || 'Box Quirúrgico'
  const motivoAtencion = pacienteActual?.trataMiento || pacienteActual?.motivo || 'Procedimiento Quirúrgico'
  const alergias = (pacienteActual as { alergias?: string })?.alergias || 'Penicilina / AINEs (Precaución obligatoria)'

  return (
    <div
      className="min-h-[85vh] p-6 rounded-3xl border-4 border-slate-400 shadow-2xl flex flex-col justify-between text-black select-none"
      style={{ backgroundColor: '#CBD5E1' }}
      role="region"
      aria-label="Modo Quirúrgico de Agenda"
    >
      {/* Barra superior de control */}
      <div className="flex items-center justify-between pb-4 border-b-2 border-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center font-bold">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-slate-700">
              Pantalla Quirúrgica Antirreflejo · Entre Pacientes
            </span>
            <h1 className="text-2xl font-black text-black tracking-tight">
              AGENDA QUIRÚRGICA
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSalir}
          className="min-h-[48px] min-w-[48px] px-5 py-3 rounded-2xl bg-black text-white hover:bg-slate-900 border-2 border-black font-bold text-sm flex items-center gap-2 shadow-md cursor-pointer transition-transform active:scale-95"
          title="Salir del Modo Quirúrgico (Esc)"
        >
          <XCircle className="w-5 h-5 text-rose-400" />
          <span>Salir del Quirófano (Esc)</span>
        </button>
      </div>

      {/* Panel central de paciente en box y alertas críticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
        {/* Paciente y Timer */}
        <div className="md:col-span-2 p-6 rounded-2xl bg-white border-2 border-black shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-slate-200 text-black font-bold text-xs uppercase">
                {boxActual}
              </span>
              <div className="flex items-center gap-2 text-black font-mono font-bold text-lg">
                <Clock className="w-5 h-5 text-slate-700" />
                <span>{tiempoFormateado}</span>
              </div>
            </div>
            <h2 className="text-3xl font-black text-black mt-3">
              {nombrePaciente}
            </h2>
            <p className="text-sm font-semibold text-slate-700 mt-1">
              {motivoAtencion}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 items-center">
            {pacienteActual && onAbrirFicha && (
              <button
                type="button"
                onClick={() => onAbrirFicha(pacienteActual)}
                className="min-h-[48px] px-6 py-3 rounded-2xl bg-black text-white hover:bg-slate-800 border-2 border-black font-bold text-sm flex items-center gap-2 cursor-pointer shadow-md"
              >
                <FileText className="w-5 h-5 text-amber-300" />
                <span>Abrir Ficha Clínica</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
        </div>

        {/* Alertas críticas del paciente actual */}
        <div className="p-6 rounded-2xl bg-rose-100 border-2 border-rose-600 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-5 h-5 text-rose-700" />
              <span>Alertas Críticas</span>
            </div>
            <h3 className="text-lg font-black text-rose-950 mt-2">
              Contraindicaciones & Alergias
            </h3>
            <p className="text-sm font-bold text-rose-900 mt-2 leading-relaxed bg-white/70 p-3 rounded-xl border border-rose-300">
              {alergias}
            </p>
          </div>
          <p className="text-xs font-bold text-rose-800 mt-4">
            Aislamiento absoluto obligatorio
          </p>
        </div>
      </div>

      {/* Barra inferior: Próxima cita y resumen del día */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t-2 border-slate-400">
        <div className="p-4 rounded-xl bg-slate-200 border border-slate-400 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase">Próxima cita de la lista</p>
            <p className="text-base font-black text-black mt-0.5">
              {proximaCita?.pacienteNombre || 'Sin más citas'} — {proximaCita?.horaInicio || '--:--'} ({proximaCita?.boxAsignado || 'Box'})
            </p>
          </div>
          <span className="px-3 py-1 bg-white rounded-lg text-xs font-bold text-black border border-slate-400">
            A continuación
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-200 border border-slate-400 flex items-center justify-around text-center">
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase">Totales</p>
            <p className="text-xl font-black text-black">{totales}</p>
          </div>
          <div className="h-8 w-px bg-slate-400" />
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase">Completadas</p>
            <p className="text-xl font-black text-emerald-800">{completadas}</p>
          </div>
          <div className="h-8 w-px bg-slate-400" />
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase">Restantes</p>
            <p className="text-xl font-black text-rose-800">{restantes}</p>
          </div>
        </div>
      </div>
    </div>
  )
})

AgendaQuirurgica.displayName = 'AgendaQuirurgica'
