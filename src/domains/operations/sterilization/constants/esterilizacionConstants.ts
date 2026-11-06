/** Tipos de visualización del módulo; los equipos y parámetros vienen de DentikOS. */

export interface ProgramaEsterilizacion {
  id: string
  nombre: string
  tempEsperada: number
  tiempoEsperado: number
  presionEsperada: number
}

export interface ResultadoBowieDick {
  id: string
  nombre: string
}

export interface CargaEsterilizacion {
  id: number | string
  lote: string
  equipo: string
  programa: string
  fecha: string
  hora: string
  temperatura: number | null
  presion: number | null
  tiempoMinutos: number | null
  responsable: string
  indicadorQuimico: string
  indicadorBiologico: string
  contenido: string
  estado: string
  cicloId?: string
  equipoId?: string
  puedeCancelar?: boolean
  puedeGestionar?: boolean
}

export interface PruebaBiologica {
  id: number | string
  loteAsociado: string
  equipo: string
  fechaIncubacion: string
  horaIncubacion: string
  marcaAmpolla: string
  horasRequeridas: number
  resultado: string
  responsableLectura: string
  observacion: string
}

export interface TestBowieDick {
  id: number | string
  fecha: string
  equipo: string
  resultado: string
  operador: string
  observacion: string
}

// Los equipos y protocolos se leen desde el inventario y la configuración de cada clínica.
export const EQUIPOS_AUTOCLAVE: readonly string[] = []

export const PROGRAMAS_ESTERILIZACION: readonly ProgramaEsterilizacion[] = []

export const INDICADORES_QUIMICOS: readonly string[] = [
  'Indicador externo tipo 1',
  'Indicador químico tipo 4',
  'Indicador con resultado rechazado'
]

export const INDICADORES_BIOLOGICOS: readonly string[] = [
  'Aprobado',
  'Rechazado',
  'Pendiente de lectura'
]

export const RESULTADOS_BOWIE_DICK: readonly ResultadoBowieDick[] = [
  { id: 'aprobado', nombre: 'Aprobado' },
  { id: 'rechazado', nombre: 'Rechazado' }
]

export const CARGAS_DEFAULT: readonly CargaEsterilizacion[] = []

export const PRUEBAS_BIOLOGICAS_DEFAULT: readonly PruebaBiologica[] = []

export const TEST_BOWIE_DICK_DEFAULT: readonly TestBowieDick[] = []
