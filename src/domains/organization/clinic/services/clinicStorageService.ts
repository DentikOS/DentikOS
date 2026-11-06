/**
 * Servicio de Persistencia de Configuración de Clínica (Branding / Logo)
 *
 * Persiste en la tabla `clinicas` de Supabase cuando VITE_USE_SUPABASE=true
 * y en localStorage multi-tenant como caché optimista rápida.
 */
import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { notificationService } from '../../../../infrastructure/notification/notificationService'
import { createLogger } from '../../../../infrastructure/logging/logger'
import type { ConfiguracionMembrete } from '../schemas/configuracionMembreteSchema'
import {
  configuracionFinancieraSchema,
  crearConfiguracionFinancieraPredeterminada,
  leerConfiguracionFinanciera,
  type ConfiguracionFinanciera,
} from '../schemas/configuracionFinancieraSchema'
import {
  configuracionConveniosSchema,
  leerConfiguracionConvenios,
  type ConfiguracionConvenios,
} from '../schemas/configuracionConveniosSchema'
import { useSesionStore } from '../../../../app/stores/sesionStore'

const log = createLogger('clinicStorageService')

export const KEY_CLINICA = 'studio_dental_config_clinica'

export interface DatosClinicaConfig {
  nombreClinica?: string
  razonSocial?: string
  rutClinica?: string
  telefono?: string
  emailContacto?: string
  direccion?: string
  ciudad?: string
  comuna?: string
  region?: string
  giroComercial?: string
  sitioWeb?: string
  instagram?: string
  facebook?: string
  registroSeremi?: string
  registroIsp?: string
  idiomaDocumentos?: string
  moneda?: string
  eslogan?: string
  zonaHoraria?: string
  logoUrl?: string
  colorPrimario?: string
  colorSecundario?: string
  configuracionMembrete?: ConfiguracionMembrete
  configuracionFinanciera?: ConfiguracionFinanciera
  configuracionConvenios?: ConfiguracionConvenios
  [key: string]: unknown
}

export interface ClinicStorageServiceAPI {
  obtenerClinica: (defaults?: DatosClinicaConfig) => DatosClinicaConfig | undefined
  guardarClinica: (datos: DatosClinicaConfig) => void
  guardarClinicaCompleta: (clinicaId: string, datos: DatosClinicaConfig) => Promise<boolean>
  sincronizarClinicaDesdeSupabase: (clinicaId: string) => Promise<DatosClinicaConfig | null>
  cargarConfiguracionConvenios: (clinicaId: string) => Promise<ConfiguracionConvenios>
  guardarConfiguracionConvenios: (clinicaId: string, configuracion: ConfiguracionConvenios) => Promise<boolean>
  cargarConfiguracionFinanciera: (clinicaId: string) => Promise<ConfiguracionFinanciera>
  guardarConfiguracionFinanciera: (clinicaId: string, configuracion: ConfiguracionFinanciera) => Promise<boolean>
  migrarClinicaSiNecesario: (clinicaId: string) => Promise<boolean>
}

const clinicaRepo = createTenantRepository<DatosClinicaConfig | undefined>(KEY_CLINICA, undefined, { notify: true })

const CAMEL_TO_SNAKE_MAP: Record<string, string> = {
  nombreClinica: 'nombre',
  razonSocial: 'razon_social',
  rutClinica: 'rut_empresa',
  telefono: 'telefono',
  emailContacto: 'email_contacto',
  direccion: 'direccion',
  ciudad: 'ciudad',
  comuna: 'comuna',
  region: 'region',
  giroComercial: 'giro_comercial',
  sitioWeb: 'sitio_web',
  instagram: 'instagram',
  facebook: 'facebook',
  registroSeremi: 'registro_seremi',
  registroIsp: 'registro_isp',
  idiomaDocumentos: 'idioma_documentos',
  moneda: 'moneda',
  eslogan: 'eslogan',
  zonaHoraria: 'zona_horaria',
  logoUrl: 'logo_url',
  colorPrimario: 'color_primario',
  colorSecundario: 'color_secundario',
  configuracionMembrete: 'configuracion_documentos',
  configuracionFinanciera: 'configuracion_financiera',
  configuracionConvenios: 'configuracion_convenios',
}

