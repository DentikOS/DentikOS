import { describe, it, expect } from 'vitest'
import {
  CATEGORIAS_INSUMOS,
  UNIDADES_MEDIDA,
  ITEMS_INVENTARIO_DEFAULT
} from './inventarioConstants'

describe('inventarioConstants', () => {
  it('contiene categorias de insumos y unidades de medida', () => {
    expect(CATEGORIAS_INSUMOS).toContain('Anestésicos y Agujas')
    expect(CATEGORIAS_INSUMOS).toContain('Instrumental')
    expect(CATEGORIAS_INSUMOS).toContain('Esterilización')
    expect(UNIDADES_MEDIDA).toContain('Cajas')
  })

  it('contiene items por defecto con minimo critico y precio', () => {
    expect(ITEMS_INVENTARIO_DEFAULT.length).toBeGreaterThan(0)
    ITEMS_INVENTARIO_DEFAULT.forEach(item => {
      expect(item.id).toBeDefined()
      expect(item.nombre).toBeDefined()
      expect(item.minimoCritico).toBeGreaterThan(0)
    })
  })
})
