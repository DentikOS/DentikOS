import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface PrecioLaboratorioActual {
  id: string
  laboratorioId: string
  tipoTrabajoId: string
  costo: number
  diasEstimados: number | null
  condicionPago: string | null
  vigenteDesde: string
}

export interface MiembroPermisosLaboratorio {
  userId: string
  rol: string
  permisos: string[]
}

export interface PlantillaLaboratorioInput {
  id?: string | null
  nombre: string
  categoria: string
  descripcion: string
  diasEstimados: number | null
  etapas: string[]
  fotosRequeridas: string[]
  camposPersonalizados: Record<string, unknown>
  estado: 'activo' | 'inactivo'
}

export class LaboratorioCoreError extends Error {
  constructor(message: string, readonly code: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LaboratorioCoreError'
  }
}

const requireContext = async (): Promise<string> => {
  if (!USE_SUPABASE || !supabase) {
    throw new LaboratorioCoreError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
  }
  const clinicaLocal = getClinicaActivaSync()
  if (!clinicaLocal || !UUID_PATTERN.test(clinicaLocal)) {
    throw new LaboratorioCoreError('Se requiere una clínica activa', 'CLINIC_REQUIRED')
  }
  const { data: session, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session.session?.user?.id) {
    throw new LaboratorioCoreError('Se requiere una sesión autenticada', 'AUTH_REQUIRED')
  }
  const { data: clinicaServer, error: clinicError } = await supabase.rpc('clinica_actual')
  if (clinicError || clinicaServer !== clinicaLocal) {
    throw new LaboratorioCoreError('El servidor no confirmó la clínica activa', 'CLINIC_CONTEXT_MISMATCH')
  }
  return clinicaServer
}

