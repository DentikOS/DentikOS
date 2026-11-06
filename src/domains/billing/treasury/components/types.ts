import type { TreasuryActions } from '../hooks/useTreasury'
import type { TreasurySnapshot } from '../services/treasuryCloudService'

export interface TreasuryPanelProps {
  snapshot: TreasurySnapshot | null
  acciones: TreasuryActions
  online: boolean
  loading: boolean
}

export const numero = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const texto = (value: unknown, fallback = '—'): string =>
  typeof value === 'string' && value.trim() ? value : fallback

export const formatearMenor = (value: number, currency: string): string => {
  if (!Number.isSafeInteger(value)) return '—'
  try {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: 2 })
      .format(value / 100)
  } catch {
    return `${currency} ${(value / 100).toLocaleString('es-CL')}`
  }
}

export const montoMenorDesdeTexto = (value: string): number => {
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new RangeError('Ingresa un monto válido con hasta dos decimales.')
  const minor = Math.round(Number(normalized) * 100)
  if (!Number.isSafeInteger(minor)) throw new RangeError('El monto excede el límite permitido.')
  return minor
}

export const dateOnlySantiago = (): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date())

