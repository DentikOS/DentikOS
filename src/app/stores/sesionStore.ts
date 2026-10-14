import { create } from 'zustand'
import { esRolValido, obtenerRolPorDefecto } from '../../infrastructure/auth/rbacService'
import { supabase, USE_SUPABASE } from '../../infrastructure/supabase/supabaseClient'
import { createLogger } from '../../infrastructure/logging/logger'
import { purgarDatosLocales } from '../../infrastructure/persistence/purgarDatosLocales'

const log = createLogger('sesionStore')

const ACTIVE_USER_KEY = 'clinica_active_user'
const MAX_PACIENTES_RECIENTES = 5 // F7-26: historial de navegación clínica

// F7-05 FIX: flag para prevenir recursión de logout.
let estaCerrandoSesion = false

export interface UserProfileSession {
  email: string
  nombreCompleto?: string
  rut?: string
  especialidad?: string
  rol?: string
  clinicaId?: string | null
  supabaseAuth?: boolean
  [key: string]: unknown
}

export interface PacienteReciente {
  id: string | number
  nombre?: string
  rut?: string
  timestamp?: number
  [key: string]: unknown
}

export interface SesionStore {
  userProfile: UserProfileSession | null
  clinicaActual: string | null
  sedeActual: string | null
  login: (profile: UserProfileSession) => void
  cambiarSede: (sedeId: string) => void
  logout: () => Promise<void>
  actualizarPerfil: (profile: Partial<UserProfileSession> & Record<string, unknown>) => void
  agregarPacienteReciente: (paciente?: { id?: string | number; nombre?: string; rut?: string; [key: string]: unknown } | null) => void
  obtenerPacientesRecientes: () => PacienteReciente[]
}

/**
 * Carga el perfil activo desde localStorage y garantiza que tenga un rol válido.
 * Si el perfil existe pero no tiene rol válido (campo faltante o valor inválido),
 * se le asigna el rol por defecto (RECEPCION, fail-safe) en memoria.
 */
const cargarPerfilActivo = (): UserProfileSession | null => {
  // F10-B4 fix: guardia para contextos sin DOM (SSR/SSG/testing)
  if (typeof localStorage === 'undefined') return null

  try {
    const activeEmail = localStorage.getItem(ACTIVE_USER_KEY)
    if (!activeEmail) return null
    const saved = localStorage.getItem(`profile_${activeEmail}`)
    if (!saved) return null

    const perfil = JSON.parse(saved) as UserProfileSession

    // F3-05: garantizar que el perfil tenga un rol válido en memoria.
    // Si no tiene rol o es inválido, usar el rol por defecto (RECEPCION).
    if (!perfil.rol || !esRolValido(perfil.rol)) {
      return { ...perfil, rol: obtenerRolPorDefecto() }
    }

    return perfil
  } catch (e: unknown) {
    log.error('Error al leer la sesión activa:', e)
    return null
  }
}

/**
 * Store global de sesión/perfil de usuario (F2-01 — MASTER_ROADMAP).
 */
