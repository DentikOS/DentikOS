import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Building2, CalendarDays, CheckCircle2, ClipboardList, Clock3, Package, RefreshCw, Users } from 'lucide-react'
import { agendaStorageService } from '../../../domains/operations/agenda/services/agendaStorageService'
import type { Cita } from '../../../domains/operations/agenda/schemas/citaSchema'
import { presupuestosStorageService } from '../../../domains/billing/budget/services/presupuestosStorageService'
import type { PresupuestoLocal } from '../../../domains/billing/budget/services/presupuestosOfflineQueueService'
import { usePacientesStore } from '../../../app/stores/pacientesStore'
import { usePrestacionesStore } from '../../../app/stores/prestacionesStore'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { clinicStorageService } from '../../../domains/organization/clinic/services/clinicStorageService'
import { boxesClinicosService } from '../../../domains/organization/clinic/services/boxesClinicosService'
import { inventarioStorageService } from '../../../domains/operations/inventory/services/inventarioStorageService'
import { supabase, USE_SUPABASE } from '../../../infrastructure/supabase/supabaseClient'
import { obtenerFechaLocalISO } from '../../../shared/utils/dateUtils'
import type { Sede } from '../../../domains/organization/clinic/schemas/sedeSchema'
import type { BoxClinico } from '../../../domains/organization/clinic/schemas/boxSchema'
import type { DatosClinicaConfig } from '../../../domains/organization/clinic/services/clinicStorageService'
import { crearResumenDashboardAdministracion } from './dashboardAdministracionUtils'

type TabAdministracion = 'practica' | 'sedes' | 'equipo' | 'prestaciones'
interface ActividadAdmin {
  action: string
  table_name: string
  user_email: string | null
  created_at: string
}

const descripcionActividad = (actividad: ActividadAdmin): string => {
  const verbo = actividad.action === 'INSERT' ? 'creó' : actividad.action === 'DELETE' ? 'eliminó' : 'actualizó'
  const tabla: Record<string, string> = {
    clinicas: 'los datos de la clínica',
    sucursales: 'una sucursal',
    boxes_clinicos: 'un box',
    prestaciones: 'una prestación',
    miembros_clinica: 'un miembro del equipo',
  }
  return `${actividad.user_email ? `${actividad.user_email} ` : ''}${verbo} ${tabla[actividad.table_name] || 'un registro administrativo'}`
}

export interface DashboardAdministracionProps {
  sedes: Sede[]
  rol: string
  onNavigate: (tab: TabAdministracion) => void
}

