import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'

export type SeveridadAlertaLaboratorio = 'critical' | 'operational' | 'informational'

export interface AlertaLaboratorio {
  id: string
  clinica_id: string
  alert_key: string
  tipo: string
  recurso_id: string | null
  laboratorio_id: string | null
  severity: SeveridadAlertaLaboratorio
  title: string
  message: string
  action_url: string
  action_payload: Record<string, unknown>
  activo: boolean
  generacion: number
  last_seen_at: string
}

export interface ConfiguracionAlertasLaboratorio {
  dias_antes_entrega: 1 | 3 | 5 | 7
  dias_prueba_inactiva: 5 | 7 | 10 | 14
  dias_pago_pendiente: 15 | 30 | 45 | 60
  ordenes_por_mes: 10 | 20 | 30 | 50
  tasa_reproceso_porcentaje: 5 | 10 | 15 | 20
}

export const CONFIGURACION_ALERTAS_LABORATORIO_DEFAULT: ConfiguracionAlertasLaboratorio = {
  dias_antes_entrega: 3,
  dias_prueba_inactiva: 7,
  dias_pago_pendiente: 30,
  ordenes_por_mes: 20,
  tasa_reproceso_porcentaje: 10,
}

const requireSupabase = () => {
  if (!USE_SUPABASE || !supabase) throw new Error('No hay conexión con el servidor de la clínica.')
  return supabase
}

export const laboratorioAlertasService = {
  async listarActivas(clinicaId: string): Promise<AlertaLaboratorio[]> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('alertas_laboratorio_estado')
      .select('id, clinica_id, alert_key, tipo, recurso_id, laboratorio_id, severity, title, message, action_url, action_payload, activo, generacion, last_seen_at')
      .eq('clinica_id', clinicaId)
      .eq('activo', true)
      .order('last_seen_at', { ascending: false })
    if (error) throw new Error('No se pudieron cargar las alertas de laboratorio.')
    return (data || []) as AlertaLaboratorio[]
  },

  async cargarConfiguracion(clinicaId: string): Promise<ConfiguracionAlertasLaboratorio> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('configuracion_alertas_laboratorio')
      .select('dias_antes_entrega, dias_prueba_inactiva, dias_pago_pendiente, ordenes_por_mes, tasa_reproceso_porcentaje')
      .eq('clinica_id', clinicaId)
      .maybeSingle()
    if (error) throw new Error('No se pudo cargar la configuración de alertas.')
    return data
      ? data as ConfiguracionAlertasLaboratorio
      : CONFIGURACION_ALERTAS_LABORATORIO_DEFAULT
  },

  async guardarConfiguracion(
    clinicaId: string,
    configuracion: ConfiguracionAlertasLaboratorio
  ): Promise<void> {
    const client = requireSupabase()
    const { error } = await client
      .from('configuracion_alertas_laboratorio')
      .upsert({ clinica_id: clinicaId, ...configuracion }, { onConflict: 'clinica_id' })
    if (error) throw new Error('No se pudo guardar la configuración de alertas.')
  },
}
