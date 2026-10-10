import type { Pago } from '../../../../domains/billing/payment'
import type { PresupuestoLocal } from '../../../../domains/billing/budget'

export const calcularMetricasFinanzas = (pagos: Pago[] = [], presupuestos: PresupuestoLocal[] = [], hoyIso: string) => {
  const recaudacionHoy = pagos
    .filter((p) => p.fecha === hoyIso && p.estado !== 'Anulado')
    .reduce((acc, curr) => acc + (parseFloat(String(curr.monto)) || 0), 0)

  let montoTotalCotizado = 0
  let montoTotalAceptado = 0
  let cantidadAceptados = 0

  presupuestos.forEach((p) => {
    const total = parseFloat(String(p.total)) || 0
    montoTotalCotizado += total
    if (p.estado === 'Aceptado' || p.estado === 'En Proceso' || p.estado === 'Finalizado') {
      montoTotalAceptado += total
      cantidadAceptados++
    }
  })

  const tasaConversionPresupuestos = presupuestos.length > 0 ? Math.round((cantidadAceptados / presupuestos.length) * 100) : 0
  const diaDelMes = new Date().getDate()
  const acumuladoMes = pagos.filter((p) => p.estado !== 'Anulado').reduce((acc, curr) => acc + (parseFloat(String(curr.monto)) || 0), 0)
  const proyeccionMensual = diaDelMes > 0 ? Math.round((acumuladoMes / diaDelMes) * 22) : recaudacionHoy * 22

  return { recaudacionHoy, montoTotalCotizado, montoTotalAceptado, tasaConversionPresupuestos, proyeccionMensual }
}
