import type { CampaignMemoryEntry, GameplayMessage } from '@/lib/aigm/campaign-storage'

export const DIRECT_RECENT_MESSAGE_COUNT = 16

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have',
  'he', 'her', 'here', 'him', 'his', 'how', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'our', 'she', 'so', 'that',
  'the', 'their', 'them', 'there', 'they', 'this', 'to', 'us', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who', 'why',
  'with', 'would', 'you', 'your', 'about', 'again', 'back', 'before', 'remember', 'same', 'still', 'already', 'prior', 'previous', 'yesterday', 'last', 'night', 'earlier', 'thing', 'stuff', 'place', 'one', 'some', 'something', 'personally', 'observed', 'observe', 'saw', 'seen', 'search', 'transcript', 'looking', 'look', 'find', 'lookup', 'history', 'record', 'notes', 'campaign',
])

const CONTINUITY_REQUEST_PATTERN = /\b(?:remember|previously|earlier|before|back to|go back|return to|returning|again|same|still|already|prior|previous|yesterday|last night|last time|used to|old|from level|when we were|when we|what did we|who was|where was|have we seen|didn['’]?t we|do we still|we promised|we owed|that inn|that tavern|that temple|that person|that woman|that man|that guard|those people|campaign notes?|campaign history|history|transcript|campaign record|retained record|look up|lookup|find|search|check (?:the )?(?:transcript|history|record|notes?))\b/i

const CONTINUITY_AUDIT_PATTERN = /\b(?:hang on|hold on|are you sure|double[- ]check|check that|verify that|continuity (?:error|drift|problem)|contradict(?:ion|ed|s|ory)?|doesn['’]?t make sense|does not make sense|that can['’]?t be right|that cannot be right|you (?:said|told me|described|established)|i thought (?:you|we)|wasn['’]?t that|weren['’]?t (?:they|we|you)|didn['’]?t you|wait[,! ]+(?:hang on|what|i thought|wasn['’]?t|weren['’]?t|didn['’]?t|that))\b/i

function normalizedPhrase(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizedTokens(value: string) {
  const baseTokens = normalizedPhrase(value)
    .match(/[a-z0-9][a-z0-9-]{2,}/g)
    ?.filter((token) => !STOPWORDS.has(token)) ?? []
  const expanded = baseTokens.flatMap((token) => {
    if (token === 'guard' || token === 'guards') return [token, 'watch', 'constable', 'officer', 'sentinel']
    if (token === 'fiddler') return [token, 'fiddle', 'musician']
    if (token === 'cart') return [token, 'stall']
    if (token === 'stall') return [token, 'cart']
    if (token === 'note') return [token, 'paper', 'message']
    if (token === 'paper') return [token, 'note', 'message']
    if (token === 'handoff') return [token, 'transfer', 'exchange', 'pass']
    return [token]
  })
  return Array.from(new Set(expanded)).slice(0, 32)
}

function scoreText(tokens: string[], value: string) {
  const lower = normalizedPhrase(value)
  return tokens.reduce((score, token) => score + (lower.includes(token) ? (token.length >= 7 ? 4 : 2) : 0), 0)
}

function editDistanceAtMostOne(left: string, right: string) {
  if (left === right) return true
  if (Math.abs(left.length - right.length) > 1) return false

  let leftIndex = 0
  let rightIndex = 0
  let edits = 0
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1
      rightIndex += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (left.length > right.length) leftIndex += 1
    else if (right.length > left.length) rightIndex += 1
    else {
      leftIndex += 1
      rightIndex += 1
    }
  }
  if (leftIndex < left.length || rightIndex < right.length) edits += 1
  return edits <= 1
}

function memoryReferenceStrength(query: string, entry: CampaignMemoryEntry) {
  const normalizedQuery = normalizedPhrase(query)
  const queryTokens = normalizedTokens(query)
  if (!normalizedQuery || queryTokens.length === 0) return 0

  const title = normalizedPhrase(entry.title)
  if (title && title.length >= 3 && normalizedQuery.includes(title)) return 500
  const aliases = (entry.aliases ?? []).map(normalizedPhrase).filter((alias) => alias.length >= 3)
  if (aliases.some((alias) => normalizedQuery.includes(alias))) return 470

  const titleTokens = normalizedTokens([entry.title, ...(entry.aliases ?? [])].join(' ')).filter((token) => token.length >= 4)
  const strongTitleTokens = titleTokens.length <= 1 ? titleTokens : titleTokens.filter((token) => token.length >= 5)
  if (strongTitleTokens.some((titleToken) => queryTokens.includes(titleToken))) return 320

  // Voice transcription can shave or add a single letter to an established proper noun.
  // Keep fuzzy matching deliberately narrow so ordinary words do not become identity matches.
  if (strongTitleTokens.some((titleToken) => titleToken.length >= 5 && queryTokens.some((queryToken) => queryToken.length >= 4 && editDistanceAtMostOne(titleToken, queryToken)))) return 380

  const keywordPhrases = entry.keywords
    .map(normalizedPhrase)
    .filter((keyword) => keyword.length >= 5 || keyword.includes(' '))
  if (keywordPhrases.some((keyword) => normalizedQuery.includes(keyword))) return 100

  return 0
}

function referencedMemoryEntries(query: string, memoryIndex: CampaignMemoryEntry[]) {
  return memoryIndex
    .map((entry) => ({ entry, reference: memoryReferenceStrength(query, entry) }))
    .filter((candidate) => candidate.reference >= 100)
    .sort((left, right) => right.reference - left.reference || right.entry.last_turn - left.entry.last_turn)
}

export function isContinuityAuditRequest(message: string) {
  const text = message.trim()
  if (!text) return false
  return CONTINUITY_AUDIT_PATTERN.test(text)
}

export function shouldCheckCampaignNotes(message: string, memoryIndex: CampaignMemoryEntry[] = []) {
  const text = message.trim()
  if (!text) return false
  if (CONTINUITY_REQUEST_PATTERN.test(text) || isContinuityAuditRequest(text)) return true
  return referencedMemoryEntries(text, memoryIndex).length > 0
}

export interface CampaignRecallResult {
  memory_entries: CampaignMemoryEntry[]
  transcript_excerpts: Array<{ sequence: number; turn: number | null; role: 'user' | 'assistant'; text: string }>
}

interface RankedTranscriptEntry {
  sequence: number
  turn: number | null
  role: 'user' | 'assistant'
  text: string
  lexicalScore: number
  detailScore: number
  entityScore: number
  anchorScore: number
}

function clusterKey(entry: Pick<RankedTranscriptEntry, 'turn' | 'sequence'>) {
  if (entry.turn === null) return `sequence:${Math.floor(entry.sequence / 8)}`
  return `turn:${Math.floor(entry.turn / 4)}`
}

function appendDiversified(
  target: RankedTranscriptEntry[],
  candidates: RankedTranscriptEntry[],
  maximum: number,
  maximumPerCluster = 4,
) {
  const seen = new Set(target.map((entry) => entry.sequence))
  const clusterCounts = new Map<string, number>()
  for (const entry of target) {
    const key = clusterKey(entry)
    clusterCounts.set(key, (clusterCounts.get(key) ?? 0) + 1)
  }

  for (const entry of candidates) {
    if (target.length >= maximum) break
    if (seen.has(entry.sequence)) continue
    const key = clusterKey(entry)
    if ((clusterCounts.get(key) ?? 0) >= maximumPerCluster) continue
    target.push(entry)
    seen.add(entry.sequence)
    clusterCounts.set(key, (clusterCounts.get(key) ?? 0) + 1)
  }
}

export function searchCampaignHistory(
  query: string,
  memoryIndex: CampaignMemoryEntry[],
  transcript: GameplayMessage[],
  recentWindow = DIRECT_RECENT_MESSAGE_COUNT,
): CampaignRecallResult {
  const tokens = normalizedTokens(query)
  if (tokens.length === 0) return { memory_entries: [], transcript_excerpts: [] }

  const references = referencedMemoryEntries(query, memoryIndex)
  const referenceById = new Map(references.map(({ entry, reference }) => [entry.id, reference]))

  const rankedMemories = memoryIndex
    .map((entry) => ({
      entry,
      lexicalScore: scoreText(tokens, `${entry.title} ${(entry.aliases ?? []).join(' ')} ${entry.keywords.join(' ')} ${entry.summary} ${entry.source_excerpt}`),
      referenceScore: referenceById.get(entry.id) ?? 0,
    }))
    .map((candidate) => ({ ...candidate, score: candidate.lexicalScore + candidate.referenceScore }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || right.entry.last_turn - left.entry.last_turn)

  const identityReferences = references
    .filter(({ entry }) => ['npc', 'character', 'faction', 'location', 'item'].includes(entry.kind))
    .slice(0, 6)

  const entityLabels = identityReferences
    .flatMap(({ entry }) => [entry.title, ...(entry.aliases ?? [])])
    .map(normalizedPhrase)
    .filter((label) => label.length >= 3)
  const entityTokens = new Set(identityReferences
    .flatMap(({ entry }) => normalizedTokens([entry.title, ...(entry.aliases ?? [])].join(' '))))
  const detailTokens = tokens.filter((token) => !entityTokens.has(token))

  // Memories that match the distinctive scene language become transcript anchors.
  // This lets a query such as "Arven + upside-down coffee cup" reach the older
  // coffee-stall scene even when that scene predates the later proper name.
  const anchorMemories = detailTokens.length === 0 ? [] : rankedMemories
    .map((candidate) => ({
      entry: candidate.entry,
      detailScore: scoreText(detailTokens, `${candidate.entry.title} ${candidate.entry.keywords.join(' ')} ${candidate.entry.summary} ${candidate.entry.source_excerpt}`),
      contextScore: candidate.lexicalScore,
      referenceScore: candidate.referenceScore,
    }))
    .filter((candidate) => {
      if (candidate.detailScore <= 0 || (!candidate.entry.first_turn && !candidate.entry.last_turn)) return false
      const first = candidate.entry.first_turn || candidate.entry.last_turn
      const last = candidate.entry.last_turn || candidate.entry.first_turn
      // Scene anchors should point to a compact historical neighborhood. Long-lived
      // NPC or faction records span many turns and would otherwise drag a whole era
      // into recall merely because a later summary mentions the queried detail.
      return Math.max(0, last - first) <= 12
    })
    .sort((left, right) =>
      right.detailScore - left.detailScore
      || right.contextScore - left.contextScore
      || Number(right.referenceScore > 0) - Number(left.referenceScore > 0)
      || right.entry.last_turn - left.entry.last_turn)
    .slice(0, 4)

  const memoryEntries: CampaignMemoryEntry[] = []
  const memoryIds = new Set<string>()
  for (const candidate of [...anchorMemories.map((candidate) => ({ entry: candidate.entry })), ...rankedMemories]) {
    if (memoryEntries.length >= 8) break
    if (memoryIds.has(candidate.entry.id)) continue
    memoryEntries.push(candidate.entry)
    memoryIds.add(candidate.entry.id)
  }

  const oldTranscriptEnd = Math.max(0, transcript.length - Math.max(0, recentWindow))
  const rankedTranscript = transcript
    .slice(0, oldTranscriptEnd)
    .map((entry): RankedTranscriptEntry => {
      const normalizedText = normalizedPhrase(entry.text)
      const entityScore = entityLabels.reduce((score, label) => score + (normalizedText.includes(label) ? 8 : 0), 0)
      const detailScore = scoreText(detailTokens, entry.text)
      const anchorScore = entry.turn_number === null ? 0 : anchorMemories.reduce((score, anchor) => {
        const first = anchor.entry.first_turn || anchor.entry.last_turn
        const last = anchor.entry.last_turn || anchor.entry.first_turn
        return entry.turn_number !== null && entry.turn_number >= Math.max(0, first - 2) && entry.turn_number <= last + 2
          ? Math.max(score, 40 + (anchor.detailScore * 4) + Math.min(20, anchor.contextScore) + (anchor.referenceScore > 0 ? 4 : 0))
          : score
      }, 0)
      return {
        sequence: entry.sequence,
        turn: entry.turn_number,
        role: entry.role,
        text: entry.text.slice(0, 1800),
        lexicalScore: scoreText(tokens, entry.text),
        detailScore,
        entityScore,
        anchorScore,
      }
    })
    .filter((candidate) => candidate.lexicalScore > 0 || candidate.entityScore > 0 || candidate.anchorScore > 0)

  const selected: RankedTranscriptEntry[] = []

  appendDiversified(
    selected,
    rankedTranscript
      .filter((entry) => entry.anchorScore > 0)
      .sort((left, right) => right.anchorScore - left.anchorScore || right.detailScore - left.detailScore || right.lexicalScore - left.lexicalScore || right.sequence - left.sequence),
    12,
  )
  appendDiversified(
    selected,
    rankedTranscript
      .filter((entry) => entry.detailScore > 0)
      .sort((left, right) => right.detailScore - left.detailScore || right.lexicalScore - left.lexicalScore || right.sequence - left.sequence),
    12,
  )
  appendDiversified(
    selected,
    rankedTranscript
      .filter((entry) => entry.entityScore > 0)
      .sort((left, right) => right.entityScore - left.entityScore || right.lexicalScore - left.lexicalScore || right.sequence - left.sequence),
    12,
  )
  appendDiversified(
    selected,
    rankedTranscript
      .sort((left, right) => (right.lexicalScore + right.detailScore + right.entityScore + right.anchorScore) - (left.lexicalScore + left.detailScore + left.entityScore + left.anchorScore) || right.sequence - left.sequence),
    12,
  )

  const transcriptExcerpts = selected
    .sort((left, right) => left.sequence - right.sequence)
    .map(({ lexicalScore: _lexicalScore, detailScore: _detailScore, entityScore: _entityScore, anchorScore: _anchorScore, ...entry }) => entry)

  return { memory_entries: memoryEntries, transcript_excerpts: transcriptExcerpts }
}

export function campaignMigrationSample(transcript: GameplayMessage[], maximumMessages = 48) {
  if (transcript.length === 0) return []
  if (transcript.length <= maximumMessages) return transcript.map((entry) => ({ sequence: entry.sequence, turn: entry.turn_number, role: entry.role, text: entry.text.slice(0, 1200) }))

  const selected = new Set<number>()
  const edge = Math.min(10, Math.floor(maximumMessages / 3))
  for (let index = 0; index < edge; index += 1) selected.add(index)
  for (let index = transcript.length - edge; index < transcript.length; index += 1) selected.add(index)
  const remaining = maximumMessages - selected.size
  for (let step = 1; step <= remaining; step += 1) {
    selected.add(Math.floor((step * (transcript.length - 1)) / (remaining + 1)))
  }

  return Array.from(selected)
    .sort((left, right) => left - right)
    .slice(0, maximumMessages)
    .map((index) => ({ sequence: transcript[index].sequence, turn: transcript[index].turn_number, role: transcript[index].role, text: transcript[index].text.slice(0, 1200) }))
}
