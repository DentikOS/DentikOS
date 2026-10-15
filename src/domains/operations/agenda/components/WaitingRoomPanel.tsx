import React, { memo, useMemo, useState, useEffect, useRef } from 'react'
import {
  Users,
  AlertCircle,
  CheckCircle2,
  Megaphone,
  Play,
  XCircle,
  Clock,
  Check,
  RefreshCw,
} from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { EmptyState } from '../../../../shared/ui/ui/EmptyState'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import {
  waitingRoomService,
  calcularEstadoFlujo,
  type WaitingRoomEvent,
} from '../services/waitingRoomService'
import { sonidoAgendaService } from '../services/sonidoAgendaService'

export interface PacienteEsperaItem {
  id: string | number
  citaId: string | number
  nombre: string
  horaLlegada: string
  boxAsignado?: string
  doctor?: string
  confirmadoWhatsApp?: boolean
  notificado?: boolean
  enAtencion?: boolean
}

export interface WaitingRoomPanelProps {
  pacientes: PacienteEsperaItem[]
  totalEnAtencion?: number
  totalCompletadasHoy?: number
  onAvisarPaciente?: (citaId: string | number) => void
  onIniciarAtencion?: (citaId: string | number) => void
  onMarcarNoShow?: (citaId: string | number) => void
  onLlamarSiguiente?: (citaId: string | number) => void
  onReasignar?: (citaId: string | number) => void
}

