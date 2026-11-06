import {
  abrirArchivoDeR2,
  descargaArchivoDeR2,
  solicitaUrlDownload,
  solicitaUrlUpload,
  subeArchivoAR2,
  type ArchivoClinicoRow,
} from '../../../../infrastructure/storage/r2ArchivosService'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'

export const TIPOS_DOCUMENTO_LABORATORIO = [
  'orden_trabajo',
  'receta_protesica',
  'diseno_cad',
  'foto_diseno',
  'radiografia_control',
  'certificado_materiales',
  'garantia_trabajo',
  'evidencia_garantia',
  'otro',
] as const

export type TipoDocumentoLaboratorio = typeof TIPOS_DOCUMENTO_LABORATORIO[number]

export const ETIQUETAS_DOCUMENTO_LABORATORIO: Record<TipoDocumentoLaboratorio, string> = {
  orden_trabajo: 'Orden de trabajo',
  receta_protesica: 'Receta protésica',
  diseno_cad: 'Diseño CAD (STL)',
  foto_diseno: 'Foto del diseño',
  radiografia_control: 'Radiografía de control',
  certificado_materiales: 'Certificado de materiales',
  garantia_trabajo: 'Garantía del trabajo',
  evidencia_garantia: 'Evidencia de garantía',
  otro: 'Otro documento',
}

export type ArchivoLaboratorio = ArchivoClinicoRow & {
  orden_laboratorio_id: string
  metadata: { tipo_documento?: TipoDocumentoLaboratorio } | null
}

export interface GarantiaLaboratorio {
  id: string
  clinica_id: string
  orden_original_id: string
  orden_reposicion_id: string | null
  archivo_evidencia_id: string
  tipo_responsabilidad: 'laboratorio' | 'clinica' | 'compartida' | 'sin_garantia' | null
  estado: 'reclamo' | 'aprobada' | 'rechazada' | 'repuesto'
  motivo: string
  resolucion_motivo: string | null
  porcentaje_costo_clinica: number | null
  created_by: string
  revisado_por: string | null
  created_at: string
  orden_original_folio?: string
  orden_reposicion_folio?: string | null
}

export interface HistorialGarantiaLaboratorio {
  id: string
  garantia_id: string
  evento: string
  estado_anterior: string | null
  estado: string
  actor_id: string
  registrado_en: string
}

export class LaboratorioTraceabilityError extends Error {
  constructor(message: string, readonly code: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LaboratorioTraceabilityError'
  }
}

const requireSupabase = () => {
  if (!USE_SUPABASE || !supabase) {
    throw new LaboratorioTraceabilityError('Los documentos requieren conexión con la clínica.', 'SUPABASE_UNAVAILABLE')
  }
  return supabase
}

const metadataTipo = (metadata: Record<string, unknown> | null | undefined): TipoDocumentoLaboratorio | null => {
  const value = metadata?.tipo_documento
  return typeof value === 'string' && TIPOS_DOCUMENTO_LABORATORIO.includes(value as TipoDocumentoLaboratorio)
    ? value as TipoDocumentoLaboratorio
    : null
}

