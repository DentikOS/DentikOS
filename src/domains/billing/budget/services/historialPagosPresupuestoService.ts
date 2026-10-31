import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'

export interface PagoPresupuesto {
  id: string
  monto: number
  metodoPago: string
  fecha: string
  referencia: string | null
}

export const historialPagosPresupuestoService = {
  async listar(presupuestoId: string | number, pacienteId: string | number): Promise<PagoPresupuesto[]> {
    const clinicaId = getClinicaActivaSync()
    if (!USE_SUPABASE || !supabase || !esUuidValido(clinicaId) ||
      !esUuidValido(pacienteId) || !esUuidValido(presupuestoId)) {
      throw new Error('El historial de pagos requiere un presupuesto sincronizado de la clínica activa.')
    }
    const { data, error } = await supabase.from('pagos')
      .select('id,monto,metodo_pago,fecha,referencia')
      .eq('clinica_id', clinicaId).eq('paciente_id', String(pacienteId))
      .eq('presupuesto_id', String(presupuestoId))
      .order('fecha', { ascending: false })
    if (error) throw new Error('No se pudo consultar el historial de pagos.')
    return (data || []).map((row) => ({
      id: String(row.id), monto: Number(row.monto), metodoPago: String(row.metodo_pago),
      fecha: String(row.fecha), referencia: row.referencia ? String(row.referencia) : null,
    }))
  },
}
