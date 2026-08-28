import fs from 'node:fs'
import path from 'node:path'

interface SettingReferenceChunk {
  id: string
  title: string
  tags: string[]
  era: string
  editionScope: string
  text: string
}

interface SettingPack {
  schemaVersion: number
  id: string
  displayName: string
  aliases: string[]
  canonFrame: {
    defaultEra: string
    editionAssumptions: string
    timelineNotes: string
  }
  campaignFoundations: string[]
  gameMasterGuidance: string[]
  canonBoundaries: string[]
  referenceChunks: SettingReferenceChunk[]
}

interface PreparedSettingPack {
  pack: SettingPack
  postings: Map<string, Map<number, number>>
  normalizedTags: string[][]
}

export type SettingLoreMode = 'homebrew' | 'canon-first' | 'custom-best-effort'

export interface SettingSelection {
  id: string
  label: string
  requestedLabel: string
  builtIn: boolean
  loreMode: SettingLoreMode
}

export interface SettingReferenceResult {
  setting: SettingSelection
  pack: SettingPack
  excerpts: Array<{
    title: string
    era: string
    editionScope: string
    text: string
  }>
}

const HOME_BREW_LABEL = 'Uncharted Homebrew Realm (Default)'
const HOME_BREW_ALIASES = new Set([
  'uncharted homebrew realm',
  'uncharted homebrew realm default',
  'uncharted homebrew',
  'homebrew realm',
  'homebrew',
  'traditional fantasy',
  'conventional fantasy',
  'generic fantasy',
  'original fantasy',
])

const SETTING_FILENAMES = [
  'forgotten-realms.json',
  'golarion.json',
  'imperium-of-man.json',
  'night-city.json',
  'exandria.json',
  'sixth-world.json',
  'eberron.json',
  'ravenloft.json',
  'world-of-darkness.json',
  'greyhawk.json',
  'dragonlance.json',
] as const

const SETTING_PACKS = SETTING_FILENAMES.map((filename) => {
  const filePath = path.join(process.cwd(), 'data', 'settings', filename)
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as SettingPack
})

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'been', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'for', 'from',
  'game', 'had', 'has', 'have', 'he', 'her', 'here', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'me', 'my',
  'of', 'on', 'or', 'our', 'player', 'setting', 'should', 'so', 'that', 'the', 'their', 'them', 'then', 'there', 'they', 'this',
  'to', 'use', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who', 'will', 'with', 'world', 'would', 'you', 'your',
])

function normalizeLookup(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizedTerms(value: string, maximum = Number.POSITIVE_INFINITY) {
  const terms = normalizeLookup(value)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !STOPWORDS.has(term))
  return Array.from(new Set(terms)).slice(0, maximum)
}

function addPosting(postings: Map<string, Map<number, number>>, term: string, chunkIndex: number, weight: number) {
  const byChunk = postings.get(term) || new Map<number, number>()
  byChunk.set(chunkIndex, Math.min((byChunk.get(chunkIndex) || 0) + weight, 30))
  postings.set(term, byChunk)
}

function preparePack(pack: SettingPack): PreparedSettingPack {
  const postings = new Map<string, Map<number, number>>()
  const normalizedTags: string[][] = []

  pack.referenceChunks.forEach((chunk, chunkIndex) => {
    for (const term of normalizedTerms(chunk.title)) addPosting(postings, term, chunkIndex, 12)
    for (const tag of chunk.tags) {
      for (const term of normalizedTerms(tag)) addPosting(postings, term, chunkIndex, 16)
    }
    for (const term of normalizedTerms(`${chunk.era} ${chunk.editionScope}`)) addPosting(postings, term, chunkIndex, 5)

    const counts = new Map<string, number>()
    for (const term of normalizeLookup(chunk.text).split(/\s+/)) {
      if (term.length < 3 || STOPWORDS.has(term)) continue
      counts.set(term, Math.min((counts.get(term) || 0) + 1, 4))
    }
    for (const [term, count] of counts) addPosting(postings, term, chunkIndex, count)
    normalizedTags.push(chunk.tags.map(normalizeLookup).filter(Boolean))
  })

  return { pack, postings, normalizedTags }
}

const PREPARED_PACKS = SETTING_PACKS.map(preparePack)
const PACK_BY_ID = new Map(PREPARED_PACKS.map((prepared) => [prepared.pack.id, prepared]))
const ALIAS_ENTRIES = PREPARED_PACKS.flatMap((prepared) => {
  const labels = [prepared.pack.id, prepared.pack.displayName, ...prepared.pack.aliases]
  return labels.map((label) => ({ normalized: normalizeLookup(label), prepared }))
}).filter((entry) => entry.normalized)
  .sort((left, right) => right.normalized.length - left.normalized.length)

function exactPackFor(value: string) {
  const normalized = normalizeLookup(value)
  return ALIAS_ENTRIES.find((entry) => entry.normalized === normalized)?.prepared || null
}

