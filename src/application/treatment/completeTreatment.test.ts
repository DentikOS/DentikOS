import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  registrarEvolucionTratamientoRealizado,
  prepararMaterialesParaDescuento,
  descontarMateriales,
  completarTratamiento,
} from './completeTreatment'
import { evolucionesStorageService } from '../../domains/clinical/patient'
import { inventarioStorageService } from '../../domains/operations/inventory'

describe('completeTreatment (Application Service)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('registrarEvolucionTratamientoRealizado', () => {
    it('debe crear y persistir nota de evolución clínica con datos del tratamiento', async () => {
      const spyGuardar = vi
        .spyOn(evolucionesStorageService, 'guardarEvoluciones')
        .mockResolvedValue(true)
      const spyCierre = vi.spyOn(evolucionesStorageService, 'guardarEvolucionTratamientoRealizadoSincronizada')
        .mockImplementation(async (pacienteId, tratamientoRef, texto) => ({
          id: 'evo-1', fecha: new Date().toISOString(), texto, tipo: 'tratamiento_realizado',
          sincronizado: true, pacienteId, tratamientoRef,
        }))

      const notas = await registrarEvolucionTratamientoRealizado(
        'pac-100',
        { id: 'item-1', prestacion: 'Destartraje supragingival', pieza: '1.1' },
        'Dr. Silva'
      )

      expect(notas).toHaveLength(1)
      expect(notas[0].texto).toContain('TRATAMIENTO REALIZADO: Destartraje supragingival')
      expect(notas[0].texto).toContain('Pieza: 1.1')
      expect(notas[0].texto).toContain('Dr. Silva')
      expect(spyCierre).toHaveBeenCalledWith('pac-100', 'item-1', expect.stringContaining('TRATAMIENTO REALIZADO'))
      expect(spyGuardar).not.toHaveBeenCalled()
    })
  })

  describe('prepararMaterialesParaDescuento', () => {
    it('debe detectar la categoría y enriquecer los insumos con stock actual', () => {
      vi.spyOn(inventarioStorageService, 'obtenerAsociacionesInsumos').mockReturnValue({
        Prevención: [
          { itemId: 'inv-1', nombreInsumo: 'Pasta profiláctica', cantidad: 1, unidad: 'Pomo' },
        ],
      })
      vi.spyOn(inventarioStorageService, 'obtenerItems').mockReturnValue([
        { id: 'inv-1', nombre: 'Pasta profiláctica premium', cantidad: 15, unidad: 'Pomo' } as any,
      ])

      const { categoria, materiales } = prepararMaterialesParaDescuento(
        'Limpieza dental y profilaxis',
        { Prevención: ['limpieza', 'profilaxis'] }
      )

      expect(categoria).toBe('Prevención')
      expect(materiales).toHaveLength(1)
      expect(materiales[0].itemId).toBe('inv-1')
      expect(materiales[0].stockActual).toBe(15)
      expect(materiales[0].nombreInsumo).toBe('Pasta profiláctica premium')
    })
  })

  describe('descontarMateriales', () => {
    it('debe descontar inventario y emitir evento si hay materiales seleccionados', () => {
      const mockItems = [
        { id: 'inv-1', nombre: 'Anestesia tubo', cantidad: 50, unidad: 'Tubo' },
      ]
      vi.spyOn(inventarioStorageService, 'obtenerItems').mockReturnValue(mockItems as any)
      const spyGuardar = vi.spyOn(inventarioStorageService, 'guardarItems').mockImplementation(() => {})
      const spyDispatch = vi.spyOn(window, 'dispatchEvent')

      const res = descontarMateriales([
        { itemId: 'inv-1', cantidad: 2 },
      ])

      expect(res).toBe(true)
      expect(spyGuardar).toHaveBeenCalled()
      expect(spyDispatch).toHaveBeenCalled()
    })

    it('debe retornar false si no hay materiales seleccionados', () => {
      const res = descontarMateriales([])
      expect(res).toBe(false)
    })
  })

  describe('completarTratamiento', () => {
    it('debe coordinar registro de evolución y descuento de inventario', async () => {
      vi.spyOn(evolucionesStorageService, 'guardarEvolucionTratamientoRealizadoSincronizada')
        .mockImplementation(async (pacienteId, tratamientoRef, texto) => ({
          id: 'evo-1', fecha: new Date().toISOString(), texto, tipo: 'tratamiento_realizado',
          sincronizado: true, pacienteId, tratamientoRef,
        }))
      vi.spyOn(inventarioStorageService, 'obtenerItems').mockReturnValue([
        { id: 'inv-1', cantidad: 10 } as any,
      ])
      vi.spyOn(inventarioStorageService, 'guardarItems').mockImplementation(() => {})

      const resultado = await completarTratamiento({
        pacienteId: 'pac-1',
        item: { id: 'it-1', prestacion: 'Obturación resina', pieza: '2.4' },
        profesional: 'Dra. Morales',
        materialesSeleccionados: [{ itemId: 'inv-1', cantidad: 1 }],
      })

      expect(resultado.evolucionesActualizadas).toHaveLength(1)
      expect(resultado.descuentoExitoso).toBe(true)
    })
  })
})
