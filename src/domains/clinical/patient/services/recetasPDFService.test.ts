import { describe, expect, it } from 'vitest'
import { recetasPDFService } from './recetasPDFService'

describe('recetasPDFService', () => {
  it('genera el PDF de receta incorporando el membrete compartido de la clínica', async () => {
    const doc = await recetasPDFService.generarRecetaPDF({
      pacienteNombre: 'Paciente de prueba',
      pacienteRut: '12.345.678-9',
      profesional: 'Dra. Ejemplo',
      medicamentos: [{ nombre: 'Medicamento de prueba', dosis: '500 mg', frecuencia: 'Cada 8 horas', duracion: '7 días' }],
      indicaciones: 'Seguir la pauta indicada.',
      fecha: '2026-11-05T12:00:00.000Z',
      hashForense: 'HASH-DE-PRUEBA',
      qrToken: 'TOKEN-DE-PRUEBA',
      clinica: { nombreClinica: 'Clínica Compartida', configuracionMembrete: undefined },
    })

    expect(doc.getNumberOfPages()).toBe(1)
    expect(Buffer.from(doc.output('arraybuffer')).subarray(0, 4).toString()).toBe('%PDF')
  })
})
