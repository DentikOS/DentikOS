import { migratePacientesToSupabase } from '../../infrastructure/supabase/migrations/migratePacientesToSupabase'
import { migrateCitasToSupabase } from '../../infrastructure/supabase/migrations/migrateCitasToSupabase'
import { migratePresupuestosToSupabase } from '../../infrastructure/supabase/migrations/migratePresupuestosToSupabase'
import { migratePagosToSupabase } from '../../infrastructure/supabase/migrations/migratePagosToSupabase'
import { migrateMovimientosFinancierosToSupabase } from '../../infrastructure/supabase/migrations/migrateMovimientosFinancierosToSupabase'
import { migrateDatosClinicosToSupabase } from '../../infrastructure/supabase/migrations/migrateDatosClinicosToSupabase'
import { usePacientesStore } from '../../app/stores/pacientesStore'
import { pacientesStorageService } from '../../domains/clinical/patient'
import { agendaStorageService } from '../../domains/operations/agenda'
import { presupuestosStorageService } from '../../domains/billing/budget/services/presupuestosStorageService'
import { pagosStorageService } from '../../domains/billing/payment/services/pagosStorageService'
import { finanzasStorageService } from '../../domains/billing/cash-register/services/finanzasStorageService'
import { createLogger } from '../../infrastructure/logging/logger'
import type { DatosPendientesResumen } from './dataMigrationValidation'

const log = createLogger('dataMigrationUtils')

export async function sincronizarCacheSupabase(): Promise<void> {
  await pacientesStorageService.sincronizarDesdeSupabase()
  await agendaStorageService.sincronizarDesdeSupabase()
  await presupuestosStorageService.sincronizarDesdeSupabase()
  await pagosStorageService.sincronizarDesdeSupabase()
  await finanzasStorageService.sincronizarDesdeSupabase()

  const pacientesActualizados = pacientesStorageService.obtenerPacientes([])
  usePacientesStore.setState({ pacientes: pacientesActualizados })
}

export async function ejecutarPasosMigracion(
  userId: string,
  pendientes: DatosPendientesResumen
): Promise<void> {
  if (pendientes.pacientes.pendientes > 0) {
    const res = await migratePacientesToSupabase(userId)
    if (res.errores.length > 0) log.error('Errores migración pacientes:', res.errores)
  }

  if (pendientes.citas.pendientes > 0) {
    const res = await migrateCitasToSupabase(userId)
    if (res.errores.length > 0) log.error('Errores migración citas:', res.errores)
  }

  if (pendientes.presupuestos.pendientes > 0) {
    const res = await migratePresupuestosToSupabase(userId)
    if (res.errores.length > 0) log.error('Errores migración presupuestos:', res.errores)
  }

  if (pendientes.pagos.globalesPendientes > 0) {
    const res = await migratePagosToSupabase(userId)
    if (res.errores.length > 0) log.error('Errores migración pagos:', res.errores)
  }

  if (pendientes.movimientos.pendientes > 0) {
    const res = await migrateMovimientosFinancierosToSupabase(userId)
    if (res.errores.length > 0) log.error('Errores migración movimientos:', res.errores)
  }

  if (pendientes.datosClinicos.conDatos > 0) {
    const res = await migrateDatosClinicosToSupabase(userId)
    if (res.errores.length > 0) log.error('Errores migración datos clínicos:', res.errores)
  }
}
