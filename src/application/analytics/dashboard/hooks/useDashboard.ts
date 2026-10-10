import { useState, useEffect, useMemo, useCallback } from 'react'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import { calcularMetricasAgenda, calcularTendenciasCitas } from '../utils/agendaCalculations'
import { calcularMetricasFinanzas } from '../utils/finanzasCalculations'
import { calcularMetricasClinicas } from '../utils/clinicasCalculations'
import { agendaStorageService } from '../../../../domains/operations/agenda'
import {
  obtenerTodosLosPagosDashboard,
  obtenerPresupuestosDashboard,
} from '../../dashboardQueries'
import { createLogger } from '../../../../infrastructure/logging/logger'
import type { Paciente } from '../../../../domains/clinical/patient/schemas/pacienteSchema'
import type { Cita } from '../../../../domains/operations/agenda/schemas/citaSchema'
import type { Pago } from '../../../../domains/billing/payment'
import type { PresupuestoLocal } from '../../../../domains/billing/budget'

const log = createLogger('useDashboard')

export interface ResumenJornada {
  totalPacientes: number
  citasHoyCount: number
  recaudacionHoy: number
  citasHoy: Cita[]
  enEspera: Cita[]
  enAtencion: Cita[]
  finalizadas: Cita[]
  tasaOcupacionAgenda: number
  montoTotalCotizado: number
  montoTotalAceptado: number
  tasaConversionPresupuestos: number
  proyeccionMensual: number
}

export interface TendenciaCita {
  fecha: string
  citas: number
}

export interface MetricasAvanzadasDashboard {
  tendenciaCitas7Dias: TendenciaCita[]
  tendenciaCitas30Dias: TendenciaCita[]
  alertas: unknown
  tareas: unknown
}

export interface UseDashboardReturn {
  resumen: ResumenJornada
  metricasAvanzadas: MetricasAvanzadasDashboard
  refrescar: () => void
}

export const useDashboard = (
  pacientes: (Paciente | { id: string | number; [key: string]: unknown })[] = []
): UseDashboardReturn => {
  const [citas, setCitas] = useState<Cita[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [presupuestos, setPresupuestos] = useState<PresupuestoLocal[]>([])
  const [evoluciones] = useState<unknown[]>([])
  const [recetas] = useState<unknown[]>([])
  const [certificados] = useState<unknown[]>([])

  const cargarDatos = useCallback(() => {
    try {
      const citasStorage = agendaStorageService.obtenerCitas([])
      const todosLosPagos = obtenerTodosLosPagosDashboard(pacientes)
      const presupuestosStorage = obtenerPresupuestosDashboard()

      setCitas(Array.isArray(citasStorage) ? citasStorage : [])
      setPagos(todosLosPagos)
      setPresupuestos(presupuestosStorage)
    } catch (e) {
      log.error('Error al cargar datos en Dashboard:', e)
    }
  }, [pacientes])

  useEffect(() => {
    cargarDatos()

    window.addEventListener('storage', cargarDatos)
    window.addEventListener('arancel_actualizado', cargarDatos)
    return () => {
      window.removeEventListener('storage', cargarDatos)
      window.removeEventListener('arancel_actualizado', cargarDatos)
    }
  }, [cargarDatos])

  const resumen = useMemo(() => {
    const hoyIso = obtenerFechaLocalISO()
    const agenda = calcularMetricasAgenda(citas, hoyIso)
    const finanzas = calcularMetricasFinanzas(pagos, presupuestos, hoyIso)
    return {
      totalPacientes: pacientes.length,
      citasHoyCount: agenda.citasHoy.length,
      ...agenda,
      ...finanzas
    } as ResumenJornada
  }, [pacientes, citas, pagos, presupuestos])

  const metricasAvanzadas = useMemo(() => {
    const tendenciaCitas7Dias = calcularTendenciasCitas(citas, 7)
    const tendenciaCitas30Dias = calcularTendenciasCitas(citas, 30)
    const { alertas, tareas } = calcularMetricasClinicas(
      citas,
      pagos,
      presupuestos,
      evoluciones,
      recetas,
      certificados
    )
    return {
      tendenciaCitas7Dias,
      tendenciaCitas30Dias,
      alertas,
      tareas
    } as MetricasAvanzadasDashboard
  }, [citas, pagos, presupuestos, evoluciones, recetas, certificados])

  return {
    resumen,
    metricasAvanzadas,
    refrescar: cargarDatos
  }
}
