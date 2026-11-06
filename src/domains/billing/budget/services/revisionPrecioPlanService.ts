import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'

export interface RevisionPrecioPlanResult {
  nuevaRevision: string
  nuevaVersion: number
}

export const revisionPrecioPlanService = {
  async confirmar(input: {
    presupuestoId: string | number
    pacienteId: string
    planRevision: string
    version: number
    motivo: string
  }): Promise<RevisionPrecioPlanResult> {
    const clinicaId = getClinicaActivaSync()
    const motivo = input.motivo.trim()
    if (!USE_SUPABASE || !supabase || !esUuidValido(clinicaId) ||
      !esUuidValido(input.presupuestoId) || !esUuidValido(input.pacienteId) ||
      !input.planRevision || input.planRevision.length > 100 ||
      !Number.isInteger(input.version) || input.version < 1 ||
      !motivo || motivo.length > 500) {
      throw new Error('La revisión requiere un borrador sincronizado y un motivo válido.')
    }
    const { data, error } = await supabase.rpc('revisar_precios_plan_desde_presupuesto', {
      p_presupuesto_id: input.presupuestoId,
      p_paciente_id: input.pacienteId,
      p_plan_revision: input.planRevision,
      p_version_esperada: input.version,
      p_motivo: motivo,
    })
    const confirmado = Array.isArray(data) ? data[0] : data
    if (error || !confirmado?.nueva_revision || !Number.isInteger(Number(confirmado.nueva_version))) {
      throw new Error('No se pudo revisar el precio. Actualiza el plan y el presupuesto antes de reintentar.')
    }
    return { nuevaRevision: String(confirmado.nueva_revision), nuevaVersion: Number(confirmado.nueva_version) }
  },
}
