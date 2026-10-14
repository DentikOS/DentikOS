import { useState, useEffect, useCallback } from 'react'
import type { MorningBriefLine, MorningBriefData } from '../types/dashboardTypes'
import { agendaStorageService } from '../../domains/operations/agenda/services/agendaStorageService'
import { inventarioStorageService } from '../../domains/operations/inventory/services/inventarioStorageService'
import { esterilizacionStorageService } from '../../domains/operations/sterilization/services/esterilizacionStorageService'
import { usePacientesStore } from '../../app/stores/pacientesStore'
import { obtenerMetricasPagosDashboard } from '../../application/analytics/dashboardQueries'

export const useMorningBrief = (userRole = 'admin'): MorningBriefData => {
  const [data, setData] = useState<MorningBriefData>({ lineas: [], fechaActualizacion: '' })

  const calcularBrief = useCallback(() => {
    const today = new Date().toISOString().split('T')[0]
    const citas = (agendaStorageService.obtenerCitas() || []).filter((c) => c.fecha === today)
    const canceladas = citas.filter((c) => c.estado === 'Cancelado').length
    const confirmadas = citas.filter((c) => c.estado === 'Confirmado' || c.estado === 'En Espera').length
    const pendientes = Math.max(0, citas.length - confirmadas - canceladas)

    const lineaAgenda: MorningBriefLine = {
      id: 'agenda',
      icono: 'calendar',
      texto: `${citas.length} citas · ${canceladas} cancelación · ${pendientes} confirmaciones pendientes`,
      seccion: 'Agenda',
      severidad: 'info'
    }

    const citaConAlerta = citas.find((c) => c.alergias || c.observaciones?.toLowerCase().includes('alergia'))
    const lineaAlertas: MorningBriefLine = {
      id: 'alertas',
      icono: 'alert',
      texto: citaConAlerta
        ? `${citaConAlerta.pacienteNombre || 'Paciente'} tiene alerta clínica (cita ${citaConAlerta.horaInicio || 'hoy'})`
        : 'Sin alertas clínicas críticas reportadas para hoy',
      seccion: 'Pacientes',
      severidad: citaConAlerta ? 'alerta' : 'info'
    }

    const pacientes = usePacientesStore.getState().pacientes || []
    const metricasPagos = obtenerMetricasPagosDashboard(pacientes)
    let textoFinanzas = 'Sin movimientos ni pagos pendientes registrados para hoy'
    if (metricasPagos.recaudadoHoy > 0) {
      textoFinanzas = `$${metricasPagos.recaudadoHoy.toLocaleString('es-CL')} recaudado en caja hoy`
    } else if (metricasPagos.porCobrarHoy > 0) {
      textoFinanzas = `$${metricasPagos.porCobrarHoy.toLocaleString('es-CL')} por cobrar hoy`
    } else if (metricasPagos.pagosVencidos > 0) {
      textoFinanzas = `$${metricasPagos.pagosVencidos.toLocaleString('es-CL')} en pagos vencidos`
    }

    const lineaFinanzas: MorningBriefLine = {
      id: 'finanzas',
      icono: 'wallet',
      texto: textoFinanzas,
      seccion: 'Pagos',
      severidad: 'info'
    }

    const infoEsterilizacion = esterilizacionStorageService.obtenerInfoEsterilizacionDashboard()
    let textoEsterilizacion = 'Autoclave #1: todos los ciclos validados y listos'
    if (infoEsterilizacion) {
      if (infoEsterilizacion.estado === 'en_curso') {
        textoEsterilizacion = `${infoEsterilizacion.equipo}: ciclo #${infoEsterilizacion.ciclo} en curso (${infoEsterilizacion.tiempoRestante})`
      } else {
        textoEsterilizacion = `${infoEsterilizacion.equipo}: ciclo #${infoEsterilizacion.ciclo} validado y listo`
      }
    }
    const lineaEsterilizacion: MorningBriefLine = {
      id: 'esterilizacion',
      icono: 'lab',
      texto: textoEsterilizacion,
      seccion: 'Esterilización',
      severidad: 'info'
    }

    const itemsCriticos = inventarioStorageService.obtenerItemsInventarioCriticoDashboard()
    const itemCritico = itemsCriticos[0]
    const lineaInventario: MorningBriefLine = {
      id: 'inventario',
      icono: 'package',
      texto: itemCritico
        ? `${itemCritico.nombre}: quedan ${itemCritico.cantidad} ${itemCritico.unidad || 'uds'} (stock crítico)`
        : 'Stock de insumos en niveles óptimos',
      seccion: 'Inventario',
      severidad: itemCritico ? 'advertencia' : 'info'
    }

    let lineas: MorningBriefLine[] = [lineaAgenda, lineaAlertas, lineaFinanzas, lineaEsterilizacion, lineaInventario]

    if (userRole === 'dentista') {
      lineas = [lineaAgenda, lineaAlertas, lineaInventario]
    } else if (userRole === 'asistente') {
      lineas = [lineaAgenda, lineaEsterilizacion, lineaInventario]
    } else if (userRole === 'recepcion') {
      lineas = [lineaAgenda, lineaAlertas]
    }

    setData({ lineas, fechaActualizacion: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) })
  }, [userRole])

  useEffect(() => {
    calcularBrief()
    const interval = setInterval(calcularBrief, 3600000)
    return () => clearInterval(interval)
  }, [calcularBrief])

  return data
}
