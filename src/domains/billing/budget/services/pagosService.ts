import { usePresupuestosStore } from '../../../../app/stores/presupuestosStore'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { presupuestosStorageService } from './presupuestosStorageService'

export interface RegistrarPagoInput {
  pagoId?: string
  presupuestoId: string | number
  pacienteId?: string | number
  monto: number
  medioPago: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque'
  referencia?: string
}

export const pagosService = {
  registrarPagoManual: async (input: RegistrarPagoInput) => {
    if (!USE_SUPABASE || !supabase || !esUuidValido(input.presupuestoId) || !esUuidValido(getClinicaActivaSync())) {
      throw new Error('Se necesita una sesión clínica activa para registrar el pago.')
    }
    if (!Number.isSafeInteger(input.monto) || input.monto <= 0) {
      throw new Error('El monto debe ser un entero mayor a 0.')
    }
    if (input.pagoId && !esUuidValido(input.pagoId)) throw new Error('Identificador de pago inválido.')
    const pagoId = input.pagoId || crypto.randomUUID()
    const { data, error } = await supabase.rpc('registrar_abono_presupuesto', {
      p_pago_id: pagoId,
      p_presupuesto_id: String(input.presupuestoId),
      p_monto: input.monto,
      p_metodo_pago: input.medioPago,
      p_referencia: input.referencia?.trim() || null,
    })
    const confirmado = Array.isArray(data) ? data[0] : data
    if (error || !confirmado || confirmado.pago_id !== pagoId) {
      throw new Error('No se pudo registrar el pago. Comprueba el estado y saldo del presupuesto.')
    }
    const montoAbonado = Number(confirmado.monto_abonado)
    const estado = String(confirmado.estado_presupuesto)
    presupuestosStorageService.aplicarAbonoConfirmado(input.presupuestoId, montoAbonado, estado)
    usePresupuestosStore.getState().actualizarPresupuesto(input.presupuestoId, { montoAbonado, estado })
    return { exito: true, pagoId, montoAbonado, estado }
  },
}
