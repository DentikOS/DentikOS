import { describe, expect, it } from 'vitest'
import {
  configuracionConveniosSchema,
  crearConfiguracionConveniosVacia,
  leerConfiguracionConvenios,
  resolverDescuentoConvenio,
} from './configuracionConveniosSchema'

describe('configuracionConveniosSchema', () => {
  it('parte con categorías sin convenios ni descuentos de ejemplo', () => {
    const configuracion = crearConfiguracionConveniosVacia()
    expect(configuracion.convenios).toEqual([])
    expect(configuracion.categorias.every((categoria) => categoria.especialidades.length === 0)).toBe(true)
  })

  it('normaliza la configuración vacía de una clínica existente', () => {
    const configuracion = leerConfiguracionConvenios({ version: 1, categorias: [], convenios: [] })
    expect(configuracion?.categorias.length).toBeGreaterThan(0)
    expect(configuracion?.convenios).toEqual([])
  })

  it('resuelve solo el descuento de la categoría explícitamente asociada', () => {
    const configuracion = {
      version: 1 as const,
      categorias: [{ id: 'endodoncia', nombre: 'Endodoncia', especialidades: ['Endodoncia'] }],
      convenios: [{
        id: 'isapre-1', nombre: 'Isapre Uno', tipo: 'isapre' as const,
        activo: true, descuentosPorCategoria: { endodoncia: 12.5 },
      }],
    }
    expect(resolverDescuentoConvenio(configuracion, 'isapre-1', 'Endodoncia')).toBe(12.5)
    expect(resolverDescuentoConvenio(configuracion, 'Isapre Uno', 'Cirugía')).toBe(0)
    expect(resolverDescuentoConvenio(configuracion, 'isapre-1', undefined)).toBe(0)
  })

  it('falla cerrado ante configuración inválida o convenios inactivos', () => {
    expect(leerConfiguracionConvenios({ version: 1, categorias: [], convenios: [{ descuento: 20 }] })).toBeNull()

    const resultado = configuracionConveniosSchema.safeParse({
      version: 1,
      categorias: [{ id: 'endodoncia', nombre: 'Endodoncia', especialidades: ['Endodoncia'] }],
      convenios: [{
        id: 'fonasa-a', nombre: 'FONASA A', tipo: 'fonasa', tramoFonasa: 'A',
        activo: false, descuentosPorCategoria: { endodoncia: 80 },
      }],
    })
    expect(resultado.success).toBe(true)
    if (!resultado.success) return
    expect(resolverDescuentoConvenio(resultado.data, 'fonasa-a', 'Endodoncia')).toBe(0)
  })

  it('rechaza porcentajes fuera del rango definido por BP08', () => {
    const resultado = configuracionConveniosSchema.safeParse({
      version: 1,
      categorias: [{ id: 'endodoncia', nombre: 'Endodoncia', especialidades: ['Endodoncia'] }],
      convenios: [{
        id: 'isapre-1', nombre: 'Isapre Uno', tipo: 'isapre', activo: true,
        descuentosPorCategoria: { endodoncia: 100.01 },
      }],
    })
    expect(resultado.success).toBe(false)
  })
})
