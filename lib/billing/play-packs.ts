export type PlayPackId = 'starter' | 'occasional' | 'regular' | 'frequent' | 'extended' | 'marathon'

export type PlayPack = {
  id: PlayPackId
  name: string
  priceCents: number
  usageCents: number
  siteOperatingCents: number
  shortDescription: string
}

export const PLAY_PACKS: readonly PlayPack[] = [
  {
    id: 'starter',
    name: 'Starter Play',
    priceCents: 572,
    usageCents: 500,
    siteOperatingCents: 25,
    shortDescription: 'A small first purchase with the same AI and features as every other Play Pack.',
  },
  {
    id: 'occasional',
    name: 'Occasional Play',
    priceCents: 1_653,
    usageCents: 1_500,
    siteOperatingCents: 75,
    shortDescription: 'For occasional sessions and lighter ongoing use.',
  },
  {
    id: 'regular',
    name: 'Regular Play',
    priceCents: 3_275,
    usageCents: 3_000,
    siteOperatingCents: 150,
    shortDescription: 'A comfortable middle-sized balance for regular play.',
  },
  {
    id: 'frequent',
    name: 'Frequent Play',
    priceCents: 4_897,
    usageCents: 4_500,
    siteOperatingCents: 225,
    shortDescription: 'For campaigns that see frequent sessions or heavier AI use.',
  },
  {
    id: 'extended',
    name: 'Extended Play',
    priceCents: 7_060,
    usageCents: 6_500,
    siteOperatingCents: 325,
    shortDescription: 'A larger prepaid balance for long-running campaigns.',
  },
  {
    id: 'marathon',
    name: 'Marathon Play',
    priceCents: 9_763,
    usageCents: 9_000,
    siteOperatingCents: 450,
    shortDescription: 'The largest current Play Pack for sustained use.',
  },
] as const

export function playPackById(value: unknown): PlayPack | null {
  if (typeof value !== 'string') return null
  return PLAY_PACKS.find((pack) => pack.id === value) ?? null
}

export function formatPurchasePrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`
}

export function formatUsageValue(usageCents: number): string {
  return `$${(usageCents / 100).toFixed(2)}`
}

export function nominalUsageMicrousd(pack: PlayPack): number {
  return pack.usageCents * 10_000
}

export function includedProcessingCents(pack: PlayPack): number {
  return Math.max(0, pack.priceCents - pack.usageCents - pack.siteOperatingCents)
}
