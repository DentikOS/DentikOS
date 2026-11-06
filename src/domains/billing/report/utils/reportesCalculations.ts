/**
 * Cálculos financieros, estadísticas de agenda y agregaciones para BI
 */

import { presupuestosStorageService } from '../../budget/services/presupuestosStorageService'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { resolverMonedaDocumento } from '../../../../shared/utils/formatoDocumento'

const log = createLogger('reportesCalculations')

export interface TopPrestacion {
  nombre: string
  cantidad: number
  montoTotal: number
  [key: string]: unknown
}

export interface EstadisticasAvanzadasResultado {
  totalPacientes: number
  totalRecaudado: number
  totalPresupuestado: number
  totalProcedimientos: number
  tasaConversionPresupuestos: number
  ticketPromedio: number
  topPrestaciones: TopPrestacion[]
  desgloseEspecialidad: Record<string, number>
  recaudacionPorMetodo: Record<string, number>
  [key: string]: unknown
}

export const calcularEstadisticasAvanzadas = (
  pacientes: Array<{ id: string | number; [key: string]: unknown }> = [],
  pagos: Array<{ estado?: string; monto?: number | string; metodoPago?: string; moneda?: string; [key: string]: unknown }> = [],
  presupuestos: Array<{ id?: string | number; pacienteId?: string | number; items?: Array<Record<string, unknown>>; moneda?: string; montoTotal?: number | string; estado?: string; [key: string]: unknown }> = [],
  _citas: unknown[] = [],
  monedaSeleccionada: string = 'CLP'
): EstadisticasAvanzadasResultado => {
  let totalRecaudado = 0
  let totalPresupuestado = 0
  let presupuestosAprobadosCount = 0

  // 1. Cálculos de Pagos y Recaudación
  const recaudacionPorMetodo: Record<string, number> = {}
  pagos.filter((p) => resolverMonedaDocumento(p.moneda) === resolverMonedaDocumento(monedaSeleccionada)).forEach((p) => {
    if (p.estado === 'Anulado') return
    const monto = parseFloat(String(p.monto)) || 0
    totalRecaudado += monto

    const metodo = p.metodoPago || 'Efectivo'
    recaudacionPorMetodo[metodo] = (recaudacionPorMetodo[metodo] || 0) + monto
  })

  // 2. Cálculos de Presupuestos y Conversión
  const presupuestosFiltrados = presupuestos.filter((p) => resolverMonedaDocumento(p.moneda) === resolverMonedaDocumento(monedaSeleccionada))
  presupuestosFiltrados.forEach((p) => {
    const total = parseFloat(String(p.montoTotal)) || 0
    totalPresupuestado += total
    if (p.estado === 'Aprobado' || p.estado === 'EnTratamiento') {
      presupuestosAprobadosCount++
    }
  })

  const tasaConversionPresupuestos =
    presupuestos.length > 0
      ? Math.round((presupuestosAprobadosCount / presupuestos.length) * 100)
      : 0

  // 3. Desglose de Tratamientos por Paciente (vía presupuestosStorageService, F2-07a)
  let totalProcedimientos = 0
  const rankingPrestaciones: Record<string, { cantidad: number; montoTotal: number }> = {}
  const desgloseEspecialidad: Record<string, number> = {}

  pacientes.forEach((p) => {
    try {
      const presupuestosPaciente = presupuestosFiltrados.filter((presupuesto) => String(presupuesto.pacienteId) === String(p.id))
      const itemsAnidados = presupuestosPaciente.flatMap((presupuesto) => Array.isArray(presupuesto.items) ? presupuesto.items : [])
      const itemsPaciente = presupuestosStorageService.obtenerItemsPorPaciente(p.id)
      const idsPresupuestos = new Set(presupuestosPaciente.map((presupuesto) => String(presupuesto.id)))
      const items = itemsAnidados.length > 0
        ? itemsAnidados
        : itemsPaciente.filter((item) => item.moneda
          ? resolverMonedaDocumento(item.moneda) === resolverMonedaDocumento(monedaSeleccionada)
          : resolverMonedaDocumento(monedaSeleccionada) === 'CLP' && (!item.presupuestoId || idsPresupuestos.has(String(item.presupuestoId))))
      if (Array.isArray(items) && items.length > 0) {
        items.forEach((it: { prestacion?: string; prestacionNombre?: string; nombrePrestacion?: string; nombre?: string; valor?: number | string; subtotal?: number | string; precioUnitario?: number | string; especialidad?: string }) => {
          totalProcedimientos++
          const nombre = it.nombrePrestacion || it.prestacionNombre || it.prestacion || it.nombre || 'Consulta General'
          const valor = parseFloat(String(it.subtotal ?? it.valor ?? it.precioUnitario ?? 0)) || 0
          const especialidad = it.especialidad || 'General'

          if (!rankingPrestaciones[nombre]) {
            rankingPrestaciones[nombre] = { cantidad: 0, montoTotal: 0 }
          }
          rankingPrestaciones[nombre].cantidad++
          rankingPrestaciones[nombre].montoTotal += valor

          desgloseEspecialidad[especialidad] =
            (desgloseEspecialidad[especialidad] || 0) + valor
        })
      }
    } catch (e) {
      log.error(e)
    }
  })

  const topPrestaciones: TopPrestacion[] = Object.entries(rankingPrestaciones)
    .map(([nombre, datos]) => ({ nombre, ...datos }))
    .sort((a, b) => b.montoTotal - a.montoTotal)
    .slice(0, 7)

  // 4. Indicadores Clave
  const ticketPromedio =
    pacientes.length > 0 ? Math.round(totalRecaudado / pacientes.length) : 0

  return {
    totalPacientes: pacientes.length,
    totalRecaudado,
    totalPresupuestado,
    totalProcedimientos,
    tasaConversionPresupuestos,
    ticketPromedio,
    topPrestaciones,
    desgloseEspecialidad,
    recaudacionPorMetodo
  }
}
