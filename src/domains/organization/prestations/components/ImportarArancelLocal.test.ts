import { describe, expect, it } from 'vitest'
import { candidatosArancelLocal } from './ImportarArancelLocal'
import { ARANCEL_DEFAULT } from '../constants/prestacionesConstants'

describe('candidatosArancelLocal', () => {
  it('excluye los precios de ejemplo intactos y las prestaciones ya sincronizadas', () => {
    const propia = { id: 999, nombre: 'Control personalizado', especialidad: 'Diagnóstico', precioParticular: 18000, precioFonasa: 0, codigoFonasa: '' }
    const remota = { ...propia, id: '11111111-1111-4111-8111-111111111111' }
    const otras = { ...propia, id: 1000, nombre: 'Otra prestación' }
    expect(candidatosArancelLocal([...ARANCEL_DEFAULT, propia, otras], [remota])).toEqual([otras])
  })

  it('ofrece un precio de ejemplo que fue modificado explícitamente', () => {
    const editada = { ...ARANCEL_DEFAULT[0], precioParticular: 19000 }
    expect(candidatosArancelLocal([editada], [])).toEqual([editada])
  })
})
