import React, { useState, useEffect } from 'react'
import {
  listarMisClinicas,
  setClinicaActiva,
  getClinicaActiva,
  type ClinicaMembresiaItem,
} from '../../infrastructure/auth/authService'
import { createLogger } from '../../infrastructure/logging/logger'
import { invalidarCacheCambioClinica } from '../../infrastructure/supabase/invalidarCacheCambioClinica'
import { SelectorSede } from './SelectorSede'

const log = createLogger('ClinicaSelector')

/**
 * F7-10: Selector de clínica activa.
 *
 * Lista las clínicas donde el usuario tiene membresía activa y permite
 * cambiar la clínica activa. La selección se persiste en user_metadata
 * y es leída por clinica_actual() server-side.
 *
 * Si el usuario solo tiene 1 clínica, muestra el nombre sin selector (solo informativo).
 * Si tiene múltiples clínicas, muestra un dropdown para cambiar.
 */
export interface ClinicaSelectorProps {
  onCambioClinica?: (nuevaClinicaId: string) => void
}

export const ClinicaSelector: React.FC<ClinicaSelectorProps> = ({ onCambioClinica }) => {
  const [clinicas, setClinicas] = useState<ClinicaMembresiaItem[]>([])
  const [clinicaActiva, setClinicaActivaState] = useState<string | null>(null)
  const [cargando, setCargando] = useState<boolean>(true)
  const [cambiando, setCambiando] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar clínicas y clínica activa al montar
  useEffect(() => {
    const cargar = async (): Promise<void> => {
      setCargando(true)
      setError(null)
      try {
        const [lista, activa] = await Promise.all([
          listarMisClinicas(),
          getClinicaActiva(),
        ])

        setClinicas(lista)

        // F7-35: Auto-persistir selector si metadata ausente o inválida.
        // Previene que clinica_actual() fail-closed deje al usuario sin contexto
        // mientras la UI mostraba una clínica "por defecto".
        let clinicaFinal: string | null = activa
        if (!clinicaFinal && lista.length > 0) {
          clinicaFinal = lista[0].clinica_id
          // setClinicaActiva hace updateUser + refreshSession (no bloqueante)
          setClinicaActiva(clinicaFinal).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err)
            log.warn('F7-35: No se pudo auto-persistir clinicaActiva:', msg)
          })
        }
        // Si clinicaFinal no está en la lista (metadata stale de clínica removida),
        // resetear a la primera disponible.
        if (clinicaFinal && !lista.some((c) => c.clinica_id === clinicaFinal)) {
          clinicaFinal = lista[0]?.clinica_id || null
          if (clinicaFinal) {
            setClinicaActiva(clinicaFinal).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err)
              log.warn('F7-35: Reset de clinicaActiva stale:', msg)
            })
          }
        }
        setClinicaActivaState(clinicaFinal)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        log.error('Error cargando clínicas:', msg)
        setError('Error cargando clínicas')
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  // Manejar cambio de clínica
  const handleCambio = async (e: React.ChangeEvent<HTMLSelectElement>): Promise<void> => {
    const nuevaClinicaId = e.target.value
    if (nuevaClinicaId === clinicaActiva) return

    setCambiando(true)
    setError(null)

    try {
      const clinicaAnterior = clinicaActiva
      const result = await setClinicaActiva(nuevaClinicaId)

      if (result.success) {
        // F7-36 FASE 1: invalidar cache de clínica anterior antes de actualizar state
        // Previene contaminación cross-clinic durante el lapso antes del reload (300ms)
        await invalidarCacheCambioClinica(clinicaAnterior)

        setClinicaActivaState(nuevaClinicaId)
        log.info('Clínica cambiada a:', nuevaClinicaId)
        if (onCambioClinica) {
          onCambioClinica(nuevaClinicaId)
        }
        // Recargar la página para refrescar el JWT y todos los datos
        // F7-10b: actualizar el rol en el perfil guardado ANTES del reload
        // Así el primer render de App.jsx ya tiene el rol correcto (sin flash de login)
        // App.jsx igualmente validará vía construirUserProfile() como respaldo
        try {
          const email = localStorage.getItem('clinica_active_user')
          if (email) {
            const perfilKey = `profile_${email}`
            const perfilGuardado = localStorage.getItem(perfilKey)
            if (perfilGuardado) {
              const perfil = JSON.parse(perfilGuardado) as Record<string, unknown>
              // Buscar la clínica recién seleccionada para obtener su rol contextual
              const clinicaSeleccionada = clinicas.find((c) => c.clinica_id === nuevaClinicaId)
              if (clinicaSeleccionada && clinicaSeleccionada.rol) {
                perfil.rol = clinicaSeleccionada.rol
                localStorage.setItem(perfilKey, JSON.stringify(perfil))
                log.info('F7-10b: Rol actualizado en localStorage a:', clinicaSeleccionada.rol)
              }
            }
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          log.warn('Error actualizando rol en perfil guardado:', msg)
        }
        setTimeout(() => window.location.reload(), 300)
      } else {
        setError(result.error || 'Error al cambiar clínica')
        log.error('Error cambiando clínica:', result.error)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError('Error al cambiar clínica')
      log.error('Excepción cambiando clínica:', msg)
    } finally {
      setCambiando(false)
    }
  }

  // Estados de carga y error
  if (cargando) {
    return (
      <div className="px-2 py-3 mb-4 border-b border-surface">
        <div className="text-xs text-graphite-500 dark:text-graphite-400  animate-pulse">Cargando clínica...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-3 py-2.5 mb-4 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 rounded-lg">
        <div className="text-xs font-semibold text-red-700 dark:text-red-300">{error}</div>
      </div>
    )
  }

  if (clinicas.length === 0) {
    return (
      <div className="px-3 py-2.5 mb-4 border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
        <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">Sin clínicas asignadas</div>
      </div>
    )
  }

  // Si solo hay 1 clínica, mostrar sin selector (solo informativo)
  if (clinicas.length === 1) {
    return (
      <div className="px-2 py-3 mb-4 border-b border-surface" title="F7-10: Clínica activa">
        <div className="text-xs font-semibold text-graphite-500 dark:text-graphite-400  mb-1">Clínica</div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-graphite-900 dark:text-graphite-100  truncate">
            {clinicas[0].nombre}
          </span>
        </div>
        <div className="mt-1.5">
          <SelectorSede compacto />
        </div>
      </div>
    )
  }

  // Múltiples clínicas: mostrar selector
  return (
    <div className="px-2 py-3 mb-4 border-b border-surface">
      <label htmlFor="clinica-activa-select" className="text-xs font-semibold text-graphite-500 dark:text-graphite-400  block mb-1">Clínica activa</label>
      <select
        id="clinica-activa-select"
        value={clinicaActiva || ''}
        onChange={handleCambio}
        disabled={cambiando}
        className="w-full px-2.5 py-1.5 text-xs font-medium border border-surface rounded-lg bg-surface text-graphite-900 dark:text-graphite-100  focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-fast"
      >
        {clinicas.map((c) => (
          <option key={c.clinica_id} value={c.clinica_id}>
            {c.nombre} ({c.rol})
          </option>
        ))}
      </select>
      <div className="mt-1.5">
        <SelectorSede compacto />
      </div>
      {cambiando && (
        <div className="text-[11px] text-primary font-bold mt-1 animate-pulse">Cambiando clínica...</div>
      )}
    </div>
  )
}

ClinicaSelector.displayName = 'ClinicaSelector'
