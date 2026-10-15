import type { Cita } from '../schemas/citaSchema'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'

const parseFechaLocal = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

/**
 * Genera instancias de bloqueos recurrentes a partir de un bloqueo base
 * BP05 §06: Soporte para bloqueos recurrentes (almuerzo diario, etc.)
 */
export const generarInstanciasBloqueo = (
  bloqueoBase: Cita,
  fechaInicio: string,
  fechaFin: string
): Cita[] => {
  if (!bloqueoBase.bloqueoRecurrencia || bloqueoBase.bloqueoRecurrencia === 'ninguna') {
    return [bloqueoBase]
  }

  const instancias: Cita[] = []
  const inicio = parseFechaLocal(fechaInicio)
  const fin = parseFechaLocal(bloqueoBase.bloqueoFechaFin || fechaFin)

  const current = new Date(inicio)
  const MAX_INSTANCIAS = 100
  let contador = 0

  while (current <= fin && contador < MAX_INSTANCIAS) {
    const debeCrear = (() => {
      const diaSemana = current.getDay()
      switch (bloqueoBase.bloqueoRecurrencia) {
        case 'diario':
          // Solo Lun-Vie (dias 1-5)
          return diaSemana >= 1 && diaSemana <= 5

        case 'semanal':
          // Solo en los dias especificados (o dia actual si no se especifico)
          if (!bloqueoBase.bloqueoDiasSemana || bloqueoBase.bloqueoDiasSemana.length === 0) {
            return diaSemana === inicio.getDay()
          }
          return bloqueoBase.bloqueoDiasSemana.includes(diaSemana)

        case 'mensual':
          // Mismo dia del mes
          return current.getDate() === inicio.getDate()

        default:
          return false
      }
    })()

    if (debeCrear) {
      const fechaStr = obtenerFechaLocalISO(current)
      instancias.push({
        ...bloqueoBase,
        id: `${bloqueoBase.id}_${fechaStr}`,
        fecha: fechaStr,
        esInstanciaRecurrencia: true,
        bloqueoPadreId: bloqueoBase.id,
      })
      contador++
    }

    current.setDate(current.getDate() + 1)
  }

  return instancias
}

/**
 * Calcula si una fecha especifica tiene un bloqueo recurrente activo
 */
export const tieneBloqueoRecurrente = (
  bloqueos: Cita[],
  fecha: string,
  _hora?: string
): Cita | null => {
  const fechaObj = parseFechaLocal(fecha)
  const diaSemana = fechaObj.getDay()
  const fechaSolo = fecha.split('T')[0]

  return (
    bloqueos.find((bloqueo) => {
      if (!bloqueo.esBloqueo) return false
      if (!bloqueo.bloqueoRecurrencia || bloqueo.bloqueoRecurrencia === 'ninguna') return false

      if (bloqueo.bloqueoFechaFin && fechaSolo > bloqueo.bloqueoFechaFin) return false
      if (bloqueo.fecha && fechaSolo < bloqueo.fecha.split('T')[0]) return false

      switch (bloqueo.bloqueoRecurrencia) {
        case 'diario':
          return diaSemana >= 1 && diaSemana <= 5

        case 'semanal':
          return bloqueo.bloqueoDiasSemana?.includes(diaSemana) || false

        case 'mensual': {
          const diaOriginal = parseFechaLocal(bloqueo.fecha).getDate()
          return fechaObj.getDate() === diaOriginal
        }

        default:
          return false
      }
    }) || null
  )
}
