import { describe, it, expect } from 'vitest'
import {
  ETAPAS_LABORATORIO,
  TIPOS_TRABAJO_SUGERIDOS,
  CATEGORIAS_LABORATORIO
} from './laboratorioConstants'

describe('laboratorioConstants', () => {
  it('define las siete etapas BP12 con claves estables y estilos', () => {
    expect(ETAPAS_LABORATORIO.map(e => e.id)).toEqual([
      'solicitud', 'enviada', 'diseno', 'fabricacion', 'prueba', 'ajustes', 'entrega'
    ])
    ETAPAS_LABORATORIO.forEach(e => {
      expect(e.id).toBeDefined()
      expect(e.nombre).toBeDefined()
      expect(e.colorBg).toBeDefined()
    })
  })

  it('define las siete categorías y sus subtipos', () => {
    expect(CATEGORIAS_LABORATORIO).toHaveLength(7)
    expect(CATEGORIAS_LABORATORIO.every(categoria => categoria.subtipos.length > 0)).toBe(true)
  })

  it('contiene sugerencias de tipos de trabajo', () => {
    expect(TIPOS_TRABAJO_SUGERIDOS.length).toBeGreaterThan(0)
    expect(TIPOS_TRABAJO_SUGERIDOS).toContain('Corona de Zirconio Monolítico')
  })

})
