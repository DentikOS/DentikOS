/**
 * useRestaurarPaciente — Hook para restaurar paciente seleccionado desde Supabase (F4-02e)
 *
 * Al recargar la app, restaura el paciente seleccionado previamente
 * usando el repo tenant-aware compartido con setPacienteSeleccionado.
 *
 * Unifica las dos fuentes anteriores (localStorage directo + tenantCache)
 * en una sola fuente de verdad: el repo tenant-aware.
 *
 * Uso:
 *   useRestaurarPaciente(userProfile, pacienteSeleccionado, setPacienteSeleccionadoState, setActiveSection, pacienteSeleccionadoRepo)
 */
import { useEffect } from 'react'
import { supabase, USE_SUPABASE } from '../../infrastructure/supabase/supabaseClient'
import { createLogger } from '../../infrastructure/logging/logger'
import type { Paciente } from '../../domains/clinical/patient/schemas/pacienteSchema'
import type { TenantRepository } from '../../infrastructure/storage/localStorageRepository'

const log = createLogger('useRestaurarPaciente')

interface PacienteRow {
  id: string
  rut: string
  nombre: string
  edad?: number | string | null
  telefono?: string | null
  email?: string | null
  ocupacion?: string | null
  prevision?: string | null
  alergias?: string | null
  fecha_nacimiento?: string | null
  direccion?: string | null
  created_at?: string | null
  updated_at?: string | null
  [key: string]: unknown
}

export const useRestaurarPaciente = (
  userProfile: unknown,
  pacienteSeleccionado: Paciente | null,
  setPacienteSeleccionadoState: (paciente: Paciente) => void,
  setActiveSection: (seccion: string) => void,
  pacienteSeleccionadoRepo: TenantRepository<string | null>
): void => {
  useEffect(() => {
    // Solo ejecutar si el usuario está autenticado y aún no hay paciente cargado
    if (!userProfile || !USE_SUPABASE || !supabase || pacienteSeleccionado !== null) {
      return
    }

    // 🔒 SEMÁFORO: Si el usuario navegó intencionalmente al listado recientemente, no restaurar
    try {
      const skipUntil = sessionStorage.getItem('dentikos_skip_restore_until')
      if (skipUntil && Date.now() < Number(skipUntil)) {
        log.info('Restauración bloqueada por navegación intencional reciente')
        return
      }
    } catch {}

    const restaurarPacienteSeleccionado = async (): Promise<void> => {
      if (!supabase) return
      try {
        // 🔒 UNIFICADO: usar repo tenant-aware en lugar de localStorage directo
        const pacienteIdGuardado = pacienteSeleccionadoRepo.obtener(null)

        // Si no hay ID guardado, no restaurar nada
        if (!pacienteIdGuardado) {
          return
        }

        // Validar que sea UUID válido
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pacienteIdGuardado)) {
          pacienteSeleccionadoRepo.eliminar()
          return
        }

        // 🔒 GUARDIA DE RACE CONDITION: Verificar que el ID sigue ahí
        await new Promise((resolve) => setTimeout(resolve, 100))
        const pacienteIdActual = pacienteSeleccionadoRepo.obtener(null)
        if (pacienteIdActual !== pacienteIdGuardado) {
          log.info('ID de paciente cambió durante la espera, abortando restauración')
          return
        }

        log.info('Restaurando ficha de paciente desde Supabase:', pacienteIdGuardado)

        const { data, error } = await supabase
          .from('pacientes')
          .select('*')
          .eq('id', pacienteIdGuardado)
          .maybeSingle()

        if (error) {
          log.error('Error al restaurar paciente:', error.message)
          return
        }

        if (!data) {
          log.warn('Paciente no encontrado (pudo ser eliminado), limpiando selección')
          pacienteSeleccionadoRepo.eliminar()
          return
        }

        const pacienteData = data as PacienteRow

        const pacienteRestaurado: Paciente = {
          id: pacienteData.id,
          rut: pacienteData.rut,
          nombre: pacienteData.nombre,
          edad: pacienteData.edad ?? undefined,
          telefono: pacienteData.telefono ?? undefined,
          email: pacienteData.email ?? undefined,
          ocupacion: pacienteData.ocupacion ?? undefined,
          prevision: pacienteData.prevision ?? undefined,
          alergias: pacienteData.alergias ?? undefined,
          fechaNacimiento: pacienteData.fecha_nacimiento ?? undefined,
          direccion: pacienteData.direccion ?? undefined,
          createdAt: pacienteData.created_at ?? undefined,
          updatedAt: pacienteData.updated_at ?? undefined,
        }

        // Actualizar estado (NO llama a setPacienteSeleccionado para evitar loops)
        setPacienteSeleccionadoState(pacienteRestaurado)
        setActiveSection('Pacientes')
        log.info('Ficha de paciente restaurada:', pacienteRestaurado.nombre)
      } catch (e: unknown) {
        log.error('Error inesperado al restaurar paciente:', e)
      }
    }

    void restaurarPacienteSeleccionado()
  }, [userProfile, pacienteSeleccionado, setPacienteSeleccionadoState, setActiveSection, pacienteSeleccionadoRepo])
}