export const WaitingRoomPanel: React.FC<WaitingRoomPanelProps> = memo(({
  pacientes,
  totalEnAtencion = 0,
  totalCompletadasHoy = 0,
  onAvisarPaciente,
  onIniciarAtencion,
  onMarcarNoShow,
  onLlamarSiguiente,
  onReasignar,
}) => {
  const { confirm: dialogConfirm } = useAppDialog()
  const [historialPorCita, setHistorialPorCita] = useState<Map<string, WaitingRoomEvent[]>>(new Map())

  useEffect(() => {
    let isMounted = true
    const cargarHistoriales = async () => {
      const map = new Map<string, WaitingRoomEvent[]>()
      await Promise.all(
        pacientes.map(async (p) => {
          const eventos = await waitingRoomService.obtenerHistorialCita(p.citaId)
          map.set(String(p.citaId), eventos)
        })
      )
      if (isMounted) {
        setHistorialPorCita(map)
      }
    }
    cargarHistoriales()
    return () => {
      isMounted = false
    }
  }, [pacientes])

  const calcularMinutosFallback = (horaLlegada: string): number => {
    try {
      const [h, m] = horaLlegada.split(':').map(Number)
      const llegada = new Date()
      llegada.setHours(h, m, 0, 0)
      return Math.max(0, Math.floor((Date.now() - llegada.getTime()) / 60000))
    } catch {
      return 0
    }
  }

  const enEspera = useMemo(() => pacientes.filter((p) => !p.enAtencion), [pacientes])

  // BP05 §10: Monitorear esperas >20min para sonido de alerta
  const alertasActivadasRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    enEspera.forEach((paciente) => {
      const eventos = historialPorCita.get(String(paciente.citaId)) || []
      const estado = calcularEstadoFlujo(eventos)
      const minutos = estado.minutosEspera > 0 ? estado.minutosEspera : calcularMinutosFallback(paciente.horaLlegada)
      const key = String(paciente.citaId)

      if (minutos > 20 && !alertasActivadasRef.current.has(key)) {
        alertasActivadasRef.current.add(key)
        sonidoAgendaService.play('paciente_espera_larga')
      }

      if (minutos <= 20) {
        alertasActivadasRef.current.delete(key)
      }
    })
  }, [enEspera, historialPorCita])

  const handleCheckIn = async (citaId: string | number) => {
    await waitingRoomService.registrarEvento({ appointmentId: citaId, tipo: 'check_in' })
    const ev = await waitingRoomService.obtenerHistorialCita(citaId)
    setHistorialPorCita((prev) => new Map(prev).set(String(citaId), ev))
  }

  const handleLlamarSiguiente = async (citaId: string | number, doctor?: string, box?: string) => {
    await waitingRoomService.registrarEvento({
      appointmentId: citaId,
      tipo: 'llamar_siguiente',
      doctorNombre: doctor,
      boxAsignado: box,
    })
    window.dispatchEvent(new CustomEvent('sala_espera:llamada', {
      detail: { citaId, doctor, box }
    }))
    const ev = await waitingRoomService.obtenerHistorialCita(citaId)
    setHistorialPorCita((prev) => new Map(prev).set(String(citaId), ev))
    onLlamarSiguiente?.(citaId)
  }

  const handlePacienteAvisado = async (citaId: string | number) => {
    const eventos = historialPorCita.get(String(citaId)) || []
    const estado = calcularEstadoFlujo(eventos)
    await waitingRoomService.registrarEvento({
      appointmentId: citaId,
      tipo: 'paciente_avisado',
      minutosEspera: estado.minutosEspera,
    })
    window.dispatchEvent(new CustomEvent('sala_espera:paciente_avisado', { detail: { citaId } }))
    const ev = await waitingRoomService.obtenerHistorialCita(citaId)
    setHistorialPorCita((prev) => new Map(prev).set(String(citaId), ev))
    onAvisarPaciente?.(citaId)
  }

  const handleIniciarAtencion = async (citaId: string | number) => {
    const eventos = historialPorCita.get(String(citaId)) || []
    const estado = calcularEstadoFlujo(eventos)
    await waitingRoomService.registrarEvento({
      appointmentId: citaId,
      tipo: 'iniciar_atencion',
      minutosEspera: estado.minutosEspera,
    })
    const ev = await waitingRoomService.obtenerHistorialCita(citaId)
    setHistorialPorCita((prev) => new Map(prev).set(String(citaId), ev))
    onIniciarAtencion?.(citaId)
  }

  const handleNoShow = async (citaId: string | number) => {
    const confirmed = await dialogConfirm({
      title: 'Marcar como No-show',
      description: 'Confirma que el paciente no asistio a la cita clinica.',
      confirmText: 'Confirmar no-show',
      variant: 'warning',
    })
    if (confirmed) {
      await waitingRoomService.registrarEvento({
        appointmentId: citaId,
        tipo: 'no_show',
        nota: 'No asistio',
      })
      const ev = await waitingRoomService.obtenerHistorialCita(citaId)
      setHistorialPorCita((prev) => new Map(prev).set(String(citaId), ev))
      onMarcarNoShow?.(citaId)
    }
  }

  const handleReasignar = async (citaId: string | number) => {
    if (onReasignar) {
      onReasignar(citaId)
      return
    }
    const confirmed = await dialogConfirm({
      title: 'Reasignar paciente',
      description: 'Registrar solicitud de reasignacion de doctor o sillon para este paciente.',
      confirmText: 'Reasignar',
      variant: 'info',
    })
    if (confirmed) {
      await waitingRoomService.registrarEvento({
        appointmentId: citaId,
        tipo: 'reasignacion',
        nota: 'Reasignacion solicitada desde panel',
      })
      const ev = await waitingRoomService.obtenerHistorialCita(citaId)
      setHistorialPorCita((prev) => new Map(prev).set(String(citaId), ev))
    }
  }

  return (
    <div className="bg-surface border border-surface-border rounded-2xl p-4 sm:p-6 space-y-6 shadow-xs" role="region" aria-label="Sala de Espera Virtual">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-surface-border pb-4">
        <div>
          <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#B88E3A]" />
            Sala de Espera Virtual
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Control asistencial de flujo de llegada y llamada a box</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
          <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300">
            {enEspera.length} en espera
          </span>
          <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300">
            {totalEnAtencion} en atención
          </span>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
            {totalCompletadasHoy} completadas hoy
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {enEspera.length === 0 ? (
          <EmptyState compact icon={CheckCircle2} title="No hay pacientes en sala de espera" description="Todos los pacientes han sido atendidos o no registran llegada activa." />
        ) : (
          enEspera.map((paciente) => {
            const eventos = historialPorCita.get(String(paciente.citaId)) || []
            const estado = calcularEstadoFlujo(eventos)
            const minutos = estado.minutosEspera > 0 ? estado.minutosEspera : calcularMinutosFallback(paciente.horaLlegada)
            const esAlertaAmbar = minutos > 20 && minutos <= 30
            const esAlertaRoja = minutos > 30

            const mostrarCheckIn = !estado.enEspera && !estado.enAtencion && !estado.noShow
            const mostrarLlamar = estado.enEspera && !estado.llamada
            const mostrarAvisado = estado.llamada && !estado.avisado
            const mostrarIniciar = estado.avisado && !estado.enAtencion

            return (
              <div
                key={String(paciente.id || paciente.citaId)}
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  esAlertaRoja
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 shadow-xs animate-pulse'
                    : esAlertaAmbar
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 shadow-xs'
                    : 'bg-surface-muted/30 border-surface-border hover:bg-surface-muted/60'
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-[#0F172A] dark:text-white truncate">{paciente.nombre}</h3>
                    {paciente.confirmadoWhatsApp ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Confirmada WhatsApp
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                        Sin confirmación
                      </span>
                    )}
                    {estado.llamada && !estado.avisado && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 flex items-center gap-1 animate-pulse">
                        <Megaphone className="w-2.5 h-2.5" /> Llamado - Pendiente aviso
                      </span>
                    )}
                    {estado.avisado && !estado.enAtencion && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> En camino al box
                      </span>
                    )}
                    {esAlertaRoja && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-300 flex items-center gap-1 animate-pulse">
                        <AlertCircle className="w-3 h-3" /> &gt;30 min - ALERTA ADMIN
                      </span>
                    )}
                    {esAlertaAmbar && !esAlertaRoja && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> &gt;20 min espera
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#B88E3A]" />
                      Llegada: <strong>{paciente.horaLlegada}</strong> ({minutos} min)
                    </span>
                    <span>Box: <strong>{paciente.boxAsignado || 'Sin asignar'}</strong></span>
                    {paciente.doctor && <span>Doctor: <strong>{paciente.doctor}</strong></span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {mostrarCheckIn && (
                    <Button type="button" size="sm" variant="primary" onClick={() => handleCheckIn(paciente.citaId)} icon={CheckCircle2} title="Paso 0: Check-in manual - Paciente llego a recepcion">
                      Check-in
                    </Button>
                  )}
                  {mostrarLlamar && (
                    <Button type="button" size="sm" variant="primary" onClick={() => handleLlamarSiguiente(paciente.citaId, paciente.doctor, paciente.boxAsignado)} icon={Megaphone} title="Paso 1 (Doctor): Llamar siguiente paciente">
                      Llamar siguiente
                    </Button>
                  )}
                  {mostrarAvisado && (
                    <Button type="button" size="sm" variant="primary" onClick={() => handlePacienteAvisado(paciente.citaId)} icon={CheckCircle2} title="Paso 2 (Recepcionista): Confirmar que el paciente fue avisado">
                      Paciente avisado
                    </Button>
                  )}
                  {mostrarIniciar && (
                    <Button type="button" size="sm" variant="primary" onClick={() => handleIniciarAtencion(paciente.citaId)} icon={Play} title="Paso 3 (Doctor): Iniciar atencion - Pasa a En atencion">
                      Iniciar atencion
                    </Button>
                  )}
                  {estado.enEspera && (
                    <>
                      <Button type="button" size="sm" variant="outline" onClick={() => handleReasignar(paciente.citaId)} icon={RefreshCw} title="Reasignar a otro doctor o box">
                        Reasignar
                      </Button>
                      <Button type="button" size="sm" variant="danger" onClick={() => handleNoShow(paciente.citaId)} icon={XCircle} title="Marcar como No-show">
                        No-show
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
})

WaitingRoomPanel.displayName = 'WaitingRoomPanel'