const SNAKE_TO_CAMEL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE_MAP).map(([camel, snake]) => [snake, camel])
)

const transformarDesdeSupabase = (filaDb?: Record<string, unknown> | null): DatosClinicaConfig | null => {
  if (!filaDb) return null
  const resultado: DatosClinicaConfig = {}
  for (const [claveDb, valor] of Object.entries(filaDb)) {
    if (claveDb === 'id' || claveDb === 'created_at' || claveDb === 'updated_at') continue
    const claveJs = SNAKE_TO_CAMEL_MAP[claveDb] || claveDb
    resultado[claveJs] = claveDb === 'configuracion_documentos' || claveDb === 'configuracion_convenios' || claveDb === 'configuracion_financiera'
      ? valor ?? {}
      : valor ?? ''
  }
  return resultado
}

const obtenerClinicaActivaId = (): string | null => {
  const sesion = useSesionStore.getState()
  const id = sesion.clinicaActual || sesion.userProfile?.clinicaId
  return typeof id === 'string' && id ? id : null
}

const emitirConfiguracionConvenios = (clinicaId: string, configuracionConvenios: ConfiguracionConvenios): void => {
  const datosActuales = clinicaRepo.obtener(undefined) || {}
  const datos = { ...datosActuales, configuracionConvenios }
  clinicaRepo.guardar(datos)
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('clinica_actualizada', {
    detail: { clinicaId, nombre: datos.nombreClinica, datos },
  }))
}

const emitirConfiguracionFinanciera = (clinicaId: string, configuracionFinanciera: ConfiguracionFinanciera): void => {
  const datosActuales = clinicaRepo.obtener(undefined) || {}
  const datos = { ...datosActuales, configuracionFinanciera }
  clinicaRepo.guardar(datos)
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('clinica_actualizada', {
    detail: { clinicaId, nombre: datos.nombreClinica, datos },
  }))
}

const transformarParaSupabase = (datosJs?: DatosClinicaConfig | null): Record<string, unknown> | null => {
  if (!datosJs) return null
  const resultado: Record<string, unknown> = {}
  for (const [claveJs, valor] of Object.entries(datosJs)) {
    // Los logos nuevos se guardan en R2. No volver a enviar data URLs grandes
    // a Postgres si todavía existe un valor local legado.
    if (claveJs === 'logoUrl' && typeof valor === 'string' && valor.startsWith('data:')) continue
    const claveDb = CAMEL_TO_SNAKE_MAP[claveJs]
    if (claveDb && valor !== undefined) {
      resultado[claveDb] = valor === '' ? null : valor
    }
  }
  return resultado
}

const obtenerClinicaDesdeSupabase = async (clinicaId?: string | null): Promise<DatosClinicaConfig | null> => {
  if (!USE_SUPABASE || !supabase || !clinicaId) return null

  try {
    const { data, error } = await supabase
      .from('clinicas')
      .select('*')
      .eq('id', clinicaId)
      .maybeSingle()

    if (error) {
      log.warn('Error leyendo clínica desde Supabase:', error.message)
      return null
    }

    return transformarDesdeSupabase(data as Record<string, unknown> | null)
  } catch (e: unknown) {
    log.error('Excepción leyendo clínica:', e)
    return null
  }
}

const guardarClinicaEnSupabase = async (
  clinicaId: string,
  datos: DatosClinicaConfig
): Promise<{ success: boolean; status?: number; error?: string }> => {
  if (!USE_SUPABASE || !supabase || !clinicaId) return { success: true }

  try {
    if (typeof datos.logoUrl === 'string' && datos.logoUrl.startsWith('data:')) {
      return { success: false, error: 'El logo debe cargarse en R2 antes de sincronizar la clínica.' }
    }

    const paraInsert = transformarParaSupabase(datos)
    if (!paraInsert) return { success: false, error: 'Sin datos para actualizar' }

    const { data, error, status } = await supabase
      .from('clinicas')
      .update(paraInsert)
      .eq('id', clinicaId)
      .select('id, nombre')

    if (error) {
      log.error('Error guardando clínica en Supabase:', error.message)
      const es403 = status === 403 || error.code === '42501' || error.message.toLowerCase().includes('policy')
      return { success: false, status: es403 ? 403 : (status || 400), error: error.message }
    }

    if (!data || data.length === 0) {
      log.warn('F7-RLS: 0 filas actualizadas al guardar clínica (requiere rol admin)')
      return { success: false, status: 403, error: 'Solo administradores pueden editar datos de la clínica' }
    }

    return { success: true }
  } catch (e: unknown) {
    log.error('Excepción guardando clínica:', e)
    return { success: false, status: 500, error: String(e) }
  }
}

