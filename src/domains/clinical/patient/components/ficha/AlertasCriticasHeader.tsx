import React from 'react'
import { AlertTriangle, ShieldAlert, HeartPulse, Baby, Eye, Activity } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import {
  debePreguntarEmbarazo,
  validarAnticoagulantesCirugia,
} from '../../services/validacionesCruzadasClinicas'
import { useProximaCita } from '../../hooks/useProximaCita'
import { formatearDoctorTratante } from '../../utils/formatearDoctor'
import type { Paciente } from '../../schemas/pacienteSchema'

interface AlertasCriticasHeaderProps {
  paciente: Paciente
  onModoQuirurgico?: () => void
  onModoPresentacion?: () => void
  onResponderEmbarazo?: (embarazo: boolean) => void
}

export const AlertasCriticasHeader: React.FC<AlertasCriticasHeaderProps> = ({
  paciente,
  onModoQuirurgico,
  onModoPresentacion,
  onResponderEmbarazo,
}) => {
  const textoAlergias =
    Array.isArray(paciente.alergiasSeveras) && paciente.alergiasSeveras.length > 0
      ? paciente.alergiasSeveras.join(', ')
      : Array.isArray(paciente.alergias)
      ? paciente.alergias.join(', ')
      : typeof paciente.alergias === 'string' && paciente.alergias.trim()
      ? paciente.alergias.trim()
      : ''
  const tieneAlergiasSeveras = Boolean(textoAlergias)
  const tieneAnticoagulantes = Boolean(paciente.anticoagulantes)
  const tieneEmbarazo = Boolean(paciente.embarazo)
  const tieneLactancia = Boolean(paciente.lactancia)
  const tieneCronicas =
    Array.isArray(paciente.enfermedadesCronicas) && paciente.enfermedadesCronicas.length > 0

  const alertaCirugia = validarAnticoagulantesCirugia(
    tieneAnticoagulantes,
    Boolean((paciente as any).proximoTratamientoQuirurgico || (paciente as any).alertaCirugia)
  )

  const hayAlertasCriticas =
    tieneAlergiasSeveras ||
    tieneAnticoagulantes ||
    tieneEmbarazo ||
    tieneLactancia ||
    tieneCronicas ||
    debePreguntarEmbarazo(paciente)

  const proximaCita = useProximaCita(paciente.id)
  const { texto: doctorTexto } = formatearDoctorTratante(paciente.doctorTratante, paciente.doctorTratanteId)
  const fechaUltima = paciente.fechaUltimaVisita || (paciente as unknown as Record<string, unknown>).ultimaVisita

  return (
    <div
      className="bg-surface/95 backdrop-blur-md border border-surface rounded-2xl p-4 mb-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
      data-testid="alertas-criticas-header"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-extrabold text-graphite-900 dark:text-graphite-50">
            {paciente.nombreCompleto || paciente.nombre || 'Paciente'} {paciente.edad ? `· ${paciente.edad} años` : ''} · RUT: {paciente.rut || 'Sin RUT'}
          </span>
          <span className="text-xs text-graphite-500 flex items-center gap-1.5 flex-wrap">
            <span>
              Última visita: {fechaUltima ? (
                new Date(String(fechaUltima)).toLocaleDateString('es-CL')
              ) : (
                <span className="text-graphite-400 italic">Sin registro</span>
              )}
            </span>
            <span>·</span>
            <span>
              Próxima cita: {proximaCita ? (
                `${proximaCita.fecha} ${proximaCita.horaInicio || ''}`.trim()
              ) : paciente.proximaCita ? (
                String(paciente.proximaCita)
              ) : (
                <span className="text-graphite-400 italic">Sin cita</span>
              )}
            </span>
            <span>·</span>
            <span>
              Dr. tratante: {doctorTexto || <span className="text-graphite-400 italic">Sin asignar</span>}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-500">
            Alertas Críticas
          </span>
          {!hayAlertasCriticas && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Sin contraindicaciones médicas registradas
            </span>
          )}
        </div>

        {hayAlertasCriticas && (
          <div className="flex flex-wrap gap-2 mt-2">
            {tieneAlergiasSeveras && (
              <span
                data-testid="badge-alergia-severa"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E11D48]/15 text-[#E11D48] text-xs font-black border border-[#E11D48]/40 animate-pulse"
              >
                <ShieldAlert className="w-4 h-4 text-[#E11D48]" />
                ALERGIA SEVERA: {textoAlergias}
              </span>
            )}

            {tieneAnticoagulantes && (
              <span
                data-testid="badge-anticoagulantes"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E11D48]/15 text-[#E11D48] text-xs font-black border border-[#E11D48]/40"
              >
                <HeartPulse className="w-4 h-4 text-[#E11D48]" />
                Anticoagulantes
              </span>
            )}

            {tieneEmbarazo && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 text-xs font-bold border border-purple-500/30">
                <Baby className="w-4 h-4" />
                Embarazo
              </span>
            )}

            {tieneLactancia && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/30">
                <AlertTriangle className="w-4 h-4" />
                Lactancia
              </span>
            )}

            {tieneCronicas && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 text-xs font-semibold border border-orange-500/30">
                <Activity className="w-4 h-4" />
                Crónicas: {paciente.enfermedadesCronicas?.join(', ')}
              </span>
            )}

            {alertaCirugia.alertaQuirurgica && (
              <span
                data-testid="badge-alerta-quirurgica"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E11D48]/20 text-[#E11D48] text-xs font-black border border-[#E11D48]/50 animate-pulse"
              >
                <AlertTriangle className="w-4 h-4 text-[#E11D48]" />
                {alertaCirugia.mensaje}
              </span>
            )}
          </div>
        )}

        {debePreguntarEmbarazo(paciente) && (
          <div
            data-testid="banner-pregunta-embarazo"
            className="mt-3 p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-between gap-2 text-xs"
          >
            <span className="font-semibold text-purple-700 dark:text-purple-300">
              Paciente en rango fértil (12-55 años): ¿Se encuentra actualmente en embarazo o lactancia?
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onResponderEmbarazo?.(true)}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => onResponderEmbarazo?.(false)}
                className="px-2.5 py-1 bg-surface border border-surface hover:bg-surface-hover text-graphite-700 rounded-lg font-bold text-xs"
              >
                No
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
        {onModoQuirurgico && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={Activity}
            onClick={onModoQuirurgico}
            data-testid="btn-modo-quirurgico"
          >
            Modo Quirúrgico
          </Button>
        )}

        {onModoPresentacion && (
          <Button
            type="button"
            size="sm"
            variant="primary"
            icon={Eye}
            onClick={onModoPresentacion}
            data-testid="btn-modo-presentacion"
          >
            Modo Presentación
          </Button>
        )}
      </div>
    </div>
  )
}
