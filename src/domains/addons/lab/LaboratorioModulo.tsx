import React, { memo, useState } from 'react'
import { BarChart3, ClipboardList, FlaskConical, Folder, Pencil, Plus, Settings } from 'lucide-react'
import { PageHeader } from '../../../shared/ui/ui/PageHeader'
import { Button } from '../../../shared/ui/ui/Button'
import { Input } from '../../../shared/ui/ui/Input'
import { ETAPAS_LABORATORIO, CATEGORIAS_LABORATORIO, type CategoriaLaboratorio, type OrdenLaboratorio } from './constants/laboratorioConstants'
import { useLaboratorio } from './hooks/useLaboratorio'
import { LaboratorioSummaryCards } from './components/LaboratorioSummaryCards'
import { TablaOrdenesLaboratorio } from './components/TablaOrdenesLaboratorio'
import { DirectorioLaboratorios } from './components/DirectorioLaboratorios'
import { FinanzasOrdenLaboratorio } from './components/FinanzasOrdenLaboratorio'
import { LaboratorioAlertasPanel } from './components/LaboratorioAlertasPanel'
import { LaboratorioDocumentosPanel } from './components/LaboratorioDocumentosPanel'
import { GarantiasLaboratorioPanel } from './components/GarantiasLaboratorioPanel'
import { CatalogoPreciosLaboratorio } from './components/CatalogoPreciosLaboratorio'
import { PermisosLaboratorioManager } from './components/PermisosLaboratorioManager'
import { PlantillasLaboratorioManager } from './components/PlantillasLaboratorioManager'
import { DashboardLaboratorio } from './components/DashboardLaboratorio'
import { ModalNuevaOrden, type PacienteParaLab } from './components/ModalNuevaOrden'
import { ModalEditarOrden } from './components/ModalEditarOrden'
import { OrdenImprimible, type UserProfileLab } from './components/OrdenImprimible'
import { usePacientesStore } from '../../../app/stores/pacientesStore'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { useAppDialog } from '../../../shared/hooks/useAppDialog'

type TabLaboratorio = 'datos' | 'catalogo' | 'historial' | 'estadisticas'

