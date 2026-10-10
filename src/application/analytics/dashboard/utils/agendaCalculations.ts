import type { Cita } from '../../../../domains/operations/agenda/schemas/citaSchema'
import type { TendenciaCita } from '../hooks/useDashboard'

export const calcularMetricasAgenda = (citas: Cita[] = [], hoyIso: string) => {
  const citasHoy = citas.filter((c) => c.fecha === hoyIso)
  const enEspera = citasHoy.filter((c) => c.estado === 'EnEspera' || c.estado === 'En Espera')
  const enAtencion = citasHoy.filter((c) => c.estado === 'EnAtencion' || c.estado === 'En Atención' || c.estado === 'Atendiendo')
  const finalizadas = citasHoy.filter((c) => c.estado === 'Completado' || c.estado === 'Atendido' || c.estado === 'Realizado')
  const capacidadDiaria = 16
  const tasaOcupacionAgenda = capacidadDiaria > 0 ? Math.min(100, Math.round((citasHoy.length / capacidadDiaria) * 100)) : 0

  return { citasHoy, enEspera, enAtencion, finalizadas, tasaOcupacionAgenda }
}

export const calcularTendenciasCitas = (citas: Cita[] = [], dias: number): TendenciaCita[] => {
  const tendencias: TendenciaCita[] = []
  const hoy = new Date()
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = new Date(hoy)
    fecha.setDate(fecha.getDate() - i)
    const fechaIso = fecha.toISOString().split('T')[0]
    const count = citas.filter((c) => c.fecha === fechaIso).length
    tendencias.push({ fecha: fechaIso, citas: count })
  }
  return tendencias
}
