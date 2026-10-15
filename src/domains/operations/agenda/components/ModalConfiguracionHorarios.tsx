import React, { useState, useEffect } from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { agendaConfigService, type DoctorAgenda } from '../services/agendaConfigService'
import { DIAS_SEMANA, COLORES_DOCTOR } from '../constants/doctorConstants'

export interface ModalConfiguracionHorariosProps {
  isOpen: boolean
  alCerrar: () => void
  alGuardar: () => void
}

export const ModalConfiguracionHorarios: React.FC<ModalConfiguracionHorariosProps> = ({
  isOpen,
  alCerrar,
  alGuardar,
}) => {
  const [doctores, setDoctores] = useState<DoctorAgenda[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [doctorSeleccionadoId, setDoctorSeleccionadoId] = useState<string>('')

  useEffect(() => {
    if (!isOpen) return
    let activo = true
    setLoading(true)
    agendaConfigService.obtenerDoctoresAgenda()
      .then((docs) => {
        if (!activo) return
        setDoctores(docs)
        if (docs.length > 0) setDoctorSeleccionadoId(docs[0].userId)
      })
      .catch(() => { if (activo) setDoctores([]) })
      .finally(() => { if (activo) setLoading(false) })
    return () => { activo = false }
  }, [isOpen])

  const doctorActual = doctores.find((d) => d.userId === doctorSeleccionadoId) || doctores[0]

  const actualizarDoctorActual = (cambios: Partial<DoctorAgenda>) => {
    if (!doctorActual) return
    setDoctores((prev) => prev.map((d) => (d.userId === doctorActual.userId ? { ...d, ...cambios } : d)))
  }

  const handleGuardar = async () => {
    setGuardando(true)
    try {
      const userProfile = useSesionStore.getState().userProfile
      const clinicaId = (userProfile as { clinicaId?: string })?.clinicaId || ''

      for (const doctor of doctores) {
        await agendaConfigService.actualizarConfigAgenda(doctor.userId, {
          permiteSobrecupos: doctor.permiteSobrecupos,
          maxSobrecupos: doctor.maxSobrecupos,
          colorIdentidad: doctor.colorIdentidad,
        })
        if (doctor.horarios?.length && clinicaId) {
          await agendaConfigService.actualizarHorariosUsuario(doctor.userId, clinicaId, doctor.horarios)
        }
      }
      alGuardar(); alCerrar()
    } catch (err) {
      console.error('Error guardando configuración de horarios:', err)
    } finally {
      setGuardando(false)
    }
  }

  const actualizarHorarioDia = (diaSemana: number, campo: 'horaInicio' | 'horaFin', valor: string) => {
    if (!doctorActual) return
    actualizarDoctorActual({
      horarios: (doctorActual.horarios || []).map((h) => h.diaSemana === diaSemana ? { ...h, [campo]: valor } : h)
    })
  }

  const toggleDia = (diaSemana: number, activar: boolean) => {
    if (!doctorActual) return
    const cur = doctorActual.horarios || []
    actualizarDoctorActual({
      horarios: activar
        ? [...cur, { diaSemana, horaInicio: '09:00', horaFin: '18:00', duracionBloqueMinutos: 30 }]
        : cur.filter((h) => h.diaSemana !== diaSemana)
    })
  }

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={alCerrar} title="Configurar Horarios">
        <div className="p-8 text-center text-slate-500 font-semibold text-xs">Cargando doctores...</div>
      </Modal>
    )
  }

  if (doctores.length === 0) {
    return (
      <Modal isOpen={isOpen} onClose={alCerrar} title="Configurar Horarios">
        <div className="p-6 text-center space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300 font-medium">No hay doctores registrados en esta clínica.</p>
          <Button variant="secondary" onClick={alCerrar} type="button">Cerrar</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={alCerrar} title="Configurar Horarios por Doctor y Sede" size="lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="border border-surface-border rounded-xl p-3 space-y-2 bg-surface-muted/30">
          <p className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[10px]">
            Profesionales ({doctores.length})
          </p>
          <div className="space-y-1">
            {doctores.map((doc) => {
              const seleccionado = doc.userId === doctorActual?.userId
              return (
                <button
                  key={doc.userId}
                  type="button"
                  onClick={() => setDoctorSeleccionadoId(doc.userId)}
                  className={`w-full text-left p-2.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center justify-between ${
                    seleccionado ? 'bg-primary text-black font-bold shadow-xs' : 'hover:bg-surface text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: doc.colorIdentidad || '#64748B' }} />
                    <span className="truncate">{doc.nombreCompleto}</span>
                  </div>
                  {doc.permiteSobrecupos && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">Sobrecupo</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {doctorActual && (
          <div className="md:col-span-2 space-y-4 border border-surface-border rounded-xl p-4 bg-surface">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div>
                <h4 className="font-bold text-sm text-[#0F172A] dark:text-white">{doctorActual.nombreCompleto}</h4>
                <p className="text-slate-500 text-[11px]">{doctorActual.especialidad || 'General'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Color:</span>
                <div className="flex items-center gap-1">
                  {COLORES_DOCTOR.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => actualizarDoctorActual({ colorIdentidad: color })}
                      style={{ backgroundColor: color }}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        doctorActual.colorIdentidad === color ? 'scale-125 ring-2 ring-offset-2 ring-primary' : 'opacity-70 hover:opacity-100'
                      }`}
                      aria-label={`Color ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-muted/50 border border-surface-border flex items-center justify-between gap-3">
              <div>
                <label className="font-bold text-xs text-[#0F172A] dark:text-white block">Permitir sobrecupos</label>
                <p className="text-slate-500 text-[11px]">Si está activado, se pueden agendar 2 pacientes en el mismo horario con alerta visual</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={doctorActual.permiteSobrecupos ?? true}
                  onChange={(e) => actualizarDoctorActual({ permiteSobrecupos: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                />
                {doctorActual.permiteSobrecupos && (
                  <select
                    value={doctorActual.maxSobrecupos ?? 2}
                    onChange={(e) => actualizarDoctorActual({ maxSobrecupos: parseInt(e.target.value, 10) })}
                    className="p-1 rounded-lg border border-surface-border text-xs font-bold bg-surface cursor-pointer"
                  >
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Máx {n}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-xs text-[#0F172A] dark:text-white">Horarios de Atención Semanales</p>
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {DIAS_SEMANA.map((dia) => {
                  const horario = (doctorActual.horarios || []).find((h) => h.diaSemana === dia.value)
                  const activo = Boolean(horario)
                  return (
                    <div key={dia.value} className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                      activo ? 'border-surface-border bg-surface-muted/20' : 'border-dashed border-surface-border/60 bg-transparent opacity-60'
                    }`}>
                      <label className="flex items-center gap-2 cursor-pointer font-bold select-none">
                        <input
                          type="checkbox"
                          checked={activo}
                          onChange={(e) => toggleDia(dia.value, e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-primary focus:ring-primary cursor-pointer"
                        />
                        <span className="w-16">{dia.label}</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        {activo ? (
                          <>
                            <input
                              type="time"
                              value={horario?.horaInicio || '09:00'}
                              onChange={(e) => actualizarHorarioDia(dia.value, 'horaInicio', e.target.value)}
                              className="p-1 border border-surface-border rounded bg-surface text-xs font-semibold"
                            />
                            <span className="text-slate-400">a</span>
                            <input
                              type="time"
                              value={horario?.horaFin || '18:00'}
                              onChange={(e) => actualizarHorarioDia(dia.value, 'horaFin', e.target.value)}
                              className="p-1 border border-surface-border rounded bg-surface text-xs font-semibold"
                            />
                          </>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic pr-2">No atiende</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-surface-border mt-4">
        <Button variant="ghost" onClick={alCerrar} type="button" disabled={guardando}>Cancelar</Button>
        <Button variant="primary" onClick={handleGuardar} type="button" disabled={guardando || doctores.length === 0}>
          {guardando ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>
    </Modal>
  )
}
