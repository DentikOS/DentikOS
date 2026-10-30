import { describe, expect, it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'

const estado = vi.hoisted(() => ({ clinica: '11111111-1111-4111-8111-111111111111' as string | null,
  listar: vi.fn() }))
vi.mock('../../../../../../infrastructure/auth/authService', () => ({ getClinicaActivaSync: () => estado.clinica }))
vi.mock('../../../../../../infrastructure/storage/r2ArchivosService', () => ({ listaArchivosDePaciente: estado.listar }))

import { derivacionPDFService } from './derivacionPDFService'

const datos = {
  pacienteId: '22222222-2222-4222-8222-222222222222', pacienteNombre: 'Paciente de prueba',
  pacienteRut: '12.345.678-9', derivacion: {
    id: '33333333-3333-4333-8333-333333333333', fecha: '2026-10-30T12:00:00Z',
    especialidad: 'Endodoncia', especialista: 'Dra. Prueba', motivo: 'Hallazgo revisado',
    diagnostico: 'Diagnóstico revisado', prioridad: 'normal' as const, emisor: 'Dr. Ejemplo',
    archivoIds: ['44444444-4444-4444-8444-444444444444'], incluirOdontograma: true,
    incluirEvoluciones: true,
  },
}

describe('derivacionPDFService', () => {
  it('genera una ficha legible con referencias, sin afirmar firma digital', async () => {
    estado.clinica = '11111111-1111-4111-8111-111111111111'
    estado.listar.mockResolvedValue([{ id: datos.derivacion.archivoIds[0],
      paciente_id: datos.pacienteId, clinica_id: estado.clinica, categoria: 'radiografia',
      nombre_archivo: 'radiografia-ejemplo.png' }])
    const doc = await derivacionPDFService.generar(datos)
    const bytes = Buffer.from(doc.output('arraybuffer'))
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
    expect(bytes.length).toBeGreaterThan(2000)
    expect(estado.listar).toHaveBeenCalledWith(datos.pacienteId)
    if (process.env.DERIVACION_PDF_PREVIEW === '1') {
      writeFileSync('/private/tmp/derivacion_bp06_preview.pdf', bytes)
    }
  })

  it('no genera la ficha sin clínica activa', async () => {
    estado.clinica = null
    await expect(derivacionPDFService.generar(datos)).rejects.toThrow('clínica')
  })

  it('continúa en otra página cuando el motivo clínico es extenso', async () => {
    estado.clinica = '11111111-1111-4111-8111-111111111111'
    estado.listar.mockResolvedValue([])
    const doc = await derivacionPDFService.generar({ ...datos,
      derivacion: { ...datos.derivacion, motivo: 'Motivo clínico revisado. '.repeat(450) } })
    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
  })
})
