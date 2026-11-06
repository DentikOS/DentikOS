import { describe, expect, it } from 'vitest'
import { crearResumenDashboardAdministracion } from './dashboardAdministracionUtils'

const clinica = {
  nombreClinica: 'Clínica Central', rutClinica: '76.123.456-7', giroComercial: 'Servicios odontológicos',
  direccion: 'Av. Central 100', comuna: 'Providencia', region: 'Metropolitana',
  telefono: '+56912345678', emailContacto: 'contacto@clinica.cl', logoUrl: 'https://cdn.clinica/logo.png',
}

describe('crearResumenDashboardAdministracion', () => {
  it('calcula el checklist y KPIs del rango de hoy a los próximos seis días', () => {
    const resumen = crearResumenDashboardAdministracion({
      clinica,
      sedes: [{ estado: 'activa' } as never],
      boxes: [{ estado: 'activo' } as never],
      miembrosActivos: 2,
      prestaciones: [{ precioParticular: 12000 }, { precioParticular: 0 }] as never[],
      pacientes: [{ estado: 'activo' }, { estado: 'inactivo' }] as never[],
      citas: [{ fecha: '2026-11-05', estado: 'Agendada' }, { fecha: '2026-11-12', estado: 'Agendada' }, { fecha: '2026-11-06', estado: 'Cancelada' }] as never[],
      presupuestos: [{ estado: 'Aprobado' }, { estado: 'EnTratamiento' }, { estado: 'borrador' }] as never[],
      hoy: '2026-11-05',
    })

    expect(resumen).toMatchObject({
      pacientesActivos: 1,
      presupuestosAprobados: 2,
      citasProximaSemana: 1,
      presupuestosPendientes: 1,
      prestacionesSinPrecio: 1,
      progresoPorcentaje: 83,
    })
    expect(resumen.checklist.find((item) => item.id === 'prestaciones')).toMatchObject({
      completado: false,
      detalle: '1 sin precio particular',
    })
  })

  it('trata faltantes de clínica y catálogo como pendientes sin inventar completitud', () => {
    const resumen = crearResumenDashboardAdministracion({
      clinica: {}, sedes: [], boxes: [], miembrosActivos: 0, prestaciones: [], pacientes: [], citas: [], presupuestos: [], hoy: '2026-11-05',
    })

    expect(resumen.progresoPorcentaje).toBe(0)
    expect(resumen.checklist.every((item) => !item.completado)).toBe(true)
  })
})