export const LaboratorioModulo: React.FC = memo(() => {
  const pacientes = usePacientesStore((state: { pacientes: PacienteParaLab[] }) => state.pacientes)
  const userProfile = useSesionStore((state: { userProfile: UserProfileLab | null }) => state.userProfile)
  const clinicaId = useSesionStore((state: { clinicaActual: string | null }) => state.clinicaActual)
  const { alert: dialogAlert } = useAppDialog()
  const [tabActual, setTabActual] = useState<TabLaboratorio>('historial')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false)
  const [ordenImprimir, setOrdenImprimir] = useState<OrdenLaboratorio | null>(null)
  const [ordenDetalle, setOrdenDetalle] = useState<OrdenLaboratorio | null>(null)
  const [etapaFicha, setEtapaFicha] = useState<OrdenLaboratorio['etapa']>('solicitud')
  const [notaEtapaFicha, setNotaEtapaFicha] = useState('')
  const [categoriaTipo, setCategoriaTipo] = useState<CategoriaLaboratorio>('protesis_fija')
  const [nombreTipo, setNombreTipo] = useState('')
  const [diasTipo, setDiasTipo] = useState('')
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null)
  const {
    ordenes, laboratorios, tiposTrabajo, plantillas, resumen, busqueda, setBusqueda,
    etapaFiltro, setEtapaFiltro, rol, permisos, puedeCrear, puedeEditar, puedeCambiarEtapa,
    puedeGestionarLaboratorios, puedeVerCostos, puedePagarLaboratorios, puedeAprobarGarantias, puedeConfigurarAlertas,
    cargando, errorSincronizacion, pendientesSincronizacion,
    agregarOrden, actualizarEtapaOrden, editarOrden, guardarOActualizarLaboratorio,
    guardarTipoTrabajo, recargar
  } = useLaboratorio()
  const puedeConfigurarPlantillas = rol === 'admin' || permisos.includes('configurar_plantillas')
  const ordenDetalleActual = ordenDetalle
    ? ordenes.find(orden => orden.id === ordenDetalle.id) || ordenDetalle
    : null

  const cambiarEtapa = async (idOrden: number | string, nuevaEtapa: string): Promise<void> => {
    try {
      await actualizarEtapaOrden(idOrden, nuevaEtapa)
    } catch (error) {
      await dialogAlert({
        title: 'No se pudo cambiar la etapa',
        description: error instanceof Error ? error.message : 'La orden no fue actualizada.',
        variant: 'warning', confirmText: 'Entendido'
      })
    }
  }

  const seleccionarDetalle = (orden: OrdenLaboratorio): void => {
    setOrdenImprimir(null)
    setOrdenDetalle(orden)
    setEtapaFicha(orden.etapa)
    setNotaEtapaFicha('')
  }

  const guardarEtapaDesdeFicha = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!ordenDetalleActual || etapaFicha === ordenDetalleActual.etapa) return
    try {
      await actualizarEtapaOrden(ordenDetalleActual.id, etapaFicha, notaEtapaFicha)
      setNotaEtapaFicha('')
    } catch (error) {
      await dialogAlert({
        title: 'No se pudo registrar la etapa',
        description: error instanceof Error ? error.message : 'La etapa y su nota no fueron guardadas.',
        variant: 'warning', confirmText: 'Entendido'
      })
    }
  }

  const guardarEdicionOrden = async (changes: Parameters<typeof editarOrden>[1]): Promise<void> => {
    if (!ordenDetalleActual) return
    await editarOrden(ordenDetalleActual.id, changes)
  }

  const crearTipoTrabajo = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!nombreTipo.trim()) return
    setErrorCatalogo(null)
    try {
      await guardarTipoTrabajo({
        categoria: categoriaTipo,
        nombre: nombreTipo.trim(),
        diasEstimados: diasTipo ? Number(diasTipo) : null,
        estado: 'activo'
      })
      setNombreTipo('')
      setDiasTipo('')
    } catch (error) {
      setErrorCatalogo(error instanceof Error ? error.message : 'No se pudo guardar el tipo de trabajo.')
    }
  }

  const tabButton = (id: TabLaboratorio, label: string, Icon: React.ElementType): React.ReactNode => (
    <button
      key={id}
      type="button"
      onClick={() => { setTabActual(id); setOrdenImprimir(null); setOrdenDetalle(null) }}
      aria-pressed={tabActual === id}
      className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${tabActual === id
        ? 'bg-primary text-primary-foreground dark:bg-champagne-300 dark:text-graphite-950 shadow-xs'
        : 'bg-gray-100 dark:bg-graphite-800 text-gray-600 dark:text-graphite-400 hover:bg-gray-200'}`}
    >
      <span className="inline-flex items-center gap-1.5"><Icon size={13} />{label}</span>
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FlaskConical}
        title="Trabajos de laboratorio dental"
        description="Directorio, catálogo y seguimiento clínico de órdenes de laboratorio."
        className="print:hidden"
        actions={tabActual === 'historial' && puedeCrear && (
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="bg-primary hover:bg-champagne-400 dark:bg-champagne-300 dark:hover:bg-champagne-200 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-xl transition-micro shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="inline-flex items-center gap-1.5"><Plus size={14} />Nueva orden</span>
          </button>
        )}
      />

      <div className="print:hidden">
        <LaboratorioSummaryCards resumen={resumen} />
      </div>

      {(errorSincronizacion || pendientesSincronizacion > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950" role="status">
          <span>{errorSincronizacion || `${pendientesSincronizacion} operación(es) esperan sincronización.`}</span>
          <Button type="button" size="sm" variant="outline" loading={cargando} onClick={() => void recargar()}>Reintentar</Button>
        </div>
      )}

      <div className="scrollable-tab-strip flex flex-nowrap gap-2 overflow-x-auto border-b border-gray-200 dark:border-graphite-700 pb-1 print:hidden" role="group" aria-label="Secciones de laboratorio">
        {tabButton('datos', 'Datos generales', Folder)}
        {tabButton('catalogo', 'Catálogo', Settings)}
        {tabButton('historial', 'Historial de órdenes', ClipboardList)}
        {tabButton('estadisticas', 'Estadísticas', BarChart3)}
      </div>

      {tabActual === 'datos' && <DirectorioLaboratorios
        laboratorios={laboratorios}
        puedeGestionar={puedeGestionarLaboratorios}
        alGuardarLab={guardarOActualizarLaboratorio}
      />}

      {tabActual === 'catalogo' && (
        <div className="space-y-5 text-sm">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1fr)] gap-5">
          {puedeGestionarLaboratorios && <form onSubmit={crearTipoTrabajo} className="rounded-2xl border border-surface bg-surface p-5 space-y-3">
            <h3 className="font-semibold border-b border-surface pb-3">Agregar tipo de trabajo</h3>
            <label className="block space-y-1 font-medium">
              <span>Categoría *</span>
              <select value={categoriaTipo} onChange={event => setCategoriaTipo(event.target.value as CategoriaLaboratorio)} className="w-full min-h-10 rounded-lg border border-surface bg-background px-3">
                {CATEGORIAS_LABORATORIO.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </label>
            <Input label="Nombre del tipo de trabajo *" required value={nombreTipo} onChange={event => setNombreTipo(event.target.value)} />
            <Input label="Días estimados" type="number" min={1} max={365} value={diasTipo} onChange={event => setDiasTipo(event.target.value)} />
            {errorCatalogo && <p role="alert" className="text-xs text-clinical-error">{errorCatalogo}</p>}
            <Button type="submit" icon={Plus} fullWidth>Agregar al catálogo</Button>
          </form>}
          <section className="rounded-2xl border border-surface bg-surface p-5 space-y-4" aria-label="Tipos de trabajo y plantillas">
            <h3 className="font-semibold">Tipos de trabajo activos</h3>
            {tiposTrabajo.length === 0 ? <p className="text-sm text-muted-foreground">El catálogo está vacío.</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tiposTrabajo.map(tipo => <article key={tipo.id} className="rounded-xl border border-surface p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{CATEGORIAS_LABORATORIO.find(c => c.id === tipo.categoria)?.nombre || tipo.categoria}</p>
                  <h4 className="font-semibold">{tipo.nombre}</h4>
                  <p className="text-xs text-muted-foreground">{tipo.diasEstimados ? `${tipo.diasEstimados} días estimados` : 'Plazo por definir'}</p>
                </article>)}
              </div>
            )}
            <div className="border-t border-surface pt-4">
              <h3 className="font-semibold">Plantillas</h3>
              <p className="mt-1 text-xs text-muted-foreground">{plantillas.filter(row => row.estado === 'activo').length} plantilla(s) disponibles para nuevas órdenes.</p>
            </div>
          </section>
        </div>
        <CatalogoPreciosLaboratorio
          laboratorios={laboratorios.filter(item => item.estado !== 'inactivo').map(item => ({ id: String(item.id), nombre: item.nombre }))}
          tiposTrabajo={tiposTrabajo.filter(item => item.estado === 'activo').map(item => ({ id: item.id, nombre: item.nombre }))}
          puedeGestionar={puedeGestionarLaboratorios}
        />
        <PlantillasLaboratorioManager
          clinicaId={clinicaId}
          plantillas={plantillas}
          puedeConfigurar={puedeConfigurarPlantillas}
          onCambio={recargar}
        />
        <PermisosLaboratorioManager clinicaId={clinicaId} puedeConfigurar={rol === 'admin'} />
        </div>
      )}

      {tabActual === 'historial' && (ordenImprimir ? (
        <OrdenImprimible orden={ordenImprimir} userProfile={userProfile} alCerrar={() => setOrdenImprimir(null)} />
      ) : <>
        <LaboratorioAlertasPanel clinicaId={clinicaId} puedeConfigurar={puedeConfigurarAlertas} />
        <div className="bg-gray-50 dark:bg-graphite-800 p-4 border border-gray-200 dark:border-graphite-700 rounded-2xl flex flex-wrap items-center gap-3 text-xs print:hidden">
          <label className="flex items-center gap-2 font-semibold text-gray-600 dark:text-graphite-400">
            Etapa
            <select value={etapaFiltro} onChange={event => setEtapaFiltro(event.target.value)} className="p-2 border border-gray-300 dark:border-graphite-600 rounded-xl bg-white dark:bg-graphite-800 font-semibold">
              <option value="Todas">Todas</option>
              {ETAPAS_LABORATORIO.map(stage => <option key={stage.id} value={stage.id}>{stage.nombre}</option>)}
            </select>
          </label>
          <input type="search" placeholder="Buscar orden, paciente o trabajo…" value={busqueda} onChange={event => setBusqueda(event.target.value)} className="p-2 border border-gray-300 dark:border-graphite-600 rounded-xl bg-white dark:bg-graphite-800 w-full sm:ml-auto sm:w-72" />
        </div>
        <TablaOrdenesLaboratorio
          ordenes={ordenes}
          onActualizarEtapa={cambiarEtapa}
          puedeCambiarEtapa={puedeCambiarEtapa}
          onSeleccionarImprimir={orden => { setOrdenDetalle(null); setOrdenImprimir(orden) }}
          onSeleccionarDetalle={seleccionarDetalle}
        />
        {ordenDetalleActual && (
          <section className="rounded-2xl border border-primary/20 bg-background p-4 space-y-4" aria-label={`Detalle de ${ordenDetalleActual.codigoOrden}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold">Orden {ordenDetalleActual.codigoOrden}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{ordenDetalleActual.pacienteNombre} · {ordenDetalleActual.tipoTrabajo} · {ordenDetalleActual.etapa}</p>
              </div>
              <div className="flex gap-2">
                {puedeEditar && <Button type="button" variant="outline" size="sm" icon={Pencil} onClick={() => setModalEditarAbierto(true)}>Editar orden</Button>}
                <Button type="button" variant="outline" size="sm" onClick={() => { setOrdenDetalle(null); setModalEditarAbierto(false) }}>Cerrar ficha</Button>
              </div>
            </div>
            {puedeCambiarEtapa && ordenDetalleActual.etapa !== 'entrega' && (
              <form onSubmit={event => void guardarEtapaDesdeFicha(event)} className="grid grid-cols-1 gap-3 rounded-xl border border-surface p-3 sm:grid-cols-[minmax(12rem,0.5fr)_minmax(14rem,1fr)_auto] sm:items-end">
                <label className="block space-y-1 text-xs font-medium"><span>Nueva etapa</span>
                  <select value={etapaFicha} onChange={event => setEtapaFicha(event.target.value as OrdenLaboratorio['etapa'])} className="w-full min-h-10 rounded-lg border border-surface bg-background px-3">
                    {ETAPAS_LABORATORIO.map(stage => <option key={stage.id} value={stage.id}>{stage.nombre}</option>)}
                  </select>
                </label>
                <label className="block space-y-1 text-xs font-medium"><span>Nota de transición (opcional)</span>
                  <Input maxLength={2000} value={notaEtapaFicha} onChange={event => setNotaEtapaFicha(event.target.value)} placeholder="Motivo, ajuste solicitado o recepción del trabajo" />
                </label>
                <Button type="submit" size="sm" disabled={etapaFicha === ordenDetalleActual.etapa}>Guardar etapa</Button>
              </form>
            )}
            <section className="space-y-2" aria-label="Historial de etapas">
              <h3 className="text-xs font-semibold">Historial de etapas</h3>
              {ordenDetalleActual.historial?.length ? (
                <ol className="space-y-2">
                  {[...ordenDetalleActual.historial].reverse().map((item, index) => (
                    <li key={`${item.registradoEn}-${index}`} className="rounded-lg bg-surface px-3 py-2 text-xs">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-semibold">{item.etapaAnterior ? `${ETAPAS_LABORATORIO.find(stage => stage.id === item.etapaAnterior)?.nombre || item.etapaAnterior} → ` : ''}{ETAPAS_LABORATORIO.find(stage => stage.id === item.etapa)?.nombre || item.etapa}</span>
                        <time dateTime={item.registradoEn} className="text-muted-foreground">{new Date(item.registradoEn).toLocaleString('es-CL')}</time>
                      </div>
                      {item.notas && <p className="mt-1 whitespace-pre-wrap">{item.notas}</p>}
                    </li>
                  ))}
                </ol>
              ) : <p className="text-xs text-muted-foreground">Todavía no hay cambios de etapa registrados.</p>}
            </section>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <LaboratorioDocumentosPanel
                orden={ordenDetalleActual}
                puedeSubir={rol === 'admin' || rol === 'dentista'}
                onCambio={recargar}
              />
              <GarantiasLaboratorioPanel
                orden={ordenDetalleActual}
                puedeCrearReclamo={rol === 'admin' || rol === 'dentista'}
                puedeAprobar={puedeAprobarGarantias}
                onCambio={recargar}
              />
            </div>
          </section>
        )}
        <FinanzasOrdenLaboratorio
          key={clinicaId || 'sin-clinica'}
          clinicaId={clinicaId}
          ordenes={ordenes}
          puedeVerCostos={puedeVerCostos}
          puedePagar={puedePagarLaboratorios}
          puedeVerPrecioPaciente={rol === 'admin' || rol === 'dentista' || puedeVerCostos}
          puedeGuardarCosto={rol === 'admin'}
        />
      </>)}

      {tabActual === 'estadisticas' && <DashboardLaboratorio
        clinicaId={clinicaId}
        puedeVerFinanzas={rol === 'admin' || puedeVerCostos || puedePagarLaboratorios}
      />}

      {modalAbierto && <ModalNuevaOrden
        pacientes={pacientes}
        laboratorios={laboratorios}
        tiposTrabajo={tiposTrabajo}
        plantillas={plantillas}
        rol={rol}
        alGuardar={agregarOrden}
        alCerrar={() => setModalAbierto(false)}
      />}
      {modalEditarAbierto && ordenDetalleActual && <ModalEditarOrden
        orden={ordenDetalleActual}
        laboratorios={laboratorios}
        tiposTrabajo={tiposTrabajo}
        plantillas={plantillas}
        onGuardar={guardarEdicionOrden}
        onCerrar={() => setModalEditarAbierto(false)}
      />}
    </div>
  )
})

LaboratorioModulo.displayName = 'LaboratorioModulo'
export default LaboratorioModulo
