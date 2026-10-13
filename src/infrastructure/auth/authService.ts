/**
 * Servicio de Autenticación — Studio Dental
 * Tarea MASTER_ROADMAP: F1-01 (original), F7-16 (eliminación modo local)
 *
 * Autenticación vía Supabase Auth con integración de membresías multi-clínica.
 * Incluye gestión de perfiles locales (preferencias del usuario profesional).
 *
 * F7-16 (2026-09-22): Eliminado modo local PBKDF2 + localStorage.
 * Motivo: código legacy pre-F4-02 (migración Supabase 2026-08-13) no usado
 * en producción (VITE_USE_SUPABASE=true siempre). Reduce superficie de
 * ataque y simplifica mantenimiento.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, USE_SUPABASE } from '../supabase/supabaseClient'
import { createLogger } from '../logging/logger'

const log = createLogger('authService')

// ---------------------------------------------------------------------------
// Tipos e Interfaces
// ---------------------------------------------------------------------------

export interface PerfilUsuario {
  email?: string
  nombre?: string
  nombreCompleto?: string
  especialidad?: string
  telefono?: string
  rol?: string
  [key: string]: unknown
}

export interface AuthUserMetadata {
  role?: string
  clinicaId?: string | null
  full_name?: string
  nombreCompleto?: string
  [key: string]: unknown
}

export interface AuthResult {
  success: boolean
  error?: string
  userMetadata?: AuthUserMetadata
}

export interface ClinicaMembresiaItem {
  clinica_id: string
  nombre: string
  rol: string
}

export interface InvitacionItem {
  id: string
  email: string
  rol: string
  estado: string
  token?: string
  created_at?: string
  expira_en?: string
  [key: string]: unknown
}

export interface MiembroItem {
  id: string
  user_id: string
  email: string
  nombre?: string
  rol: string
  activo: boolean
  fecha_invitacion?: string
  invitado_por?: string
}

export interface BootstrapClinicaDatos {
  nombre: string
  rutEmpresa?: string | null
  direccion?: string | null
  telefono?: string | null
  emailContacto?: string | null
}

export interface BootstrapVerificacionResult {
  necesario: boolean
  error?: string
}

export interface BootstrapClinicaResult {
  success: boolean
  clinicaId?: string
  error?: string
}

// ---------------------------------------------------------------------------
// Gestión de perfiles de usuario (F2-07c)
// ---------------------------------------------------------------------------
//
// Centraliza el acceso a la clave `profile_${email}` en localStorage.
// Antes, LoginScreen y useConfiguracion accedían directamente a esta clave,
// violando el criterio de F2-07 de "cero accesos directos fuera de servicios".
//
// Nota: estos accesos son al dominio de sesión/perfil, por lo que el
// authService es el dueño natural de la clave — no se crea un servicio
// separado, se extiende este.

const profileKey = (email: string): string => `profile_${email.trim().toLowerCase()}`

/**
 * Lee el perfil de usuario persistido para un email dado.
 * @param email - Email del profesional (se normaliza a minúsculas).
 * @returns El perfil parseado, o `null` si no existe o el JSON está corrupto.
 */
export const obtenerPerfil = <T extends Record<string, unknown> = PerfilUsuario>(email: string): T | null => {
  if (!email) return null
  try {
    const raw = localStorage.getItem(profileKey(email))
    return raw ? (JSON.parse(raw) as T) : null
  } catch (e: unknown) {
    log.error(`Error al leer perfil "${email}" desde localStorage:`, e)
    return null
  }
}

/**
 * Persiste el perfil de usuario para un email dado.
 * @param email - Email del profesional (se normaliza a minúsculas).
 * @param perfil - Objeto de perfil completo a persistir.
 * @returns `true` si la escritura fue exitosa, `false` si falló.
 */
export const guardarPerfil = (email: string, perfil: unknown): boolean => {
  if (!email || !perfil) return false
  try {
    localStorage.setItem(profileKey(email), JSON.stringify(perfil))
    return true
  } catch (e: unknown) {
    log.error(`Error al guardar perfil "${email}" en localStorage:`, e)
    return false
  }
}

