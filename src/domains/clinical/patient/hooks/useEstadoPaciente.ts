import { useMemo } from 'react'
import { calcularEstadoClinico } from '../utils/estadosPacienteCalculations'
import type { Paciente } from '../schemas/pacienteSchema'

/**
 * Hook de SOLO LECTURA que retorna el estado clínico calculado del paciente.
 * NO escribe al store ni sobreescribe estados manuales.
 * 
 * El estado clínico se calcula así:
 * - 'nuevo': si no hay fecha de última visita
 * - 'inactivo': si la última visita fue hace más de 12 meses
 * - 'activo': si la última visita fue hace menos de 12 meses
 * 
 * Para actualizar el estado manualmente, usar SelectorEstadoPaciente.
 */
export const useEstadoPaciente = (paciente: Paciente | null) => {
  const estadoCalculado = useMemo(() => {
    if (!paciente) return null
    return calcularEstadoClinico(paciente)
  }, [paciente?.id, paciente?.fechaUltimaVisita, (paciente as unknown as Record<string, unknown>)?.ultimaVisita])

  return estadoCalculado
}
