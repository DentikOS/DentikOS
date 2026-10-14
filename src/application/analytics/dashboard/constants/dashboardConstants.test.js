import { describe, it, expect } from 'vitest'
import {
  ACCESOS_RAPIDOS,
  WIDGETS_POR_ROL,
  WIDGET_CONFIG
} from './dashboardConstants'

describe('dashboardConstants', () => {
  it('contiene los accesos rapidos definidos con su estructura', () => {
    expect(ACCESOS_RAPIDOS.length).toBe(4)
    ACCESOS_RAPIDOS.forEach((item) => {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('nombre')
      expect(item).toHaveProperty('seccion')
      expect(item).toHaveProperty('color')
    })
  })

  it('define configuracion de widgets para los 9 widgets CORE', () => {
    const tiposEsperados = [
      'agenda',
      'pacientes_recientes',
      'sala_espera',
      'alertas_clinicas',
      'esterilizacion',
      'inventario_critico',
      'pagos_pendientes',
      'comunicaciones',
      'quick_resume'
    ]
    tiposEsperados.forEach((tipo) => {
      expect(WIDGET_CONFIG[tipo]).toBeDefined()
      expect(WIDGET_CONFIG[tipo].tipo).toBe(tipo)
      expect(WIDGET_CONFIG[tipo].visible).toBe(true)
    })
  })

  it('define widgets filtrados por rol', () => {
    expect(WIDGETS_POR_ROL.admin.length).toBeGreaterThanOrEqual(7)
    expect(WIDGETS_POR_ROL.dentista).toContain('agenda')
    expect(WIDGETS_POR_ROL.dentista).not.toContain('pagos_pendientes')
    expect(WIDGETS_POR_ROL.recepcion).toContain('sala_espera')
    expect(WIDGETS_POR_ROL.asistente).toContain('esterilizacion')
  })

})