export const DashboardAdministracion: React.FC<DashboardAdministracionProps> = ({ sedes, rol, onNavigate }) => {
  const clinicaId = useSesionStore((state) => state.clinicaActual || state.userProfile?.clinicaId || null)
  const esAdmin = rol.toLowerCase() === 'admin'
  const pacientes = usePacientesStore((state) => state.pacientes || [])
  const prestaciones = usePrestacionesStore((state) => state.prestacionesArancel)
  const [clinica, setClinica] = useState<DatosClinicaConfig>(() => clinicStorageService.obtenerClinica() || {})
  const [citas, setCitas] = useState<Cita[]>([])
  const [presupuestos, setPresupuestos] = useState<PresupuestoLocal[]>([])
  const [boxes, setBoxes] = useState<BoxClinico[]>([])
  const [miembrosActivos, setMiembrosActivos] = useState(0)
  const [inventarioCritico, setInventarioCritico] = useState(() => inventarioStorageService.obtenerItemsInventarioCriticoDashboard())
  const [actividad, setActividad] = useState<ActividadAdmin[]>([])
  const [actividadClinicaId, setActividadClinicaId] = useState<string | null>(null)
  const [estadoActividad, setEstadoActividad] = useState<'cargando' | 'disponible' | 'error' | 'offline' | 'sin-clinica'>('cargando')
  const [cargando, setCargando] = useState(false)
  const generacionSyncRef = useRef(0)

  const cargarCacheLocal = useCallback(() => {
    setClinica(clinicStorageService.obtenerClinica() || {})
    setCitas(agendaStorageService.obtenerCitas([]) || [])
    setPresupuestos(presupuestosStorageService.obtenerPresupuestos([]) || [])
    setBoxes(boxesClinicosService.obtenerBoxes())
    setInventarioCritico(inventarioStorageService.obtenerItemsInventarioCriticoDashboard())
  }, [])

  const sincronizarResumen = useCallback(async () => {
    if (!esAdmin) return
    const generacion = ++generacionSyncRef.current
    cargarCacheLocal()
    if (!USE_SUPABASE || !supabase) {
      setEstadoActividad('offline')
      setCargando(false)
      return
    }
    if (!clinicaId) {
      setEstadoActividad('sin-clinica')
      setCargando(false)
      return
    }
    setCargando(true)
    setEstadoActividad('cargando')
    try {
      const [resultadoCitas, resultadoPresupuestos, resultadoBoxes, resultadoMiembros, resultadoActividad] = await Promise.allSettled([
        agendaStorageService.sincronizarDesdeSupabase(),
        presupuestosStorageService.sincronizarDesdeSupabase(),
        boxesClinicosService.sincronizarDesdeSupabase(),
        supabase.from('miembros_clinica').select('id', { count: 'exact', head: true })
          .eq('clinica_id', clinicaId).eq('activo', true),
        supabase.from('audit_log').select('action,table_name,user_email,created_at')
          .eq('clinica_id', clinicaId)
          .in('table_name', ['clinicas', 'sucursales', 'boxes_clinicos', 'prestaciones', 'miembros_clinica'])
          .order('created_at', { ascending: false }).limit(6),
      ])
      const sesionActual = useSesionStore.getState()
      const clinicaVigente = sesionActual.clinicaActual || sesionActual.userProfile?.clinicaId || null
      if (generacion !== generacionSyncRef.current || clinicaVigente !== clinicaId) return
      if (resultadoCitas.status === 'fulfilled' && resultadoCitas.value) setCitas(resultadoCitas.value)
      if (resultadoPresupuestos.status === 'fulfilled') setPresupuestos(resultadoPresupuestos.value)
      if (resultadoBoxes.status === 'fulfilled') setBoxes(resultadoBoxes.value)
      if (resultadoMiembros.status === 'fulfilled' && !resultadoMiembros.value.error) {
        setMiembrosActivos(resultadoMiembros.value.count || 0)
      }
      if (resultadoActividad.status === 'fulfilled' && !resultadoActividad.value.error) {
        setActividad((resultadoActividad.value.data || []) as ActividadAdmin[])
        setActividadClinicaId(clinicaId)
        setEstadoActividad('disponible')
      } else {
        setEstadoActividad('error')
      }
    } catch {
      if (generacion === generacionSyncRef.current) setEstadoActividad('error')
    } finally {
      if (generacion === generacionSyncRef.current) setCargando(false)
    }
  }, [cargarCacheLocal, clinicaId, esAdmin])

  useEffect(() => {
    setActividad([])
    setActividadClinicaId(null)
    setMiembrosActivos(0)
    setBoxes([])
    if (!esAdmin) {
      setEstadoActividad('sin-clinica')
      return
    }
    cargarCacheLocal()
    if (usePrestacionesStore.getState().estadoRemoto === 'pendiente') {
      void usePrestacionesStore.getState().sincronizarDesdeSupabase()
    }
    void sincronizarResumen()
    const handleFocus = () => { void sincronizarResumen() }
    const eventos = [
      'storage', 'clinica_actualizada', 'sucursales_actualizadas', 'boxes_clinicos_actualizados',
      'arancel_actualizado', 'dashboard:agenda:changed', 'dashboard:pacientes:changed', 'dashboard:pagos:changed',
    ]
    eventos.forEach((evento) => window.addEventListener(evento, cargarCacheLocal))
    window.addEventListener('focus', handleFocus)
    return () => {
      generacionSyncRef.current += 1
      eventos.forEach((evento) => window.removeEventListener(evento, cargarCacheLocal))
      window.removeEventListener('focus', handleFocus)
    }
  }, [cargarCacheLocal, clinicaId, sincronizarResumen, esAdmin])

  const resumen = useMemo(() => crearResumenDashboardAdministracion({
    clinica, sedes, boxes, miembrosActivos, prestaciones, pacientes, citas, presupuestos, hoy: obtenerFechaLocalISO(),
  }), [clinica, sedes, boxes, miembrosActivos, prestaciones, pacientes, citas, presupuestos])

  const alertas = [
    resumen.prestacionesSinPrecio > 0 ? {
      id: 'prestaciones', texto: `${resumen.prestacionesSinPrecio} prestaciones sin precio particular`, tab: 'prestaciones' as const,
    } : null,
    !clinica.logoUrl ? { id: 'logo', texto: 'Falta el logo del membrete de documentos', tab: 'practica' as const } : null,
  ].filter((alerta): alerta is NonNullable<typeof alerta> => alerta !== null)

  const kpis = [
    { label: 'Pacientes activos', valor: resumen.pacientesActivos, icon: Users },
    { label: 'Presupuestos aprobados', valor: resumen.presupuestosAprobados, icon: ClipboardList },
    { label: 'Citas próximos 7 días', valor: resumen.citasProximaSemana, icon: CalendarDays },
    { label: 'Presupuestos pendientes', valor: resumen.presupuestosPendientes, icon: Clock3 },
  ]
  const actividadClinicaActual = actividadClinicaId === clinicaId ? actividad : []

  if (!esAdmin) {
    return <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">El resumen administrativo está disponible solo para administradores de la clínica.</p>
  }

  return (
    <section className="space-y-4" aria-label="Resumen administrativo">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface bg-surface p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite-500">Panel de Administración</p>
          <h2 className="mt-1 text-lg font-bold text-graphite-900 dark:text-white">{clinica.nombreClinica || 'Tu clínica'}</h2>
        </div>
        <button type="button" onClick={() => void sincronizarResumen()} disabled={cargando} className="inline-flex items-center gap-2 rounded-lg border border-surface px-3 py-2 text-xs font-semibold text-graphite-700 hover:bg-gray-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800">
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />{cargando ? 'Sincronizando…' : 'Actualizar resumen'}
        </button>
      </div>

      <div className="rounded-2xl border border-surface bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-graphite-900 dark:text-white">Configuración inicial</h3>
            <p className="mt-1 text-xs text-graphite-500">{resumen.progresoPorcentaje}% completado</p>
          </div>
          <span className="text-xl font-bold tabular-nums text-[#B88918]">{resumen.progresoPorcentaje}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800" role="progressbar" aria-label="Progreso de configuración" aria-valuenow={resumen.progresoPorcentaje} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[#D4AF37] transition-[width]" style={{ width: `${resumen.progresoPorcentaje}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {resumen.checklist.map((item) => (
            <button key={item.id} type="button" onClick={() => onNavigate(item.tab)} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-slate-800">
              {item.completado ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600" /> : <AlertTriangle size={15} className="shrink-0 text-amber-600" />}
              <span className="min-w-0 truncate text-graphite-700 dark:text-slate-200">{item.label}{item.detalle ? ` · ${item.detalle}` : ''}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, valor, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-surface bg-surface p-4">
            <div className="flex items-center justify-between gap-2 text-xs text-graphite-500"><span>{label}</span><Icon size={16} className="text-[#B88918]" /></div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-graphite-900 dark:text-white">{valor}</p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-surface bg-surface p-5">
          <h3 className="text-sm font-bold text-graphite-900 dark:text-white">Alertas</h3>
          <div className="mt-3 space-y-2">
            {alertas.map((alerta) => <button key={alerta.id} type="button" onClick={() => onNavigate(alerta.tab)} className="flex w-full items-start gap-2 rounded-lg bg-amber-50 p-3 text-left text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{alerta.texto}</button>)}
            {inventarioCritico.map((item) => <div key={String(item.id)} className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><Package size={14} className="mt-0.5 shrink-0" />Stock bajo: {item.nombre} ({item.cantidad} {item.unidad})</div>)}
            {alertas.length === 0 && inventarioCritico.length === 0 && <p className="text-xs text-graphite-500">No hay alertas administrativas pendientes.</p>}
          </div>
        </article>

        <article className="rounded-2xl border border-surface bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-graphite-900 dark:text-white">Actividad administrativa reciente</h3>
            <Building2 size={15} className="text-[#B88918]" />
          </div>
          {estadoActividad === 'cargando' ? <p role="status" className="mt-3 text-xs text-graphite-500">Cargando actividad…</p>
            : estadoActividad === 'error' ? <p role="status" className="mt-3 text-xs text-amber-700 dark:text-amber-300">No se pudo cargar la actividad. Actualiza el resumen cuando vuelva la conexión.</p>
              : actividadClinicaActual.length === 0 ? <p className="mt-3 text-xs text-graphite-500">{estadoActividad === 'offline'
                ? 'La actividad en nube estará disponible al conectar Supabase.'
                : estadoActividad === 'sin-clinica'
                  ? 'No se identificó la clínica activa para consultar la actividad.'
                  : 'No hay actividad administrativa registrada.'}</p>
              : <ul className="mt-3 divide-y divide-surface">
                {actividadClinicaActual.map((item, index) => <li key={`${item.created_at}-${item.table_name}-${index}`} className="py-2 text-xs text-graphite-700 dark:text-slate-200">
                  <p>{descripcionActividad(item)}</p>
                  <time className="mt-1 block text-[10px] text-graphite-500" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('es-CL')}</time>
                </li>)}
              </ul>}
        </article>
      </div>
    </section>
  )
}
