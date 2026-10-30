import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { fusionarItemsDelPlan, type ItemDesdePlan } from '../utils/planBudgetMerge'
import { itemPresupuestoSchema } from '../schemas/presupuestoSchema'
import { presupuestosStorageService, type PresupuestoLocal } from './presupuestosStorageService'

export const presupuestoPlanSyncService = {
  async crearVersionDesdePlan(
    presupuesto: PresupuestoLocal,
    pacienteId: string,
    planRevision: string,
    itemsDelPlan: ItemDesdePlan[],
  ): Promise<string> {
    const clinicaId = getClinicaActivaSync()
    if (!USE_SUPABASE || !supabase || !esUuidValido(clinicaId) ||
      !esUuidValido(pacienteId) || !esUuidValido(presupuesto.id) ||
      !esUuidValido(presupuesto.versionGrupoId) || !presupuesto.origenPlan ||
      String(presupuesto.pacienteId) !== pacienteId ||
      !['enviado', 'Emitido', 'Pendiente', 'aprobado', 'Aprobado', 'en-curso', 'EnTratamiento'].includes(presupuesto.estado || '') ||
      presupuesto.planRevision === planRevision) {
      throw new Error('No hay una versión anterior apta para actualizar desde este plan.')
    }
    const anteriores = itemPresupuestoSchema.array().safeParse(presupuesto.items || [])
    if (!anteriores.success) throw new Error('Los ítems de la versión anterior necesitan revisión.')
    const items = fusionarItemsDelPlan(anteriores.data, itemsDelPlan)
    const { data, error } = await supabase.rpc('crear_version_presupuesto_desde_plan', {
      p_presupuesto_id: presupuesto.id,
      p_plan_revision: planRevision,
      p_items: items,
    })
    if (error || !esUuidValido(data)) throw new Error('No se pudo crear la nueva versión. Revisa la clínica o si existe una versión más reciente.')
    await presupuestosStorageService.sincronizarDesdeSupabase()
    return data
  },

  async confirmarRevision(presupuestoId: string): Promise<void> {
    const clinicaId = getClinicaActivaSync()
    if (!USE_SUPABASE || !supabase || !esUuidValido(clinicaId) || !esUuidValido(presupuestoId)) {
      throw new Error('No se puede revisar un presupuesto sin clínica activa.')
    }
    const { data, error } = await supabase.from('presupuestos')
      .update({ requiere_revision: false })
      .eq('id', presupuestoId).eq('clinica_id', clinicaId)
      .eq('requiere_revision', true).in('estado', ['borrador', 'Borrador'])
      .select('id').maybeSingle()
    if (error || !data) throw new Error('No se pudo confirmar la revisión. Revisa tus permisos y el estado del presupuesto.')
    await presupuestosStorageService.sincronizarDesdeSupabase()
  },

  async actualizarBorrador(
    presupuesto: PresupuestoLocal,
    pacienteId: string,
    planRevision: string,
    itemsDelPlan: ItemDesdePlan[],
  ): Promise<void> {
    const clinicaId = getClinicaActivaSync()
    if (!USE_SUPABASE || !supabase || !esUuidValido(clinicaId) ||
      !esUuidValido(pacienteId) || !esUuidValido(presupuesto.id) ||
      String(presupuesto.pacienteId) !== pacienteId || !presupuesto.origenPlan ||
      !['borrador', 'Borrador'].includes(presupuesto.estado || '') ||
      (presupuesto.montoAbonado || 0) !== 0 || !planRevision ||
      !Number.isInteger(presupuesto.version) || Number(presupuesto.version) < 1) {
      throw new Error('El presupuesto no es un borrador sincronizado de este paciente.')
    }

    const anteriores = itemPresupuestoSchema.array().safeParse(presupuesto.items || [])
    if (!anteriores.success) throw new Error('Los ítems del borrador necesitan revisión antes de sincronizar el plan.')
    const items = fusionarItemsDelPlan(anteriores.data, itemsDelPlan)
    const { error } = await supabase.rpc('sincronizar_borrador_desde_plan', {
      p_presupuesto_id: presupuesto.id,
      p_version_esperada: presupuesto.version,
      p_plan_revision: planRevision,
      p_items: items,
    })
    if (error) {
      throw new Error('No se pudo actualizar el borrador. Revisa la clínica, los importes o si el presupuesto cambió en otra sesión.')
    }
    await presupuestosStorageService.sincronizarDesdeSupabase()
  },
}
