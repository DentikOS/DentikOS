import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import type { CategoriaLaboratorio, EtapaLaboratorioId } from '../constants/laboratorioConstants'

const log = createLogger('laboratorioCloudService')

export interface OrdenLaboratorioRow {
  id: string
  clinica_id: string
  folio: string
  paciente_id: string
  laboratorio_id: string | null
  tipo_trabajo_id: string
  plantilla_id: string | null
  plantilla_snapshot: Record<string, unknown>
  etapa_actual: EtapaLaboratorioId
  version: number
  solicitud_limitada: boolean
  pieza_dentaria: string | null
  color_guia: string | null
  indicaciones_tecnicas: string | null
  observaciones: string | null
  responsable_user_id: string | null
  fecha_solicitud: string
  fecha_estimada_entrega: string | null
  fecha_entrega: string | null
  created_by: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface LaboratorioSnapshot {
  ordenes: OrdenLaboratorioRow[]
  historialEtapas: Record<string, unknown>[]
  laboratorios: Record<string, unknown>[]
  tiposTrabajo: Record<string, unknown>[]
  plantillas: Record<string, unknown>[]
  pacientes: Array<{ id: string; nombre: string }>
  permisos: string[]
}

export interface CatalogoLaboratorioPresupuesto {
  laboratorios: Array<{ id: string; nombre: string; tipo: string }>
  tiposTrabajo: Array<{ id: string; nombre: string; categoria: CategoriaLaboratorio; diasEstimados: number | null }>
}

export interface NuevaOrdenLaboratorioInput {
  pacienteId: string
  laboratorioId?: string | null
  tipoTrabajoId: string
  plantillaId?: string | null
  plantillaSnapshot?: Record<string, unknown>
  piezaDentaria?: string | null
  colorGuia?: string | null
  indicacionesTecnicas?: string | null
  observaciones?: string | null
  responsableUserId?: string | null
  fechaSolicitud?: string
  fechaEstimadaEntrega?: string | null
  solicitudLimitada?: boolean
  idempotencyKey: string
}

export interface LaboratorioCatalogInput {
  id?: string
  nombre: string
  tipo?: 'externo' | 'interno' | 'digital'
  rut?: string | null
  direccion?: string | null
  telefono?: string | null
  email?: string | null
  representante?: string | null
  tecnicoResponsable?: string | null
  horarioRetiroEntrega?: string | null
  especialidades?: string[]
  estado?: 'activo' | 'inactivo'
}

export interface LaboratorioTipoTrabajoInput {
  id?: string
  categoria: CategoriaLaboratorio
  nombre: string
  descripcion?: string | null
  diasEstimados?: number | null
  estado?: 'activo' | 'inactivo'
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class LaboratorioCloudError extends Error {
  constructor(message: string, readonly code: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LaboratorioCloudError'
  }
}

const requireContext = async (): Promise<{ clinicaId: string; userId: string }> => {
  if (!USE_SUPABASE || !supabase) {
    throw new LaboratorioCloudError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
  }
  const clinicaLocal = getClinicaActivaSync()
  if (!clinicaLocal) {
    throw new LaboratorioCloudError('Se requiere una clínica activa', 'CLINIC_REQUIRED')
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session?.user?.id) {
    throw new LaboratorioCloudError('Se requiere una sesión autenticada', 'AUTH_REQUIRED')
  }

  const { data: clinicaServidor, error: clinicError } = await supabase.rpc('clinica_actual')
  if (clinicError || !clinicaServidor) {
    throw new LaboratorioCloudError('El servidor no confirmó una membresía activa', 'CLINIC_MEMBERSHIP_REQUIRED')
  }
  if (clinicaServidor !== clinicaLocal) {
    throw new LaboratorioCloudError('La clínica activa del servidor no coincide con la seleccionada', 'CLINIC_CONTEXT_MISMATCH')
  }

  return { clinicaId: clinicaServidor, userId: sessionData.session.user.id }
}

const queryClinicTable = async <T extends Record<string, unknown>>(
  table: string,
  clinicaId: string,
  orderColumn = 'created_at'
): Promise<T[]> => {
  if (!supabase) throw new LaboratorioCloudError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('clinica_id', clinicaId)
    .order(orderColumn, { ascending: false })
  if (error) {
    log.warn(`No se pudo cargar ${table} desde el servidor`)
    throw new LaboratorioCloudError('No se pudo sincronizar el laboratorio', 'LOAD_FAILED', { cause: error })
  }
  return (data || []) as T[]
}

const matchesOrderInput = (row: Record<string, unknown>, input: NuevaOrdenLaboratorioInput): boolean => (
  row.paciente_id === input.pacienteId
  && row.laboratorio_id === (input.laboratorioId || null)
  && row.tipo_trabajo_id === input.tipoTrabajoId
  && row.plantilla_id === (input.plantillaId || null)
  && row.pieza_dentaria === (input.piezaDentaria || null)
  && row.color_guia === (input.colorGuia || null)
  && row.indicaciones_tecnicas === (input.indicacionesTecnicas || null)
  && row.observaciones === (input.observaciones || null)
  && row.fecha_estimada_entrega === (input.fechaEstimadaEntrega || null)
)

export const laboratorioCloudService = {
  async cargar(): Promise<LaboratorioSnapshot> {
    const { clinicaId, userId } = await requireContext()
    const [ordenes, historialEtapas, laboratorios, tiposTrabajo, plantillas] = await Promise.all([
      queryClinicTable<OrdenLaboratorioRow>('ordenes_laboratorio', clinicaId),
      queryClinicTable('historial_etapas_laboratorio', clinicaId, 'registrado_en'),
      queryClinicTable('laboratorios', clinicaId, 'nombre'),
      queryClinicTable('laboratorio_tipos_trabajo', clinicaId, 'nombre'),
      queryClinicTable('plantillas_laboratorio', clinicaId, 'nombre')
    ])
    const patientIds = [...new Set(ordenes.map(order => order.paciente_id).filter(Boolean))]
    let pacientes: LaboratorioSnapshot['pacientes'] = []
    if (patientIds.length > 0 && supabase) {
      const { data, error } = await supabase.from('pacientes')
        .select('id,nombre')
        .eq('clinica_id', clinicaId)
        .in('id', patientIds)
      if (error) {
        throw new LaboratorioCloudError('No se pudieron cargar los nombres de pacientes', 'PATIENTS_LOAD_FAILED', { cause: error })
      }
      pacientes = (data || []) as LaboratorioSnapshot['pacientes']
    }
    const { data: permisosData, error: permisosError } = await supabase!
      .from('permisos_laboratorio_aditivos')
      .select('permiso')
      .eq('clinica_id', clinicaId)
      .eq('user_id', userId)
    if (permisosError) {
      throw new LaboratorioCloudError('No se pudieron cargar los permisos del laboratorio', 'PERMISSIONS_LOAD_FAILED', { cause: permisosError })
    }
    const permisos = (permisosData || []).map((row: { permiso: string }) => row.permiso)
    return { ordenes, historialEtapas, laboratorios, tiposTrabajo, plantillas, pacientes, permisos }
  },

  async cargarCatalogoPresupuesto(): Promise<CatalogoLaboratorioPresupuesto> {
    const { clinicaId } = await requireContext()
    if (!supabase) throw new LaboratorioCloudError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const [laboratorios, tipos] = await Promise.all([
      supabase.from('laboratorios').select('id,nombre,tipo')
        .eq('clinica_id', clinicaId).eq('estado', 'activo').order('nombre'),
      supabase.from('laboratorio_tipos_trabajo').select('id,nombre,categoria,dias_estimados')
        .eq('clinica_id', clinicaId).eq('estado', 'activo').order('nombre')
    ])
    if (laboratorios.error || tipos.error) {
      throw new LaboratorioCloudError('No se pudo cargar el catálogo de laboratorio de la clínica', 'CATALOG_LOAD_FAILED', {
        cause: laboratorios.error || tipos.error
      })
    }
    return {
      laboratorios: (laboratorios.data || []).map(row => ({
        id: String(row.id), nombre: String(row.nombre), tipo: String(row.tipo)
      })),
      tiposTrabajo: (tipos.data || []).map(row => ({
        id: String(row.id), nombre: String(row.nombre),
        categoria: row.categoria as CategoriaLaboratorio,
        diasEstimados: typeof row.dias_estimados === 'number' ? row.dias_estimados : null
      }))
    }
  },

  async guardarLaboratorio(input: LaboratorioCatalogInput): Promise<Record<string, unknown>> {
    const { clinicaId } = await requireContext()
    if (!supabase) throw new LaboratorioCloudError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const row = {
      nombre: input.nombre.trim(), tipo: input.tipo || 'externo', rut: input.rut || null,
      direccion: input.direccion || null, telefono: input.telefono || null,
      email: input.email || null, representante: input.representante || null,
      tecnico_responsable: input.tecnicoResponsable || null,
      horario_retiro_entrega: input.horarioRetiroEntrega || null,
      especialidades: input.especialidades || [], estado: input.estado || 'activo'
    }
    const query = input.id
      ? supabase.from('laboratorios').update(row).eq('id', input.id).eq('clinica_id', clinicaId).select('*').maybeSingle()
      : supabase.from('laboratorios').insert({ ...row, clinica_id: clinicaId }).select('*').single()
    const { data, error } = await query
    if (error) throw new LaboratorioCloudError('No se pudo guardar el laboratorio', 'LAB_SAVE_FAILED', { cause: error })
    if (!data) throw new LaboratorioCloudError('El laboratorio no existe o el rol no permite editarlo', 'WRITE_REJECTED')
    return data as Record<string, unknown>
  },

  async guardarTipoTrabajo(input: LaboratorioTipoTrabajoInput): Promise<Record<string, unknown>> {
    const { clinicaId } = await requireContext()
    if (!supabase) throw new LaboratorioCloudError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const row = {
      categoria: input.categoria, nombre: input.nombre.trim(), descripcion: input.descripcion || null,
      dias_estimados: input.diasEstimados ?? null, estado: input.estado || 'activo'
    }
    const query = input.id
      ? supabase.from('laboratorio_tipos_trabajo').update(row).eq('id', input.id).eq('clinica_id', clinicaId).select('*').maybeSingle()
      : supabase.from('laboratorio_tipos_trabajo').insert({ ...row, clinica_id: clinicaId }).select('*').single()
    const { data, error } = await query
    if (error) throw new LaboratorioCloudError('No se pudo guardar el tipo de trabajo', 'TYPE_SAVE_FAILED', { cause: error })
    if (!data) throw new LaboratorioCloudError('El tipo de trabajo no existe o el rol no permite editarlo', 'WRITE_REJECTED')
    return data as Record<string, unknown>
  },

  async crearOrden(input: NuevaOrdenLaboratorioInput): Promise<OrdenLaboratorioRow> {
    const { clinicaId } = await requireContext()
    if (![input.pacienteId, input.tipoTrabajoId, input.idempotencyKey].every(value => UUID_PATTERN.test(value))) {
      throw new LaboratorioCloudError('Las referencias de la orden deben ser UUID válidos', 'INVALID_REFERENCE')
    }
    if (input.laboratorioId && !UUID_PATTERN.test(input.laboratorioId)) {
      throw new LaboratorioCloudError('El laboratorio seleccionado no es válido', 'INVALID_REFERENCE')
    }
    if (input.plantillaId && !UUID_PATTERN.test(input.plantillaId)) {
      throw new LaboratorioCloudError('La plantilla seleccionada no es válida', 'INVALID_REFERENCE')
    }
    if (!supabase) throw new LaboratorioCloudError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')

    const row = {
      clinica_id: clinicaId,
      paciente_id: input.pacienteId,
      laboratorio_id: input.laboratorioId || null,
      tipo_trabajo_id: input.tipoTrabajoId,
      plantilla_id: input.plantillaId || null,
      plantilla_snapshot: input.plantillaSnapshot || {},
      pieza_dentaria: input.piezaDentaria || null,
      color_guia: input.colorGuia || null,
      indicaciones_tecnicas: input.indicacionesTecnicas || null,
      observaciones: input.observaciones || null,
      responsable_user_id: input.responsableUserId || null,
      fecha_solicitud: input.fechaSolicitud,
      fecha_estimada_entrega: input.fechaEstimadaEntrega || null,
      solicitud_limitada: input.solicitudLimitada || false,
      idempotency_key: input.idempotencyKey
    }
    const { data, error } = await supabase.from('ordenes_laboratorio').insert(row).select('*').single()
    if (!error && data) return data as OrdenLaboratorioRow

    if (error?.code === '23505') {
      const { data: existing, error: readError } = await supabase
        .from('ordenes_laboratorio')
        .select('*')
        .eq('clinica_id', clinicaId)
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle()
      if (!readError && existing && matchesOrderInput(existing as Record<string, unknown>, input)) {
        return existing as OrdenLaboratorioRow
      }
      throw new LaboratorioCloudError('La clave de reintento ya pertenece a otra solicitud', 'IDEMPOTENCY_CONFLICT', { cause: error })
    }
    throw new LaboratorioCloudError('No se pudo guardar la orden', 'CREATE_FAILED', { cause: error })
  },

  async editarOrden(id: string, changes: Partial<{
    laboratorioId: string | null
    tipoTrabajoId: string
    plantillaId: string | null
    plantillaSnapshot: Record<string, unknown>
    piezaDentaria: string | null
    colorGuia: string | null
    indicacionesTecnicas: string | null
    observaciones: string | null
    responsableUserId: string | null
    fechaEstimadaEntrega: string | null
  }>, expectedUpdatedAt: string): Promise<OrdenLaboratorioRow> {
    const { clinicaId } = await requireContext()
    if (!UUID_PATTERN.test(id) || !expectedUpdatedAt) throw new LaboratorioCloudError('La orden seleccionada no es válida', 'INVALID_REFERENCE')
    if (!supabase) throw new LaboratorioCloudError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const dbChanges: Record<string, unknown> = {}
    const mapping: Record<string, string> = {
      laboratorioId: 'laboratorio_id', tipoTrabajoId: 'tipo_trabajo_id',
      plantillaId: 'plantilla_id', plantillaSnapshot: 'plantilla_snapshot',
      piezaDentaria: 'pieza_dentaria', colorGuia: 'color_guia',
      indicacionesTecnicas: 'indicaciones_tecnicas', observaciones: 'observaciones',
      responsableUserId: 'responsable_user_id', fechaEstimadaEntrega: 'fecha_estimada_entrega'
    }
    for (const [key, column] of Object.entries(mapping)) {
      if (Object.prototype.hasOwnProperty.call(changes, key)) dbChanges[column] = changes[key as keyof typeof changes]
    }
    const { data, error } = await supabase.from('ordenes_laboratorio')
      .update(dbChanges).eq('id', id).eq('clinica_id', clinicaId)
      .eq('updated_at', expectedUpdatedAt).select('*').maybeSingle()
    if (error) throw new LaboratorioCloudError('No se pudo actualizar la orden', 'UPDATE_FAILED', { cause: error })
    if (!data) throw new LaboratorioCloudError('La orden cambió, no existe o el rol no permite editarla. Recarga antes de intentar de nuevo.', 'STALE_OR_REJECTED')
    return data as OrdenLaboratorioRow
  },

  async transicionarEtapa(input: {
    ordenId: string
    etapa: EtapaLaboratorioId
    notas?: string | null
    idempotencyKey: string
    versionEsperada: number
  }): Promise<OrdenLaboratorioRow> {
    await requireContext()
    if (!UUID_PATTERN.test(input.ordenId) || !UUID_PATTERN.test(input.idempotencyKey) || input.versionEsperada < 1) {
      throw new LaboratorioCloudError('Los datos de transición no son válidos', 'INVALID_TRANSITION')
    }
    if (!supabase) throw new LaboratorioCloudError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { data, error } = await supabase.rpc('transicionar_orden_laboratorio', {
      p_orden_id: input.ordenId,
      p_etapa: input.etapa,
      p_notas: input.notas || null,
      p_idempotency_key: input.idempotencyKey,
      p_version_esperada: input.versionEsperada
    })
    if (error) {
      if (error.code === '40001' || error.message?.includes('BP12_STALE_VERSION')) {
        throw new LaboratorioCloudError('La orden cambió en otra sesión. Recarga antes de aplicar esta etapa.', 'STALE_VERSION', { cause: error })
      }
      throw new LaboratorioCloudError('No se pudo cambiar la etapa', 'TRANSITION_FAILED', { cause: error })
    }
    if (!data || typeof data !== 'object') throw new LaboratorioCloudError('El servidor no devolvió la orden actualizada', 'EMPTY_RESPONSE')
    return data as OrdenLaboratorioRow
  },

  generarIdempotencyKey(): string {
    if (!globalThis.crypto?.randomUUID) throw new LaboratorioCloudError('El navegador no permite generar claves seguras', 'CRYPTO_UNAVAILABLE')
    return globalThis.crypto.randomUUID()
  }
}

export type CategoriaTrabajoCloud = CategoriaLaboratorio
