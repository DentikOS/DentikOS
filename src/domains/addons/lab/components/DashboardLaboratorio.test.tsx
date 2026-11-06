import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { REALTIME_EVENTS } from '../../../../infrastructure/realtime/realtimeEvents'
import { laboratorioCoreService } from '../services/laboratorioCoreService'
import { DashboardLaboratorio } from './DashboardLaboratorio'

vi.mock('../services/laboratorioCoreService', () => ({
  laboratorioCoreService: { cargarResumen: vi.fn() }
}))

const resumen = {
  ordenes_activas: 2,
  activas_por_etapa: [{ etapa: 'prueba', cantidad: 1 }],
  trabajos_30_dias: [{ laboratorio: 'Lab de prueba', ordenes: 2, dias_promedio_entrega: 5, reposiciones: 0, tasa_reproceso_pct: 0, entregas_a_tiempo: 1, entregas_con_fecha: 1 }],
  costos_mes: [{ laboratorio: 'Lab de prueba', costo: 123456 }],
  costos_anio: [{ laboratorio: 'Lab de prueba', costo: 123456 }],
  ordenes_vencidas: [],
  pagos_pendientes_30_dias: { cantidad: 1, monto: 123456 }
}

describe('DashboardLaboratorio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(laboratorioCoreService.cargarResumen).mockResolvedValue(resumen)
    useSesionStore.setState({ clinicaActual: 'clinic-a' })
  })

  it('muestra actividad pero oculta costos cuando el permiso financiero está ausente', async () => {
    render(<DashboardLaboratorio clinicaId="clinic-a" puedeVerFinanzas={false} />)

    expect(await screen.findByText('Lab de prueba')).toBeInTheDocument()
    expect(screen.getByText('Órdenes activas')).toBeInTheDocument()
    expect(screen.queryByText('Costos registrados este mes')).not.toBeInTheDocument()
    expect(screen.queryByText('Costos registrados este año')).not.toBeInTheDocument()
    expect(screen.queryByText('123.456')).not.toBeInTheDocument()
  })

  it('muestra costos que el servidor devuelve al usuario autorizado', async () => {
    render(<DashboardLaboratorio clinicaId="clinic-a" puedeVerFinanzas />)

    expect(await screen.findByText('Costos registrados este mes')).toBeInTheDocument()
    expect(screen.getByText('Costos registrados este año')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText(/123\.456/).length).toBeGreaterThan(0))
  })

  it('recarga el resumen al recibir el evento realtime de laboratorio', async () => {
    render(<DashboardLaboratorio clinicaId="clinic-a" puedeVerFinanzas={false} />)
    await screen.findByText('Lab de prueba')

    window.dispatchEvent(new Event(REALTIME_EVENTS.LABORATORIO_CHANGED))

    await waitFor(() => expect(laboratorioCoreService.cargarResumen).toHaveBeenCalledTimes(2))
  })
})
