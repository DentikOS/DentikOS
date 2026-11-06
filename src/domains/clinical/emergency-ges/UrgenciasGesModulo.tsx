import React, { memo, useEffect, useMemo } from 'react'
import { ClipboardList, Download, RefreshCw, Siren, UserRound } from 'lucide-react'
import { PageHeader } from '../../../shared/ui/ui/PageHeader'
import { Button } from '../../../shared/ui/ui/Button'
import { useUrgenciasGes } from './hooks/useUrgenciasGes'
import { FormRegistroGes, type PacienteUrgenciaMinimo } from './components/FormRegistroUrgencia'
import { DocumentoImpresoGes, type UserProfileGes } from './components/DocumentoImpresoGes'
import { FormularioTriageUrgencia } from './components/FormularioTriageUrgencia'
import { FormularioFichaUrgencia } from './components/FormularioFichaUrgencia'
import { FichaUrgenciaDetalle } from './components/FichaUrgenciaDetalle'
import { ConfiguracionGesClinicaPanel } from './components/ConfiguracionGesClinicaPanel'
import { PATOLOGIAS_GES_ODONTO } from './constants/urgenciasGesConstants'
import { PERMISOS } from '../../../constants/rbacConstants'
import { useRBAC } from '../../../shared/hooks/useRBAC'
import { usePacientesStore, type PestanaFicha } from '../../../app/stores/pacientesStore'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { USE_SUPABASE } from '../../../infrastructure/supabase/supabaseClient'
import type { IngresoUrgencia } from './services/urgenciasGesTypes'
import type { AtencionGes } from './services/urgenciasGesStorageService'

const fechaLocal = (value: string | undefined): string => value ? new Date(value).toLocaleString('es-CL') : 'Pendiente de confirmación'

const estadoCola = (ingreso: IngresoUrgencia): string => {
  if (ingreso.estado_sincronizacion === 'pendiente') return 'Pendiente de sincronización'
  return ingreso.estado_cola.replace('_', ' ')
}

