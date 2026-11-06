export const esZonaHorariaIanaValida = (zonaHoraria: string): boolean => {
  try {
    new Intl.DateTimeFormat('es-CL', { timeZone: zonaHoraria })
    return true
  } catch {
    return false
  }
}

const ZONAS_HORARIAS_FALLBACK = [
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Caracas',
  'America/Chicago',
  'America/Denver',
  'America/La_Paz',
  'America/Lima',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Santiago',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Pacific/Auckland',
  'UTC',
]

export const obtenerZonasHorariasIana = (): string[] => {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (clave: 'timeZone') => string[] }
    const zonas = intl.supportedValuesOf?.('timeZone')
    return Array.from(new Set(['UTC', ...(zonas || ZONAS_HORARIAS_FALLBACK)])).sort((a, b) => a.localeCompare(b))
  } catch {
    return ZONAS_HORARIAS_FALLBACK
  }
}
