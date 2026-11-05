export const esZonaHorariaIanaValida = (zonaHoraria: string): boolean => {
  try {
    new Intl.DateTimeFormat('es-CL', { timeZone: zonaHoraria })
    return true
  } catch {
    return false
  }
}
