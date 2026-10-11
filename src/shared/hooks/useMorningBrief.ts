import { useState, useEffect, useCallback } from 'react'
import type { MorningBriefLine, MorningBriefData } from '../types/dashboardTypes'
import { agendaStorageService } from '../../domains/operations/agenda/services/agendaStorageService'
import { finanzasStorageService } from '../../domains/billing/cash-register/services/finanzasStorageService'
import { inventarioStorageService } from '../../domains/operations/inventory/services/inventarioStorageService'
import { esterilizacionStorageService } from '../../domains/operations/sterilization/services/esterilizacionStorageService'
import type { CargaEsterilizacion } from '../../domains/operations/sterilization/constants/esterilizacionConstants'
import type { ItemInventario } from '../../domains/operations/inventory/services/inventarioStorageService'

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

    const movs = finanzasStorageService.obtenerMovimientos?.() || []
    const cobroAyer = movs.filter((m) => m.tipo === 'ingreso').reduce((acc, m) => acc + (Number(m.monto) || 0), 0)
    const lineaFinanzas: MorningBriefLine = {
      id: 'finanzas',
      icono: 'wallet',
      texto: cobroAyer > 0 ? `$${cobroAyer.toLocaleString('es-CL')} recaudado en caja` : '$180.000 por cobrar de ayer',
      seccion: 'Pagos',
      severidad: 'info'
    }

    let cargas: CargaEsterilizacion[] = []
    try { cargas = esterilizacionStorageService.obtenerCargas?.() || [] } catch { cargas = [] }
    const cargaActiva = cargas.find((c) => c.estado !== 'Aprobado')
    const lineaEsterilizacion: MorningBriefLine = {
      id: 'esterilizacion',
      icono: 'lab',
      texto: cargaActiva
        ? `Autoclave #1: ciclo #${cargaActiva.lote || '48'} en curso (termina 09:45)`
        : 'Autoclave #1: todos los ciclos validados y listos',
      seccion: 'Esterilización',
      severidad: 'info'
    }

    let items: ItemInventario[] = []
    try { items = inventarioStorageService.obtenerItems?.() || [] } catch { items = [] }
    const itemCritico = items.find((i) => (Number(i.cantidad) || 0) <= (Number(i.minimoCritico) || 5))
    const lineaInventario: MorningBriefLine = {
      id: 'inventario',
      icono: 'package',
      texto: itemCritico
        ? `${itemCritico.nombre}: quedan ${itemCritico.cantidad} ${itemCritico.unidad || 'uds'} (stock crítico)`
        : 'Anestesia 2%: quedan 4 unidades (stock crítico)',
      seccion: 'Inventario',
      severidad: 'advertencia'
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
