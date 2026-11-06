/**
 * Tests consolidados para módulo urgenciasGes (F6-K Fase 4)
 *
 * Cubre las constantes y categorías del flujo de urgencia vigente.
 *
 * Patrón de tests:
 * - Funciones puras: validación de formato y comportamiento
 * - Constantes: validación de estructura y contenido
 * - Componentes: renderizado sin errores
 */
import { describe, it, expect } from 'vitest'
import { PATOLOGIAS_GES_ODONTO, CATEGORIAS_TRIAGE_URGENCIA } from './constants/urgenciasGesConstants'

describe('urgenciasGesConstants', () => {
  describe('PATOLOGIAS_GES_ODONTO', () => {
    it('debe contener las ocho urgencias GES oficiales', () => {
      expect(Array.isArray(PATOLOGIAS_GES_ODONTO)).toBe(true)
      expect(PATOLOGIAS_GES_ODONTO).toHaveLength(8)
      expect(PATOLOGIAS_GES_ODONTO.map(p => p.id)).toEqual([
        'pulpitis', 'absceso_odontogenico_localizado', 'absceso_espacios_bucomaxilofaciales',
        'pericoronaritis_aguda', 'flegmones_orofaringeos', 'gingivitis_ulcero_necrotizante',
        'complicaciones_post_exodoncia', 'traumatismo_dentoalveolar'
      ])
    })

    it('cada patología debe tener estructura correcta', () => {
      PATOLOGIAS_GES_ODONTO.forEach(patologia => {
        expect(patologia).toHaveProperty('id')
        expect(patologia).toHaveProperty('nombre')
        expect(patologia).toHaveProperty('numero')
        expect(patologia).toHaveProperty('categoria')
        expect(patologia).toHaveProperty('descripcion')
        
        expect(typeof patologia.id).toBe('string')
        expect(typeof patologia.nombre).toBe('string')
        expect(typeof patologia.numero).toBe('number')
        expect(typeof patologia.categoria).toBe('string')
        expect(typeof patologia.descripcion).toBe('string')
      })
    })

    it('no mezcla programas GES que no son urgencia', () => {
      expect(PATOLOGIAS_GES_ODONTO.map(p => p.id)).not.toEqual(expect.arrayContaining([
        'salud_60_anos', 'embarazada', 'fisura_labiopalatina'
      ]))
    })
  })

  describe('CATEGORIAS_TRIAGE_URGENCIA', () => {
    it('debe usar las tres severidades del BP, sin reglas de triage C1-C4', () => {
      expect(Array.isArray(CATEGORIAS_TRIAGE_URGENCIA)).toBe(true)
      expect(CATEGORIAS_TRIAGE_URGENCIA.map(c => c.id)).toEqual(['leve', 'moderada', 'severa'])
    })

    it('cada categoría debe tener estructura correcta', () => {
      CATEGORIAS_TRIAGE_URGENCIA.forEach(categoria => {
        expect(categoria).toHaveProperty('id')
        expect(categoria).toHaveProperty('nombre')
        expect(typeof categoria.id).toBe('string')
        expect(typeof categoria.nombre).toBe('string')
      })
    })

    it('los IDs deben ser únicos', () => {
      const ids = CATEGORIAS_TRIAGE_URGENCIA.map(c => c.id)
      const idsUnicos = new Set(ids)
      expect(idsUnicos.size).toBe(ids.length)
    })
  })

})