/**
 * Indica si existe un perfil persistido para un email dado.
 * Útil para la UI de LoginScreen que necesita saber si es primera vez
 * sin cargar el perfil completo.
 */
export const existePerfil = (email: string): boolean => {
  if (!email) return false
  try {
    return localStorage.getItem(profileKey(email)) !== null
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Integración con Supabase Auth (F4-02b)
// ---------------------------------------------------------------------------
// Estas funciones delegan a Supabase Auth cuando VITE_USE_SUPABASE=true.
// El hook useAuth.js y LoginScreen.jsx las usan internamente.

/**
 * Iniciar sesión con Supabase Auth.
 * F6-C-d.2: Consulta miembros_clinica post-login para obtener clinica_id y rol
 * autoritativo (RFC §4.6). Fail-safe a app_metadata si la query falla.
 */
export const supabaseSignIn = async (email: string, password: string): Promise<AuthResult> => {
  if (!USE_SUPABASE || !supabase) {
    return { success: false, error: 'Supabase no configurado' }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // F4-02b FIX DEFINITIVO: obtener user_metadata con getUser() DESPUÉS
  // del signIn exitoso. Esto garantiza que la metadata esté disponible
  // (signInWithPassword a veces no la incluye inmediatamente en la respuesta).
  const { data: { user } } = await supabase.auth.getUser()

  // F6-B4: leer rol de app_metadata (JWT firmado, no editable por el usuario)
  const appRole = (user?.app_metadata?.role as string) || 'recepcion'
  
  // F6-C-d.2: Consultar miembros_clinica para obtener clinica_id y rol autoritativo
  let clinicaId: string | null = null
  let rolDesdeMiembros: string | null = null
  
  if (user?.id) {
    try {
      const { data: membresia, error: errorMembresia } = await supabase
        .from('miembros_clinica')
        .select('clinica_id, rol')
        .eq('user_id', user.id)
        .eq('activo', true)
        .single()
      
      if (!errorMembresia && membresia) {
        clinicaId = membresia.clinica_id as string
        rolDesdeMiembros = membresia.rol as string
      } else {
        log.warn(`No se encontró membresía activa para user ${user.id}, usando app_metadata como fallback`)
      }
    } catch (err: unknown) {
      log.error('Error consultando miembros_clinica:', err)
    }
  }
  
  // D37: Fail-safe — si la query falló, usar app_metadata.role
  const rolFinal = rolDesdeMiembros || appRole
  
  const userMetadata: AuthUserMetadata = { 
    ...(user?.user_metadata || {}), 
    role: rolFinal,
    clinicaId: clinicaId  // F6-C-d.2: propagar clinicaId al perfil
  }

  return {
    success: true,
    userMetadata
  }
}

/**
 * Registrar nuevo usuario con Supabase Auth.
 * F6-C-d.2: NO consulta miembros_clinica (D38 — usuario nuevo no tiene membresía).
 * El admin la asigna después (flujo híbrido RFC Decisión #1).
 */
export const supabaseSignUp = async (
  email: string,
  password: string,
  metadata: { nombreCompleto?: string; [key: string]: unknown } = {}
): Promise<AuthResult> => {
  if (!USE_SUPABASE || !supabase) {
    return { success: false, error: 'Supabase no configurado' }
  }

  // F7-09: NO enviar rol en metadata. handle_new_user() ignora rol del cliente
  // por seguridad y asigna 'recepcion' por defecto. El rol real se asignará
  // vía miembros_clinica (F7-11).
  const { error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: metadata.nombreCompleto || 'Usuario',
        // F7-09: role eliminado para prevenir escalamiento de privilegios
      },
    },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // F6-B4 + F7-09: leer rol de app_metadata (siempre 'recepcion' por defecto)
  const { data: { user } } = await supabase.auth.getUser()
  const appRole = (user?.app_metadata?.role as string) || 'recepcion'
  const userMetadata: AuthUserMetadata = { ...(user?.user_metadata || {}), role: appRole }

  return {
    success: true,
    userMetadata
  }
}

/**
 * F7-09: Obtiene el rol del usuario con lógica fail-closed.
 * 
 * Si falla la consulta de membresía o el rol no es válido,
 * degrada a 'recepcion' (rol no privilegiado), nunca a 'admin'.
 * 
 * @param userId - ID del usuario autenticado
 * @param supabaseClient - Cliente Supabase (default: supabase global)
 * @returns Rol del usuario (fallback garantizado a 'recepcion')
 */
export const obtenerRolConFailClosed = async (
  userId: string | null | undefined,
  supabaseClient: SupabaseClient | null = supabase
): Promise<string> => {
  const ROL_FALLBACK = 'recepcion'
  const ROLES_VALIDOS: readonly string[] = ['admin', 'dentista', 'asistente', 'recepcion']

  if (!userId) {
    log.warn('F7-09: userId vacío, degradando a recepcion')
    return ROL_FALLBACK
  }

  if (!supabaseClient) {
    log.warn('F7-09: supabaseClient no disponible, degradando a recepcion')
    return ROL_FALLBACK
  }

  try {
    const { data, error } = await supabaseClient
      .from('miembros_clinica')
      .select('rol')
      .eq('user_id', userId)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      log.warn('F7-09: Error consultando membresía, degradando a recepcion:', error.message)
      return ROL_FALLBACK
    }

    if (!data) {
      log.info('F7-09: Usuario sin membresía activa, degradando a recepcion')
      return ROL_FALLBACK
    }

    if (!ROLES_VALIDOS.includes(data.rol)) {
      log.warn('F7-09: Rol inválido detectado:', data.rol, '- degradando a recepcion')
      return ROL_FALLBACK
    }

    return data.rol as string
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('F7-09: Excepción en obtenerRolConFailClosed, degradando a recepcion:', msg)
    return ROL_FALLBACK
  }
}

/**
 * Cerrar sesión con Supabase Auth.
 */
export const supabaseSignOut = async (): Promise<void> => {
  if (!USE_SUPABASE || !supabase) {
    return
  }
  await supabase.auth.signOut()
}

/**
 * F7-10: Establece la clínica activa del usuario.
 *
 * Actualiza user_metadata.clinica_id y recarga la sesión para que el JWT
 * incluya el nuevo valor. clinica_actual() (server-side) leerá este selector.
 *
 * @param clinicaId - UUID de la clínica a activar
 */
export const setClinicaActiva = async (clinicaId: string): Promise<{ success: boolean; error?: string }> => {
  if (!USE_SUPABASE || !supabase) {
    return { success: false, error: 'Supabase no configurado' }
  }

  if (!clinicaId) {
    return { success: false, error: 'clinicaId requerido' }
  }

  try {
    const { error } = await supabase.auth.updateUser({
      data: { clinica_id: clinicaId }
    })

    if (error) {
      log.error('F7-10: Error actualizando clinica_id:', error.message)
      return { success: false, error: error.message }
    }

    // Forzar refresh del JWT para que incluya el nuevo clinica_id
    if (typeof supabase.auth.refreshSession === 'function') {
      const { data, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        log.warn('F7-10: No se pudo refrescar sesión:', refreshError.message)
      } else if (data?.session) {
        log.info('F7-10: JWT refrescado, clinica_id en user_metadata:', 
          data.session.user.user_metadata?.clinica_id)
      }
    }

    log.info('F7-10: Clínica activa establecida:', clinicaId)
    return { success: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('F7-10: Excepción en setClinicaActiva:', msg)
    return { success: false, error: msg }
  }
}

/**
 * F7-10: Obtiene la clínica activa del usuario desde user_metadata.
 *
 * @returns UUID de la clínica activa, o null si no está seteada
 */
export const getClinicaActiva = async (): Promise<string | null> => {
  if (!USE_SUPABASE || !supabase) return null

  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

    return (user.user_metadata?.clinica_id as string) || null
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('F7-10: Error en getClinicaActiva:', msg)
    return null
  }
}

/**
 * HOTFIX: Versión síncrona de getClinicaActiva para uso en contextos
 * donde no se puede usar await (tenantCache, storage services).
 *
 * Lee el clinicaId desde el perfil guardado en localStorage por sesionStore,
 * que es la misma fuente de verdad que usa el JWT.
 *
 * @returns UUID de la clínica activa, o null si no está disponible
 */
export const getClinicaActivaSync = (): string | null => {
  try {
    if (typeof localStorage === 'undefined') return null

    const ACTIVE_USER_KEY = 'clinica_active_user'
    const activeEmail = localStorage.getItem(ACTIVE_USER_KEY)
    if (!activeEmail) return null

    const profileKey = `profile_${activeEmail.trim().toLowerCase()}`
    const saved = localStorage.getItem(profileKey)
    if (!saved) return null

    const perfil = JSON.parse(saved) as { clinicaId?: string | null }
    return perfil.clinicaId || null
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    log.error('Error en getClinicaActivaSync:', msg)
    return null
  }
}

/**
 * F7-10: Lista las clínicas donde el usuario tiene membresía activa.
 */
export const listarMisClinicas = async (): Promise<ClinicaMembresiaItem[]> => {
  if (!USE_SUPABASE || !supabase) return []

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('miembros_clinica')
      .select('clinica_id, rol, clinicas(nombre)')
      .eq('user_id', user.id)
      .eq('activo', true)
      .order('clinica_id')

    if (error) {
      log.error('F7-10: Error listando clínicas:', error.message)
      return []
    }

    return (data || []).map((m: {
      clinica_id: string
      rol: string
      clinicas?: { nombre?: string } | { nombre?: string }[] | null
    }) => {
      const nombreClinica = Array.isArray(m.clinicas)
        ? m.clinicas[0]?.nombre
        : m.clinicas?.nombre
      return {
        clinica_id: m.clinica_id,
        nombre: nombreClinica || 'Clínica',
        rol: m.rol
      }
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('F7-10: Excepción en listarMisClinicas:', msg)
    return []
  }
}

/**
 * F7-10b: Obtiene el rol del usuario en la clínica activa actual.
 *
 * Consulta miembros_clinica filtrada por clinica_actual() para obtener
 * el rol contextual (no el rol global de user_metadata).
 *
 * @returns Rol en la clínica activa, o null si no tiene membresía
 */
export const obtenerRolEnClinicaActual = async (): Promise<string | null> => {
  if (!USE_SUPABASE || !supabase) return null

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Query a miembros_clinica filtrada por la clínica activa
    const { data, error } = await supabase.rpc('clinica_actual').then(async ({ data: clinicaId }: { data: string | null }) => {
      if (!clinicaId || !supabase) return { data: null, error: null }

      const { data: membresia, error: membresiaError } = await supabase
        .from('miembros_clinica')
        .select('rol')
        .eq('user_id', user.id)
        .eq('clinica_id', clinicaId)
        .eq('activo', true)
        .single()

      return { data: membresia, error: membresiaError }
    })

    if (error) {
      log.warn('F7-10b: Error consultando rol contextual:', error.message)
      return null
    }

    return (data as { rol?: string } | null)?.rol || null
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('F7-10b: Excepción en obtenerRolEnClinicaActual:', msg)
    return null
  }
}

// ============================================================
// F7-11: Gestión de invitaciones de miembros (sin service_role)
// ============================================================

/**
 * F7-11: Invita a un nuevo miembro a la clínica activa.
 * Solo admins de la clínica activa pueden invitar.
 *
 * @param email - Email del invitado
 * @param rol - Rol a asignar: 'admin' | 'dentista' | 'asistente' | 'recepcion'
 */
export const invitarMiembro = async (
  email: string,
  rol: string
): Promise<{ success: boolean; invitacionId?: string; error?: string }> => {
  if (!USE_SUPABASE || !supabase) {
    return { success: false, error: 'Supabase no configurado' }
  }

  try {
    // Validaciones de entrada
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return { success: false, error: 'Email inválido' }
    }

    const rolesValidos = ['admin', 'dentista', 'asistente', 'recepcion']
    if (!rol || !rolesValidos.includes(rol)) {
      return { success: false, error: `Rol inválido: ${rol}` }
    }

    // Llamar RPC (SECURITY DEFINER, valida permisos internamente)
    const { data, error } = await supabase.rpc('invitar_miembro', {
      p_email: email.trim().toLowerCase(),
      p_rol: rol
    })

    if (error) {
      log.error('F7-11: Error invitando miembro:', error.message)
      // Traducir errores conocidos
      if (error.message.includes('PERMISO_DENEGADO')) {
        return { success: false, error: 'Solo administradores pueden invitar miembros' }
      }
      if (error.message.includes('ya es miembro activo')) {
        return { success: false, error: 'Este email ya es miembro de la clínica' }
      }
      return { success: false, error: error.message }
    }

    log.info('F7-11: Invitación creada:', { email, rol, id: data })
    return { success: true, invitacionId: data as string }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('F7-11: Excepción en invitarMiembro:', msg)
    return { success: false, error: msg }
  }
}

