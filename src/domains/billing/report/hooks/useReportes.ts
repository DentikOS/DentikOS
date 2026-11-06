import { useState, useMemo } from 'react'
import {
  reportesStorageService,
  type DatosConsolidadosBI
} from '../services/reportesStorageService'
import { calcularEstadisticasAvanzadas } from '../utils/reportesCalculations'
import type { Paciente } from '../../../../domains/clinical/patient/schemas/pacienteSchema'
import { clinicStorageService } from '../../../organization/clinic/services/clinicStorageService'
import { resolverMonedaDocumento, type MonedaDocumento } from '../../../../shared/utils/formatoDocumento'

export interface MetricasReportes {
  totalPacientes: number
  totalRecaudado: number
  totalPresupuestado: number
  totalProcedimientos: number
  tasaConversionPresupuestos: number
  ticketPromedio: number
  topPrestaciones: { nombre: string; cantidad: number; montoTotal: number; [key: string]: unknown }[]
  desgloseEspecialidad: Record<string, number>
  recaudacionPorMetodo: Record<string, number>
  [key: string]: unknown
}

export interface UseReportesReturn {
  periodoSeleccionado: string
  setPeriodoSeleccionado: React.Dispatch<React.SetStateAction<string>>
  metricas: MetricasReportes
  monedaSeleccionada: MonedaDocumento
  setMonedaSeleccionada: React.Dispatch<React.SetStateAction<MonedaDocumento>>
  monedasDisponibles: MonedaDocumento[]
}

export const useReportes = (
  pacientesProps: (Paciente | { id: string | number; [key: string]: unknown })[] = []
): UseReportesReturn => {
  const [periodoSeleccionado, setPeriodoSeleccionado] =
    useState<string>('este_mes')
  const [monedaSeleccionada, setMonedaSeleccionada] = useState<MonedaDocumento>(() =>
    resolverMonedaDocumento(clinicStorageService.obtenerClinica()?.moneda)
  )

  const datosConsolidados = useMemo<DatosConsolidadosBI>(() => {
    const loc = reportesStorageService.obtenerDatosConsolidados()
    return {
      pacientes:
        pacientesProps.length > 0
          ? (pacientesProps as Paciente[])
          : loc.pacientes,
      pagos: loc.pagos,
      presupuestos: loc.presupuestos,
      citas: loc.citas
    }
  }, [pacientesProps])

  const metricas = useMemo(() => {
    return calcularEstadisticasAvanzadas(
      datosConsolidados.pacientes,
      datosConsolidados.pagos,
      datosConsolidados.presupuestos,
      datosConsolidados.citas,
      monedaSeleccionada
    ) as MetricasReportes
  }, [datosConsolidados, monedaSeleccionada])

  const monedasDisponibles = useMemo(() => {
    const monedas = new Set<MonedaDocumento>([
      resolverMonedaDocumento(clinicStorageService.obtenerClinica()?.moneda),
      ...datosConsolidados.pagos.map((pago) => resolverMonedaDocumento(pago.moneda)),
      ...datosConsolidados.presupuestos.map((presupuesto) => resolverMonedaDocumento(presupuesto.moneda)),
    ])
    return [...monedas]
  }, [datosConsolidados])

  return {
    periodoSeleccionado,
    setPeriodoSeleccionado,
    metricas,
    monedaSeleccionada,
    setMonedaSeleccionada,
    monedasDisponibles,
  }
}