export const laboratorioCoreService = {
  async listarPreciosActuales(): Promise<PrecioLaboratorioActual[]> {
    const clinicaId = await requireContext()
    if (!supabase) throw new LaboratorioCoreError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { data, error } = await supabase.from('laboratorio_precios')
      .select('id,laboratorio_id,tipo_trabajo_id,costo,dias_estimados,condicion_pago,vigente_desde')
      .eq('clinica_id', clinicaId).is('vigente_hasta', null)
      .order('vigente_desde', { ascending: false })
    if (error) throw new LaboratorioCoreError('No se pudo cargar el tarifario vigente', 'PRICE_LOAD_FAILED', { cause: error })
    return (data || []).map(row => ({
      id: String(row.id), laboratorioId: String(row.laboratorio_id),
      tipoTrabajoId: String(row.tipo_trabajo_id), costo: Number(row.costo),
      diasEstimados: typeof row.dias_estimados === 'number' ? row.dias_estimados : null,
      condicionPago: typeof row.condicion_pago === 'string' ? row.condicion_pago : null,
      vigenteDesde: String(row.vigente_desde || '')
    }))
  },

  async guardarPrecio(input: {
    laboratorioId: string
    tipoTrabajoId: string
    costo: number
    diasEstimados: number | null
    condicionPago: string
  }): Promise<void> {
    await requireContext()
    if (![input.laboratorioId, input.tipoTrabajoId].every(id => UUID_PATTERN.test(id))
      || !Number.isSafeInteger(input.costo) || input.costo < 0
      || (input.diasEstimados !== null && (!Number.isInteger(input.diasEstimados) || input.diasEstimados < 1 || input.diasEstimados > 365))
      || input.condicionPago.length > 500) {
      throw new LaboratorioCoreError('Los datos del precio no son válidos', 'INVALID_PRICE')
    }
    if (!supabase) throw new LaboratorioCoreError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { error } = await supabase.rpc('registrar_precio_laboratorio_bp12', {
      p_laboratorio_id: input.laboratorioId,
      p_tipo_trabajo_id: input.tipoTrabajoId,
      p_costo: input.costo,
      p_dias_estimados: input.diasEstimados,
      p_condicion_pago: input.condicionPago.trim() || null
    })
    if (error) throw new LaboratorioCoreError('No se pudo registrar el precio', 'PRICE_SAVE_FAILED', { cause: error })
  },

  async listarPermisos(): Promise<MiembroPermisosLaboratorio[]> {
    await requireContext()
    if (!supabase) throw new LaboratorioCoreError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { data, error } = await supabase.rpc('listar_permisos_laboratorio_bp12')
    if (error) throw new LaboratorioCoreError('No se pudieron cargar las asignaciones', 'PERMISSIONS_LOAD_FAILED', { cause: error })
    if (!Array.isArray(data)) throw new LaboratorioCoreError('El servidor no devolvió las asignaciones', 'EMPTY_RESPONSE')
    return data.map((raw: Record<string, unknown>) => ({
      userId: String(raw.user_id || ''),
      rol: String(raw.rol || ''),
      permisos: Array.isArray(raw.permisos) ? raw.permisos.map(String) : []
    })).filter(member => UUID_PATTERN.test(member.userId))
  },

  async reemplazarPermisos(userId: string, permisos: string[]): Promise<void> {
    await requireContext()
    if (!UUID_PATTERN.test(userId)) throw new LaboratorioCoreError('El usuario seleccionado no es válido', 'INVALID_USER')
    if (!supabase) throw new LaboratorioCoreError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { error } = await supabase.rpc('reemplazar_permisos_laboratorio_bp12', {
      p_user_id: userId,
      p_permisos: permisos
    })
    if (error) throw new LaboratorioCoreError('No se pudieron guardar los permisos', 'PERMISSIONS_SAVE_FAILED', { cause: error })
  },

  async asegurarPlantillas(): Promise<number> {
    await requireContext()
    if (!supabase) throw new LaboratorioCoreError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { data, error } = await supabase.rpc('asegurar_plantillas_laboratorio_bp12')
    if (error) throw new LaboratorioCoreError('No se pudieron inicializar las plantillas', 'TEMPLATES_SEED_FAILED', { cause: error })
    return Number(data || 0)
  },

  async guardarPlantilla(input: PlantillaLaboratorioInput): Promise<string> {
    await requireContext()
    if (!input.nombre.trim() || (input.id && !UUID_PATTERN.test(input.id))) {
      throw new LaboratorioCoreError('Los datos de la plantilla no son válidos', 'INVALID_TEMPLATE')
    }
    if (!supabase) throw new LaboratorioCoreError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { data, error } = await supabase.rpc('guardar_plantilla_laboratorio_bp12', {
      p_id: input.id || null,
      p_nombre: input.nombre.trim(),
      p_categoria: input.categoria,
      p_descripcion: input.descripcion.trim() || null,
      p_dias_estimados: input.diasEstimados,
      p_etapas: input.etapas,
      p_fotos_requeridas: input.fotosRequeridas,
      p_campos_personalizados: input.camposPersonalizados,
      p_estado: input.estado
    })
    if (error) throw new LaboratorioCoreError('No se pudo guardar la plantilla', 'TEMPLATE_SAVE_FAILED', { cause: error })
    if (typeof data !== 'string' || !UUID_PATTERN.test(data)) {
      throw new LaboratorioCoreError('El servidor no confirmó la nueva versión de plantilla', 'EMPTY_RESPONSE')
    }
    return data
  },

  async cargarResumen(): Promise<Record<string, unknown>> {
    await requireContext()
    if (!supabase) throw new LaboratorioCoreError('Supabase no está disponible', 'SUPABASE_UNAVAILABLE')
    const { data, error } = await supabase.rpc('resumen_laboratorio_core_bp12')
    if (error) throw new LaboratorioCoreError('No se pudo cargar el dashboard de laboratorio', 'DASHBOARD_LOAD_FAILED', { cause: error })
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new LaboratorioCoreError('El servidor no devolvió las métricas', 'EMPTY_RESPONSE')
    }
    return data as Record<string, unknown>
  }
}
