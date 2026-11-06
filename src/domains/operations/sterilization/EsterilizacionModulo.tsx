import React, { memo, useMemo, useState } from 'react'
import { AlertTriangle, BookOpen, Dna, FlaskConical, RefreshCw, Sparkles, Wrench } from 'lucide-react'
import { Button } from '../../../shared/ui/ui/Button'
import { PageHeader } from '../../../shared/ui/ui/PageHeader'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { useEsterilizacion } from './hooks/useEsterilizacion'
import { EsterilizacionSummaryCards } from './components/EsterilizacionSummaryCards'
import { TablaCargasEsterilizacion } from './components/TablaCargasEsterilizacion'
import { ControlBiologicoSection } from './components/ControlBiologicoSection'
import { TestDiariosSection } from './components/TestDiariosSection'
import { LibroSeremiSection } from './components/LibroSeremiSection'
import { ModalNuevaCarga } from './components/ModalNuevaCarga'
import { TicketTrazabilidad } from './components/TicketTrazabilidad'
import { ConfiguracionEsterilizacionPanel } from './components/ConfiguracionEsterilizacionPanel'
import { esterilizacionStorageService } from './services/esterilizacionStorageService'
import { esterilizacionCloudService, type CicloEsterilizacionCloud } from './services/esterilizacionCloudService'
import type { CargaEsterilizacion, PruebaBiologica, TestBowieDick } from './constants/esterilizacionConstants'
import { calcularResumenEsterilizacion } from './utils/esterilizacionCalculations'
import { fechaClinica, inicioSemanaClinica } from './utils/esterilizacionDate'

type TabEsterilizacion = 'cargas' | 'biologico' | 'test' | 'libro' | 'configuracion'

const estadoLegible: Record<CicloEsterilizacionCloud['estado'], string> = {
  preparacion: 'En preparación',
  en_curso: 'Autoclave en curso',
  liberado: 'Liberado',
  rechazado: 'Rechazado',
  retenido_biologico: 'Retenido por prueba biológica',
  cancelado: 'Cancelado',
  revisar_migracion: 'Revisión manual',
}

const fechaLocal = (valor?: string | null): string => valor ? new Date(valor).toLocaleDateString('es-CL') : '—'
const horaLocal = (valor?: string | null): string => valor ? new Date(valor).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'

