import { verificarPacientesPendientes } from '../../infrastructure/supabase/migrations/migratePacientesToSupabase'
import { verificarCitasPendientes } from '../../infrastructure/supabase/migrations/migrateCitasToSupabase'
import { verificarPresupuestosPendientes } from '../../infrastructure/supabase/migrations/migratePresupuestosToSupabase'
import { verificarPagosPendientes } from '../../infrastructure/supabase/migrations/migratePagosToSupabase'
import { verificarMovimientosPendientes } from '../../infrastructure/supabase/migrations/migrateMovimientosFinancierosToSupabase'
import { verificarDatosClinicosPendientes } from '../../infrastructure/supabase/migrations/migrateDatosClinicosToSupabase'

export interface DatosPendientesResumen {
  pacientes: ReturnType<typeof verificarPacientesPendientes>
  citas: ReturnType<typeof verificarCitasPendientes>
  presupuestos: ReturnType<typeof verificarPresupuestosPendientes>
  pagos: ReturnType<typeof verificarPagosPendientes>
  movimientos: ReturnType<typeof verificarMovimientosPendientes>
  datosClinicos: ReturnType<typeof verificarDatosClinicosPendientes>
  total: number
}

export function verificarTodosLosDatosPendientes(): DatosPendientesResumen {
  const pacientes = verificarPacientesPendientes()
  const citas = verificarCitasPendientes()
  const presupuestos = verificarPresupuestosPendientes()
  const pagos = verificarPagosPendientes()
  const movimientos = verificarMovimientosPendientes()
  const datosClinicos = verificarDatosClinicosPendientes()

  const total =
    pacientes.pendientes +
    citas.pendientes +
    presupuestos.pendientes +
    pagos.globalesPendientes +
    movimientos.pendientes +
    datosClinicos.conDatos

  return {
    pacientes,
    citas,
    presupuestos,
    pagos,
    movimientos,
    datosClinicos,
    total
  }
}

export function puedeIniciarMigracion(
  useSupabase: boolean,
  supabaseAvailable: boolean,
  userProfile: unknown,
  enProgreso: boolean,
  completada: boolean
): boolean {
  if (!useSupabase || !supabaseAvailable || !userProfile) return false
  if (enProgreso || completada) return false
  return true
}
