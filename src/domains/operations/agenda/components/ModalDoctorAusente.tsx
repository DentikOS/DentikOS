import React, { useState } from 'react'
import { UserX, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { procesarAusenciaDoctor, type ResultadoReasignacion } from '../services/doctorAusenteService'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import type { Cita } from '../schemas/citaSchema'
import type { DoctorAgenda } from '../services/agendaConfigService'

export interface ModalDoctorAusenteProps {
  isOpen: boolean
  doctoresDisponibles: DoctorAgenda[]
  citasActuales: Cita[]
  alCerrar: () => void
  alProcesar: (resultado: ResultadoReasignacion) => void
}

export const ModalDoctorAusente: React.FC<ModalDoctorAusenteProps> = ({
  isOpen,
  doctoresDisponibles,
  citasActuales,
  alCerrar,
  alProcesar,
}) => {
  const { alert: dialogAlert } = useAppDialog()
  const [doctorSeleccionado, setDoctorSeleccionado] = useState<string>('')
  const [fecha, setFecha] = useState<string>(obtenerFechaLocalISO())
  const [procesando, setProcesando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoReasignacion | null>(null)

  const doctor = doctoresDisponibles.find(d => d.userId === doctorSeleccionado)

  const citasAfectadas = citasActuales.filter(c =>
    String(c.doctor) === String(doctorSeleccionado) &&
    c.fecha === fecha &&
    c.estado !== 'Cancelada' &&
    c.estado !== 'Completada'
  )

  const handleProcesar = async () => {
    if (!doctor) return
    
    const confirmacion = await dialogAlert({
      title: 'Confirmar ausencia',
      description: `Se marcarán ${citasAfectadas.length} cita(s) de ${doctor.nombreCompleto} como pendientes de reasignación manual por la recepcionista.`,
      variant: 'warning',
      confirmText: 'Confirmar ausencia',
      cancelText: 'Cancelar',
    } as any)

    if (!(confirmacion as any)?.confirmed) return

    setProcesando(true)
    try {
      const res = await procesarAusenciaDoctor(
        doctor.userId,
        doctor.nombreCompleto,
        fecha,
        citasActuales
      )
      setResultado(res)
      alProcesar(res)
    } finally {
      setProcesando(false)
    }
  }

  const handleCerrar = () => {
    setResultado(null)
    setDoctorSeleccionado('')
    alCerrar()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleCerrar} title="Doctor ausente" size="md">
      <div className="space-y-4">
        {!resultado ? (
          <>
            {/* Aviso */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 dark:text-amber-200">
                <strong>Importante:</strong> Las citas quedarán marcadas como pendientes de reasignación. La recepcionista las moverá manualmente a otros doctores disponibles.
              </p>
            </div>

            {/* Select doctor */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Doctor ausente
              </label>
              <select
                value={doctorSeleccionado}
                onChange={(e) => setDoctorSeleccionado(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-surface-border bg-surface text-xs font-semibold"
              >
                <option value="">Selecciona un doctor...</option>
                {doctoresDisponibles.map(d => (
                  <option key={d.userId} value={d.userId}>
                    {d.nombreCompleto} {d.especialidad ? `— ${d.especialidad}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Fecha de ausencia
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-surface-border bg-surface text-xs font-semibold"
              />
            </div>

            {/* Preview de citas afectadas */}
            {doctorSeleccionado && (
              <div className="p-3 rounded-xl bg-surface-muted/50 border border-surface-border">
                <p className="text-xs font-bold text-[#0F172A] dark:text-white mb-2">
                  {citasAfectadas.length} cita(s) afectada(s)
                </p>
                {citasAfectadas.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No hay citas activas en esta fecha</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {citasAfectadas.map(c => (
                      <div key={String(c.id)} className="flex items-center justify-between text-[11px] py-1">
                        <span className="text-slate-700 dark:text-slate-300 truncate">
                          {c.pacienteNombre || 'Paciente'}
                        </span>
                        <span className="text-slate-500 shrink-0 ml-2">
                          {c.horaInicio} — {c.boxAsignado || 'Box'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
              <Button size="sm" variant="ghost" onClick={handleCerrar}>
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={handleProcesar}
                icon={UserX}
                disabled={!doctorSeleccionado || citasAfectadas.length === 0 || procesando}
              >
                {procesando ? 'Procesando...' : 'Confirmar ausencia'}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Resultado */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Ausencia registrada correctamente
                </p>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-1">
                  {resultado.pendientesRevision} cita(s) marcada(s) como pendiente de reasignación. La recepcionista las redistribuirá desde la agenda.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-surface-border">
              <Button size="sm" variant="primary" onClick={handleCerrar}>
                Cerrar
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
