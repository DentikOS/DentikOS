import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { dibujarMembreteClinicaPdf } from './dibujarMembreteClinicaPdf'
import { normalizarConfiguracionMembrete } from '../schemas/configuracionMembreteSchema'

describe('dibujarMembreteClinicaPdf', () => {
  it('usa el alto minimalista y genera un PDF válido sin datos adicionales', async () => {
    const doc = new jsPDF({ format: 'letter', unit: 'mm' })
    const y = await dibujarMembreteClinicaPdf(doc, {
      nombreClinica: 'Clínica Compartida',
      configuracionMembrete: normalizarConfiguracionMembrete({
        diseno: 'minimalista',
        mostrar: { nombre: true, logo: false },
      }),
    })

    expect(y).toBe(31)
    expect(Buffer.from(doc.output('arraybuffer')).subarray(0, 4).toString()).toBe('%PDF')
  })

  it('mantiene un alto estable en el diseño clásico cuando la clínica no tiene datos públicos', async () => {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' })
    const y = await dibujarMembreteClinicaPdf(doc, {
      configuracionMembrete: normalizarConfiguracionMembrete({
        diseno: 'clasico',
        mostrar: {
          logo: false, nombre: false, rut: false, direccion: false, telefono: false,
          email: false, sitioWeb: false, registroSeremi: false, registroIsp: false,
        },
      }),
    })

    expect(y).toBe(36)
  })
})
