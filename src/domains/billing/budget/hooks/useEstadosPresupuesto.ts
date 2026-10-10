import { usePresupuestosStore } from '../../../../app/stores/presupuestosStore'
import type { Presupuesto } from '../schemas/presupuestoSchema'

export type EstadoPresupuesto =
  | 'borrador'
  | 'enviado'
  | 'aprobado'
  | 'en-curso'
  | 'completado'
  | 'rechazado'
  | 'vencido'

export const TRANSICIONES_VALIDAS: Record<EstadoPresupuesto, EstadoPresupuesto[]> = {
  borrador: ['enviado', 'rechazado'],
  enviado: ['aprobado', 'rechazado', 'vencido'],
  aprobado: ['en-curso', 'rechazado'],
  'en-curso': ['completado', 'rechazado'],
  completado: [],
  rechazado: ['borrador'],
  vencido: ['borrador'],
}

export const useEstadosPresupuesto = () => {
  const cambiarEstadoStore = usePresupuestosStore((s) => s.cambiarEstado)
  const actualizarPresupuestoStore = usePresupuestosStore((s) => s.actualizarPresupuesto)

  const puedeTransicionar = (estadoActual: EstadoPresupuesto, nuevoEstado: EstadoPresupuesto): boolean => {
    return TRANSICIONES_VALIDAS[estadoActual]?.includes(nuevoEstado) ?? false
  }

  const enviarPresupuesto = (presupuesto: Presupuesto) => {
    cambiarEstadoStore(presupuesto.id, 'enviado')
  }

  const aprobarPresupuesto = (presupuesto: Presupuesto) => {
    cambiarEstadoStore(presupuesto.id, 'aprobado')
  }

  const iniciarTratamiento = (presupuesto: Presupuesto) => {
    cambiarEstadoStore(presupuesto.id, 'en-curso')
  }

  const completarPresupuesto = (presupuesto: Presupuesto) => {
    cambiarEstadoStore(presupuesto.id, 'completado')
  }

  const rechazarPresupuesto = (presupuesto: Presupuesto, motivo?: string) => {
    actualizarPresupuestoStore(presupuesto.id, {
      estado: 'rechazado',
      observacion: motivo ? `Rechazado: ${motivo}` : 'Presupuesto rechazado por el paciente.',
    })
  }

  const procesarPagoAutomatico = (
    presupuesto: Presupuesto,
    montoPago: number
  ) => {
    const total = presupuesto.totalAPagar || presupuesto.total || presupuesto.montoTotal || 0
    const abonadoPrevio = presupuesto.montoAbonado || 0
    const nuevoAbonado = abonadoPrevio + montoPago

    if (nuevoAbonado >= total) {
      actualizarPresupuestoStore(presupuesto.id, {
        montoAbonado: nuevoAbonado,
        estado: 'completado',
      })
    } else if (nuevoAbonado > 0) {
      actualizarPresupuestoStore(presupuesto.id, {
        montoAbonado: nuevoAbonado,
        estado: 'en-curso',
      })
    }
  }

  return {
    puedeTransicionar,
    enviarPresupuesto,
    aprobarPresupuesto,
    iniciarTratamiento,
    completarPresupuesto,
    rechazarPresupuesto,
    procesarPagoAutomatico,
  }
}
