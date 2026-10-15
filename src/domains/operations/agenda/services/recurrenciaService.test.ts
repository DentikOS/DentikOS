import { describe, it, expect, vi } from 'vitest'
import {
  generarRecurrenceGroupId,
  obtenerPosicionEnSerie,
  obtenerSerieCompleta,
  editarCitaRecurrencia,
  cancelarCitaRecurrencia,
} from './recurrenciaService'

vi.mock('../../../../infrastructure/supabase/supabaseClient', () => ({
  USE_SUPABASE: false,
  supabase: null,
}))

describe('recurrenciaService (BP05 §07)', () => {
  it('genera IDs unicos de serie', () => {
    const id1 = generarRecurrenceGroupId()
    const id2 = generarRecurrenceGroupId()

    expect(id1).toMatch(/^rec-/)
    expect(id2).toMatch(/^rec-/)
    expect(id1).not.toBe(id2)
  })

  it('retorna null si Supabase no esta disponible', async () => {
    const posicion = await obtenerPosicionEnSerie('cita-123')
    expect(posicion).toBeNull()
  })

  it('retorna array vacio en obtenerSerieCompleta si Supabase no esta disponible', async () => {
    const serie = await obtenerSerieCompleta('rec-123')
    expect(serie).toEqual([])
  })

  it('maneja editarCitaRecurrencia y cancelarCitaRecurrencia de forma segura cuando no hay Supabase', async () => {
    await expect(editarCitaRecurrencia('cita-1', { estado: 'Confirmado' }, 'solo_esta')).resolves.not.toThrow()
    await expect(cancelarCitaRecurrencia('cita-1', 'toda_la_serie', 'Motivo')).resolves.not.toThrow()
  })
})