/**
 * F7-11: Lista invitaciones de la clínica activa (admin) o del propio email (otros roles).
 */
export const listarInvitaciones = async (): Promise<{ success: boolean; invitaciones?: InvitacionItem[]; error?: string }> => {
  if (!USE_SUPABASE || !supabase) {
    return { success: false, error: 'Supabase no configurado' }
  }

  try {
    const { data, error } = await supabase.rpc('listar_invitaciones_clinica')

    if (error) {
      log.error('F7-11: Error listando invitaciones:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true, invitaciones: (data || []) as InvitacionItem[] }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('F7-11: Excepción en listarInvitaciones:', msg)
    return { success: false, error: msg }
  }
}

/**
 * F7-11: Lista miembros actuales de la clínica activa.
 * Consulta miembros_clinica JOIN auth.users para obtener emails.
 */
export const listarMiembros = async (): Promise<{ success: boolean; miembros?: MiembroItem[]; error?: string }> => {
  if (!USE_SUPABASE || !supabase) {
    return { success: false, error: 'Supabase no configurado' }
  }

  try {
    const clinicaId = await getClinicaActiva()
    
    if (!clinicaId) {
      return { success: false, error: 'No hay clínica activa' }
    }

    // Query 1: Obtener miembros sin JOIN a auth.users para evitar error 400 de PostgREST
    const { data: miembrosData, error: miembrosError } = await supabase
      .from('miembros_clinica')
      .select('id, user_id, rol, activo, fecha_invitacion, invitado_por')
      .eq('clinica_id', clinicaId)
      .order('fecha_invitacion', { ascending: false })

    if (miembrosError) {
      log.error('F7-11: Error listando miembros:', miembrosError.message)
      return { success: false, error: miembrosError.message }
    }

    const miembrosRaw = miembrosData || []
    if (miembrosRaw.length === 0) {
      return { success: true, miembros: [] }
    }

    // Query 2: Obtener emails y nombres de usuarios por separado (evita JOIN de PostgREST)
    const userIds = Array.from(new Set(miembrosRaw.map((m: { user_id: string }) => m.user_id).filter(Boolean)))
    const emailMap = new Map<string, string>()
    const nombreMap = new Map<string, string>()

    if (userIds.length > 0) {
      try {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds)

        if (profilesData) {
          profilesData.forEach((p: { id: string; email?: string; full_name?: string }) => {
            if (p.id) {
              if (p.email) emailMap.set(p.id, p.email)
              if (p.full_name) nombreMap.set(p.id, p.full_name)
            }
          })
        }
      } catch (err: unknown) {
        log.warn('F7-11: No se pudieron obtener emails/perfiles para miembros:', err)
      }
    }

    // Combinar en memoria
    const miembros: MiembroItem[] = miembrosRaw.map((m: {
      id: string
      user_id: string
      rol: string
      activo: boolean
      fecha_invitacion?: string
      invitado_por?: string
    }) => ({
      id: m.id,
      user_id: m.user_id,
      email: emailMap.get(m.user_id) || 'N/A',
      nombre: nombreMap.get(m.user_id) || emailMap.get(m.user_id) || 'Miembro',
      rol: m.rol,
      activo: m.activo,
      fecha_invitacion: m.fecha_invitacion,
      invitado_por: m.invitado_por
    }))

    return { success: true, miembros }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('F7-11: Excepción en listarMiembros:', msg)
    return { success: false, error: msg }
  }
}

/**
 * F7-11: Revoca una invitación pendiente.
 * Solo admins de la clínica de la invitación pueden revocar.
 *
 * @param invitacionId - UUID de la invitación
 */
export const revocarInvitacion = async (invitacionId: string): Promise<{ success: boolean; error?: string }> => {
  if (!USE_SUPABASE || !supabase) {
    return { success: false, error: 'Supabase no configurado' }
  }

  try {
    if (!invitacionId) {
      return { success: false, error: 'ID de invitación requerido' }
    }

    const { error } = await supabase.rpc('revocar_invitacion', {
      p_invitacion_id: invitacionId
    })

    if (error) {
      log.error('F7-11: Error revocando invitación:', error.message)
      if (error.message.includes('PERMISO_DENEGADO')) {
        return { success: false, error: 'Solo administradores pueden revocar invitaciones' }
      }
      return { success: false, error: error.message }
    }

    log.info('F7-11: Invitación revocada:', invitacionId)
    return { success: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('F7-11: Excepción en revocarInvitacion:', msg)
    return { success: false, error: msg }
  }
}

/**
 * F7-11: Acepta una invitación con token.
 * Valida que el email del usuario autenticado coincida con la invitación.
 *
 * @param token - Token único de la invitación
 */
export const aceptarInvitacion = async (token: string): Promise<{ success: boolean; clinicaId?: string; error?: string }> => {
  if (!USE_SUPABASE || !supabase) {
    return { success: false, error: 'Supabase no configurado' }
  }

  try {
    if (!token || typeof token !== 'string') {
      return { success: false, error: 'Token inválido' }
    }

    const { data, error } = await supabase.rpc('aceptar_invitacion', {
      p_token: token
    })

    if (error) {
      log.error('F7-11: Error aceptando invitación:', error.message)
      // Traducir errores conocidos
      if (error.message.includes('INVITACION_NO_ENCONTRADA')) {
        return { success: false, error: 'Invitación no encontrada' }
      }
      if (error.message.includes('INVITACION_EXPIRADA')) {
        return { success: false, error: 'Esta invitación ya expiró' }
      }
      if (error.message.includes('INVITACION_NO_VALIDA')) {
        return { success: false, error: 'Esta invitación ya fue procesada' }
      }
      if (error.message.includes('EMAIL_NO_COINCIDE')) {
        return { success: false, error: 'Esta invitación es para otro email. Inicia sesión con el email correcto.' }
      }
      if (error.message.includes('YA_ES_MIEMBRO')) {
        return { success: false, error: 'Ya eres miembro de esta clínica' }
      }
      return { success: false, error: error.message }
    }

    log.info('F7-11: Invitación aceptada. Clinica ID:', data)
    return { success: true, clinicaId: data as string }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('F7-11: Excepción en aceptarInvitacion:', msg)
    return { success: false, error: msg }
  }
}

/**
 * F7-11: Genera URL de invitación para compartir.
 *
 * @param token - Token de la invitación
 * @returns URL completa para aceptar la invitación
 */
export const generarUrlInvitacion = (token: string): string => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  return `${baseUrl}/#/aceptar-invita?token=${encodeURIComponent(token)}`
}

// ============================================================
// F7-11b: Bootstrap de clínica nueva (self-service)
// ============================================================

/**
 * F7-11b: Verifica si el usuario actual necesita crear una clínica.
 * Retorna true si el usuario no tiene membresía activa en ninguna clínica.
 */
export const verificarBootstrapNecesario = async (): Promise<BootstrapVerificacionResult> => {
  if (!USE_SUPABASE || !supabase) {
    return { necesario: false, error: 'Supabase no configurado' }
  }

  try {
    const { data, error } = await supabase.rpc('verificar_bootstrap_necesario')

    if (error) {
      log.error('F7-11b: Error verificando bootstrap:', error.message)
      return { necesario: false, error: error.message }
    }

    return { necesario: data === true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('F7-11b: Excepción en verificarBootstrapNecesario:', msg)
    return { necesario: false, error: msg }
  }
}

/**
 * F7-11b: Crea una nueva clínica y asigna al usuario como admin.
 * El usuario no debe tener clínica activa (validado en server).
 *
 * @param datos - Datos de la clínica
 */
export const bootstrapClinica = async (datos: BootstrapClinicaDatos): Promise<BootstrapClinicaResult> => {
  if (!USE_SUPABASE || !supabase) {
    return { success: false, error: 'Supabase no configurado' }
  }

  try {
    // Validaciones de entrada
    if (!datos || typeof datos !== 'object') {
      return { success: false, error: 'Datos de clínica requeridos' }
    }

    if (!datos.nombre || typeof datos.nombre !== 'string' || datos.nombre.trim().length < 3) {
      return { success: false, error: 'Nombre de clínica requerido (mínimo 3 caracteres)' }
    }

    if (datos.nombre.trim().length > 100) {
      return { success: false, error: 'Nombre de clínica muy largo (máximo 100 caracteres)' }
    }

    // Llamar RPC (SECURITY DEFINER, valida permisos internamente)
    const { data, error } = await supabase.rpc('bootstrap_clinica', {
      p_nombre: datos.nombre.trim(),
      p_rut_empresa: datos.rutEmpresa?.trim() || null,
      p_direccion: datos.direccion?.trim() || null,
      p_telefono: datos.telefono?.trim() || null,
      p_email_contacto: datos.emailContacto?.trim() || null
    })

    if (error) {
      log.error('F7-11b: Error creando clínica:', error.message)
      // Traducir errores conocidos
      if (error.message.includes('YA_TIENE_CLINICA')) {
        return { success: false, error: 'Ya tienes una clínica activa. No puedes crear otra.' }
      }
      if (error.message.includes('RATE_LIMIT')) {
        return { success: false, error: 'Ya creaste una clínica recientemente. Espera 24 horas.' }
      }
      if (error.message.includes('RUT_DUPLICADO')) {
        return { success: false, error: 'Ya existe una clínica con este RUT' }
      }
      if (error.message.includes('NOMBRE_REQUERIDO')) {
        return { success: false, error: 'El nombre de la clínica es obligatorio' }
      }
      if (error.message.includes('NOMBRE_MUY_CORTO')) {
        return { success: false, error: 'El nombre debe tener al menos 3 caracteres' }
      }
      if (error.message.includes('NOMBRE_MUY_LARGO')) {
        return { success: false, error: 'El nombre no puede exceder 100 caracteres' }
      }
      return { success: false, error: error.message }
    }

    log.info('F7-11b: Clínica creada:', { clinicaId: data, nombre: datos.nombre })

    // Después de crear la clínica, establecerla como activa
    const setResult = await setClinicaActiva(data as string)
    if (!setResult.success) {
      log.warn('F7-11b: Clínica creada pero no se pudo activar:', setResult.error)
      // No fallar el bootstrap, solo advertir
    }

    return { success: true, clinicaId: data as string }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error('F7-11b: Excepción en bootstrapClinica:', msg)
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// F7-Blueprint01: Recuperación de contraseña y verificación de email
// ---------------------------------------------------------------------------

export const solicitarRecuperacionContrasena = async (
  email: string
): Promise<{ success: boolean; error?: string }> => {
  if (!USE_SUPABASE || !supabase) {
    return { success: false, error: 'Supabase no configurado' }
  }
  try {
    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}#reset-password`
      : undefined
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: redirectUrl,
    })
    if (error) {
      log.warn('Error en solicitarRecuperacionContrasena:', error.message)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('Excepción en solicitarRecuperacionContrasena:', msg)
    return { success: false, error: msg }
  }
}

export const actualizarContrasena = async (
  nuevaContrasena: string
): Promise<{ success: boolean; error?: string }> => {
  if (!USE_SUPABASE || !supabase) {
    return { success: false, error: 'Supabase no configurado' }
  }
  try {
    const { error } = await supabase.auth.updateUser({
      password: nuevaContrasena,
    })
    if (error) {
      log.warn('Error en actualizarContrasena:', error.message)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('Excepción en actualizarContrasena:', msg)
    return { success: false, error: msg }
  }
}

export const reenviarEmailVerificacion = async (
  email: string
): Promise<{ success: boolean; error?: string }> => {
  if (!USE_SUPABASE || !supabase) {
    return { success: false, error: 'Supabase no configurado' }
  }
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    })
    if (error) {
      log.warn('Error reenviando verificación:', error.message)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('Excepción en reenviarEmailVerificacion:', msg)
    return { success: false, error: msg }
  }
}
