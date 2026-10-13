export interface DoctorClinica {
  id: string
  nombre: string
  especialidad?: string
  rol?: string
}

export const formatearDoctorTratante = (
  doctor?: unknown,
  doctorTratanteId?: string | null,
  doctoresDisponibles?: readonly DoctorClinica[]
): { texto: string; asignado: boolean } => {
  if (doctorTratanteId && doctoresDisponibles && doctoresDisponibles.length > 0) {
    const encontrado = doctoresDisponibles.find((d) => d.id === doctorTratanteId)
    if (encontrado) return { texto: encontrado.nombre, asignado: true }
  }
  const doctorStr = typeof doctor === 'string' ? doctor : (doctor ? String(doctor) : null)
  if (!doctorStr || !doctorStr.trim()) {
    return { texto: 'Sin asignar', asignado: false }
  }
  const lim = doctorStr.trim()
  const lower = lim.toLowerCase()
  if (
    lower === 'tratante' ||
    lower === 'dr tratante' ||
    lower === 'dr. tratante' ||
    lower === 'sin asignar'
  ) {
    return { texto: 'Sin asignar', asignado: false }
  }
  if (doctoresDisponibles && doctoresDisponibles.length > 0) {
    const docPorNombre = doctoresDisponibles.find(
      (d) => d.nombre.toLowerCase() === lower || d.id === lim
    )
    if (docPorNombre) return { texto: docPorNombre.nombre, asignado: true }
  }

  return { texto: lim, asignado: true }
}
