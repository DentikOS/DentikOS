import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import type { PresupuestoLocal } from './presupuestosStorageService'

export interface VersionPresupuesto {
  version: number
  fecha: string
  usuario: string
  tipoModificacion: string
  motivo: string
  motivoOrigen?: 'usuario' | 'sistema'
  totalAnterior: number
  totalNuevo: number
  hashSha256: string
  cambios?: string[]
}

interface VersionRow {
  presupuesto_id: string
  revision: number
  fecha: string
  actor_user_id: string
  tipo: string
  motivo: string
  motivo_origen: 'usuario' | 'sistema'
  hash_sha256: string
  anterior: Record<string, unknown> | null
  nuevo: Record<string, unknown>
}

export const presupuestoVersionesService = {
  async listar(presupuesto: PresupuestoLocal, presupuestosPaciente: PresupuestoLocal[]): Promise<VersionPresupuesto[]> {
    const clinicaId = getClinicaActivaSync()
    const pacienteId = String(presupuesto.pacienteId || '')
    if (!USE_SUPABASE || !supabase || !esUuidValido(clinicaId) ||
      !esUuidValido(pacienteId) || !esUuidValido(presupuesto.id)) {
      throw new Error('El historial requiere un presupuesto sincronizado de la clínica activa.')
    }
    const ids = presupuestosPaciente.filter((p) => String(p.pacienteId) === pacienteId &&
      esUuidValido(p.id) && (presupuesto.versionGrupoId
        ? p.versionGrupoId === presupuesto.versionGrupoId : String(p.id) === String(presupuesto.id)))
      .map((p) => String(p.id))
    if (!ids.includes(String(presupuesto.id))) ids.push(String(presupuesto.id))
    const { data, error } = await supabase.from('presupuesto_versiones')
      .select('presupuesto_id,revision,fecha,actor_user_id,tipo,motivo,motivo_origen,hash_sha256,anterior,nuevo')
      .eq('clinica_id', clinicaId).eq('paciente_id', pacienteId).in('presupuesto_id', ids)
      .order('fecha', { ascending: true })
    if (error) throw new Error('No se pudo consultar el historial del presupuesto.')
    return ((data || []) as VersionRow[]).map((row, indice) => {
      const anterior = row.anterior || {}
      const nuevo = row.nuevo || {}
      const totalAnterior = Number(anterior.monto_total || 0)
      const totalNuevo = Number(nuevo.monto_total || 0)
      const cambios = row.tipo === 'creacion' ? ['Creación inicial'] : [
        totalAnterior !== totalNuevo ? `Total: $${totalAnterior.toLocaleString('es-CL')} → $${totalNuevo.toLocaleString('es-CL')}` : 'Importes o condiciones actualizados',
      ]
      return { version: indice + 1, fecha: row.fecha, usuario: row.actor_user_id,
        tipoModificacion: row.tipo === 'creacion' ? 'Creación' : 'Cambio financiero',
        motivo: row.motivo, motivoOrigen: row.motivo_origen,
        totalAnterior, totalNuevo, hashSha256: row.hash_sha256, cambios }
    })
  },
}
