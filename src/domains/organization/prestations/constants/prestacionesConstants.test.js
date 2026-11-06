import { describe, it, expect } from 'vitest'
import {
  ESPECIALIDADES_ODONTOLOGICAS,
  ARANCEL_DEFAULT,
  PAQUETES_CLINICOS_DEFAULT
} from './prestacionesConstants'

describe('prestacionesConstants', () => {
  it('contiene las especialidades odontologicas', () => {
    expect(ESPECIALIDADES_ODONTOLOGICAS).toContain('Diagnóstico y Prevención')
    expect(ESPECIALIDADES_ODONTOLOGICAS).toContain('Endodoncia')
    expect(ESPECIALIDADES_ODONTOLOGICAS).toContain('Implantología')
  })

  it('contiene prestaciones de arancel con precio base y código FONASA, sin tarifas de convenio de ejemplo', () => {
    expect(ARANCEL_DEFAULT.length).toBe(10)
    ARANCEL_DEFAULT.forEach(item => {
      expect(item.id).toBeDefined()
      expect(item.nombre).toBeDefined()
      expect(item.precioParticular).toBeGreaterThan(0)
      expect(item.precioFonasa).toBeNull()
      expect(item.codigoFonasa).toMatch(/^\d{2}-\d{2}-\d{3}$/)
    })
  })

  it('contiene paquetes clinicos con precios combo', () => {
    expect(PAQUETES_CLINICOS_DEFAULT.length).toBeGreaterThan(0)
    PAQUETES_CLINICOS_DEFAULT.forEach(pkg => {
      expect(pkg.precioCombo).toBeGreaterThan(0)
    })
  })
})
