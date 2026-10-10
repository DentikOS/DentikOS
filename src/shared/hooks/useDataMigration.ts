/**
 * Hook de migración automática de datos localStorage → Supabase (F4-02c-2, F4-02c-3).
 *
 * Se ejecuta automáticamente cuando:
 * 1. El usuario está autenticado con Supabase (VITE_USE_SUPABASE=true)
 * 2. Hay datos en localStorage pendientes de migrar
 * 3. La migración no se ha ejecutado aún en esta sesión
 */
import { useEffect } from 'react'
import { supabase, USE_SUPABASE } from '../../infrastructure/supabase/supabaseClient'
import { createLogger } from '../../infrastructure/logging/logger'
import {
  verificarTodosLosDatosPendientes,
  puedeIniciarMigracion
} from '../utils/dataMigrationValidation'
import {
  sincronizarCacheSupabase,
  ejecutarPasosMigracion
} from '../utils/dataMigrationUtils'

const log = createLogger('useDataMigration')

// Lock de módulo: persiste entre re-renders y entre ejecuciones de StrictMode
let migracionEnProgreso = false
let migracionCompletada = false

export const useDataMigration = (userProfile: unknown): void => {
  useEffect(() => {
    if (!puedeIniciarMigracion(USE_SUPABASE, !!supabase, userProfile, migracionEnProgreso, migracionCompletada)) {
      return
    }

    const ejecutarMigracion = async (): Promise<void> => {
      if (!supabase) return
      migracionEnProgreso = true

      try {
        const pendientes = verificarTodosLosDatosPendientes()

        if (pendientes.total === 0) {
          log.info('No hay datos pendientes de migrar')
          await sincronizarCacheSupabase()
          migracionCompletada = true
          return
        }

        log.info(`Migrando ${pendientes.total} registros a Supabase...`, {
          pacientes: pendientes.pacientes.pendientes,
          citas: pendientes.citas.pendientes,
          presupuestos: pendientes.presupuestos.pendientes,
          pagos: pendientes.pagos.globalesPendientes,
          movimientos: pendientes.movimientos.pendientes,
          datosClinicos: pendientes.datosClinicos.conDatos
        })

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          log.error('No se pudo obtener user_id de Supabase')
          migracionEnProgreso = false
          return
        }

        await ejecutarPasosMigracion(user.id, pendientes)
        await sincronizarCacheSupabase()

        log.info('Migración completada y caché sincronizada')
        migracionCompletada = true
      } catch (error: unknown) {
        log.error('Error inesperado durante la migración:', error)
        migracionEnProgreso = false
      } finally {
        migracionEnProgreso = false
      }
    }

    void ejecutarMigracion()
  }, [userProfile])
}
