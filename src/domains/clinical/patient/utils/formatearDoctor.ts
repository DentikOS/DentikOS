export interface DoctorClinica {
  id: string
  nombre: string
  especialidad?: string
}

export const DOCTORES_CLINICA_DEFAULT: readonly DoctorClinica[] = [
  { id: 'doc-1', nombre: 'Dra. Camila Soto', especialidad: 'Ortodoncia' },
  { id: 'doc-2', nombre: 'Dr. Roberto Gómez', especialidad: 'Implantología' },
  { id: 'doc-3', nombre: 'Dra. Valentina Ríos', especialidad: 'Rehabilitación' },
  { id: 'doc-4', nombre: 'Dr. Miguel Díaz', especialidad: 'Cirugía Maxilofacial' },
  { id: 'doc-5', nombre: 'Dra. Andrea Morales', especialidad: 'Endodoncia' },
]

export const formatearDoctorTratante = (
  doctor?: string | null,
  doctorTratanteId?: string | null
): { texto: string; asignado: boolean } => {
  if (doctorTratanteId) {
    const encontrado = DOCTORES_CLINICA_DEFAULT.find((d) => d.id === doctorTratanteId)
    if (encontrado) return { texto: encontrado.nombre, asignado: true }
  }
  if (!doctor || !doctor.trim()) {
    return { texto: 'Sin asignar', asignado: false }
  }
  const lim = doctor.trim()
  const lower = lim.toLowerCase()
  if (
    lower === 'tratante' ||
    lower === 'dr tratante' ||
    lower === 'dr. tratante' ||
    lower === 'sin asignar'
  ) {
    return { texto: 'Sin asignar', asignado: false }
  }
  const docPorNombre = DOCTORES_CLINICA_DEFAULT.find(
    (d) => d.nombre.toLowerCase() === lower || d.id === lim
  )
  if (docPorNombre) return { texto: docPorNombre.nombre, asignado: true }

  return { texto: lim, asignado: true }
}
