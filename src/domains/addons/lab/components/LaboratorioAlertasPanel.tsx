import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Bell, Check, RefreshCw } from 'lucide-react'
import { REALTIME_EVENTS } from '../../../../infrastructure/realtime/realtimeEvents'
import {
  CONFIGURACION_ALERTAS_LABORATORIO_DEFAULT,
  laboratorioAlertasService,
  type AlertaLaboratorio,
  type ConfiguracionAlertasLaboratorio,
} from '../services/laboratorioAlertasService'

const OPCIONES = {
  dias_antes_entrega: [1, 3, 5, 7],
  dias_prueba_inactiva: [5, 7, 10, 14],
  dias_pago_pendiente: [15, 30, 45, 60],
  ordenes_por_mes: [10, 20, 30, 50],
  tasa_reproceso_porcentaje: [5, 10, 15, 20],
} as const

const ETIQUETAS: Record<keyof ConfiguracionAlertasLaboratorio, string> = {
  dias_antes_entrega: 'Días antes de la entrega',
  dias_prueba_inactiva: 'Días en prueba sin movimiento',
  dias_pago_pendiente: 'Días de saldo de laboratorio pendiente',
  ordenes_por_mes: 'Órdenes por laboratorio al mes',
  tasa_reproceso_porcentaje: 'Tasa de reproceso (%)',
}

const severidadNombre: Record<AlertaLaboratorio['severity'], string> = {
  critical: 'Crítica',
  operational: 'Advertencia',
  informational: 'Informativa',
}

const estiloSeveridad: Record<AlertaLaboratorio['severity'], string> = {
  critical: 'border-rose-300 bg-rose-50 text-rose-950',
  operational: 'border-amber-300 bg-amber-50 text-amber-950',
  informational: 'border-sky-200 bg-sky-50 text-sky-950',
}

export interface LaboratorioAlertasPanelProps {
  clinicaId: string | null
  puedeConfigurar: boolean
}

export const LaboratorioAlertasPanel: React.FC<LaboratorioAlertasPanelProps> = ({ clinicaId, puedeConfigurar }) => {
  const [alertas, setAlertas] = useState<AlertaLaboratorio[]>([])
  const [config, setConfig] = useState<ConfiguracionAlertasLaboratorio>(CONFIGURACION_ALERTAS_LABORATORIO_DEFAULT)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  const cargar = useCallback(async (): Promise<void> => {
    if (!clinicaId) {
      setAlertas([])
      return
    }
    setCargando(true)
    setError(null)
    try {
      const [activas, configuracion] = await Promise.all([
        laboratorioAlertasService.listarActivas(clinicaId),
        laboratorioAlertasService.cargarConfiguracion(clinicaId),
      ])
      setAlertas(activas)
      setConfig(configuracion)
    } catch {
      setError('No se pudieron sincronizar las alertas de laboratorio.')
    } finally {
      setCargando(false)
    }
  }, [clinicaId])

  useEffect(() => {
    void cargar()
    window.addEventListener(REALTIME_EVENTS.LABORATORIO_CHANGED, cargar)
    return () => window.removeEventListener(REALTIME_EVENTS.LABORATORIO_CHANGED, cargar)
  }, [cargar])

  const guardar = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!clinicaId) return
    setGuardando(true)
    setError(null)
    setGuardado(false)
    try {
      await laboratorioAlertasService.guardarConfiguracion(clinicaId, config)
      setGuardado(true)
    } catch {
      setError('No se pudo guardar la configuración de alertas.')
    } finally {
      setGuardando(false)
    }
  }

  const actualizar = (key: keyof ConfiguracionAlertasLaboratorio, value: number): void => {
    setConfig(current => ({ ...current, [key]: value } as ConfiguracionAlertasLaboratorio))
    setGuardado(false)
  }

  return (
    <section className="rounded-2xl border border-surface bg-surface p-4 space-y-4" aria-label="Alertas de laboratorio">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold inline-flex items-center gap-2"><Bell size={16} />Alertas de laboratorio</h3>
          <p className="mt-1 text-xs text-muted-foreground">Avisos in-app de la clínica, sincronizados entre dispositivos.</p>
        </div>
        <button type="button" onClick={() => void cargar()} disabled={cargando} className="rounded-lg border border-surface p-2 disabled:opacity-50" aria-label="Actualizar alertas">
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {puedeConfigurar && (
        <form onSubmit={(event) => void guardar(event)} className="rounded-xl border border-surface p-3 space-y-3">
          <h4 className="text-xs font-semibold">Umbrales por clínica</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {(Object.keys(OPCIONES) as Array<keyof ConfiguracionAlertasLaboratorio>).map(key => (
              <label key={key} className="space-y-1 text-[11px] font-medium">
                <span>{ETIQUETAS[key]}</span>
                <select
                  value={config[key]}
                  onChange={event => actualizar(key, Number(event.target.value))}
                  className="w-full min-h-9 rounded-lg border border-surface bg-background px-2.5"
                >
                  {OPCIONES[key].map(value => <option key={value} value={value}>{value}{key === 'tasa_reproceso_porcentaje' ? '%' : ''}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            {guardado ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Check size={13} />Configuración guardada</span> : <span />}
            <button type="submit" disabled={guardando} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar umbrales'}
            </button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
      {cargando ? <p className="text-xs text-muted-foreground" role="status">Cargando alertas…</p> : alertas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-surface p-5 text-center text-xs text-muted-foreground">No hay alertas activas para esta clínica.</p>
      ) : (
        <ul className="space-y-2">
          {alertas.map(alerta => (
            <li key={alerta.id} className={`rounded-xl border p-3 ${estiloSeveridad[alerta.severity]}`}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h4 className="text-xs font-semibold">{alerta.title}</h4>
                    <span className="text-[10px] uppercase tracking-wide opacity-75">{severidadNombre[alerta.severity]}</span>
                  </div>
                  <p className="mt-1 text-xs">{alerta.message}</p>
                  <p className="mt-1 text-[10px] opacity-70">Actualizada {new Date(alerta.last_seen_at).toLocaleDateString('es-CL')}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
