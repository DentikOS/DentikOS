import React, { useCallback, useEffect, useState } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { REALTIME_EVENTS } from '../../../../infrastructure/realtime/realtimeEvents'
import { formatearImporteDocumento } from '../../../../shared/utils/formatoDocumento'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { laboratorioCoreService } from '../services/laboratorioCoreService'
import { ETAPAS_LABORATORIO } from '../constants/laboratorioConstants'

interface Props { clinicaId: string | null; puedeVerFinanzas: boolean }
type Dict = Record<string, unknown>

const objeto = (value: unknown): Dict => value && typeof value === 'object' && !Array.isArray(value) ? value as Dict : {}
const lista = (value: unknown): Dict[] => Array.isArray(value) ? value.map(objeto) : []
const numero = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0
const texto = (value: unknown): string => typeof value === 'string' ? value : '—'
const clp = (value: number): string => formatearImporteDocumento(value, 'CLP')

export const DashboardLaboratorio: React.FC<Props> = ({ clinicaId, puedeVerFinanzas }) => {
  const [data, setData] = useState<Dict | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async (): Promise<void> => {
    if (!clinicaId) { setData(null); return }
    setCargando(true)
    setError(null)
    try {
      const resumen = await laboratorioCoreService.cargarResumen()
      if (useSesionStore.getState().clinicaActual === clinicaId) setData(resumen)
    } catch {
      setError('No se pudo cargar el resumen de la clínica activa.')
    } finally {
      setCargando(false)
    }
  }, [clinicaId])

  useEffect(() => {
    setData(null)
    void cargar()
    const onRealtime = (): void => { void cargar() }
    window.addEventListener(REALTIME_EVENTS.LABORATORIO_CHANGED, onRealtime)
    return () => window.removeEventListener(REALTIME_EVENTS.LABORATORIO_CHANGED, onRealtime)
  }, [cargar])

  const stages = lista(data?.activas_por_etapa)
  const volumes = lista(data?.trabajos_30_dias)
  const overdue = lista(data?.ordenes_vencidas)
  const costsMonth = puedeVerFinanzas ? lista(data?.costos_mes) : []
  const costsYear = puedeVerFinanzas ? lista(data?.costos_anio) : []
  const pending = objeto(data?.pagos_pendientes_30_dias)
  const pendingAmount = pending.monto

  return (
    <section className="space-y-5" aria-label="Resumen de laboratorio">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-surface bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><BarChart3 size={17} /></span>
          <div><h2 className="font-semibold">Resumen de laboratorio</h2><p className="mt-1 text-xs text-muted-foreground">Actividad, entregas y reprocesos de los últimos 30 días.</p></div>
        </div>
        <Button type="button" variant="outline" size="sm" icon={RefreshCw} loading={cargando} onClick={() => void cargar()}>Actualizar</Button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-surface bg-surface p-4"><p className="text-xs text-muted-foreground">Órdenes activas</p><p className="mt-1 text-2xl font-bold tabular-nums">{numero(data?.ordenes_activas)}</p></article>
        <article className="rounded-2xl border border-surface bg-surface p-4"><p className="text-xs text-muted-foreground">Órdenes vencidas</p><p className="mt-1 text-2xl font-bold tabular-nums">{overdue.length}</p></article>
        <article className="rounded-2xl border border-surface bg-surface p-4"><p className="text-xs text-muted-foreground">Pagos pendientes &gt; 30 días</p><p className="mt-1 text-2xl font-bold tabular-nums">{numero(pending.cantidad)}</p>{puedeVerFinanzas && typeof pendingAmount === 'number' && <p className="mt-1 text-xs text-muted-foreground">Saldo: {clp(pendingAmount)}</p>}</article>
        {puedeVerFinanzas && <article className="rounded-2xl border border-surface bg-surface p-4"><p className="text-xs text-muted-foreground">Costos registrados este mes</p><p className="mt-1 text-2xl font-bold tabular-nums">{clp(costsMonth.reduce((sum, row) => sum + numero(row.costo), 0))}</p></article>}
      </div>

      <section className="rounded-2xl border border-surface bg-surface p-5">
        <h3 className="font-semibold">Órdenes activas por etapa</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {ETAPAS_LABORATORIO.filter(stage => stage.id !== 'entrega').map(stage => {
            const row = stages.find(item => item.etapa === stage.id)
            return <article key={stage.id} className={`rounded-xl border p-3 ${stage.colorBg} ${stage.colorBorder}`}><p className="text-xs font-semibold">{stage.nombre}</p><p className="mt-2 text-2xl font-bold tabular-nums">{numero(row?.cantidad)}</p></article>
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-surface bg-surface p-5">
          <h3 className="font-semibold">Rendimiento por laboratorio · 30 días</h3>
          {volumes.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">Sin órdenes registradas en este período.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-xs"><thead><tr className="border-b border-surface text-muted-foreground"><th className="py-2 pr-2">Laboratorio</th><th className="py-2 pr-2">Órdenes</th><th className="py-2 pr-2">Días prom.</th><th className="py-2 pr-2">Reproceso</th><th className="py-2">A tiempo</th></tr></thead><tbody>{volumes.map((row, index) => <tr key={`${texto(row.laboratorio)}-${index}`} className="border-b border-surface"><td className="py-2 pr-2 font-medium">{texto(row.laboratorio)}</td><td className="py-2 pr-2 tabular-nums">{numero(row.ordenes)}</td><td className="py-2 pr-2 tabular-nums">{typeof row.dias_promedio_entrega === 'number' ? row.dias_promedio_entrega : '—'}</td><td className="py-2 pr-2 tabular-nums">{typeof row.tasa_reproceso_pct === 'number' ? `${row.tasa_reproceso_pct}%` : '—'}</td><td className="py-2 tabular-nums">{numero(row.entregas_a_tiempo)}/{numero(row.entregas_con_fecha)}</td></tr>)}</tbody></table></div>}
        </section>
        <section className="rounded-2xl border border-surface bg-surface p-5">
          <h3 className="font-semibold">Órdenes vencidas</h3>
          {overdue.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">No hay órdenes vencidas.</p> : <ul className="mt-3 divide-y divide-surface">{overdue.map(row => <li key={String(row.id)} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"><span><strong>{texto(row.folio)}</strong><span className="block text-muted-foreground">{texto(row.laboratorio)} · entrega {texto(row.fecha_estimada_entrega)}</span></span><span className="font-semibold text-clinical-error">{numero(row.dias_vencida)} d</span></li>)}</ul>}
        </section>
      </div>

      {puedeVerFinanzas && <section className="rounded-2xl border border-surface bg-surface p-5">
        <h3 className="font-semibold">Costos registrados este año</h3>
        {costsYear.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">Sin costos registrados este año.</p> : <ul className="mt-3 divide-y divide-surface">{costsYear.map((row, index) => <li key={`${texto(row.laboratorio)}-${index}`} className="flex justify-between gap-3 py-2 text-xs"><span>{texto(row.laboratorio)}</span><span className="font-semibold tabular-nums">{clp(numero(row.costo))}</span></li>)}</ul>}
      </section>}
    </section>
  )
}

