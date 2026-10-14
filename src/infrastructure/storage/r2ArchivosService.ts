/**
 * Servicio de archivos clínicos en Cloudflare R2 (F7-22 Fase 8).
 *
 * Tarea MASTER_ROADMAP: F7-22 — Cloudflare R2 External Clinical Storage.
 *
 * Arquitectura:
 * - Edge Functions generan URLs firmadas (AWS v4)
 * - Frontend sube/descarga directamente a R2 con URLs firmadas
 * - Metadata en Supabase (tabla archivos_clinicos)
 * - Auditoría completa en audit_log (FILE_UPLOAD, FILE_DOWNLOAD, FILE_DELETE)
 *
 * Categorías soportadas:
 * - radiografia: panorámica, periapical, bitewing, CBCT
 * - foto_clinica: extraoral, intraoral, perfil, sonrisa
 * - pdf: consentimientos, recetas escaneadas, documentos
 * - documento: otros formatos (docx, xlsx, etc.)
 * - otro: categoría genérica
 *
 * Seguridad:
 * - JWT de Supabase obligatorio en cada request
 * - Validación de clínica + RBAC en Edge Functions
 * - URLs firmadas con expiración corta (5-15 min)
 * - Tokens R2 nunca expuestos al cliente
 */

import { supabase } from '../supabase/supabaseClient'
import { createLogger } from '../logging/logger'

const log = createLogger('r2ArchivosService')

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || ''

export interface SolicitaUrlUploadParams {
  pacienteId: string
  categoria: string
  nombreArchivo: string
  mimeType: string
  tamanoBytes: number
}

export interface R2UploadUrlResponse {
  archivo_id: string
  r2_object_key: string
  upload_url: string
  upload_headers: Record<string, string>
  expires_in: number
  [key: string]: unknown
}

export interface SubeArchivoAR2Params {
  uploadUrl: string
  uploadHeaders: Record<string, string>
  file: File | Blob
  onProgress?: (percent: number) => void
}

export interface R2DownloadUrlResponse {
  archivo_id: string
  download_url: string
  download_headers: Record<string, string>
  expires_in: number
  [key: string]: unknown
}

export interface DescargaArchivoDeR2Params {
  downloadUrl: string
  downloadHeaders: Record<string, string>
  nombreArchivo: string
}

export interface AbrirArchivoDeR2Params {
  downloadUrl: string
  downloadHeaders: Record<string, string>
  mimeType?: string
}

export interface ArchivoClinicoRow {
  id: string
  paciente_id: string
  clinica_id?: string | null
  categoria: string
  nombre_archivo: string
  mime_type?: string | null
  tamano_bytes?: number | null
  r2_object_key?: string | null
  estado?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
  eliminado_por?: string | null
  [key: string]: unknown
}

export interface VaciarPapeleraArchivosResult {
  purgados: string[]
  rechazados: Array<{ id: string; razon?: string; [key: string]: unknown }>
  error?: string
}

/**
 * Solicita URL firmada para subir archivo a R2.
 */
export const solicitaUrlUpload = async ({
  pacienteId,
  categoria,
  nombreArchivo,
  mimeType,
  tamanoBytes
}: SolicitaUrlUploadParams): Promise<R2UploadUrlResponse | null> => {
  try {
    if (!supabase) {
      log.error('Supabase no disponible')
      return null
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      log.error('No hay sesión activa')
      return null
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/r2-upload-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paciente_id: pacienteId,
        categoria,
        nombre_archivo: nombreArchivo,
        mime_type: mimeType,
        tamano_bytes: tamanoBytes,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      log.error(`Error solicitando URL de upload: ${response.status}`, errorBody)
      return null
    }

    return (await response.json()) as R2UploadUrlResponse
  } catch (error: unknown) {
    log.error('Excepción solicitando URL de upload:', error)
    return null
  }
}

/**
 * Sube archivo directamente a R2 usando URL firmada.
 */
export const subeArchivoAR2 = async ({
  uploadUrl,
  uploadHeaders,
  file,
  onProgress
}: SubeArchivoAR2Params): Promise<boolean> => {
  try {
    // Usar XMLHttpRequest para obtener progreso
    return new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = Math.round((event.loaded / event.total) * 100)
          onProgress(percentComplete)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true)
        } else {
          log.error(`Error subiendo a R2: ${xhr.status}`, xhr.responseText)
          resolve(false)
        }
      })

      xhr.addEventListener('error', () => {
        log.error('Error de red subiendo a R2')
        resolve(false)
      })

      xhr.open('PUT', uploadUrl)

      // Agregar headers requeridos
      Object.entries(uploadHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value)
      })

      xhr.send(file)
    })
  } catch (error: unknown) {
    log.error('Excepción subiendo archivo a R2:', error)
    return false
  }
}

/**
 * Solicita URL firmada para descargar archivo desde R2.
 */
