import React from 'react'
import { AlertTriangle, ShieldAlert, HeartPulse, Baby, Eye, Activity } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import type { Paciente } from '../../schemas/pacienteSchema'

interface AlertasCriticasHeaderProps {
  paciente: Paciente
  onModoQuirurgico?: () => void
  onModoPresentacion?: () => void
}

export const AlertasCriticasHeader: React.FC<AlertasCriticasHeaderProps> = ({
  paciente,
  onModoQuirurgico,
  onModoPresentacion,
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

  const hayAlertasCriticas =
    tieneAlergiasSeveras ||
    tieneAnticoagulantes ||
    tieneEmbarazo ||
    tieneLactancia ||
    tieneCronicas

  return (
    <div
      className="bg-surface/95 backdrop-blur-md border border-surface rounded-2xl p-4 mb-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
      data-testid="alertas-criticas-header"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-extrabold text-graphite-900 dark:text-graphite-50">
            👤 {paciente.nombreCompleto || paciente.nombre || 'Paciente'} {paciente.edad ? `· ${paciente.edad} años` : ''} · RUT: {paciente.rut || 'Sin RUT'}
          </span>
          <span className="text-xs text-graphite-500">
            Última visita: {paciente.ultimaVisita || '15 Sep 2026'} · Próxima cita: {paciente.proximaCita || '22 Oct 2026 10:00'} · Dr. tratante: {paciente.doctorTratante || 'Dr. Martínez'}
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
                ⚠️ ALERGIA SEVERA: {textoAlergias}
              </span>
            )}

            {tieneAnticoagulantes && (
              <span
                data-testid="badge-anticoagulantes"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E11D48]/15 text-[#E11D48] text-xs font-black border border-[#E11D48]/40"
              >
                <HeartPulse className="w-4 h-4 text-[#E11D48]" />
                ⚠️ Anticoagulantes
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
