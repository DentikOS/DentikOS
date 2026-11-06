import type {
  CategoriaLaboratorio,
  EtapaLaboratorioId
} from '../constants/laboratorioConstants'
import type { NuevaOrdenLaboratorioInput } from './laboratorioCloudService'

export interface LaboratorioImportPacienteRef {
  id: string
  nombre?: string
  rut?: string | null
}

export interface LaboratorioImportLabRef {
  id: string
  nombre: string
}

export interface LaboratorioImportTipoRef {
  id: string
  nombre: string
  categoria: CategoriaLaboratorio
}

export interface OrdenLaboratorioLegacy extends Record<string, unknown> {
  id: string | number
  codigoOrden?: string
  pacienteId?: string | number | null
  pacienteNombre?: string
  pacienteRut?: string | null
  laboratorioId?: string | number | null
  laboratorioNombre?: string
  tipoTrabajo?: string
  piezaDientaria?: string
  colorGuia?: string
  fechaEnvio?: string
  fechaEntregaPrometida?: string
  etapa?: string
  indicacionesTecnicas?: string
  observaciones?: string
  costoLaboratorio?: number | string
}

export interface LaboratorioImportReferences {
  pacientes: LaboratorioImportPacienteRef[]
  laboratorios: LaboratorioImportLabRef[]
  tiposTrabajo: LaboratorioImportTipoRef[]
}

export interface OrdenLaboratorioImportable {
  sourceId: string
  sourceCode: string
  input: Omit<NuevaOrdenLaboratorioInput, 'idempotencyKey'>
  etapaObjetivo: EtapaLaboratorioId
  costoLocalPendiente: boolean
}

export interface OrdenLaboratorioImportReview {
  sourceId: string
  sourceCode: string
  motivos: string[]
}

export interface LaboratorioImportPreview {
  importables: OrdenLaboratorioImportable[]
  pendientesRevision: OrdenLaboratorioImportReview[]
  omitidosDemo: number
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const normalizarNombre = (value: unknown): string => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-CL')

export const normalizarEtapaLaboratorioLegacy = (etapa?: string): EtapaLaboratorioId => {
  const normalizada = normalizarNombre(etapa)
  if (normalizada === 'enviado' || normalizada === 'enviada') return 'enviada'
  if (normalizada === 'pruebametal' || normalizada === 'pruebabizcocho' || normalizada === 'prueba') return 'prueba'
  if (normalizada === 'recibidolisto' || normalizada === 'instalado' || normalizada === 'entrega') return 'entrega'
  if (normalizada === 'repeticion' || normalizada === 'ajustes') return 'ajustes'
  return 'solicitud'
}

const esDemoHistorica = (order: OrdenLaboratorioLegacy): boolean => (
  String(order.id) === '101'
  && order.codigoOrden === 'LAB-2026-101'
  && String(order.pacienteId) === '1'
  && String(order.laboratorioId) === '1'
)

export const laboratorioImportService = {
  previsualizar(
    ordenes: OrdenLaboratorioLegacy[],
    refs: LaboratorioImportReferences
  ): LaboratorioImportPreview {
    const preview: LaboratorioImportPreview = { importables: [], pendientesRevision: [], omitidosDemo: 0 }
    const pacientes = new Map(refs.pacientes.map(item => [item.id, item]))
    const laboratoriosPorId = new Map(refs.laboratorios.map(item => [item.id, item]))
    const laboratoriosPorNombre = new Map(refs.laboratorios.map(item => [normalizarNombre(item.nombre), item]))
    const tiposPorNombre = new Map(refs.tiposTrabajo.map(item => [normalizarNombre(item.nombre), item]))

    for (const legacy of ordenes) {
      if (esDemoHistorica(legacy)) {
        preview.omitidosDemo += 1
        continue
      }

      const pacienteId = String(legacy.pacienteId || '')
      const paciente = UUID_PATTERN.test(pacienteId) ? pacientes.get(pacienteId) : undefined
      const legacyLabId = String(legacy.laboratorioId || '')
      const laboratorio = (UUID_PATTERN.test(legacyLabId) ? laboratoriosPorId.get(legacyLabId) : undefined)
        || laboratoriosPorNombre.get(normalizarNombre(legacy.laboratorioNombre))
      const tipoTrabajo = tiposPorNombre.get(normalizarNombre(legacy.tipoTrabajo))
      const motivos: string[] = []
      if (!paciente) motivos.push('paciente_no_resuelto')
      if (legacy.laboratorioNombre && !laboratorio) motivos.push('laboratorio_no_resuelto')
      if (!tipoTrabajo) motivos.push('tipo_trabajo_no_resuelto')

      const sourceId = String(legacy.id)
      const sourceCode = String(legacy.codigoOrden || sourceId)
      if (motivos.length > 0) {
        preview.pendientesRevision.push({ sourceId, sourceCode, motivos })
        continue
      }

      preview.importables.push({
        sourceId,
        sourceCode,
        etapaObjetivo: normalizarEtapaLaboratorioLegacy(legacy.etapa),
        costoLocalPendiente: legacy.costoLaboratorio !== undefined && legacy.costoLaboratorio !== null,
        input: {
          pacienteId,
          laboratorioId: laboratorio?.id || null,
          tipoTrabajoId: tipoTrabajo!.id,
          piezaDentaria: String(legacy.piezaDientaria || '') || null,
          colorGuia: String(legacy.colorGuia || '') || null,
          indicacionesTecnicas: String(legacy.indicacionesTecnicas || '') || null,
          observaciones: String(legacy.observaciones || '') || null,
          fechaSolicitud: String(legacy.fechaEnvio || '').slice(0, 10) || undefined,
          fechaEstimadaEntrega: String(legacy.fechaEntregaPrometida || '').slice(0, 10) || null
        }
      })
    }
    return preview
  }
}