export const EsterilizacionModulo: React.FC = memo(() => {
  const userProfile = useSesionStore((state: { userProfile?: { nombreCompleto?: string; [key: string]: unknown } | null }) => state.userProfile)
  const { snapshot, cargando, error, refrescar, esAdmin, puedeEntrar, clinicaId } = useEsterilizacion()
  const [tabActual, setTabActual] = useState<TabEsterilizacion>('cargas')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [cicloGestionado, setCicloGestionado] = useState<string | undefined>()
  const [cargaImprimir, setCargaImprimir] = useState<CargaEsterilizacion | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [equipoFiltro, setEquipoFiltro] = useState('Todos')
  const [errorAccion, setErrorAccion] = useState('')

  const equipos = useMemo(() => new Map(snapshot.equipos.map((equipo) => [equipo.id, equipo])), [snapshot.equipos])
  const ciclos = useMemo<CargaEsterilizacion[]>(() => snapshot.ciclos.map((ciclo) => {
    const instrumentos = snapshot.instrumentos.filter((item) => item.ciclo_id === ciclo.id)
    const piezas = instrumentos.map((item) => snapshot.inventario.find((inv) => inv.id === item.inventario_id)?.nombre || item.inventario_id)
    const ultimaBiologica = snapshot.pruebas.find((prueba) => prueba.tipo === 'biologico' && prueba.ciclo_id === ciclo.id)
    const tipo1 = instrumentos.map((item) => item.indicador_tipo1_aprobado)
    const tipo1Texto = tipo1.length === 0 || tipo1.every((resultado) => resultado === null)
      ? 'sin resultado'
      : tipo1.every((resultado) => resultado === true) ? 'aprobado' : 'rechazado'
    return {
      id: ciclo.id,
      cicloId: ciclo.id,
      equipoId: ciclo.equipo_id,
      lote: ciclo.lote,
      equipo: equipos.get(ciclo.equipo_id)?.nombre || ciclo.equipo_id,
      programa: ciclo.programa_nombre,
      fecha: fechaLocal(ciclo.iniciado_at),
      hora: horaLocal(ciclo.iniciado_at),
      temperatura: ciclo.temperatura_observada,
      presion: ciclo.presion_observada,
      tiempoMinutos: ciclo.duracion_observada_minutos,
      responsable: ciclo.etiqueta_operador || 'Usuario autenticado',
      indicadorQuimico: `Tipo 1: ${tipo1Texto} · Tipo 4: ${ciclo.indicador_tipo4 || 'sin resultado'}`,
      indicadorBiologico: ultimaBiologica ? `Prueba biológica: ${ultimaBiologica.estado}` : 'Sin prueba biológica registrada',
      contenido: piezas.length ? piezas.join(', ') : 'Sin instrumentos asociados',
      estado: estadoLegible[ciclo.estado],
      puedeCancelar: ['preparacion', 'en_curso'].includes(ciclo.estado),
      puedeGestionar: ['preparacion', 'en_curso'].includes(ciclo.estado),
    }
  }), [snapshot.ciclos, snapshot.instrumentos, snapshot.inventario, snapshot.pruebas, equipos])

  const pruebasBiologicas = useMemo<PruebaBiologica[]>(() => snapshot.pruebas
    .filter((prueba) => prueba.tipo === 'biologico')
    .map((prueba) => {
      const ciclo = snapshot.ciclos.find((item) => item.id === prueba.ciclo_id)
      return {
        id: prueba.id,
        loteAsociado: ciclo?.lote || 'Ciclo no disponible',
        equipo: equipos.get(prueba.equipo_id)?.nombre || prueba.equipo_id,
        fechaIncubacion: fechaLocal(prueba.observado_at),
        horaIncubacion: horaLocal(prueba.observado_at),
        marcaAmpolla: prueba.marca_indicador,
        horasRequeridas: Number(prueba.horas_incubacion || 0),
        resultado: prueba.estado === 'pendiente' ? 'Pendiente' : prueba.estado === 'aprobado' ? 'Aprobado' : 'Rechazado',
        responsableLectura: prueba.leido_por || prueba.creado_por,
        observacion: prueba.observacion,
      }
    }), [snapshot.pruebas, snapshot.ciclos, equipos])

  const pruebasBowie = useMemo<TestBowieDick[]>(() => snapshot.pruebas
    .filter((prueba) => prueba.tipo === 'bowie_dick')
    .map((prueba) => ({
      id: prueba.id,
      fecha: fechaLocal(prueba.observado_at),
      equipo: equipos.get(prueba.equipo_id)?.nombre || prueba.equipo_id,
      resultado: prueba.estado === 'aprobado' ? 'Aprobado' : 'Rechazado',
      operador: prueba.creado_por,
      observacion: prueba.observacion,
    })), [snapshot.pruebas, equipos])

  const resumen = useMemo(() => {
    return calcularResumenEsterilizacion(
      ciclos.map((ciclo) => ({ fecha: ciclo.fecha, estado: ciclo.estado, indicadorQuimico: ciclo.indicadorQuimico })),
      pruebasBiologicas.map((prueba) => ({ resultado: prueba.resultado })),
      pruebasBowie.map((prueba) => ({ fecha: prueba.fecha, equipo: prueba.equipo, resultado: prueba.resultado }))
    )
  }, [snapshot.pruebas, ciclos, pruebasBiologicas, pruebasBowie])

  const ciclosFiltrados = useMemo(() => ciclos.filter((ciclo) => {
    const equipoCoincide = equipoFiltro === 'Todos' || ciclo.equipoId === equipoFiltro
    const texto = `${ciclo.lote} ${ciclo.contenido} ${ciclo.responsable}`.toLocaleLowerCase('es-CL')
    return equipoCoincide && (!busqueda.trim() || texto.includes(busqueda.trim().toLocaleLowerCase('es-CL')))
  }), [ciclos, equipoFiltro, busqueda])

  const alertas = useMemo(() => {
    const zona = snapshot.zonaHoraria || 'America/Santiago'
    const hoy = fechaClinica(new Date(), zona)
    const semana = inicioSemanaClinica(new Date(), zona)
    const resultado: Array<{ id: string; mensaje: string; tipo: 'critica' | 'aviso' }> = []
    for (const equipo of snapshot.equipos) {
      if (equipo.tipo_item !== 'equipamiento') continue
      const bowieHoy = snapshot.pruebas
        .filter((prueba) => prueba.tipo === 'bowie_dick' && prueba.equipo_id === equipo.id && fechaClinica(prueba.observado_at, zona) === hoy)
        .sort((a, b) => b.observado_at.localeCompare(a.observado_at))[0]
      if (bowieHoy?.estado !== 'aprobado') {
        resultado.push({ id: `bowie-${equipo.id}`, mensaje: `Bowie-Dick sin aprobación vigente hoy · ${equipo.nombre}. Bloquea el inicio de ciclos; administración puede autorizar una excepción con motivo.`, tipo: 'critica' })
      }
      const biologicoSemana = snapshot.pruebas
        .filter((prueba) => prueba.tipo === 'biologico' && prueba.equipo_id === equipo.id && inicioSemanaClinica(prueba.observado_at, zona) === semana)
        .sort((a, b) => b.observado_at.localeCompare(a.observado_at))[0]
      if (esAdmin && !biologicoSemana) {
        resultado.push({ id: `biologico-${equipo.id}`, mensaje: `Indicador biológico semanal pendiente · ${equipo.nombre}.`, tipo: 'critica' })
      } else if (esAdmin && biologicoSemana?.estado === 'pendiente') {
        resultado.push({ id: `biologico-pendiente-${equipo.id}`, mensaje: `Indicador biológico pendiente de lectura · ${equipo.nombre}.`, tipo: 'critica' })
      } else if (esAdmin && biologicoSemana?.estado === 'rechazado') {
        resultado.push({ id: `biologico-fallido-${equipo.id}`, mensaje: `Indicador biológico rechazado · ${equipo.nombre}. El instrumental vinculado permanece retenido.`, tipo: 'critica' })
      }
      if (equipo.proxima_mantencion && equipo.proxima_mantencion < hoy) {
        resultado.push({ id: `mantencion-${equipo.id}`, mensaje: `Mantención registrada vencida · ${equipo.nombre}. No se pueden iniciar nuevos ciclos.`, tipo: 'aviso' })
      }
    }
    for (const ciclo of snapshot.ciclos.filter((item) => ['rechazado', 'retenido_biologico'].includes(item.estado))) {
      resultado.push({ id: `rechazado-${ciclo.id}`, mensaje: `Instrumental retenido por resultado fallido · lote ${ciclo.lote}. Requiere revisión y reproceso autorizado.`, tipo: 'critica' })
    }
    for (const config of snapshot.insumosConfig) {
      const item = snapshot.inventario.find((inventario) => inventario.id === config.inventario_id)
      if (item && Number(item.cantidad_minima) > 0 && Number(item.cantidad_actual) <= Number(item.cantidad_minima)) {
        resultado.push({ id: `stock-${item.id}-${config.tipo_consumo}`, mensaje: `Stock bajo mínimo · ${item.nombre}: ${item.cantidad_actual} ${item.unidad_medida || config.unidad} (mínimo ${item.cantidad_minima}).`, tipo: 'aviso' })
      }
    }
    return resultado
  }, [snapshot, esAdmin])

  const legado = useMemo(() => {
    try {
      return {
        cargas: esterilizacionStorageService.obtenerCargas([]) || [],
        biologicos: esterilizacionStorageService.obtenerBiologicos([]) || [],
        bowie: esterilizacionStorageService.obtenerTestDiarios([]) || [],
      }
    } catch {
      return { cargas: [], biologicos: [], bowie: [] }
    }
  }, [clinicaId])

  const cancelarCiclo = async (id: number | string) => {
    const ciclo = snapshot.ciclos.find((item) => item.id === String(id))
    if (!ciclo || !['preparacion', 'en_curso'].includes(ciclo.estado)) return
    const justificacion = window.prompt(`Justificación obligatoria para cancelar el ciclo ${ciclo.lote} (mínimo 5 caracteres):`)?.trim()
    if (!justificacion || justificacion.length < 5) {
      setErrorAccion('No se canceló el ciclo. La justificación debe contener al menos 5 caracteres.')
      return
    }
    setErrorAccion('')
    try {
      await esterilizacionCloudService.cancelarCiclo({ cicloId: ciclo.id, justificacion })
      await refrescar()
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : 'No se pudo cancelar el ciclo en DentikOS.')
    }
  }

  if (!puedeEntrar) {
    return <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">{error || 'Este módulo está disponible para administración y asistentes autorizados.'}</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Esterilización e instrumental"
        description="Ciclos, indicadores, consumo de insumos y trazabilidad sincronizados con DentikOS."
        className="print:hidden"
        actions={<div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => void refrescar()} disabled={cargando}>
            <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} />Actualizar
          </Button>
          {tabActual === 'cargas' && <Button onClick={() => { setCicloGestionado(undefined); setModalAbierto(true) }} size="sm" disabled={cargando}>+ Registrar ciclo</Button>}
        </div>}
      />

      {(error || errorAccion) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorAccion || error}</p>}
      {cargando && <p role="status" className="text-xs text-graphite-500">Consultando estado sincronizado de la clínica…</p>}

      {!error && !cargando && alertas.length > 0 && <section aria-label="Alertas de esterilización" className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
        <h2 className="flex items-center gap-2 font-bold"><AlertTriangle size={16} />Alertas de esterilización</h2>
        <ul className="space-y-1">{alertas.map((alerta) => <li key={alerta.id} className={alerta.tipo === 'aviso' ? 'text-amber-800 dark:text-amber-200' : ''}>{alerta.mensaje}</li>)}</ul>
      </section>}

      {!error && !cargando && <div className="print:hidden"><EsterilizacionSummaryCards resumen={resumen} /></div>}

      <div className="scrollable-tab-strip flex flex-nowrap gap-2 overflow-x-auto border-b pb-1 print:hidden text-xs" role="tablist" aria-label="Secciones de esterilización">
        {([
          ['cargas', <><FlaskConical size={12} />Ciclos</>],
          ['biologico', <><Dna size={13} />Pruebas biológicas</>],
          ['test', <><Wrench size={13} />Bowie-Dick</>],
          ['libro', <><BookOpen size={12} />Libro y exportación</>],
          ...(esAdmin ? [['configuracion', <><Wrench size={12} />Configuración</>]] as const : []),
        ] as const).map(([tab, label]) => <Button
          key={tab}
          role="tab"
          aria-selected={tabActual === tab}
          aria-pressed={tabActual === tab}
          onClick={() => setTabActual(tab)}
          variant={tabActual === tab ? 'primary' : 'secondary'}
          size="sm"
          className="shrink-0 whitespace-nowrap"
        >{label}</Button>)}
      </div>

      {tabActual === 'cargas' && (cargaImprimir ? (
        <TicketTrazabilidad carga={cargaImprimir} alCerrar={() => setCargaImprimir(null)} />
      ) : <>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-surface bg-surface-muted p-4 print:hidden">
          <label className="flex items-center gap-2 text-xs font-semibold">Equipo
            <select value={equipoFiltro} onChange={(event) => setEquipoFiltro(event.target.value)} className="rounded-xl border border-surface bg-surface p-2">
              <option value="Todos">Todos</option>{snapshot.equipos.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.nombre}</option>)}
            </select>
          </label>
          <input aria-label="Buscar ciclo" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar lote, instrumental u operador" className="min-w-[220px] flex-1 rounded-xl border border-surface bg-surface p-2 text-xs" />
        </div>
        <TablaCargasEsterilizacion
          cargas={ciclosFiltrados}
          onSeleccionarImprimir={setCargaImprimir}
          onCancelar={(id) => void cancelarCiclo(id)}
          onGestionar={(carga) => { setCicloGestionado(carga.cicloId); setModalAbierto(true) }}
        />
      </>)}

      {tabActual === 'biologico' && <ControlBiologicoSection snapshot={snapshot} onRefresh={refrescar} />}
      {tabActual === 'test' && <TestDiariosSection snapshot={snapshot} onRefresh={refrescar} />}
      {tabActual === 'libro' && <LibroSeremiSection snapshot={snapshot} userProfile={userProfile} />}
      {tabActual === 'configuracion' && esAdmin && <ConfiguracionEsterilizacionPanel snapshot={snapshot} onRefresh={refrescar} />}

      {(legado.cargas.length + legado.biologicos.length + legado.bowie.length) > 0 && (
        <details className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
          <summary className="cursor-pointer font-bold">Registros locales anteriores para revisión · {legado.cargas.length + legado.biologicos.length + legado.bowie.length}</summary>
          <p className="mt-2">Estos datos no están sincronizados, no fueron validados por DentikOS y no liberan instrumental. Se conservan localmente para revisión; no se importaron como ciclos actuales.</p>
          <div className="mt-3 space-y-2">
            {legado.cargas.map((item) => <p key={`c-${item.id}`} className="border-t border-amber-200 pt-2"><strong>{item.lote}</strong> · {item.fecha} {item.hora} · {item.equipo} · estado legado: {item.estado}</p>)}
            {legado.biologicos.map((item) => <p key={`b-${item.id}`} className="border-t border-amber-200 pt-2">Prueba local · {item.loteAsociado} · {item.fechaIncubacion} · estado legado: {item.resultado}</p>)}
            {legado.bowie.map((item) => <p key={`d-${item.id}`} className="border-t border-amber-200 pt-2">Bowie-Dick local · {item.fecha} · {item.equipo} · estado legado: {item.resultado}</p>)}
          </div>
        </details>
      )}

      {modalAbierto && <ModalNuevaCarga
        snapshot={snapshot}
        userProfile={userProfile}
        esAdmin={esAdmin}
        cicloInicialId={cicloGestionado}
        onActualizado={refrescar}
        alCerrar={() => { setModalAbierto(false); setCicloGestionado(undefined) }}
      />}
    </div>
  )
})

EsterilizacionModulo.displayName = 'EsterilizacionModulo'
