import type { Paciente } from '../schemas/pacienteSchema'

const DIAS_SUGERENCIA = 7

/**
 * Determina si debe mostrarse la sugerencia suave de completar antecedentes.
 * Aplica solo durante 7 días tras la creación y si faltan datos clave.
 */
export const debeMostrarSugerenciaCompletitud = (paciente: Paciente): boolean => {
  if (!paciente.fechaCreacion) return false

  const fechaCrea = new Date(paciente.fechaCreacion)
  if (Number.isNaN(fechaCrea.getTime())) return false

  const diasDesdeCreacion = Math.floor(
    (Date.now() - fechaCrea.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diasDesdeCreacion > DIAS_SUGERENCIA) return false

  // Verificar si faltan antecedentes clave
  const faltanDatos =
    !paciente.email ||
    !paciente.direccion ||
    !paciente.ocupacion ||
    !paciente.contactoEmergencia ||
    paciente.alergias === undefined ||
    paciente.alergias === '' ||
    (Array.isArray(paciente.alergias) && paciente.alergias.length === 0)

  return Boolean(faltanDatos)
}

export const MENSAJE_SUGERENCIA =
  'Complete los antecedentes médicos y de contacto para una atención integral.'
