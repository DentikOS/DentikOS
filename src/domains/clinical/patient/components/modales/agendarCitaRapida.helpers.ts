export const BOXES_CITA_RAPIDA = [
  'Sillón 1 - Odontología General',
  'Sillón 2 - Higiene & Ortodoncia',
  'Box 3 - Quirúrgico & Implantes',
]

export const PRESTACIONES_DEFAULT_RAPIDAS = [
  'Consulta General',
  'Evaluación Diagnóstica',
  'Limpieza / Profilaxis',
  'Exodoncia',
]

export const obtenerFechaMananaISO = (): string => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export const sumarMinutosHora = (hora: string, minutos: number): string => {
  const [hh, mm] = hora.split(':').map(Number)
  const total = (hh || 9) * 60 + (mm || 0) + minutos
  const finH = String(Math.floor(total / 60) % 24).padStart(2, '0')
  const finM = String(total % 60).padStart(2, '0')
  return `${finH}:${finM}`
}
