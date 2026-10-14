import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  obtenerCitasDelDia,
  obtenerPacientesEnEspera,
  obtenerPacientesEnAtencion,
  obtenerTodosLosPagosDashboard,
  obtenerIngresosDelDia,
  obtenerPresupuestosDashboard,
  obtenerAlertasOperativasDashboard,
  obtenerResumenConsultasDashboard,
  obtenerMetricasPagosDashboard,
  obtenerAlertasClinicasDashboard,
} from './dashboardQueries'
import * as paymentDomain from '../../domains/billing/payment'
import { agendaStorageService } from '../../domains/operations/agenda'
import { presupuestosStorageService } from '../../domains/billing/budget'
import { pacientesStorageService } from '../../domains/clinical/patient'

describe('dashboardQueries (Application Service)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('obtenerCitasDelDia', () => {
    it('debe filtrar citas por la fecha indicada', () => {
      vi.spyOn(agendaStorageService, 'obtenerCitas').mockReturnValue([
        { id: '1', fecha: '2026-10-04', horaInicio: '09:00', estado: 'Confirmado' },
        { id: '2', fecha: '2026-10-05', horaInicio: '10:00', estado: 'Confirmado' },
      ])

      const citas = obtenerCitasDelDia('2026-10-04')
      expect(citas).toHaveLength(1)
      expect(citas[0].id).toBe('1')
    })

    it('debe manejar errores de storage retornando array vacío', () => {
      vi.spyOn(agendaStorageService, 'obtenerCitas').mockImplementation(() => {
        throw new Error('Storage fail')
      })
      expect(obtenerCitasDelDia('2026-10-04')).toEqual([])
    })
  })

  describe('obtenerPacientesEnEspera y enAtencion', () => {
    it('debe filtrar pacientes según su estado de atención en la fecha', () => {
      vi.spyOn(agendaStorageService, 'obtenerCitas').mockReturnValue([
        { id: '1', fecha: '2026-10-04', horaInicio: '09:00', estado: 'En Espera' },
        { id: '2', fecha: '2026-10-04', horaInicio: '09:30', estado: 'EnEspera' },
        { id: '3', fecha: '2026-10-04', horaInicio: '10:00', estado: 'En Atención' },
        { id: '4', fecha: '2026-10-04', horaInicio: '10:30', estado: 'Atendiendo' },
        { id: '5', fecha: '2026-10-04', horaInicio: '11:00', estado: 'Completado' },
      ])

      const enEspera = obtenerPacientesEnEspera('2026-10-04')
      expect(enEspera).toHaveLength(2)
      expect(enEspera.map((c) => c.id)).toEqual(['1', '2'])

      const enAtencion = obtenerPacientesEnAtencion('2026-10-04')
      expect(enAtencion).toHaveLength(2)
      expect(enAtencion.map((c) => c.id)).toEqual(['3', '4'])
    })
  })

  describe('obtenerTodosLosPagosDashboard y obtenerIngresosDelDia', () => {
    it('debe combinar pagos directos y abonos de pacientes', () => {
      vi.spyOn(paymentDomain.pagosStorageService, 'obtenerPagos').mockReturnValue([
        { id: 'p1', fecha: '2026-10-04', monto: 50000, estado: 'Pagado' },
      ])
      vi.spyOn(paymentDomain, 'obtenerAbonosPorPaciente').mockReturnValue([
        { id: 'a1', fecha: '2026-10-04', monto: 25000, metodoPago: 'Efectivo', pacienteNombre: 'Juan' },
      ])

      const todos = obtenerTodosLosPagosDashboard([{ id: 'pac-1' }])
      expect(todos).toHaveLength(2)

      const ingresos = obtenerIngresosDelDia('2026-10-04', [{ id: 'pac-1' }])
      expect(ingresos).toBe(75000)
    })

    it('debe ignorar pagos anulados al calcular ingresos', () => {
      vi.spyOn(paymentDomain.pagosStorageService, 'obtenerPagos').mockReturnValue([
        { id: 'p1', fecha: '2026-10-04', monto: 50000, estado: 'Anulado' },
        { id: 'p2', fecha: '2026-10-04', monto: 30000, estado: 'Pagado' },
      ])

      const ingresos = obtenerIngresosDelDia('2026-10-04', [])
      expect(ingresos).toBe(30000)
    })
  })

  describe('obtenerPresupuestosDashboard', () => {
    it('debe retornar lista de presupuestos', () => {
      vi.spyOn(presupuestosStorageService, 'obtenerPresupuestos').mockReturnValue([
        { id: 'pres-1', total: 100000, estado: 'Aceptado' } as any,
      ])
      const res = obtenerPresupuestosDashboard()
      expect(res).toHaveLength(1)
      expect(res[0].id).toBe('pres-1')
    })
  })

  describe('obtenerResumenConsultasDashboard', () => {
    it('debe retornar resumen consolidado', () => {
      vi.spyOn(agendaStorageService, 'obtenerCitas').mockReturnValue([
        { id: 'c1', fecha: '2026-10-04', horaInicio: '09:00', estado: 'En Espera' },
      ])
      vi.spyOn(paymentDomain.pagosStorageService, 'obtenerPagos').mockReturnValue([
        { id: 'p1', fecha: '2026-10-04', monto: 15000, estado: 'Pagado' },
      ])
      vi.spyOn(presupuestosStorageService, 'obtenerPresupuestos').mockReturnValue([])
      vi.spyOn(pacientesStorageService, 'obtenerPacientes').mockReturnValue([
        { id: 'p1', nombre: 'Test', apellido: 'Paciente' } as any,
      ])

      const resumen = obtenerResumenConsultasDashboard('2026-10-04')
      expect(resumen.fecha).toBe('2026-10-04')
      expect(resumen.citasHoy).toHaveLength(1)
      expect(resumen.enEspera).toHaveLength(1)
      expect(resumen.ingresosHoy).toBe(15000)
      expect(resumen.totalPacientes).toBe(1)
    })
  })

  describe('obtenerMetricasPagosDashboard', () => {
    it('calcula porCobrarHoy, pagosVencidos y recaudadoHoy correctamente', () => {
      const hoy = new Date().toLocaleDateString('en-CA')
      vi.spyOn(paymentDomain.pagosStorageService, 'obtenerPagos').mockReturnValue([
        { id: 'p1', fecha: hoy, monto: 50000, estado: 'pagado' },
        { id: 'p2', fecha: hoy, monto: 30000, estado: 'pendiente' },
        { id: 'p3', fecha: '2020-01-01', monto: 20000, estado: 'pendiente' },
      ])

      const metricas = obtenerMetricasPagosDashboard([])
      expect(metricas.recaudadoHoy).toBe(50000)
      expect(metricas.porCobrarHoy).toBe(30000)
      expect(metricas.pagosVencidos).toBe(20000)
    })
  })

  describe('obtenerAlertasClinicasDashboard', () => {
    it('retorna alertas clínicas para pacientes con citas hoy', () => {
      const hoy = new Date().toLocaleDateString('en-CA')
      vi.spyOn(agendaStorageService, 'obtenerCitas').mockReturnValue([
        { id: 'c1', fecha: hoy, pacienteId: 'pac-1', estado: 'Confirmado' },
      ])

      const mockPacientes = [
        { id: 'pac-1', nombre: 'Juan Pérez', alergias: 'Penicilina', anticoagulantes: 'Warfarina' } as any,
        { id: 'pac-2', nombre: 'Sin Cita', alergias: 'Latex' } as any,
      ]

      const alertas = obtenerAlertasClinicasDashboard(mockPacientes)
      expect(alertas.length).toBe(2)
      expect(alertas[0].pacienteNombre).toBe('Juan Pérez')
      expect(alertas[0].tipo).toBe('alergia')
      expect(alertas[0].mensaje).toBe('Penicilina')
      expect(alertas[1].tipo).toBe('contraindicacion')
    })
  })
})
