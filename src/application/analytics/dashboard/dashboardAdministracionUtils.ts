import type { DatosClinicaConfig } from '../../../domains/organization/clinic/services/clinicStorageService'
import type { Sede } from '../../../domains/organization/clinic/schemas/sedeSchema'
import type { BoxClinico } from '../../../domains/organization/clinic/schemas/boxSchema'
import type { Prestacion } from '../../../domains/organization/prestations/schemas/prestacionSchema'
import type { Paciente } from '../../../domains/clinical/patient/schemas/pacienteSchema'
import type { Cita } from '../../../domains/operations/agenda/schemas/citaSchema'
import type { PresupuestoLocal } from '../../../domains/billing/budget/services/presupuestosOfflineQueueService'

export interface ChecklistAdministracionItem {
  id: string
  label: string
  completado: boolean
  tab: 'practica' | 'sedes' | 'equipo' | 'prestaciones'
  detalle?: string
}

export interface ResumenDashboardAdministracion {
  pacientesActivos: number
  presupuestosAprobados: number
  citasProximaSemana: number
  presupuestosPendientes: number
  prestacionesSinPrecio: number
  checklist: ChecklistAdministracionItem[]
  progresoPorcentaje: number
}

const normalizarEstado = (estado?: string): string => (estado || '').trim().toLocaleLowerCase('es-CL')

const desplazarFechaISO = (fechaISO: string, dias: number): string => {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, dia, 12)
  fecha.setDate(fecha.getDate() + dias)
  return [fecha.getFullYear(), String(fecha.getMonth() + 1).padStart(2, '0'), String(fecha.getDate()).padStart(2, '0')].join('-')
}

export const crearResumenDashboardAdministracion = (entrada: {
  clinica: DatosClinicaConfig
  sedes: Sede[]
  boxes: BoxClinico[]
  miembrosActivos: number
  prestaciones: Prestacion[]
  pacientes: Paciente[]
  citas: Cita[]
  presupuestos: PresupuestoLocal[]
  hoy: string
}): ResumenDashboardAdministracion => {
  const { clinica, sedes, boxes, miembrosActivos, prestaciones, pacientes, citas, presupuestos, hoy } = entrada
  const finSemana = desplazarFechaISO(hoy, 6)
  const prestacionesSinPrecio = prestaciones.filter((prestacion) =>
    Number(prestacion.precioParticular) <= 0 || !Number.isFinite(Number(prestacion.precioParticular))
  ).length
  const sedesActivas = sedes.filter((sede) => sede.estado === 'activa').length
  const boxesActivos = boxes.filter((box) => box.estado === 'activo').length
  const pacientesActivos = pacientes.filter((paciente) =>
    !['inactivo', 'bloqueado', 'desactivado'].includes(normalizarEstado(paciente.estado || undefined))
  ).length
  const estadosAprobados = new Set(['aprobado', 'en tratamiento', 'entratamiento', 'en-curso'])
  const estadosPendientes = new Set(['borrador', 'pendiente', 'emitido', 'enviado'])

  const checklist: ChecklistAdministracionItem[] = [
    {
      id: 'datos-clinica', label: 'Datos legales y de contacto', tab: 'practica',
      completado: Boolean(clinica.nombreClinica?.trim() && clinica.rutClinica?.trim() && clinica.giroComercial?.trim()
        && clinica.direccion?.trim() && clinica.comuna?.trim() && clinica.region?.trim()
        && clinica.telefono?.trim() && clinica.emailContacto?.trim()),
    },
    { id: 'sucursales', label: 'Sucursal activa', tab: 'sedes', completado: sedesActivas > 0 },
    { id: 'boxes', label: 'Box operativo', tab: 'sedes', completado: boxesActivos > 0 },
    { id: 'equipo', label: 'Equipo de la clínica', tab: 'equipo', completado: miembrosActivos > 0 },
    {
      id: 'prestaciones', label: 'Prestaciones con precio', tab: 'prestaciones',
      completado: prestaciones.length > 0 && prestacionesSinPrecio === 0,
      detalle: prestacionesSinPrecio > 0 ? `${prestacionesSinPrecio} sin precio particular` : undefined,
    },
    { id: 'membrete', label: 'Logo para documentos', tab: 'practica', completado: Boolean(clinica.logoUrl?.trim()) },
  ]

  return {
    pacientesActivos,
    presupuestosAprobados: presupuestos.filter((p) => estadosAprobados.has(normalizarEstado(p.estado))).length,
    citasProximaSemana: citas.filter((cita) => Boolean(cita.fecha && cita.fecha >= hoy && cita.fecha <= finSemana)
      && normalizarEstado(cita.estado) !== 'cancelada').length,
    presupuestosPendientes: presupuestos.filter((p) => estadosPendientes.has(normalizarEstado(p.estado))).length,
    prestacionesSinPrecio,
    checklist,
    progresoPorcentaje: Math.round((checklist.filter((item) => item.completado).length / checklist.length) * 100),
  }
}