const exportarResumen = (snapshot: ReturnType<typeof useUrgenciasGes>['snapshot']): void => {
  const filas = PATOLOGIAS_GES_ODONTO.map((patologia) => {
    const fichas = snapshot.fichas.filter((ficha) => ficha.patologia_id === patologia.id && ficha.estado_sincronizacion !== 'pendiente')
    const esperas = fichas.flatMap((ficha) => {
      const ingreso = snapshot.ingresos.find((item) => item.id === ficha.id)
      if (!ingreso?.created_at) return []
      const minutos = (new Date(ficha.fecha_hora_atencion).getTime() - new Date(ingreso.created_at).getTime()) / 60000
      return Number.isFinite(minutos) && minutos >= 0 ? [minutos] : []
    })
    const tiempos = fichas.flatMap((ficha) => {
      if (!ficha.fecha_hora_fin) return []
      const minutos = (new Date(ficha.fecha_hora_fin).getTime() - new Date(ficha.fecha_hora_atencion).getTime()) / 60000
      return Number.isFinite(minutos) && minutos >= 0 ? [minutos] : []
    })
    const promedio = (valores: number[]): string => valores.length ? (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1) : ''
    const csv = (value: string): string => `"${value.replaceAll('"', '""')}"`
    return [csv(patologia.nombre), String(fichas.length), ...(['en_atencion', 'cerrada', 'rechazada', 'derivada'] as const).map((estado) => String(fichas.filter((ficha) => ficha.estado === estado).length)), promedio(esperas), promedio(tiempos)].join(',')
  })
  const contenido = ['patologia,registros,cantidad_en_atencion,cantidad_cerradas,cantidad_rechazadas,cantidad_derivadas,espera_promedio_min,atencion_promedio_min', ...filas].join('\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `resumen-urgencias-ges-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

interface UrgenciasGesModuloProps {
  onAbrirFichaPaciente: (pacienteId: string | number, pestana: PestanaFicha) => void
}

export const UrgenciasGesModulo: React.FC<UrgenciasGesModuloProps> = memo(({ onAbrirFichaPaciente }) => {
  const pacientes = usePacientesStore((state) => state.pacientes)
  const cargarPacientes = usePacientesStore((state) => state.cargarPacientes)
  const userProfile = useSesionStore((state) => state.userProfile)
  const clinicId = useSesionStore((state) => state.clinicaActual)
  useEffect(() => {
    if (clinicId) void cargarPacientes()
  }, [clinicId, cargarPacientes])
  const { rol, puede } = useRBAC()
  const {
    snapshot,
    atencionesHistoricas,
    fichaSeleccionada,
    setFichaSeleccionada,
    atencionHistoricaSeleccionada,
    setAtencionHistoricaSeleccionada,
    loading,
    error,
    pendientesCount,
    refresh,
    sincronizarPendientes,
    registrarIngreso,
    guardarTriage,
    crearFicha,
    actualizarEstadoFicha,
    guardarCambiosFicha,
    agregarEnmienda,
    guardarConfiguracion
  } = useUrgenciasGes()

  const pacientesClinica = useMemo(() => pacientes
    .filter((paciente) => Boolean(clinicId) && paciente.clinicaId === clinicId)
    .map((paciente) => ({
      id: paciente.id,
      nombre: paciente.nombreCompleto || paciente.nombre,
      rut: paciente.rut,
      clinicaId: paciente.clinicaId
    } satisfies PacienteUrgenciaMinimo)), [pacientes, clinicId])
  const pacientePorId = useMemo(() => new Map(pacientesClinica.map((paciente) => [String(paciente.id), paciente])), [pacientesClinica])

  const puedeCola = puede(PERMISOS.VER_COLA_URGENCIA)
  const puedeTriage = puede(PERMISOS.GESTIONAR_TRIAGE_URGENCIA)
  const puedeFicha = puede(PERMISOS.VER_URGENCIAS_GES)
  const puedeConfigurar = puede(PERMISOS.CONFIGURAR_GES_CLINICA)

  if (!puedeCola) return <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">Tu rol no tiene acceso a la cola de urgencias.</p>

  const ingresosOrdenados = [...snapshot.ingresos].sort((a, b) => {
    const horaA = a.estado_sincronizacion === 'pendiente' ? a.hora_local_pendiente || '' : a.created_at
    const horaB = b.estado_sincronizacion === 'pendiente' ? b.hora_local_pendiente || '' : b.created_at
    return horaB.localeCompare(horaA)
  })
  const ingresoSeleccionado = fichaSeleccionada
    ? snapshot.ingresos.find((ingreso) => ingreso.id === fichaSeleccionada.id)
    : undefined
  const selectedPaciente = ingresoSeleccionado ? pacientePorId.get(ingresoSeleccionado.paciente_id) : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Siren}
        title="Urgencias GES"
        description="Registro compartido por clínica, con permisos separados para recepción, triage y atención clínica."
        className="print:hidden"
      />

      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface bg-surface p-4">
        <div>
          <p className="text-sm font-bold text-graphite-900 dark:text-graphite-50">{loading ? 'Actualizando datos…' : 'Sincronización con la clínica activa'}</p>
          <p className="text-xs text-graphite-500 dark:text-graphite-400">{pendientesCount ? `${pendientesCount} elemento(s) pendiente(s) en este dispositivo y sesión.` : 'Sin elementos pendientes locales.'}</p>
        </div>
        <div className="flex gap-2">
          {pendientesCount > 0 && <Button type="button" variant="primary" icon={RefreshCw} onClick={() => void sincronizarPendientes()}>Sincronizar pendientes</Button>}
          <Button type="button" variant="secondary" icon={RefreshCw} onClick={() => void refresh()}>Actualizar</Button>
        </div>
      </div>

      {!USE_SUPABASE && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-800">El servicio de Urgencias GES requiere conexión Supabase para confirmar los registros.</p>}
      {!clinicId && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">Selecciona una clínica activa para consultar o registrar urgencias.</p>}
      {error && <p role="alert" className="print:hidden rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-800 dark:bg-red-950/20 dark:text-red-200">{error}</p>}

      {!atencionHistoricaSeleccionada && !fichaSeleccionada && <>
        {puedeCola && clinicId && USE_SUPABASE && <FormRegistroGes pacientes={pacientesClinica} alRegistrar={async (pacienteId, requestId) => ({ estado: await registrarIngreso(pacienteId, requestId) })} error={null} />}

        <section className="print:hidden rounded-2xl border border-surface bg-surface p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-50"><ClipboardList size={17} /> Cola de llegadas ({snapshot.ingresos.length})</h2>
              <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">Recepción ve solo los datos mínimos necesarios para gestionar las llegadas.</p>
            </div>
          </div>
          {ingresosOrdenados.length === 0 ? <p className="py-4 text-center text-xs text-graphite-500">No hay llegadas registradas en esta clínica.</p> : <div className="divide-y divide-surface">
            {ingresosOrdenados.map((ingreso) => {
              const paciente = pacientePorId.get(ingreso.paciente_id)
              const triage = snapshot.triajes.find((item) => item.id === ingreso.id)
              const ficha = puedeFicha ? snapshot.fichas.find((item) => item.id === ingreso.id) : undefined
              return <div key={ingreso.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-bold text-graphite-900 dark:text-graphite-50">{paciente?.nombre || `Paciente ${ingreso.paciente_id.slice(0, 8)}`}{paciente?.rut ? ` · ${paciente.rut}` : ''}</p>
                  <p className="text-xs text-graphite-500">Llegada: {fechaLocal(ingreso.estado_sincronizacion === 'pendiente' ? ingreso.hora_local_pendiente : ingreso.created_at)} · {estadoCola(ingreso)}</p>
                  {puedeTriage && triage && <p className="text-xs text-graphite-600 dark:text-graphite-300">Triage registrado: {triage.severidad}</p>}
                </div>
                {ficha && <Button type="button" variant="secondary" icon={UserRound} onClick={() => { setFichaSeleccionada(ficha); setAtencionHistoricaSeleccionada(null) }}>Abrir ficha {ficha.folio}</Button>}
              </div>
            })}
          </div>}
        </section>

        {puedeTriage && <FormularioTriageUrgencia ingresos={snapshot.ingresos} triajes={snapshot.triajes} pacientes={pacientesClinica} alGuardar={async (id, triage) => { await guardarTriage(id, triage) }} />}
        {puedeFicha && <FormularioFichaUrgencia ingresos={snapshot.ingresos} triajes={snapshot.triajes} fichas={snapshot.fichas} configuraciones={snapshot.configuraciones} pacientes={pacientesClinica} alCrear={async (id, ficha) => { await crearFicha(id, ficha) }} />}

        {puedeFicha && <section className="print:hidden rounded-2xl border border-surface bg-surface p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-sm font-bold">Registros clínicos ({snapshot.fichas.length})</h2><p className="text-xs text-graphite-500">Tiempos calculados solo con marcas del servidor. Sin umbrales legales configurados.</p></div>
            <Button type="button" variant="secondary" icon={Download} disabled={!snapshot.fichas.some((ficha) => ficha.estado_sincronizacion !== 'pendiente')} onClick={() => exportarResumen(snapshot)}>Exportar resumen CSV</Button>
          </div>
          {snapshot.fichas.length === 0 ? <p className="py-4 text-center text-xs text-graphite-500">Todavía no hay fichas clínicas.</p> : <div className="mt-3 divide-y divide-surface">
            {[...snapshot.fichas].sort((a, b) => b.fecha_hora_atencion.localeCompare(a.fecha_hora_atencion)).map((ficha) => {
              const ingreso = snapshot.ingresos.find((item) => item.id === ficha.id)
              const paciente = ingreso ? pacientePorId.get(ingreso.paciente_id) : undefined
              const patologia = PATOLOGIAS_GES_ODONTO.find((item) => item.id === ficha.patologia_id)
              return <button type="button" key={ficha.id} onClick={() => { setFichaSeleccionada(ficha); setAtencionHistoricaSeleccionada(null) }} className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-graphite-800/40">
                <span><strong className="block text-sm">{ficha.folio} · {paciente?.nombre || 'Paciente'}</strong><span className="text-xs text-graphite-500">{patologia?.nombre || ficha.patologia_id} · {ficha.estado.replace('_', ' ')} · {fechaLocal(ficha.fecha_hora_atencion)}</span></span>
                <span className="text-xs text-primary">Ver registro →</span>
              </button>
            })}
          </div>}
        </section>}

        {puedeConfigurar && <ConfiguracionGesClinicaPanel configuraciones={snapshot.configuraciones} alGuardar={guardarConfiguracion} />}

        {atencionesHistoricas.length > 0 && <section className="print:hidden rounded-2xl border border-amber-300 bg-amber-50/60 p-5 dark:bg-amber-950/10">
          <h2 className="text-sm font-bold">Historial local legado ({atencionesHistoricas.length})</h2>
          <p className="mt-1 text-xs text-amber-900 dark:text-amber-100">Se conserva para consulta. Estos registros no se migran automáticamente ni se presentan como verificados.</p>
          <div className="mt-3 divide-y divide-amber-200">
            {atencionesHistoricas.map((item: AtencionGes, index) => <div key={String(item.id ?? index)} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div><strong className="block text-xs">{item.pacienteNombre || 'Paciente legado'} · {item.patologiaNombre || item.patologiaGes || 'Sin patología registrada'}</strong><span className="text-[11px] text-amber-900 dark:text-amber-100">Folio local: {item.folio || 'No disponible'} · {item.fechaCreacion || 'Fecha no disponible'}</span></div>
              <Button type="button" variant="secondary" onClick={() => { setAtencionHistoricaSeleccionada(item); setFichaSeleccionada(null) }}>Consultar copia local</Button>
            </div>)}
          </div>
        </section>}
      </>}

      {fichaSeleccionada && ingresoSeleccionado && <div className="space-y-3">
        <div className="print:hidden flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setFichaSeleccionada(null)}>Volver a urgencias</Button>
          {selectedPaciente && <>
            <Button type="button" variant="secondary" onClick={() => onAbrirFichaPaciente(selectedPaciente.id, 'presupuestos')}>Abrir plan del paciente</Button>
            <Button type="button" variant="secondary" onClick={() => onAbrirFichaPaciente(selectedPaciente.id, 'recetas-consentimientos')}>Abrir recetas</Button>
          </>}
        </div>
        <FichaUrgenciaDetalle
          ficha={fichaSeleccionada}
          ingreso={ingresoSeleccionado}
          triage={snapshot.triajes.find((triage) => triage.id === fichaSeleccionada.id)}
          paciente={selectedPaciente}
          eventos={snapshot.eventos}
          alGuardarCambios={guardarCambiosFicha}
          alCambiarEstado={actualizarEstadoFicha}
          alAgregarEnmienda={async (ingresoId, motivo, detalle) => { await agregarEnmienda(ingresoId, motivo, detalle) }}
        />
      </div>}

      {fichaSeleccionada && !ingresoSeleccionado && <div className="print:hidden rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs">La ficha seleccionada no está disponible en la clínica activa. Vuelve a la lista y actualiza.</div>}

      {atencionHistoricaSeleccionada && <DocumentoImpresoGes atencion={atencionHistoricaSeleccionada} userProfile={userProfile as UserProfileGes | null} alCerrar={() => setAtencionHistoricaSeleccionada(null)} />}

      <p className="sr-only" aria-live="polite">Rol activo: {rol}</p>
    </div>
  )
})

UrgenciasGesModulo.displayName = 'UrgenciasGesModulo'
