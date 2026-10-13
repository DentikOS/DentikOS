/**
 * SelectorSede — Selector y visualizador de sede activa (Blueprint 03 §04)
 *
 * Siempre visible en desktop con:
 * - Punto indicador (#0D9488) de sincronización
 * - Icono MapPin dorado (#D4AF37)
 * - Nombre de sede activa (fallback 'Sede Principal' si no hay sedes)
 * - Indicador dropdown ▼ (interactivo incluso con 1 sede)
 */
import React from 'react'
import { MapPin } from 'lucide-react'
import { useSedes } from '../../domains/organization/clinic/hooks/useSedes'
import { useSesionStore } from '../../app/stores/sesionStore'
import { notificationService } from '../../infrastructure/notification/notificationService'
import { playSound } from '../utils/soundEffects'

export interface SelectorSedeProps {
  onCambioSede?: (sedeId: string) => void
  className?: string
  compacto?: boolean
  sincronizado?: boolean
}

export const SelectorSede: React.FC<SelectorSedeProps> = ({
  onCambioSede,
  className = '',
  compacto = false,
  sincronizado = true,
}) => {
  const { sedes = [], sedeActiva, sedeActivaId, cambiarSede } = useSedes()
  const storeCambiarSede = useSesionStore((s) => s.cambiarSede)

  if (!sedes || sedes.length <= 1) {
    return null
  }

  const listaSedes = sedes
  const valorActivo = sedeActivaId || sedeActiva?.id || listaSedes[0]?.id || ''

  const handleSeleccion = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevaSedeId = e.target.value
    cambiarSede(nuevaSedeId)
    storeCambiarSede(nuevaSedeId)
    const sedeObj = listaSedes.find((s) => (s.id || s.nombre) === nuevaSedeId)
    const nombreSede = sedeObj?.nombre || nuevaSedeId
    notificationService.mostrar(`Sede cambiada a ${nombreSede}`, { tipo: 'info' })
    try { playSound('save') } catch {}
    if (onCambioSede) onCambioSede(nuevaSedeId)
  }

  const statusTitle = sincronizado ? 'Sede activa y sincronizada' : 'Cambios pendientes de sincronizar'
  const statusIndicator = !sincronizado ? (
    <span
      data-testid="selector-sede-status"
      className="w-2 h-2 rounded-full shrink-0 bg-amber-400"
      title={statusTitle}
      aria-label={statusTitle}
    />
  ) : null

  return (
    <div
      data-testid="selector-sede"
      aria-label={statusTitle}
      className={`relative inline-flex items-center gap-1.5 h-8 ${compacto ? 'max-w-[160px]' : 'max-w-[200px]'} shrink-0 ${className}`}
    >
      {statusIndicator}
      <div className="relative inline-flex items-center">
        <label htmlFor="selector-sede-select" className="sr-only">Seleccionar sede</label>
        <div className="absolute left-2 pointer-events-none text-[#D4AF37]">
          <MapPin size={compacto ? 12 : 14} />
        </div>
        <select
          id="selector-sede-select"
          value={valorActivo}
          onChange={handleSeleccion}
          title={statusTitle}
          className="pl-6 pr-6 h-8 text-[13px] font-medium border border-surface rounded-lg bg-surface text-graphite-900 dark:text-graphite-100 surgical:text-black focus:outline-none focus:ring-1 focus:ring-[#D4AF37] cursor-pointer transition-colors max-w-[140px] truncate appearance-none"
        >
          {listaSedes.map((s) => (
            <option key={s.id || s.nombre} value={s.id || s.nombre}>
              {s.nombre}
            </option>
          ))}
        </select>
        <div className="absolute right-2 pointer-events-none text-graphite-400 text-[9px] select-none" aria-hidden="true">
          ▼
        </div>
      </div>
    </div>
  )
}

SelectorSede.displayName = 'SelectorSede'