const migrarClinicaASupabase = async (clinicaId: string): Promise<boolean> => {
  if (!USE_SUPABASE || !supabase || !clinicaId) return false

  try {
    const datosLocal = clinicaRepo.obtener(undefined)
    if (!datosLocal || !datosLocal.nombreClinica) return false

    const { data: existente } = await supabase
      .from('clinicas')
      .select('nombre')
      .eq('id', clinicaId)
      .maybeSingle()

    if (existente?.nombre) return false

    const ok = await guardarClinicaEnSupabase(clinicaId, datosLocal)
    if (ok.success) {
      log.info('Datos de clínica migrados a Supabase')
    }
    return ok.success
  } catch (e: unknown) {
    log.error('Error migrando clínica:', e)
    return false
  }
}

export const clinicStorageService: ClinicStorageServiceAPI = {
  obtenerClinica: (defaults) => clinicaRepo.obtener(defaults),

  guardarClinica: (datos) => clinicaRepo.guardar(datos),

  guardarClinicaCompleta: async (clinicaId, datos) => {
    const res = await guardarClinicaEnSupabase(clinicaId, datos)
    if (!res.success) {
      if (res.status === 403 || res.error?.includes('administrador') || res.error?.includes('403') || res.error?.includes('policy')) {
        notificationService.mostrar('Solo administradores pueden editar datos de la clínica', { tipo: 'error' })
      }
      return false
    }
    clinicaRepo.guardar(datos)
    if (typeof window !== 'undefined' && datos.nombreClinica) {
      window.dispatchEvent(new CustomEvent('clinica_actualizada', {
        detail: { clinicaId, nombre: datos.nombreClinica, datos },
      }))
    }
    return true
  },

  cargarConfiguracionConvenios: async (clinicaId) => {
    if (!clinicaId || obtenerClinicaActivaId() !== clinicaId) {
      throw new Error('La clínica activa cambió. Vuelve a abrir la configuración.')
    }

    if (!USE_SUPABASE) {
      const configuracion = leerConfiguracionConvenios(clinicaRepo.obtener(undefined)?.configuracionConvenios)
      if (!configuracion) throw new Error('La configuración de convenios no es válida.')
      return configuracion
    }
    if (!supabase) throw new Error('No hay conexión disponible para cargar los convenios compartidos.')

    const { data, error } = await supabase
      .from('clinicas')
      .select('configuracion_convenios')
      .eq('id', clinicaId)
      .maybeSingle()

    if (error || !data) {
      log.warn('No se pudo cargar la configuración de convenios compartida.')
      throw new Error('No se pudo cargar la configuración compartida de la clínica.')
    }

    const configuracion = leerConfiguracionConvenios(
      (data as { configuracion_convenios?: unknown }).configuracion_convenios
    )
    if (!configuracion) throw new Error('La configuración de convenios de la clínica necesita revisión.')
    if (obtenerClinicaActivaId() !== clinicaId) {
      throw new Error('La clínica activa cambió durante la carga. Vuelve a abrir la configuración.')
    }

    emitirConfiguracionConvenios(clinicaId, configuracion)
    return configuracion
  },

  guardarConfiguracionConvenios: async (clinicaId, entrada) => {
    const validacion = configuracionConveniosSchema.safeParse(entrada)
    if (!clinicaId || obtenerClinicaActivaId() !== clinicaId || !validacion.success) return false

    if (USE_SUPABASE) {
      if (!supabase) return false
      try {
        const { data, error } = await supabase
          .from('clinicas')
          .update({ configuracion_convenios: validacion.data })
          .eq('id', clinicaId)
          .select('id')

        if (error || !data?.some((fila) => (fila as { id?: string }).id === clinicaId)) {
          log.warn('Supabase rechazó la actualización de convenios compartidos.')
          notificationService.mostrar('No se pudo guardar la configuración compartida de convenios.', { tipo: 'error' })
          return false
        }
      } catch {
        log.warn('Falló la actualización de convenios compartidos.')
        notificationService.mostrar('No se pudo sincronizar la configuración de convenios.', { tipo: 'error' })
        return false
      }
    }

    // La respuesta remota se puede recibir después de cambiar de clínica.
    // Nunca escribir entonces en la caché del tenant que quedó activo.
    if (obtenerClinicaActivaId() === clinicaId) {
      emitirConfiguracionConvenios(clinicaId, validacion.data)
    }
    return true
  },

  cargarConfiguracionFinanciera: async (clinicaId) => {
    if (!clinicaId || obtenerClinicaActivaId() !== clinicaId) {
      throw new Error('La clínica activa cambió. Vuelve a abrir la configuración.')
    }

    if (!USE_SUPABASE) {
      const configuracion = leerConfiguracionFinanciera(clinicaRepo.obtener(undefined)?.configuracionFinanciera)
        || crearConfiguracionFinancieraPredeterminada()
      return configuracion
    }
    if (!supabase) throw new Error('No hay conexión disponible para cargar la configuración financiera compartida.')

    const { data, error } = await supabase
      .from('clinicas')
      .select('configuracion_financiera')
      .eq('id', clinicaId)
      .maybeSingle()

    if (error || !data) {
      log.warn('No se pudo cargar la configuración financiera compartida.')
      throw new Error('No se pudo cargar la configuración financiera compartida de la clínica.')
    }

    const configuracion = leerConfiguracionFinanciera(
      (data as { configuracion_financiera?: unknown }).configuracion_financiera
    )
    if (!configuracion) throw new Error('La configuración financiera de la clínica necesita revisión.')
    if (obtenerClinicaActivaId() !== clinicaId) {
      throw new Error('La clínica activa cambió durante la carga. Vuelve a abrir la configuración.')
    }

    emitirConfiguracionFinanciera(clinicaId, configuracion)
    return configuracion
  },

  guardarConfiguracionFinanciera: async (clinicaId, entrada) => {
    const validacion = configuracionFinancieraSchema.safeParse(entrada)
    if (!clinicaId || obtenerClinicaActivaId() !== clinicaId || !validacion.success) return false

    if (USE_SUPABASE) {
      if (!supabase) return false
      try {
        const { data, error } = await supabase
          .from('clinicas')
          .update({ configuracion_financiera: validacion.data })
          .eq('id', clinicaId)
          .select('id')

        if (error || !data?.some((fila) => (fila as { id?: string }).id === clinicaId)) {
          log.warn('Supabase rechazó la actualización de la configuración financiera compartida.')
          notificationService.mostrar('No se pudo guardar la configuración financiera compartida.', { tipo: 'error' })
          return false
        }
      } catch {
        log.warn('Falló la actualización de la configuración financiera compartida.')
        notificationService.mostrar('No se pudo sincronizar la configuración financiera.', { tipo: 'error' })
        return false
      }
    }

    if (obtenerClinicaActivaId() === clinicaId) {
      emitirConfiguracionFinanciera(clinicaId, validacion.data)
    }
    return true
  },

  sincronizarClinicaDesdeSupabase: async (clinicaId) => {
    const datos = await obtenerClinicaDesdeSupabase(clinicaId)
    if (datos) {
      clinicaRepo.guardar(datos)
      if (typeof window !== 'undefined' && datos.nombreClinica) {
        window.dispatchEvent(new CustomEvent('clinica_actualizada', {
          detail: { clinicaId, nombre: datos.nombreClinica, datos },
        }))
      }
    }
    return datos
  },

  migrarClinicaSiNecesario: migrarClinicaASupabase
}

// Alias para compatibilidad con código existente
export const configuracionStorageService = clinicStorageService
