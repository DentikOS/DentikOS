import { usePresupuestosStore } from '../../../../app/stores/presupuestosStore'
import type { Presupuesto } from '../schemas/presupuestoSchema'
import {
  TRANSICIONES_VALIDAS,
  puedeTransicionar,
  verificarVencimiento,
  transicionPorPago,
  type EstadoPresupuesto,
} from '../utils/transicionesEstado'
import { timelineService } from '../../../clinical/patient/services/timelineService'

export { TRANSICIONES_VALIDAS, puedeTransicionar, type EstadoPresupuesto }

export const useEstadosPresupuesto = () => {
  const cambiarEstadoStore = usePresupuestosStore((s) => s.cambiarEstado)
  const actualizarPresupuestoStore = usePresupuestosStore((s) => s.actualizarPresupuesto)
  const presupuestos = usePresupuestosStore((s) => s.presupuestos)

  const cambiarEstado = (presupuestoId: string | number, nuevoEstado: EstadoPresupuesto, autor = 'Profesional Clínico') => {
    const p = presupuestos.find((item) => String(item.id) === String(presupuestoId))
    if (!p) return false

    const estadoActual = (p.estado || 'borrador') as EstadoPresupuesto
    if (!puedeTransicionar(estadoActual, nuevoEstado)) {
      return false
    }

    cambiarEstadoStore(presupuestoId, nuevoEstado)
    if (p.pacienteId) {
      timelineService.agregarEvento(p.pacienteId, {
        id: `tl-trans-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: 'presupuesto',
        titulo: `Presupuesto ${p.folio || p.id} cambió a ${nuevoEstado.toUpperCase()}`,
        profesional: autor,
        detalles: `Transición de ${estadoActual} a ${nuevoEstado}`,
      })
    }
    return true
  }

  const enviarPresupuesto = (presupuesto: Presupuesto) => {
    cambiarEstado(presupuesto.id, 'enviado')
  }

  const aprobarPresupuesto = (presupuesto: Presupuesto) => {
    cambiarEstado(presupuesto.id, 'aprobado')
  }

  const iniciarTratamiento = (presupuesto: Presupuesto) => {
    cambiarEstado(presupuesto.id, 'en-curso')
  }

  const completarPresupuesto = (presupuesto: Presupuesto) => {
    cambiarEstado(presupuesto.id, 'completado')
  }

  const rechazarPresupuesto = (presupuesto: Presupuesto, motivo?: string) => {
    actualizarPresupuestoStore(presupuesto.id, {
      estado: 'rechazado',
      observacion: motivo ? `Rechazado: ${motivo}` : 'Presupuesto rechazado por el paciente.',
    })
    if (presupuesto.pacienteId) {
      timelineService.agregarEvento(presupuesto.pacienteId, {
        id: `tl-rech-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: 'presupuesto',
        titulo: `Presupuesto ${presupuesto.folio || presupuesto.id} RECHAZADO`,
        detalles: motivo || 'Rechazado por el paciente',
      })
    }
  }

  const procesarPagoAutomatico = (presupuesto: Presupuesto, montoPago: number) => {
    const total = presupuesto.totalAPagar || presupuesto.total || presupuesto.montoTotal || 0
    const abonadoPrevio = presupuesto.montoAbonado || 0
    const nuevoAbonado = abonadoPrevio + montoPago
    const nuevoEstado = transicionPorPago(total, nuevoAbonado)

    actualizarPresupuestoStore(presupuesto.id, {
      montoAbonado: nuevoAbonado,
      estado: nuevoEstado,
    })
  }

  const verificarYMarcarVencidos = () => {
    presupuestos.forEach((p) => {
      if (p.estado === 'enviado' && verificarVencimiento(p.fechaVencimiento)) {
        cambiarEstadoStore(p.id, 'vencido')
      }
    })
  }

  return {
    puedeTransicionar,
    cambiarEstado,
    enviarPresupuesto,
    aprobarPresupuesto,
    iniciarTratamiento,
    completarPresupuesto,
    rechazarPresupuesto,
    procesarPagoAutomatico,
    verificarYMarcarVencidos,
  }
}
