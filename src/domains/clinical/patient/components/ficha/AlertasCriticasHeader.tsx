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
  const tieneAlergiasSeveras =
    Array.isArray(paciente.alergiasSeveras) && paciente.alergiasSeveras.length > 0
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-graphite-500">
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/30 animate-pulse">
                <ShieldAlert className="w-4 h-4" />
                Alergias Severas: {paciente.alergiasSeveras?.join(', ')}
              </span>
            )}

            {tieneAnticoagulantes && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/30">
                <HeartPulse className="w-4 h-4" />
                Anticoagulantes Activos
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
