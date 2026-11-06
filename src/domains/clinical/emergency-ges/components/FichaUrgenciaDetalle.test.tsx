import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FichaUrgenciaDetalle } from './FichaUrgenciaDetalle'
import type { EventoUrgencia, FichaUrgencia, IngresoUrgencia, TriageUrgencia } from '../services/urgenciasGesTypes'

const ID = '8fc89af5-30a2-4ee9-a8c0-61ef5ae93ac2'
const ingreso: IngresoUrgencia = {
  id: ID, clinica_id: 'a0000000-0000-4000-8000-000000000001',
  paciente_id: 'c0000000-0000-4000-8000-000000000001', estado_cola: 'en_atencion',
  created_at: '2026-11-05T10:00:00.000Z'
}
const triage: TriageUrgencia = {
  id: ID, clinica_id: ingreso.clinica_id, severidad: 'moderada', presion_sistolica: 120,
  presion_diastolica: 80, frecuencia_cardiaca: 72, saturacion_oxigeno: 98,
  temperatura_c: 36.8, eva: 4, patologia_sospechada_id: null, nota_triage: null,
  version: 1, created_at: ingreso.created_at, updated_at: ingreso.created_at
}
const ficha: FichaUrgencia = {
  id: ID, clinica_id: ingreso.clinica_id, folio: 'URG-2026-00000001', patologia_id: 'pulpitis',
  codigo_fonasa: null, arancel_pactado_snapshot: null, descripcion_convenio_snapshot: null,
  previsiones_convenio_snapshot: [], diagnostico_clinico: 'Diagnóstico de prueba',
  diagnostico_cie10: null, piezas_afectadas: [], tratamiento_realizado: [],
  requiere_derivacion: false, centro_derivacion: null, motivo_derivacion: null,
  indicaciones_post: 'Indicaciones registradas', control_programado: null,
  profesional_id: 'b0000000-0000-4000-8000-000000000001', estado: 'en_atencion',
  fecha_hora_atencion: '2026-11-05T10:10:00.000Z', fecha_hora_fin: null,
  version: 1, created_at: '2026-11-05T10:10:00.000Z', updated_at: '2026-11-05T10:10:00.000Z'
}

const renderFicha = (overrides: Partial<React.ComponentProps<typeof FichaUrgenciaDetalle>> = {}) => {
  const props = {
    ficha, ingreso, triage, eventos: [] as EventoUrgencia[],
    alGuardarCambios: vi.fn().mockResolvedValue(undefined),
    alCambiarEstado: vi.fn().mockResolvedValue(undefined),
    alAgregarEnmienda: vi.fn().mockResolvedValue(undefined),
    ...overrides
  }
  return { ...render(<FichaUrgenciaDetalle {...props} />), props }
}

describe('FichaUrgenciaDetalle', () => {
  it('imprime una copia clínica que aclara que no es formulario oficial ni firma electrónica', () => {
    renderFicha()
    expect(screen.getByText(/no es el formulario oficial de notificación GES ni una firma electrónica/i)).toBeInTheDocument()
  })

  it('bloquea el cierre y la impresión de una ficha pendiente', () => {
    renderFicha({ ficha: { ...ficha, estado_sincronizacion: 'pendiente' } })
    expect(screen.getByRole('button', { name: 'Imprimir registro' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirmar estado' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/pendiente/i)
  })

  it('guarda los cambios clínicos de una ficha abierta mediante el callback versionado', async () => {
    const { props } = renderFicha()
    fireEvent.click(screen.getByRole('button', { name: 'Editar ficha' }))
    fireEvent.change(screen.getByLabelText('Diagnóstico'), { target: { value: 'Diagnóstico corregido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios clínicos' }))

    await waitFor(() => expect(props.alGuardarCambios).toHaveBeenCalledWith(ficha, expect.objectContaining({
      diagnostico_clinico: 'Diagnóstico corregido'
    })))
  })

  it('registra una enmienda sin editar una ficha finalizada', async () => {
    const finalizada: FichaUrgencia = { ...ficha, estado: 'cerrada', fecha_hora_fin: '2026-11-05T10:30:00.000Z' }
    const { props } = renderFicha({ ficha: finalizada })
    expect(screen.queryByRole('button', { name: 'Editar ficha' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Motivo \(mínimo 10 caracteres\)/), { target: { value: 'Aclarar el dato consignado' } })
    fireEvent.change(screen.getByLabelText('Aclaración registrada'), { target: { value: 'La corrección se incorpora como una nota de seguimiento.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar enmienda' }))

    await waitFor(() => expect(props.alAgregarEnmienda).toHaveBeenCalledWith(ID, 'Aclarar el dato consignado', {
      correccion_registrada: 'La corrección se incorpora como una nota de seguimiento.'
    }))
  })

  it('identifica una enmienda local que aún no se sincroniza', () => {
    const eventoPendiente: EventoUrgencia = {
      id: '9fc89af5-30a2-4ee9-a8c0-61ef5ae93ac2', clinica_id: ingreso.clinica_id,
      ingreso_id: ID, configuracion_id: null, actor_user_id: 'b0000000-0000-4000-8000-000000000001',
      evento_tipo: 'enmienda_agregada', datos: { despues: {} },
      created_at: '2026-11-05T10:35:00.000Z', estado_sincronizacion: 'pendiente'
    }
    renderFicha({ ficha: { ...ficha, estado: 'cerrada' }, eventos: [eventoPendiente] })
    expect(screen.getByText(/Pendiente de sincronización/)).toBeInTheDocument()
  })
})
