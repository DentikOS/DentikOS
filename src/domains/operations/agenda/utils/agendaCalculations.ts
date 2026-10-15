import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'

export interface CitaAgendaCalc {
  id?: string | number; boxId?: string; fechaIso?: string; fecha?: string
  horaInicio?: string; horaFin?: string; estado?: string; [key: string]: unknown
}

export interface ResumenAgenda {
  totalHoy: number; agendadosCount: number; enEsperaCount: number
  enSillonCount: number; finalizadosCount: number; citasHoy: CitaAgendaCalc[]
}

export const verificarDisponibilidadBox = (
  citas: CitaAgendaCalc[] = [],
  boxId: string,
  fechaIso: string,
  horaInicio: string,
  idExcluir: string | number | null = null
): boolean => !citas.some(c => {
  if (idExcluir && String(c.id) === String(idExcluir)) return false
  if (c.boxId !== boxId || c.fechaIso !== fechaIso || c.estado === 'NoAsiste') return false
  return Boolean(c.horaInicio && c.horaFin && horaInicio >= c.horaInicio && horaInicio < c.horaFin)
})

export const calcularResumenAgenda = (citas: CitaAgendaCalc[] = []): ResumenAgenda => {
  const hoyIso = obtenerFechaLocalISO()
  const citasHoy = citas.filter(c => c.fechaIso === hoyIso || c.fecha === new Date().toLocaleDateString('es-CL'))
  let agendadosCount = 0, enEsperaCount = 0, enSillonCount = 0, finalizadosCount = 0

  citasHoy.forEach(c => {
    if (c.estado === 'Pendiente') agendadosCount++
    if (c.estado === 'En sala de espera' || c.estado === 'EnEspera') enEsperaCount++
    if (c.estado === 'En atención' || c.estado === 'EnSillon') enSillonCount++
    if (c.estado === 'Completada' || c.estado === 'Finalizado') finalizadosCount++
  })

  return { totalHoy: citasHoy.length, agendadosCount, enEsperaCount, enSillonCount, finalizadosCount, citasHoy }
}
