import { useState, useEffect, useCallback } from 'react'
import type { MorningBriefLine, MorningBriefData } from '../types/dashboardTypes'
import { agendaStorageService } from '../../domains/operations/agenda/services/agendaStorageService'
import { inventarioStorageService } from '../../domains/operations/inventory/services/inventarioStorageService'
import { esterilizacionCloudService } from '../../domains/operations/sterilization/services/esterilizacionCloudService'
import { getClinicaActivaSync } from '../../infrastructure/auth/authService'
import { usePacientesStore } from '../../app/stores/pacientesStore'
import { obtenerMetricasPagosDashboard } from '../../application/analytics/dashboardQueries'
import { formatearImporteDocumento } from '../utils/formatoDocumento'

const formatearMontosPorMoneda = (montos: Record<string, number> = {}): string =>
  Object.entries(montos).map(([moneda, monto]) => formatearImporteDocumento(monto, moneda)).join(' · ')

export const useMorningBrief = (userRole = 'admin'): MorningBriefData => {
  const [data, setData] = useState<MorningBriefData>({ lineas: [], fechaActualizacion: '' })

  const calcularBrief = useCallback(async () => {
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
    if (Object.keys(metricasPagos.recaudadoHoyPorMoneda).length > 0) {
      textoFinanzas = `${formatearMontosPorMoneda(metricasPagos.recaudadoHoyPorMoneda)} recaudado en caja hoy`
    } else if (Object.keys(metricasPagos.porCobrarHoyPorMoneda).length > 0) {
      textoFinanzas = `${formatearMontosPorMoneda(metricasPagos.porCobrarHoyPorMoneda)} por cobrar hoy`
    } else if (Object.keys(metricasPagos.pagosVencidosPorMoneda).length > 0) {
      textoFinanzas = `${formatearMontosPorMoneda(metricasPagos.pagosVencidosPorMoneda)} en pagos vencidos`
    }

    const lineaFinanzas: MorningBriefLine = {
      id: 'finanzas',
      icono: 'wallet',
      texto: textoFinanzas,
      seccion: 'Pagos',
      severidad: 'info'
    }

    let textoEsterilizacion = 'Estado de esterilización no sincronizado con DentikOS'
    let severidadEsterilizacion: MorningBriefLine['severidad'] = 'advertencia'
    const clinicaId = getClinicaActivaSync()
    if (clinicaId && (userRole === 'admin' || userRole === 'asistente')) {
      try {
        const esterilizacion = await esterilizacionCloudService.cargar(clinicaId, false)
        const cicloActivo = esterilizacion.ciclos.find((ciclo) => ['preparacion', 'en_curso'].includes(ciclo.estado))
        textoEsterilizacion = cicloActivo
          ? `${cicloActivo.lote}: ${cicloActivo.estado === 'preparacion' ? 'en preparación' : 'autoclave en curso'}`
          : 'Sin ciclos en preparación ni autoclave en curso'
        severidadEsterilizacion = 'info'
      } catch {
        // No se presenta un resultado local como si estuviera validado en DentikOS.
      }
    }
    const lineaEsterilizacion: MorningBriefLine = {
      id: 'esterilizacion',
      icono: 'lab',
      texto: textoEsterilizacion,
      seccion: 'Esterilización',
      severidad: severidadEsterilizacion
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
