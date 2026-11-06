const ZONA_HORARIA_POR_DEFECTO = 'America/Santiago'

export const fechaClinica = (valor: Date | string, zonaHoraria: string): string => {
  const fecha = valor instanceof Date ? valor : new Date(valor)
  if (!Number.isFinite(fecha.getTime())) return ''
  const obtener = (timeZone: string) => {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(fecha)
    const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((item) => item.type === tipo)?.value || ''
    return `${parte('year')}-${parte('month')}-${parte('day')}`
  }
  try {
    return obtener(zonaHoraria || ZONA_HORARIA_POR_DEFECTO)
  } catch {
    return obtener(ZONA_HORARIA_POR_DEFECTO)
  }
}

export const inicioSemanaClinica = (valor: Date | string, zonaHoraria: string): string => {
  const claveFecha = fechaClinica(valor, zonaHoraria)
  if (!claveFecha) return ''
  const [year, month, day] = claveFecha.split('-').map(Number)
  const fechaUtc = new Date(Date.UTC(year, month - 1, day))
  const desplazamientoLunes = (fechaUtc.getUTCDay() + 6) % 7
  fechaUtc.setUTCDate(fechaUtc.getUTCDate() - desplazamientoLunes)
  return fechaUtc.toISOString().slice(0, 10)
}
