import { useDoctoresClinica } from './useDoctoresClinica'
import { formatearDoctorTratante } from '../utils/formatearDoctor'

/**
 * Hook que resuelve el nombre del doctor tratante desde su UUID.
 * Encapsula la obtención de doctores disponibles y la lógica de formateo.
 * 
 * @param doctorTratanteId - UUID del doctor tratante (puede ser null)
 * @param doctorFallback - Nombre del doctor como string (fallback legacy)
 * @returns { texto: string, asignado: boolean }
 */
export const useDoctorTratante = (
  doctorTratanteId?: string | null,
  doctorFallback?: unknown
): { texto: string; asignado: boolean } => {
  const { doctores } = useDoctoresClinica()

  return formatearDoctorTratante(doctorFallback, doctorTratanteId || null, doctores)
}