export const useSesionStore = create<SesionStore>((set, get) => ({
  userProfile: cargarPerfilActivo(),
  clinicaActual: (cargarPerfilActivo()?.clinicaId as string) || null,
  sedeActual: typeof localStorage !== 'undefined' ? localStorage.getItem('clinica_sede_activa') : null,

  login: (profile: UserProfileSession): void => {
    try {
      localStorage.setItem(ACTIVE_USER_KEY, profile.email)
      
      // F4-02b FIX: En modo Supabase, también guardar el perfil completo
      // en localStorage para que persista entre recargas.
      if (profile.supabaseAuth) {
        const profileKey = `profile_${profile.email.trim().toLowerCase()}`
        localStorage.setItem(profileKey, JSON.stringify(profile))
      }
    } catch (e: unknown) {
      log.error('Error al guardar la sesión activa:', e)
    }

    // F3-05: garantizar rol válido en memoria. Si el perfil entrante no
    // tiene rol válido, asignar el rol por defecto (RECEPCION).
    const perfilNormalizado: UserProfileSession = {
      ...profile,
      rol: profile.rol && esRolValido(profile.rol)
        ? profile.rol
        : obtenerRolPorDefecto()
    }

    set({
      userProfile: perfilNormalizado,
      clinicaActual: (perfilNormalizado.clinicaId as string) || null,
    })
  },

  cambiarSede: (sedeId: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('clinica_sede_activa', sedeId)
      }
    } catch (e: unknown) {
      log.error('Error al guardar sede activa en storage:', e)
    }
    set({ sedeActual: sedeId })
  },

  logout: async (): Promise<void> => {
    // F7-05 FIX: prevenir recursión de logout
    if (estaCerrandoSesion) {
      log.warn('Logout ya está en progreso, ignorando llamada recursiva')
      return
    }

    estaCerrandoSesion = true

    try {
      // 1. Cerrar sesión de Supabase Auth (si está activa) PRIMERO
      if (USE_SUPABASE && supabase) {
        try {
          await supabase.auth.signOut()
          log.info('Sesión de Supabase Auth cerrada')
        } catch (e: unknown) {
          log.error('Error al cerrar sesión de Supabase:', e)
        }
      }

      // 2. F7-05: purgar todas las capas de persistencia local
      try {
        await purgarDatosLocales({ logger: log })
      } catch (e: unknown) {
        log.error('Error durante la purga de datos locales (F7-05):', e)
      }

      // 3. Limpiar estado de sesión en memoria
      set({ userProfile: null })
    } finally {
      // Siempre liberar el flag, incluso si hay error
      estaCerrandoSesion = false
    }
  },

  // Actualiza el perfil en memoria SIN perder campos existentes
  // Usa merge preservativo: fusiona nuevos campos con el perfil actual
  actualizarPerfil: (profile: Partial<UserProfileSession> & Record<string, unknown>): void => {
    // 1. Obtener perfil actual (preservar todos sus campos)
    const current = get().userProfile
    
    // 2. Si no hay perfil actual, crear uno mínimo con email del profile entrante
    if (!current) {
      const perfilInicial: UserProfileSession = {
        email: (profile.email as string) || '',
        ...profile,
        rol: profile.rol && esRolValido(profile.rol as string)
          ? (profile.rol as string)
          : obtenerRolPorDefecto(),
      }
      set({ userProfile: perfilInicial })
      return
    }

    // 3. MERGE PRESERVATIVO: fusionar perfil actual + cambios entrantes
    // Los campos pasados en `profile` sobrescriben los existentes
    // Los campos NO pasados se preservan del perfil actual
    const merged: UserProfileSession = {
      ...current,
      ...profile,
      // email nunca debe quedar vacío (protección defensiva)
      email: (profile.email as string) || current.email || '',
    }

    // 4. Normalizar rol: preservar el actual si no viene uno nuevo válido
    const rolFinal = merged.rol && esRolValido(merged.rol as string)
      ? (merged.rol as string)
      : current.rol && esRolValido(current.rol as string)
        ? (current.rol as string)
        : obtenerRolPorDefecto()

    const perfilNormalizado: UserProfileSession = {
      ...merged,
      rol: rolFinal,
    }

    set({
      userProfile: perfilNormalizado,
      clinicaActual: (perfilNormalizado.clinicaId as string) || null,
    })
  },

  // F7-26: Agrega un paciente al historial de recientes (últimos 5).
  agregarPacienteReciente: (paciente?: { id?: string | number; nombre?: string; rut?: string; [key: string]: unknown } | null): void => {
    try {
      const activeEmail = localStorage.getItem(ACTIVE_USER_KEY)
      if (!activeEmail || !paciente?.id) return
      
      const key = `clinica_pacientes_recientes_${activeEmail}`
      const existentes = JSON.parse(localStorage.getItem(key) || '[]') as PacienteReciente[]
      
      // Remover si ya existe (para moverlo al frente)
      const filtrados = existentes.filter((p) => p.id !== paciente.id)
      
      // Agregar al frente con timestamp
      const actualizado: PacienteReciente[] = [
        { id: paciente.id, nombre: paciente.nombre, rut: paciente.rut, timestamp: Date.now() },
        ...filtrados,
      ].slice(0, MAX_PACIENTES_RECIENTES)
      
      localStorage.setItem(key, JSON.stringify(actualizado))
    } catch (e: unknown) {
      log.error('Error al guardar paciente reciente:', e)
    }
  },

  // F7-26: Obtiene el historial de pacientes recientes (lectura directa).
  obtenerPacientesRecientes: (): PacienteReciente[] => {
    try {
      const activeEmail = localStorage.getItem(ACTIVE_USER_KEY)
      if (!activeEmail) return []
      const key = `clinica_pacientes_recientes_${activeEmail}`
      return JSON.parse(localStorage.getItem(key) || '[]') as PacienteReciente[]
    } catch {
      return []
    }
  }
}))
