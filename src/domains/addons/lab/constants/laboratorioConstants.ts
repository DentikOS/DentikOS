/**
 * Constantes y Parámetros Sugeridos para el Módulo de Laboratorio
 */

export interface EtapaLaboratorio {
  id: EtapaLaboratorioId
  nombre: string
  colorBg: string
  colorText: string
  colorBorder: string
}

export type EtapaLaboratorioId =
  | 'solicitud'
  | 'enviada'
  | 'diseno'
  | 'fabricacion'
  | 'prueba'
  | 'ajustes'
  | 'entrega'

export type CategoriaLaboratorio =
  | 'protesis_fija'
  | 'protesis_removible'
  | 'implantoprotesis'
  | 'ortodoncia'
  | 'ferulas_protectores'
  | 'provisionales'
  | 'reparaciones'

export interface TarifaLaboratorio {
  trabajo: string
  precio: number
}

export interface LaboratorioBase {
  id: number | string
  nombre: string
  tipo?: 'externo' | 'interno' | 'digital'
  rut?: string
  contacto?: string
  telefono: string
  email: string
  direccion: string
  representante?: string
  tecnicoResponsable?: string
  horarioRetiroEntrega?: string
  especialidades?: string[]
  estado?: 'activo' | 'inactivo'
  tarifas?: readonly TarifaLaboratorio[]
}

export interface OrdenLaboratorio {
  id: number | string
  codigoOrden: string
  pacienteId: number | string
  pacienteNombre: string
  pacienteRut: string
  laboratorioId: number | string | null
  laboratorioNombre: string
  tipoTrabajo: string
  tipoTrabajoId?: string
  categoria?: CategoriaLaboratorio
  piezaDientaria: string
  colorGuia: string
  fechaEnvio: string
  fechaEntregaPrometida: string
  etapa: EtapaLaboratorioId
  version?: number
  updatedAt?: string
  plantillaId?: string | null
  plantillaSnapshot?: Record<string, unknown>
  costoLaboratorio?: number | null
  estadoPagoLab?: string
  indicacionesTecnicas: string
  observaciones?: string
  responsableId?: string | null
  solicitudLimitada?: boolean
  garantiaId?: string | null
  esReposicion?: boolean
  historial?: Array<{
    etapa: EtapaLaboratorioId
    etapaAnterior: EtapaLaboratorioId | null
    actorId: string
    registradoEn: string
    notas: string | null
  }>
}

export const ETAPAS_LABORATORIO: readonly EtapaLaboratorio[] = [
  { id: 'solicitud', nombre: 'Solicitud', colorBg: 'bg-slate-50', colorText: 'text-slate-800', colorBorder: 'border-slate-300' },
  { id: 'enviada', nombre: 'Enviada', colorBg: 'bg-blue-50', colorText: 'text-blue-800', colorBorder: 'border-blue-300' },
  { id: 'diseno', nombre: 'Diseño', colorBg: 'bg-violet-50', colorText: 'text-violet-800', colorBorder: 'border-violet-300' },
  { id: 'fabricacion', nombre: 'Fabricación', colorBg: 'bg-amber-50', colorText: 'text-amber-800', colorBorder: 'border-amber-300' },
  { id: 'prueba', nombre: 'Prueba', colorBg: 'bg-cyan-50', colorText: 'text-cyan-800', colorBorder: 'border-cyan-300' },
  { id: 'ajustes', nombre: 'Ajustes', colorBg: 'bg-orange-50', colorText: 'text-orange-800', colorBorder: 'border-orange-300' },
  { id: 'entrega', nombre: 'Entrega', colorBg: 'bg-emerald-50', colorText: 'text-emerald-800', colorBorder: 'border-emerald-300' }
]

export const CATEGORIAS_LABORATORIO: readonly {
  id: CategoriaLaboratorio
  nombre: string
  subtipos: readonly string[]
}[] = [
  { id: 'protesis_fija', nombre: 'Prótesis fija', subtipos: ['Corona', 'Puente', 'Carilla', 'Incrustación'] },
  { id: 'protesis_removible', nombre: 'Prótesis removible', subtipos: ['Total', 'Parcial acrílica', 'Parcial metálica'] },
  { id: 'implantoprotesis', nombre: 'Implantoprótesis', subtipos: ['Corona sobre implante', 'Prótesis híbrida', 'Estructura'] },
  { id: 'ortodoncia', nombre: 'Ortodoncia', subtipos: ['Aparato removible', 'Retenedor', 'Mantenedor de espacio'] },
  { id: 'ferulas_protectores', nombre: 'Férulas y protectores', subtipos: ['Férula oclusal', 'Protector deportivo'] },
  { id: 'provisionales', nombre: 'Provisionales', subtipos: ['Corona provisional', 'Puente provisional'] },
  { id: 'reparaciones', nombre: 'Reparaciones', subtipos: ['Reparación de prótesis', 'Agregado de diente'] }
]

// Sugerencias para autocompletado (el usuario puede escribir cualquier otra cosa)
export const TIPOS_TRABAJO_SUGERIDOS: readonly string[] = [
  'Corona de Zirconio Monolítico',
  'Corona de Porcelana sobre Metal (PFM)',
  'Carilla Estética de Disilicato de Litio (E-Max)',
  'Carilla Feldspática Artesanal',
  'Incrustación Estética (Overlay / Inlay)',
  'Prótesis Total Removible (Acrílico)',
  'Prótesis Parcial Removible (Metálica / Deflex / Valplast)',
  'Plano de Relajación Miorrelajante Impreso 3D',
  'Aparato de Ortodoncia / Mantenedor de Espacio',
  'Estructura / Implante (Silla Multi-Unit)',
  'Prótesis Híbrida sobre Implantes',
  'Reparación de Prótesis / Agregado de Diente'
]
