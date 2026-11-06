import { describe, expect, it } from 'vitest'
import {
  formatearImporteDocumento,
  resolverIdiomaDocumento,
  resolverMonedaDocumento,
  traducirEtiquetaDocumento,
} from './formatoDocumento'

describe('formatoDocumento', () => {
  it('mantiene compatibilidad con datos antiguos sin moneda ni idioma', () => {
    expect(resolverMonedaDocumento(undefined)).toBe('CLP')
    expect(resolverIdiomaDocumento(undefined)).toBe('es-CL')
    expect(formatearImporteDocumento(1250, undefined, undefined)).toContain('CLP')
  })

  it('formatea con la moneda y locale configurados', () => {
    expect(formatearImporteDocumento(1250, 'USD', 'en')).toContain('USD')
    expect(formatearImporteDocumento(1250, 'EUR', 'pt-BR')).toContain('EUR')
  })

  it('usa traducciones de documentos para los idiomas habilitados', () => {
    expect(traducirEtiquetaDocumento('en', 'balanceDue')).toBe('Balance due')
    expect(traducirEtiquetaDocumento('pt-BR', 'paymentReceipt')).toBe('Comprovante de pagamento')
    expect(traducirEtiquetaDocumento('xx', 'patient')).toBe('Paciente')
  })
})