export const laboratorioTraceabilityService = {
  async listarDocumentos(ordenId: string): Promise<ArchivoLaboratorio[]> {
    if (!ordenId) return []
    const client = requireSupabase()
    const { data, error } = await client
      .from('archivos_clinicos')
      .select('id, clinica_id, paciente_id, orden_laboratorio_id, categoria, nombre_archivo, mime_type, tamano_bytes, estado, metadata, created_at, deleted_at')
      .eq('orden_laboratorio_id', ordenId)
      .eq('categoria', 'laboratorio')
      .eq('estado', 'activo')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) throw new LaboratorioTraceabilityError('No se pudieron cargar los documentos de la orden.', 'DOCUMENTS_LOAD_FAILED', { cause: error })
    return (data || []).map(row => ({
      ...row,
      metadata: row.metadata && typeof row.metadata === 'object'
        ? { ...row.metadata, tipo_documento: metadataTipo(row.metadata as Record<string, unknown>) || undefined }
        : null,
    })) as ArchivoLaboratorio[]
  },

  async subirDocumento(input: {
    ordenId: string
    pacienteId: string
    file: File
    tipoDocumento: TipoDocumentoLaboratorio
  }): Promise<string> {
    const client = requireSupabase()
    if (!input.ordenId || !input.pacienteId || !input.file || !TIPOS_DOCUMENTO_LABORATORIO.includes(input.tipoDocumento)) {
      throw new LaboratorioTraceabilityError('Selecciona una orden, un paciente y un tipo de documento válido.', 'INVALID_DOCUMENT')
    }
    const { data: session, error: sessionError } = await client.auth.getSession()
    if (sessionError || !session.session?.user?.id || !getClinicaActivaSync()) {
      throw new LaboratorioTraceabilityError('Inicia sesión y selecciona una clínica antes de subir el archivo.', 'AUTH_REQUIRED')
    }

    const upload = await solicitaUrlUpload({
      pacienteId: input.pacienteId,
      categoria: 'laboratorio',
      nombreArchivo: input.file.name,
      mimeType: input.file.type || 'application/octet-stream',
      tamanoBytes: input.file.size,
      ordenLaboratorioId: input.ordenId,
      tipoDocumento: input.tipoDocumento,
    })
    if (!upload?.archivo_id || !upload.upload_url) {
      throw new LaboratorioTraceabilityError('No se pudo preparar la subida del documento.', 'UPLOAD_URL_FAILED')
    }

    const uploaded = await subeArchivoAR2({
      uploadUrl: upload.upload_url,
      uploadHeaders: upload.upload_headers,
      file: input.file,
    })
    if (!uploaded) {
      // The R2 endpoint creates metadata before issuing the signed URL; keep a
      // review marker if the blob upload fails instead of exposing it as ready.
      await client.from('archivos_clinicos')
        .update({ estado: 'pendiente_revision' })
        .eq('id', upload.archivo_id)
        .eq('orden_laboratorio_id', input.ordenId)
      throw new LaboratorioTraceabilityError('La carga falló; el archivo quedó pendiente de revisión.', 'UPLOAD_FAILED')
    }
    return upload.archivo_id
  },

  async abrirDocumento(archivo: ArchivoLaboratorio): Promise<void> {
    const signed = await solicitaUrlDownload(archivo.id)
    if (!signed || !(await abrirArchivoDeR2({
      downloadUrl: signed.download_url,
      downloadHeaders: signed.download_headers,
      mimeType: archivo.mime_type || undefined,
    }))) {
      throw new LaboratorioTraceabilityError('No se pudo abrir el documento.', 'DOWNLOAD_FAILED')
    }
  },

  async descargarDocumento(archivo: ArchivoLaboratorio): Promise<void> {
    const signed = await solicitaUrlDownload(archivo.id)
    if (!signed || !(await descargaArchivoDeR2({
      downloadUrl: signed.download_url,
      downloadHeaders: signed.download_headers,
      nombreArchivo: archivo.nombre_archivo,
    }))) {
      throw new LaboratorioTraceabilityError('No se pudo descargar el documento.', 'DOWNLOAD_FAILED')
    }
  },

  async listarGarantiasOrden(ordenId: string): Promise<GarantiaLaboratorio[]> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('garantias_laboratorio')
      .select('id, clinica_id, orden_original_id, orden_reposicion_id, archivo_evidencia_id, tipo_responsabilidad, estado, motivo, resolucion_motivo, porcentaje_costo_clinica, created_by, revisado_por, created_at')
      .or(`orden_original_id.eq.${ordenId},orden_reposicion_id.eq.${ordenId}`)
      .order('created_at', { ascending: false })
    if (error) throw new LaboratorioTraceabilityError('No se pudieron cargar las garantías de la orden.', 'WARRANTIES_LOAD_FAILED', { cause: error })
    const guarantees = (data || []) as GarantiaLaboratorio[]
    const orderIds = [...new Set(guarantees.flatMap(item => [item.orden_original_id, item.orden_reposicion_id].filter(Boolean) as string[]))]
    if (orderIds.length === 0) return guarantees
    const { data: orders, error: orderError } = await client
      .from('ordenes_laboratorio')
      .select('id, folio')
      .in('id', orderIds)
    if (orderError) throw new LaboratorioTraceabilityError('No se pudo cargar el folio de una garantía.', 'WARRANTY_ORDER_LOAD_FAILED', { cause: orderError })
    const folios = new Map((orders || []).map(order => [order.id as string, order.folio as string]))
    return guarantees.map(item => ({
      ...item,
      orden_original_folio: folios.get(item.orden_original_id) || '',
      orden_reposicion_folio: item.orden_reposicion_id ? folios.get(item.orden_reposicion_id) || null : null,
    }))
  },

  async listarHistorialGarantia(garantiaId: string): Promise<HistorialGarantiaLaboratorio[]> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('garantias_laboratorio_historial')
      .select('id, garantia_id, evento, estado_anterior, estado, actor_id, registrado_en')
      .eq('garantia_id', garantiaId)
      .order('registrado_en', { ascending: true })
    if (error) throw new LaboratorioTraceabilityError('No se pudo cargar el historial de garantía.', 'WARRANTY_HISTORY_FAILED', { cause: error })
    return (data || []) as HistorialGarantiaLaboratorio[]
  },

  async crearReclamo(input: {
    ordenOriginalId: string
    motivo: string
    archivoEvidenciaId: string
    idempotencyKey?: string
  }): Promise<{ id: string; estado: string }> {
    const client = requireSupabase()
    const { data, error } = await client.rpc('crear_reclamo_garantia_laboratorio', {
      p_orden_original_id: input.ordenOriginalId,
      p_motivo: input.motivo,
      p_archivo_evidencia_id: input.archivoEvidenciaId,
      p_idempotency_key: input.idempotencyKey || crypto.randomUUID(),
    })
    if (error || !data?.id) {
      throw new LaboratorioTraceabilityError('No se pudo registrar el reclamo de garantía.', 'WARRANTY_CREATE_FAILED', { cause: error })
    }
    return data as { id: string; estado: string }
  },

  async resolverGarantia(input: {
    garantiaId: string
    decision: 'aprobar' | 'rechazar'
    tipoResponsabilidad?: 'laboratorio' | 'clinica' | 'compartida' | 'sin_garantia' | null
    porcentajeCostoClinica?: number | null
    motivoRechazo?: string | null
  }): Promise<{ id: string; estado: string; orden_reposicion_id?: string; folio?: string }> {
    const client = requireSupabase()
    const { data, error } = await client.rpc('resolver_garantia_laboratorio', {
      p_garantia_id: input.garantiaId,
      p_decision: input.decision,
      p_tipo_responsabilidad: input.tipoResponsabilidad || null,
      p_porcentaje_costo_clinica: input.porcentajeCostoClinica ?? null,
      p_motivo_rechazo: input.motivoRechazo || null,
    })
    if (error || !data?.id) {
      throw new LaboratorioTraceabilityError('No se pudo resolver la garantía.', 'WARRANTY_RESOLVE_FAILED', { cause: error })
    }
    return data as { id: string; estado: string; orden_reposicion_id?: string; folio?: string }
  },
}
