import { describe, expect, it } from 'vitest'
import { obtenerPlantillaCatalogo, PLANTILLAS_CATALOGO } from './prestacionesPlantillas'

describe('plantillas de catálogo BP08', () => {
  it.each([
    ['general', 20],
    ['ortodoncia', 30],
    ['cirugia_rehabilitacion', 35],
  ] as const)('%s contiene %i prestaciones', (id, cantidad) => {
    expect(obtenerPlantillaCatalogo(id)).toHaveLength(cantidad)
  })

  it('conserva los códigos internos y no los confunde con códigos Fonasa', () => {
    const plantilla = obtenerPlantillaCatalogo('general')
    expect(plantilla.find((item) => item.codigoInterno === 'PRE-01')).toMatchObject({
      nombre: 'Limpieza dental (profilaxis)',
      categoria: 'Preventivo',
      precioParticular: 50000,
      precioFonasa: null,
    })
    expect(new Set(plantilla.map((item) => item.codigoInterno)).size).toBe(20)
  })

  it('incluye las especialidades de ortodoncia y cirugía + rehabilitación según BP08', () => {
    expect(obtenerPlantillaCatalogo('ortodoncia').some((item) => item.codigoInterno === 'ORT-07' && item.precioParticular === 3500000)).toBe(true)
    const cirugia = obtenerPlantillaCatalogo('cirugia_rehabilitacion')
    expect(cirugia.some((item) => item.codigoInterno === 'CIR-17'))
    expect(cirugia.some((item) => item.codigoInterno === 'REH-07'))
    expect(PLANTILLAS_CATALOGO.map((item) => item.prestaciones.length)).toEqual([20, 30, 35])
  })
})
