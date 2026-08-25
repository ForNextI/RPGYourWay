export const SHAPE_MAX_INPUT_CHARACTERS = 1_000_000
export const SHAPE_SINGLE_PASS_CHARACTERS = 45_000
export const SHAPE_TARGET_CHUNK_CHARACTERS = 30_000
export const SHAPE_CONTEXT_BEFORE_CHARACTERS = 5_000
export const SHAPE_CONTEXT_AFTER_CHARACTERS = 2_500
export const SHAPE_PROVISIONAL_PROSE_CHARACTERS = 12_000
export const SHAPE_MAX_CHUNKS = 40
export const SHAPE_ANALYSIS_TARGET_CHARACTERS = 140_000
export const SHAPE_MAX_ANALYSIS_CHUNKS = 10

export interface ShapeTranscriptAssessment {
  ready: boolean
  overPercent: number
  minimumParts: number
}

export interface ShapeTranscriptChunk {
  index: number
  writeStart: number
  writeEnd: number
  contextBefore: string
  source: string
  contextAfter: string
}

export interface WardensCampaignTranscriptExtraction {
  transcript: string
  title: string
  gameMasterName: string
}

export function assessShapeTranscript(length: number): ShapeTranscriptAssessment {
  if (length <= SHAPE_MAX_INPUT_CHARACTERS) return { ready: true, overPercent: 0, minimumParts: 1 }
  return {
    ready: false,
    overPercent: Math.max(1, Math.ceil(((length / SHAPE_MAX_INPUT_CHARACTERS) - 1) * 100)),
    minimumParts: Math.ceil(length / SHAPE_MAX_INPUT_CHARACTERS),
  }
}

function findPlayerTurnBoundary(text: string, minimumEnd: number, maximumEnd: number) {
  const window = text.slice(minimumEnd, maximumEnd)
  const playerTurn = /\n\nPLAYER(?:\s*·[^\n]*)?\n/g
  let boundary = -1
  for (const match of window.matchAll(playerTurn)) boundary = minimumEnd + (match.index ?? 0) + 2
  return boundary
}

function findLogicalBreakForTarget(text: string, start: number, targetCharacters: number, extraCharacters: number) {
  const minimumEnd = Math.min(text.length, start + Math.floor(targetCharacters * 0.84))
  const maximumEnd = Math.min(text.length, start + targetCharacters + extraCharacters)
  if (maximumEnd >= text.length) return text.length

  const avoidTinyFinalChunk = (candidate: number) => {
    const remaining = text.length - candidate
    const combinedLength = text.length - start
    return remaining > 0 && remaining < 1_000 && combinedLength <= targetCharacters + extraCharacters + 1_000
      ? text.length
      : candidate
  }

  const playerBoundary = findPlayerTurnBoundary(text, minimumEnd, maximumEnd)
  if (playerBoundary >= minimumEnd) return avoidTinyFinalChunk(playerBoundary)

  for (const marker of ['\n\n', '\n', '. ', '! ', '? ', '; ']) {
    const position = text.lastIndexOf(marker, maximumEnd)
    if (position >= minimumEnd) return avoidTinyFinalChunk(Math.min(text.length, position + marker.length))
  }

  return avoidTinyFinalChunk(Math.min(text.length, start + targetCharacters))
}

export function buildShapeTranscriptChunks(transcript: string): ShapeTranscriptChunk[] {
  const chunks: ShapeTranscriptChunk[] = []
  let writeStart = 0
  while (writeStart < transcript.length) {
    const writeEnd = findLogicalBreakForTarget(transcript, writeStart, SHAPE_TARGET_CHUNK_CHARACTERS, 4_000)
    const contextStart = Math.max(0, writeStart - SHAPE_CONTEXT_BEFORE_CHARACTERS)
    const contextEnd = Math.min(transcript.length, writeEnd + SHAPE_CONTEXT_AFTER_CHARACTERS)
    chunks.push({
      index: chunks.length,
      writeStart,
      writeEnd,
      contextBefore: transcript.slice(contextStart, writeStart),
      source: transcript.slice(writeStart, writeEnd),
      contextAfter: transcript.slice(writeEnd, contextEnd),
    })
    if (writeEnd <= writeStart) throw new Error('Script could not divide this transcript safely.')
    writeStart = writeEnd
  }
  if (chunks.length > SHAPE_MAX_CHUNKS) throw new Error('This transcript needs to be divided into smaller parts at a natural story break.')
  return chunks
}

export function buildShapeAnalysisChunks(transcript: string) {
  const chunks: string[] = []
  let start = 0
  while (start < transcript.length) {
    const end = findLogicalBreakForTarget(transcript, start, SHAPE_ANALYSIS_TARGET_CHARACTERS, 10_000)
    if (end <= start) throw new Error('Script could not divide the continuity pass safely.')
    chunks.push(transcript.slice(start, end))
    start = end
  }
  if (chunks.length > SHAPE_MAX_ANALYSIS_CHUNKS) throw new Error('This transcript needs to be divided into smaller parts at a natural story break.')
  return chunks
}


