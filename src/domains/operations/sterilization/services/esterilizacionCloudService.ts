import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'

export type EstadoCicloEsterilizacion =
  | 'preparacion'
  | 'en_curso'
  | 'liberado'
  | 'rechazado'
  | 'retenido_biologico'
  | 'cancelado'
  | 'revisar_migracion'

export interface ProgramaEsterilizacionCloud {
  id: string
  codigo: string
  nombre: string
  categoria: 'esterilizacion' | 'secado' | 'prueba_diaria'
  temperatura_objetivo: number | null
  duracion_minutos: number
  presion_objetivo: number | null
  activo: boolean
  referencia_fabricante: string | null
  validado_at: string | null
}

export interface EquipoEsterilizacionCloud {
  id: string
  nombre: string
  codigo: string
  categoria: string
  numero_serie: string | null
  proxima_mantencion: string | null
  estado_instrumental?: string | null
  requiere_esterilizacion?: boolean
  tipo_item: string
}

export interface CicloEsterilizacionCloud {
  id: string
  clinica_id: string
  lote: string
  equipo_id: string
  programa_id: string
  programa_codigo: string
  programa_nombre: string
  objetivo_snapshot: Record<string, unknown>
  estado: EstadoCicloEsterilizacion
  operador_id: string
  etiqueta_operador: string
  temperatura_observada: number | null
  presion_observada: number | null
  duracion_observada_minutos: number | null
  indicador_tipo4: 'aprobado' | 'rechazado' | null
  motivo_override_bowie: string | null
  motivo_cancelacion: string | null
  iniciado_at: string
  finalizado_at: string | null
  created_at: string
}

export interface InstrumentoCicloCloud {
  id: string
  clinica_id: string
  ciclo_id: string
  inventario_id: string
  estado: 'en_proceso' | 'disponible' | 'retenido' | 'usado'
  indicador_tipo1_aprobado: boolean | null
  lote_snapshot: string
  programa_snapshot: string
  liberado_at: string | null
}

export interface PasoEsterilizacionCloud {
  id: string
  ciclo_id: string
  numero: number
  estado: 'completado' | 'en_curso'
  detalle: Record<string, unknown>
  actor_user_id: string
  completado_por: string | null
  iniciado_at: string
  completado_at: string | null
}

export interface PruebaEsterilizacionCloud {
  id: string
  tipo: 'bowie_dick' | 'biologico'
  equipo_id: string
  ciclo_id: string | null
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  marca_indicador: string
  horas_incubacion: number | null
  observacion: string
  observado_at: string
  resultado_at: string | null
  creado_por: string
  leido_por: string | null
}

export interface InsumoEsterilizacionConfigCloud {
  id: string
  tipo_consumo: 'prelavado' | 'enjuague' | 'bolsa' | 'indicador_tipo1' | 'indicador_tipo4' | 'indicador_biologico' | 'indicador_bowie_dick'
  inventario_id: string
  ubicacion_id: string
  cantidad: number
  unidad: string
  por_instrumento: boolean
  activo: boolean
}

export interface ItemInventarioEsterilizacionCloud {
  id: string
  nombre: string
  codigo: string
  unidad_medida: string | null
  cantidad_actual: number
  cantidad_minima: number
  tipo_item: 'insumo_clinico' | 'instrumental' | 'equipamiento'
  categoria: string
  estado_instrumental: string | null
  requiere_esterilizacion: boolean
  numero_serie: string | null
  proxima_mantencion: string | null
}

export interface UbicacionEsterilizacionCloud {
  id: string
  nombre: string
  estado: string
}

export interface InstrumentalDisponibleCloud {
  ciclo_instrumento_id: string
  inventario_id: string
  nombre: string
  codigo: string
  numero_serie: string | null
  lote: string
  programa: string
  liberado_at: string
}

export interface UsoTratamientoEsterilizacionCloud {
  id: string
  ciclo_instrumento_id: string
  paciente_id: string
  tratamiento_ref: string
  profesional_id: string
  usado_at: string
}

export interface EsterilizacionCloudSnapshot {
  zonaHoraria: string
  programas: ProgramaEsterilizacionCloud[]
  equipos: EquipoEsterilizacionCloud[]
  inventario: ItemInventarioEsterilizacionCloud[]
  ubicaciones: UbicacionEsterilizacionCloud[]
  ciclos: CicloEsterilizacionCloud[]
  instrumentos: InstrumentoCicloCloud[]
  pasos: PasoEsterilizacionCloud[]
  pruebas: PruebaEsterilizacionCloud[]
  insumosConfig: InsumoEsterilizacionConfigCloud[]
}

export class EsterilizacionSyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EsterilizacionSyncError'
  }
}

const cliente = () => {
  if (!USE_SUPABASE || !supabase) {
    throw new EsterilizacionSyncError('La esterilización requiere conexión con DentikOS. No se guardaron cambios locales.')
  }
  return supabase
}

const lanzarError = (error: { message?: string } | null): void => {
  if (error) throw new EsterilizacionSyncError(error.message || 'No se pudo sincronizar el registro de esterilización.')
}

const rpc = async <T = Record<string, unknown>>(nombre: string, payload?: Record<string, unknown>): Promise<T> => {
  const db = cliente()
  const { data, error } = await db.rpc(nombre, payload ? { p_payload: payload } : {})
  lanzarError(error)
  return data as T
}

