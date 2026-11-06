import { describe, expect, it } from 'vitest'
import { validarContextoPendiente, type ComandoUrgenciaPendiente } from './urgenciasGesOfflineQueueService'
import { coincideConPayload } from './urgenciasGesCloudService'

const comando: ComandoUrgenciaPendiente = {
  id: 'd0000000-0000-4000-8000-000000000001',
  recordId: '8fc89af5-30a2-4ee9-a8c0-61ef5ae93ac2',
  clinicaId: 'a0000000-0000-4000-8000-000000000001',
  actorUserId: 'b0000000-0000-4000-8000-000000000001',
  createdAtLocal: '2026-11-05T12:00:00.000Z',
  kind: 'ingreso',
  payload: {
    id: '8fc89af5-30a2-4ee9-a8c0-61ef5ae93ac2',
    clinica_id: 'a0000000-0000-4000-8000-000000000001',
    paciente_id: 'c0000000-0000-4000-8000-000000000001'
  },
  attempts: 0
}

describe('validarContextoPendiente', () => {
  it('permite reintentar solo con la misma clínica y usuario que inició el comando', () => {
    expect(() => validarContextoPendiente(comando, comando.clinicaId, comando.actorUserId)).not.toThrow()
  })

  it('rechaza la sincronización si cambió la clínica activa', () => {
    expect(() => validarContextoPendiente(comando, 'a0000000-0000-4000-8000-000000000002', comando.actorUserId))
      .toThrow(/clínica/i)
  })

  it('rechaza la sincronización si cambió el usuario autenticado', () => {
    expect(() => validarContextoPendiente(comando, comando.clinicaId, 'b0000000-0000-4000-8000-000000000002'))
      .toThrow(/usuario/i)
  })

  it('rechaza payloads con una clínica distinta de la cola', () => {
    const cruzado = { ...comando, payload: { ...comando.payload, clinica_id: 'a0000000-0000-4000-8000-000000000002' } }
    expect(() => validarContextoPendiente(cruzado, comando.clinicaId, comando.actorUserId))
      .toThrow(/clínica/i)
  })
})

describe('coincideConPayload', () => {
  it('reconcilia numeric PostgreSQL cuando llega como string decimal', () => {
    expect(coincideConPayload({ id: 'a', arancel_pactado: '12000.00' }, { id: 'a', arancel_pactado: 12000 })).toBe(true)
  })

  it('rechaza un UUID existente si pertenece a otra clínica o a otro paciente', () => {
    expect(coincideConPayload(
      { id: 'a', clinica_id: 'clinica-b', paciente_id: 'paciente-a' },
      { id: 'a', clinica_id: 'clinica-a', paciente_id: 'paciente-a' }
    )).toBe(false)
  })
})