export const solicitaUrlDownload = async (archivoId: string): Promise<R2DownloadUrlResponse | null> => {
  try {
    if (!supabase) {
      log.error('Supabase no disponible')
      return null
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      log.error('No hay sesión activa')
      return null
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/r2-download-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        archivo_id: archivoId,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      log.error(`Error solicitando URL de download: ${response.status}`, errorBody)
      return null
    }

    return (await response.json()) as R2DownloadUrlResponse
  } catch (error: unknown) {
    log.error('Excepción solicitando URL de download:', error)
    return null
  }
}

/**
 * Descarga archivo desde R2 usando URL firmada.
 */
export const descargaArchivoDeR2 = async ({
  downloadUrl,
  downloadHeaders,
  nombreArchivo
}: DescargaArchivoDeR2Params): Promise<boolean> => {
  try {
    const response = await fetch(downloadUrl, {
      headers: downloadHeaders,
    })

    if (!response.ok) {
      log.error(`Error descargando de R2: ${response.status}`)
      return false
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    return true
  } catch (error: unknown) {
    log.error('Excepción descargando archivo de R2:', error)
    return false
  }
}

/**
 * Abre archivo desde R2 en nueva pestaña usando URL firmada con headers.
 *
 * Importante: las URLs generadas por las Edge Functions usan firma AWS v4
 * en headers, no query params. Por eso NO se puede hacer window.open(downloadUrl)
 * directamente; primero se hace fetch con headers, luego se crea un blob URL.
 */
export const abrirArchivoDeR2 = async ({
  downloadUrl,
  downloadHeaders,
  mimeType
}: AbrirArchivoDeR2Params): Promise<boolean> => {
  try {
    const response = await fetch(downloadUrl, {
      headers: downloadHeaders,
    })

    if (!response.ok) {
      log.error(`Error abriendo archivo de R2: ${response.status}`)
      return false
    }

    const blob = await response.blob()
    const blobConTipo = new Blob([blob], { type: mimeType || blob.type || 'application/octet-stream' })
    const url = window.URL.createObjectURL(blobConTipo)

    const ventana = window.open(url, '_blank', 'noopener,noreferrer')
    if (!ventana) {
      log.warn('El navegador bloqueó la apertura de nueva pestaña')
      window.URL.revokeObjectURL(url)
      return false
    }

    // Revocar después de un tiempo prudente para permitir que el navegador cargue el blob
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
    }, 60_000)

    return true
  } catch (error: unknown) {
    log.error('Excepción abriendo archivo de R2:', error)
    return false
  }
}

/**
 * Elimina archivo de R2 + soft delete en metadata.
 */
export const eliminaArchivo = async (archivoId: string): Promise<boolean | null> => {
  try {
    if (!supabase) {
      log.error('Supabase no disponible')
      return false
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      log.error('No hay sesión activa')
      return null
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/r2-delete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        archivo_id: archivoId,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      log.error(`Error eliminando archivo: ${response.status}`, errorBody)
      return false
    }

    const result = (await response.json()) as { success?: boolean }
    return result.success === true
  } catch (error: unknown) {
    log.error('Excepción eliminando archivo:', error)
    return false
  }
}

/**
 * Lista archivos clínicos de un paciente desde Supabase.
 */
export const listaArchivosDePaciente = async (
  pacienteId: string,
  categoria: string | null = null
): Promise<ArchivoClinicoRow[]> => {
  try {
    if (!supabase) {
      log.error('Supabase no disponible')
      return []
    }
    let query = supabase
      .from('archivos_clinicos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('estado', 'activo')
      .order('created_at', { ascending: false })

    if (categoria) {
      query = query.eq('categoria', categoria)
    }

    const { data, error } = await query

    if (error) {
      log.error('Error listando archivos:', error.message)
      return []
    }

    return (data || []) as ArchivoClinicoRow[]
  } catch (error: unknown) {
    log.error('Excepción listando archivos:', error)
    return []
  }
}

// ============================================================
// F7-31: MÉTODOS PARA PAPELERA DE ARCHIVOS
// ============================================================

/**
 * Lista archivos eliminados (papelera) de un paciente o de toda la clínica.
 *
 * F7-31 Fase 4: papelera de archivos clínicos.
 */
export const listaArchivosEliminados = async (pacienteId: string | null = null): Promise<ArchivoClinicoRow[]> => {
  try {
    if (!supabase) {
      log.error('No hay sesión activa para listar papelera')
      return []
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      log.error('No hay sesión activa para listar papelera')
      return []
    }

    const body = pacienteId ? { paciente_id: pacienteId } : {}

    const response = await fetch(`${SUPABASE_URL}/functions/v1/r2-list-deleted`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>
      log.error('Error listando papelera:', errorData)
      return []
    }

    const data = (await response.json()) as { archivos?: ArchivoClinicoRow[] }
    return data.archivos || []
  } catch (e: unknown) {
    log.error('Excepción listando papelera:', e)
    return []
  }
}

/**
 * Restaura archivo eliminado (papelera → activo).
 *
 * F7-31 Fase 4: papelera de archivos clínicos.
 */
export const restaurarArchivo = async (archivoId: string): Promise<boolean> => {
  try {
    if (!supabase) {
      log.error('No hay sesión activa para restaurar archivo')
      return false
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      log.error('No hay sesión activa para restaurar archivo')
      return false
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/r2-restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ archivo_id: archivoId }),
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>
      log.error('Error restaurando archivo:', errorData)
      return false
    }

    const data = (await response.json()) as { success?: boolean }
    log.info(`Archivo restaurado: ${archivoId}`)
    return data.success === true
  } catch (e: unknown) {
    log.error('Excepción restaurando archivo:', e)
    return false
  }
}

