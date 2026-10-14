/**
 * profileService — Gestión de perfil de usuario con Supabase y Cloudflare R2 (Blueprint 03 §06)
 * 
 * Sincroniza datos de perfil entre:
 * - Supabase Auth user_metadata (campos básicos)
 * - Tabla profiles (campos extendidos)
 * - Cloudflare R2 bucket profile-avatars (fotos con URLs firmadas AWS v4)
 */
import { supabase, USE_SUPABASE } from '../supabase/supabaseClient'
import { createLogger } from '../logging/logger'
import { solicitaUrlUploadPerfil, subeArchivoAR2 } from '../storage/r2ArchivosService'

const log = createLogger('profileService')

export interface ProfileUpdateParams {
  fullName?: string
  especialidad?: string
  telefono?: string
  rut?: string
  fotoUrl?: string
  biografia?: string
  redesSociales?: Record<string, string>
}

export interface UserProfile {
  id: string
  email: string
  fullName: string | null
  especialidad: string | null
  telefono: string | null
  rut: string | null
  fotoUrl: string | null
  biografia: string | null
  redesSociales: Record<string, string>
}

export const profileService = {
  /**
   * Obtener perfil completo desde Supabase
   */
  async obtenerPerfil(): Promise<UserProfile | null> {
    if (!USE_SUPABASE || !supabase) return null

    try {
      const { data, error } = await supabase.rpc('obtener_perfil')
      if (error) throw error

      if (!data) return null

      return {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        especialidad: data.especialidad,
        telefono: data.telefono,
        rut: data.rut,
        fotoUrl: data.foto_url,
        biografia: data.biografia,
        redesSociales: data.redes_sociales || {},
      }
    } catch (error) {
      log.error('Error obteniendo perfil:', error)
      return null
    }
  },

  /**
   * Actualizar perfil en Supabase (user_metadata + tabla profiles)
   */
  async actualizarPerfil(params: ProfileUpdateParams): Promise<UserProfile | null> {
    if (!USE_SUPABASE || !supabase) return null

    try {
      const { data, error } = await supabase.rpc('actualizar_perfil', {
        p_full_name: params.fullName || null,
        p_especialidad: params.especialidad || null,
        p_telefono: params.telefono || null,
        p_rut: params.rut || null,
        p_foto_url: params.fotoUrl || null,
        p_biografia: params.biografia || null,
        p_redes_sociales: params.redesSociales || null,
      })

      if (error) throw error

      // Forzar refresh de la sesión para que incluya nuevos user_metadata
      try {
        await supabase.auth.refreshSession()
      } catch (refreshErr) {
        log.warn('No se pudo refrescar la sesión auth:', refreshErr)
      }

      return {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        especialidad: data.especialidad,
        telefono: data.telefono,
        rut: data.rut,
        fotoUrl: data.foto_url,
        biografia: data.biografia,
        redesSociales: data.redes_sociales || {},
      }
    } catch (error) {
      log.error('Error actualizando perfil:', error)
      return null
    }
  },

  /**
   * Subir foto de perfil a Cloudflare R2 (misma arquitectura que archivos clínicos)
   * 
   * Flujo:
   * 1. Solicita URL firmada vía Edge Function r2-profile-upload-url
   * 2. Sube archivo directo a R2 vía XHR
   * 3. Retorna URL pública de la foto
   */
  async subirFoto(file: File): Promise<string | null> {
    try {
      // 1. Solicitar URL firmada
      const uploadData = await solicitaUrlUploadPerfil({
        nombreArchivo: file.name,
        mimeType: file.type,
        tamanoBytes: file.size,
      })

      if (!uploadData) {
        throw new Error('No se pudo obtener URL de upload')
      }

      // 2. Subir archivo directo a R2 (reutiliza método existente)
      const uploadOk = await subeArchivoAR2({
        uploadUrl: uploadData.upload_url,
        uploadHeaders: uploadData.upload_headers,
        file,
      })

      if (!uploadOk) {
        throw new Error('Error subiendo archivo a R2')
      }

      // 3. Retornar URL pública de la foto
      log.info(`Foto de perfil subida a R2: ${uploadData.r2_object_key}`)
      return uploadData.public_url
    } catch (error) {
      log.error('Error subiendo foto de perfil a R2:', error)
      return null
    }
  },

  /**
   * Eliminar foto de perfil de R2 + actualizar profiles.foto_url
   */
  async eliminarFoto(_fotoUrl?: string): Promise<boolean> {
    try {
      if (!USE_SUPABASE || !supabase) return false

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const { error } = await supabase
        .from('profiles')
        .update({ foto_url: null })
        .eq('id', user.id)

      if (error) throw error
      return true
    } catch (error) {
      log.error('Error eliminando foto de perfil:', error)
      return false
    }
  },
}