export function buildShapeRecoverySubchunks(source: string) {
  const chunks: string[] = []
  let start = 0
  while (start < source.length) {
    const end = findLogicalBreakForTarget(source, start, 14_000, 2_000)
    if (end <= start) throw new Error('Script could not divide the troublesome section for recovery.')
    chunks.push(source.slice(start, end))
    start = end
  }
  return chunks
}

export type ShapeWritingDisposition = 'prose' | 'no_new_prose'

export function reconcileShapeWritingSection(
  existingProse: string,
  originalTail: string,
  revisedTail: string,
  newProse: string,
  disposition: ShapeWritingDisposition = 'prose',
) {
  const cleanNewProse = newProse.trim()
  if (disposition === 'prose' && !cleanNewProse) {
    throw new Error('Script writing response declared prose but returned empty new_prose.')
  }
  if (disposition === 'no_new_prose' && cleanNewProse) {
    throw new Error('Script writing response declared no_new_prose but returned new prose.')
  }

  const cleanOriginalTail = originalTail.trim()
  const cleanRevisedTail = revisedTail.trim()
  if (!cleanOriginalTail) {
    if (cleanRevisedTail) throw new Error('Script unexpectedly returned prose before the first section.')
    return [existingProse.trim(), cleanNewProse].filter(Boolean).join('\n\n').trim()
  }

  // An empty revised tail means the model found no seam change worth making.
  // Keep the already-checkpointed tail instead of turning a valid writing step into a dead end.
  const replacementTail = cleanRevisedTail || cleanOriginalTail
  const revisedExisting = replaceProvisionalProseTail(existingProse, cleanOriginalTail, replacementTail)
  return [revisedExisting, cleanNewProse].filter(Boolean).join('\n\n').trim()
}

export function extractWardensCampaignTranscript(rawJson: string): WardensCampaignTranscriptExtraction | null {
  let parsed: unknown
  try { parsed = JSON.parse(rawJson) } catch { return null }
  if (!parsed || typeof parsed !== 'object') return null
  const campaign = parsed as {
    storage_schema?: unknown
    adventure_name?: unknown
    game_master_name?: unknown
    gameplay?: { transcript?: unknown }
  }
  if (campaign.storage_schema !== 1 && campaign.storage_schema !== 2) return null
  if (!campaign.gameplay || !Array.isArray(campaign.gameplay.transcript)) return null

  const gameMasterName = typeof campaign.game_master_name === 'string' && campaign.game_master_name.trim()
    ? campaign.game_master_name.trim()
    : 'GAME MASTER'
  const entries = campaign.gameplay.transcript
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return ''
      const message = entry as { role?: unknown; text?: unknown }
      if (message.role !== 'user' && message.role !== 'assistant') return ''
      if (typeof message.text !== 'string' || !message.text.trim()) return ''
      const speaker = message.role === 'assistant' ? gameMasterName.toUpperCase() : 'PLAYER'
      return `${speaker}\n${message.text.trim()}`
    })
    .filter(Boolean)

  if (entries.length < 2) return null
  return {
    transcript: entries.join('\n\n'),
    title: typeof campaign.adventure_name === 'string' ? campaign.adventure_name.trim().slice(0, 120) : '',
    gameMasterName,
  }
}

export function provisionalProseTail(text: string) {
  const clean = text.trim()
  if (!clean) return ''
  const paragraphStarts: number[] = []
  let searchFrom = clean.length
  while (paragraphStarts.length < 5) {
    const separator = clean.lastIndexOf('\n\n', searchFrom - 1)
    if (separator < 0) break
    paragraphStarts.push(separator + 2)
    searchFrom = separator
  }
  const paragraphStart = paragraphStarts.length > 0 ? paragraphStarts.at(-1)! : 0
  const boundedStart = Math.max(0, clean.length - SHAPE_PROVISIONAL_PROSE_CHARACTERS)
  let start = Math.max(paragraphStart, boundedStart)
  if (start === boundedStart && boundedStart > 0) {
    const nextParagraph = clean.indexOf('\n\n', boundedStart)
    if (nextParagraph >= 0 && nextParagraph + 2 < clean.length) start = nextParagraph + 2
  }
  return clean.slice(start).trim()
}

export function replaceProvisionalProseTail(text: string, originalTail: string, revisedTail: string) {
  const clean = text.trim()
  if (!originalTail) return clean
  if (!clean.endsWith(originalTail)) throw new Error('Script could not safely locate the provisional prose seam.')
  const prefix = clean.slice(0, clean.length - originalTail.length).trimEnd()
  return [prefix, revisedTail.trim()].filter(Boolean).join('\n\n')
}

export function normalizeShapeTranscriptForFingerprint(transcript: string) {
  return transcript
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
