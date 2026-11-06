export type SeveridadUrgencia = 'leve' | 'moderada' | 'severa'
export type EstadoUrgencia = 'en_atencion' | 'cerrada' | 'rechazada' | 'derivada'
export type EstadoColaUrgencia = 'en_espera' | 'en_atencion' | 'finalizada' | 'rechazada' | 'derivada'
export type EstadoSincronizacion = 'sincronizado' | 'pendiente' | 'requiere_revision'

export interface IngresoUrgencia {
  id: string
  clinica_id: string
  paciente_id: string
  estado_cola: EstadoColaUrgencia
  created_at: string
  estado_sincronizacion?: EstadoSincronizacion
  hora_local_pendiente?: string
}

export interface TriageUrgencia {
  id: string
  clinica_id: string
  severidad: SeveridadUrgencia
  presion_sistolica: number | null
  presion_diastolica: number | null
  frecuencia_cardiaca: number | null
  saturacion_oxigeno: number | null
  temperatura_c: number | null
  eva: number | null
  patologia_sospechada_id: string | null
  nota_triage: string | null
  version: number
  created_at: string
  updated_at: string
  estado_sincronizacion?: EstadoSincronizacion
}

export interface FichaUrgencia {
  id: string
  clinica_id: string
  folio: string
  patologia_id: string
  codigo_fonasa: string | null
  arancel_pactado_snapshot: number | null
  descripcion_convenio_snapshot: string | null
  previsiones_convenio_snapshot: string[]
  diagnostico_clinico: string
  diagnostico_cie10: string | null
  piezas_afectadas: string[]
  tratamiento_realizado: unknown[]
  requiere_derivacion: boolean
  centro_derivacion: string | null
  motivo_derivacion: string | null
  indicaciones_post: string | null
  control_programado: string | null
  profesional_id: string
  estado: EstadoUrgencia
  fecha_hora_atencion: string
  fecha_hora_fin: string | null
  version: number
  created_at: string
  updated_at: string
  estado_sincronizacion?: EstadoSincronizacion
}

export interface EventoUrgencia {
  id: string
  clinica_id: string
  ingreso_id: string | null
  configuracion_id: string | null
  actor_user_id: string
  evento_tipo: string
  datos: Record<string, unknown>
  created_at: string
  estado_sincronizacion?: EstadoSincronizacion
}

export interface ConfiguracionGesClinica {
  id: string
  clinica_id: string
  patologia_id: string
  codigo_fonasa: string | null
  descripcion_convenio: string | null
  arancel_pactado: number | null
  centro_costos: string | null
  previsiones_convenio: string[]
  version: number
  created_by?: string
  updated_by?: string
  created_at?: string
  updated_at: string
}

export interface SnapshotUrgenciasGes {
  ingresos: IngresoUrgencia[]
  triajes: TriageUrgencia[]
  fichas: FichaUrgencia[]
  eventos: EventoUrgencia[]
  configuraciones: ConfiguracionGesClinica[]
}
