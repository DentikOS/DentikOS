/**
 * Application Service: dashboardQueries (Fase 4A-2)
 *
 * Centraliza las consultas de lectura que el Dashboard necesita de múltiples dominios
 * (Agenda, Pagos, Presupuestos, Pacientes).
 * Consume EXCLUSIVAMENTE las APIs públicas de cada dominio.
 */
import { agendaStorageService, type Cita } from '../../domains/operations/agenda'
import {
  pagosStorageService,
  obtenerAbonosPorPaciente,
  type Pago,
} from '../../domains/billing/payment'
import {
  presupuestosStorageService,
  type PresupuestoLocal,
} from '../../domains/billing/budget'
import {
  pacientesStorageService,
  type Paciente,
} from '../../domains/clinical/patient'
import { obtenerFechaLocalISO } from '../../shared/utils/dateUtils'
import { obtenerAlertasOperativas } from '../../shared/utils/alertasOperativas'

export interface ResumenConsultasDashboard {
  fecha: string
  citasHoy: Cita[]
  enEspera: Cita[]
  enAtencion: Cita[]
  ingresosHoy: number
  totalPacientes: number
  alertasOperativas: unknown[]
}

/**
 * Obtiene las citas programadas para una fecha dada (por defecto hoy).
 */
export const obtenerCitasDelDia = (fecha?: string): Cita[] => {
  const fechaFiltro = fecha || obtenerFechaLocalISO()
  try {
    const citas = agendaStorageService.obtenerCitas([])
    if (!Array.isArray(citas)) return []
    return citas.filter((c) => c.fecha === fechaFiltro)
  } catch {
    return []
  }
}

/**
 * Obtiene las citas de pacientes actualmente en sala de espera.
 */
export const obtenerPacientesEnEspera = (fecha?: string): Cita[] => {
  const citasHoy = obtenerCitasDelDia(fecha)
  return citasHoy.filter(
    (c) => c.estado === 'EnEspera' || c.estado === 'En Espera'
  )
}

/**
 * Obtiene las citas de pacientes actualmente en atención clínica.
 */
export const obtenerPacientesEnAtencion = (fecha?: string): Cita[] => {
  const citasHoy = obtenerCitasDelDia(fecha)
  return citasHoy.filter(
    (c) =>
      c.estado === 'EnAtencion' ||
      c.estado === 'En Atención' ||
      c.estado === 'Atendiendo'
  )
}

/**
 * Obtiene todos los pagos registrados (pagos directos + abonos de pacientes).
 */
export const obtenerTodosLosPagosDashboard = (
  pacientes: { id: string | number }[] = []
): Pago[] => {
  try {
    const pagosDirectos = pagosStorageService.obtenerPagos([])
    const pagosLista: Pago[] = Array.isArray(pagosDirectos) ? [...pagosDirectos] : []

    if (Array.isArray(pacientes) && pacientes.length > 0) {
      pacientes.forEach((p) => {
        const abonosPac = obtenerAbonosPorPaciente(p.id)
        if (Array.isArray(abonosPac)) {
          abonosPac.forEach((a) => pagosLista.push(a as unknown as Pago))
        }
      })
    }

    return pagosLista
  } catch {
    return []
  }
}

/**
 * Calcula los ingresos totales recaudados en una fecha dada.
 */
export const obtenerIngresosDelDia = (
  fecha?: string,
  pacientes: { id: string | number }[] = []
): number => {
  const fechaFiltro = fecha || obtenerFechaLocalISO()
  const todosLosPagos = obtenerTodosLosPagosDashboard(pacientes)

  return todosLosPagos
    .filter((p) => p.fecha === fechaFiltro && p.estado !== 'Anulado')
    .reduce((acc, curr) => acc + (parseFloat(String(curr.monto)) || 0), 0)
}

/**
 * Obtiene la lista completa de presupuestos emitidos.
 */
export const obtenerPresupuestosDashboard = (): PresupuestoLocal[] => {
  try {
    const presupuestos = presupuestosStorageService.obtenerPresupuestos([])
    return Array.isArray(presupuestos) ? presupuestos : []
  } catch {
    return []
  }
}

/**
 * Obtiene las alertas operativas a partir de citas, pagos y presupuestos actuales.
 */
export const obtenerAlertasOperativasDashboard = (
  citas?: Cita[],
  pagos?: Pago[],
  presupuestos?: PresupuestoLocal[]
): unknown[] => {
  try {
    const c = citas ?? agendaStorageService.obtenerCitas([])
    const p = pagos ?? pagosStorageService.obtenerPagos([])
    const pr = presupuestos ?? presupuestosStorageService.obtenerPresupuestos([])
    return obtenerAlertasOperativas(
      Array.isArray(c) ? c : [],
      Array.isArray(p) ? p : [],
      Array.isArray(pr) ? pr : []
    ) || []
  } catch {
    return []
  }
}

/**
 * Centraliza el resumen completo de queries que el Dashboard necesita.
 */
