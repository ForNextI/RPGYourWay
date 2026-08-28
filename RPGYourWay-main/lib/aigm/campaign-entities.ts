export type CampaignMemoryKind = 'location' | 'npc' | 'faction' | 'item' | 'promise' | 'relationship' | 'event' | 'mystery' | 'character' | 'other'

export interface CampaignMemoryEntry {
  id: string
  kind: CampaignMemoryKind
  title: string
  summary: string
  keywords: string[]
  first_turn: number
  last_turn: number
  source_excerpt: string
  /** Earlier or alternate labels that should resolve to this same canonical entity. */
  aliases?: string[]
  /** Monotonic local revision used to avoid rewriting unchanged IndexedDB rows. */
  revision?: number
}

export interface CampaignRetcon {
  id: string
  subject: string
  canonical_fact: string
  keywords: string[]
  turn: number
  source_excerpt: string
  created_at: string
  revision?: number
}

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalize(value: string) {
  return clean(value)
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(value: string) {
  return new Set(normalize(value).split(' ').filter((token) => token.length >= 3))
}

function titleTokens(value: string) {
  return new Set(normalize(value).split(' ').filter((token) => token.length >= 2 || /^\d+$/.test(token)))
}

function keywordTokens(entry: CampaignMemoryEntry) {
  const title = tokens(entry.title)
  const result = new Set<string>()
  for (const keyword of entry.keywords) {
    for (const token of tokens(keyword)) {
      if (!title.has(token)) result.add(token)
    }
  }
  return result
}

function intersectionSize(left: Set<string>, right: Set<string>) {
  let count = 0
  for (const value of left) if (right.has(value)) count += 1
  return count
}

function titleSubsetMatch(left: CampaignMemoryEntry, right: CampaignMemoryEntry) {
  if (left.kind !== 'npc' || right.kind !== 'npc') return false
  const leftTokens = titleTokens(left.title)
  const rightTokens = titleTokens(right.title)
  if (leftTokens.size === 0 || rightTokens.size === 0) return false

  const smaller = leftTokens.size <= rightTokens.size ? leftTokens : rightTokens
  const larger = leftTokens.size <= rightTokens.size ? rightTokens : leftTokens
  if (smaller.size !== 1 || larger.size <= 1) return false
  if (![...smaller].every((token) => larger.has(token))) return false

  // A shared first name alone is not enough. Require additional contextual
  // overlap before collapsing differently titled legacy records.
  return intersectionSize(keywordTokens(left), keywordTokens(right)) >= 2
}

function entityMatch(left: CampaignMemoryEntry, right: CampaignMemoryEntry) {
  if (left.kind !== right.kind) return false

  // Stable ids are authoritative. Legacy records with two different non-empty
  // ids may describe the same person, but migration must not guess that they
  // are the same entity and silently choose one conflicting version as canon.
  // Future play can reconcile them only when an explicit stable-id update or
  // player correction/retcon supplies authority.
  if (left.id && right.id) return left.id === right.id

  const leftTitle = normalize(left.title)
  const rightTitle = normalize(right.title)
  if (leftTitle && leftTitle === rightTitle) return true
  return titleSubsetMatch(left, right)
}

function uniqueStrings(values: string[], maximum = 32) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const item = clean(value)
    const key = normalize(item)
    if (!item || !key || seen.has(key)) continue
    seen.add(key)
    result.push(item)
    if (result.length >= maximum) break
  }
  return result
}

function mergedEntry(prior: CampaignMemoryEntry, update: CampaignMemoryEntry): CampaignMemoryEntry {
  const priorRevision = Math.max(1, prior.revision ?? 1)
  const updateRevision = Math.max(1, update.revision ?? 1)
  const updateIsNewer = update.last_turn > prior.last_turn || (update.last_turn === prior.last_turn && updateRevision >= priorRevision)
  const current = updateIsNewer ? update : prior
  const older = updateIsNewer ? prior : update
  const canonicalId = prior.id || update.id
  const firstTurn = prior.first_turn > 0 && update.first_turn > 0
    ? Math.min(prior.first_turn, update.first_turn)
    : prior.first_turn || update.first_turn

  return {
    ...current,
    id: canonicalId,
    aliases: uniqueStrings([
      ...(current.aliases ?? []),
      ...(older.aliases ?? []),
      ...(normalize(current.title) !== normalize(older.title) ? [older.title] : []),
    ]),
    keywords: uniqueStrings([...prior.keywords, ...update.keywords], 40),
    first_turn: firstTurn,
    last_turn: Math.max(prior.last_turn, update.last_turn),
    source_excerpt: current.source_excerpt || older.source_excerpt,
    revision: Math.max(priorRevision, updateRevision) + 1,
  }
}

/**
 * Convert the legacy memory card pile into one active canonical record per
 * identifiable entity. History stays in the transcript; this catalogue is
 * the current truth used for recall and future generation.
 */
