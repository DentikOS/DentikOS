import { describe, it, expect } from 'vitest'
import {
  prestacionSchema,
  listaPrestacionesSchema,
  validarListaPrestaciones
} from './prestacionSchema'

describe('prestacionSchema (F2-04d)', () => {
  describe('Prestación válida con campos mínimos', () => {
    it('acepta código Fonasa vacío para prestaciones sin convenio', () => {
      const result = prestacionSchema.safeParse({
        id: 'prestacion-propia', nombre: 'Control particular', especialidad: 'Diagnóstico',
        precioParticular: 15000, precioFonasa: 0, codigoFonasa: ''
      })
      expect(result.success).toBe(true)
    })
    it('acepta prestación con todos los campos obligatorios', () => {
      const prestacion = {
        id: 1,
        nombre: 'Evaluación Clínica y Diagnóstico Integral',
        especialidad: 'Diagnóstico y Prevención',
        precioParticular: 25000,
        precioFonasa: 15000,
        codigoFonasa: '01-01-001'
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(true)
    })

    it('acepta prestación con id string', () => {
      const prestacion = {
        id: 'prest_custom_001',
        nombre: 'Prestación personalizada',
        especialidad: 'Operatoria / Estética',
        precioParticular: 50000,
        precioFonasa: 40000,
        codigoFonasa: '01-02-999'
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(true)
    })
  })

  describe('Prestación válida con todos los campos', () => {
    it('acepta prestación completa con campo precio normalizado', () => {
      const prestacion = {
        id: 3,
        nombre: 'Obturación Resina Simple (1 Cara)',
        especialidad: 'Operatoria / Estética',
        precioParticular: 35000,
        precioFonasa: 28000,
        codigoFonasa: '01-02-010',
        precio: 35000 // normalizado por usePrestaciones
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(true)
      expect(result.data.precio).toBe(35000)
    })

    it('acepta prestación con precioParticular = 0 (prestación gratuita o bonificada)', () => {
      const prestacion = {
        id: 99,
        nombre: 'Control de rutina bonificado',
        especialidad: 'Diagnóstico y Prevención',
        precioParticular: 0,
        precioFonasa: 0,
        codigoFonasa: '01-01-000'
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(true)
    })
  })

  describe('Validación de especialidades', () => {
    const prestacionBase = {
      id: 1,
      precioParticular: 10000,
      precioFonasa: 8000,
      codigoFonasa: '01-01-001'
    }

    it.each([
      'Diagnóstico y Prevención',
      'Operatoria / Estética',
      'Endodoncia',
      'Periodoncia',
      'Cirugía Bucal y Maxilofacial',
      'Rehabilitación y Prótesis',
      'Implantología',
      'Ortodoncia y Ortopedia',
      'Odontopediatría'
    ])('acepta especialidad "%s"', (especialidad) => {
      const result = prestacionSchema.safeParse({
        ...prestacionBase,
        nombre: 'Test',
        especialidad
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Prestaciones inválidas (campos obligatorios ausentes)', () => {
    it('rechaza prestación sin id', () => {
      const prestacion = {
        nombre: 'Test',
        especialidad: 'Diagnóstico y Prevención',
        precioParticular: 10000,
        precioFonasa: 8000,
        codigoFonasa: '01-01-001'
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(false)
    })

    it('rechaza prestación sin nombre', () => {
      const prestacion = {
        id: 1,
        especialidad: 'Diagnóstico y Prevención',
        precioParticular: 10000,
        precioFonasa: 8000,
        codigoFonasa: '01-01-001'
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(false)
    })

    it('rechaza prestación con nombre vacío', () => {
      const prestacion = {
        id: 1,
        nombre: '',
        especialidad: 'Diagnóstico y Prevención',
        precioParticular: 10000,
        precioFonasa: 8000,
        codigoFonasa: '01-01-001'
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(false)
    })

    it('rechaza prestación sin especialidad', () => {
      const prestacion = {
        id: 1,
        nombre: 'Test',
        precioParticular: 10000,
        precioFonasa: 8000,
        codigoFonasa: '01-01-001'
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(false)
    })

    it('rechaza prestación sin precioParticular', () => {
      const prestacion = {
        id: 1,
        nombre: 'Test',
        especialidad: 'Diagnóstico y Prevención',
        precioFonasa: 8000,
        codigoFonasa: '01-01-001'
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(false)
    })

    it('rechaza prestación sin precioFonasa', () => {
      const prestacion = {
        id: 1,
        nombre: 'Test',
        especialidad: 'Diagnóstico y Prevención',
        precioParticular: 10000,
        codigoFonasa: '01-01-001'
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(false)
    })

    it('rechaza prestación sin codigoFonasa', () => {
      const prestacion = {
        id: 1,
        nombre: 'Test',
        especialidad: 'Diagnóstico y Prevención',
        precioParticular: 10000,
        precioFonasa: 8000
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(false)
    })

    it('rechaza prestación con precioParticular como string (no number)', () => {
      const prestacion = {
        id: 1,
        nombre: 'Test',
        especialidad: 'Diagnóstico y Prevención',
        precioParticular: '25000', // string en vez de number
        precioFonasa: 15000,
        codigoFonasa: '01-01-001'
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(false)
    })
  })

  describe('Passthrough (permite campos adicionales)', () => {
    it('acepta prestación con campos no catalogados sin fallar', () => {
      const prestacion = {
        id: 1,
        nombre: 'Test',
        especialidad: 'Diagnóstico y Prevención',
        precioParticular: 10000,
        precioFonasa: 8000,
        codigoFonasa: '01-01-001',
        descripcion: 'Descripción extendida',
        duracion: 30,
        requisitos: ['Radiografía previa']
      }
      const result = prestacionSchema.safeParse(prestacion)
      expect(result.success).toBe(true)
      expect(result.data.descripcion).toBe('Descripción extendida')
      expect(result.data.duracion).toBe(30)
    })
  })
})

describe('listaPrestacionesSchema (F2-04d)', () => {
  it('acepta array vacío', () => {
    const result = listaPrestacionesSchema.safeParse([])
    expect(result.success).toBe(true)
  })

  it('acepta array con múltiples prestaciones válidas', () => {
    const prestaciones = [
      { id: 1, nombre: 'Eval 1', especialidad: 'Diagnóstico y Prevención', precioParticular: 25000, precioFonasa: 15000, codigoFonasa: '01-01-001' },
      { id: 2, nombre: 'Eval 2', especialidad: 'Operatoria / Estética', precioParticular: 35000, precioFonasa: 28000, codigoFonasa: '01-02-010' }
    ]
    const result = listaPrestacionesSchema.safeParse(prestaciones)
    expect(result.success).toBe(true)
  })

  it('rechaza array con al menos una prestación inválida', () => {
    const prestaciones = [
      { id: 1, nombre: 'Test', especialidad: 'Diagnóstico y Prevención', precioParticular: 10000, precioFonasa: 8000, codigoFonasa: '01-01-001' },
      { id: 2, nombre: 'Inválida' } // faltan campos obligatorios
    ]
    const result = listaPrestacionesSchema.safeParse(prestaciones)
    expect(result.success).toBe(false)
  })
})

describe('validarListaPrestaciones (F2-04d)', () => {
  it('retorna valido: true y datos correctos para lista válida', () => {
    const prestaciones = [
      { id: 1, nombre: 'Test', especialidad: 'Diagnóstico y Prevención', precioParticular: 10000, precioFonasa: 8000, codigoFonasa: '01-01-001' }
    ]
    const result = validarListaPrestaciones(prestaciones)
    expect(result.valido).toBe(true)
    expect(result.datos).toHaveLength(1)
    expect(result.error).toBeNull()
  })

  it('retorna valido: false y error para lista inválida', () => {
    const prestaciones = [
      { id: 1, nombre: 'Test' } // faltan especialidad, precios, codigo
    ]
    const result = validarListaPrestaciones(prestaciones)
    expect(result.valido).toBe(false)
    expect(result.datos).toBeNull()
    expect(result.error).not.toBeNull()
  })

  it('maneja entrada null/undefined retornando valido: false', () => {
    expect(validarListaPrestaciones(null).valido).toBe(false)
    expect(validarListaPrestaciones(undefined).valido).toBe(false)
    expect(validarListaPrestaciones('no es array').valido).toBe(false)
  })
})