export const obtenerResumenConsultasDashboard = (
  fecha?: string,
  listaPacientes?: Paciente[]
): ResumenConsultasDashboard => {
  const fechaFiltro = fecha || obtenerFechaLocalISO()
  let pacientes = listaPacientes

  if (!pacientes) {
    try {
      const p = pacientesStorageService.obtenerPacientes([])
      pacientes = Array.isArray(p) ? p : []
    } catch {
      pacientes = []
    }
  }

  const citasHoy = obtenerCitasDelDia(fechaFiltro)
  const enEspera = obtenerPacientesEnEspera(fechaFiltro)
  const enAtencion = obtenerPacientesEnAtencion(fechaFiltro)
  const ingresosHoy = obtenerIngresosDelDia(fechaFiltro, pacientes)
  const alertasOperativas = obtenerAlertasOperativasDashboard(citasHoy)

  return {
    fecha: fechaFiltro,
    citasHoy,
    enEspera,
    enAtencion,
    ingresosHoy,
    totalPacientes: pacientes.length,
    alertasOperativas,
  }
}

/**
 * Obtiene métricas de pagos para el widget PagosPendientes del Dashboard.
 * Retorna: porCobrarHoy, pagosVencidos, recaudadoHoy
 */
export const obtenerMetricasPagosDashboard = (pacientes: Paciente[] = []) => {
  try {
    const hoy = obtenerFechaLocalISO()
    const todosLosPagos = obtenerTodosLosPagosDashboard(pacientes)

    // Pagos de hoy
    const pagosHoy = todosLosPagos.filter((p) => p.fecha === hoy)
    const recaudadoHoy = pagosHoy
      .filter((p) => p.estado === 'pagado' || p.estado === 'completado')
      .reduce((sum, p) => sum + (Number(p.monto) || 0), 0)

    // Pagos vencidos (fecha < hoy y estado != pagado)
    const pagosVencidos = todosLosPagos
      .filter((p) => Boolean(p.fecha && p.fecha < hoy) && p.estado !== 'pagado' && p.estado !== 'completado')
      .reduce((sum, p) => sum + (Number(p.monto) || 0), 0)

    // Por cobrar hoy (pagos de hoy pendientes)
    const porCobrarHoy = pagosHoy
      .filter((p) => p.estado !== 'pagado' && p.estado !== 'completado')
      .reduce((sum, p) => sum + (Number(p.monto) || 0), 0)

    return {
      porCobrarHoy,
      pagosVencidos,
      recaudadoHoy,
    }
  } catch (e) {
    console.error('Error obteniendo métricas de pagos:', e)
    return {
      porCobrarHoy: 0,
      pagosVencidos: 0,
      recaudadoHoy: 0,
    }
  }
}

/**
 * Obtiene alertas clínicas de pacientes con citas hoy.
 * Retorna alergias, contraindicaciones y precauciones.
 */
export const obtenerAlertasClinicasDashboard = (pacientes: Paciente[] = []): Array<{
  id: string | number
  pacienteId: string | number
  pacienteNombre: string
  tipo: 'alergia' | 'contraindicacion' | 'precaucion'
  mensaje: string
  severidad: 'critica' | 'precaucion'
}> => {
  try {
    const hoy = obtenerFechaLocalISO()
    const citasHoy = obtenerCitasDelDia(hoy)

    const alertas: Array<{
      id: string | number
      pacienteId: string | number
      pacienteNombre: string
      tipo: 'alergia' | 'contraindicacion' | 'precaucion'
      mensaje: string
      severidad: 'critica' | 'precaucion'
    }> = []

    citasHoy.forEach((cita) => {
      const paciente = pacientes.find((p) => String(p.id) === String(cita.pacienteId))
      if (!paciente) return

      // Alergias (críticas)
      const alergiasStr = Array.isArray(paciente.alergias)
        ? paciente.alergias.join(', ')
        : (typeof paciente.alergias === 'string' ? paciente.alergias : '')

      if (alergiasStr && alergiasStr.trim()) {
        alertas.push({
          id: `alergia-${paciente.id}`,
          pacienteId: paciente.id,
          pacienteNombre: paciente.nombre,
          tipo: 'alergia',
          mensaje: alergiasStr,
          severidad: 'critica'
        })
      }

      // Anticoagulantes (críticas)
      const anticoagulantes = (paciente as unknown as { anticoagulantes?: string }).anticoagulantes
      if (anticoagulantes && String(anticoagulantes).trim()) {
        alertas.push({
          id: `anticoagulante-${paciente.id}`,
          pacienteId: paciente.id,
          pacienteNombre: paciente.nombre,
          tipo: 'contraindicacion',
          mensaje: `Anticoagulantes: ${anticoagulantes}`,
          severidad: 'critica'
        })
      }
    })

    return alertas
  } catch (e) {
    console.error('Error obteniendo alertas clínicas:', e)
    return []
  }
}