export function canonicalizeCampaignMemory(entries: CampaignMemoryEntry[]) {
  const canonical: CampaignMemoryEntry[] = []
  const idIndex = new Map<string, number>()
  const titleIndex = new Map<string, number>()
  const npcTokenIndex = new Map<string, Set<number>>()
  const npcSingleTitleIndex = new Map<string, Set<number>>()

  const titleKey = (entry: Pick<CampaignMemoryEntry, 'kind' | 'title'>) => `${entry.kind}:${normalize(entry.title)}`

  function addIndex(map: Map<string, Set<number>>, key: string, index: number) {
    const bucket = map.get(key) ?? new Set<number>()
    bucket.add(index)
    map.set(key, bucket)
  }

  function rememberNpcTokens(index: number, entry: CampaignMemoryEntry) {
    if (entry.kind !== 'npc') return
    for (const label of [entry.title, ...(entry.aliases ?? [])]) {
      const labelTokens = titleTokens(label)
      for (const token of labelTokens) addIndex(npcTokenIndex, token, index)
      if (labelTokens.size === 1) {
        for (const token of labelTokens) addIndex(npcSingleTitleIndex, token, index)
      }
    }
  }

  function rememberIdentity(index: number, entry: CampaignMemoryEntry, extraIds: string[] = [], extraTitles: string[] = []) {
    for (const id of [entry.id, ...extraIds]) if (id) idIndex.set(id, index)
    for (const title of [entry.title, ...(entry.aliases ?? []), ...extraTitles]) {
      const normalizedTitle = normalize(title)
      if (normalizedTitle) titleIndex.set(`${entry.kind}:${normalizedTitle}`, index)
    }
    rememberNpcTokens(index, entry)
  }

  function npcSubsetCandidate(entry: CampaignMemoryEntry) {
    if (entry.kind !== 'npc') return -1
    const currentTokens = titleTokens(entry.title)
    if (currentTokens.size === 0) return -1
    const candidateIndexes = new Set<number>()

    if (currentTokens.size === 1) {
      for (const token of currentTokens) {
        for (const index of npcTokenIndex.get(token) ?? []) candidateIndexes.add(index)
      }
    } else {
      // Our conservative legacy merge only joins a single-name NPC record with
      // a longer version of that same name. Multi-word vs. multi-word records
      // stay separate unless their stable id or exact title already matches.
      for (const token of currentTokens) {
        for (const index of npcSingleTitleIndex.get(token) ?? []) candidateIndexes.add(index)
      }
    }

    for (const index of candidateIndexes) {
      if (entityMatch(canonical[index], entry)) return index
    }
    return -1
  }

  for (const raw of entries) {
    if (!clean(raw.title) || !clean(raw.summary)) continue
    const entry: CampaignMemoryEntry = {
      ...raw,
      aliases: uniqueStrings(raw.aliases ?? []),
      keywords: uniqueStrings(raw.keywords ?? [], 40),
      revision: Math.max(1, raw.revision ?? 1),
    }

    let index = entry.id ? (idIndex.get(entry.id) ?? -1) : -1
    if (index < 0) {
      const titleCandidate = titleIndex.get(titleKey(entry)) ?? -1
      if (titleCandidate >= 0 && entityMatch(canonical[titleCandidate], entry)) index = titleCandidate
    }
    if (index < 0) index = npcSubsetCandidate(entry)

    if (index < 0) {
      index = canonical.length
      canonical.push(entry)
      rememberIdentity(index, entry)
      continue
    }

    const prior = canonical[index]
    const merged = mergedEntry(prior, entry)
    canonical[index] = merged
    rememberIdentity(index, merged, [prior.id, entry.id], [prior.title, entry.title])
  }

  return canonical.sort((left, right) => left.last_turn - right.last_turn || left.title.localeCompare(right.title))
}

export function stampCampaignMemoryUpdates(updates: CampaignMemoryEntry[], turn: number) {
  const authoritativeTurn = Number.isFinite(turn) ? Math.max(0, Math.floor(turn)) : 0
  return updates.map((entry) => ({
    ...entry,
    first_turn: authoritativeTurn,
    last_turn: authoritativeTurn,
  }))
}

export function mergeCampaignMemory(current: CampaignMemoryEntry[], updates: CampaignMemoryEntry[]) {
  return canonicalizeCampaignMemory([...current, ...updates])
}

function retconKey(retcon: Pick<CampaignRetcon, 'subject'>) {
  return normalize(retcon.subject)
}

export function mergeCampaignRetcons(current: CampaignRetcon[], updates: CampaignRetcon[]) {
  const merged = new Map<string, CampaignRetcon>()
  for (const entry of [...current, ...updates]) {
    const key = retconKey(entry)
    if (!key || !clean(entry.canonical_fact)) continue
    const prior = merged.get(key)
    const revision = Math.max(1, entry.revision ?? 1)
    if (!prior) {
      merged.set(key, { ...entry, keywords: uniqueStrings(entry.keywords ?? [], 40), revision })
      continue
    }
    const newer = entry.turn > prior.turn || (entry.turn === prior.turn && revision >= Math.max(1, prior.revision ?? 1))
    if (!newer) continue
    merged.set(key, {
      ...entry,
      id: prior.id || entry.id,
      keywords: uniqueStrings([...prior.keywords, ...entry.keywords], 40),
      revision: Math.max(Math.max(1, prior.revision ?? 1), revision) + 1,
    })
  }
  return [...merged.values()].sort((left, right) => left.turn - right.turn || left.subject.localeCompare(right.subject))
}

export function establishedNpcNames(entries: CampaignMemoryEntry[]) {
  return entries
    .filter((entry) => entry.kind === 'npc')
    .flatMap((entry) => [entry.title, ...(entry.aliases ?? [])])
    .filter(Boolean)
}