function segmentedCandidates(value: string) {
  return value
    .split(/[,;/|()\[\]]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function settingFromSetupAnswer(value: string) {
  return value.match(/(?:^|\n)\s*Setting:\s*([^\n]+)/i)?.[1]?.trim() || ''
}

export function selectedSettingFromSetupAnswers(answers: string[]) {
  for (let index = answers.length - 1; index >= 0; index -= 1) {
    const setting = settingFromSetupAnswer(answers[index] || '')
    if (setting) return setting
  }
  return ''
}

export function supportedSettingFor(value: string): SettingSelection {
  const requestedLabel = value.trim()
  if (HOME_BREW_ALIASES.has(normalizeLookup(requestedLabel || HOME_BREW_LABEL))) {
    return {
      id: 'uncharted-homebrew-realm',
      label: HOME_BREW_LABEL,
      requestedLabel: requestedLabel || HOME_BREW_LABEL,
      builtIn: false,
      loreMode: 'homebrew',
    }
  }

  const exact = exactPackFor(requestedLabel)
  if (exact) {
    return {
      id: exact.pack.id,
      label: exact.pack.displayName,
      requestedLabel: requestedLabel || exact.pack.displayName,
      builtIn: true,
      loreMode: 'canon-first',
    }
  }

  for (const candidate of segmentedCandidates(requestedLabel)) {
    const prepared = exactPackFor(candidate)
    if (prepared) {
      return {
        id: prepared.pack.id,
        label: prepared.pack.displayName,
        requestedLabel,
        builtIn: true,
        loreMode: 'canon-first',
      }
    }
  }

  const normalized = normalizeLookup(requestedLabel)
  const contained = ALIAS_ENTRIES.find((entry) => entry.normalized.length >= 6 && (` ${normalized} `).includes(` ${entry.normalized} `))
  if (contained) {
    return {
      id: contained.prepared.pack.id,
      label: contained.prepared.pack.displayName,
      requestedLabel,
      builtIn: true,
      loreMode: 'canon-first',
    }
  }

  return {
    id: 'other-best-effort',
    label: requestedLabel || 'Custom setting',
    requestedLabel,
    builtIn: false,
    loreMode: 'custom-best-effort',
  }
}

function coreReferenceText(pack: SettingPack) {
  return [
    `Default era: ${pack.canonFrame.defaultEra}`,
    `Edition assumptions: ${pack.canonFrame.editionAssumptions}`,
    `Timeline notes: ${pack.canonFrame.timelineNotes}`,
    '',
    'Campaign foundations:',
    ...pack.campaignFoundations.map((entry) => `- ${entry}`),
    '',
    'Game Master guidance:',
    ...pack.gameMasterGuidance.map((entry) => `- ${entry}`),
    '',
    'Canon boundaries:',
    ...pack.canonBoundaries.map((entry) => `- ${entry}`),
  ].join('\n')
}

export function settingReferenceFor(selection: SettingSelection, query: string, maximumCharacters = 15_000): SettingReferenceResult | null {
  if (selection.loreMode !== 'canon-first' || !selection.builtIn || selection.id === 'other-best-effort') return null
  const prepared = PACK_BY_ID.get(selection.id)
  if (!prepared) return null

  const { pack, postings, normalizedTags } = prepared
  const scores = new Map<number, number>()
  const queryTerms = normalizedTerms(query, 48)
  const normalizedQuery = normalizeLookup(query)

  for (const term of queryTerms) {
    const matches = postings.get(term)
    if (!matches) continue
    const rarity = 1 + Math.log((pack.referenceChunks.length + 1) / (matches.size + 1))
    for (const [chunkIndex, weight] of matches) {
      scores.set(chunkIndex, (scores.get(chunkIndex) || 0) + weight * rarity)
    }
  }

  normalizedTags.forEach((tags, chunkIndex) => {
    for (const tag of tags) {
      if (tag.length >= 4 && (` ${normalizedQuery} `).includes(` ${tag} `)) {
        scores.set(chunkIndex, (scores.get(chunkIndex) || 0) + 30 + Math.min(tag.length, 24))
      }
    }
  })

  const rankedIndexes = scores.size
    ? [...scores.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0]).map(([index]) => index)
    : pack.referenceChunks.slice(0, 3).map((_, index) => index)

  const core = coreReferenceText(pack)
  let used = core.length
  const excerpts: SettingReferenceResult['excerpts'] = []
  for (const index of rankedIndexes) {
    if (excerpts.length >= 4) break
    const chunk = pack.referenceChunks[index]
    if (!chunk) continue
    const remaining = maximumCharacters - used
    if (remaining < 700) break
    const text = chunk.text.length > remaining ? chunk.text.slice(0, remaining) : chunk.text
    excerpts.push({
      title: chunk.title,
      era: chunk.era,
      editionScope: chunk.editionScope,
      text,
    })
    used += text.length + chunk.title.length + chunk.era.length + chunk.editionScope.length + 40
  }

  return { setting: selection, pack, excerpts }
}

export function formatSettingReference(reference: SettingReferenceResult | null) {
  if (!reference) return ''
  const { setting, pack, excerpts } = reference
  return [
    `BUILT-IN SETTING REFERENCE: ${pack.displayName}`,
    setting.requestedLabel && normalizeLookup(setting.requestedLabel) !== normalizeLookup(pack.displayName)
      ? `Player's selected name: ${setting.requestedLabel}`
      : '',
    '',
    coreReferenceText(pack),
    excerpts.length ? '\nRelevant reference chunks for this turn:' : '',
    ...excerpts.map((excerpt, index) => [
      `\n[${index + 1}] ${excerpt.title}`,
      `Era: ${excerpt.era}`,
      `Edition scope: ${excerpt.editionScope}`,
      excerpt.text,
    ].join('\n')),
  ].filter(Boolean).join('\n')
}

export function settingPackIds() {
  return SETTING_PACKS.map((pack) => pack.id)
}
