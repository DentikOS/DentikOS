/**
 * useNavegacionClinica — Hook de navegación entre pacientes (F7-26)
 *
 * Permite navegar entre pacientes con botones anterior/siguiente
 * dentro de la ficha clínica, sin necesidad de volver al directorio.
 *
 * Contrato:
 * - Usa SIEMPRE la lista completa de pacientes del store (no la filtrada
 *   del PacientesListado) para que navegación ← → recorra todos los
 *   pacientes disponibles.
 * - El orden de navegación es alfabético por nombre (predecible).
 * - El hook es idempotente: si el paciente actual no está en la lista
 *   (ej: paciente recién eliminado), retorna estado "fuera de rango".
 * - F7-26: Cada vez que pacienteActual cambia, se agrega al historial
 *   de pacientes recientes (sesionStore) para acceso rápido desde
 *   CommandPalette.
 */
import { useMemo, useCallback, useEffect } from 'react'
import { usePacientesStore } from '../../../../app/stores/pacientesStore'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import type { Paciente } from '../schemas/pacienteSchema'

export interface UseNavegacionClinicaReturn {
  indiceActual: number
  total: number
  hayAnterior: boolean
  haySiguiente: boolean
  anterior: () => void
  siguiente: () => void
  irA: (indice: number) => void
  pacienteActual: Paciente | null | undefined
  listaOrdenada: Paciente[]
}

export const useNavegacionClinica = (
  pacienteActual?: Paciente | null,
  alCambiarPaciente?: (paciente: Paciente) => void
): UseNavegacionClinicaReturn => {
  const pacientes = usePacientesStore((state: { pacientes: Paciente[] }) => state.pacientes)

  // Lista ordenada alfabéticamente por nombre (navegación predecible)
  const pacientesOrdenados = useMemo(
    () => [...(pacientes || [])].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')),
    [pacientes]
  )

  const indiceActual = useMemo(() => {
    if (!pacienteActual) return -1
    return pacientesOrdenados.findIndex((p) => String(p.id) === String(pacienteActual.id))
  }, [pacientesOrdenados, pacienteActual])

  const total = pacientesOrdenados.length
  const hayAnterior = indiceActual > 0
  const haySiguiente = indiceActual >= 0 && indiceActual < total - 1

  const irA = useCallback(
    (indice: number): void => {
      if (indice < 0 || indice >= total) return
      const nuevo = pacientesOrdenados[indice]
      if (nuevo && alCambiarPaciente) {
        alCambiarPaciente(nuevo)
      }
    },
    [pacientesOrdenados, total, alCambiarPaciente]
  )

  const anterior = useCallback((): void => {
    if (hayAnterior) irA(indiceActual - 1)
  }, [hayAnterior, irA, indiceActual])

  const siguiente = useCallback((): void => {
    if (haySiguiente) irA(indiceActual + 1)
  }, [haySiguiente, irA, indiceActual])

  // F7-26: Cuando el paciente actual cambia, agregarlo al historial de recientes.
  // Esto cubre tanto navegación manual (← →) como selección desde Directorio/CommandPalette.
  // El método agregarPacienteReciente es idempotente (no duplica).
  useEffect(() => {
    if (pacienteActual?.id) {
      useSesionStore.getState().agregarPacienteReciente(pacienteActual)
    }
  }, [pacienteActual])

  return {
    indiceActual,
    total,
    hayAnterior,
    haySiguiente,
    anterior,
    siguiente,
    irA,
    pacienteActual,
    listaOrdenada: pacientesOrdenados,
  }
}
