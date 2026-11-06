import { describe, expect, it } from 'vitest'
import {
  configuracionConveniosSchema,
  crearConfiguracionConveniosVacia,
  leerConfiguracionConvenios,
  resolverDescuentoConvenio,
  resolverPrecioPrestacion,
} from './configuracionConveniosSchema'

describe('configuracionConveniosSchema', () => {
  it('parte con categorías sin convenios ni descuentos de ejemplo', () => {
    const configuracion = crearConfiguracionConveniosVacia()
    expect(configuracion.convenios).toEqual([])
    expect(configuracion.preciosEspecificos).toEqual([])
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

  it('prioriza el precio fijo de convenio sobre porcentaje y sucursal', () => {
    const configuracion = {
      version: 1 as const,
      categorias: [{ id: 'endo', nombre: 'Endodoncia', especialidades: ['Endodoncia'] }],
      convenios: [{ id: 'seguro', nombre: 'Seguro', tipo: 'isapre' as const, activo: true, descuentosPorCategoria: { endo: 20 } }],
      preciosEspecificos: [
        { prestacionId: '8', alcance: 'convenio' as const, contextoId: 'seguro', precio: 70000 },
        { prestacionId: '8', alcance: 'sucursal' as const, contextoId: 'sede-1', precio: 60000 },
      ],
    }
    expect(resolverPrecioPrestacion(configuracion, {
      prestacionId: 8, especialidad: 'Endodoncia', convenioIdentificador: 'seguro', sucursalId: 'sede-1', precioParticular: 100000,
    })).toEqual({ precioBase: 70000, precio: 70000, descuentoPct: 0, origen: 'convenio-precio-fijo' })
  })

  it('usa el porcentaje por categoría antes que el precio de sucursal', () => {
    const configuracion = {
      version: 1 as const,
      categorias: [{ id: 'endo', nombre: 'Endodoncia', especialidades: ['Endodoncia'] }],
      convenios: [{ id: 'seguro', nombre: 'Seguro', tipo: 'isapre' as const, activo: true, descuentosPorCategoria: { endo: 10 } }],
      preciosEspecificos: [{ prestacionId: '8', alcance: 'sucursal' as const, contextoId: 'sede-1', precio: 60000 }],
    }
    expect(resolverPrecioPrestacion(configuracion, {
      prestacionId: 8, especialidad: 'Endodoncia', convenioIdentificador: 'seguro', sucursalId: 'sede-1', precioParticular: 100000,
    })).toEqual({ precioBase: 100000, precio: 90000, descuentoPct: 10, origen: 'convenio-categoria' })
  })

  it('usa el precio específico de sucursal cuando el convenio no tiene regla de categoría', () => {
    const configuracion = {
      version: 1 as const,
      categorias: [{ id: 'endo', nombre: 'Endodoncia', especialidades: ['Endodoncia'] }],
      convenios: [{ id: 'seguro', nombre: 'Seguro', tipo: 'isapre' as const, activo: true, descuentosPorCategoria: { endo: 0 } }],
      preciosEspecificos: [{ prestacionId: '8', alcance: 'sucursal' as const, contextoId: 'sede-1', precio: 60000 }],
    }
    expect(resolverPrecioPrestacion(configuracion, {
      prestacionId: 8, convenioIdentificador: 'seguro', sucursalId: 'sede-1', precioParticular: 100000,
    })).toEqual({ precioBase: 60000, precio: 60000, descuentoPct: 0, origen: 'sucursal' })
  })

  it('usa el precio base del catálogo para FONASA cuando no hay una regla específica', () => {
    const configuracion = {
      version: 1 as const,
      categorias: [],
      convenios: [{ id: 'fonasa-b', nombre: 'FONASA B', tipo: 'fonasa' as const, tramoFonasa: 'B' as const, activo: true, descuentosPorCategoria: {} }],
    }
    expect(resolverPrecioPrestacion(configuracion, {
      prestacionId: 8, convenioIdentificador: 'fonasa-b', precioParticular: 100000,
    })).toEqual({ precioBase: 100000, precio: 100000, descuentoPct: 0, origen: 'catalogo' })
  })

  it('prioriza el precio específico del tramo FONASA sobre sucursal y precio base', () => {
    const configuracion = {
      version: 1 as const,
      categorias: [],
      convenios: [{ id: 'fonasa-b', nombre: 'FONASA B', tipo: 'fonasa' as const, tramoFonasa: 'B' as const, activo: true, descuentosPorCategoria: {} }],
      preciosEspecificos: [
        { prestacionId: '8', alcance: 'convenio' as const, contextoId: 'fonasa-b', precio: 42000 },
        { prestacionId: '8', alcance: 'sucursal' as const, contextoId: 'sede-1', precio: 60000 },
      ],
    }
    expect(resolverPrecioPrestacion(configuracion, {
      prestacionId: 8, convenioIdentificador: 'fonasa-b', sucursalId: 'sede-1', precioParticular: 100000,
    })).toEqual({ precioBase: 42000, precio: 42000, descuentoPct: 0, origen: 'convenio-precio-fijo' })
  })

  it('usa el precio específico de sucursal para FONASA antes del precio base', () => {
    const configuracion = {
      version: 1 as const,
      categorias: [],
      convenios: [{ id: 'fonasa-b', nombre: 'FONASA B', tipo: 'fonasa' as const, tramoFonasa: 'B' as const, activo: true, descuentosPorCategoria: {} }],
      preciosEspecificos: [{ prestacionId: '8', alcance: 'sucursal' as const, contextoId: 'sede-1', precio: 60000 }],
    }
    expect(resolverPrecioPrestacion(configuracion, {
      prestacionId: 8, convenioIdentificador: 'fonasa-b', sucursalId: 'sede-1', precioParticular: 100000,
    })).toEqual({ precioBase: 60000, precio: 60000, descuentoPct: 0, origen: 'sucursal' })
  })

  it('resuelve el porcentaje por categoría explícita del catálogo', () => {
    const configuracion = {
      version: 1 as const,
      categorias: [{ id: 'preventivo', nombre: 'Preventivo', especialidades: [] }],
      convenios: [{ id: 'seguro', nombre: 'Seguro', tipo: 'isapre' as const, activo: true, descuentosPorCategoria: { preventivo: 10 } }],
    }
    expect(resolverPrecioPrestacion(configuracion, {
      prestacionId: 8, categoria: 'Preventivo', especialidad: 'Diagnóstico y Prevención',
      convenioIdentificador: 'seguro', precioParticular: 50000,
    })).toEqual({ precioBase: 50000, precio: 45000, descuentoPct: 10, origen: 'convenio-categoria' })
  })

  it('falla de forma segura al precio particular ante configuración inválida', () => {
    expect(resolverPrecioPrestacion({ invalid: true }, {
      prestacionId: 8, convenioIdentificador: 'fonasa-b', precioParticular: 100000,
    })).toEqual({ precioBase: 100000, precio: 100000, descuentoPct: 0, origen: 'catalogo' })
  })
})