export const esterilizacionCloudService = {
  async usuarioActualId(): Promise<string> {
    const { data: { user }, error } = await cliente().auth.getUser()
    if (error || !user) throw new EsterilizacionSyncError('Inicia sesión para continuar con la trazabilidad clínica.')
    return user.id
  },

  async cargar(clinicaId: string, incluirConfiguracion: boolean): Promise<EsterilizacionCloudSnapshot> {
    const db = cliente()
    const [clinica, programas, equipos, inventario, ubicaciones, ciclos, instrumentos, pasos, pruebas, insumosConfig] = await Promise.all([
      db.from('clinicas').select('zona_horaria').eq('id', clinicaId).maybeSingle(),
      db.from('esterilizacion_programas').select('*').eq('clinica_id', clinicaId).order('codigo'),
      db.from('inventario').select('id,nombre,codigo,categoria,numero_serie,proxima_mantencion,tipo_item').eq('clinica_id', clinicaId).eq('tipo_item', 'equipamiento').eq('categoria', 'Esterilización').eq('estado_catalogo', 'activo').order('nombre'),
      db.from('inventario').select('id,nombre,codigo,categoria,unidad_medida,cantidad_actual,cantidad_minima,tipo_item,estado_instrumental,requiere_esterilizacion,numero_serie,proxima_mantencion').eq('clinica_id', clinicaId).eq('estado_catalogo', 'activo').in('tipo_item', ['insumo_clinico', 'instrumental', 'equipamiento']).order('nombre'),
      db.from('inventario_ubicaciones').select('id,nombre,estado').eq('clinica_id', clinicaId).eq('estado', 'activo').order('nombre'),
      db.from('esterilizacion_ciclos').select('*').eq('clinica_id', clinicaId).order('iniciado_at', { ascending: false }).limit(300),
      db.from('esterilizacion_ciclo_instrumentos').select('*').eq('clinica_id', clinicaId).order('created_at', { ascending: false }),
      db.from('esterilizacion_pasos').select('*').eq('clinica_id', clinicaId).order('ciclo_id').order('numero'),
      db.from('esterilizacion_pruebas').select('*').eq('clinica_id', clinicaId).order('observado_at', { ascending: false }).limit(500),
      incluirConfiguracion
        ? db.from('esterilizacion_insumos_config').select('*').eq('clinica_id', clinicaId).order('tipo_consumo')
        : Promise.resolve({ data: [], error: null })
    ])
    lanzarError(clinica.error)
    for (const result of [programas, equipos, inventario, ubicaciones, ciclos, instrumentos, pasos, pruebas, insumosConfig]) lanzarError(result.error)
    return {
      zonaHoraria: clinica.data?.zona_horaria || 'America/Santiago',
      programas: (programas.data || []) as ProgramaEsterilizacionCloud[],
      equipos: (equipos.data || []) as EquipoEsterilizacionCloud[],
      inventario: (inventario.data || []) as ItemInventarioEsterilizacionCloud[],
      ubicaciones: (ubicaciones.data || []) as UbicacionEsterilizacionCloud[],
      ciclos: (ciclos.data || []) as CicloEsterilizacionCloud[],
      instrumentos: (instrumentos.data || []) as InstrumentoCicloCloud[],
      pasos: (pasos.data || []) as PasoEsterilizacionCloud[],
      pruebas: (pruebas.data || []) as PruebaEsterilizacionCloud[],
      insumosConfig: (insumosConfig.data || []) as InsumoEsterilizacionConfigCloud[]
    }
  },

  iniciarCiclo: (payload: Record<string, unknown>) => rpc('bp10_crear_ciclo_esterilizacion', payload),
  iniciarPaso: (payload: Record<string, unknown>) => rpc('bp10_iniciar_paso_esterilizacion', payload),
  completarPaso: (payload: Record<string, unknown>) => rpc('bp10_completar_paso_esterilizacion', payload),
  iniciarAutoclave: (payload: Record<string, unknown>) => rpc('bp10_iniciar_autoclave_esterilizacion', payload),
  finalizarCiclo: (payload: Record<string, unknown>) => rpc('bp10_finalizar_ciclo_esterilizacion', payload),
  cancelarCiclo: (payload: Record<string, unknown>) => rpc('bp10_cancelar_ciclo_esterilizacion', payload),
  registrarBowieDick: (payload: Record<string, unknown>) => rpc('bp10_registrar_bowie_dick', payload),
  registrarPruebaBiologica: (payload: Record<string, unknown>) => rpc('bp10_registrar_prueba_biologica', payload),
  configurarPrograma: (payload: Record<string, unknown>) => rpc('bp10_configurar_programa_esterilizacion', payload),
  configurarInsumo: (payload: Record<string, unknown>) => rpc('bp10_configurar_insumo_esterilizacion', payload),

  async listarInstrumentalDisponible(): Promise<InstrumentalDisponibleCloud[]> {
    const db = cliente()
    const { data, error } = await db.rpc('bp10_listar_instrumental_disponible')
    lanzarError(error)
    return (data || []) as InstrumentalDisponibleCloud[]
  },

  async listarUsosTratamiento(
    pacienteId: string,
    tratamientoRef: string,
    clinicaId: string
  ): Promise<UsoTratamientoEsterilizacionCloud[]> {
    const { data, error } = await cliente()
      .from('esterilizacion_usos')
      .select('id,ciclo_instrumento_id,paciente_id,tratamiento_ref,profesional_id,usado_at')
      .eq('clinica_id', clinicaId)
      .eq('paciente_id', pacienteId)
      .eq('tratamiento_ref', tratamientoRef)
      .order('usado_at')
    lanzarError(error)
    return (data || []) as UsoTratamientoEsterilizacionCloud[]
  },

  vincularInstrumentalTratamiento: (payload: Record<string, unknown>) =>
    rpc('bp10_vincular_instrumental_tratamiento', payload)
}
