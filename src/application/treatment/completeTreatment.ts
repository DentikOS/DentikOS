/**
 * Application Service: completeTreatment (Fase 4B-1)
 *
 * Coordina el ciclo de mutación Tratamiento / Paciente / Inventario:
 * 1. Marcar tratamiento como "Realizado"
 * 2. Descontar materiales del inventario según asociaciones insumo-tratamiento
 * 3. Registrar la nota correspondiente en la bitácora de evoluciones clínicas
 *
 * Consume EXCLUSIVAMENTE las APIs públicas de los dominios:
 * - domains/clinical/patient
 * - domains/operations/inventory
 */
import {
  evolucionesStorageService,
  type EvolucionClinicaLocal,
} from '../../domains/clinical/patient'
import {
  inventarioStorageService,
  descontarMaterialesSeleccionados,
  detectarCategoriaTratamiento,
  PALABRAS_CLAVE_POR_CATEGORIA_DEFAULT,
} from '../../domains/operations/inventory'
import { createLogger } from '../../infrastructure/logging/logger'

const log = createLogger('completeTreatment')

export interface MaterialEnriquecido {
  itemId: string | number
  nombreInsumo: string
  cantidad: number | string
  unidad: string
  stockActual: number
  stockPorUbicacion?: Record<string, number>
}

export interface ItemTratamiento {
  id: string | number
  prestacion?: string
  pieza?: string
  estado?: string
  [key: string]: unknown
}

export interface CompletarTratamientoParams {
  pacienteId: string | number
  item: ItemTratamiento
  tratamientoRef?: string
  profesional?: string
  evolucionesPrevias?: EvolucionClinicaLocal[]
  materialesSeleccionados?: unknown[]
}

export interface CompletarTratamientoResult {
  evolucionesActualizadas: EvolucionClinicaLocal[]
  descuentoExitoso: boolean
}

/**
 * Registra la nota de evolución clínica para un tratamiento realizado.
 */
export const registrarEvolucionTratamientoRealizado = async (
  pacienteId: string | number,
  item: ItemTratamiento,
  profesional: string = 'Cirujano Dentista',
  evolucionesNotas: EvolucionClinicaLocal[] = [],
  tratamientoRef: string = String(item.id || '')
): Promise<EvolucionClinicaLocal[]> => {
  if (!tratamientoRef.trim()) throw new Error('La referencia del tratamiento es obligatoria para cerrarlo.')
  const nuevaNota = await evolucionesStorageService.guardarEvolucionTratamientoRealizadoSincronizada(
    String(pacienteId),
    tratamientoRef,
    `TRATAMIENTO REALIZADO: ${item.prestacion || 'Sin prestación'} (Pieza: ${item.pieza || 'General'}) — Ejecutado por: ${profesional}`
  )
  return [nuevaNota, ...evolucionesNotas.filter((nota) =>
    nota.id !== nuevaNota.id && (nota.tratamientoRef || nota.tratamiento_ref) !== tratamientoRef
  )]
}

/**
 * Detecta la categoría del tratamiento y enriquece los materiales sugeridos
 * para el modal de descuento según el stock disponible en inventario.
 */
export const prepararMaterialesParaDescuento = (
  prestacion: string,
  palabrasClaveCustom?: Record<string, string[]>
): {
  categoria: string
  materiales: MaterialEnriquecido[]
} => {
  try {
    const asociaciones =
      (inventarioStorageService.obtenerAsociacionesInsumos() as Record<string, Array<{ itemId?: string | number; nombreInsumo?: string; cantidad?: number | string; unidad?: string }>>) || {}

    let palabrasClave = palabrasClaveCustom || PALABRAS_CLAVE_POR_CATEGORIA_DEFAULT
    if (!palabrasClaveCustom && typeof localStorage !== 'undefined') {
      try {
        const guardadas = localStorage.getItem('studio_dental_inventario_palabras_clave')
        if (guardadas) {
          palabrasClave = JSON.parse(guardadas)
        }
      } catch {
        // Usar default si hay error
      }
    }

    const categoria = String(
      detectarCategoriaTratamiento(prestacion, asociaciones, palabrasClave) || ''
    )
    const materialesCategoria = asociaciones[categoria] || []
    const inventarioActual = (inventarioStorageService.obtenerItems([]) || []) as Array<{ id: string | number; nombre?: string; unidad?: string; cantidad?: number | string }>

    const materiales: MaterialEnriquecido[] = materialesCategoria
      .filter((m) => m.itemId)
      .map((m) => {
        const itemInv = inventarioActual.find((i) => String(i.id) === String(m.itemId))
        return {
          itemId: m.itemId!,
          nombreInsumo: String(itemInv?.nombre || m.nombreInsumo || ''),
          cantidad: m.cantidad ?? 1,
          unidad: String(itemInv?.unidad || m.unidad || 'Unidad'),
          stockActual: parseFloat(String(itemInv?.cantidad ?? 0)) || 0,
        }
      })

    return { categoria, materiales }
  } catch (e) {
    log.error('Error al preparar materiales para descuento:', e)
    return { categoria: '', materiales: [] }
  }
}

/**
 * Aplica el descuento de materiales seleccionados en el inventario.
 */
export const descontarMateriales = (materialesSeleccionados: unknown[]): boolean => {
  try {
    const inventarioGuardado = inventarioStorageService.obtenerItems([])
    if (
      Array.isArray(inventarioGuardado) &&
      inventarioGuardado.length > 0 &&
      Array.isArray(materialesSeleccionados) &&
      materialesSeleccionados.length > 0
    ) {
      const inventarioActualizado = descontarMaterialesSeleccionados(
        inventarioGuardado,
        materialesSeleccionados
      )
      inventarioStorageService.guardarItems(inventarioActualizado)
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('inventario_actualizado'))
      }
      return true
    }
    return false
  } catch (e) {
    log.error('Error al descontar materiales de inventario:', e)
    return false
  }
}

/**
 * Orquestación principal: completa un tratamiento registrando evolución y descontando inventario.
 */
export const completarTratamiento = async ({
  pacienteId,
  item,
  tratamientoRef,
  profesional,
  evolucionesPrevias = [],
  materialesSeleccionados = [],
}: CompletarTratamientoParams): Promise<CompletarTratamientoResult> => {
  const evolucionesActualizadas = await registrarEvolucionTratamientoRealizado(
    pacienteId,
    item,
    profesional,
    evolucionesPrevias,
    tratamientoRef || String(item.id)
  )

  let descuentoExitoso = false
  if (materialesSeleccionados.length > 0) {
    descuentoExitoso = descontarMateriales(materialesSeleccionados)
  }

  return {
    evolucionesActualizadas,
    descuentoExitoso,
  }
}
