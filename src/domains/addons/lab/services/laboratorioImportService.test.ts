import { describe, expect, it } from 'vitest'
import { laboratorioImportService } from './laboratorioImportService'

const patientId = '11111111-1111-4111-8111-111111111111'
const labId = '22222222-2222-4222-8222-222222222222'
const typeId = '33333333-3333-4333-8333-333333333333'

describe('laboratorioImportService', () => {
  const refs = {
    pacientes: [{ id: patientId, nombre: 'Paciente Uno', rut: '11-1' }],
    laboratorios: [{ id: labId, nombre: 'Lab Norte' }],
    tiposTrabajo: [{ id: typeId, nombre: 'Corona Zirconio', categoria: 'protesis_fija' as const }]
  }

  it('previsualiza una orden con referencias UUID conocidas sin cambiar su fuente', () => {
    const legacy = [{ id: 91, codigoOrden: 'LAB-2024-300', pacienteId: patientId,
      pacienteNombre: 'Paciente Uno', laboratorioId: 'legacy-4', laboratorioNombre: 'lab norte',
      tipoTrabajo: 'Corona Zirconio', etapa: 'Enviado', fechaEnvio: '2024-02-01' }]
    const preview = laboratorioImportService.previsualizar(legacy, refs)

    expect(preview.importables).toHaveLength(1)
    expect(preview.importables[0].input).toEqual(expect.objectContaining({
      pacienteId: patientId, laboratorioId: labId, tipoTrabajoId: typeId
    }))
    expect(legacy[0].id).toBe(91)
  })

  it('mantiene en revisión referencias ausentes o ajenas a las referencias de la clínica', () => {
    const preview = laboratorioImportService.previsualizar([
      { id: 92, pacienteId: '44444444-4444-4444-8444-444444444444', pacienteNombre: 'Otro',
        laboratorioId: labId, laboratorioNombre: 'Lab Norte', tipoTrabajo: 'Corona Zirconio' },
      { id: 93, pacienteId: patientId, pacienteNombre: 'Paciente Uno',
        laboratorioId: 'legacy-9', laboratorioNombre: 'Lab Desconocido', tipoTrabajo: 'Tipo Nuevo' }
    ], refs)

    expect(preview.importables).toHaveLength(0)
    expect(preview.pendientesRevision).toHaveLength(2)
    expect(preview.pendientesRevision[0].motivos).toContain('paciente_no_resuelto')
    expect(preview.pendientesRevision[1].motivos).toContain('laboratorio_no_resuelto')
    expect(preview.pendientesRevision[1].motivos).toContain('tipo_trabajo_no_resuelto')
  })

  it('identifica el registro de demostración histórico y lo excluye de importación', () => {
    const preview = laboratorioImportService.previsualizar([
      { id: 101, codigoOrden: 'LAB-2026-101', pacienteId: 1, pacienteNombre: 'Ejemplo',
        laboratorioId: 1, laboratorioNombre: 'Ejemplo', tipoTrabajo: 'Corona Zirconio' }
    ], refs)

    expect(preview.importables).toHaveLength(0)
    expect(preview.omitidosDemo).toBe(1)
  })
})
