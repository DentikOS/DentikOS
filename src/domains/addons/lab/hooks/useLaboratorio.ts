import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { REALTIME_EVENTS } from '../../../../infrastructure/realtime/realtimeEvents'
import { laboratorioCloudService, type LaboratorioSnapshot, type NuevaOrdenLaboratorioInput } from '../services/laboratorioCloudService'
import { normalizarEtapaLaboratorioLegacy } from '../services/laboratorioImportService'
import { laboratorioOfflineQueueService } from '../services/laboratorioOfflineQueueService'
import { laboratorioStorageService } from '../services/laboratorioStorageService'
import { USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { calcularResumenLaboratorio, type ResumenLaboratorio } from '../utils/laboratorioCalculations'
import type {
  CategoriaLaboratorio,
  EtapaLaboratorioId,
  LaboratorioBase,
  OrdenLaboratorio
} from '../constants/laboratorioConstants'

export interface LabDataInput extends Partial<Omit<LaboratorioBase, 'id' | 'nombre'>> {
  nombre: string
  id?: string | number
}

export interface TipoTrabajoLaboratorio {
  id: string
  categoria: CategoriaLaboratorio
  nombre: string
  descripcion?: string | null
  diasEstimados?: number | null
  estado: 'activo' | 'inactivo'
}

interface LaboratorioViewData {
  clinicId: string | null
  ordenes: OrdenLaboratorio[]
  laboratorios: LaboratorioBase[]
  tiposTrabajo: TipoTrabajoLaboratorio[]
  plantillas: Record<string, unknown>[]
  pacientes: Array<{ id: string; nombre: string }>
  permisos: string[]
}

const emptyData = (clinicId: string | null = null): LaboratorioViewData => ({
  clinicId, ordenes: [], laboratorios: [], tiposTrabajo: [], plantillas: [], pacientes: [], permisos: []
})

const texto = (value: unknown): string => typeof value === 'string' ? value : ''

const mapearSnapshot = (clinicId: string, snapshot: LaboratorioSnapshot): LaboratorioViewData => {
  const pacientes = new Map(snapshot.pacientes.map(paciente => [paciente.id, paciente]))
  const laboratorios = new Map(snapshot.laboratorios.map(lab => [texto(lab.id), lab]))
  const tipos = new Map(snapshot.tiposTrabajo.map(tipo => [texto(tipo.id), tipo]))
  const historialPorOrden = new Map<string, OrdenLaboratorio['historial']>()
  for (const row of snapshot.historialEtapas) {
    const ordenId = texto(row.orden_id)
    if (!ordenId) continue
    const historial = historialPorOrden.get(ordenId) || []
    historial.push({
      etapa: texto(row.etapa) as EtapaLaboratorioId,
      etapaAnterior: typeof row.etapa_anterior === 'string' ? row.etapa_anterior as EtapaLaboratorioId : null,
      actorId: texto(row.actor_id),
      registradoEn: texto(row.registrado_en),
      notas: typeof row.notas === 'string' ? row.notas : null
    })
    historialPorOrden.set(ordenId, historial)
  }

  return {
    clinicId,
    laboratorios: snapshot.laboratorios.map(row => ({
      id: texto(row.id), nombre: texto(row.nombre), tipo: row.tipo as LaboratorioBase['tipo'],
      rut: texto(row.rut), contacto: texto(row.representante), representante: texto(row.representante),
      tecnicoResponsable: texto(row.tecnico_responsable), horarioRetiroEntrega: texto(row.horario_retiro_entrega),
      telefono: texto(row.telefono), email: texto(row.email), direccion: texto(row.direccion),
      especialidades: Array.isArray(row.especialidades) ? row.especialidades as string[] : [],
      estado: row.estado === 'inactivo' ? 'inactivo' : 'activo', tarifas: []
    })),
    tiposTrabajo: snapshot.tiposTrabajo.map(row => ({
      id: texto(row.id), categoria: row.categoria as CategoriaLaboratorio,
      nombre: texto(row.nombre), descripcion: texto(row.descripcion),
      diasEstimados: typeof row.dias_estimados === 'number' ? row.dias_estimados : null,
      estado: row.estado === 'inactivo' ? 'inactivo' : 'activo'
    })),
    plantillas: snapshot.plantillas,
    pacientes: snapshot.pacientes,
    permisos: snapshot.permisos,
    ordenes: snapshot.ordenes.map(row => {
      const paciente = pacientes.get(row.paciente_id)
      const laboratorio = row.laboratorio_id ? laboratorios.get(row.laboratorio_id) : undefined
      const tipo = tipos.get(row.tipo_trabajo_id)
      return {
        id: row.id,
        codigoOrden: row.folio,
        pacienteId: row.paciente_id,
        pacienteNombre: paciente?.nombre || 'Paciente no disponible',
        pacienteRut: '',
        laboratorioId: row.laboratorio_id,
        laboratorioNombre: texto(laboratorio?.nombre) || (row.solicitud_limitada ? 'Por asignar' : 'Sin laboratorio'),
        tipoTrabajo: texto(tipo?.nombre) || 'Tipo de trabajo no disponible',
        tipoTrabajoId: row.tipo_trabajo_id,
        categoria: tipo?.categoria as CategoriaLaboratorio | undefined,
        piezaDientaria: texto(row.pieza_dentaria),
        colorGuia: texto(row.color_guia),
        fechaEnvio: row.fecha_solicitud,
        fechaEntregaPrometida: row.fecha_estimada_entrega || '',
        etapa: row.etapa_actual,
        version: row.version,
        updatedAt: row.updated_at,
        plantillaId: row.plantilla_id,
        plantillaSnapshot: row.plantilla_snapshot || {},
        indicacionesTecnicas: texto(row.indicaciones_tecnicas),
        observaciones: texto(row.observaciones),
        responsableId: row.responsable_user_id,
        solicitudLimitada: row.solicitud_limitada,
        garantiaId: texto(row.garantia_id) || null,
        esReposicion: row.es_reposicion === true,
        historial: historialPorOrden.get(row.id) || [],
      }
    })
  }
}

const mapearLegacy = (clinicId: string | null): LaboratorioViewData => {
  const legacyOrders = laboratorioStorageService.obtenerOrdenes([])
  const legacyLabs = laboratorioStorageService.obtenerLaboratorios([])
  const patients = legacyOrders.map(order => ({
    id: String(order.pacienteId), nombre: order.pacienteNombre, rut: order.pacienteRut
  }))
  const orders = legacyOrders.map(order => ({
    ...order,
    etapa: normalizarEtapaLaboratorioLegacy(String(order.etapa)),
    laboratorioNombre: order.laboratorioNombre || 'Sin laboratorio',
    costoLaboratorio: undefined,
    estadoPagoLab: undefined
  }))
  return {
    clinicId,
    ordenes: orders,
    laboratorios: legacyLabs.map(lab => ({ ...lab, tarifas: [] })),
    tiposTrabajo: [], plantillas: [], pacientes: patients.map(({ id, nombre }) => ({ id, nombre })), permisos: []
  }
}

const extraerRol = (userProfile: unknown): string => {
  const raw = typeof userProfile === 'object' && userProfile !== null && 'rol' in userProfile
    ? String((userProfile as { rol?: unknown }).rol || '')
    : ''
  return raw.trim().toLocaleLowerCase('es-CL')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const esErrorTransitorio = (error: unknown): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : ''
  if (['AUTH_REQUIRED', 'CLINIC_REQUIRED', 'CLINIC_MEMBERSHIP_REQUIRED', 'CLINIC_CONTEXT_MISMATCH',
    'INVALID_REFERENCE', 'INVALID_TRANSITION', 'IDEMPOTENCY_CONFLICT', 'WRITE_REJECTED', 'STALE_VERSION'].includes(code)) return false
  const cause = typeof error === 'object' && error !== null && 'cause' in error
    ? (error as { cause?: unknown }).cause
    : error
  return cause instanceof TypeError || /network|fetch|offline|timeout|connection/i.test(String(cause))
}

export interface UseLaboratorioReturn {
  ordenes: OrdenLaboratorio[]
  laboratorios: LaboratorioBase[]
  tiposTrabajo: TipoTrabajoLaboratorio[]
  plantillas: Record<string, unknown>[]
  resumen: ResumenLaboratorio
  busqueda: string
  setBusqueda: React.Dispatch<React.SetStateAction<string>>
  etapaFiltro: string
  setEtapaFiltro: React.Dispatch<React.SetStateAction<string>>
  permisos: string[]
  rol: string
  puedeCrear: boolean
  puedeEditar: boolean
  puedeCambiarEtapa: boolean
  puedeGestionarLaboratorios: boolean
  puedeVerCostos: boolean
  puedePagarLaboratorios: boolean
  puedeAprobarGarantias: boolean
  puedeConfigurarAlertas: boolean
  cargando: boolean
  errorSincronizacion: string | null
  pendientesSincronizacion: number
  agregarOrden: (input: NuevaOrdenLaboratorioInput) => Promise<void>
  actualizarEtapaOrden: (idOrden: number | string, nuevaEtapa: string, notas?: string | null) => Promise<void>
  editarOrden: (idOrden: number | string, cambios: Partial<{
    laboratorioId: string | null
    tipoTrabajoId: string
    plantillaId: string | null
    plantillaSnapshot: Record<string, unknown>
    piezaDentaria: string | null
    colorGuia: string | null
    indicacionesTecnicas: string | null
    observaciones: string | null
    fechaEstimadaEntrega: string | null
  }>) => Promise<void>
  guardarOActualizarLaboratorio: (labData: LabDataInput) => Promise<void>
  guardarTipoTrabajo: (tipo: Omit<TipoTrabajoLaboratorio, 'id'> & { id?: string }) => Promise<void>
  recargar: () => Promise<void>
}

export const useLaboratorio = (): UseLaboratorioReturn => {
  const clinicaId = useSesionStore(state => state.clinicaActual)
  const userProfile = useSesionStore(state => state.userProfile)
  const rol = extraerRol(userProfile)
  const [data, setData] = useState<LaboratorioViewData>(() => emptyData())
  const [busqueda, setBusqueda] = useState('')
  const [etapaFiltro, setEtapaFiltro] = useState('Todas')
  const [cargandoClinica, setCargandoClinica] = useState<string | null>(null)
  const [errorState, setErrorState] = useState<{ clinicId: string; message: string } | null>(null)
  const [pendingState, setPendingState] = useState<{ clinicId: string; count: number } | null>(null)

  const aplicarSnapshot = useCallback((id: string, snapshot: LaboratorioSnapshot) => {
    if (useSesionStore.getState().clinicaActual !== id) return
    const view = mapearSnapshot(id, snapshot)
    laboratorioStorageService.guardarSnapshotCache(id, snapshot)
    setData(view)
    setErrorState(null)
  }, [])

  const recargar = useCallback(async (): Promise<void> => {
    if (!clinicaId) {
      setData(emptyData(null))
      return
    }
    if (!USE_SUPABASE) {
      setData(mapearLegacy(clinicaId))
      setErrorState(null)
      return
    }
    setCargandoClinica(clinicaId)
    try {
      const snapshot = await laboratorioCloudService.cargar()
      aplicarSnapshot(clinicaId, snapshot)
    } catch {
      setErrorState({ clinicId: clinicaId, message: 'No se pudo sincronizar el laboratorio. Se conserva la última copia disponible.' })
    } finally {
      setCargandoClinica(current => current === clinicaId ? null : current)
    }
  }, [aplicarSnapshot, clinicaId])

  useEffect(() => {
    if (!clinicaId) {
      setData(emptyData(null))
      setPendingState(null)
      return
    }
    if (USE_SUPABASE) {
      const cached = laboratorioStorageService.obtenerSnapshotCache(clinicaId)
      setData(cached ? mapearSnapshot(clinicaId, cached.snapshot) : emptyData(clinicaId))
      setPendingState({ clinicId: clinicaId, count: laboratorioOfflineQueueService.obtenerPendientes().length })
    } else {
      setData(mapearLegacy(clinicaId))
      setPendingState({ clinicId: clinicaId, count: 0 })
    }

    let active = true
    const refresh = async (): Promise<void> => {
      if (!active) return
      if (navigator.onLine) {
        const queueResult = await laboratorioOfflineQueueService.procesarPendientes()
        if (active) {
          setPendingState({ clinicId: clinicaId, count: laboratorioOfflineQueueService.obtenerPendientes().length })
          if (queueResult.procesados > 0) await recargar()
        }
      }
      if (active) await recargar()
    }
    const onRealtime = (): void => { void recargar() }
    window.addEventListener('online', refresh)
    window.addEventListener(REALTIME_EVENTS.LABORATORIO_CHANGED, onRealtime)
    void refresh()
    return () => {
      active = false
      window.removeEventListener('online', refresh)
      window.removeEventListener(REALTIME_EVENTS.LABORATORIO_CHANGED, onRealtime)
    }
  }, [clinicaId, recargar])

  const agregarOrden = useCallback(async (input: NuevaOrdenLaboratorioInput): Promise<void> => {
    if (!['admin', 'dentista', 'asistente', 'recepcion'].includes(rol)) {
      throw new Error('Tu rol no puede crear solicitudes de laboratorio')
    }
    if (!USE_SUPABASE) throw new Error('El registro de órdenes BP12 requiere conexión con Supabase')
    if (!clinicaId) throw new Error('Se requiere una clínica activa')
    try {
      await laboratorioCloudService.crearOrden(input)
      await recargar()
    } catch (error) {
      if (!esErrorTransitorio(error) || !laboratorioOfflineQueueService.encolar({
        clinicaId,
        idempotencyKey: input.idempotencyKey,
        tipo: 'crear_orden', input
      })) throw error
      setPendingState({ clinicId: clinicaId, count: laboratorioOfflineQueueService.obtenerPendientes().length })
    }
  }, [clinicaId, recargar, rol])

  const actualizarEtapaOrden = useCallback(async (
    idOrden: number | string,
    nuevaEtapa: string,
    notas?: string | null
  ): Promise<void> => {
    if (!['admin', 'dentista', 'asistente'].includes(rol)) {
      throw new Error('Tu rol no puede cambiar etapas de laboratorio')
    }
    if (!clinicaId) throw new Error('Se requiere una clínica activa')
    const order = data.clinicId === clinicaId ? data.ordenes.find(item => item.id === idOrden) : undefined
    if (!order || typeof order.id !== 'string' || !order.version) throw new Error('La orden todavía no está sincronizada')
    const etapa = nuevaEtapa as EtapaLaboratorioId
    if (!['solicitud', 'enviada', 'diseno', 'fabricacion', 'prueba', 'ajustes', 'entrega'].includes(etapa)) {
      throw new Error('La etapa seleccionada no es válida')
    }
    const notasSeguras = typeof notas === 'string' ? notas.trim() : ''
    if (notasSeguras.length > 2000) throw new Error('La nota de etapa no puede superar 2.000 caracteres')
    const command = {
      ordenId: order.id,
      etapa,
      notas: notasSeguras || null,
      idempotencyKey: laboratorioCloudService.generarIdempotencyKey(),
      versionEsperada: order.version
    }
    try {
      await laboratorioCloudService.transicionarEtapa(command)
      await recargar()
    } catch (error) {
      if (!esErrorTransitorio(error) || !laboratorioOfflineQueueService.encolar({
        clinicaId,
        idempotencyKey: command.idempotencyKey,
        tipo: 'transicionar_etapa', input: command
      })) {
        if (typeof error === 'object' && error !== null && 'code' in error
          && String((error as { code?: unknown }).code) === 'STALE_VERSION') await recargar()
        throw error
      }
      setPendingState({ clinicId: clinicaId, count: laboratorioOfflineQueueService.obtenerPendientes().length })
    }
  }, [clinicaId, data, recargar, rol])

  const editarOrden = useCallback(async (
    idOrden: number | string,
    cambios: Partial<{
      laboratorioId: string | null
      tipoTrabajoId: string
      plantillaId: string | null
      plantillaSnapshot: Record<string, unknown>
      piezaDentaria: string | null
      colorGuia: string | null
      indicacionesTecnicas: string | null
      observaciones: string | null
      fechaEstimadaEntrega: string | null
    }>
  ): Promise<void> => {
    if (!['admin', 'dentista'].includes(rol)) throw new Error('Solo administración o dentista puede editar los datos de la orden')
    if (!USE_SUPABASE) throw new Error('La edición de órdenes requiere conexión con Supabase')
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('La edición requiere conexión. Guarda de nuevo cuando se restablezca el acceso al servidor.')
    }
    if (!clinicaId) throw new Error('Se requiere una clínica activa')
    const order = data.clinicId === clinicaId ? data.ordenes.find(item => item.id === idOrden) : undefined
    if (!order || typeof order.id !== 'string' || !order.updatedAt) throw new Error('La orden no está sincronizada o necesita recarga')
    await laboratorioCloudService.editarOrden(order.id, cambios, order.updatedAt)
    await recargar()
  }, [clinicaId, data, recargar, rol])

  const guardarOActualizarLaboratorio = useCallback(async (input: LabDataInput): Promise<void> => {
    if (rol !== 'admin' && !data.permisos.includes('gestionar_laboratorios')) {
      throw new Error('No tienes permiso para gestionar el directorio de laboratorios')
    }
    const id = typeof input.id === 'string' ? input.id : undefined
    if (input.id && !id && USE_SUPABASE) throw new Error('Este registro local requiere revisión antes de editarse')
    await laboratorioCloudService.guardarLaboratorio({
      id, nombre: input.nombre, tipo: input.tipo || 'externo', rut: input.rut,
      direccion: input.direccion, telefono: input.telefono, email: input.email,
      representante: input.representante || input.contacto,
      tecnicoResponsable: input.tecnicoResponsable,
      horarioRetiroEntrega: input.horarioRetiroEntrega,
      especialidades: input.especialidades, estado: input.estado
    })
    await recargar()
  }, [data.permisos, recargar, rol])

  const guardarTipoTrabajo = useCallback(async (input: Omit<TipoTrabajoLaboratorio, 'id'> & { id?: string }): Promise<void> => {
    if (rol !== 'admin' && !data.permisos.includes('gestionar_laboratorios')) {
      throw new Error('No tienes permiso para gestionar los tipos de trabajo')
    }
    await laboratorioCloudService.guardarTipoTrabajo({
      id: input.id, categoria: input.categoria, nombre: input.nombre,
      descripcion: input.descripcion, diasEstimados: input.diasEstimados, estado: input.estado
    })
    await recargar()
  }, [data.permisos, recargar, rol])

  const visibleData = data.clinicId === clinicaId ? data : emptyData(clinicaId)
  const resumen = useMemo(() => calcularResumenLaboratorio(visibleData.ordenes), [visibleData.ordenes])
  const ordenes = useMemo(() => visibleData.ordenes.filter(order => {
    const coincideEtapa = etapaFiltro === 'Todas' || order.etapa === etapaFiltro
    const termino = busqueda.trim().toLocaleLowerCase('es-CL')
    const coincideBusqueda = !termino || [order.codigoOrden, order.pacienteNombre, order.tipoTrabajo, order.laboratorioNombre]
      .some(value => value.toLocaleLowerCase('es-CL').includes(termino))
    return coincideEtapa && coincideBusqueda
  }), [visibleData.ordenes, etapaFiltro, busqueda])
  const errorSincronizacion = errorState?.clinicId === clinicaId ? errorState.message : null
  const pendientesSincronizacion = pendingState?.clinicId === clinicaId ? pendingState.count : 0
  const puedeCrear = ['admin', 'dentista', 'asistente', 'recepcion'].includes(rol)
  const puedeEditar = ['admin', 'dentista'].includes(rol)
  const puedeCambiarEtapa = ['admin', 'dentista', 'asistente'].includes(rol)

  return {
    ordenes,
    laboratorios: visibleData.laboratorios,
    tiposTrabajo: visibleData.tiposTrabajo.filter(tipo => tipo.estado === 'activo'),
    plantillas: visibleData.plantillas,
    resumen,
    busqueda,
    setBusqueda,
    etapaFiltro,
    setEtapaFiltro,
    permisos: visibleData.permisos,
    rol,
    puedeCrear,
    puedeEditar,
    puedeCambiarEtapa,
    puedeGestionarLaboratorios: rol === 'admin' || visibleData.permisos.includes('gestionar_laboratorios'),
    puedeVerCostos: rol === 'admin' || visibleData.permisos.includes('ver_costos_laboratorio'),
    puedePagarLaboratorios: rol === 'admin' || visibleData.permisos.includes('pagar_laboratorios'),
    puedeAprobarGarantias: rol === 'admin' || (
      ['dentista', 'asistente'].includes(rol) && visibleData.permisos.includes('aprobar_garantias')
    ),
    puedeConfigurarAlertas: rol === 'admin',
    cargando: cargandoClinica === clinicaId,
    errorSincronizacion,
    pendientesSincronizacion,
    agregarOrden,
    actualizarEtapaOrden,
    editarOrden,
    guardarOActualizarLaboratorio,
    guardarTipoTrabajo,
    recargar
  }
}
