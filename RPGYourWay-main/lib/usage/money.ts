export const MICRO_USD_PER_DOLLAR = 1_000_000
export const MICRO_USD_PER_CENT = 10_000

export function usageMicrousd(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.trunc(value))
  if (typeof value === 'string' && /^\d+$/.test(value)) return Math.max(0, Number.parseInt(value, 10))
  return 0
}

export function roundUsageMicrousdToCent(value: unknown): number {
  const parsed = usageMicrousd(value)
  return Math.round(parsed / MICRO_USD_PER_CENT) * MICRO_USD_PER_CENT
}

export function formatUsageDollars(value: unknown): string {
  return `$${(usageMicrousd(value) / MICRO_USD_PER_DOLLAR).toFixed(2)}`
}

export function signedUsageDollars(value: unknown): string {
  const parsed = typeof value === 'number'
    ? Math.trunc(value)
    : typeof value === 'string' && /^-?\d+$/.test(value)
      ? Number.parseInt(value, 10)
      : 0
  const prefix = parsed > 0 ? '+' : parsed < 0 ? '−' : ''
  return `${prefix}$${(Math.abs(parsed) / MICRO_USD_PER_DOLLAR).toFixed(2)}`
}