/**
 * Purga archivos de la papelera de forma permanente (Feature 1).
 *
 * Llama a Edge Function archivos-purge que:
 * - Valida rol admin + multi-tenant
 * - Elimina blobs R2 + DELETE de fila archivos_clinicos
 * - Registra ADMIN_PURGE_ARCHIVOS en audit_log
 * - Sin restricción de tiempo (libera espacio R2)
 */
export const vaciarPapeleraArchivos = async (archivoIds: string[]): Promise<VaciarPapeleraArchivosResult> => {
  if (!Array.isArray(archivoIds) || archivoIds.length === 0) {
    log.warn('vaciarPapeleraArchivos: lista vacía')
    return { purgados: [], rechazados: [] }
  }

  try {
    if (!supabase) {
      log.error('No hay sesión activa para purgar archivos')
      return { purgados: [], rechazados: [], error: 'Supabase no disponible' }
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      log.error('No hay sesión activa para purgar archivos')
      return { purgados: [], rechazados: [], error: 'No hay sesión activa' }
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/archivos-purge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ archivo_ids: archivoIds }),
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string }
      log.error('Error en archivos-purge:', errorData)
      return { purgados: [], rechazados: [], error: errorData.error || 'Error desconocido' }
    }

    const data = (await response.json()) as {
      purgados?: string[]
      rechazados?: Array<{ id: string; razon?: string }>
    }
    log.info(`Purga completada: ${data.purgados?.length || 0} purgados, ${data.rechazados?.length || 0} rechazados`)
    return {
      purgados: data.purgados || [],
      rechazados: data.rechazados || [],
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    log.error('Excepción al purgar archivos:', e)
    return { purgados: [], rechazados: [], error: msg }
  }
}

/**
 * M4b: Actualiza el campo metadata de un archivo en archivos_clinicos.
 *
 * Frontend-only: hace UPDATE directo via Supabase client (Opción A aprobada).
 * No requiere Edge Function porque ya tenemos sesión activa y el usuario
 * tiene permisos de UPDATE (validados por RLS de archivos_clinicos).
 *
 * Uso principal: guardar metadata de consentimientos después del upload.
 * El Edge Function r2-upload-url inserta metadata vacía por defecto.
 */
export const actualizarMetadataArchivo = async (
  archivoId: string,
  metadata: Record<string, unknown>
): Promise<boolean> => {
  if (!archivoId || !metadata || typeof metadata !== 'object') {
    log.warn('actualizarMetadataArchivo: parámetros inválidos')
    return false
  }

  try {
    if (!supabase) {
      log.error('actualizarMetadataArchivo: no hay sesión activa')
      return false
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      log.error('actualizarMetadataArchivo: no hay sesión activa')
      return false
    }

    // UPDATE directo via Supabase client (RLS valida permisos server-side)
    const { error } = await supabase
      .from('archivos_clinicos')
      .update({ metadata })
      .eq('id', archivoId)

    if (error) {
      log.error('actualizarMetadataArchivo: error en UPDATE', error.message)
      return false
    }

    log.info(`Metadata actualizada para archivo ${archivoId}`)
    return true
  } catch (e: unknown) {
    log.error('Excepción al actualizar metadata:', e)
    return false
  }
}

/**
 * Solicita URL firmada para subir foto de perfil a R2 bucket "profile-avatars".
 * 
 * Reutiliza la misma arquitectura que solicitaUrlUpload pero:
 * - No requiere pacienteId (usa user_id del JWT)
 * - Endpoint: /functions/v1/r2-profile-upload-url
 * - Bucket: profile-avatars
 * - Path: {user_id}/{timestamp}.{ext}
 */
export interface SolicitaUrlUploadPerfilParams {
  nombreArchivo: string
  mimeType: string
  tamanoBytes: number
}

export interface R2UploadPerfilResponse {
  upload_url: string
  r2_object_key: string
  expires_in: number
  upload_headers: Record<string, string>
  public_url: string
}

export const solicitaUrlUploadPerfil = async ({
  nombreArchivo,
  mimeType,
  tamanoBytes,
}: SolicitaUrlUploadPerfilParams): Promise<R2UploadPerfilResponse | null> => {
  try {
    if (!supabase) {
      log.error('Supabase no disponible')
      return null
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      log.error('No hay sesión activa')
      return null
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/r2-profile-upload-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nombre_archivo: nombreArchivo,
        mime_type: mimeType,
        tamano_bytes: tamanoBytes,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      log.error(`Error solicitando URL de upload perfil: ${response.status}`, errorBody)
      return null
    }

    return (await response.json()) as R2UploadPerfilResponse
  } catch (error: unknown) {
    log.error('Excepción solicitando URL de upload perfil:', error)
    return null
  }
}

