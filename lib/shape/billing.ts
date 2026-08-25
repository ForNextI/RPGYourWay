import {
  SHAPE_SINGLE_PASS_CHARACTERS,
  buildShapeAnalysisChunks,
  buildShapeTranscriptChunks,
} from '@/lib/shape/transcript'
import { microusdCeilToCent, terraCostMicrousd } from '@/lib/usage/openai-cost'

const INPUT_CHARS_PER_ESTIMATED_TOKEN = 3.5
const QUOTE_SAFETY_FACTOR = 1.55
const MINIMUM_QUOTE_MICROUSD = 100_000

function inputTokenEstimate(characters: number) {
  return Math.max(1, Math.ceil(Math.max(0, characters) / INPUT_CHARS_PER_ESTIMATED_TOKEN))
}

function boundedOutputEstimate(characters: number, maximum: number, ratio: number) {
  return Math.min(maximum, Math.max(800, Math.ceil(Math.max(0, characters) * ratio)))
}

function estimatedCallCost(inputCharacters: number, outputTokens: number) {
  return terraCostMicrousd({
    inputTokens: inputTokenEstimate(inputCharacters),
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens,
  })
}

export function estimateShapeMaximumMicrousd(transcript: string, projectMode: boolean) {
  const clean = transcript.trim()
  if (!clean) return 0

  let estimated = 0
  if (!projectMode && clean.length <= SHAPE_SINGLE_PASS_CHARACTERS) {
    estimated += estimatedCallCost(
      clean.length + 18_000,
      boundedOutputEstimate(clean.length, 12_000, 0.075),
    )
  } else {
    const analysisChunks = buildShapeAnalysisChunks(clean)
    const writingChunks = buildShapeTranscriptChunks(clean)

    for (const chunk of analysisChunks) {
      // Prompt + prior/rolling continuity overhead is deliberately padded.
      estimated += estimatedCallCost(
        chunk.length + 50_000,
        boundedOutputEstimate(chunk.length, 5_000, 0.022),
      )
    }

    for (const chunk of writingChunks) {
      // Includes source, both seam contexts, continuity, provisional prose tail,
      // and a generous prompt/structured-output allowance.
      const inputCharacters = chunk.source.length + chunk.contextBefore.length + chunk.contextAfter.length + 50_000
      estimated += estimatedCallCost(
        inputCharacters,
        boundedOutputEstimate(chunk.source.length, 16_000, 0.075),
      )
    }
  }

  return Math.max(MINIMUM_QUOTE_MICROUSD, microusdCeilToCent(estimated * QUOTE_SAFETY_FACTOR))
}
