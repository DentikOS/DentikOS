import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FormularioFichaUrgencia } from './FormularioFichaUrgencia'
import type { IngresoUrgencia, TriageUrgencia } from '../services/urgenciasGesTypes'

const ingreso: IngresoUrgencia = {
  id: 'ingreso-1', clinica_id: 'clinica-1', paciente_id: 'paciente-1',
  estado_cola: 'en_atencion', created_at: '2026-11-06T12:00:00.000Z'
}

const triage: TriageUrgencia = {
  id: ingreso.id, clinica_id: ingreso.clinica_id, severidad: 'moderada',
  presion_sistolica: null, presion_diastolica: null, frecuencia_cardiaca: null,
  saturacion_oxigeno: null, temperatura_c: null, eva: null,
  patologia_sospechada_id: null, nota_triage: null, version: 1,
  created_at: ingreso.created_at, updated_at: ingreso.created_at
}

const renderForm = (alCrear = vi.fn().mockResolvedValue(undefined)) => {
  render(<FormularioFichaUrgencia
    ingresos={[ingreso]} triajes={[triage]} fichas={[]} configuraciones={[]}
    pacientes={[{ id: ingreso.paciente_id, nombre: 'Paciente sintético', clinicaId: ingreso.clinica_id }]}
    alCrear={alCrear}
  />)
  return alCrear
}

describe('FormularioFichaUrgencia', () => {
  beforeEach(() => vi.clearAllMocks())

  it('precarga diagnóstico y pasos editables al elegir patología y guarda solo el contenido que deja el dentista', async () => {
    const alCrear = renderForm()
    fireEvent.change(screen.getByLabelText('Llegada con triage'), { target: { value: ingreso.id } })
    fireEvent.change(screen.getByLabelText('Patología GES'), { target: { value: 'pulpitis' } })

    expect(screen.getByLabelText('Diagnóstico clínico')).toHaveValue('Pulpitis irreversible')
    const tratamiento = screen.getByLabelText('Tratamiento realizado (una entrada por línea)')
    expect((tratamiento as HTMLTextAreaElement).value).toContain('Apertura cameral: Acceso endodóntico de urgencia')

    fireEvent.change(tratamiento, { target: { value: 'Apertura cameral: Acceso endodóntico de urgencia\nObturación provisoria: Óxido de zinc eugenol (BP11 #91)' } })
    fireEvent.change(screen.getByLabelText('Indicaciones registradas para el paciente'), { target: { value: 'Indicaciones confirmadas por el dentista' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha' }))

    expect(alCrear).toHaveBeenCalledWith(ingreso.id, expect.objectContaining({
      patologia_id: 'pulpitis',
      diagnostico_clinico: 'Pulpitis irreversible',
      tratamiento_realizado: [
        'Apertura cameral: Acceso endodóntico de urgencia',
        'Obturación provisoria: Óxido de zinc eugenol (BP11 #91)'
      ],
      indicaciones_post: 'Indicaciones confirmadas por el dentista'
    }))
  })

  it('no reemplaza texto editado en silencio al cambiar patología; permite cargar el otro protocolo explícitamente', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Llegada con triage'), { target: { value: ingreso.id } })
    fireEvent.change(screen.getByLabelText('Patología GES'), { target: { value: 'pulpitis' } })
    fireEvent.change(screen.getByLabelText('Tratamiento realizado (una entrada por línea)'), { target: { value: 'Tratamiento escrito por el dentista' } })
    fireEvent.change(screen.getByLabelText('Patología GES'), { target: { value: 'pericoronaritis_aguda' } })

    expect(screen.getByLabelText('Diagnóstico clínico')).toHaveValue('Pulpitis irreversible')
    expect(screen.getByLabelText('Tratamiento realizado (una entrada por línea)')).toHaveValue('Tratamiento escrito por el dentista')
    fireEvent.click(screen.getByRole('button', { name: 'Cargar protocolo' }))
    expect(screen.getByLabelText('Diagnóstico clínico')).toHaveValue('Pericoronaritis (terceros molares)')
  })
})
