import React, { useState, useEffect } from 'react'
import { Megaphone, Clock, AlertTriangle } from 'lucide-react'
import {
  waitingRoomService,
  calcularEstadoFlujo,
  type WaitingRoomEvent,
} from '../services/waitingRoomService'
import { useSesionStore } from '../../../../app/stores/sesionStore'

export interface DoctorWaitingRoomBarProps {
  onLlamarSiguiente?: (citaId: string | number) => void
}

interface ItemPacienteEnEspera {
  citaId: string | number
  estado: ReturnType<typeof calcularEstadoFlujo>
  ultimoEvento?: WaitingRoomEvent
}

export const DoctorWaitingRoomBar: React.FC<DoctorWaitingRoomBarProps> = ({
  onLlamarSiguiente,
}) => {
  const userProfile = useSesionStore((s) => s.userProfile)
  const esDoctor = userProfile?.rol === 'dentista' || userProfile?.rol === 'admin'
  const [pacientesEnEspera, setPacientesEnEspera] = useState<ItemPacienteEnEspera[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!esDoctor) return

    let isMounted = true

    const cargarPacientes = async () => {
      try {
        const eventos = await waitingRoomService.obtenerSalaEsperaActual()
        if (!isMounted) return

        const agrupados = new Map<string, WaitingRoomEvent[]>()
        eventos.forEach((e) => {
          const key = String(e.appointmentId)
          const arr = agrupados.get(key) || []
          arr.push(e)
          agrupados.set(key, arr)
        })

        const enEspera: ItemPacienteEnEspera[] = Array.from(agrupados.entries())
          .map(([citaId, eventosCita]) => {
            const estado = calcularEstadoFlujo(eventosCita)
            return {
              citaId,
              estado,
              ultimoEvento: eventosCita[0],
            }
          })
          .filter((p) => p.estado.enEspera && !p.estado.llamada)
          .sort((a, b) => b.estado.minutosEspera - a.estado.minutosEspera)

        setPacientesEnEspera(enEspera)
      } catch (err) {
        console.error('Error cargando pacientes en espera:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    cargarPacientes()
    const interval = setInterval(cargarPacientes, 30000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [esDoctor])

  useEffect(() => {
    const handlePacienteAvisado = () => {
      // Refresh list when receptionist marks patient as advised
      waitingRoomService.obtenerSalaEsperaActual().then((eventos) => {
        const agrupados = new Map<string, WaitingRoomEvent[]>()
        eventos.forEach((e) => {
          const key = String(e.appointmentId)
          const arr = agrupados.get(key) || []
          arr.push(e)
          agrupados.set(key, arr)
        })
        const enEspera = Array.from(agrupados.entries())
          .map(([citaId, eventosCita]) => ({
            citaId,
            estado: calcularEstadoFlujo(eventosCita),
            ultimoEvento: eventosCita[0],
          }))
          .filter((p) => p.estado.enEspera && !p.estado.llamada)
          .sort((a, b) => b.estado.minutosEspera - a.estado.minutosEspera)
        setPacientesEnEspera(enEspera)
      })
    }

    window.addEventListener('sala_espera:paciente_avisado', handlePacienteAvisado)
    window.addEventListener('sala_espera:llamada', handlePacienteAvisado)
    return () => {
      window.removeEventListener('sala_espera:paciente_avisado', handlePacienteAvisado)
      window.removeEventListener('sala_espera:llamada', handlePacienteAvisado)
    }
  }, [])

  if (!esDoctor || loading || pacientesEnEspera.length === 0) return null

  return (
    <div
      className="bg-surface border border-surface-border rounded-2xl p-3 shadow-xs mb-4"
      role="region"
      aria-label="Pacientes en espera"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#B88E3A]" />
          Sala de Espera: {pacientesEnEspera.length} paciente
          {pacientesEnEspera.length === 1 ? '' : 's'}
        </h3>
      </div>
      <div className="space-y-2">
        {pacientesEnEspera.slice(0, 3).map((p) => {
          const esAlerta = p.estado.minutosEspera > 20
          const esCritica = p.estado.minutosEspera > 30
          return (
            <div
              key={p.citaId}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                esCritica
                  ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300'
                  : esAlerta
                  ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300'
                  : 'bg-surface-muted/30 border-surface-border'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {esCritica && (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                )}
                {esAlerta && !esCritica && (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                    {p.ultimoEvento?.doctorNombre || 'Paciente'} - {p.estado.minutosEspera} min
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {p.ultimoEvento?.boxAsignado || 'Sin box'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onLlamarSiguiente?.(p.citaId)}
                className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#B88E3A] text-white hover:bg-[#a07a30] transition-colors flex items-center gap-1 cursor-pointer"
                title="Llamar siguiente paciente"
              >
                <Megaphone className="w-3 h-3" />
                Llamar
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

DoctorWaitingRoomBar.displayName = 'DoctorWaitingRoomBar'
