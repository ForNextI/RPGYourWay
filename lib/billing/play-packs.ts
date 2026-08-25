export type PlayPackId = 'starter' | 'occasional' | 'regular' | 'frequent' | 'extended' | 'marathon'

export type PlayPack = {
  id: PlayPackId
  name: string
  priceCents: number
  allowanceMicrousd: number
  shortDescription: string
}

export const PLAY_PACKS: readonly PlayPack[] = [
  {
    id: 'starter',
    name: 'Starter Play',
    priceCents: 500,
    allowanceMicrousd: 4_250_000,
    shortDescription: 'A small first purchase with the same AI and features as every other Play Pack.',
  },
  {
    id: 'occasional',
    name: 'Occasional Play',
    priceCents: 1_500,
    allowanceMicrousd: 13_500_000,
    shortDescription: 'For occasional sessions and lighter ongoing use.',
  },
  {
    id: 'regular',
    name: 'Regular Play',
    priceCents: 3_000,
    allowanceMicrousd: 27_000_000,
    shortDescription: 'A comfortable middle-sized balance for regular play.',
  },
  {
    id: 'frequent',
    name: 'Frequent Play',
    priceCents: 4_500,
    allowanceMicrousd: 40_500_000,
    shortDescription: 'For campaigns that see frequent sessions or heavier AI use.',
  },
  {
    id: 'extended',
    name: 'Extended Play',
    priceCents: 6_500,
    allowanceMicrousd: 58_500_000,
    shortDescription: 'A larger prepaid balance for long-running campaigns.',
  },
  {
    id: 'marathon',
    name: 'Marathon Play',
    priceCents: 9_000,
    allowanceMicrousd: 81_000_000,
    shortDescription: 'The largest current Play Pack for sustained use.',
  },
] as const

export function playPackById(value: unknown): PlayPack | null {
  if (typeof value !== 'string') return null
  return PLAY_PACKS.find((pack) => pack.id === value) ?? null
}

export function formatPurchasePrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2).replace(/\.00$/, '')}`
}
