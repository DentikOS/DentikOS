import { describe, expect, it } from 'vitest'
import { generarHashReceta, type ContenidoHashReceta } from './recetaHash'

const contenido: ContenidoHashReceta = {
  id: 'dddddddd-0000-4000-8000-000000000004',
  paciente_id: 'bbbbbbbb-0000-4000-8000-000000000002',
  fecha: '2026-11-05',
  profesional: 'Dra. Prueba',
  medicamentos: [{ nombre: 'Medicamento', dosis: '1 unidad', frecuencia: 'Cada 12 horas', duracion: '5 días' }],
  diagnostico: null,
  indicaciones: null,
  qr_token: 'token-de-prueba',
}

describe('generarHashReceta', () => {
  it('calcula un SHA-256 reproducible de los campos persistidos', async () => {
    const first = await generarHashReceta(contenido)
    const second = await generarHashReceta({ ...contenido, medicamentos: [{ ...contenido.medicamentos[0] }] })

    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(first).toBe(second)
    await expect(generarHashReceta({ ...contenido, indicaciones: 'Cambio posterior' })).resolves.not.toBe(first)
  })
})
